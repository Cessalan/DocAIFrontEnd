/* ══════════════════════════════════════════════════════════════════════
   NCLEX HANDOFF CONTEXT — what the generator is told about where she came
   from, and when it stops being told.

   WHY THIS EXISTS
   ───────────────
   A student arrives from a landing page having missed "Diuretic adverse
   effects" and "Medication interactions". If her first in-app session then
   serves generic pharmacology, the observation she was shown thirty seconds
   ago was decoration — the same failure nodeReadout documents for the study
   plan. So the missed concepts ride into `custom_instructions` on every
   question of her early sessions.

   WHY IT DECAYS
   ─────────────
   Two reasons to stop mentioning a concept:

     1. The log has caught up. Once she has MIN_FOR_VERDICT real attempts on
        a concept, the profile has an opinion of its own and the landing
        page's single miss is stale evidence.
     2. Time. Fourteen days after the handoff the context is a memory of a
        different student.

   Both are checked here, per render, from the log — never stored as a flag.
   ══════════════════════════════════════════════════════════════════════ */

import { MIN_FOR_VERDICT } from './nclexProfile';

/** After this the whole context is dropped. Mirrors INTENT_TTL_MS. */
export const CONTEXT_TTL_MS = 14 * 86400000;

/** At most this many concepts are named to the model; more reads as a list
    it will try to cover in one stem. */
export const MAX_CONTEXT_CONCEPTS = 3;

/**
 * Reduce the stored `seoContext` to what is still worth telling the model.
 *
 * @param {Object|null} seoContext  from nclexMeta/profile
 * @param {Object} profile          buildProfile(...) including this session
 * @param {number} [now]
 * @returns {{ missedConcepts: string[], examTrack: string|null, daysLeft: number|null, sourcePage: string|null }|null}
 */
export const handoffContext = (seoContext, profile, now = Date.now(), daysLeft = null) => {
  if (!seoContext || !seoContext.at) return null;
  if (now - Number(seoContext.at) > CONTEXT_TTL_MS) return null;

  const concepts = profile?.concepts || {};
  const missedConcepts = (seoContext.missedConcepts || [])
    .filter((c) => typeof c === 'string' && c.trim())
    .filter((c) => (concepts[c]?.total || 0) < MIN_FOR_VERDICT)
    .slice(0, MAX_CONTEXT_CONCEPTS);

  const examTrack = seoContext.examTrack === 'PN' ? 'PN' : seoContext.examTrack === 'RN' ? 'RN' : null;

  if (!missedConcepts.length && !examTrack && daysLeft === null) return null;

  return {
    missedConcepts,
    examTrack,
    daysLeft: typeof daysLeft === 'number' ? daysLeft : null,
    sourcePage: seoContext.sourcePage || null,
  };
};

/**
 * The sentences appended to the generator's instructions.
 *
 * Phrased as PREFERENCE, not requirement: the spec still owns the category
 * and format, and a hard "must test X" would fight a session that has moved
 * on to a different area. "Do not reuse" matters — the landing-page items are
 * public, and serving her the same stem twice would look like a bank.
 */
export const contextInstructions = (context) => {
  if (!context) return [];
  const lines = [];
  if (context.examTrack) {
    lines.push(`The student is an NCLEX-${context.examTrack} candidate.`);
  }
  if (typeof context.daysLeft === 'number' && context.daysLeft >= 0) {
    lines.push(`Her exam is in ${context.daysLeft} day${context.daysLeft === 1 ? '' : 's'}.`);
  }
  if (context.missedConcepts?.length) {
    lines.push(
      `She recently missed questions on: ${context.missedConcepts.join('; ')}. ` +
        'When it fits the category and format, prefer a stem that tests one of these ' +
        'in a new clinical scenario. Do not reuse a scenario she has already seen.'
    );
  }
  return lines;
};
