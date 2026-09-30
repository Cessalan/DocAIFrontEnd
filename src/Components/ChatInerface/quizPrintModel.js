// Turns a quiz, in any of the shapes the generators emit, into one flat
// structure the printed PDF can lay out without knowing where it came from.
//
// A quiz reaches the student as MCQ (`answer` is an option string, or a
// letter, or `correctIndex`), select-all (`answer` is an array of option
// strings), ordering / case study (`options` + `correctOrder`, plus the
// chart in `caseStudy`) and the NGN unfolding case (`scenario.items`, each a
// small question of its own). The on-screen components each re-derive the
// key their own way; this module does it once, and never invents one: a
// question whose key cannot be found prints "see rationale", not a guess.

import { getQuestionType } from '../../utils/quizScoring';

export const LETTERS = 'ABCDEFGHIJ'.split('');

const clean = value => (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
const stripPrefix = text => clean(text).replace(/^[A-J][).:]\s+/, '');
const same = (a, b) => stripPrefix(a).toLowerCase() === stripPrefix(b).toLowerCase();
const optionText = option => (typeof option === 'string' ? option : clean(option?.text || option?.content || option?.label));

function singleKey(q, options) {
  if (Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < options.length) return q.correctIndex;
  const meta = q.metadata?.correctAnswerIndex;
  if (Number.isInteger(meta) && meta >= 0 && meta < options.length) return meta;
  const exact = options.findIndex(option => same(option, q.answer));
  if (exact >= 0) return exact;
  const letter = typeof q.answer === 'string' && q.answer.trim().match(/^([A-J])(?:[).:]|$)/i);
  const index = letter ? letter[1].toUpperCase().charCodeAt(0) - 65 : -1;
  return index >= 0 && index < options.length ? index : -1;
}

function multiKey(q, options) {
  const answers = Array.isArray(q.answer) ? q.answer : Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
  if (Array.isArray(q.correctIndices) && q.correctIndices.length) {
    return q.correctIndices.filter(i => Number.isInteger(i) && i >= 0 && i < options.length);
  }
  return options.map((option, i) => (answers.some(answer => same(option, answer)) ? i : -1)).filter(i => i >= 0);
}

function orderKey(q, options) {
  const order = Array.isArray(q.correctOrder) ? q.correctOrder : [];
  return order.map(item => {
    const id = typeof item === 'string' ? item : item?.id;
    const text = typeof item === 'string' ? item : optionText(item);
    const byId = id ? q.options.findIndex(option => typeof option === 'object' && option?.id === id) : -1;
    return byId >= 0 ? byId : options.findIndex(option => same(option, text));
  }).filter(i => i >= 0);
}

const lettersOf = indices => indices.map(i => LETTERS[i]).filter(Boolean);

// The student's own attempt, when she answered on screen. Only what was
// recorded is shown; an answer we can't map back to options is omitted.
function attemptOf(q, kind, options, selection) {
  if (!selection || typeof selection.isCorrect !== 'boolean') return null;
  let indices = [];
  if (kind === 'multi') {
    const picked = selection.selectedOptions || selection.selectedAnswers || [];
    indices = options.map((option, i) => (picked.some(p => same(option, p)) ? i : -1)).filter(i => i >= 0);
  } else if (kind === 'order') {
    const order = selection.userOrder || [];
    indices = order.map(item => {
      const text = typeof item === 'string' ? item : optionText(item);
      const byId = q.options.findIndex(option => typeof option === 'object' && option?.id === item);
      return byId >= 0 ? byId : options.findIndex(option => same(option, text));
    }).filter(i => i >= 0);
  } else {
    const index = Number.isInteger(selection.selectedIndex) ? selection.selectedIndex
      : Number.isInteger(selection.selectedOptionIndex) ? selection.selectedOptionIndex
        : options.findIndex(option => same(option, selection.selectedOption || selection.selectedOptionText));
    if (index >= 0 && index < options.length) indices = [index];
  }
  return { letters: lettersOf(indices), isCorrect: selection.isCorrect };
}

function caseChart(q) {
  const source = q.caseStudy || q.scenario || null;
  if (!source) return null;
  const sections = [
    ['nursesNotes', clean(source.nursesNotes)],
    ['vitalSigns', clean(source.vitalSigns)],
    ['labResults', clean(source.labResults)],
  ].filter(([, text]) => text);
  const patient = clean(source.patientInfo);
  const setting = clean(source.setting);
  if (!sections.length && !patient && !setting) return null;
  return { patient, setting, sections: sections.map(([key, text]) => ({ key, text })) };
}

function part(q, number, selection) {
  const type = getQuestionType(q);
  const options = (Array.isArray(q.options) ? q.options : []).map(optionText).map(stripPrefix);
  const kind = type === 'sata' || Array.isArray(q.answer) ? 'multi'
    : (type === 'casestudy' || type === 'ordering') && Array.isArray(q.correctOrder) ? 'order' : 'single';
  const key = kind === 'multi' ? multiKey(q, options) : kind === 'order' ? orderKey(q, options) : [singleKey(q, options)].filter(i => i >= 0);
  return {
    number,
    kind,
    stem: clean(q.question || q.stem),
    note: clean(q.progressNote),
    options: options.map((text, i) => ({ letter: LETTERS[i], text, correct: kind !== 'order' && key.includes(i) })),
    key: lettersOf(key),
    keyText: kind === 'order' ? [] : key.map(i => options[i]),
    rationale: clean(q.rationale || q.justification || q.explanation),
    attempt: attemptOf(q, kind, options, selection),
  };
}

// Placeholder topics the chat stores when she didn't name one (the same list
// PracticeLaunchCard hides). A sheet titled "Quiz practice" says nothing.
const GENERIC_TOPIC = /^(quiz practice|your practice|quiz|general|uploaded course material)?$/i;

/**
 * @param {object[]} questions  quiz questions, userSelection optionally merged in
 * @param {object}   [answers]  answers keyed by question index (practice.answers)
 */
export function buildPrintableQuiz({ questions = [], answers = {}, topic = '' } = {}) {
  const items = [];
  questions.forEach((q, index) => {
    if (!q || (!q.question && !q.scenario?.items)) return;
    const selection = answers?.[index] || q.userSelection || null;
    const number = items.length + 1;
    const type = getQuestionType(q);
    if ((type === 'unfoldingCase' || type === 'unfoldingcase') && Array.isArray(q.scenario?.items)) {
      const parts = q.scenario.items.filter(item => item?.question)
        .map((item, i) => part(item, `${number}.${i + 1}`, null));
      if (!parts.length) return;
      items.push({ number, kind: 'unfolding', chart: caseChart(q), stem: clean(q.question), parts, topic: clean(q.topic) });
      return;
    }
    items.push({ ...part(q, number, selection), chart: caseChart(q), topic: clean(q.topic) });
  });

  const answered = items.filter(item => item.attempt).length;
  const correct = items.filter(item => item.attempt?.isCorrect).length;
  const topics = [...new Set(items.map(item => item.topic).filter(Boolean))];
  const counts = items.reduce((acc, item) => {
    const format = item.kind === 'unfolding' || item.kind === 'order' || item.chart ? 'case' : item.kind;
    acc[format] = (acc[format] || 0) + 1;
    return acc;
  }, {});

  return {
    title: (GENERIC_TOPIC.test(clean(topic)) ? '' : clean(topic)) || topics.slice(0, 2).join(' · ') || '',
    topics,
    items,
    counts,
    result: answered ? { answered, correct, total: items.length } : null,
  };
}

// Rationales arrive as model-written HTML. The print document is written into
// a same-origin iframe, so nothing executable may survive: keep a short list
// of inline formatting tags, drop every attribute.
const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'UL', 'OL', 'LI', 'SUB', 'SUP', 'MARK', 'SPAN', 'DIV']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TEMPLATE', 'SVG', 'MATH', 'NOSCRIPT']);

const escapeRaw = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function escapeHtml(value) {
  return escapeRaw(clean(value));
}

export function sanitizeRichText(html) {
  const text = clean(html)
    .replace(/Use this (EXACT )?format with html:\s*/gi, '')
    .replace(/\[1(-2)? sentences?.*?\]/gi, '');
  if (!text) return '';
  if (typeof DOMParser === 'undefined') return escapeHtml(text.replace(/<[^>]*>/g, ' '));
  const doc = new DOMParser().parseFromString(`<body>${text}</body>`, 'text/html');
  const walk = node => [...node.childNodes].map(child => {
    if (child.nodeType === 3) return escapeRaw(child.textContent);
    if (child.nodeType !== 1 || DROP.has(child.tagName)) return '';
    const inner = walk(child);
    if (!KEEP.has(child.tagName)) return inner;
    const tag = child.tagName.toLowerCase();
    return tag === 'br' ? '<br>' : `<${tag}>${inner}</${tag}>`;
  }).join('');
  return walk(doc.body).trim();
}

// Fields the generators sometimes write as HTML and sometimes as plain text
// (the case chart's notes, a stem with a <strong> in it). The screen renders
// them as HTML, so the page must too; plain text keeps its line breaks.
export function richText(value) {
  const text = clean(value);
  if (/<\/?[a-z][^>]*>/i.test(text)) return sanitizeRichText(text);
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}
