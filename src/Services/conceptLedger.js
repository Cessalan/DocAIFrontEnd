/* ══════════════════════════════════════════════════════════════════════
   CONCEPT LEDGER — what the student was confused about, and whether she
   still is.

   WHY THIS EXISTS
   ───────────────
   Everything we stored before this could say "you're at 68% on cardiac".
   Nothing could say:

       "You were confusing preload and afterload.
        Today you told them apart in 3 new scenarios."

   That sentence is the product. A percentage is a fact about our scoring
   system; a resolved misconception is a fact about HER, and only the second
   one is worth coming back for. The difference is not copy — it is data. We
   tracked what she missed (`missedConcepts`) but never what she had since
   FIXED, so improvement could be asserted and never demonstrated.

   THE KEY
   ───────
   Entries are keyed on the short concept LABEL the question generator
   already produces ("preload vs afterload"), not on question text. This is
   the whole point: a VARIANT question probing the same misconception must
   land on the same entry, or the streak never builds and nothing is ever
   resolved. Question text differs per variant; the label does not.

   Keys are normalised (trimmed, lowercased, whitespace collapsed) because
   the label comes from an LLM and will drift in casing and spacing.

   NEVER FABRICATE A KEY. A question that arrives without a concept label is
   skipped entirely — see `applyConceptOutcome`. Falling back to something
   coarse like the topic name would merge every question in a topic into one
   entry, and the ledger would then confidently report a misconception as
   resolved on the strength of unrelated correct answers. A missing entry is
   an absent sentence; a wrong entry is a lie told warmly.

   TIMESTAMPS are ISO strings, never `serverTimestamp()`. They are compared
   client-side, and sentinels do not survive the round trip in the shapes we
   store (see the same rule on node `completedAt`).
   ══════════════════════════════════════════════════════════════════════ */

/** Most entries we keep per session. Firestore documents are not unbounded. */
export const CONCEPT_CAP = 50;

/**
 * Correct answers in a row, after a miss, before we call a misconception
 * resolved.
 *
 * Two is deliberate. One is a coin flip on a 4-option question — claiming
 * "you've got it now" off a single correct answer is exactly the kind of
 * warm inaccuracy that makes a student distrust every other thing we tell
 * her. Three would be more certain but most concepts are never asked three
 * times in a session, so the readout would have nothing to say on the day it
 * matters most.
 */
export const RESOLVE_STREAK = 2;

/** Normalised identity for a concept label. */
export const conceptKey = (label) =>
  String(label || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const blankEntry = (label) => ({
  label: String(label || '').trim(),
  seen: 0,
  correct: 0,
  consecutiveCorrect: 0,
  /** Correct answers recorded AFTER the first miss — the "3 new scenarios". */
  correctAfterMiss: 0,
  firstMissedAt: null,
  lastCorrectAt: null,
  lastSeenAt: null,
});

/**
 * Record one answer against the ledger.
 *
 * Pure: returns a new map, mutates nothing. The caller merges it into the
 * Firestore document.
 *
 * @param {Object} concepts  existing ledger (may be undefined)
 * @param {Object} outcome
 * @param {string} outcome.label    short concept label from the generator
 * @param {boolean} outcome.correct
 * @param {string} [outcome.at]     ISO timestamp; defaults to now
 * @returns {Object} the updated ledger
 */
export const applyConceptOutcome = (concepts, { label, correct, at } = {}) => {
  const key = conceptKey(label);
  // No key, no write. See the header — a coarse fallback would be worse
  // than silence, because it would let the ledger claim things it cannot know.
  if (!key) return concepts || {};

  const now = at || new Date().toISOString();
  const next = { ...(concepts || {}) };
  const entry = { ...(next[key] || blankEntry(label)) };

  // Keep the first non-empty label we ever saw for display. Later generations
  // may phrase it differently ("preload vs. afterload"); the student should
  // not watch the same misconception get renamed underneath her.
  if (!entry.label && label) entry.label = String(label).trim();

  entry.seen += 1;
  entry.lastSeenAt = now;

  if (correct) {
    entry.correct += 1;
    entry.consecutiveCorrect += 1;
    entry.lastCorrectAt = now;
    if (entry.firstMissedAt) entry.correctAfterMiss += 1;
  } else {
    entry.consecutiveCorrect = 0;
    if (!entry.firstMissedAt) entry.firstMissedAt = now;
  }

  next[key] = entry;
  return evict(next);
};

/**
 * Hold the ledger under CONCEPT_CAP.
 *
 * Eviction order is not plain LRU: entries that were NEVER missed go first,
 * oldest by last-seen. They are the ones with no story attached — the student
 * got them right every time, so dropping one costs a sentence nobody was
 * going to read. An entry carrying a miss is the raw material for "you were
 * confusing X, and now you aren't", so it survives longer even if it is older.
 */
const evict = (concepts) => {
  const keys = Object.keys(concepts);
  if (keys.length <= CONCEPT_CAP) return concepts;

  const ranked = keys.sort((a, b) => {
    const A = concepts[a];
    const B = concepts[b];
    const aStory = A.firstMissedAt ? 1 : 0;
    const bStory = B.firstMissedAt ? 1 : 0;
    if (aStory !== bStory) return aStory - bStory;      // no-story first
    return String(A.lastSeenAt || '').localeCompare(String(B.lastSeenAt || ''));
  });

  const doomed = new Set(ranked.slice(0, keys.length - CONCEPT_CAP));
  const out = {};
  keys.forEach((k) => {
    if (!doomed.has(k)) out[k] = concepts[k];
  });
  return out;
};

/** Was this entry missed at least once and then answered right, twice running? */
export const isResolved = (entry) =>
  !!entry &&
  !!entry.firstMissedAt &&
  (entry.consecutiveCorrect || 0) >= RESOLVE_STREAK;

/** Missed at least once and not yet back on its feet. */
export const isStruggling = (entry) =>
  !!entry && !!entry.firstMissedAt && !isResolved(entry);

const toList = (concepts) =>
  Object.entries(concepts || {}).map(([key, entry]) => ({ key, ...entry }));

/**
 * Misconceptions the student has demonstrably fixed, most recent first.
 *
 * @param {Object} concepts
 * @param {string} [since] ISO — only count fixes proven at or after this time,
 *        which is how the session readout says "TODAY you told them apart"
 *        rather than claiming credit for a win from last week.
 */
export const selectResolvedConcepts = (concepts, since) =>
  toList(concepts)
    .filter(isResolved)
    .filter((e) => !since || (e.lastCorrectAt && e.lastCorrectAt >= since))
    .sort((a, b) => String(b.lastCorrectAt || '').localeCompare(String(a.lastCorrectAt || '')));

/**
 * What she is still getting wrong, worst first.
 *
 * Ranked by misses rather than accuracy: a concept missed 4 times out of 6 is
 * a more urgent thing to say out loud than one missed once out of one, even
 * though the second has the worse percentage.
 */
export const selectActiveStruggles = (concepts) =>
  toList(concepts)
    .filter(isStruggling)
    .sort((a, b) => {
      const aMiss = (a.seen || 0) - (a.correct || 0);
      const bMiss = (b.seen || 0) - (b.correct || 0);
      if (aMiss !== bMiss) return bMiss - aMiss;
      return String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || ''));
    });

/**
 * The one sentence the session readout is built on, or null when the data
 * does not support one.
 *
 * Returning null is a feature. If nothing was genuinely resolved we say
 * something else honest rather than dressing up a flat day as progress —
 * the same rule that suppresses a sub-1-point readiness delta because
 * "21% → 21%" with an arrow reads as a bug.
 */
export const buildProgressStory = (concepts, since) => {
  const resolved = selectResolvedConcepts(concepts, since);
  if (resolved.length === 0) return null;

  const top = resolved[0];
  return {
    label: top.label,
    /** How many times she has been right on it since the miss. */
    provenCount: top.correctAfterMiss || top.consecutiveCorrect || 0,
    alsoResolved: resolved.slice(1).map((e) => e.label),
    totalResolved: resolved.length,
  };
};
