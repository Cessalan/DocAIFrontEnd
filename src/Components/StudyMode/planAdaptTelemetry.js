/**
 * planAdaptTelemetry — what the adaptive plan records, so it can be judged.
 *
 * ADAPTIVE_PLAN_IMPLEMENTATION.md sets the bar for the feature: proposals
 * accepted over half the time, cut reviews restored under 15%, and a better
 * score on a concept after its mix-up lesson. None of that is readable from
 * the plan itself: a declined proposal leaves only `lastAdaptation`, which the
 * next proposal overwrites, and a step's adaptive origin fades once a later
 * change clears its `adaptChange` stamp. So each moment writes one flat
 * `funnelEvents` row (also forwarded to Clarity and PostHog).
 *
 * Every row carries `fromNodeId`, the quiz the change came from. That is the
 * join: proposed → accepted/declined → adapted step started/completed → the
 * scored step after a mix-up, with the source quiz's own score on the
 * proposal row as the "before".
 *
 * Pure: builds props, never writes. Counts and ids only, never her chosen
 * option text: these rows leave Firestore for third-party analytics.
 */

import { resolveNodeTopic } from './nodeTopic';
import { topicKey } from './topicJourneyModel';

const SCORED_TYPES = ['quiz', 'exam'];
const MIXUP_PREFIX = 'adaptive-mixup-';
const RETURN_PREFIX = 'adaptive-return-';

/** How many of each kind, e.g. { mixup: 1, skip: 2 }, plus a sorted list. */
const countKinds = (changes = []) => {
  const kinds = {};
  changes.forEach((change) => {
    if (change?.kind) kinds[change.kind] = (kinds[change.kind] || 0) + 1;
  });
  return { kinds, kindList: Object.keys(kinds).sort().join(',') };
};

/** First-attempt score of a finished quiz: { correct, total, pct } or nulls. */
export const firstAttemptScore = (statuses = {}) => {
  const values = Object.values(statuses || {}).filter((s) => s === 'correct' || s === 'incorrect');
  if (!values.length) return { correct: null, total: null, pct: null };
  const correct = values.filter((s) => s === 'correct').length;
  return { correct, total: values.length, pct: Math.round((correct / values.length) * 100) };
};

/**
 * Which adaptive change made this step, or null for a planner step. Reads the
 * durable markers (id prefix, `adaptedFrom`, `skippedReason`) before the
 * `adaptChange` stamp, which a later proposal clears.
 */
export const adaptedKind = (node) => {
  if (!node) return null;
  const id = String(node.id || '');
  if (id.startsWith(MIXUP_PREFIX)) return 'mixup';
  if (id.startsWith(RETURN_PREFIX)) return 'return';
  if (node.adaptedFrom) return 'format';
  if (node.skippedReason) return 'skip';
  return node.adaptChange?.kind || null;
};

/** The quiz an adapted step came from, when it can be told. */
const sourceOf = (node) => {
  if (node?.reviewReason?.source === 'node_result') return node.reviewReason.fromNodeId || null;
  const id = String(node?.id || '');
  return id.startsWith(MIXUP_PREFIX) ? id.slice(MIXUP_PREFIX.length) : null;
};

/** Row for a proposal shown, accepted, declined or refused as stale. */
export const proposalProps = ({ chatId, fromNodeId, proposal, score } = {}) => {
  const changes = proposal?.changes || [];
  return {
    chatId: chatId || null,
    fromNodeId: fromNodeId || null,
    changeCount: changes.length,
    ...countKinds(changes),
    reserveChanges: changes.filter((c) => c?.inReserve).length,
    fromCorrect: score?.correct ?? null,
    fromTotal: score?.total ?? null,
    fromPct: score?.pct ?? null,
  };
};

/** Row for an adapted step started, completed or restored; null for a planner step. */
export const adaptedStepProps = ({ chatId, node }) => {
  const kind = adaptedKind(node);
  if (!kind) return null;
  return {
    chatId: chatId || null,
    nodeId: node.id,
    adaptKind: kind,
    nodeType: node.type || null,
    fromNodeId: sourceOf(node),
  };
};

/**
 * The mix-up lesson a just-finished scored step follows up, or null.
 *
 * Walks back from the finished step over finished steps. The first scored
 * step after a mix-up lesson on the same topic is its follow-up; a scored step
 * met first means the mix-up was already followed up, and a different topic
 * means it isn't this lesson's test.
 */
export const mixupFollowUp = (nodes = [], finishedNodeId) => {
  const path = (nodes || []).filter((node) => node && node.type !== 'section_banner');
  const index = path.findIndex((node) => node.id === finishedNodeId);
  const finished = path[index];
  if (!finished || !SCORED_TYPES.includes(finished.type)) return null;
  const topic = topicKey(resolveNodeTopic(finished, path));
  for (let i = index - 1; i >= 0; i -= 1) {
    const node = path[i];
    if (node.status === 'skipped') continue;
    if (adaptedKind(node) === 'mixup') {
      if (!topic || topicKey(resolveNodeTopic(node, path)) !== topic) return null;
      return { mixupNodeId: node.id, fromNodeId: sourceOf(node), followUpNodeId: finished.id, followUpType: finished.type };
    }
    if (SCORED_TYPES.includes(node.type)) return null;
  }
  return null;
};

export default proposalProps;
