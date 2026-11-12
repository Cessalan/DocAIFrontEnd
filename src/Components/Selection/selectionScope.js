/**
 * What may be highlighted and explained: text the AI wrote, and nothing else.
 *
 * A surface opts in with data-selectable="true". Until 2026-11-11 that was the
 * whole rule, and two things slipped through it: every chat bubble opted in,
 * so a student could highlight her own message and have it "explained" back
 * to her, and a button sitting inside an opted-in surface (an answer option,
 * "Show me how", a retry) could be highlighted like prose.
 *
 * Now a point in the page is explainable only when
 *   - its nearest data-selectable ancestor says "true" ("false" closes a
 *     subtree off again, which is how a user bubble opts out), and
 *   - it is not inside a control. Controls are things she presses or types
 *     into, whoever wrote their label.
 */
const CONTROL_SELECTOR = [
  'button',
  '[role="button"]',
  'summary',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
].join(',');

function elementOf(node) {
  if (!node) return null;
  return node.nodeType === 1 ? node : node.parentElement;
}

/** The opted-in surface this node sits in, or null when it is off limits. */
export function getSelectableAncestor(node) {
  const start = elementOf(node);
  if (!start) return null;
  if (start.closest && start.closest(CONTROL_SELECTOR)) return null;

  let el = start;
  while (el) {
    if (el.dataset && el.dataset.selectable === 'true') return el;
    if (el.dataset && el.dataset.selectable === 'false') return null;
    el = el.parentElement;
  }
  return null;
}

/**
 * The surface a selection belongs to, or null. Both ends must sit in the SAME
 * surface: a drag that starts in an answer and ends in her own message, or on
 * a button, is not a selection of AI text.
 */
export function selectionSurface(range) {
  if (!range) return null;
  const startAnc = getSelectableAncestor(range.startContainer);
  if (!startAnc) return null;
  return getSelectableAncestor(range.endContainer) === startAnc ? startAnc : null;
}
