/**
 * shareSetModel — what a "send to my study group" set is, and when it is offered.
 *
 * WHY THIS EXISTS
 *
 * Word of mouth was 25 of 385 signups (2026-11-10), and the only share feature
 * (ShareQuizButton, 2025-11) sat on a quiz screen the app no longer shows: 69
 * shares in its first two months, none since. Classmates have the same slides
 * and the same exam, so the unit worth sharing is the round she just finished,
 * opened by a classmate on a phone with no upload and no account.
 *
 * Three rules this file holds, each for a reason:
 *
 *  - QUESTIONS TRAVEL, NOTES DO NOT. `cleanQuestion` copies a whitelist of
 *    fields. Anything else on a question (her answers, source quotes, file
 *    names) never reaches the public document.
 *  - THE PUBLIC DOCUMENT IS NOT TRUSTED. `publicQuizzes` is client-writable
 *    (firestore.rules catch-all), and the case-study card renders its
 *    explanation as HTML. `readSharedSet` strips markup from every string
 *    before a card sees it.
 *  - HER SCORE IS HERS. Name on, score off by default; classmates come back to
 *    her as a count and a most-missed question, never as names or scores.
 *
 * Pure: no Firebase, no React. QuizShareService does the I/O.
 */

export const SHARE_VERSION = 2;
export const SHARE_SET_SIZE = 10;
export const MIN_SHARE_QUESTIONS = 3;
// One classmate is an anecdote; the hardest question is only named from two.
export const HARDEST_MIN_COMPLETIONS = 2;

const ORDERING_TYPES = ['casestudy', 'ordering', 'bowtie'];

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** Markup out, entities back to characters. Applied to everything read back. */
export function plainText(value) {
  return String(value ?? '')
    // Escaped markup is decoded first so it is stripped like any other tag.
    .replace(/&(lt|#0*60|#x0*3c);/gi, '<')
    .replace(/&(gt|#0*62|#x0*3e);/gi, '>')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|li|div|h[1-6])\s*>/gi, '\n')
    // A tag opens with a letter, "/", "!" or "?". "K+ < 3.5" is not one and stays.
    .replace(/<[a-zA-Z/!?][^>]*>/g, '')
    // An unclosed tag has no ">" to match on; it must not survive as "<img ...".
    .replace(/<(?=[a-zA-Z/!?])/g, '‹')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function deepPlain(value) {
  if (typeof value === 'string') return plainText(value);
  if (Array.isArray(value)) return value.map(deepPlain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepPlain(item)]));
  }
  return value;
}

/** A=0. Numbers and numeric strings pass through; anything else is -1. */
export function normalizeCorrectIndex(raw) {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string') {
    if (/^[A-Fa-f]$/.test(raw.trim())) return raw.trim().toUpperCase().charCodeAt(0) - 65;
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return -1;
}

export function questionKind(question) {
  const type = text(question?.questionType).toLowerCase();
  if (type === 'sata' || type === 'matrix') return type;
  if (ORDERING_TYPES.includes(type)) return 'casestudy';
  return 'mcq';
}

const optionText = (option) => (typeof option === 'string' ? option : option?.text || option?.content || '');

/**
 * One question, reduced to what a card needs to ask and grade it. Returns null
 * when the question could not be answered fairly by a stranger (no key, too
 * few options): a broken question in front of her classmates costs her more
 * than a shorter set.
 */
export function cleanQuestion(question) {
  if (!question || !text(question.question)) return null;
  const kind = questionKind(question);
  const options = Array.isArray(question.options) ? question.options : [];
  const explanation = text(question.rationale) || text(question.justification);
  const base = { questionType: kind, question: text(question.question), topic: text(question.topic) || null };

  if (kind === 'mcq') {
    const correctIndex = normalizeCorrectIndex(question.correctIndex);
    const list = options.map(optionText).map(text);
    if (list.length < 2 || list.some((item) => !item)) return null;
    if (correctIndex < 0 || correctIndex >= list.length) return null;
    return { ...base, options: list, correctIndex, rationale: explanation, correctBlurb: text(question.correctBlurb || question.correct_blurb) };
  }

  if (kind === 'sata') {
    const list = options.map(optionText).map(text);
    const answer = (Array.isArray(question.answer) ? question.answer : [question.answer]).map(text).filter(Boolean);
    if (list.length < 3 || list.some((item) => !item)) return null;
    if (!answer.length || answer.some((item) => !list.includes(item))) return null;
    return { ...base, options: list, answer, justification: explanation };
  }

  if (kind === 'matrix') {
    const columns = (question.columns || []).map((column) => ({ id: column?.id, label: text(column?.label) }));
    const rows = (question.rows || []).map((row) => ({
      id: row?.id, text: text(row?.text), correctColumnId: row?.correctColumnId, explanation: text(row?.explanation),
    }));
    const known = (id) => columns.some((column) => column.id === id);
    if (columns.length < 2 || rows.length < 3) return null;
    if (columns.some((column) => column.id == null || !column.label)) return null;
    if (rows.some((row) => row.id == null || !row.text || !known(row.correctColumnId))) return null;
    return { ...base, columns, rows };
  }

  // Ordering inside a patient case.
  if (options.length < 3 || !Array.isArray(question.correctOrder) || question.correctOrder.length < 3) return null;
  return {
    ...base,
    options: JSON.parse(JSON.stringify(options)),
    correctOrder: JSON.parse(JSON.stringify(question.correctOrder)),
    caseStudy: question.caseStudy ? JSON.parse(JSON.stringify(question.caseStudy)) : null,
    justification: explanation,
  };
}

/** The first ten questions of a round that hold up, in their original order. */
export function shareableQuestions(questions, { excludeIndices = [] } = {}) {
  const skip = new Set(excludeIndices);
  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => (skip.has(index) ? null : cleanQuestion(question)))
    .filter(Boolean)
    .slice(0, SHARE_SET_SIZE);
}

/**
 * Whether the result screen shows the offer at all. After every round, whatever
 * she scored and whichever step it was (owner, 2026-11-11): her score is never
 * shown to classmates unless she switches it on, so a low round is no reason to
 * hide the offer. Only a round with too few usable questions is skipped.
 */
export function canOfferShare({ questions, viewOnly = false }) {
  if (viewOnly) return false;
  return shareableQuestions(questions).length >= MIN_SHARE_QUESTIONS;
}

/** A topic short enough for one line of a text message, cut at a word. */
export function shortenTopic(topic, max = 34) {
  const value = text(topic);
  if (value.length <= max) return value;
  let cut = value.slice(0, max + 1).replace(/\s+\S*$/, '').replace(/[\s,:;\u2013-]+$/, '');
  // "Patient Evaluation in" reads broken; drop small words left at the end.
  while (/\s(in|of|and|the|for|on|to|with|a|an|&|de|du|des|la|le|et|en)$/i.test(cut)) cut = cut.replace(/\s+\S+$/, '');
  return cut || value.slice(0, max);
}

export function firstName(displayName) {
  const first = text(displayName).split(/\s+/)[0] || '';
  // An email used as a display name is not a name to show classmates.
  return first.includes('@') ? '' : first.slice(0, 24);
}

/** The public document. Counters start at zero so increments never race a missing field. */
export function buildShareDoc({ shareId, questions, topic, senderName, showName = true, score, includeScore = false, language = 'en' }) {
  const list = shareableQuestions(questions);
  return {
    v: SHARE_VERSION,
    shareId,
    topic: text(topic) || null,
    questions: list,
    totalQuestions: list.length,
    senderName: showName ? firstName(senderName) || null : null,
    senderScore: includeScore && score && score.total > 0 ? { got: score.got, total: score.total } : null,
    language: language.startsWith('fr') ? 'fr' : 'en',
    starts: 0,
    completions: 0,
    misses: {},
    flagged: [],
    walkthroughs: {},
  };
}

/**
 * Walkthroughs saved on a shared set, keyed by the question's stored index.
 * Generated once, by the first visitor who needed one, and never replaced
 * (owner, 2026-11-11): every later classmate gets the saved copy. The stored
 * document is client-writable, so the text is stripped of markup like the
 * questions are; anything that is not an object is ignored.
 */
export const cleanWalkthrough = (value) =>
  (value && typeof value === 'object' && !Array.isArray(value) ? deepPlain(value) : null);

export function readWalkthroughs(raw) {
  const saved = raw && typeof raw.walkthroughs === 'object' && !Array.isArray(raw.walkthroughs) ? raw.walkthroughs : {};
  return Object.fromEntries(
    Object.entries(saved)
      .filter(([index, value]) => /^\d+$/.test(index) && value && typeof value === 'object' && !Array.isArray(value))
      .map(([index, value]) => [Number(index), deepPlain(value)])
  );
}

function fromLegacy(quiz) {
  const options = (quiz?.options || []).map(optionText);
  const answer = text(Array.isArray(quiz?.answer) ? quiz.answer[0] : quiz?.answer);
  let correctIndex = options.findIndex((option) => text(option) === answer);
  if (correctIndex < 0 && /^[A-Fa-f][).]?$/.test(answer)) correctIndex = normalizeCorrectIndex(answer[0]);
  return { questionType: 'mcq', question: quiz?.question, options, correctIndex, rationale: quiz?.justification, topic: quiz?.topic };
}

/**
 * A stored document, made safe to render. Reads both shapes: v2 (`questions`)
 * and the 2025 links (`quizzes`, single-answer, key stored as option text),
 * which must keep opening. Flagged questions are left out; `index` keeps each
 * question's position in the stored set so counters stay comparable.
 */
export function readSharedSet(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const stored = Array.isArray(raw.questions) ? raw.questions : (raw.quizzes || []).map(fromLegacy);
  const flagged = new Set(Array.isArray(raw.flagged) ? raw.flagged : []);
  const questions = stored
    .map((question, index) => {
      const clean = cleanQuestion(deepPlain(question));
      return clean && !flagged.has(index) ? { ...clean, index } : null;
    })
    .filter(Boolean);
  if (!questions.length) return null;
  const score = raw.senderScore;
  return {
    walkthroughs: readWalkthroughs(raw),
    shareId: text(raw.shareId),
    topic: plainText(raw.topic || '') || null,
    senderName: firstName(plainText(raw.senderName || '')) || null,
    senderScore: score && Number.isFinite(score.got) && score.total > 0 ? { got: score.got, total: score.total } : null,
    questions,
  };
}

/** One answer from any card, reduced to right or wrong. */
export const isRight = (answer) => !!answer && answer.isCorrect === true;

/** What the classmate got, and the (at most two) topics behind her misses. */
export function gradeSet(questions, answers) {
  const total = questions.length;
  const missed = questions.filter((question, position) => !isRight(answers[position]));
  const weakTopics = [];
  missed.forEach((question) => {
    if (question.topic && !weakTopics.includes(question.topic)) weakTopics.push(question.topic);
  });
  return {
    total,
    correct: total - missed.length,
    percent: total ? Math.round(((total - missed.length) / total) * 100) : 0,
    missedIndices: missed.map((question) => question.index),
    weakTopics: weakTopics.slice(0, 2),
  };
}

/** The practice request a new account opens on. No notes are behind it, so it names topics. */
export function followUpPrompt({ topic, weakTopics = [], language = 'en' }) {
  const focus = weakTopics.length ? weakTopics.join(' and ') : topic;
  if (!focus) return '';
  return language.startsWith('fr')
    ? `Donne-moi 10 questions de pratique de style NCLEX sur ${focus}, avec une explication pour chaque réponse.`
    : `Give me 10 NCLEX-style practice questions on ${focus}, with an explanation for each answer.`;
}

/**
 * What comes back to the sender: how many classmates finished, and which
 * question the group missed most. Counts only, by design.
 */
export function classSummary(raw) {
  const completions = Number.isFinite(raw?.completions) ? Math.max(0, raw.completions) : 0;
  if (!completions) return null;
  let hardest = null;
  if (completions >= HARDEST_MIN_COMPLETIONS) {
    Object.entries(raw.misses || {}).forEach(([index, count]) => {
      if (Number.isFinite(count) && count >= 2 && (!hardest || count > hardest.count)) hardest = { index: Number(index), count };
    });
  }
  const stored = Array.isArray(raw.questions) ? raw.questions : [];
  const question = hardest ? plainText(stored[hardest.index]?.question || '') : '';
  return {
    completions,
    topic: plainText(raw.topic || '') || null,
    hardest: hardest && question ? { ...hardest, question: question.length > 110 ? `${question.slice(0, 107)}…` : question } : null,
  };
}

/** Several sets for one study space, read as one line. */
export function combineSummaries(summaries) {
  const live = summaries.filter(Boolean);
  if (!live.length) return null;
  const completions = live.reduce((sum, item) => sum + item.completions, 0);
  const hardest = live.map((item) => item.hardest).filter(Boolean).sort((a, b) => b.count - a.count)[0] || null;
  const top = [...live].sort((a, b) => b.completions - a.completions)[0];
  return { completions, hardest, topic: live.length === 1 ? top.topic : null };
}
