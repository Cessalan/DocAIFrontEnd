/**
 * nodeTopic — what a node is ABOUT, as opposed to what it is called.
 *
 * Inserted nodes are labelled for the student ("Harder: …", "Review: …",
 * "Testing a theory: select-all-that-apply"), and for a long time that label
 * was also the only topic generation ever saw. The one-question pattern
 * experiment made the cost visible: its label names a question FORMAT, not a
 * subject, so retrieval searched her notes for the literal phrase
 * "Testing a theory: select-all-that-apply", landed on the same passage every
 * time, and a Pro student (2026-09-22) got the same perineal-hygiene question
 * nine times with the key flipping between A and B. Every node derived from
 * that one inherited the same non-topic, and labels stacked
 * ("Harder: Harder: Testing a theory: prioritization").
 *
 * So inserted nodes now carry an explicit `topic`, stamped at insertion from
 * the node they came from. For nodes inserted before that field existed, the
 * topic is recovered by walking back to the plan node they descend from —
 * through the `source:` tag when there is one, otherwise the node immediately
 * before it (insertNodeAfterCurrent always splices directly after its parent).
 *
 * Pure on purpose; the container calls it, nothing here reads Firestore.
 */

import { getStepTopicLabel } from './planFormatting';

export const EXPERIMENT_TAG_PREFIX = 'experiment:';
const SOURCE_TAG_PREFIX = 'source:';

const isDerived = (node) =>
  !!node && (node.adaptive === true || String(node.id || '').startsWith('adaptive-'));

/**
 * Planner nodes usually keep their clean subject in tags[0] while the label
 * carries a suffix ("… - Final Check"). But synthesized nodes are tagged with
 * their TYPE (["quiz"], ["lesson"], ["exam", "mixed_types"]), so tags[0] is
 * trusted only when the label is built from it; replaying a real plan through
 * the unguarded version resolved a whole plan's topic to "quiz".
 */
const planNodeTopic = (node) => {
  const label = String(node.label || '');
  const first = Array.isArray(node.tags) ? node.tags[0] : null;
  if (typeof first === 'string' && first.trim()
    && label.toLowerCase().startsWith(first.trim().toLowerCase())) {
    return first.trim();
  }
  return getStepTopicLabel(label).trim();
};

const parentOf = (node, nodes) => {
  const tags = Array.isArray(node.tags) ? node.tags : [];
  const sourceTag = tags.find((tag) => typeof tag === 'string' && tag.startsWith(SOURCE_TAG_PREFIX));
  if (sourceTag) {
    const sourceId = sourceTag.slice(SOURCE_TAG_PREFIX.length);
    const source = nodes.find((n) => n && n.id === sourceId);
    if (source) return source;
  }
  const real = nodes.filter((n) => n && n.type !== 'section_banner');
  const index = real.findIndex((n) => n.id === node.id);
  return index > 0 ? real[index - 1] : null;
};

/**
 * The subject a node should be generated about. Returns '' when none can be
 * established — callers fall back to the label rather than invent one.
 *
 * @param {Object} node
 * @param {Array} nodes - the full plan path, for walking back to the source
 * @returns {string}
 */
export const resolveNodeTopic = (node, nodes = []) => {
  const seen = new Set();
  let current = node;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (typeof current.topic === 'string' && current.topic.trim()) return current.topic.trim();
    if (!isDerived(current)) return planNodeTopic(current);
    current = parentOf(current, Array.isArray(nodes) ? nodes : []);
  }
  return '';
};

/**
 * Skills that already have an experiment node in this plan, whatever its
 * status. A skill is tested once: a second identical experiment proves nothing
 * the first didn't, and offering it after every node is what produced the loop.
 *
 * @param {Array} nodes
 * @returns {string[]}
 */
export const testedSkills = (nodes = []) => {
  const skills = new Set();
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    (Array.isArray(node?.tags) ? node.tags : []).forEach((tag) => {
      if (typeof tag === 'string' && tag.startsWith(EXPERIMENT_TAG_PREFIX)) {
        skills.add(tag.slice(EXPERIMENT_TAG_PREFIX.length));
      }
    });
  });
  return [...skills];
};
