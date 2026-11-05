/**
 * planAdaptModel — what the plan proposes to change after a finished quiz.
 *
 * A plan used to adapt only when she pressed something ("Practice more",
 * "Practise this weak area"), and otherwise ran in the order the planner
 * wrote at upload time. Students re-uploaded the same notes to get a plan
 * that matched where they were now (33 of them in the 30 days to 2026-11-01).
 * This module is the alternative: after each quiz it proposes changes to
 * what comes next, each one tied to something she did. She confirms them
 * ("Update my plan") before anything is written; see
 * ADAPTIVE_PLAN_IMPLEMENTATION.md.
 *
 * Five kinds of change, in the order they are decided:
 *
 *   mixup   a 3-page lesson on the answer she chose, right after the quiz
 *           (built server-side from her saved choice, services/node_result_focus.py)
 *   format  the next planned quiz becomes her weakest question format
 *   skip    an upcoming review on a topic she has already proven; its quiz stays
 *   return  a 2-question check on a topic she finished days ago and hadn't fully got
 *   moved   the rest of the upcoming steps, weakest topic first
 *
 * THE LIMITS ARE THE POINT. When inserting was unbounded, 60% of active plans
 * never left their first topic (2026-10-13), which is why `MAX_DETOURS_PER_TOPIC`
 * exists. So: at most one added step per topic (shared with the readout's own
 * detours), and the plan grows by at most one step per finished quiz; a skip
 * pays for an add. Finished steps and the step just finished are never touched.
 * Tonight's plan adapts by rounds and is left alone.
 *
 * No evidence, no change. Every change carries its `reason` as DATA (counts,
 * dates, her choice); the words live in i18n. A change that cannot state its
 * reason is not proposed.
 *
 * Pure: the container calls it, nothing here reads or writes Firestore.
 */
import { countDetours, resolveNodeTopic } from './nodeTopic';
import { topicKey } from './topicJourneyModel';
import { MAX_DETOURS_PER_TOPIC } from './nodeReadout';
import { BREAKDOWN_MIN_SAMPLE } from '../../Services/StudySessionService';

export const CHANGE = { MIXUP: 'mixup', FORMAT: 'format', SKIP: 'skip', RETURN: 'return', MOVED: 'moved' };

/** Pages in a mix-up lesson. Mirrors _MIX_UP_STRUCTURE in NQBackEnd2 services/quick_check.py. */
export const MIXUP_PAGES = 3;

/** Net steps a single finished quiz may add to the plan. */
export const MAX_NET_ADDED = 1;

/** A format this far under her best one, both on enough answers, is a weakness. */
export const FORMAT_GAP = 0.25;

/** Questions in a format-switched quiz. */
export const FORMAT_QUESTIONS = 5;

/** Readiness-check answers on a topic, all correct, before its review is cut. */
export const SKIP_MIN_CHECK = 3;

/** Or: practice answers on a topic at this accuracy. */
export const SKIP_MIN_PRACTICE = 5;
export const SKIP_ACCURACY = 0.85;

/** Most reviews cut in one proposal; more reads as the plan giving up on her. */
export const MAX_SKIPS = 2;

/** A topic comes back after this long, if it still needs work. */
export const RETURN_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
export const RETURN_BELOW_PCT = 85;
export const RETURN_QUESTIONS = 2;

/** A topic must move at least this many places for its move to be explained. */
export const MOVE_EXPLAIN_MIN = 2;

/** Formats a quiz can be switched to, and the exam type that renders them. */
const SWITCHABLE = ['sata', 'casestudy', 'matrix'];

const RETURN_TAG = 'return_check';
const isTonight = (node) => Array.isArray(node?.tags) && node.tags.some((tag) => typeof tag === 'string' && tag.startsWith('tonight'));
const isBanner = (node) => node?.type === 'section_banner';
const isOpen = (node) => node && !isBanner(node) && node.status !== 'done' && node.status !== 'skipped';
const accuracy = (row) => (row && row.total > 0 ? row.correct / row.total : null);

/** Best available score for a topic: practice since the check, else the check. */
const topicScore = (key, topicProgress) => {
  const latest = topicProgress?.latest?.[key];
  if (latest?.answered >= 3) return { correct: latest.correct || 0, total: latest.answered };
  const baseline = topicProgress?.baseline?.[key];
  if (baseline?.answered > 0) return { correct: baseline.correct || 0, total: baseline.answered };
  return null;
};

/** Contiguous runs of steps on the same topic; a review stays with its quiz. */
const groupByTopic = (steps, all) => {
  const groups = [];
  steps.forEach((node) => {
    const key = topicKey(resolveNodeTopic(node, all));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.nodes.push(node);
    else groups.push({ key, nodes: [node] });
  });
  return groups;
};

/**
 * Weakest tested topic first. Untested topics keep their planned slots, so a
 * topic we know nothing about is never pushed behind ones we have measured.
 */
const rankGroups = (groups, topicProgress) => {
  const tested = groups
    .map((group, index) => ({ group, index, score: accuracy(topicScore(group.key, topicProgress)) }))
    .filter((row) => row.score !== null);
  const slots = tested.map((row) => row.index);
  const ordered = [...tested].sort((a, b) => a.score - b.score || a.index - b.index);
  const out = [...groups];
  slots.forEach((slot, i) => { out[slot] = ordered[i].group; });
  return out;
};

const mixupNode = ({ finished, topic, phase, t }) => ({
  id: `adaptive-mixup-${finished.id}`,
  type: 'lesson',
  label: t('planAdapt.mixupLabel', { topic, defaultValue: 'The mix-up from this quiz: {{topic}}' }),
  topic,
  tags: ['mixup', `source:${finished.id}`],
  difficulty: finished.difficulty || 1,
  adaptive: true,
  reason: 'Mix-up from the quiz just finished',
  reviewReason: { source: 'node_result', fromNodeId: finished.id },
  status: 'locked',
  messageId: null,
  phase,
});

const returnNode = ({ topic, phase, t }) => ({
  id: `adaptive-return-${topicKey(topic).replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
  type: 'quiz',
  label: t('planAdapt.returnLabel', { topic, defaultValue: 'Quick check: {{topic}}' }),
  topic,
  tags: [RETURN_TAG],
  difficulty: 2,
  adaptive: true,
  reason: 'Topic that still needs work, back after a few days',
  num_questions: RETURN_QUESTIONS,
  status: 'locked',
  messageId: null,
  phase,
});

/** Her weakest format against her best, when the gap is real. */
const weakFormat = (formats) => {
  const rows = Object.entries(formats || {})
    .map(([format, row]) => ({ format, correct: row?.correct || 0, total: row?.total || 0 }))
    .filter((row) => row.total >= BREAKDOWN_MIN_SAMPLE);
  if (rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => a.correct / a.total - b.correct / b.total);
  const weak = sorted[0];
  const best = sorted[sorted.length - 1];
  if (best.correct / best.total - weak.correct / weak.total < FORMAT_GAP) return null;
  return { weak, best };
};

/**
 * @param {Object} args
 * @param {Array}  args.nodes          study.path.nodes
 * @param {Array}  args.reserve        study.reserve.nodes
 * @param {string} args.finishedNodeId the quiz she just finished
 * @param {Array}  args.misses         collectMisses() for that quiz (missEvidence.js)
 * @param {Object} args.formats        studyPerformance.formats
 * @param {Object} args.topicProgress  { baseline, latest } from getTopicProgress
 * @param {Array}  args.history        studyPerformance.history
 * @param {string} [args.archetype]    the plan's archetype ('sprint' = Tonight's plan)
 * @param {string} [args.now]          ISO, for tests
 * @param {Function} args.t            i18next t
 * @returns {{ nodes: Array, reserve: Array, changes: Array }|null}  null = nothing to propose
 */
export const adaptPlan = ({
  nodes = [], reserve = [], finishedNodeId, misses = [], formats = {}, topicProgress = null,
  history = [], archetype = null, now = new Date().toISOString(), t,
} = {}) => {
  const live = Array.isArray(nodes) ? nodes : [];
  const held = Array.isArray(reserve) ? reserve : [];
  const finishedIndex = live.findIndex((node) => node?.id === finishedNodeId);
  const finished = live[finishedIndex];
  if (!finished || finished.type !== 'quiz' || archetype === 'sprint' || live.some(isTonight)) return null;

  const all = live.concat(held);
  const finishedTopic = resolveNodeTopic(finished, all);
  const changes = [];

  // Steps after the finished quiz, up to the next section header: a section is
  // a promise about what comes when, so nothing crosses it.
  const after = live.slice(finishedIndex + 1);
  const bannerAt = after.findIndex(isBanner);
  const segment = bannerAt === -1 ? after : after.slice(0, bannerAt);
  const tail = bannerAt === -1 ? [] : after.slice(bannerAt);
  let upcoming = segment.filter(isOpen);

  /* ── mixup ── */
  let mixup = null;
  const miss = (misses || []).find((m) => m && m.chosen && (Array.isArray(m.chosen) ? m.chosen.length : true));
  if (miss && finishedTopic && finished.adaptive !== true
    && countDetours(live, finishedTopic) < MAX_DETOURS_PER_TOPIC) {
    mixup = mixupNode({ finished, topic: finishedTopic, phase: finished.phase || 1, t });
    changes.push({ kind: CHANGE.MIXUP, nodeId: mixup.id, topic: finishedTopic,
      reason: { chosen: miss.chosen, concept: miss.concept || null } });
  }

  /* ── format ── */
  const gap = weakFormat(formats);
  if (gap && SWITCHABLE.includes(gap.weak.format)
    && (misses || []).some((m) => m?.format === gap.weak.format)
    && !upcoming.some((node) => node.examConfig?.questionTypes?.includes(gap.weak.format))) {
    const target = upcoming.find((node) => node.type === 'quiz' && node.adaptive !== true && !node.examConfig);
    if (target) {
      const switched = {
        ...target,
        type: 'exam',
        topic: target.topic || resolveNodeTopic(target, all),
        adaptedFrom: { type: 'quiz', format: gap.weak.format },
        examConfig: { questionTypes: [gap.weak.format], questionCount: FORMAT_QUESTIONS, timerEnabled: false },
      };
      upcoming = upcoming.map((node) => (node === target ? switched : node));
      changes.push({ kind: CHANGE.FORMAT, nodeId: target.id, topic: switched.topic, reason: {
        format: gap.weak.format, correct: gap.weak.correct, total: gap.weak.total,
        bestFormat: gap.best.format, bestCorrect: gap.best.correct, bestTotal: gap.best.total } });
    }
  }

  /* ── skip ── */
  const skipped = [];
  upcoming.forEach((node) => {
    if (skipped.length >= MAX_SKIPS || node.type !== 'lesson' || node.adaptive === true) return;
    const name = resolveNodeTopic(node, all);
    const key = topicKey(name);
    const check = topicProgress?.baseline?.[key];
    const latest = topicProgress?.latest?.[key];
    const checkProven = check?.answered >= SKIP_MIN_CHECK && check.correct === check.answered
      && (!latest?.answered || latest.correct === latest.answered);
    const practiceProven = latest?.answered >= SKIP_MIN_PRACTICE && latest.correct / latest.answered >= SKIP_ACCURACY;
    if (!checkProven && !practiceProven) return;
    // Cut the review only while a scored step on the topic remains.
    const keepsQuiz = upcoming.some((other) => other !== node && other.type !== 'lesson'
      && topicKey(resolveNodeTopic(other, all)) === key);
    if (!keepsQuiz) return;
    skipped.push(node.id);
    changes.push({ kind: CHANGE.SKIP, nodeId: node.id, topic: name, reason: checkProven
      ? { source: 'check', correct: check.correct, total: check.answered }
      : { source: 'practice', correct: latest.correct, total: latest.answered } });
  });
  upcoming = upcoming.map((node) => (skipped.includes(node.id)
    ? { ...node, status: 'skipped', skippedReason: changes.find((c) => c.nodeId === node.id).reason }
    : node));

  /* ── return ── */
  let back = null;
  const planned = new Set(upcoming.concat(held).filter((n) => n.status !== 'skipped')
    .map((node) => topicKey(resolveNodeTopic(node, all))));
  const lastByTopic = new Map();
  (history || []).forEach((row) => {
    if (!row?.topic || !row.at || !row.total) return;
    const key = topicKey(row.topic);
    const prev = lastByTopic.get(key);
    if (!prev || String(row.at) > String(prev.at)) lastByTopic.set(key, row);
  });
  const due = [...lastByTopic.entries()]
    .filter(([key, row]) => key && key !== topicKey(finishedTopic) && !planned.has(key)
      && Date.parse(now) - Date.parse(row.at) >= RETURN_AFTER_MS && row.pct < RETURN_BELOW_PCT
      && countDetours(live, row.topic) < MAX_DETOURS_PER_TOPIC
      && !all.some((node) => node?.tags?.includes(RETURN_TAG) && topicKey(resolveNodeTopic(node, all)) === key))
    .sort((a, b) => a[1].pct - b[1].pct);
  if (due.length) {
    const [, row] = due[0];
    back = returnNode({ topic: row.topic, phase: finished.phase || 1, t });
    changes.push({ kind: CHANGE.RETURN, nodeId: back.id, topic: row.topic,
      reason: { lastAt: row.at, correct: row.correct, total: row.total } });
  }

  /* ── budget: added minus cut, at most MAX_NET_ADDED ── */
  const added = () => (mixup ? 1 : 0) + (back ? 1 : 0);
  if (back && added() - skipped.length > MAX_NET_ADDED) {
    back = null;
    changes.splice(changes.findIndex((c) => c.kind === CHANGE.RETURN), 1);
  }
  if (mixup && added() - skipped.length > MAX_NET_ADDED) {
    mixup = null;
    changes.splice(changes.findIndex((c) => c.kind === CHANGE.MIXUP), 1);
  }

  /* ── moved: re-rank the open steps and the reserve ── */
  const rerank = (steps, inReserve) => {
    const groups = groupByTopic(steps, all);
    const ranked = rankGroups(groups, topicProgress);
    ranked.forEach((group, to) => {
      const from = groups.indexOf(group);
      if (Math.abs(from - to) >= MOVE_EXPLAIN_MIN) {
        const score = topicScore(group.key, topicProgress);
        changes.push({ kind: CHANGE.MOVED, nodeId: group.nodes[0].id, topic: resolveNodeTopic(group.nodes[0], all),
          inReserve, reason: { direction: to < from ? 'up' : 'down', correct: score.correct, total: score.total } });
      }
    });
    return ranked.flatMap((group) => group.nodes);
  };
  // A step that was already done keeps its place. A review cut above moves
  // with its topic, so the crossed-out row sits next to the quiz that stays.
  const reranked = rerank(upcoming, false);
  let next = 0;
  const segmentOut = segment.map((node) => (isOpen(node) ? reranked[next++] : node));
  const reserveOut = rerank(held, true);

  if (!changes.length) return null;

  const before = live.slice(0, finishedIndex + 1);
  return {
    nodes: before.concat(mixup ? [mixup] : [], segmentOut, back ? [back] : [], tail),
    reserve: reserveOut,
    changes,
  };
};

export default adaptPlan;
