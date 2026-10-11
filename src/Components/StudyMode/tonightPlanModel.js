/* ══════════════════════════════════════════════════════════════════════
   TONIGHT'S PLAN — the exam-is-tomorrow plan, as open-ended rounds.

   WHY THIS EXISTS
   ───────────────
   The median exam is 2 days away at signup and 79% of students are active
   on a single day, so for most of them "the plan" is one evening. The
   sprint plan already dropped lessons and flashcards for them, but it was
   still a list of topic tests: it told her what she got wrong and never
   taught the method, so a student could miss select-all all evening and go
   to bed no better at it (one Pro student ran 11 prioritization drills at
   33-67% with no trend, 2026-09-26).

   Tonight's plan works one weak spot at a time, in ROUNDS:
     fix (taught: a miss opens the walkthrough)  →  check (new questions)
   and every round ends with an honest before/after. When one is done the
   next weakest starts, for as long as she wants: a plan has an end, her
   evening should not (owner, 2026-10-10). Each round is finishable on its
   own, which is what keeps her going (see firstBlock.js).

   HONESTY RULES (the reason most of this file exists)
   ───────────────────────────────────────────────────
   * The readiness check is up to 8 questions, so a format is 2-3 answers.
     Picking what to PRACTISE from that is low-stakes and allowed
     (MIN_TARGET). CLAIMING a change needs answers on both sides
     (MIN_CLAIM_BEFORE / MIN_CLAIM_AFTER); below that the copy says so.
   * "Fixed" means the re-check itself is strong (FIXED_AT), not just that
     it beat a weak start: 0/3 → 2/5 is better, not fixed.
   * A round that didn't move is not repeated as-is: it comes back once,
     easier, method first; after MAX_ATTEMPTS it is left for the morning.
   * Only formats with a walkthrough are offered as "fix" rounds. A weak
     topic gets a short lesson from her notes instead.
   * When nothing weak is left it never runs dry: mixed review, harder each
     time.

   Everything here is derived from the evidence list kept on the plan
   (`study.tonight`), never from a model's opinion of her.
   ══════════════════════════════════════════════════════════════════════ */

import { SPRINT_MAX_DAYS } from './planPreviewModel';

export const TONIGHT_MAX_DAYS = SPRINT_MAX_DAYS;
export const TONIGHT_TAG = 'tonight';
export const ROLE = Object.freeze({ FIX: 'fix', CHECK: 'check' });
export const KIND = Object.freeze({ FIND: 'find', SKILL: 'skill', TOPIC: 'topic', MIXED: 'mixed' });
export const OUTCOME = Object.freeze({
  FIXED: 'fixed', BETTER: 'better', NOT_YET: 'notYet', TOO_FEW: 'tooFew', MEASURED: 'measured',
});

/* Skills that can be TAUGHT tonight: each has a walkthrough on its card.
   `format` is the exam-card question type that carries it. */
export const SKILLS = Object.freeze({
  sata: {
    format: 'sata', fixCount: 5, checkCount: 5,
    instructions: 'Select-all-that-apply only. Each option must be judgeable on its own, '
      + 'with distractors that are true statements but wrong answers here.',
  },
  priority: {
    format: 'casestudy', fixCount: 4, checkCount: 3,
    instructions: 'Ordering questions only: concrete nursing actions placed in priority order. '
      + 'Every question must hinge on what the nurse does FIRST, and every finding an action '
      + 'mentions must appear in the chart.',
  },
});
const TEACHABLE = Object.keys(SKILLS);

export const MIN_TARGET = 2;
export const WEAK_BELOW = 0.8;
export const FIXED_AT = 0.8;
export const BETTER_BY = 0.2;
export const MIN_CLAIM_BEFORE = 2;
export const MIN_CLAIM_AFTER = 3;
export const MAX_ATTEMPTS = 2;
const MAX_EVIDENCE = 300;

/** Is this plan the exam-is-tomorrow kind? */
export const isTonightPlan = (path) => path?.archetype === 'sprint';

/** Days left by the plan's own rule, for a plan without an archetype. */
export const isTonightByDays = (daysToExam) =>
  Number.isFinite(daysToExam) && daysToExam >= 0 && daysToExam <= TONIGHT_MAX_DAYS;

const keyOf = (topic) => String(topic || '').trim().toLowerCase();
const pct = (t) => (t && t.total ? t.correct / t.total : 0);

/* ── Evidence ──────────────────────────────────────────────────────────
   One entry per answered question: { skill, topic, correct }. `skill` is a
   teachable skill or null (plain knowledge). The readiness check marks
   prioritization with `kind` (its "case study" format is a single-answer
   scenario, not an ordering question); exam steps mark it by question type. */

export const checkEvidence = (answers = []) => (Array.isArray(answers) ? answers : [])
  .filter((a) => a && typeof a.correct === 'boolean' && !a.unsure)
  .map((a) => ({
    skill: a.format === 'sata' ? 'sata' : a.kind === 'prioritization' ? 'priority' : null,
    topic: a.topic || null,
    correct: a.correct,
  }));

/** Answers from an exam step's progress ({ [i]: { questionType, isCorrect } }). */
export const examEvidence = (progressAnswers = {}, topic = null) =>
  Object.values(progressAnswers || {})
    .filter((a) => a && typeof a.isCorrect === 'boolean')
    .map((a) => ({
      skill: a.questionType === 'sata' ? 'sata' : a.questionType === 'casestudy' ? 'priority' : null,
      topic: topic || null,
      correct: a.isCorrect,
    }));

export const tally = (entries = [], pick = () => true) => entries.filter(pick).reduce(
  (t, e) => ({ correct: t.correct + (e.correct ? 1 : 0), total: t.total + 1 }), { correct: 0, total: 0 });

const forTarget = (target) => {
  if (target.kind === KIND.SKILL) return (e) => e.skill === target.skill;
  if (target.kind === KIND.TOPIC) return (e) => keyOf(e.topic) === keyOf(target.topic);
  return () => true;
};

/* ── Choosing the next round ───────────────────────────────────────── */

const skillAttempts = (rounds, skill) => rounds.filter((r) => r.kind === KIND.SKILL && r.skill === skill).length;
const skillSettled = (rounds, skill) => {
  const mine = rounds.filter((r) => r.kind === KIND.SKILL && r.skill === skill && r.status === 'done');
  return mine.some((r) => r.outcome === OUTCOME.FIXED) || skillAttempts(rounds, skill) >= MAX_ATTEMPTS;
};

/** The topic where she misses this skill most, or null. */
const weakestTopicFor = (evidence, skill) => {
  const misses = {};
  evidence.forEach((e) => {
    if (e.skill === skill && !e.correct && e.topic) misses[e.topic] = (misses[e.topic] || 0) + 1;
  });
  const ranked = Object.entries(misses).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || null;
};

/**
 * What the next round works on.
 * @returns {{kind, skill?, topic?, attempt, easier?, level?}}
 */
export const pickTarget = (tonight) => {
  const evidence = tonight?.evidence || [];
  const rounds = tonight?.rounds || [];
  if (!evidence.length) return { kind: KIND.FIND, attempt: 1 };

  // A skill round that didn't land comes back once, easier, method first.
  const last = rounds[rounds.length - 1];
  if (last?.status === 'done' && last.kind === KIND.SKILL
      && [OUTCOME.BETTER, OUTCOME.NOT_YET, OUTCOME.TOO_FEW].includes(last.outcome)
      && skillAttempts(rounds, last.skill) < MAX_ATTEMPTS) {
    return { kind: KIND.SKILL, skill: last.skill, topic: last.topic || null, attempt: skillAttempts(rounds, last.skill) + 1, easier: true };
  }

  const skills = TEACHABLE
    .filter((s) => !skillSettled(rounds, s))
    .map((s) => ({ s, t: tally(evidence, (e) => e.skill === s) }))
    .filter(({ t }) => t.total >= MIN_TARGET && pct(t) < WEAK_BELOW)
    .sort((a, b) => pct(a.t) - pct(b.t) || (b.t.total - b.t.correct) - (a.t.total - a.t.correct));
  if (skills.length) {
    const skill = skills[0].s;
    return { kind: KIND.SKILL, skill, topic: weakestTopicFor(evidence, skill), attempt: skillAttempts(rounds, skill) + 1 };
  }

  const roundedTopics = new Set(rounds.filter((r) => r.kind === KIND.TOPIC).map((r) => keyOf(r.topic)));
  const byTopic = {};
  evidence.forEach((e) => {
    const k = keyOf(e.topic);
    if (!k || roundedTopics.has(k)) return;
    byTopic[k] = byTopic[k] || { topic: e.topic, correct: 0, total: 0 };
    byTopic[k].total += 1;
    if (e.correct) byTopic[k].correct += 1;
  });
  const topics = Object.values(byTopic)
    .filter((t) => t.total >= MIN_TARGET && pct(t) < WEAK_BELOW)
    .sort((a, b) => pct(a) - pct(b) || b.total - a.total);
  if (topics.length) return { kind: KIND.TOPIC, topic: topics[0].topic, attempt: 1 };

  const level = rounds.filter((r) => r.kind === KIND.MIXED).length + 1;
  return { kind: KIND.MIXED, level, attempt: 1 };
};

/* ── Rounds ────────────────────────────────────────────────────────── */

export const initTonight = (checkAnswers = []) => ({ version: 1, evidence: checkEvidence(checkAnswers), rounds: [] });

/** The round a target becomes, with its "before" frozen at the start. */
export const startRound = (tonight, target = pickTarget(tonight)) => {
  const evidence = tonight?.evidence || [];
  const before = target.kind === KIND.FIND ? null : tally(evidence, forTarget(target));
  const round = {
    n: (tonight?.rounds?.length || 0) + 1,
    kind: target.kind,
    ...(target.skill ? { skill: target.skill } : {}),
    ...(target.topic ? { topic: target.topic } : {}),
    ...(target.level ? { level: target.level } : {}),
    ...(target.easier ? { easier: true } : {}),
    attempt: target.attempt || 1,
    before,
    after: null,
    outcome: null,
    status: 'active',
  };
  return { ...tonight, rounds: [...(tonight?.rounds || []), round] };
};

export const currentRound = (tonight) => {
  const rounds = tonight?.rounds || [];
  const last = rounds[rounds.length - 1];
  return last?.status === 'active' ? last : null;
};

/** How a round went, by the honesty rules above. */
export const outcomeOf = (before, after, kind) => {
  if (!after || after.total < MIN_CLAIM_AFTER) return OUTCOME.TOO_FEW;
  if (kind === KIND.FIND) return OUTCOME.MEASURED;
  const a = pct(after);
  if (a >= FIXED_AT) return OUTCOME.FIXED;
  if (before && before.total >= MIN_CLAIM_BEFORE && a - pct(before) >= BETTER_BY) return OUTCOME.BETTER;
  return OUTCOME.NOT_YET;
};

/** Can this round honestly show "earlier X, now Y"? */
export const isComparable = (round) =>
  !!round?.before && round.before.total >= MIN_CLAIM_BEFORE && !!round.after && round.after.total >= MIN_CLAIM_AFTER;

/**
 * Close the active round with the re-check's answers. Fix-step answers are
 * added to the evidence (they show what she knows) but never to "after":
 * the fix step is taught, so it would flatter the result.
 */
export const completeRound = (tonight, checkEntries = [], fixEntries = []) => {
  const round = currentRound(tonight);
  if (!round) return tonight;
  const target = { kind: round.kind, skill: round.skill, topic: round.topic };
  const after = tally(checkEntries, round.kind === KIND.TOPIC ? () => true : forTarget(target));
  const done = { ...round, after, outcome: outcomeOf(round.before, after, round.kind), status: 'done' };
  const evidence = [...(tonight.evidence || []), ...fixEntries, ...checkEntries].slice(-MAX_EVIDENCE);
  return { ...tonight, evidence, rounds: [...tonight.rounds.slice(0, -1), done] };
};

/* ── The steps of a round ──────────────────────────────────────────── */

const freshInstructions = 'Brand-new questions, not variants of ones she has already seen. '
  + 'Standard exam difficulty: do not make them easier than the questions before.';

/**
 * The node definitions for a round, in order. Tags carry the round and the
 * step's role so the container knows what finishing it means.
 * @param {object} round
 * @param {(key: string, opts?: object) => string} t
 */
export const roundNodes = (round, t) => {
  const tags = (role) => [TONIGHT_TAG, `tonight:round:${round.n}`, `tonight:${role}`];
  const focus = round.topic ? `Focus on ${round.topic}. ` : '';
  const exam = (role, label, questionTypes, questionCount, instructions, difficulty = 2) => ({
    type: 'exam', label, tags: tags(role), difficulty, adaptive: true,
    ...(round.topic ? { topic: round.topic } : {}),
    reason: `Tonight round ${round.n}: ${role}`,
    examConfig: { questionTypes, questionCount, timerEnabled: false, customInstructions: (focus + instructions).trim() },
  });

  if (round.kind === KIND.FIND) {
    return [exam(ROLE.CHECK, t('tonight.node.find', "Find what's costing you points"),
      ['mcq', 'sata', 'casestudy'], 6, 'A mix of single-answer, select-all and ordering questions across the main topics.')];
  }
  if (round.kind === KIND.SKILL) {
    const skill = SKILLS[round.skill];
    const name = t(`tonight.skill.${round.skill}`);
    const easier = round.easier ? 'Start a little easier than a standard exam question, then build up. ' : '';
    return [
      exam(ROLE.FIX, t('tonight.node.fix', { n: round.n, skill: name }), [skill.format], skill.fixCount,
        easier + skill.instructions, round.easier ? 1 : 2),
      exam(ROLE.CHECK, t('tonight.node.check', { n: round.n }), [skill.format], skill.checkCount,
        skill.instructions + ' ' + freshInstructions),
    ];
  }
  if (round.kind === KIND.TOPIC) {
    return [
      { type: 'lesson', label: t('tonight.node.topicLesson', { n: round.n, topic: round.topic }), tags: tags(ROLE.FIX),
        topic: round.topic, difficulty: 1, adaptive: true, reason: `Tonight round ${round.n}: fix` },
      exam(ROLE.CHECK, t('tonight.node.check', { n: round.n }), ['mcq', 'sata'], 5, freshInstructions),
    ];
  }
  // Mixed review: never runs dry, harder each time.
  const level = round.level || 1;
  return [exam(ROLE.CHECK, t('tonight.node.mixed', { n: round.n }), ['mcq', 'sata', 'casestudy'], 6,
    (level > 1 ? 'Harder than before: multi-step clinical judgment, no giveaway options. ' : '') + freshInstructions,
    Math.min(3, 1 + level))];
};

/**
 * A sprint plan from the planner, turned into Tonight's plan: round 1's steps
 * replace the planner's topic tests, and the round state travels with it.
 * The planner's own path is kept under `plannerNodes` for the record.
 * @param {object} path  the /study/start (or /study/plan) result
 * @param {object[]} checkAnswers  readiness-check answers (may be empty)
 */
export const buildTonightPath = (path, checkAnswers, t) => {
  const tonight = startRound(initTonight(checkAnswers));
  const nodes = roundNodes(currentRound(tonight), t);
  return { ...path, nodes, tonight, plannerNodes: path?.nodes || [] };
};

/** The tonight role and round of a node, or null when it isn't one. */
export const tonightRole = (node) => {
  const tags = node?.tags || [];
  if (!tags.includes(TONIGHT_TAG)) return null;
  const round = Number((tags.find((x) => x.startsWith('tonight:round:')) || '').split(':')[2]) || null;
  const role = tags.includes(`tonight:${ROLE.CHECK}`) ? ROLE.CHECK : tags.includes(`tonight:${ROLE.FIX}`) ? ROLE.FIX : null;
  return role ? { role, round } : null;
};
