/**
 * asciiConceptMap.js
 *
 * The tutor often answers "draw me a concept map" with an ASCII sketch inside a
 * fenced code block — bracketed nodes, pipes and dashes for the branches, and
 * arrows for a pathophysiology flow. Rendered as a code block that lands as
 * unreadable monospace, which is the opposite of what a nursing student asked
 * for.
 *
 * This module reads that sketch back into the same `{ central_topic, nodes,
 * edges }` shape the backend's mindmap tool emits, so MindmapViewer can draw it
 * as a real graph with a PDF export.
 *
 * It is deliberately conservative: anything it cannot confidently read as a
 * diagram returns null, and the caller falls back to the plain code block.
 */

// Node labels are usually bracketed: [Sickle Cell Anemia]
const BRACKET_RE = /\[([^[\]\n]+)\]/g;

// Arrow forms the model mixes freely, longest first so "-->" wins over "->".
const ARROW_SPLIT_RE = /\s*(?:-->|==>|=>|->|→|➔|⟶|⇒)\s*/;
const ARROW_TEST_RE = /(?:-->|==>|=>|->|→|➔|⟶|⇒)/;

// A line of pure box-drawing: connectors, no words.
const CONNECTOR_CHARS_RE = /^[\s|\-_/\\+↓↑│─┌┐└┘├┤┬┴┼*]+$/;
const HAS_CONNECTOR_RE = /[|/\\↓↑│─┬┴┼]|--/;

// The characters that mark "a branch descends here". Dashes are only the
// horizontal spread between siblings, so they are deliberately excluded.
const BRANCH_MARKER_RE = /[|/\\↓│┬┼]/g;

// Bullet detail lines: "- Blood transfusions", "* Hydroxyurea", "• Stroke"
const BULLET_RE = /^\s*[-*•·]\s+(.+)$/;

// Runs of text separated by two or more spaces — how bare (unbracketed) node
// rows are written: "Def   Etiol   Patho   S/Sx"
const RUN_RE = /\S+(?: \S+)*/g;

// Fence languages that are real code and must never be touched.
const CODE_LANGUAGES = new Set([
  'js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript', 'json', 'python', 'py',
  'java', 'c', 'cpp', 'csharp', 'cs', 'go', 'rust', 'rb', 'ruby', 'php', 'sql',
  'sh', 'bash', 'shell', 'zsh', 'yaml', 'yml', 'toml', 'xml', 'html', 'css',
  'scss', 'diff', 'dockerfile', 'ini', 'r', 'swift', 'kotlin'
]);

// Lines that give away actual source code rather than a drawing. Each pattern
// needs its syntax, not just the keyword: nursing text says "class of drugs"
// and a diagram row can start with "Def".
const CODE_SMELL_RE = /\bfunction\s+\w+\s*\(|\b(?:const|let|var)\s+\w+\s*=|\bimport\s+[\w{*]|\bexport\s+(?:default|const|function)|\bclass\s+\w+\s*[:({]|\bdef\s+\w+\s*\(|=>\s*\{|<\/[a-z]|[;{}]\s*$/m;

const MIN_NODES = 3;
const MIN_EDGES = 2;
const MIN_UNDERSTOOD_RATIO = 0.5;
const MAX_LABEL_LENGTH = 80;

const normalizeLabel = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/gi, ' ')
    .trim();

/** Strip the decoration around a captured label: brackets, bullets, trailing colons. */
const cleanLabel = (raw) =>
  String(raw)
    .replace(/^[\s|/\\+-]*/, '')
    .replace(/[\s|/\\+]*$/, '')
    .replace(/^\[|\]$/g, '')
    .replace(/[:.,]+$/, '')
    .trim();

const isBlank = (line) => !line.trim();

const isConnectorLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return CONNECTOR_CHARS_RE.test(trimmed) && HAS_CONNECTOR_RE.test(trimmed);
};

/** Bracketed node tokens on a line, with the column each one sits at. */
const bracketTokens = (line) => {
  const tokens = [];
  BRACKET_RE.lastIndex = 0;
  let match;
  while ((match = BRACKET_RE.exec(line)) !== null) {
    const label = cleanLabel(match[1]);
    if (!label || label.length > MAX_LABEL_LENGTH) continue;
    tokens.push({
      label,
      start: match.index,
      end: match.index + match[0].length,
      center: match.index + match[0].length / 2
    });
  }
  return tokens;
};

/**
 * Bare node tokens — only trusted directly under a connector line, where a row
 * like "Def   Etiol   Patho" can only be a row of boxes.
 */
const bareTokens = (line) => {
  const tokens = [];
  RUN_RE.lastIndex = 0;
  let match;
  while ((match = RUN_RE.exec(line)) !== null) {
    const label = cleanLabel(match[0]);
    if (!label || label.length > MAX_LABEL_LENGTH) continue;
    tokens.push({
      label,
      start: match.index,
      end: match.index + match[0].length,
      center: match.index + match[0].length / 2
    });
  }
  return tokens;
};

/** Split "Gene mutation → HbS → Sickling" into its steps. */
const arrowChain = (line) => {
  if (!ARROW_TEST_RE.test(line)) return null;
  const parts = line
    .split(ARROW_SPLIT_RE)
    .map(cleanLabel)
    .filter((part) => part && part.length <= MAX_LABEL_LENGTH);
  return parts.length >= 2 ? parts : null;
};

/**
 * Read an ASCII diagram into mindmap data.
 *
 * @param {string} raw       Text inside the fence.
 * @param {Object} [options]
 * @param {string} [options.language] Fence language, if any.
 * @param {string} [options.title]    Fallback central topic.
 * @returns {{central_topic: string, nodes: Array, edges: Array}|null}
 */
export function parseAsciiConceptMap(raw, options = {}) {
  if (typeof raw !== 'string') return null;

  const language = (options.language || '').toLowerCase();
  if (CODE_LANGUAGES.has(language)) return null;

  const text = raw.replace(/\r/g, '');
  if (!text.trim()) return null;
  if (CODE_SMELL_RE.test(text)) return null;

  const lines = text.split('\n');

  const nodes = [];
  const edges = [];
  const byLabel = new Map();
  let idSeq = 0;

  const childrenOf = (id) => nodes.filter((n) => n.parent === id);

  /** Guard against the reuse-by-label path closing a loop (A → B → A). */
  const isDescendant = (ancestorId, candidateId) => {
    const stack = [ancestorId];
    const seen = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (current === candidateId) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      childrenOf(current).forEach((child) => stack.push(child.id));
    }
    return false;
  };

  const attach = (node, parent, edgeLabel) => {
    if (!parent || parent.id === node.id) return;
    if (node.parent) return;
    if (isDescendant(node.id, parent.id)) return;
    node.parent = parent.id;
    edges.push({ source: parent.id, target: node.id, label: edgeLabel || '' });
  };

  /**
   * Look up a label, or create it. A repeated label is the same concept — the
   * model writes section headers twice (once in the branch row, once above its
   * bullets) and that must not become two boxes.
   */
  const makeNode = (label, parent, edgeLabel) => {
    const key = normalizeLabel(label);
    if (!key) return null;

    const existing = byLabel.get(key);
    if (existing) {
      attach(existing, parent, edgeLabel);
      return existing;
    }

    const node = {
      id: `n${idSeq++}`,
      label,
      type: 'sub',
      parent: null,
      children: [],
      details: []
    };
    nodes.push(node);
    byLabel.set(key, node);
    attach(node, parent, edgeLabel);
    return node;
  };

  // --- parse state -----------------------------------------------------
  let prevRow = null;        // tokens of the last node row, for column matching
  let sectionNode = null;    // last single-node row: where bullets belong
  let bullets = [];          // pending bullet text under sectionNode
  let bulletsAreFlow = false; // arrows between bullets => chain, not a list
  let connectorBlock = [];   // connector lines seen since the last node row
  let understood = 0;
  let considered = 0;

  /** The node in the row above that sits at a given column. */
  const nodeAtColumn = (column) => {
    if (!prevRow || prevRow.length === 0) return null;
    if (prevRow.length === 1) return prevRow[0].node;

    // A box the column falls inside beats a box that is merely closest.
    const covering = prevRow.find((entry) => column >= entry.start && column <= entry.end);
    if (covering) return covering.node;

    let best = prevRow[0];
    let bestDistance = Math.abs(prevRow[0].center - column);
    for (const entry of prevRow) {
      const distance = Math.abs(entry.center - column);
      if (distance < bestDistance) {
        best = entry;
        bestDistance = distance;
      }
    }
    return best.node;
  };

  const pickParent = (token) => nodeAtColumn(token.center);

  /**
   * These diagrams branch in a fixed shape:
   *
   *     [Management]        <- the row above
   *          |              <- ONE pipe: this is the box that branches
   *     -----------         <- the spread
   *     |    |    |         <- one pipe per child
   *     [A] [B] [C]
   *
   * So a lone pipe under a multi-box row names the parent for the whole next
   * row, which is far more reliable than matching each child by column.
   */
  const rowParentFromConnectors = () => {
    for (const line of connectorBlock) {
      BRANCH_MARKER_RE.lastIndex = 0;
      const columns = [];
      let match;
      while ((match = BRANCH_MARKER_RE.exec(line)) !== null) columns.push(match.index);
      if (columns.length === 0) continue;      // a spread line, keep looking
      if (columns.length === 1) return nodeAtColumn(columns[0]);
      return null;                             // one pipe per child: match individually
    }
    return null;
  };

  const flushBullets = () => {
    if (!bullets.length) {
      bulletsAreFlow = false;
      return;
    }
    const owner = sectionNode;
    const pending = bullets;
    bullets = [];

    if (!owner) {
      bulletsAreFlow = false;
      return;
    }

    if (bulletsAreFlow) {
      // "mutation ↓ HbS ↓ sickling" is a pathophysiology flow: chain it into
      // real nodes so the arrows survive into the drawing.
      let parent = owner;
      pending.forEach((text) => {
        const step = makeNode(text, parent);
        if (step) parent = step;
      });
    } else {
      pending.forEach((text) => owner.details.push(text));
    }
    bulletsAreFlow = false;
  };

  const startRow = (rowNodes, tokens) => {
    prevRow = rowNodes
      .map((node, index) =>
        node
          ? {
              node,
              start: tokens[index].start,
              end: tokens[index].end,
              center: tokens[index].center
            }
          : null
      )
      .filter(Boolean);
    if (prevRow.length === 1) sectionNode = prevRow[0].node;
    connectorBlock = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line)) continue;
    considered++;

    // 1. Pure connector line — carries no label, but a "↓" between bullets
    //    tells us the bullets are a sequence rather than a list.
    if (isConnectorLine(line)) {
      if (bullets.length && /[↓↑]|--?>/.test(line)) bulletsAreFlow = true;
      connectorBlock.push(line);
      understood++;
      continue;
    }

    // 2. Bracketed node row.
    const brackets = bracketTokens(line);
    if (brackets.length > 0) {
      flushBullets();
      const rowParent = rowParentFromConnectors();
      const rowNodes = brackets.map((token) => makeNode(token.label, rowParent || pickParent(token)));
      startRow(rowNodes, brackets);
      understood++;

      // A row can also carry a trailing flow: "[Patho] Mutation → HbS → Pain"
      const remainder = line.replace(BRACKET_RE, ' ');
      const chain = arrowChain(remainder);
      if (chain && prevRow.length === 1) {
        let parent = prevRow[0].node;
        chain.forEach((step) => {
          const node = makeNode(step, parent);
          if (node) parent = node;
        });
      }
      continue;
    }

    // 3. Bullet detail.
    const bullet = line.match(BULLET_RE);
    if (bullet) {
      const chain = arrowChain(bullet[1]);
      if (chain) {
        // A whole flow written on one bullet.
        flushBullets();
        let parent = sectionNode;
        chain.forEach((step) => {
          const node = makeNode(step, parent);
          if (node) parent = node;
        });
      } else if (sectionNode) {
        const text = cleanLabel(bullet[1]);
        if (text) bullets.push(text);
      }
      // Pipes only describe a branch while they sit between two rows; once
      // prose or bullets intervene they are stale.
      connectorBlock = [];
      understood++;
      continue;
    }

    // 4. Free-standing arrow flow. It hangs off whatever the pipe above it
    //    pointed at — that is how the pathophysiology chain is drawn under its
    //    branch — and falls back to the section we are inside.
    const chain = arrowChain(line);
    if (chain) {
      flushBullets();
      let parent =
        rowParentFromConnectors() ||
        sectionNode ||
        (prevRow && prevRow.length === 1 ? prevRow[0].node : null);
      chain.forEach((step) => {
        const node = makeNode(step, parent);
        if (node) parent = node;
      });
      connectorBlock = [];
      understood++;
      continue;
    }

    // 5. Bare node row — only directly beneath a connector line, where the
    //    layout itself says "these are boxes".
    const previousLine = i > 0 ? lines[i - 1] : '';
    if (isConnectorLine(previousLine)) {
      const bare = bareTokens(line);
      if (bare.length >= 2) {
        flushBullets();
        const rowParent = rowParentFromConnectors();
        const rowNodes = bare.map((token) => makeNode(token.label, rowParent || pickParent(token)));
        startRow(rowNodes, bare);
        understood++;
        continue;
      }
    }

    // 6. A heading like "Pathophysiology Flow:" keeps the section context but
    //    adds nothing on its own.
    if (/:$/.test(line.trim())) {
      understood++;
      continue;
    }

    // Anything else is prose — it counts against our confidence.
  }

  flushBullets();

  return finalize(nodes, edges, {
    understood,
    considered,
    title: options.title
  });
}

/**
 * Enforce the invariants MindmapViewer's layout depends on — exactly one root,
 * a depth-derived type on every node — and refuse anything too thin or too
 * garbled to be worth drawing.
 */
function finalize(nodes, edges, { understood, considered, title }) {
  if (nodes.length < MIN_NODES || edges.length < MIN_EDGES) return null;
  if (considered > 0 && understood / considered < MIN_UNDERSTOOD_RATIO) return null;

  const roots = nodes.filter((node) => !node.parent);
  if (roots.length === 0) return null;

  // The layout walks down from a single central node; adopt any stragglers so
  // nothing is stranded off-canvas.
  const root = roots[0];
  roots.slice(1).forEach((orphan) => {
    orphan.parent = root.id;
    edges.push({ source: root.id, target: orphan.id, label: '' });
  });

  const childMap = new Map();
  edges.forEach((edge) => {
    if (!childMap.has(edge.source)) childMap.set(edge.source, []);
    childMap.get(edge.source).push(edge.target);
  });
  nodes.forEach((node) => {
    node.children = childMap.get(node.id) || [];
  });

  // Depth drives the visual weight of each box.
  const depthType = ['central', 'main', 'sub', 'detail'];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const queue = [{ id: root.id, depth: 0 }];
  const seen = new Set();
  while (queue.length) {
    const { id, depth } = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodeById.get(id);
    if (!node) continue;
    node.type = depthType[Math.min(depth, depthType.length - 1)];
    (childMap.get(id) || []).forEach((childId) => queue.push({ id: childId, depth: depth + 1 }));
  }

  return {
    central_topic: root.label || title || 'Concept Map',
    nodes,
    edges
  };
}

/**
 * Cheap pre-check for the markdown renderer: is this fence even worth parsing?
 * Keeps the parser off the hot path for ordinary code blocks.
 */
export function looksLikeDiagram(raw, language) {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  if (CODE_LANGUAGES.has((language || '').toLowerCase())) return false;

  const lines = raw.split('\n');
  const bracketRows = lines.filter((line) => /\[[^[\]\n]+\]/.test(line)).length;
  const connectorRows = lines.filter(isConnectorLine).length;
  const arrowRows = lines.filter((line) => ARROW_TEST_RE.test(line)).length;

  return bracketRows + connectorRows + arrowRows >= 2;
}

export default parseAsciiConceptMap;
