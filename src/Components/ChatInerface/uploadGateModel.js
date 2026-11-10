/**
 * uploadGateModel: when a free student's second upload in a chat opens the
 * paywall instead of the file picker.
 *
 * WHY THIS EXISTS
 *
 * The gate used to fire on any second upload. PostHog, 2026-11-01 to 11-08: 11
 * students hit it, none of them had finished a single plan step, and 9 never
 * did. Finishing one step is the activation line (60% come back another day,
 * against 8% for uploading and getting nothing). So the gate was walling
 * students off before they had seen what Pro is for, often while they were
 * still adding the rest of their course.
 *
 * Now the gate waits until she has finished a step. Before that, extra uploads
 * go through. This is a trade-off, not a free win: the gate has also been one
 * of the better sellers (9.4% paid within a day, 2026-10-09). Compare
 * `upload_gate` paywall views and `upload_gate_deferred` funnel rows before and
 * after to judge it.
 *
 * WHERE "FINISHED A STEP" COMES FROM
 *
 *  - users/{uid}.activation.lastStepAt, written by completeNodeAndAdvance. It
 *    is new (2026-11-09), so students who finished steps before then have no
 *    stamp until they finish another one.
 *  - The open chat's own plan having a `done` step, which covers those older
 *    students in the chat where they did the work.
 *  - A step finished in this tab, because the profile is read once at sign-in
 *    and would not see a stamp written after it.
 */

const finishedThisSession = new Set();

/** Called when a plan step is completed, so the gate knows without a reload. */
export const rememberStepFinished = (uid) => {
  if (uid) finishedThisSession.add(uid);
};

/** Test hook. */
export const resetUploadGateSession = () => finishedThisSession.clear();

export const hasFinishedStep = ({ uid = null, profile = null, chatNodes = null } = {}) => {
  if (uid && finishedThisSession.has(uid)) return true;
  if (profile?.activation?.lastStepAt) return true;
  return Array.isArray(chatNodes) && chatNodes.some((n) => n && n.status === 'done');
};

/**
 * 'gate'  → open the paywall instead of the picker
 * 'defer' → the old rule would have gated, this one lets her upload
 * 'allow' → nothing to decide (Pro, or the chat has no file yet)
 */
export const uploadGateDecision = ({ isPro, filesInChat, finishedStep }) => {
  if (isPro || !filesInChat) return 'allow';
  return finishedStep ? 'gate' : 'defer';
};
