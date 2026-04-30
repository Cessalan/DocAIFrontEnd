/**
 * Minimal HTML → Markdown converter for clipboard paste.
 * Handles common formatting: paragraphs, headings, bold/italic, lists,
 * links, code, blockquotes, tables, and line breaks.
 *
 * Returns plain text (no formatting) if `html` is falsy/blank.
 */

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside',
  'figure', 'figcaption'
]);

function collapseInlineWhitespace(text) {
  return text.replace(/[\t\n\r ]+/g, ' ');
}

function convertChildren(node, ctx) {
  let out = '';
  for (const child of node.childNodes) {
    out += convertNode(child, ctx);
  }
  return out;
}

function convertList(node, ordered, ctx) {
  const items = Array.from(node.children).filter(c => c.tagName === 'LI');
  const indent = '  '.repeat(ctx.listDepth);
  const childCtx = { ...ctx, listDepth: ctx.listDepth + 1 };
  const lines = items.map((li, i) => {
    const marker = ordered ? `${i + 1}.` : '-';
    const content = convertChildren(li, childCtx).trim().replace(/\n+/g, '\n' + indent + '   ');
    return `${indent}${marker} ${content}`;
  });
  return '\n' + lines.join('\n') + '\n\n';
}

function convertTable(node, ctx) {
  const rows = Array.from(node.querySelectorAll('tr'));
  if (!rows.length) return '';
  const cellText = (cell) => convertChildren(cell, ctx).trim().replace(/\|/g, '\\|').replace(/\n+/g, ' ');
  const grid = rows.map(r => Array.from(r.children).map(cellText));
  const colCount = Math.max(...grid.map(r => r.length));
  const headerRow = grid[0].concat(Array(colCount - grid[0].length).fill(''));
  const sep = Array(colCount).fill('---');
  const bodyRows = grid.slice(1).map(r => r.concat(Array(colCount - r.length).fill('')));
  const lines = [
    `| ${headerRow.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...bodyRows.map(r => `| ${r.join(' | ')} |`)
  ];
  return '\n' + lines.join('\n') + '\n\n';
}

function convertNode(node, ctx) {
  if (node.nodeType === 3) {
    // Text node — collapse whitespace; outer block converters trim edges.
    return collapseInlineWhitespace(node.textContent);
  }
  if (node.nodeType !== 1) return '';

  const tag = node.tagName.toLowerCase();

  switch (tag) {
    case 'br':
      return '  \n';
    case 'hr':
      return '\n\n---\n\n';
    case 'strong':
    case 'b': {
      const inner = convertChildren(node, ctx).trim();
      return inner ? `**${inner}**` : '';
    }
    case 'em':
    case 'i': {
      const inner = convertChildren(node, ctx).trim();
      return inner ? `*${inner}*` : '';
    }
    case 'u': {
      // Markdown has no underline — keep text without decoration.
      return convertChildren(node, ctx);
    }
    case 's':
    case 'strike':
    case 'del': {
      const inner = convertChildren(node, ctx).trim();
      return inner ? `~~${inner}~~` : '';
    }
    case 'code': {
      // Inline code unless inside <pre> (handled by 'pre' branch).
      const inner = node.textContent;
      return inner ? `\`${inner}\`` : '';
    }
    case 'pre': {
      const inner = node.textContent.replace(/\n+$/, '');
      return `\n\n\`\`\`\n${inner}\n\`\`\`\n\n`;
    }
    case 'a': {
      const href = node.getAttribute('href') || '';
      const text = convertChildren(node, ctx).trim();
      if (!text) return '';
      if (!href || href === text) return text;
      return `[${text}](${href})`;
    }
    case 'img': {
      const alt = node.getAttribute('alt') || '';
      const src = node.getAttribute('src') || '';
      if (!src) return '';
      return `![${alt}](${src})`;
    }
    case 'h1': case 'h2': case 'h3':
    case 'h4': case 'h5': case 'h6': {
      const level = parseInt(tag[1], 10);
      const inner = convertChildren(node, ctx).trim();
      return inner ? `\n\n${'#'.repeat(level)} ${inner}\n\n` : '';
    }
    case 'blockquote': {
      const inner = convertChildren(node, ctx).trim();
      if (!inner) return '';
      const quoted = inner.split('\n').map(l => `> ${l}`).join('\n');
      return `\n\n${quoted}\n\n`;
    }
    case 'ul':
      return convertList(node, false, ctx);
    case 'ol':
      return convertList(node, true, ctx);
    case 'li':
      // Lone <li> outside a list — render as a bullet.
      return `- ${convertChildren(node, ctx).trim()}\n`;
    case 'table':
      return convertTable(node, ctx);
    case 'thead': case 'tbody': case 'tfoot':
    case 'tr': case 'td': case 'th':
      // Handled by convertTable.
      return '';
    case 'script':
    case 'style':
    case 'noscript':
      return '';
    default: {
      const inner = convertChildren(node, ctx);
      if (BLOCK_TAGS.has(tag)) {
        const trimmed = inner.replace(/^\s+|\s+$/g, '');
        return trimmed ? `\n\n${trimmed}\n\n` : '';
      }
      return inner;
    }
  }
}

export function htmlToMarkdown(html) {
  if (!html || typeof html !== 'string') return '';
  let parsed;
  try {
    parsed = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return '';
  }
  if (!parsed?.body) return '';
  const md = convertChildren(parsed.body, { listDepth: 0 });
  // Collapse 3+ consecutive blank lines into 2, trim outer whitespace.
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

export default htmlToMarkdown;
