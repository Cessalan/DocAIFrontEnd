import { buildPlanPreview } from '../StudyMode/planPreviewModel';
import { plannerTopics, priorityRows } from './courseIntelligenceModel';

const canonical = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

/* ── The readiness check (2026-09-16) ─────────────────────────────────────
   Up to eight questions in the formats that separate ready from not-ready:
   applied and prioritization (single answer), select-all, and case studies.
   Buyers score ~97% on multiple choice and 22-50% on the others, so a check
   made of multiple choice alone tells nearly everyone she is ready.

   The backend (course_question_preview.py) sends `format` on every question.
   A question without one is the older multiple-choice shape — the fallback
   /study/diagnostic-quiz still produces those — and is read as `mcq`. */
export const READINESS_QUESTION_CAP = 8;
export const CHECK_FORMATS = ['mcq', 'sata', 'casestudy'];
const SATA_MIN_OPTIONS = 4;
const SATA_MAX_OPTIONS = 6;

const formatOf = (question) => (CHECK_FORMATS.includes(question?.format) ? question.format : 'mcq');

const validOptions = (options) => Array.isArray(options)
  && options.every(o => typeof o === 'string' && o.trim())
  && new Set(options.map(canonical)).size === options.length;

// A select-all key is a set of at least two, and never every option: one right
// answer is a disguised single-answer question, all of them is no question.
const validSataKey = (keys, optionCount) => Array.isArray(keys)
  && keys.length >= 2 && keys.length < optionCount
  && keys.every(k => Number.isInteger(k) && k >= 0 && k < optionCount)
  && new Set(keys).size === keys.length;

const hasValidShape = (q, format) => {
  if (!validOptions(q.options)) return false;
  if (format === 'sata') {
    return q.options.length >= SATA_MIN_OPTIONS && q.options.length <= SATA_MAX_OPTIONS
      && validSataKey(q.correctIndices, q.options.length);
  }
  if (q.options.length !== 4) return false;
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) return false;
  return format !== 'casestudy' || (typeof q.scenario === 'string' && q.scenario.trim().length > 0);
};

// A malformed answer key must never turn a correct answer into a study gap.
// Only assess topics this report actually contains; do not fuzzy-match clinical terms.
export const calibrationQuestions = (payload, topics) => {
  const labels = new Map(topics.map(topic => [canonical(topic), topic]));
  const seen = new Set();
  return (Array.isArray(payload?.questions) ? payload.questions : []).filter(q => {
    if (!q || typeof q.question !== 'string' || !q.question.trim()) return false;
    // An unknown format is refused, not rendered as multiple choice: its key
    // would be read with the wrong shape.
    if (q.format !== undefined && !CHECK_FORMATS.includes(q.format)) return false;
    if (!hasValidShape(q, formatOf(q))) return false;
    if (!labels.has(canonical(q.topic)) || seen.has(canonical(q.question))) return false;
    seen.add(canonical(q.question));
    return true;
  }).slice(0, READINESS_QUESTION_CAP).map(q => {
    const format = formatOf(q);
    return {
      ...q,
      format,
      kind: typeof q.kind === 'string' ? q.kind : null,
      topic: labels.get(canonical(q.topic)),
      concept: typeof q.concept === 'string' ? q.concept.trim() : '',
      rationale: typeof q.rationale === 'string' ? q.rationale.trim() : '',
      ...(format === 'sata' ? { correctIndices: [...q.correctIndices].sort((a, b) => a - b) } : {}),
      ...(format === 'casestudy' ? { scenario: q.scenario.trim() } : {}),
    };
  });
};

/** The option indices that are right, whatever the format. */
export const answerKey = (question) => (formatOf(question) === 'sata'
  ? [...(question?.correctIndices || [])]
  : [question?.correctIndex]);

export const isKeyOption = (question, index) => answerKey(question).includes(index);

/**
 * Grade one answer, on first attempt.
 *
 * A select-all item is right only when the chosen set IS the key — that is how
 * the exam marks it. A selection that got some of it is recorded as `partial`,
 * because "wrong on one she mostly knew" and "wrong on one she did not know"
 * are different findings: in the drill, 62% of wrong select-all answers were
 * partial. "Not sure" is never correct and never partial.
 *
 * @param {Object} question
 * @param {number|number[]|'unsure'|null} picked
 * @returns {{ correct: boolean, partial: boolean }}
 */
export const gradeAnswer = (question, picked) => {
  if (!question || picked === null || picked === undefined || picked === 'unsure') {
    return { correct: false, partial: false };
  }
  if (formatOf(question) === 'sata') {
    const chosen = new Set(Array.isArray(picked) ? picked : []);
    const key = new Set(answerKey(question));
    const exact = chosen.size === key.size && [...key].every(k => chosen.has(k));
    const hits = [...chosen].filter(k => key.has(k)).length;
    return { correct: exact, partial: !exact && hits > 0 };
  }
  return { correct: picked === question.correctIndex, partial: false };
};

/** Answered/correct per format, flat, for the funnel row. */
export const formatTally = (answers = []) => {
  const out = { sataPartial: 0 };
  CHECK_FORMATS.forEach(f => { out[`${f}Answered`] = 0; out[`${f}Correct`] = 0; });
  answers.forEach(answer => {
    const f = formatOf(answer);
    out[`${f}Answered`] += 1;
    if (answer?.correct) out[`${f}Correct`] += 1;
    if (f === 'sata' && answer?.partial) out.sataPartial += 1;
  });
  return out;
};

/** How many of each format a check contains, for the funnel row. */
export const questionFormatCounts = (questions = []) => {
  const out = {};
  CHECK_FORMATS.forEach(f => { out[`${f}Count`] = 0; });
  questions.forEach(q => { out[`${formatOf(q)}Count`] += 1; });
  return out;
};

export const calibrationScores = (answers = []) => {
  const buckets = new Map();
  answers.forEach(answer => {
    const bucket = buckets.get(answer.topic) || { correct: 0, total: 0 };
    bucket.total += 1;
    bucket.correct += answer.correct ? 1 : 0;
    buckets.set(answer.topic, bucket);
  });
  return buckets.size ? Object.fromEntries([...buckets].map(([topic, b]) => [
    topic, Math.round(100 * b.correct / b.total),
  ])) : null;
};

// The existing preview mirrors backend tiering and time budgets. Use its order
// instead of inventing a second score that the generated plan would ignore.
export const calibrationPlan = (report, answers = [], daysToExam = null) => {
  // Keep topics already sampled if the final research changes the shortlist.
  // The backend restores these same diagnostic labels before building the path.
  const topics = [...new Set([...plannerTopics(report), ...answers.map(a => a.topic)])];
  const scores = calibrationScores(answers);
  const preview = buildPlanPreview({ topics, diagnostic: scores, daysToExam });
  const evidence = priorityRows(report, 12);
  const rows = preview.rows.map((row, index) => {
    const sampled = answers.filter(a => a.topic === row.topic);
    return {
      ...row,
      rank: index + 1,
      previousRank: topics.indexOf(row.topic) + 1,
      tested: sampled.length,
      correct: sampled.filter(a => a.correct).length,
      revisit: [...new Set(sampled.filter(a => !a.correct).map(a => a.concept).filter(Boolean))],
      lead: evidence.find(e => e.topic === row.topic)?.lead || null,
    };
  });
  return { ...preview, rows, scores, changed: Boolean(scores && rows[0]?.topic !== topics[0]) };
};
