/* ══════════════════════════════════════════════════════════════════════
   EXAM RESULTS — the score and the review an exam owes her at the end.

   WHY THIS EXISTS (2026-10-11)
   ────────────────────────────
   Under exam conditions (StudyQuizCard `deferFeedback`) nothing is revealed
   while she works, so everything she would have learned question by question
   has to be here: how she did, where (by section of her material and by the
   things she asked for, e.g. "Medication questions 8 of 15"), and every miss
   with her answer, the right one and why.

   Partial credit on select-all and ordering is shown as partial, not as a
   miss: on 2026-09-05, 62% of "wrong" select-all answers had scored partial
   credit, and reading them as plain misses was the drill's worst moment.
   Rows are sorted weakest first, so the top of the list is what to study.
   ══════════════════════════════════════════════════════════════════════ */

const LETTER = /^[A-H][).:]\s*/i;
const TAGS = /<[^>]+>/g;
const clean = value => String(value || '').replace(TAGS, ' ').replace(LETTER, '').replace(/\s+/g, ' ').trim();

/** 'right' | 'partial' | 'missed' | null (unanswered) for one answer. */
export function verdict(answer) {
  if (!answer || typeof answer.isCorrect !== 'boolean') return null;
  if (answer.isCorrect) return 'right';
  const score = answer.scoreResult?.score ?? answer.score;
  return typeof score === 'number' && score > 0 ? 'partial' : 'missed';
}

function optionText(option) {
  return clean(option && typeof option === 'object' ? option.text : option);
}

/** Her answer as text, per format. */
export function yourAnswer(question, answer) {
  if (!answer) return [];
  const type = question.questionType;
  if (type === 'sata') return (answer.selectedOptions || []).map(optionText);
  if (['casestudy', 'ordering', 'bowtie'].includes(type)) {
    const byId = Object.fromEntries((question.options || []).map(o => [o.id, optionText(o)]));
    return (answer.userOrder || []).map(id => byId[id] || id);
  }
  if (type === 'matrix') {
    const columns = Object.fromEntries((question.columns || []).map(c => [c.id, c.label]));
    return (question.rows || []).map(row => {
      const chosen = columns[(answer.selectedRows || {})[row.id]];
      return chosen ? `${clean(row.text)}: ${chosen}` : clean(row.text);
    });
  }
  const index = answer.selectedIndex;
  return Number.isInteger(index) && question.options?.[index] != null ? [optionText(question.options[index])] : [];
}

/** The keyed answer as text, per format. */
export function correctAnswer(question) {
  const type = question.questionType;
  if (type === 'sata') {
    const key = Array.isArray(question.correctAnswers) && question.correctAnswers.length ? question.correctAnswers
      : Array.isArray(question.answer) ? question.answer : [];
    return key.map(optionText);
  }
  if (['casestudy', 'ordering', 'bowtie'].includes(type)) return (question.correctOrder || []).map(optionText);
  if (type === 'matrix') {
    const columns = Object.fromEntries((question.columns || []).map(c => [c.id, c.label]));
    return (question.rows || []).map(row => `${clean(row.text)}: ${columns[row.correctColumnId] || ''}`);
  }
  const index = question.correctIndex;
  return Number.isInteger(index) && question.options?.[index] != null ? [optionText(question.options[index])] : [];
}

function why(question) {
  const text = clean(question.correctBlurb || question.correct_blurb || question.rationale || question.justification);
  return text.length > 320 ? `${text.slice(0, 317).trimEnd()}…` : text;
}

function tally(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { name: key, right: 0, total: 0, marks: [] });
    const group = groups.get(key);
    group.total += 1;
    if (row.verdict === 'right') group.right += 1;
    group.marks.push(row.verdict);
  }
  return [...groups.values()].sort((a, b) => (a.right / a.total) - (b.right / b.total) || b.total - a.total || a.name.localeCompare(b.name));
}

/**
 * Everything the results screen shows.
 * `questions` are FocusedQuiz's questions (each may carry `request`);
 * `answers` is practice.answers keyed by index.
 */
export function examResults(questions, answers, brief) {
  const rows = (questions || []).map((question, index) => {
    const answer = (answers || {})[index] || question.userSelection;
    return { index, question, answer, verdict: verdict(answer) };
  }).filter(row => row.verdict);
  const right = rows.filter(r => r.verdict === 'right').length;
  const partial = rows.filter(r => r.verdict === 'partial').length;
  const focusItems = ((brief && brief.items) || []).filter(i => i && i.kind === 'focus');
  const byFocus = focusItems.map(item => {
    const mine = rows.filter(r => (r.question.request?.serves || []).includes(item.id));
    return { id: item.id, name: item.label, right: mine.filter(r => r.verdict === 'right').length, total: mine.length,
      marks: mine.map(r => r.verdict) };
  }).filter(f => f.total > 0);
  return {
    answered: rows.length,
    right,
    partial,
    percent: rows.length ? Math.round((right / rows.length) * 100) : 0,
    byChapter: tally(rows, r => r.question.request?.chapter || r.question.topic || null),
    byFocus,
    missed: rows.filter(r => r.verdict !== 'right').map(r => ({
      index: r.index, verdict: r.verdict, question: clean(r.question.question),
      yours: yourAnswer(r.question, r.answer), correct: correctAnswer(r.question), why: why(r.question),
    })),
  };
}

/** True once every question of the exam she asked for has an answer. */
export function examComplete(questions, answers, target) {
  if (!target) return false;
  let answered = 0;
  (questions || []).forEach((question, index) => {
    if (verdict((answers || {})[index] || question.userSelection)) answered += 1;
  });
  return answered >= target;
}
