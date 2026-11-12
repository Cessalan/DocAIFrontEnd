/**
 * The checklist a student watches while her study sheet is prepared.
 *
 * Until 2026-11-11 the sheet was drawn while it was written: sections popped
 * in one by one under "Building your study sheet…", the page jumped as each
 * landed, and she was reading something that could still be thrown away (a
 * failed first draft is replaced whole). Now the sheet appears once, finished,
 * and this is what she sees until then.
 *
 * The rule: a box is ticked only by something that happened. Each step maps to
 * a real stage of NQBackEnd2/services/studysheet_simple.py, announced by a
 * `study_sheet_step` event when it starts and ends:
 *
 *   materials  her files (and pasted notes) are searched for the relevant parts
 *   plan       the scope is chosen: topics, what she flagged, quizzes to review
 *   write      the sections are written; each finished one is listed by title
 *   check      every block is checked against the passage it cites
 *
 * No timers and no estimates. If an event is missing (an older backend sends
 * none), a step is inferred only from later evidence that cannot exist without
 * it: a sheet header means reading and planning are over. Nothing here invents
 * a count or a title; a fact that did not arrive is simply not shown.
 *
 * STEP_ORDER mirrors STEP_IDS in studysheet_simple.py. A step id this file
 * does not know is ignored, never rendered half-named.
 */
export const STEP_ORDER = ['materials', 'plan', 'write', 'check'];

const WRITE = STEP_ORDER.indexOf('write');
const LAST = STEP_ORDER.length - 1;

/** How far the work has provably got: the index of the step in progress. */
function currentIndex(message) {
  const progress = message.progress || {};
  let current = 0;
  STEP_ORDER.forEach((id, index) => {
    const step = progress[id];
    if (!step) return;
    current = Math.max(current, step.state === 'done' ? index + 1 : index);
  });
  // A header exists only once reading and planning are finished.
  if (message.studySheet) current = Math.max(current, WRITE);
  return Math.min(current, LAST);
}

/**
 * @returns {{ steps: Array<{id, state, facts, sections}>, failed: boolean, restarted: boolean }}
 *   state is 'done' | 'active' | 'failed' | 'pending'. While the sheet is being
 *   prepared exactly one step is active; on an error that step is the failed one.
 */
export function sheetProgress(message) {
  const safe = message || {};
  const finished = !safe.isStreaming && !safe.error;
  const failed = Boolean(safe.error);
  const current = currentIndex(safe);
  const sections = (safe.studySheet?.sections || [])
    .map(section => String(section?.title || '').trim())
    .filter(Boolean);

  const steps = STEP_ORDER.map((id, index) => {
    let state = 'pending';
    if (finished || index < current) state = 'done';
    else if (index === current) state = failed ? 'failed' : 'active';
    const { state: reported, ...facts } = (safe.progress || {})[id] || {};
    return { id, state, facts, sections: id === 'write' ? sections : [] };
  });

  return { steps, failed, restarted: Boolean(safe.restarted) && !finished };
}

/** Whether the check step compares against her material, when we know. */
export function checkIsSourced(steps) {
  const byId = Object.fromEntries(steps.map(step => [step.id, step]));
  const reported = byId.check?.facts?.sourced;
  if (typeof reported === 'boolean') return reported;
  const materials = byId.materials?.facts || {};
  if (typeof materials.files === 'number') return materials.files > 0 || Boolean(materials.notes);
  return null;
}
