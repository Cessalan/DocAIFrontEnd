/* ══════════════════════════════════════════════════════════════════════
   LIGHT READOUT — what the tutor can honestly say about a node with no
   right or wrong in it.

   Lessons, audio explanations and concept maps are most of a plan, and
   until now they ended on a green tick and a restatement of the node
   label: "You finished the lesson on Afterload. Up next: quiz on Preload."
   Both sentences were writable before she arrived. A student paying for
   insight into her own studying got insight on her quizzes and inventory
   on everything else.

   There is no score here to diagnose, and the obvious fix — praise — is
   the one thing this codebase refuses everywhere else. Congratulating
   someone for reading a page is how a product teaches her that its
   warmth is automatic and therefore worthless.

   What IS honest is CONNECTION: what this node covered, set against what
   her record says she keeps getting wrong. That claim is worth reading,
   and it is only worth reading because it can come out empty — when the
   lesson has nothing to do with her misses, the note says so instead.

   THIS MODULE'S ONE JOB is the input to that claim: what did the node
   actually cover? Getting it wrong in the generous direction is the
   failure that matters. If we tell the backend a concept map covered
   twelve concepts when she opened four, the note will thank her for
   studying eight things she never saw, and she will know.

   So: only what she actually reached.
   ══════════════════════════════════════════════════════════════════════ */

/** Longest list we will send. Beyond this the note stops getting better. */
export const COVERED_CAP = 6;

/** Trim, drop empties, dedupe case-insensitively, cap. Order preserved. */
const clean = (list) => {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.length > 120 ? `${s.slice(0, 119)}…` : s);
    if (out.length >= COVERED_CAP) break;
  }
  return out;
};

/**
 * What the student actually worked through in an unscored node.
 *
 * @param {Object}  args
 * @param {Object}  args.node             the completed node ({ type, label })
 * @param {Object}  args.content          the generated content that was shown
 * @param {Object} [args.mindmapProgress] { visitedNodeIds, totalNodes }
 * @returns {string[]} concept labels, most specific first, capped
 */
export const collectCovered = ({ node, content, mindmapProgress } = {}) => {
  const type = node && node.type;

  if (type === 'lesson') {
    /* Two shapes in the wild. The multi-page one is deliberately one
       concept per page, so the page titles ARE the concept list — better
       evidence than anything we could pull out of the prose. Legacy
       lessons carry keyPoints instead. */
    const pages = content && Array.isArray(content.pages) ? content.pages : null;
    if (pages && pages.length) {
      const titles = clean(pages.map((p) => p && p.title));
      // A streaming lesson can arrive with untitled pages; fall back to the
      // lesson title rather than sending an empty list that reads as "we
      // don't know what this was about".
      if (titles.length) return titles;
    }
    const keyPoints = content && Array.isArray(content.keyPoints) ? content.keyPoints : [];
    return clean(keyPoints.length ? keyPoints : [content && content.title, node.label]);
  }

  if (type === 'mindmap') {
    /* VISITED ONLY. A map she opened and left after four nodes covered
       four nodes. Sending the whole map would have the note credit her
       for concepts she never saw — the exact false claim this file
       exists to prevent, and the one she is most able to catch. */
    const visited = (mindmapProgress && mindmapProgress.visitedNodeIds) || [];
    const nodes = (content && Array.isArray(content.nodes) && content.nodes)
      || (content && content.mindmapData && content.mindmapData.nodes)
      || [];
    if (visited.length && nodes.length) {
      const byId = new Map(nodes.map((n) => [n && n.id, n && n.label]));
      const labels = clean(visited.map((id) => byId.get(id)));
      if (labels.length) return labels;
    }
    // No id→label map available: say nothing about specifics rather than
    // guessing at them. The note falls back to the topic, which is true.
    return clean([node.label]);
  }

  if (type === 'audio') {
    return clean([content && content.topic, node.label]);
  }

  return clean([node && node.label]);
};

/**
 * Did she opt out of this node rather than work through it?
 *
 * Kept here so the backend's "skipped" mode and the screen's own copy read
 * the same signal — a note that narrates studying she skipped is the
 * fastest way to prove nobody is watching.
 *
 * A concept map counts as skipped when she saw almost none of it; the
 * threshold is deliberately low, because leaving a map early is normal
 * browsing behaviour and not an opt-out.
 */
export const MINDMAP_SKIM_RATIO = 0.25;

export const wasSkipped = ({ node, audioSkipped, mindmapProgress } = {}) => {
  const type = node && node.type;
  if (type === 'audio') return !!audioSkipped;
  if (type === 'mindmap') {
    const total = (mindmapProgress && mindmapProgress.totalNodes) || 0;
    const visited = ((mindmapProgress && mindmapProgress.visitedNodeIds) || []).length;
    if (!total) return false;
    return visited / total < MINDMAP_SKIM_RATIO;
  }
  return false;
};

export default collectCovered;
