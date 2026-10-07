// Both chat and PDF consume this model. Saved plain-text sheets remain readable.
import { studySheetFromFirestore } from '../../Services/studySheetEvents';

export function legacyStudySheet(topic, content, language = 'english') {
  const sheet = { version: 1, title: topic || (language === 'french' ? 'Fiche de révision' : 'Study sheet'),
    subtitle: '', summary: '', language, sources: [], sections: [] };
  const lines = String(content || '').replace(/^```(?:markdown|text)?\s*\n/, '').replace(/\n```\s*$/, '').split('\n');
  let section = null, pendingTitle = '';
  const current = () => {
    if (!section) { section = { id: `section-${sheet.sections.length + 1}`, title: '', blocks: [] }; sheet.sections.push(section); }
    return section;
  };
  const add = block => { if (pendingTitle) { block.title = pendingTitle; pendingTitle = ''; } current().blocks.push(block); };
  const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^[-_*]{3,}$/.test(line)) continue;
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    const caps = line.length > 3 && line === line.toUpperCase() && /\p{Lu}/u.test(line) && !/^[\d\s.)-]/.test(line) && !line.includes('|');
    if (heading || caps) {
      const title = heading ? heading[2] : line;
      if (heading?.[1] === '###') { pendingTitle = title; continue; }
      if (heading?.[1] === '#' && !sheet.sections.length) { sheet.title = title; continue; }
      section = { id: `section-${sheet.sections.length + 1}`, title, blocks: [] }; sheet.sections.push(section); continue;
    }
    if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] || '')) {
      const columns = cells(line), rows = []; i++;
      while (i + 1 < lines.length && lines[i + 1].includes('|')) {
        const row = cells(lines[++i]);
        if (row.length === columns.length) rows.push(row);
      }
      if (rows.length) add({ kind: 'table', columns, rows });
      continue;
    }
    const item = line.match(/^(?:([-*•])|(\d+)[.)])\s+(.+)/);
    if (item) {
      const ordered = !!item[2], items = [item[3]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].trim().match(/^(?:([-*•])|(\d+)[.)])\s+(.+)/);
        if (!next || !!next[2] !== ordered) break;
        items.push(next[3]); i++;
      }
      add({ kind: 'list', ordered, items }); continue;
    }
    if (line.endsWith(':') && line.length < 100) { pendingTitle = line; continue; }
    add({ kind: 'paragraph', text: line });
  }
  if (pendingTitle) add({ kind: 'paragraph', text: pendingTitle });
  return sheet;
}

export function resolveStudySheet(studySheet, topic, content, language) {
  // Saved sheets store table rows as {cells}; see studySheetForFirestore.
  return studySheet?.version === 2 && Array.isArray(studySheet.sections)
    ? studySheetFromFirestore(studySheet) : legacyStudySheet(topic, content, language);
}

export function sourceLabel(source, french = false) {
  return `${source.label}${source.page ? ` · ${french ? 'page' : 'p.'} ${source.page}` : ''}`;
}

export function plainText(text) {
  return String(text || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export function sheetFilename(title) {
  const name = Array.from(String(title || 'Study sheet').normalize('NFKC'))
    .filter(char => char.charCodeAt(0) >= 32).join('').replace(/[<>:"/\\|?*]/g, '')
    .trim().replace(/\s+/g, '_').slice(0, 100).replace(/[. ]+$/, '');
  return `${name || 'Study_sheet'}.pdf`;
}
