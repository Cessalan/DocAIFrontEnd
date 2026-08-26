/**
 * readinessProjection — "if I do today's session, where does that leave me?"
 *
 * WHY THIS EXISTS
 * ───────────────
 * The plan page used to end on inventory: "15-step plan", "11 more steps".
 * That's information about the SYSTEM. The student's actual question is
 * "am I going to be ready?", and a step count never answers it. This module
 * converts the same work into the only currency they care about — a readiness
 * number that moves when they act.
 *
 * HOW THE ESTIMATE WORKS (and what it is NOT)
 * ───────────────────────────────────────────
 * Readiness is the coverage-aware mean used everywhere else on this page:
 * every curriculum topic counts equally, and topics you haven't been tested on
 * count as zero. Projecting it forward needs one assumption — how well you'll
 * do on questions you haven't answered yet — and we take that from how you've
 * actually been doing, smoothed toward a neutral prior so a single 0/5 quiz
 * doesn't project you to zero forever:
 *
 *     assumedAccuracy = (correct + PRIOR_ACC * PRIOR_WEIGHT)
 *                       / (answered + PRIOR_WEIGHT)
 *
 * With no history that's the prior; with lots of history it converges on the
 * student's real accuracy. It is deliberately a shrunk estimate, not a
 * prediction of their exam grade — hence every string that renders it says
 * "estimated".
 *
 * Only QUIZ and EXAM nodes move the number, because only those produce graded
 * answers (mirroring buildScoredTopics, which excludes flashcards on purpose).
 * A lesson-only day therefore projects +0, and the UI must say something
 * qualitative instead of showing "21% → 21%", which reads as broken.
 */

/* Smoothing prior. 10 questions of pull is roughly two quizzes — enough to
   damp a single disastrous quiz, light enough that a real trend wins quickly. */
const PRIOR_ACCURACY = 0.7;
const PRIOR_WEIGHT = 10;

/* Questions a node contributes. Mirrors STUDY_QUIZ_QUESTIONS in the backend
   (and QUIZ_QUESTIONS in StudyModeContainer); exams default to 10 in
   FastAPICalls.generate_exam. If a student configures a different exam size
   this shifts a topic's weight slightly — never the direction of the score. */
const QUESTIONS_BY_NODE_TYPE = {
  quiz: 5,
  exam: 10,
};

/**
 * Normalize a topic name for fuzzy matching: strip diacritics, lowercase,
 * collapse whitespace. Shared with StudyPlanOverview so node labels and
 * studyPerformance keys bucket identically in both places.
 */
export const normalizeTopic = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Graded question count a node will contribute, or 0 if it isn't graded. */
export const gradedQuestionCount = (type) => QUESTIONS_BY_NODE_TYPE[type] || 0;

/**
 * Find the scoredTopics entry a node label belongs to. Substring match in
 * either direction, same as buildScoredTopics' findStatsKey, so
 * "Urinary elimination - Quiz" lands on the "Urinary elimination" bucket.
 */
const matchTopicIndex = (label, scoredTopics) => {
  const norm = normalizeTopic(label);
  if (!norm) return -1;
  let exact = -1;
  let partial = -1;
  for (let i = 0; i < scoredTopics.length; i++) {
    const key = normalizeTopic(scoredTopics[i].name);
    if (!key) continue;
    if (key === norm) { exact = i; break; }
    if (partial === -1 && (key.includes(norm) || norm.includes(key))) partial = i;
  }
  return exact !== -1 ? exact : partial;
};

const meanPct = (pcts) =>
  pcts.length === 0 ? null : Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);

/**
 * Apply a set of graded nodes to the topic table and return the new overall %.
 *
 * @param {Array} scoredTopics  from buildScoredTopics — { name, correct, total, pct }
 * @param {Array} nodes         nodes to simulate completing
 * @param {number} accuracy     assumed accuracy on new questions, 0..1
 * @param {Function} labelOf    node -> topic-ish label
 */
const applyNodes = (scoredTopics, nodes, accuracy, labelOf) => {
  // Clone only the fields we mutate.
  const sim = scoredTopics.map(t => ({ correct: t.correct, total: t.total, pct: t.pct }));

  let graded = 0;
  for (const node of nodes) {
    const q = gradedQuestionCount(node.type);
    if (q === 0) continue;
    const idx = matchTopicIndex(labelOf(node), scoredTopics);
    if (idx === -1) continue;
    sim[idx].correct += q * accuracy;
    sim[idx].total += q;
    graded += q;
  }

  const pcts = sim.map(t =>
    t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0
  );
  return { pct: meanPct(pcts), gradedQuestions: graded };
};

/**
 * Project readiness for today's mission and for finishing the whole plan.
 *
 * @param {Array}    scoredTopics  from buildScoredTopics
 * @param {Array}    missionNodes  today's slice (from buildStudySchedule)
 * @param {Array}    remainingNodes every not-yet-done node in the plan
 * @param {Function} labelOf       node -> topic label (pass getStepTopicLabel)
 * @returns {Object} projection
 */
export const projectReadiness = ({
  scoredTopics = [],
  missionNodes = [],
  remainingNodes = [],
  labelOf = (n) => n?.label || '',
} = {}) => {
  const empty = {
    hasData: false,
    currentPct: null,
    todayPct: null,
    planPct: null,
    todayDelta: 0,
    movesToday: false,
    focusTopic: null,
    focusLevel: null,
  };
  if (!scoredTopics.length) return empty;

  const totalCorrect = scoredTopics.reduce((s, t) => s + t.correct, 0);
  const totalQuestions = scoredTopics.reduce((s, t) => s + t.total, 0);

  const currentPct = meanPct(scoredTopics.map(t => t.pct));

  // Smoothed accuracy — see the module header for why this isn't the raw ratio.
  const accuracy =
    (totalCorrect + PRIOR_ACCURACY * PRIOR_WEIGHT) / (totalQuestions + PRIOR_WEIGHT);

  const today = applyNodes(scoredTopics, missionNodes, accuracy, labelOf);
  const plan = applyNodes(scoredTopics, remainingNodes, accuracy, labelOf);

  // Never project backwards. The model can dip a strong topic when the
  // student's smoothed accuracy sits below that topic's current score — true
  // to the arithmetic, but "do this session → get worse" is both demoralising
  // and useless as a nudge, so we floor the projection at today's number.
  const todayPct = today.pct == null ? null : Math.max(today.pct, currentPct);
  const planPct = plan.pct == null ? null : Math.max(plan.pct, todayPct ?? currentPct);

  // What today is actually about — the first mission topic we can score.
  let focusTopic = null;
  let focusLevel = null;
  for (const node of missionNodes) {
    const idx = matchTopicIndex(labelOf(node), scoredTopics);
    if (idx === -1) continue;
    const t = scoredTopics[idx];
    focusTopic = t.name;
    focusLevel = t.untested ? 'untested' : t.level;
    break;
  }
  if (!focusTopic && missionNodes.length > 0) {
    focusTopic = labelOf(missionNodes[0]) || null;
  }

  const todayDelta = todayPct == null || currentPct == null ? 0 : todayPct - currentPct;

  return {
    hasData: totalQuestions > 0,
    currentPct,
    todayPct,
    planPct,
    todayDelta,
    // Below a full point the arrow would show "21% → 21%", which reads as a
    // bug. Those days get qualitative copy instead.
    movesToday: todayDelta >= 1,
    gradedQuestionsToday: today.gradedQuestions,
    assumedAccuracy: accuracy,
    focusTopic,
    focusLevel,
  };
};

export default projectReadiness;
