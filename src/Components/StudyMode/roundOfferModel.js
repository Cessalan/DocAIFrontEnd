import { BETTER_BY, isComparable } from './tonightPlanModel';

/**
 * roundOfferModel — when a finished round may carry a quiet line about Pro.
 *
 * WHY THIS EXISTS
 *
 * The first student to pay out of Tonight's plan (2026-11-14) did it without
 * ever hitting a wall: she watched two rounds move (1 of 2 to 4 of 5, then
 * 0 of 2 to 4 of 5 on select-all), opened pricing herself from the account
 * menu at 37 of 50 questions used, and paid a minute later. In the same 14
 * days, 7 of the 11 other students who started Tonight's plan never saw a
 * price at all, and the walls that did fire sold to 1 of 22.
 *
 * So the offer goes where the evidence is: on the result of a round that
 * measurably improved, next to her own before and after, with how many free
 * questions the next rounds have left. It is one line and a link, never a
 * gate, and it follows the same rule as the round itself: no claim the
 * numbers cannot carry.
 *
 *  - Only a comparable round (enough answers on both sides, isComparable)
 *    that rose by at least BETTER_BY. A mixed review that went 16 of 20 to
 *    5 of 6 is "solid", not an improvement, and gets no offer.
 *  - Never for Pro, and never at zero questions left: the limit screen that
 *    follows says why she stopped, and two asks in a row is one too many.
 *  - `low` only changes the wording (she is about to run out); it never
 *    hides or forces anything.
 */

/** About two rounds of questions. At or under this the line says so. */
export const LOW_QUESTIONS = 15;

const ratio = (t) => (t?.total ? t.correct / t.total : 0);

/**
 * @param {object} args
 * @param {object} args.round      a closed round from study.tonight.rounds
 * @param {boolean} args.isPro
 * @param {number} args.remaining  free questions left (Infinity for Pro)
 * @returns {null | { before, after, remaining: number, low: boolean }}
 */
export const buildRoundOffer = ({ round, isPro, remaining } = {}) => {
  if (isPro || !round || round.status !== 'done') return null;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  if (!isComparable(round)) return null;
  // A hair of tolerance: 0.8 - 0.6 is 0.2000000001 in one order and 0.1999999 in another.
  if (ratio(round.after) - ratio(round.before) < BETTER_BY - 1e-9) return null;
  return {
    before: { correct: round.before.correct, total: round.before.total },
    after: { correct: round.after.correct, total: round.after.total },
    remaining: Math.floor(remaining),
    low: remaining <= LOW_QUESTIONS,
  };
};
