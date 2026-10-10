/* ══════════════════════════════════════════════════════════════════════
   COMPOSER UPLOADS — files attached in the message box, ChatGPT-style.

   WHY THIS EXISTS (2026-10-08)
   ────────────────────────────
   A plain attach used to post three things into the chat: a loading card,
   "Nice! Your documents cover…", and four big action buttons. For a student
   who only wanted her notes in the chat that was clutter, and the message
   box stayed locked until processing finished. Now each file is a small
   chip in the message box with a progress ring; the box stays usable; and
   once every file is ready, the actions sit above the input as suggestions.

   PROGRESS IS DRIVEN BY REAL EVENTS
   ─────────────────────────────────
   The upload stream reports stages per file (file_start, embedding_start,
   loaded_pages, insight_batch, file_complete). Each stage sets a floor for
   the ring. Between events the ring creeps toward the next stage's floor
   but never reaches it, so it keeps moving on a slow file without ever
   claiming a step that hasn't happened. Only file_complete reaches 100.
   ══════════════════════════════════════════════════════════════════════ */

export const STAGE_FLOOR = {
  queued: 3,
  file_start: 10,
  embedding_start: 22,
  loaded_pages: 42,
  chunked: 55,
  insight_batch: 82,
  embedding_complete: 90,
  file_complete: 100,
};

// Where a stage's creep may head: just short of the next floor.
const ORDER = Object.keys(STAGE_FLOOR);
const CREEP_MS = 3500;
const CREEP_CAP = 96;

export function fileKind(name = '') {
  const ext = String(name).toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'slides';
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'bmp', 'tif', 'tiff', 'gif'].includes(ext)) return 'image';
  return 'text';
}

export function newComposerFile(file, key) {
  return { key, name: file.name, kind: fileKind(file.name), fileId: null,
    stage: 'queued', floor: STAGE_FLOOR.queued, stageAt: Date.now(), status: 'uploading' };
}

function advance(entry, stage) {
  const floor = STAGE_FLOOR[stage];
  if (floor === undefined || floor <= entry.floor) return entry;
  return { ...entry, stage, floor, stageAt: Date.now(),
    status: floor >= 100 ? 'ready' : entry.status };
}

function matches(entry, update) {
  if (update.file_id && entry.fileId) return entry.fileId === update.file_id;
  return Boolean(update.filename) && entry.name === update.filename;
}

/** Fold one upload-stream event into the composer's files. Pure. */
export function applyUploadEvent(files, update) {
  if (!update || !Array.isArray(files) || files.length === 0) return files;
  const stage = update.type === 'embedding_progress' ? update.stage : update.type;
  if (update.type === 'file_error') {
    return files.map(f => (matches(f, update) ? { ...f, status: 'error' } : f));
  }
  if (update.type === 'all_complete') {
    return files.map(f => (f.status === 'uploading' ? advance(f, 'file_complete') : f));
  }
  if (STAGE_FLOOR[stage] === undefined) return files;
  return files.map(f => {
    if (!matches(f, update)) return f;
    const withId = update.file_id && !f.fileId ? { ...f, fileId: update.file_id } : f;
    return advance(withId, stage);
  });
}

export const markAll = (files, status) => files.map(f => (
  f.status === 'uploading' ? (status === 'ready' ? advance(f, 'file_complete') : { ...f, status }) : f));

export const anyUploading = files => files.some(f => f.status === 'uploading');

/**
 * The percentage to draw at `now`: the stage floor plus an easing creep
 * toward the next stage, capped below it. Ready files are 100.
 */
export function displayProgress(entry, now = Date.now()) {
  if (entry.status === 'ready') return 100;
  const next = ORDER[ORDER.indexOf(entry.stage) + 1];
  const ceiling = Math.min(CREEP_CAP, next ? STAGE_FLOOR[next] - 2 : CREEP_CAP);
  const room = Math.max(0, ceiling - entry.floor);
  const elapsed = Math.max(0, now - entry.stageAt);
  return entry.floor + room * (1 - Math.exp(-elapsed / CREEP_MS));
}
