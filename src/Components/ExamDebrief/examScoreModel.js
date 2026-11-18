/**
 * examScoreModel — the score she got, as a number we can count.
 *
 * WHY THIS EXISTS
 *
 * The exam debrief asked "how did it go?" and then talked about the exam's
 * content. It never asked for the result. Of 37 debriefs to 2026-11-12, four
 * students volunteered one anyway ("95%", "77%, I passed", "88.30%", "I passed,
 * I don't know my score"), and each sits in a transcript as prose that nothing
 * can add up. Without the result, the app cannot tell a student what it got
 * right about her preparation, cannot tell us whether studying here works, and
 * cannot start her next exam from where this one ended. The score is the first
 * step of following a student across the semester.
 *
 * So the debrief opens with a meter she slides to her score. It is saved as a
 * number, and the same answer is also sent into the conversation in her words
 * ("I got 82%"), so the tutor reacts to it like anything else she says and the
 * backend needs no new field.
 *
 * DESIGN NOTES
 *
 *  - The meter starts UNSET. A slider that opens on 75 gets 75s from students
 *    who tapped Save without moving it, and those are indistinguishable from
 *    real 75s once stored. Nothing can be saved until she has moved it.
 *
 *  - Whole percentages, 0 to 100. Nursing exams are reported as a percentage
 *    almost everywhere; "88.30%" rounds to 88, which loses nothing we use.
 *
 *  - "I don't know my score yet" is an answer, stored as `not_yet` with no
 *    number. It is common (grades post days later) and it must never be
 *    recorded as a score.
 *
 *  - Typing instead of using the meter is allowed and stores `skipped`: the
 *    conversation still happens, we just have no number.
 */

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

export const SCORE_STATUS = {
  GIVEN: 'given',
  NOT_YET: 'not_yet',
  SKIPPED: 'skipped'
};

/** A whole percentage in range, or null for anything that is not one. */
export const clampScore = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(n)));
};

/**
 * What gets stored for her answer.
 * @param {'given'|'not_yet'|'skipped'} status
 * @param {number} [value] The meter's value, for 'given'.
 */
export const scoreAnswer = (status, value) => {
  if (status === SCORE_STATUS.GIVEN) {
    const score = clampScore(value);
    return score === null
      ? { score: null, scoreStatus: SCORE_STATUS.SKIPPED }
      : { score, scoreStatus: SCORE_STATUS.GIVEN };
  }
  if (status === SCORE_STATUS.NOT_YET) return { score: null, scoreStatus: SCORE_STATUS.NOT_YET };
  return { score: null, scoreStatus: SCORE_STATUS.SKIPPED };
};

/**
 * The line sent into the conversation as her own words, as an i18n key and
 * its values. Kept as data so the model stays free of i18next.
 */
export const scoreMessage = (answer) => {
  if (answer?.scoreStatus === SCORE_STATUS.GIVEN) {
    return { key: 'examDebrief.score.said', values: { score: answer.score } };
  }
  return { key: 'examDebrief.score.notYetSaid', values: {} };
};

/** Fill fraction for the meter track, 0..1, or 0 while unset. */
export const meterFill = (value, touched) => {
  if (!touched) return 0;
  const score = clampScore(value);
  return score === null ? 0 : (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);
};
