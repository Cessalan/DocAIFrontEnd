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
 * Scaffolding the study engine prefixes onto a node's label to say what KIND of
 * node it is. Useful inside study mode, meaningless on a paywall: "Harder:
 * Testing a theory: prioritization" is the machine's filing system, and showing
 * it to a student at the moment we ask for her card reads as a leaked internal.
 *
 * They nest, because `nodeReadout` builds a challenge label out of the PREVIOUS
 * node's label rather than the root topic — so an adaptive cycle produces
 * "Harder: Focused drill: Harder: …". Stripping repeatedly handles any depth.
 *
 * Sources, all of which must stay listed here:
 *   transition.challengeLabel     'Harder: {{topic}}'
 *   transition.remediationQuiz    'Focused drill: {{topic}}'
 *   transition.remediationLesson  'Review: {{topic}}'
 *   study.practiceFormatLabel     'Targeted practice: {{name}}'
 *   study.experimentLabel         'Testing a theory: {{skill}}'
 *
 * French variants included for the three that have fr translations; the two
 * `study.*` keys have no fr entry at all and render the English default in both
 * locales. Note the French space-before-colon.
 */
const NODE_KIND_PREFIX = new RegExp(
  '^(?:'
  + [
    'harder',
    'focused drill',
    'targeted practice',
    'testing a theory',
    'review',
    'plus difficile',
    'exercice cibl\u00e9',
    'r\u00e9vision',
  ].join('|')
  + ')\\s*:\\s*',
  'i',
);

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
  let trimmed = raw.trim().replace(/\s+/g, ' ');

  // Strip before the length and placeholder checks, not after: a deeply nested
  // label is only long BECAUSE of the scaffolding, and dropping it would lose a
  // topic we can perfectly well name.
  let guard = 8;
  while (guard-- && NODE_KIND_PREFIX.test(trimmed)) {
    trimmed = trimmed.replace(NODE_KIND_PREFIX, '').trim();
  }

  if (!trimmed) return null;
  if (GENERIC_TITLES.has(trimmed.toLowerCase())) return null;
  // A full sentence is a chat title, not a topic. Printing it as one reads as
  // a bug, so fall back to the generic copy instead.
  if (trimmed.length > 48) return null;

  // Skill keys arrive lowercase from the backend debrief ('prioritization'),
  // while real topics arrive already capitalized. Only touch the first letter,
  // so 'select-all-that-apply' keeps its shape.
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};
