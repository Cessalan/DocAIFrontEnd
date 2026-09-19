import { FORMAT_GAP_PP, FORMAT_GAP_MIN_MCQ } from '../ExamDrill/drillModel';

/**
 * readinessVerdict — what the readiness check found, as a handful of specific,
 * evidenced findings.
 *
 * WHY THIS EXISTS
 *
 * The locked plan preview used to be the first place a student saw anything
 * from her check, and all it could say was a topic and a percentage: "Coronary
 * Artery Disease · Needs work · you scored 33%". That is a score, not a
 * finding. It does not say what went wrong, it hides the one pattern buyers
 * actually pay to fix (they score ~97% on multiple choice and 22-50% on
 * select-all and case studies), and with three answers behind it it claims
 * more than it knows. The owner's verdict on that screen: it will not convert
 * anyone.
 *
 * The strategy (2026-09-16) is: show the whole verdict free, sell the fix. So
 * this turns the check's answers into at most four findings a student can
 * recognise, each with its evidence, how sure we are, and how serious it is.
 *
 * RULES
 *
 *  - Findings are weaknesses only, never padded. A student who did well gets
 *    an empty list and a strength, and the screen says so.
 *  - "Knows it, loses it on the format" outranks everything: it applies to
 *    every topic at once. It uses the drill's own thresholds so the two
 *    surfaces never disagree about what a format gap is. When it fires, the
 *    select-all and case-study evidence is folded into it rather than repeated.
 *  - A topic needs two answers before it can be called weak; one miss is not
 *    a pattern. Priority and case questions are rarer in the check, so one
 *    miss is reported, but always as an early signal.
 *  - Severity is a plain label, not a picture: "early" when fewer than
 *    CLEAR_EVIDENCE answers stand behind it (thin evidence outranks
 *    everything else about a finding), "high" at a third or less right,
 *    otherwise "needsWork". Owner feedback on the first version: dots on
 *    their own were not understood.
 *  - A skipped check produces null, so callers fall back to the plain preview.
 */

export const MAX_FINDINGS = 4;

/** Answers behind a finding before it stops being an "early signal". */
export const CLEAR_EVIDENCE = 3;

/** At or below this share right, a group is called weak. Half wrong on two or
 *  three answers is the smallest signal worth naming; the confidence label
 *  carries the uncertainty. */
export const WEAK_SHARE = 0.5;

/** At or below this share right, on firm evidence, a weakness is a high concern. */
export const HIGH_CONCERN_SHARE = 1 / 3;

const share = (b) => (b.total ? b.correct / b.total : null);

const tally = (rows, pred) => {
  const hit = rows.filter(pred);
  return {
    total: hit.length,
    correct: hit.filter(a => a.correct).length,
    partial: hit.filter(a => a.partial).length,
  };
};

const isWeak = (bucket, minTotal) => bucket.total >= minTotal && share(bucket) <= WEAK_SHARE;

/** Attach how sure we are and how serious it is, both from the same evidence. */
const judged = (finding, evidence) => {
  const confidence = evidence.total >= CLEAR_EVIDENCE ? 'clear' : 'early';
  const severity = confidence === 'early'
    ? 'early'
    : share(evidence) <= HIGH_CONCERN_SHARE ? 'high' : 'needsWork';
  return { ...finding, confidence, severity };
};

/**
 * @param {Array} answers  The check's answers: { topic, format, kind, correct, partial }.
 * @returns {null | { answered, correct, findings: Array, allEarly: boolean, strength: Object|null }}
 */
export const buildVerdict = (answers = []) => {
  const rows = (Array.isArray(answers) ? answers : [])
    .filter(a => a && typeof a.topic === 'string' && a.topic.trim());
  if (!rows.length) return null;

  const standard = tally(rows, a => (a.format || 'mcq') === 'mcq' && a.kind !== 'prioritization');
  const sata = tally(rows, a => a.format === 'sata');
  const cases = tally(rows, a => a.format === 'casestudy');
  const priority = tally(rows, a => a.kind === 'prioritization');
  const hard = {
    total: sata.total + cases.total,
    correct: sata.correct + cases.correct,
    partial: sata.partial,
  };

  const findings = [];
  const formatGap = standard.total >= 2 && hard.total >= 2
    && share(standard) >= FORMAT_GAP_MIN_MCQ
    && (share(standard) - share(hard)) * 100 >= FORMAT_GAP_PP;

  if (formatGap) {
    findings.push(judged({ key: 'formatGap', standard, hard }, hard));
  } else {
    if (isWeak(sata, 2)) findings.push(judged({ key: 'sata', ...sata }, sata));
    if (cases.total > 0 && cases.correct === 0) findings.push(judged({ key: 'casestudy', ...cases }, cases));
  }
  if (isWeak(priority, 1)) findings.push(judged({ key: 'priority', ...priority }, priority));

  const byTopic = [...new Set(rows.map(a => a.topic))]
    .map(topic => ({ topic, ...tally(rows, a => a.topic === topic) }));
  byTopic
    .filter(t => isWeak(t, 2))
    .sort((a, b) => share(a) - share(b) || b.total - a.total)
    .forEach(t => findings.push(judged({ key: 'topic', ...t }, t)));

  const strength = byTopic
    .filter(t => t.total >= 2 && t.correct === t.total)
    .sort((a, b) => b.total - a.total)[0] || null;

  const shown = findings.slice(0, MAX_FINDINGS);
  return {
    answered: rows.length,
    correct: rows.filter(a => a.correct).length,
    findings: shown,
    // When every finding is thin, say so once in the header instead of
    // stamping the same label on every row.
    allEarly: shown.length > 0 && shown.every(f => f.confidence === 'early'),
    strength,
  };
};

// Shared evidence wording for the free findings and the locked preview.
export const describeVerdictFinding = (f, t) => {
  switch (f.key) {
    case 'formatGap':
      return {
        title: t('lockedPlan.verdict.formatGap.title'),
        evidence: t('lockedPlan.verdict.formatGap.evidence', {
          standard: f.standard.correct, standardTotal: f.standard.total,
          hard: f.hard.correct, hardTotal: f.hard.total,
        }),
      };
    case 'sata':
      return {
        title: t('lockedPlan.verdict.sata.title'),
        evidence: f.partial > 0
          ? t('lockedPlan.verdict.sata.evidencePartial', { correct: f.correct, total: f.total, partial: f.partial })
          : t('lockedPlan.verdict.sata.evidence', { correct: f.correct, total: f.total }),
      };
    case 'casestudy':
      return {
        title: t('lockedPlan.verdict.casestudy.title'),
        evidence: t('lockedPlan.verdict.casestudy.evidence', { count: f.total, correct: f.correct }),
      };
    case 'priority':
      return {
        title: t('lockedPlan.verdict.priority.title'),
        evidence: t('lockedPlan.verdict.priority.evidence', { correct: f.correct, total: f.total }),
      };
    default:
      return {
        title: f.topic,
        evidence: f.correct > 0
          ? t('lockedPlan.verdict.topic.evidence', { correct: f.correct, total: f.total })
          : f.total === 2
            ? t('lockedPlan.verdict.topic.missedBoth')
            : t('lockedPlan.verdict.topic.missedAll', { total: f.total }),
      };
  }
};

