/**
 * devTrigger — the dev-only channel for opening the post-exam conversation on
 * demand.
 *
 * WHY AN EVENT
 *
 * The conversation opens from inside `ExamDebriefPrompt`, which lives in the
 * app shell and is driven entirely by "is there an exam behind you". A dev
 * control needs to reach into that from a completely different part of the
 * tree, and neither a context nor a prop drill is worth adding for scaffolding
 * that should be deletable in two files. The app already uses window events for
 * exactly this kind of cross-tree signal (see RECORDING_OVERLAY_STATE_EVENT).
 *
 * Guarded on both ends: this helper is a no-op outside development, and the
 * listener in ExamDebriefPrompt is never registered there either. If this ships
 * by accident it cannot open anything.
 */

export const EXAM_DEBRIEF_DEV_OPEN = 'nq:exam-debrief-dev-open';

/**
 * Open the debrief conversation now, bypassing the trigger and the delay.
 *
 * @param {Object}  [options]
 * @param {string}  [options.label]    Exam name to use. Null renders the
 *                                     unnamed copy ("Your exam").
 * @param {boolean} [options.useReal]  Use this account's real pending exam
 *                                     instead of a fake one — writes for real,
 *                                     marks the exam handled, the lot. Logs and
 *                                     does nothing when there is no pending exam.
 */
export const openExamDebriefDev = (options = {}) => {
  if (process.env.NODE_ENV !== 'development') return;
  window.dispatchEvent(new CustomEvent(EXAM_DEBRIEF_DEV_OPEN, { detail: options }));
};
