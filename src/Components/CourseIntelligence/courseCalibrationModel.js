import { buildPlanPreview } from '../StudyMode/planPreviewModel';
import { plannerTopics, priorityRows } from './courseIntelligenceModel';

const canonical = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

// A malformed answer key must never turn a correct answer into a study gap.
// Only assess topics this report actually contains; do not fuzzy-match clinical terms.
export const calibrationQuestions = (payload, topics) => {
  const labels = new Map(topics.map(topic => [canonical(topic), topic]));
  const seen = new Set();
  return (Array.isArray(payload?.questions) ? payload.questions : []).filter(q => {
    if (!q || typeof q.question !== 'string' || !q.question.trim()) return false;
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (!q.options.every(o => typeof o === 'string' && o.trim())) return false;
    if (new Set(q.options.map(canonical)).size !== 4) return false;
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) return false;
    if (!labels.has(canonical(q.topic)) || seen.has(canonical(q.question))) return false;
    seen.add(canonical(q.question));
    return true;
  }).slice(0, 6).map(q => ({
    ...q,
    topic: labels.get(canonical(q.topic)),
    concept: typeof q.concept === 'string' ? q.concept.trim() : '',
    rationale: typeof q.rationale === 'string' ? q.rationale.trim() : '',
  }));
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
