/**
 * missionArc — groups today's nodes into Learn → Practice → Review.
 *
 * WHY: a mission rendered as rows ("Lesson · Topic", "Quiz · Topic",
 * "Flashcards · Topic") is a list of near-identical strings — inventory. The
 * same nodes grouped into three named beats give the session a SHAPE the
 * student recognises before they commit: I'll learn it, try it, then lock it
 * in. That's the difference between a dashboard and a coach describing a plan.
 *
 * A NOTE ON ORDER
 * ───────────────
 * The chips render in canonical Learn → Practice → Review order, which is not
 * always the literal node order — the default plan unit interleaves
 * (lesson → quiz → audio → flashcard → quiz), so "audio" (Learn) actually
 * comes after the first quiz. The chips are a SUMMARY of what today contains,
 * not a queue: the student always resumes via the single primary CTA, never by
 * picking a chip. Phase status is therefore derived honestly from the nodes
 * inside each phase rather than from position, so nothing claims to be finished
 * that isn't.
 */

import { getNodeEstimate } from './planFormatting';

/** Canonical display order. */
export const ARC_ORDER = ['learn', 'practice', 'review'];

/**
 * Node type → beat. Anything unrecognised is treated as Learn, which is the
 * safe default: it reads as "content you go through" rather than promising a
 * graded exercise that isn't there.
 */
const PHASE_BY_TYPE = {
  lesson: 'learn',
  audio: 'learn',
  mindmap: 'learn',
  quiz: 'practice',
  exam: 'practice',
  flashcard: 'review',
  review: 'review',
};

export const phaseForType = (type) => PHASE_BY_TYPE[type] || 'learn';

/** Icon key used to pick the medallion glyph for a phase. */
const REPRESENTATIVE_TYPE = {
  learn: 'lesson',
  practice: 'quiz',
  review: 'flashcard',
};

/**
 * @param {Array}  missionNodes  today's slice, in plan order
 * @param {string} primaryId     id of the node the CTA will launch
 * @returns {Array} phases present today:
 *   { key, nodes, minutes, remainingMinutes, status: 'done'|'active'|'upcoming', iconType }
 */
export const buildMissionArc = (missionNodes = [], primaryId = null) => {
  const buckets = new Map();

  for (const node of missionNodes) {
    const key = phaseForType(node.type);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(node);
  }

  return ARC_ORDER.filter(key => buckets.has(key)).map(key => {
    const nodes = buckets.get(key);
    const allDone = nodes.every(n => n.status === 'done');
    const hasPrimary = primaryId != null && nodes.some(n => n.id === primaryId);
    return {
      key,
      nodes,
      minutes: nodes.reduce((sum, n) => sum + getNodeEstimate(n.type), 0),
      remainingMinutes: nodes
        .filter(n => n.status !== 'done')
        .reduce((sum, n) => sum + getNodeEstimate(n.type), 0),
      // 'done' only when every node in the beat is finished — with interleaved
      // plans a later beat can be partly done while an earlier one is active,
      // and saying "done" there would be a lie.
      status: allDone ? 'done' : hasPrimary ? 'active' : 'upcoming',
      iconType: REPRESENTATIVE_TYPE[key],
    };
  });
};

export default buildMissionArc;
