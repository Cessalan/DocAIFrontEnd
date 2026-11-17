/* ══════════════════════════════════════════════════════════════════════
   TOPIC SWITCH — she picks the topic, the plan makes room for it.

   WHY THIS EXISTS (2026-11-16)
   ────────────────────────────
   A Pro student with two exams that week did 11 steps on one topic, typed
   "i have other lessons to learn" into the request box, got another lesson on
   the same topic, and cancelled two days after paying: "i cant to be able to
   study other lessons instead of being stuck on one". It was the third exit
   survey saying so. The detour cap (nodeReadout) and the topic path
   (topicJourneyModel) had already cut the drill loop, but 43% of plans with
   four or more finished steps still never left their first topic: the plan
   decided when she moved, and every exit was something it had to offer her.

   WHAT A SWITCH DOES
   ──────────────────
   The plan advances in list order everywhere (completeNodeAndAdvance, the
   dated schedule, today's mission), so a switch does not jump around the
   list. It MOVES the picked topic's unfinished steps to where she is now:

   * between steps (she just finished one): that step is closed as done and
     the picked topic's steps go right after it;
   * on an unfinished step: the picked topic's steps go right before it. The
     step she left is not lost, it is what comes after the picked topic;
   * steps still held in reserve come out of reserve with the rest;
   * everything else keeps its order, and nothing is generated or deleted.

   ANY STEP, NOT ONLY ANY TOPIC (same day)
   ──────────────────────────────────────
   "I want the user to have flexibility whether they want to do the quick
   review, quiz or mini test, instead of being forced through a path." With
   `targetNodeId` the same move is made for ONE step: it comes to where she
   is and becomes the active step, and everything else keeps its order. The
   plan is still a list; she just decides what is next on it.

   Tonight's plan has rounds, not topics, and is never switched.

   Pure: StudySessionService.switchStudyTopic runs this on the saved plan and
   writes the result in one update.
   ══════════════════════════════════════════════════════════════════════ */

import { resolveNodeTopic } from './nodeTopic';
import { topicKey } from './topicJourneyModel';
import { isRealNode } from './firstBlock';

const isTonight = (node) => Array.isArray(node?.tags)
  && node.tags.some((tag) => typeof tag === 'string' && tag.startsWith('tonight'));

const isOpen = (node) => isRealNode(node) && node.status !== 'done' && node.status !== 'skipped';

const isDerived = (node) => node.adaptive === true || String(node.id || '').startsWith('adaptive-');

/** Each node's topic, resolved once against the plan as it stands. */
const topicsOf = (all) => {
  const names = new Map();
  all.forEach((node) => { if (isRealNode(node)) names.set(node, resolveNodeTopic(node, all)); });
  return names;
};

/** The step she is on, and whether she has just finished it (the transition screen). */
const whereSheIs = (nodes, activeNodeId, finishedNodeId) => {
  const current = nodes.find((node) => node && node.id === activeNodeId && isRealNode(node)) || null;
  const justFinished = !!current && !!finishedNodeId && current.id === finishedNodeId && current.status !== 'done';
  return { current, justFinished, onOpenStep: !!current && !justFinished && isOpen(current) };
};

/**
 * The topics she can switch to: every topic with a step left, except the one
 * she is on, in plan order.
 *
 * @returns {Array<{key, topic, stepsLeft, stepsDone, steps}>} `steps` are the steps left, in plan order
 */
export function switchOptions({ nodes = [], reserve = [], activeNodeId = null, finishedNodeId = null } = {}) {
  const live = Array.isArray(nodes) ? nodes : [];
  const held = Array.isArray(reserve) ? reserve : [];
  const all = live.concat(held);
  if (all.some(isTonight)) return [];
  const names = topicsOf(all);
  const { current, justFinished, onOpenStep } = whereSheIs(live, activeNodeId, finishedNodeId);
  const currentKey = onOpenStep ? topicKey(names.get(current)) : '';

  const rows = [];
  const byKey = new Map();
  all.forEach((node) => {
    if (!isRealNode(node) || node.status === 'skipped') return;
    const name = names.get(node);
    const key = topicKey(name);
    if (!key) return;
    if (!byKey.has(key)) {
      const row = { key, topic: name, stepsLeft: 0, stepsDone: 0, steps: [] };
      byKey.set(key, row);
      rows.push(row);
    }
    const row = byKey.get(key);
    const finished = node.status === 'done' || (justFinished && node === current);
    if (finished) row.stepsDone += 1; else { row.stepsLeft += 1; row.steps.push(node); }
  });
  return rows.filter((row) => row.stepsLeft > 0 && row.key !== currentKey);
}

/**
 * Where each switch lives on the full plan (StudyPlanOverview). The plan list
 * already shows her topics as sections, so the switch sits ON the section it
 * would open instead of in a second list of the same names (2026-11-16: "we
 * should combine the two").
 *
 * A topic's switch goes on its first section that has not been started;
 * topics with no such section (still held in reserve) are returned as
 * `later`, to be listed after the sections.
 *
 * @param {Array} sections  [{id, status, steps:[node]}] from buildSections
 * @param {Array} options   switchOptions(...)
 * @param {Array} allNodes  live nodes followed by reserve nodes
 * @returns {{bySection: Object<string, Object>, later: Array}}
 */
export function sectionSwitchTargets(sections = [], options = [], allNodes = []) {
  const byKey = new Map((options || []).map((option) => [option.key, option]));
  const bySection = {};
  const placed = new Set();
  (sections || []).forEach((section) => {
    if (!section || section.status !== 'locked' || !section.steps?.length) return;
    const key = topicKey(resolveNodeTopic(section.steps[0], allNodes));
    if (!byKey.has(key) || placed.has(key)) return;
    bySection[section.id] = byKey.get(key);
    placed.add(key);
  });
  return { bySection, later: (options || []).filter((option) => !placed.has(option.key)) };
}

/**
 * The plan after she switches to `targetKey`, or null when there is nothing
 * to switch to (unknown topic, no step left on it, already on it, Tonight's plan).
 *
 * @param {Object} args
 * @param {Array}  args.nodes          study.path.nodes
 * @param {Array}  args.reserve        study.reserve.nodes
 * @param {string} args.activeNodeId   study.path.activeNodeId
 * @param {string} [args.finishedNodeId] the active step, when she has finished it but it is not saved as done
 * @param {string} args.targetKey      topicKey of the topic she picked
 * @param {string} [args.targetNodeId] one step she picked instead of a whole topic
 * @param {string} [args.now]          ISO time, for the finished step's completedAt
 * @returns {{nodes, reserve, activeNodeId, topic, movedCount, fromReserveCount, closedNodeId}|null}
 */
export function planTopicSwitch({ nodes = [], reserve = [], activeNodeId = null, finishedNodeId = null,
  targetKey = '', targetNodeId = null, now = new Date().toISOString() } = {}) {
  const live = Array.isArray(nodes) ? nodes : [];
  const held = Array.isArray(reserve) ? reserve : [];
  const all = live.concat(held);
  const target = topicKey(targetKey);
  if ((!target && !targetNodeId) || all.some(isTonight)) return null;

  const names = topicsOf(all);
  const keyOf = (node) => topicKey(names.get(node));
  const { current, justFinished, onOpenStep } = whereSheIs(live, activeNodeId, finishedNodeId);
  if (onOpenStep && (targetNodeId ? current.id === targetNodeId : keyOf(current) === target)) return null;

  const wanted = (node) => isOpen(node) && !(justFinished && node === current)
    && (targetNodeId ? node.id === targetNodeId : keyOf(node) === target);
  const fromLive = live.filter(wanted);
  const fromReserve = held.filter(wanted);
  const picked = fromLive.concat(fromReserve);
  if (picked.length === 0) return null;

  // A derived step with no topic of its own finds it by walking back to the
  // step before it (nodeTopic). Moving steps changes who is before whom, so
  // the answer is written down first.
  const withTopic = (node) => {
    const name = names.get(node);
    return isRealNode(node) && name && !node.topic && (isDerived(node) || picked.includes(node))
      ? { ...node, topic: name } : node;
  };

  const moved = picked.map((node, index) => ({ ...withTopic(node), status: index === 0 ? 'active' : 'locked' }));
  const rest = live.filter((node) => !fromLive.includes(node)).map((node) => {
    if (node === current && justFinished) return { ...withTopic(node), status: 'done', completedAt: node.completedAt || now };
    if (node === current && onOpenStep) return { ...withTopic(node), status: 'locked' };
    // Only one step is ever active.
    if (node.status === 'active') return { ...withTopic(node), status: 'locked' };
    return withTopic(node);
  });

  const anchor = current ? rest.findIndex((node) => node.id === current.id) : -1;
  const at = anchor === -1 ? rest.length : (justFinished || !onOpenStep ? anchor + 1 : anchor);
  const next = rest.slice(0, at).concat(moved, rest.slice(at));

  return {
    nodes: next,
    reserve: held.filter((node) => !fromReserve.includes(node)),
    activeNodeId: moved[0].id,
    topic: names.get(picked[0]),
    movedCount: moved.length,
    fromReserveCount: fromReserve.length,
    closedNodeId: justFinished ? current.id : null,
  };
}
