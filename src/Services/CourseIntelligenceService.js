import { API_BASE_URL } from './config';
import { devLog, devWarn } from './devLogger';

/**
 * CourseIntelligenceService — the client for /study/course-intelligence.
 *
 * WHAT IT STREAMS
 * ───────────────
 * The backend investigates her course while she watches. Each event is a real
 * step landing, not a tick of a timer, which is the whole reason this is an
 * SSE stream and not a fetch with a spinner over it.
 *
 *   { status: 'course_intelligence_progress', step, state, progress, detail }
 *   { status: 'heartbeat' }                          — keep-alive only
 *   { status: 'course_intelligence_ready', report }
 *   { status: 'complete' }
 *   { status: 'error', message }
 *
 * THE WATCHDOG
 * ────────────
 * Three web searches run concurrently on the server and the slowest can sit
 * for forty seconds without producing an event. That is indistinguishable
 * from a dead backend unless the server says something, so it sends a
 * heartbeat every 10s — see COURSE_INTELLIGENCE_HEARTBEAT_S in NQBackEnd2's
 * main.py. CI_STALL_MS is the other half of that contract and must stay
 * comfortably above the heartbeat interval; CI_FIRST_EVENT_MS covers the
 * separate case where the request never reaches a running server at all
 * (Cloud Run cold start, dropped proxy).
 *
 * This is the same failure mode, and the same shape of fix, as the upload
 * NDJSON stream and the chat WebSocket. Change the two numbers together.
 *
 * FAILURE IS NOT AN ERROR SCREEN
 * ──────────────────────────────
 * `run` never rejects for a research pass that found nothing — that is a
 * normal outcome and the report simply lacks that section. It rejects only
 * when the stream itself fails, and even then the caller is expected to carry
 * on to the plan: her uploaded materials were always the primary source, and
 * they are already on the client.
 */

const CI_FIRST_EVENT_MS = 30000;   // request → first event
const CI_STALL_MS = 45000;         // any event → next event (heartbeats count)

// Time budget for the whole run. Past this the report we have is the report
// she gets — a student who has been watching a progress timeline for two
// minutes has stopped believing it.
const CI_TOTAL_MS = 150000;

/**
 * Kick off a course-intelligence run.
 *
 * @param {Object}   args
 * @param {string}   args.chatId
 * @param {Object}   args.courseContext  {school, courseCode, courseName, professor, examDescription, examDate}
 * @param {string}   [args.language]
 * @param {Function} [args.onEvent]      called with every progress event, in order
 * @returns {{ promise: Promise<Object|null>, abort: () => void }}
 *   promise resolves with the report, or null if the stream ended without one.
 */
export const run_course_intelligence = ({
  chatId,
  courseContext = {},
  materialsOnly = false,
  language = 'en',
  onEvent,
}) => {
  const controller = new AbortController();
  let stallTimer = null;
  let settled = false;

  const arm = (ms) => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), ms);
  };
  const totalTimer = setTimeout(() => controller.abort(), CI_TOTAL_MS);

  const emit = (event) => {
    if (typeof onEvent !== 'function') return;
    try { onEvent(event); } catch (e) { /* a bad listener must not kill the stream */ }
  };

  const promise = (async () => {
    let report = null;
    let streamError = null;
    const accept = (event) => {
      if (!event) return;
      arm(CI_STALL_MS);
      if (event.status === 'heartbeat') return;
      if (event.status === 'error') streamError = new Error(event.message || 'course_intelligence_failed');
      if (event.status === 'course_intelligence_ready') report = event.report || null;
      emit(event);
    };
    try {
      arm(CI_FIRST_EVENT_MS);
      const response = await fetch(`${API_BASE_URL}/study/course-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          courseContext,
          materials_only: materialsOnly,
          language: (language || 'en').split('-')[0].toLowerCase(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Course intelligence failed: ${response.status} ${text}`.trim());
      }
      if (!response.body || typeof response.body.getReader !== 'function') {
        // Older iOS Safari has no streaming reader. The run still completes
        // server-side; we just get every event at once at the end, which
        // makes the timeline jump rather than animate. Correct, not pretty.
        const text = await response.text();
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue;
          accept(safeParse(line.slice(5).trim()));
        }
        if (streamError && !report) throw streamError;
        return report;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const consume = (chunk) => {
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          accept(safeParse(line.slice(5).trim()));
        }
      };

      arm(CI_STALL_MS);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        arm(CI_STALL_MS);
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';
        blocks.forEach(consume);
      }
      if (buffer.trim()) consume(buffer);
      if (streamError && !report) throw streamError;

      settled = true;
      return report;
    } catch (error) {
      if (controller.signal.aborted) {
        devWarn('🔎 Course intelligence aborted (timeout or cancel)');
        // A partial report is still worth having: everything before the stall
        // is real, and the sections that never landed are simply absent.
        if (report) return report;
        throw new Error('course_intelligence_timeout');
      }
      console.error('❌ Course intelligence stream failed:', error);
      throw error;
    } finally {
      clearTimeout(stallTimer);
      clearTimeout(totalTimer);
      devLog(`🔎 Course intelligence stream closed (settled=${settled})`);
    }
  })();

  return { promise, abort: () => controller.abort() };
};

const safeParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch (e) {
    if ((raw || '').trim().length > 10) {
      devWarn('Failed to parse course-intelligence SSE chunk:', raw.slice(0, 120));
    }
    return null;
  }
};
