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

/**
 * Placeholder chat titles that carry no meaning. Rendering "You were
 * practicing: New Chat" is worse than rendering nothing — it tells the user
 * we weren't paying attention at the exact moment we're asking for money.
 */
const GENERIC_TITLES = new Set([
  'new chat', 'new conversation', 'untitled', 'chat',
  'nouveau chat', 'nouvelle conversation', 'sans titre', 'discussion',
]);

/**
 * Normalize whatever the caller knows about "what they were working on" into
 * something safe to print as a topic name — or null, which callers must treat
 * as "don't render the context card at all".
 *
 * @param {unknown} raw
 * @returns {string|null}
 */
export const cleanTopicLabel = (raw) => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (GENERIC_TITLES.has(trimmed.toLowerCase())) return null;
  // A full sentence is a chat title, not a topic. Printing it as one reads as
  // a bug, so fall back to the generic copy instead.
  if (trimmed.length > 48) return null;
  return trimmed;
};
