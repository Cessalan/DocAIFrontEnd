/* ══════════════════════════════════════════════════════════════════════
   TOPIC JOURNEY — where she is across her plan's topics, Tonight-style.

   WHY THIS EXISTS (2026-10-15)
   ────────────────────────────
   60% of active study plans never left their first topic (production read,
   2026-10-13). Part of that was a loop, fixed in nodeReadout's detour cap.
   Part of it was that nothing on screen said there WAS a topic 2: the plan
   showed steps, not a path, and a readiness percentage that moved 2 points a
   step. Tonight's plan shows each round with an honest "earlier -> now" and
   the next one; this does the same with topics: the ones she finished with
   their result, the one she is on, and how many are left.

   HONESTY RULES (same as tonightPlanModel)
   ────────────────────────────────────────
   * Topics are counted over the WHOLE plan, including the part held in
     reserve, so "topic 2 of 6" never jumps when the next block is added.
   * Extra (adaptive) steps and Tonight's rounds are not topics.
   * "Earlier -> now" only when both sides have answers enough to compare
     (MIN_CLAIM_BEFORE / MIN_CLAIM_AFTER); a finished topic without that
     says it is done and nothing more.
   * A topic's scores are matched by its key only. A score that cannot be
     matched to the topic is not shown, never borrowed from a neighbour.
   ══════════════════════════════════════════════════════════════════════ */

import { resolveNodeTopic } from './nodeTopic';
import { MIN_CLAIM_BEFORE, MIN_CLAIM_AFTER } from './tonightPlanModel';

export const STATUS = { DONE: 'done', CURRENT: 'current', UPCOMING: 'upcoming' };

export const topicKey = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const isPlanStep = (node) => node && node.type !== 'section_banner' && node.adaptive !== true
  && !(Array.isArray(node.tags) && node.tags.some((tag) => typeof tag === 'string' && tag.startsWith('tonight')));

const score = (row) => (row && row.answered > 0 ? { correct: row.correct || 0, total: row.answered } : null);

/**
 * The plan's topics in order, each with its status and its before/after.
 *
 * @param {Object} args
 * @param {Array} args.nodes         study.path.nodes
 * @param {Array} args.reserveNodes  study.reserve.nodes (planned, not yet live)
 * @param {Object} args.topicProgress {baseline: {key: {correct, answered}}, latest: {...}}
 * @param {string} args.activeNodeId
 * @returns {{topics: Array, total: number, done: number, currentIndex: number}}
 */
export function topicJourney({ nodes = [], reserveNodes = [], topicProgress = null, activeNodeId = null,
  finishedNodeId = null } = {}) {
  const live = Array.isArray(nodes) ? nodes : [];
  const reserve = Array.isArray(reserveNodes) ? reserveNodes : [];
  const all = live.concat(reserve);
  const rows = [];
  const byKey = new Map();
  const activeNode = live.find((n) => n && n.id === activeNodeId);
  const activeTopic = activeNode && activeNode.id !== finishedNodeId ? topicKey(resolveNodeTopic(activeNode, all)) : '';

  all.forEach((node) => {
    if (!isPlanStep(node)) return;
    const name = resolveNodeTopic(node, all);
    const key = topicKey(name);
    if (!key) return;
    if (!byKey.has(key)) {
      const row = { key, topic: name, steps: 0, done: 0, inReserve: 0 };
      byKey.set(key, row);
      rows.push(row);
    }
    const row = byKey.get(key);
    row.steps += 1;
    // The step on the transition screen is finished even if the plan has not
    // saved it as done yet.
    if (reserve.includes(node)) row.inReserve += 1;
    else if (node.status === 'done' || (finishedNodeId && node.id === finishedNodeId)) row.done += 1;
  });

  let currentSet = false;
  const topics = rows.map((row) => {
    const finished = row.steps > 0 && row.done === row.steps;
    let status = finished ? STATUS.DONE : STATUS.UPCOMING;
    if (!finished && !currentSet && (row.key === activeTopic || !activeTopic)) {
      status = STATUS.CURRENT;
      currentSet = true;
    }
    const before = score(topicProgress?.baseline?.[row.key]);
    const after = score(topicProgress?.latest?.[row.key]);
    return { key: row.key, topic: row.topic, status, before, after,
      comparable: !!before && !!after && before.total >= MIN_CLAIM_BEFORE && after.total >= MIN_CLAIM_AFTER };
  });
  // No step is active (between steps): the first unfinished topic is current.
  if (!currentSet) {
    const first = topics.find((t) => t.status !== STATUS.DONE);
    if (first) first.status = STATUS.CURRENT;
  }
  const currentIndex = topics.findIndex((t) => t.status === STATUS.CURRENT);
  return { topics, total: topics.length, done: topics.filter((t) => t.status === STATUS.DONE).length,
    currentIndex: currentIndex === -1 ? topics.length : currentIndex };
}

/**
 * What to say after a step when the NEXT step starts a new topic, or null.
 *
 * Only at that moment, so the line means something: "Heart failure done.
 * Topic 2 of 6 next: Coronary artery disease." `fromTopic` is the topic of
 * the step just finished; the journey is computed with that step counted done.
 */
export function topicHandoff(journey, fromTopic, nextNode, allNodes = []) {
  if (!journey || !nextNode) return null;
  const fromKey = topicKey(fromTopic);
  const nextKey = topicKey(resolveNodeTopic(nextNode, allNodes));
  if (!fromKey || !nextKey || fromKey === nextKey) return null;
  const from = journey.topics.find((t) => t.key === fromKey);
  const nextIndex = journey.topics.findIndex((t) => t.key === nextKey);
  if (!from || from.status !== STATUS.DONE || nextIndex === -1) return null;
  return { done: from, next: journey.topics[nextIndex], nextNumber: nextIndex + 1, total: journey.total };
}
