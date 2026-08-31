/* ══════════════════════════════════════════════════════════════════════
   READINESS DELTA — "↑ 28% closer to ready", and why that was wrong.

   THE BUG THIS FILE FIXES
   ───────────────────────
   The transition screen averaged readiness over `studyPerformance.topics`
   — the topics she had already TOUCHED — while the readiness card on the
   plan overview averages over every CURRICULUM topic, counting untouched
   ones as 0. The two numbers were computed from different denominators,
   so they disagreed, and the comment on the old helper claimed it
   "mirrors the snapshot logic in StudyPlanOverview" while doing nothing
   of the sort.

   Two consequences, both visible to a student:

     1. THE NUMBER WAS INFLATED. Early in a plan she has touched two or
        three topics, so one 5-of-5 quiz could move "readiness" by 25-30
        points. It read as "you are 28% closer to passing your exam". It
        actually meant "the average of the two topics you have touched
        went up 28 points", which is a much smaller claim.

     2. THE DENOMINATOR MOVED MID-COMPARISON. A node on a brand-new topic
        adds a key to the map, so `before` was a mean over N topics and
        `after` a mean over N+1. Those are not comparable, and the
        subtraction between them is not a delta of anything. It could even
        go NEGATIVE after a good node, by adding a fresh topic that pulled
        the mean down.

   THE FIX: the denominator is the curriculum — every topic in the plan,
   fixed, with untested ones counting as 0. Same rule as
   buildScoredTopics, so the transition screen and the readiness card now
   answer the same question. A 5-of-5 on one of five topics moves the
   number by a believable amount, and the amount is real.
   ══════════════════════════════════════════════════════════════════════ */

import { normalizeTopic } from './readinessProjection';

/**
 * Coverage-aware readiness percentage.
 *
 * @param {Object} perf              studyPerformance doc
 * @param {string[]} curriculumTopics  every topic in the plan
 * @returns {number|null}
 */
export const meanReadinessPct = (perf, curriculumTopics = []) => {
  const scored = new Map();

  // What she has actually answered, keyed normalised so label drift
  // ("Cardiac" vs "Cardiac - Quiz") lands on one entry.
  const touched = perf?.topics || {};
  Object.entries(touched).forEach(([name, t]) => {
    const qTotal = t?.questionsTotal || 0;
    const qCorrect = t?.questionsCorrect || 0;
    const fTotal = t?.flashcardsTotal || 0;
    const fMastered = t?.flashcardsMastered || 0;

    const parts = [];
    if (qTotal > 0) parts.push(qCorrect / qTotal);
    if (fTotal > 0) parts.push(fMastered / fTotal);
    if (parts.length === 0) return;

    const key = normalizeTopic(name);
    if (!key) return;
    const acc = parts.reduce((a, b) => a + b, 0) / parts.length;

    // Two performance keys can normalise onto one curriculum topic; keep the
    // better-evidenced one rather than letting a 1-question entry outvote a
    // 10-question one.
    const prior = scored.get(key);
    const weight = qTotal + fTotal;
    if (!prior || weight > prior.weight) scored.set(key, { acc, weight });
  });

  // The denominator: every curriculum topic, whether or not she has met it.
  const curriculum = (curriculumTopics || [])
    .map((tname) => normalizeTopic(tname))
    .filter(Boolean);

  if (curriculum.length === 0) {
    // No plan topics available — fall back to what she has touched. Honest
    // when it is all we have, and the caller is comparing two snapshots taken
    // seconds apart, so the denominator is at least stable in practice.
    if (scored.size === 0) return null;
    let sum = 0;
    scored.forEach((v) => { sum += v.acc; });
    return (sum / scored.size) * 100;
  }

  let sum = 0;
  curriculum.forEach((key) => {
    // Substring match both ways, matching how buildScoredTopics reconciles
    // model-generated labels against model-generated topic names.
    let acc = 0;
    if (scored.has(key)) {
      acc = scored.get(key).acc;
    } else {
      for (const [k, v] of scored.entries()) {
        if (k.includes(key) || key.includes(k)) { acc = v.acc; break; }
      }
    }
    sum += acc;                       // untested topics contribute 0
  });

  return (sum / curriculum.length) * 100;
};

/**
 * Points of readiness gained between two snapshots.
 *
 * Returns null when there is nothing honest to show. The caller hides the
 * line entirely on null or a non-positive delta: a decline is true and
 * useless as a nudge, and "↑ 0% closer to ready" reads as broken.
 */
export const computeReadinessDelta = (before, after, curriculumTopics = []) => {
  if (!before || !after) return null;
  const b = meanReadinessPct(before, curriculumTopics);
  const a = meanReadinessPct(after, curriculumTopics);
  if (b == null || a == null) return null;

  const delta = Math.round(a - b);
  return delta > 0 ? delta : null;
};
