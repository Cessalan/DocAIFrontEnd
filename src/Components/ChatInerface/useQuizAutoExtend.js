import { useEffect, useRef, useState } from 'react';
import { extend_quiz_stream } from '../../Services/FastAPICalls';
import { devLog } from '../../Services/devLogger';

/**
 * useQuizAutoExtend — grows a chat quiz as the student works through it.
 *
 * WHY THIS EXISTS
 *
 * The backend generates a quiz as one parallel burst: ask for 15 questions and
 * 15 LLM calls go out immediately. Measured over 776 real 15-question quizzes,
 * 21.5% were never started and only 40.3% were finished, so roughly half of
 * everything generated was never seen. The in-loop cancellation check can't
 * recover any of it, because the calls are already in flight before it runs.
 *
 * So quizzes now arrive short. This hook adds the rest on demand, fetching the
 * next batch while the student is still answering the current one — the growth
 * is invisible and nobody waits at a batch boundary.
 *
 * DELIBERATE CHOICES
 *
 *  - Prefetch at LOOKAHEAD remaining, not on the last question. Firing at the
 *    end means the student watches a spinner at exactly the moment they had
 *    momentum, which is the thing this must not cost them.
 *
 *  - Never extends until the initial stream has finished. Extending mid-stream
 *    would race the questions still arriving and duplicate indices.
 *
 *  - MAX_TOTAL caps runaway growth. Without it a student who keeps answering
 *    would keep triggering batches forever — the opposite of the problem this
 *    was built to fix.
 *
 *  - One in-flight request at a time, tracked in a ref rather than state, so a
 *    re-render mid-fetch can't launch a second identical batch.
 *
 * Degrades silently: no chatId or no topic means no extension, and the student
 * simply gets the quiz they were given. An extension failure is never surfaced
 * — they still have unanswered questions in front of them.
 *
 * @param {Object}   params
 * @param {string}   params.chatId
 * @param {string}   params.topic         Subject the quiz was generated on.
 * @param {Array}    params.quizData      Questions currently loaded.
 * @param {number}   params.currentIndex  Zero-based position the student is on.
 * @param {boolean}  params.isStreaming   Initial generation still arriving.
 * @param {Function} params.onQuestions   Receives the new questions to append.
 * @param {boolean}  [params.enabled]
 */

// Start fetching once this many unanswered questions remain.
const LOOKAHEAD = 2;
const BATCH_SIZE = 5;
const MAX_TOTAL = 15;

export default function useQuizAutoExtend({
  chatId,
  topic,
  quizData,
  currentIndex,
  isStreaming,
  onQuestions,
  enabled = true
}) {
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const [extending, setExtending] = useState(false);

  const loaded = Array.isArray(quizData) ? quizData.length : 0;
  const remaining = loaded - (currentIndex + 1);

  useEffect(() => {
    if (!enabled || isStreaming) return undefined;
    if (!chatId || !topic) return undefined;
    if (inFlightRef.current) return undefined;
    if (loaded === 0 || loaded >= MAX_TOTAL) return undefined;
    if (remaining > LOOKAHEAD) return undefined;

    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;
    setExtending(true);

    const existingQuestions = quizData
      .map((q) => (q && typeof q.question === 'string' ? q.question : ''))
      .filter(Boolean);

    const count = Math.min(BATCH_SIZE, MAX_TOTAL - loaded);

    devLog(`🧩 Extending quiz: ${loaded} loaded, asking for ${count} more`);

    extend_quiz_stream({
      chatId,
      topic,
      existingQuestions,
      count,
      signal: controller.signal
    })
      .then((questions) => {
        if (controller.signal.aborted) return;
        if (questions && questions.length && onQuestions) {
          onQuestions(questions);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // Silent by design — the student still has questions in front of them.
        devLog('Quiz extend failed (non-fatal):', err?.message);
      })
      .finally(() => {
        inFlightRef.current = false;
        setExtending(false);
      });

    return () => {
      controller.abort();
      inFlightRef.current = false;
    };
    // `quizData` is intentionally excluded: appending the batch changes the
    // array identity, and re-running on that would immediately queue another.
    // `loaded` carries the only part of it this needs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isStreaming, chatId, topic, loaded, remaining, currentIndex, onQuestions]);

  useEffect(() => () => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { extending };
}

export { LOOKAHEAD, BATCH_SIZE, MAX_TOTAL };
