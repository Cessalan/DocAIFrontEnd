/**
 * upgradeCopy.js
 * Small helpers for personalizing the upgrade modal from onboarding signals.
 * Pure + fully fallback-safe — missing/invalid data returns null so the modal
 * falls back to its generic copy.
 */

/**
 * Whole days from now until the exam date. Returns null for missing/invalid
 * dates and for dates in the past (so stale exam dates don't show urgency).
 *
 * @param {string|number|Date|null|undefined} examDate - ISO string / ms / Date
 * @returns {number|null}
 */
export const daysUntilExam = (examDate) => {
  if (!examDate) return null;
  const then = new Date(examDate).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.ceil((then - Date.now()) / 86400000);
  return days >= 0 ? days : null;
};

/**
 * True when the exam is close enough to use as urgency (within `withinDays`).
 */
export const isExamSoon = (examDate, withinDays = 30) => {
  const d = daysUntilExam(examDate);
  return d != null && d <= withinDays;
};
