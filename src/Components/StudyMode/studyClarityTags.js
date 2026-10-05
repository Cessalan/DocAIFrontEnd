/**
 * studyClarityTags — the Microsoft Clarity tags a study-plan session carries.
 *
 * WHY THIS EXISTS
 *
 * Clarity recordings can be filtered by custom tags, and the questions worth
 * asking of a study-plan recording are about where the student was when she
 * opened it: had she done anything yet (32.5% of plans never complete a
 * node, see project_study_activation), and how close was her exam. Both are
 * continuous values; a tag filter is a dropdown of exact strings, so they are
 * bucketed here into a handful of values a person can actually pick from.
 *
 * Pure so the buckets are tested; StudyModeContainer only sends the result.
 */

const DAY_MS = 86400000;

const toDate = (value) => {
  if (!value) return null;
  const d = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "How far in was she when she opened the plan." */
export const progressBucket = (completed, total) => {
  if (!total) return null;
  if (completed <= 0) return 'not_started';
  if (completed >= total) return 'finished';
  return completed / total < 0.5 ? 'under_half' : 'over_half';
};

/** Calendar days to the exam, compared on local midnights so 11pm is not "tomorrow". */
export const examCountdownBucket = (examDate, now = new Date()) => {
  const exam = toDate(examDate);
  if (!exam) return 'no_date';
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(exam); end.setHours(0, 0, 0, 0);
  const days = Math.round((end - start) / DAY_MS);
  if (days < 0) return 'past';
  if (days === 0) return 'today';
  if (days <= 3) return '1-3_days';
  if (days <= 7) return '4-7_days';
  if (days <= 14) return '8-14_days';
  return '15+_days';
};

export const studyPlanTags = ({ completed, total, examDate, now = new Date() }) => ({
  study_plan: 'yes',
  plan_progress: progressBucket(completed, total),
  exam_countdown: examCountdownBucket(examDate, now),
});
