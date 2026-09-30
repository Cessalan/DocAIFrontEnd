// The printed quiz: a branded, paginated document handed to the browser's
// own print dialog, where "Save as PDF" is always one of the destinations.
//
// This deliberately does not reuse the html2pdf path the study sheet uses.
// That one screenshots the DOM into JPEGs, so the text in the PDF is a blurry
// picture that can't be selected or searched and page breaks cut through
// lines. The browser's print engine keeps real text, honours
// `break-inside: avoid` per question, and draws the brand footer and page
// numbers in the page margins.
//
// Every value from a quiz goes through escapeHtml / sanitizeRichText
// (quizPrintModel.js) before it reaches this template.

import { buildPrintableQuiz, escapeHtml as esc, richText, sanitizeRichText } from './quizPrintModel';

const HEART = (size, id) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f8b4a0"/><stop offset="50%" stop-color="#e88d7d"/><stop offset="100%" stop-color="#d4736a"/></linearGradient></defs><path d="M16 31C16 31 0 20 0 9C0 3 5 0 10 0C13 0 16 3 16 3C16 3 19 0 22 0C27 0 32 3 32 9C32 20 16 31 16 31Z" fill="url(#${id})"/></svg>`;

const FONTS = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap';

const pad = n => String(n).padStart(2, '0');
const cssString = value => `"${String(value).replace(/["\\]/g, '\\$&')}"`;

function chartHtml(chart, t) {
  if (!chart) return '';
  const who = [chart.patient && `<div class="chart-who">${richText(chart.patient)}</div>`, chart.setting && `<div class="chart-where">${esc(t('quizPrint.setting'))}: ${richText(chart.setting)}</div>`].filter(Boolean).join('');
  const rows = chart.sections.map(s => `<div class="chart-row"><div class="chart-label">${esc(t(`quizPrint.${s.key}`))}</div><div class="chart-text">${richText(s.text)}</div></div>`).join('');
  return `<section class="chart"><p class="chart-head">${esc(t('quizPrint.chart'))}</p>${who}${rows}</section>`;
}

function optionsHtml(item) {
  const cls = item.kind === 'multi' ? 'multi' : item.kind === 'order' ? 'order' : 'single';
  return `<ol class="opts ${cls}">${item.options.map(o =>
    `<li>${cls === 'order' ? '<span class="blank"></span>' : ''}<span class="mark">${o.letter}</span><span class="opt">${esc(o.text)}</span></li>`).join('')}</ol>`;
}

function hintFor(item, t) {
  if (item.kind === 'multi') return t('quizPrint.selectAll');
  if (item.kind === 'order') return t('quizPrint.orderHint', { count: item.options.length });
  return '';
}

function questionHtml(item, t, label = pad(item.number)) {
  const hint = hintFor(item, t);
  return `<article class="q"><div class="q-num">${esc(label)}</div><div class="q-body">
    ${item.note ? `<div class="q-note">${richText(item.note)}</div>` : ''}
    ${hint ? `<p class="q-hint">${esc(hint)}</p>` : ''}
    <div class="q-stem">${richText(item.stem)}</div>
    ${optionsHtml(item)}
  </div></article>`;
}

function itemHtml(item, t) {
  if (item.kind === 'unfolding') {
    return `<section class="case"><div class="case-open"><div class="q-num">${pad(item.number)}</div><div class="q-body">${chartHtml(item.chart, t)}${item.stem ? `<div class="q-stem">${richText(item.stem)}</div>` : ''}</div></div>
      ${item.parts.map(p => questionHtml(p, t, p.number)).join('')}</section>`;
  }
  if (!item.chart) return questionHtml(item, t);
  // The chart and its question must share a page: a question printed on the
  // page after the chart it depends on is unreadable on paper.
  return `<section class="case"><div class="case-open"><div class="q-num">${pad(item.number)}</div><div class="q-body">${chartHtml(item.chart, t)}</div></div>${questionHtml(item, t, '')}</section>`;
}

function keyEntry(item, t, label = pad(item.number)) {
  const ans = item.kind === 'order'
    ? `<p class="k-ans"><span class="k-caption">${esc(t('quizPrint.correctOrder'))}</span> <b>${item.key.join(' → ')}</b></p>
       <ol class="k-list">${item.key.map(letter => `<li><b>${letter}</b> ${esc(item.options.find(o => o.letter === letter)?.text)}</li>`).join('')}</ol>`
    : item.key.length
      ? `<p class="k-ans"><b>${item.key.join(', ')}</b>${item.keyText.length === 1 ? ` <span class="k-text">${esc(item.keyText[0])}</span>` : ''}</p>
         ${item.keyText.length > 1 ? `<ul class="k-list">${item.keyText.map((text, i) => `<li><b>${item.key[i]}</b> ${esc(text)}</li>`).join('')}</ul>` : ''}`
      : `<p class="k-ans"><span class="k-text">${esc(t('quizPrint.noKey'))}</span></p>`;
  const a = item.attempt;
  const you = !a ? '' : a.isCorrect
    ? `<p class="k-you ok"><span class="dot"></span>${esc(t('quizPrint.correct'))}</p>`
    : `<p class="k-you miss"><span class="dot"></span>${esc(a.letters.length ? t('quizPrint.yourAnswer', { answer: a.letters.join(item.kind === 'order' ? ' → ' : ', ') }) : t('quizPrint.noAnswer'))}</p>`;
  const why = sanitizeRichText(item.rationale);
  return `<div class="k"><div class="k-num">${esc(label)}</div><div class="k-body">${ans}${you}${why ? `<div class="k-why">${why}</div>` : ''}</div></div>`;
}

function keyHtml(item, t) {
  return item.kind === 'unfolding' ? item.parts.map(p => keyEntry(p, t, p.number)).join('') : keyEntry(item, t);
}

/**
 * Full HTML document for a quiz.
 * @param {{ questions: object[], answers?: object, topic?: string, t: Function, language?: string, date?: Date, mode?: 'print'|'preview'|'tab' }} input
 *   `preview` lays the document out as a page on screen, for the in-app
 *   preview; `tab` adds a print button too, for the tab
 *   opened on phones where printing a hidden frame is unreliable.
 */
export function renderQuizPrintHtml({ questions, answers, topic, t, language = 'en', date = new Date(), mode = 'print' }) {
  const bar = mode === 'tab';
  const quiz = buildPrintableQuiz({ questions, answers, topic });
  const title = quiz.title || t('quizPrint.untitled');
  const when = new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(date);
  const total = quiz.items.length;
  const meta = [t('quizPrint.questions', { count: total }),
    ...['single', 'multi', 'case'].filter(k => quiz.counts[k] && quiz.counts[k] !== total).map(k => t(`quizPrint.${k}`, { count: quiz.counts[k] }))].join('  ·  ');
  const result = quiz.result && t('quizPrint.yourResult', quiz.result);
  const footLeft = cssString('NurseQuizAI  ·  nursequizai.com');
  const pageWord = cssString(`${t('quizPrint.page')} `), ofWord = cssString(` ${t('quizPrint.of')} `);

  return `<!doctype html><html lang="${esc(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(`NurseQuizAI - ${title}`)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
@page { margin: 17mm 16mm 19mm;
  @bottom-left { content: ${footLeft}; font: 500 7.5pt Outfit, sans-serif; color: #b09c96; letter-spacing: .02em; }
  @bottom-right { content: ${pageWord} counter(page) ${ofWord} counter(pages); font: 500 7.5pt Outfit, sans-serif; color: #b09c96; }
}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 400 10.5pt/1.5 Outfit, 'Segoe UI', system-ui, sans-serif; color: #2f2626; background: #fff; }
p { margin: 0; }
.q-body, .k-body, .chart-text, .opt { min-width: 0; overflow-wrap: anywhere; }
.mast { display: flex; justify-content: space-between; align-items: center; }
.brand { display: flex; align-items: center; gap: 8px; }
.word { font: 600 13pt Outfit, sans-serif; letter-spacing: -.01em; color: #2f2626; }
.word b { font-weight: 600; color: #d4736a; }
.mast-meta { font-size: 8.5pt; color: #8b7b77; text-align: right; }
.mast-meta b { display: block; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; font-size: 7.5pt; color: #d4736a; }
.rule { height: 2px; margin: 12px 0 26px; background: linear-gradient(90deg, #e88d7d, #f8c8c4 60%, rgba(248,200,196,0)); border-radius: 2px; }
h1 { font: 500 27pt/1.12 Fraunces, Georgia, serif; letter-spacing: -.02em; margin: 0 0 10px; color: #2a2020; font-variation-settings: 'opsz' 96; }
.meta { font-size: 9.5pt; color: #7d6d69; }
.intro { font-size: 9pt; color: #7d6d69; padding: 12px 0 0; margin: 22px 0 10px; border-top: 1px solid #efe4e0; }
.q { display: grid; grid-template-columns: 34px 1fr; gap: 0 12px; padding: 18px 0 16px; border-top: 1px solid #efe4e0; break-inside: avoid; page-break-inside: avoid; }
.intro + .q, .intro + .case .case-open { border-top: 0; }
.q-num { font: 500 15pt/1.2 Fraunces, Georgia, serif; color: #d4736a; font-variant-numeric: lining-nums tabular-nums; padding-top: 1px; }
.q-hint { font-size: 7.5pt; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #c46a5a; margin-bottom: 5px; }
.q-note { font-size: 9.5pt; color: #6b5c58; font-style: italic; margin-bottom: 8px; }
.q-stem { font-size: 11pt; font-weight: 500; line-height: 1.5; color: #2a2020; margin-bottom: 11px; }
.opts { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
.opts li { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; break-inside: avoid; }
.opts.order li { grid-template-columns: auto auto 1fr; }
.mark { width: 19px; height: 19px; display: inline-flex; align-items: center; justify-content: center; border: 1.2px solid #d8c4be; border-radius: 50%; font-size: 7.5pt; font-weight: 600; color: #a0857e; margin-top: 1px; }
.multi .mark { border-radius: 4px; }
.order .mark { border: 0; width: auto; font-size: 9pt; }
.blank { width: 26px; height: 19px; border-bottom: 1.2px solid #d8c4be; margin-top: 1px; }
.opt { font-size: 10.5pt; color: #3a302f; }
.case { break-inside: avoid; page-break-inside: avoid; }
.case-open { display: grid; grid-template-columns: 34px 1fr; gap: 0 12px; padding-top: 18px; border-top: 1px solid #efe4e0; }
.case .q { border-top: 0; padding-top: 12px; }
.case .q + .q { border-top: 1px dashed #efe4e0; }
.chart { background: #fbf6f4; border: 1px solid #f0e3de; border-radius: 10px; padding: 12px 14px; }
.chart-head { font-size: 7.5pt; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #c46a5a; margin-bottom: 6px; }
.chart-who { font-weight: 500; font-size: 10pt; }
.chart-where { font-size: 9pt; color: #7d6d69; margin-top: 2px; }
.chart-row { display: grid; grid-template-columns: 92px 1fr; gap: 12px; padding: 8px 0 0; margin-top: 8px; border-top: 1px solid #f0e3de; }
.chart-label { font-size: 8pt; font-weight: 600; color: #8b7b77; padding-top: 1px; }
.chart-text { font-size: 9.5pt; color: #3a302f; }
.chart-text p, .q-stem p, .q-note p, .chart-who p { margin: 0; }
.chart-text p + p, .chart-text ul, .chart-text ol { margin-top: 5px; }
.chart-text ul, .chart-text ol { padding-left: 18px; margin-bottom: 0; }
.chart-text strong, .chart-text b { font-weight: 600; color: #2a2020; }
.key { break-before: page; page-break-before: always; }
.key-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-bottom: 4px; }
.key h2 { font: 500 19pt/1.2 Fraunces, Georgia, serif; letter-spacing: -.01em; margin: 0; color: #2a2020; }
.key-sub { font-size: 9pt; color: #7d6d69; margin: 4px 0 16px; }
.k { display: grid; grid-template-columns: 34px 1fr; gap: 0 12px; padding: 12px 0; border-top: 1px solid #efe4e0; break-inside: avoid; page-break-inside: avoid; }
.k-num { font: 500 11.5pt/1.35 Fraunces, Georgia, serif; color: #d4736a; font-variant-numeric: tabular-nums; }
.k-ans { font-size: 10.5pt; }
.k-ans b { font-weight: 600; color: #2a2020; }
.k-caption { font-size: 8.5pt; color: #8b7b77; }
.k-text { color: #3a302f; }
.k-list { list-style: none; margin: 3px 0 0; padding: 0; font-size: 10pt; }
.k-list b { display: inline-block; width: 16px; font-weight: 600; }
.k-you { display: flex; align-items: center; gap: 6px; font-size: 8.5pt; margin-top: 4px; color: #7d6d69; }
.k-you .dot { width: 8px; height: 8px; border-radius: 50%; border: 1.3px solid #6b9d7b; }
.k-you.ok .dot { background: #6b9d7b; }
.k-you.miss .dot { border-color: #c46a5a; }
.k-why { font-size: 9.5pt; line-height: 1.55; color: #5a4d4a; margin-top: 6px; }
.k-why p + p { margin-top: 5px; }
.k-why ul, .k-why ol { margin: 4px 0; padding-left: 18px; }
.k-why strong, .k-why b { color: #3a302f; font-weight: 600; }
.end { display: flex; align-items: center; gap: 12px; margin-top: 26px; padding-top: 16px; border-top: 2px solid #f4d9d3; break-inside: avoid; }
.end-text { font-size: 9pt; color: #6b5c58; }
.end-text small { display: block; font-size: 8pt; color: #a3928d; margin-top: 2px; }
.screen-bar { display: none; }
@media screen {
  body { background: #f3eeeb; padding: ${bar ? '72px 16px 40px' : mode === 'preview' ? '24px 16px 40px' : '0'}; }
  .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 48px 44px; border-radius: 6px; box-shadow: 0 1px 2px rgba(60,40,35,.06), 0 12px 40px rgba(60,40,35,.08); }
  .key { margin-top: 48px; padding-top: 40px; border-top: 1px dashed #e3d3ce; }
  .screen-bar { display: ${bar ? 'flex' : 'none'}; position: fixed; inset: 0 0 auto; z-index: 2; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(255,255,255,.94); border-bottom: 1px solid #eadfdb; font-size: 13px; color: #766d6a; }
  .screen-bar button { font: 600 14px Outfit, sans-serif; color: #fff; background: #d4736a; border: 0; border-radius: 10px; padding: 10px 16px; }
}
@media screen and (max-width: 600px) { .sheet { padding: 28px 18px; } .mast, .key-head { flex-wrap: wrap; } .chart-row { grid-template-columns: 1fr; gap: 2px; } .screen-bar span { font-size: 12px; } h1 { font-size: 22pt; } }
@media print { .sheet { padding: 0; } }
</style></head><body>
<div class="screen-bar"><span>${esc(t('quizPrint.buttonTitle'))}</span><button type="button" onclick="window.print()">${esc(t('quizPrint.button'))}</button></div>
<main class="sheet">
  <header class="mast"><div class="brand">${HEART(22, 'h1')}<span class="word">NurseQuiz<b>AI</b></span></div>
    <div class="mast-meta"><b>${esc(t('quizPrint.kicker'))}</b>${esc(when)}</div></header>
  <div class="rule"></div>
  <h1>${esc(title)}</h1>
  <p class="meta">${esc(meta)}</p>
  <p class="intro">${esc(t('quizPrint.instructions'))}</p>
  ${quiz.items.map(item => itemHtml(item, t)).join('')}
  <section class="key">
    <div class="key-head"><h2>${esc(t('quizPrint.keyTitle'))}</h2><div class="brand">${HEART(14, 'h2')}<span class="word" style="font-size:10pt">NurseQuiz<b>AI</b></span></div></div>
    <p class="key-sub">${esc(result || t('quizPrint.keyIntro'))}</p>
    ${quiz.items.map(item => keyHtml(item, t)).join('')}
    <footer class="end">${HEART(26, 'h3')}<p class="end-text">${esc(t('quizPrint.footerTagline'))}<small>${esc(t('quizPrint.disclaimer'))}</small></p></footer>
  </section>
</main></body></html>`;
}

async function settle(doc) {
  const link = doc.querySelector('link[rel="stylesheet"]');
  const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));
  const sheet = link && !link.sheet ? new Promise(resolve => { link.onload = link.onerror = resolve; }) : null;
  await Promise.race([(async () => {
    if (sheet) await sheet;
    if (doc.fonts) {
      await Promise.all(['400 10pt Outfit', '600 10pt Outfit', '500 20pt Fraunces'].map(font => doc.fonts.load(font).catch(() => {})));
      await doc.fonts.ready;
    }
  })(), timeout(3500)]);
}

// Printing a hidden frame is the smooth path on desktop: the dialog opens over
// the chat and nothing else changes. Phone browsers are inconsistent about it
// (some print the parent page instead), so there the document opens in its
// own tab, laid out as pages with a print button.
export const prefersTab = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 900;

/** Must be called from a click handler: the phone path opens a tab. */
export async function printQuiz(input) {
  if (prefersTab()) {
    const tab = window.open('', '_blank');
    if (tab) {
      tab.document.open();
      tab.document.write(renderQuizPrintHtml({ ...input, mode: 'tab' }));
      tab.document.close();
      await settle(tab.document);
      tab.focus();
      tab.print();
      return;
    }
  }

  // The previous frame is removed here rather than after printing: browsers
  // where print() returns before the dialog closes would lose the document.
  document.querySelector('iframe[data-quiz-print]')?.remove();
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('data-quiz-print', '');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(renderQuizPrintHtml(input));
  doc.close();
  await printFrame(frame);
}

/** Prints a same-origin frame holding a rendered quiz document. */
export async function printFrame(frame) {
  const doc = frame.contentDocument;
  await settle(doc);
  // "Save as PDF" names the file after the top document's title.
  const title = document.title;
  document.title = doc.title;
  const restore = () => { if (document.title === doc.title) document.title = title; };
  frame.contentWindow.addEventListener('afterprint', restore, { once: true });
  window.addEventListener('focus', restore, { once: true });
  frame.contentWindow.focus();
  frame.contentWindow.print();
}
