/* Why an upload failed, in a form a funnel row can be grouped by.

   2026-10-13: of ~70 failed uploads in the three weeks after the credits
   outage, about 60 left nothing in the Cloud Run error log. The browser knew
   why each one failed (a timer fired, the stream ended early, the phone went
   to sleep) and threw that away: `funnelEvents` only had upload_started and
   upload_completed, so a failure was just a missing row.

   Two kinds of failure, two mechanisms:
   - one the page lives to see. `upload_files_with_progress` attaches what it
     knew (`error.upload`) and `describeUploadFailure` turns it into a row.
   - one it doesn't (tab closed, reload, iOS killing a backgrounded tab). No
     catch block ever runs, so an in-flight marker is kept in localStorage and
     reported by `takeInterruptedUploads` on the next load. */

// Backend codes (NQBackEnd2 main.py upload stream, core/file_format.py) kept
// as their own reason: each points at a different fix.
const BACKEND_CODES = new Set([
  'capacity', 'processing_failed',
  'legacy_office', 'not_a_document', 'unreadable_document', 'unsupported_type',
]);

/** A short, groupable reason. Pure. */
export function uploadFailureReason(error) {
  const upload = error?.upload || {};
  if (BACKEND_CODES.has(error?.code)) return error.code;
  if (upload.timer === 'first_byte') return 'first_byte_timeout';
  if (upload.timer === 'stall') return 'stall_timeout';
  if (upload.timer === 'overall') return 'overall_timeout';
  if (upload.status) return `http_${upload.status}`;
  if (upload.endedEarly) return 'stream_ended_early';
  if (error?.code) return `backend_${error.code}`;
  if (error?.name === 'TypeError') {
    // iOS Safari kills a backgrounded tab's fetch with "Load failed": a
    // locked phone, not a network fault, and the fixes are opposite.
    if (upload.wasHidden) return 'network_while_hidden';
    if (upload.online === false) return 'offline';
    return 'network';
  }
  return 'unknown';
}

/** Everything a funnel row should carry about a failed upload. Pure. */
export function describeUploadFailure(error) {
  const upload = error?.upload || {};
  return {
    reason: uploadFailureReason(error),
    errorCode: error?.code || null,
    errorMessage: String(error?.message || '').slice(0, 200),
    phase: upload.phase || null,
    lastEvent: upload.lastEvent || null,
    eventsSeen: upload.eventsSeen ?? null,
    filesCompleted: upload.filesCompleted ?? null,
    totalBytes: upload.totalBytes ?? null,
    elapsedMs: upload.elapsedMs ?? null,
    wasHidden: upload.wasHidden ?? null,
    online: upload.online ?? null,
    connection: upload.connection || null,
  };
}

// ---------------------------------------------------------------------------
// In-flight marker
// ---------------------------------------------------------------------------

export const IN_FLIGHT_KEY = 'nqUploadsInFlight';
// Every live upload ends within the 300s overall timeout in FastAPICalls. A
// marker younger than this may belong to an upload running in ANOTHER tab, so
// it is left alone rather than reported as interrupted.
export const INTERRUPTED_AFTER_MS = 6 * 60 * 1000;
// A marker this old is not worth reporting: the row would land weeks late.
export const FORGET_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function read(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(IN_FLIGHT_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(storage, entries) {
  try {
    if (Object.keys(entries).length === 0) storage?.removeItem(IN_FLIGHT_KEY);
    else storage?.setItem(IN_FLIGHT_KEY, JSON.stringify(entries));
  } catch {
    // Private mode or full storage: interruptions go unreported, uploads don't.
  }
}

/** Record an upload as running. */
export function markUploadStarted(storage, funnelId, entry) {
  if (!funnelId) return;
  const entries = read(storage);
  entries[funnelId] = { ...entry, startedAt: entry.startedAt ?? Date.now() };
  write(storage, entries);
}

/** Merge progress into a running upload's marker (last event, hidden, …). */
export function touchUpload(storage, funnelId, patch) {
  if (!funnelId) return;
  const entries = read(storage);
  if (!entries[funnelId]) return;
  entries[funnelId] = { ...entries[funnelId], ...patch };
  write(storage, entries);
}

/** The upload ended, either way. Its outcome was logged by the page itself. */
export function markUploadEnded(storage, funnelId) {
  if (!funnelId) return;
  const entries = read(storage);
  if (!entries[funnelId]) return;
  delete entries[funnelId];
  write(storage, entries);
}

/**
 * Remove and return markers for uploads that can no longer be running.
 * Too-recent markers stay (another tab may own them); ancient ones are
 * dropped without being returned.
 */
export function takeInterruptedUploads(storage, now = Date.now()) {
  const entries = read(storage);
  const interrupted = [];
  let changed = false;
  Object.entries(entries).forEach(([funnelId, entry]) => {
    const age = now - (entry?.startedAt || 0);
    if (age < INTERRUPTED_AFTER_MS) return;
    delete entries[funnelId];
    changed = true;
    if (age <= FORGET_AFTER_MS) interrupted.push({ funnelId, ...entry, ageMs: age });
  });
  if (changed) write(storage, entries);
  return interrupted;
}
