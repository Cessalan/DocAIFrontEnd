import { FORMAT_GAP_PP, FORMAT_GAP_MIN_MCQ } from '../ExamDrill/drillModel';

/**
 * gapOfferModel — the student's own format gap, as an upgrade offer can state it.
 *
 * WHY THIS EXISTS
 *
 * Almost every paying student has the same shape: ~80-89% on multiple choice,
 * ~22-42% on select-all, case and matrix questions (2026-10-09 read of the 16
 * payers since paywall telemetry began). The generic upgrade copy ("Study
 * without limits") says nothing about that, and the voluntary paywall it sits
 * on (the usage badge) converts worst of all at 3.4%. The offer names HER
 * numbers instead.
 *
 * Two sources, two levels of evidence:
 *
 *  - 'check': the readiness check (up to 8 questions). Reuses the verdict's own
 *    `formatGap` finding, so the offer and the finding above it can never
 *    disagree. Stated as counts ("1 of 4"): two or three answers per format
 *    cannot carry a percentage honestly.
 *  - 'practice': everything saved in users/{uid}/studyPerformance. Stated as
 *    percentages, and only with MIN_PER_SIDE answers on each side.
 *
 * Same thresholds as the drill and the verdict (FORMAT_GAP_PP,
 * FORMAT_GAP_MIN_MCQ), so no surface calls something a gap that another
 * surface calls fine. No gap, or too little evidence: null, and the caller
 * shows exactly what it showed before.
 */

/** Answers needed on EACH side before practice data may be quoted as a percentage. */
export const MIN_PER_SIDE = 5;

/** Answers a single harder format needs before it gets its own bar. */
export const MIN_PER_ROW = 3;

/** The harder formats, in the order they are shown. Matrix counts: it is the
 *  format paying students score worst on (0 of 8 for the 2026-10-09 payer). */
export const HARD_FORMATS = ['sata', 'casestudy', 'matrix'];

const pct = (b) => (b.total ? Math.round((100 * b.correct) / b.total) : null);
const isGap = (standard, hard) => {
  if (!standard.total || !hard.total) return false;
  const s = standard.correct / standard.total;
  const h = hard.correct / hard.total;
  return s >= FORMAT_GAP_MIN_MCQ && (s - h) * 100 >= FORMAT_GAP_PP;
};

/**
 * From the readiness-check verdict (readinessVerdict.buildVerdict).
 * @returns {null | { source: 'check', standard: {correct,total}, hard: {correct,total} }}
 */
export const gapFromVerdict = (verdict) => {
  const finding = (verdict?.findings || []).find((f) => f.key === 'formatGap');
  if (!finding?.standard || !finding?.hard) return null;
  const standard = { correct: finding.standard.correct, total: finding.standard.total };
  const hard = { correct: finding.hard.correct, total: finding.hard.total };
  return { source: 'check', standard, hard };
};

/**
 * From saved practice: an array of studyPerformance `formats` maps, one per
 * chat, each { mcq: {correct,total}, sata: {...}, ... }.
 * @returns {null | { source: 'practice', standard, hard, rows: [{format, correct, total, pct}], weakest }}
 */
export const gapFromPractice = (formatMaps = []) => {
  const sum = {};
  (Array.isArray(formatMaps) ? formatMaps : []).forEach((map) => {
    Object.entries(map || {}).forEach(([format, v]) => {
      const total = Number(v?.total) || 0;
      const correct = Math.min(Number(v?.correct) || 0, total);
      if (!total) return;
      sum[format] = sum[format] || { correct: 0, total: 0 };
      sum[format].correct += correct;
      sum[format].total += total;
    });
  });

  const standard = sum.mcq || { correct: 0, total: 0 };
  const hard = HARD_FORMATS.reduce(
    (acc, f) => ({ correct: acc.correct + (sum[f]?.correct || 0), total: acc.total + (sum[f]?.total || 0) }),
    { correct: 0, total: 0 }
  );
  if (standard.total < MIN_PER_SIDE || hard.total < MIN_PER_SIDE) return null;
  if (!isGap(standard, hard)) return null;

  const rows = [{ format: 'mcq', ...standard, pct: pct(standard) }];
  HARD_FORMATS.forEach((format) => {
    const b = sum[format];
    if (b && b.total >= MIN_PER_ROW) rows.push({ format, ...b, pct: pct(b) });
  });
  const hardRows = rows.filter((r) => r.format !== 'mcq');
  // Every harder format may sit below MIN_PER_ROW on its own while the sum
  // clears MIN_PER_SIDE; then no single format can be named as the weakest.
  const weakest = hardRows.length
    ? hardRows.reduce((w, r) => (r.pct < w.pct || (r.pct === w.pct && r.total > w.total) ? r : w)).format
    : null;
  return { source: 'practice', standard, hard, rows, weakest };
};
