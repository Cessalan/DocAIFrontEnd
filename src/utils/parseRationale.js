/**
 * Parses rationale HTML of the form:
 *   <b>Option X is correct</b> because [text]<br><br>
 *   <b>Option A is incorrect</b> because [text]<br>...
 *
 * Also handles legacy question bank that uses <strong> instead of <b>.
 *
 * Returns an array of { letter, status, html } items, or [] if the
 * shape doesn't match (caller should fall back to raw HTML rendering).
 */

const HEADER_TEXT_RE = /^\s*Option\s+([A-Fa-f])\s+is\s+(correct|incorrect)\s*$/i;

export function parseRationaleOptions(html) {
  if (!html || typeof html !== 'string') return [];

  let doc;
  try {
    doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  } catch {
    return [];
  }
  const root = doc.body && doc.body.firstElementChild;
  if (!root) return [];

  // Find every <b>/<strong> whose text content is exactly an "Option X is (in)correct" header.
  const markers = Array.from(root.querySelectorAll('b, strong')).filter((el) => {
    return HEADER_TEXT_RE.test(el.textContent || '');
  });

  if (markers.length === 0) return [];

  // For each marker, collect the HTML of nodes that follow it (at the same parent level)
  // until we hit the next marker.
  const items = markers.map((marker, idx) => {
    const m = (marker.textContent || '').match(HEADER_TEXT_RE);
    const letter = m[1].toUpperCase();
    const status = m[2].toLowerCase();
    const stop = markers[idx + 1] || null;

    let body = '';
    let node = marker.nextSibling;
    while (node && node !== stop) {
      // If we encounter the next marker nested inside a sibling, stop.
      if (stop && node.nodeType === 1 && node.contains && node.contains(stop)) break;

      if (node.nodeType === 3) {
        body += node.textContent;
      } else if (node.nodeType === 1) {
        body += node.outerHTML;
      }
      node = node.nextSibling;
    }

    body = body
      .replace(/^\s*(?:<br\s*\/?>\s*)+/i, '')
      .replace(/(?:<br\s*\/?>\s*)+\s*$/i, '')
      .replace(/^\s*because\s+/i, '')
      .trim();

    return { letter, status, html: body };
  });

  return items;
}

export default parseRationaleOptions;
