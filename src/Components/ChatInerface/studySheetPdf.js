import { jsPDF } from 'jspdf';
import { plainText, sourceLabel } from './studySheetModel';

let fontPromise;
let logoPromise;
async function loadLogo() {
  if (!logoPromise) logoPromise = (async () => {
    const logo = new Image(); logo.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      logo.onload = resolve; logo.onerror = () => reject(new Error('Study sheet logo could not be loaded'));
      logo.src = `${process.env.PUBLIC_URL || ''}/favicon.svg`;
    });
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    canvas.getContext('2d').drawImage(logo, 0, 0, 256, 256);
    return canvas.toDataURL('image/png');
  })().catch(error => { logoPromise = null; throw error; });
  return logoPromise;
}
async function loadFonts() {
  if (!fontPromise) fontPromise = Promise.all(['DejaVuSans', 'DejaVuSans-Bold'].map(async name => {
    const response = await fetch(`${process.env.PUBLIC_URL || ''}/fonts/${name}.ttf`);
    if (!response.ok) throw new Error('Study sheet font could not be loaded');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  })).catch(error => { fontPromise = null; throw error; });
  return fontPromise;
}

// Native PDF text, rules and fills. No screenshots: text remains searchable,
// tables can repeat their headers, and long cells can continue on another page.
export async function createStudySheetPDF(sheet, { fonts, logo } = {}) {
  const [[regular, bold], brandLogo] = await Promise.all([fonts || loadFonts(), logo || loadLogo()]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  pdf.addFileToVFS('DejaVuSans.ttf', regular); pdf.addFont('DejaVuSans.ttf', 'StudySans', 'normal');
  pdf.addFileToVFS('DejaVuSans-Bold.ttf', bold); pdf.addFont('DejaVuSans-Bold.ttf', 'StudySans', 'bold');
  pdf.setProperties({ title: sheet.title, subject: sheet.subtitle || 'Study sheet', author: 'NurseQuizAI' });
  const french = sheet.language === 'french' || sheet.language === 'fr';
  const compact = sheet.layoutDensity === 'compact';
  const bodySize = compact ? 9.5 : 10.5;
  const calloutLabels = french ? { teacher: 'Votre priorité', practice: 'À revoir après votre quiz', takeaway: 'À retenir', example: 'Exemple' }
    : { teacher: 'Your priority', practice: 'Review from your practice', takeaway: 'Keep in mind', example: 'Worked example' };
  const calloutTitle = block => block.title ? `${calloutLabels[block.tone]} · ${block.title}` : calloutLabels[block.tone];
  pdf.setLanguage(french ? 'fr' : 'en');
  const x = 18, width = 174, bottom = 275, lineHeight = compact ? 4.7 : 5.2;
  const ink = '#443d39', muted = '#817770', accent = '#b96352', rule = '#e8dfd7';
  let y = 20, runningTitle = sheet.title;
  const pageTitles = [runningTitle];
  const font = (size = bodySize, strong = false, color = ink) => {
    pdf.setFont('StudySans', strong ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(color);
  };
  // Normalize typographic dashes only; Unicode accents and medical symbols
  // are preserved by the embedded font.
  const text = value => plainText(value).replace(/[\u2010-\u2015\u2212]/g, '-');
  const newPage = () => { pdf.addPage(); y = 26; pageTitles.push(runningTitle); };
  const ensure = height => { if (y + height > bottom) newPage(); };
  const lines = (value, maxWidth = width, size = bodySize, strong = false) => {
    font(size, strong); return pdf.splitTextToSize(text(value), maxWidth);
  };
  const flow = (value, { size = bodySize, strong = false, color = ink, indent = 0, gap = compact ? 2 : 3, lh = lineHeight } = {}) => {
    const wrapped = lines(value, width - indent, size, strong);
    if (wrapped.length * lh < 55) ensure(wrapped.length * lh + gap);
    for (const line of wrapped) {
      ensure(lh); font(size, strong, color); pdf.text(line, x + indent, y + size * .3528); y += lh;
    }
    y += gap;
  };
  const heading = (value, number, followingHeight = 18) => {
    runningTitle = value;
    const wrapped = lines(value, width - 13, 14, true);
    ensure(20 + wrapped.length * 6.2 + Math.min(followingHeight, 180));
    y += 7; pdf.setDrawColor(rule); pdf.setLineWidth(.25); pdf.line(x, y, x + width, y); y += 7;
    font(9, false, accent); pdf.text(String(number).padStart(2, '0'), x, y + 4.9);
    font(14, true); pdf.text(wrapped, x + 13, y + 4.9, { lineHeightFactor: 1.25 });
    pdf.outline?.add(null, text(value), { pageNumber: pdf.getNumberOfPages() });
    y += wrapped.length * 6.2 + 6;
  };
  const table = block => {
    const count = block.columns.length, colWidth = width / count, padding = 3, lh = 4.4;
    const cellLines = (row, strong) => row.map((cell, i) => lines(cell, colWidth - padding * 2, 9, strong || i === 0));
    const header = cellLines(block.columns, true);
    const headerHeight = Math.max(...header.map(c => c.length)) * lh + 7;
    const paint = (rowLines, height, isHeader = false, striped = false) => {
      pdf.setFillColor(isHeader ? '#f5e9e1' : striped ? '#faf7f3' : '#ffffff');
      pdf.rect(x, y, width, height, 'F'); pdf.setDrawColor(rule); pdf.setLineWidth(.2);
      rowLines.forEach((cell, i) => {
        pdf.rect(x + i * colWidth, y, colWidth, height);
        font(9, isHeader || i === 0);
        pdf.text(cell, x + i * colWidth + padding, y + 5, { lineHeightFactor: 1.385 });
      });
      y += height;
    };
    ensure(headerHeight + 18); paint(header, headerHeight, true);
    block.rows.forEach((row, rowIndex) => {
      const rowLines = cellLines(row, false); let offset = 0;
      const length = Math.max(...rowLines.map(c => c.length));
      if (length * lh + 7 <= bottom - 26 - headerHeight && y + length * lh + 7 > bottom) {
        newPage(); paint(header, headerHeight, true);
      }
      while (offset < length) {
        if (bottom - y < 16) { newPage(); paint(header, headerHeight, true); }
        const capacity = Math.max(1, Math.floor((bottom - y - 7) / lh));
        const take = Math.min(length - offset, capacity);
        const start = offset, end = offset + take;
        paint(rowLines.map(c => c.slice(start, end)), take * lh + 7, false, rowIndex % 2 === 1);
        offset += take;
        if (offset < length) { newPage(); paint(header, headerHeight, true); }
      }
    });
    y += 5;
  };
  const callout = block => {
    const colors = { teacher: '#fff5df', practice: '#f3eef8', takeaway: '#f8eee8', example: '#edf4f0' };
    const title = calloutTitle(block);
    const labelLines = lines(title, width - 12, 9, true);
    const bodyLines = lines(block.text, width - 12); let offset = 0;
    const titleHeight = labelLines.length * 4.5 + 5;
    const fullHeight = titleHeight + bodyLines.length * lineHeight + 10;
    if (fullHeight < 120) ensure(fullHeight);
    do {
      ensure(titleHeight + 22);
      const take = Math.min(bodyLines.length - offset, Math.floor((bottom - y - titleHeight - 10) / lineHeight));
      const height = titleHeight + take * lineHeight + 10;
      pdf.setFillColor(colors[block.tone] || colors.takeaway); pdf.roundedRect(x, y, width, height, 2, 2, 'F');
      font(9, true, accent); pdf.text(labelLines, x + 6, y + 6, { lineHeightFactor: 1.4 });
      font(); pdf.text(bodyLines.slice(offset, offset + take), x + 6, y + titleHeight + 5, { lineHeightFactor: 1.4 });
      y += height + 4; offset += take;
      if (offset < bodyLines.length) newPage();
    } while (offset < bodyLines.length);
  };

  // Reserve a heading's first block and a block title's content together.
  // This avoids isolated labels at the bottom of a page.
  const blockStartHeight = block => {
    let height = block.supplemental ? lineHeight + 3 : 0;
    if (block.title && block.kind !== 'callout') height += lines(block.title, width, bodySize, true).length * lineHeight + 2;
    if (block.kind === 'paragraph') {
      const body = lines(block.text).length * lineHeight;
      height += body < 55 ? body + 3 : 2 * lineHeight;
    } else if (block.kind === 'list') {
      const body = block.items.reduce((sum, item, i) => sum + lines(`${block.ordered ? `${i + 1}.` : '•'} ${item}`, width - 3).length * lineHeight + 2, 0);
      height += body < 70 ? body : Math.min(45, lines(block.items[0], width - 3).length * lineHeight + 2);
    } else if (block.kind === 'callout') {
      const label = lines(calloutTitle(block), width - 12, 9, true).length * 4.5 + 5;
      const body = lines(block.text, width - 12).length * lineHeight + label + 14;
      height += body < 124 ? body : label + 22;
    } else if (block.kind === 'table') {
      const colWidth = width / block.columns.length - 6;
      height += Math.max(...block.columns.map(c => lines(c, colWidth, 9, true).length)) * 4.4 + 25;
    } else if (block.kind === 'self_check') height += Math.min(55, 12 + lines(block.questions[0]?.question || '').length * lineHeight);
    if (block.sourceIds?.length) height += 8;
    return height;
  };

  pdf.addImage(brandLogo, 'PNG', x, y - 5, 7, 7, 'nursequizai-logo');
  font(11, true); pdf.text('NurseQuizAI', x + 10, y);
  font(8, false, accent); pdf.text('nursequizai.com', x + width, y, { align: 'right' });
  y += 10;
  flow(sheet.title, { size: 23, strong: true, lh: 10, gap: 3 });
  if (sheet.subtitle) flow(sheet.subtitle, { size: 10, color: muted, gap: 5 });
  if (sheet.summary) callout({ tone: 'takeaway', title: french ? 'En un coup d’œil' : 'At a glance', text: sheet.summary });
  const answers = [];
  sheet.sections.forEach((section, sectionIndex) => {
    if (section.title) heading(section.title, sectionIndex + 1, blockStartHeight(section.blocks[0] || {}));
    section.blocks.forEach(block => {
      ensure(blockStartHeight(block));
      if (block.supplemental) flow(french ? 'Explication complémentaire' : 'Supplemental explanation', { size: 8, color: muted });
      if (block.title && block.kind !== 'callout') flow(block.title, { strong: true, gap: 2 });
      if (block.kind === 'paragraph') flow(block.text);
      if (block.kind === 'list') {
        const height = block.items.reduce((sum, item, i) => sum + lines(`${block.ordered ? `${i + 1}.` : '•'} ${item}`, width - 3).length * lineHeight + 2, 0);
        if (height < 70) ensure(height);
        block.items.forEach((item, i) => flow(`${block.ordered ? `${i + 1}.` : '•'} ${item}`, { indent: 3, gap: 2 }));
      }
      if (block.kind === 'table') table(block);
      if (block.kind === 'callout') callout(block);
      if (block.kind === 'self_check') {
        flow(french ? 'Vérifiez votre compréhension' : 'Check your understanding', { strong: true, color: accent });
        block.questions.forEach(q => {
          const number = answers.length + 1;
          answers.push({ ...q, number }); flow(`${number}. ${q.question}`);
        });
      }
      const refs = (block.sourceIds || []).map(id => (sheet.sources || []).find(s => s.id === id)).filter(Boolean);
      if (refs.length) flow(refs.map(s => `[${s.id}] ${sourceLabel(s, french)}`).join(' · '), { size: 7.5, color: muted, lh: 4, gap: 4 });
    });
  });
  if (answers.length) {
    heading(french ? 'Réponses et raisonnement' : 'Answers and reasoning', sheet.sections.length + 1);
    answers.forEach(q => { flow(`${q.number}. ${q.question}`, { strong: true }); flow(q.answer); });
  }
  if (sheet.sources?.length) {
    heading(french ? 'Sources et contexte' : 'Sources and context', sheet.sections.length + (answers.length ? 2 : 1));
    sheet.sources.forEach(s => {
      flow(`[${s.id}] ${sourceLabel(s, french)}`, { size: 9, strong: true });
      if (s.quote) flow(`“${s.quote}”`, { size: 9, color: muted });
      if (s.kind === 'quiz') flow(`${s.answered}/${s.total} ${french ? 'questions répondues' : 'questions answered'}`, { size: 9, color: muted });
    });
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(rule); pdf.setLineWidth(.2); pdf.line(x, 283, x + width, 283);
    pdf.addImage(brandLogo, 'PNG', x, 286.4, 3.3, 3.3, 'nursequizai-logo');
    font(8, false, muted); pdf.text('NurseQuizAI', x + 5, 289); pdf.text(`${page} / ${pages}`, x + width, 289, { align: 'right' });
    if (page > 1) {
      const title = lines(pageTitles[page - 1], width, 8)[0]; font(8, false, muted); pdf.text(title, x, 16);
      pdf.line(x, 20, x + width, 20);
    }
  }
  return pdf;
}
