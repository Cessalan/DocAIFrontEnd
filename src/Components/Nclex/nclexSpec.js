/* ══════════════════════════════════════════════════════════════════════
   NCLEX SPEC — what to ask for next.

   RELATIONSHIP TO drillModel.selectNextSpec
   ─────────────────────────────────────────
   The drill already has a next-question policy, and it is better than this
   one: six ordered rules over a live state object, with tests. This file
   does NOT replace it and must not grow into a second copy of it.

   The difference is what they choose FROM. `selectNextSpec` picks a topic
   out of a pool derived from the student's uploaded documents. There are no
   documents here, so the pool is the NCSBN blueprint — which means the
   choice is weighted by how much of the exam each category carries, a
   dimension the drill's pool has no equivalent for.

   So this file owns the CURRICULUM choice (which category, which subject,
   which area) and keeps the format rotation deliberately thin. When the
   adaptive modules are extracted into a shared package, the format half of
   `nextSpec` below should be deleted and delegated to `selectNextSpec`
   rather than kept in sync by hand — that hand-syncing is exactly the
   failure CLAUDE.md documents for planPreviewModel.

   THE FORMAT QUOTA IS NOT NEGOTIABLE
   ──────────────────────────────────
   Measured across 68 students and 1,081 answers, accuracy runs ~82% on
   multiple choice against ~30% on select-all and ~15% on case studies. A
   session that quietly serves mostly multiple choice will report a student
   as far stronger than she is, because that is the format she is good at.
   `FORMAT_CYCLE` therefore guarantees she meets the hard formats early and
   often, whatever else the session is about.
   ══════════════════════════════════════════════════════════════════════ */

import { SUBJECTS, findSubject, findCategory, categoryWeight } from './nclexCurriculum';
import { categoryRows, priorityCategories, MIN_FOR_VERDICT } from './nclexProfile';

/**
 * The rotation. Two of every three questions are a format the exam leans on
 * and the student is weak at — the opposite of what a session optimising for
 * her comfort would serve.
 *
 * Position 0 is multiple choice so a session does not OPEN on a case study:
 * production data shows a wrong first question predicts quitting (Q0 wrong →
 * quit at 1–2 answers; Q0 right → continued to 5, 15, 29). Small sample, but
 * the cost of respecting it is nil.
 */
export const FORMAT_CYCLE = ['mcq', 'sata', 'casestudy', 'mcq', 'sata', 'mcq'];

/** Format for the nth question of a session (0-based). */
export const formatForIndex = (n, forced = null) => {
  if (forced) return forced;
  return FORMAT_CYCLE[n % FORMAT_CYCLE.length];
};

/**
 * Pick the category this question should score into.
 *
 * A diagnostic sweeps the blueprint in weight order so that 25 questions
 * cover all eight categories proportionally — the point of a readiness check
 * is coverage, not depth. Everything else targets weakness by exam risk.
 */
export const categoryForIndex = (profile, n, { mode, category, subject } = {}) => {
  if (category) return category;

  if (subject) {
    const s = findSubject(subject);
    if (s?.needs?.length) return s.needs[n % s.needs.length];
  }

  if (mode === 'diagnostic') {
    // Proportional sweep: repeat each category roughly in line with its
    // blueprint weight, so a 25-question check spends ~4 on Management of
    // Care and ~2 on Psychosocial Integrity rather than 3 on each.
    const rows = categoryRows(profile).sort((a, b) => b.weight - a.weight);
    const ticket = [];
    rows.forEach((r) => {
      const slots = Math.max(1, Math.round(r.weight / 4));
      for (let i = 0; i < slots; i += 1) ticket.push(r.code);
    });
    return ticket[n % ticket.length];
  }

  const priorities = priorityCategories(profile, 3);
  if (priorities.length) return priorities[n % priorities.length].code;

  const rows = categoryRows(profile).sort((a, b) => b.weight - a.weight);
  return rows[n % rows.length]?.code || 'MC';
};

/** A subject that scores into this category, for labelling and topic text. */
export const subjectForCategory = (code) =>
  SUBJECTS.find((s) => s.needs.includes(code)) || null;

/**
 * The topic string handed to the generator.
 *
 * Concrete beats abstract: "Cardiovascular drugs" produces better questions
 * than "Pharmacological & Parenteral Therapies", which reads to a model as a
 * bureaucratic heading rather than a clinical subject. So the area wins, then
 * the subject, and the category label is the last resort.
 */
export const topicFor = ({ area, subject, category }) => {
  if (area) return area;
  const s = subject ? findSubject(subject) : subjectForCategory(category);
  if (s) return s.label;
  return findCategory(category)?.label || 'Nursing fundamentals';
};

/**
 * Instructions that make the question an NCLEX item rather than a quiz item.
 *
 * The `skills` line is what makes clinical-reasoning tracking possible at
 * all: without asking for the tag we cannot aggregate it, and without
 * aggregating it "you have a prioritization problem" is unsayable.
 */
export const instructionsFor = (spec) => {
  const cat = findCategory(spec.category);
  const lines = [
    'Write one NCLEX-style question for a graduating nursing student.',
    cat ? `It must sit in the NCSBN client-needs category "${cat.label}".` : null,
    'Use a realistic clinical stem. Test judgment, not recall of a definition.',
    spec.format === 'sata'
      ? 'Select-all-that-apply: 5 options, more than one correct, no "all of the above".'
      : null,
    spec.format === 'casestudy'
      ? 'Unfolding case study: give the scenario, then ask what the nurse does first.'
      : null,
    spec.difficulty >= 3
      ? 'Make it hard: the distractors should all be plausible actions.'
      : null,
    'End the rationale by naming the single concept being tested in 2-5 words.',
  ].filter(Boolean);
  return lines.join(' ');
};

/**
 * Build the full spec for question n of a session.
 *
 * @param {Object} profile   from buildProfile
 * @param {number} n         0-based index within this session
 * @param {Object} params    { mode, subject, area, category, format }
 */
export const nextSpec = (profile, n, params = {}) => {
  const category = categoryForIndex(profile, n, params);
  const format = formatForIndex(n, params.format);
  const subject =
    params.subject || subjectForCategory(category)?.id || null;

  // Difficulty rises with demonstrated accuracy in this category and falls
  // fast, mirroring nextDifficulty's asymmetry in drillModel: a student
  // drowning at level 3 needs relief immediately, while earning level 3
  // should take evidence.
  const bucket = profile?.categories?.[category];
  let difficulty = 2;
  if (bucket && bucket.total >= MIN_FOR_VERDICT) {
    if (bucket.accuracy >= 0.85) difficulty = 3;
    else if (bucket.accuracy < 0.5) difficulty = 1;
  }

  const spec = {
    category,
    subject,
    area: params.area || null,
    format,
    difficulty,
    weight: categoryWeight(category),
  };
  return { ...spec, topic: topicFor(spec), instructions: instructionsFor(spec) };
};

/**
 * Seconds a question of each format actually takes, from the exam-drill
 * production read (2026-09-05): median 27s across all questions, and 189s
 * median on case studies specifically. Working backwards from those two
 * numbers gives roughly the split below.
 *
 * These are deliberately not optimistic. Telling a student a session is
 * "about 7 minutes" and then keeping her for 11 is a small dishonesty, but
 * it is the same KIND as an inflated readiness score, and this product only
 * works if she believes the numbers.
 */
export const SECONDS_BY_FORMAT = { mcq: 25, sata: 40, casestudy: 180 };

/**
 * Rough minutes for a session of `count` questions, following the same format
 * rotation the session will actually serve — so the estimate moves when the
 * rotation does instead of being a constant that silently goes stale.
 */
export const estimatedMinutes = (count, forcedFormat = null) => {
  let seconds = 0;
  for (let i = 0; i < count; i += 1) {
    seconds += SECONDS_BY_FORMAT[formatForIndex(i, forcedFormat)] || 30;
  }
  return Math.max(1, Math.round(seconds / 60));
};

/**
 * How many questions a session should run.
 * Clamped so a hand-edited query string cannot ask for 500 LLM calls.
 */
export const SESSION_MIN = 3;
export const SESSION_MAX = 30;

export const sessionLength = (raw, mode) => {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= SESSION_MIN) return Math.min(SESSION_MAX, Math.floor(n));
  return mode === 'diagnostic' ? 25 : 10;
};
