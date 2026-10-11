const strip = value => String(value || '').replace(/^[A-H][).:]\s*/i, '').trim();

export function normalizePracticeQuestion(q) {
  const options = q.options || [];
  let correctIndex = Number.isInteger(q.correctIndex) && q.correctIndex >= 0 ? q.correctIndex : q.metadata?.correctAnswerIndex;
  if (!Number.isInteger(correctIndex)) {
    const exact = options.findIndex(o => strip(o) === strip(q.answer));
    const letter = typeof q.answer === 'string' && q.answer.match(/^([A-H])(?:[).:]|$)/i);
    correctIndex = exact >= 0 ? exact : letter ? letter[1].toUpperCase().charCodeAt(0) - 65 : -1;
  }
  return { ...q, correctIndex, questionType: q.questionType || (q.caseStudy ? 'casestudy' : 'mcq'),
    rationale: q.rationale || q.justification || '', correctBlurb: q.correctBlurb || q.correct_blurb || '' };
}

export function permittedTotal(requested, loaded, remaining, isPro) {
  const desired = Math.min(200, Math.max(loaded, Number(requested) || loaded));
  return isPro ? desired : Math.min(desired, loaded + Math.max(0, Number(remaining) || 0));
}

// The size of a practice as the student sees it: what she asked for, capped
// by a free user's allowance. The chat card and the focused quiz must use the
// same number; the card used to count only the questions generated so far, so
// a 50-question request showed "10 questions ready · 4/10" in the chat while
// the quiz itself said "Question 5 / 50".
export function practiceTarget(message, loaded, remaining, isPro) {
  return permittedTotal(requestedPracticeTotal(message, message?.practice?.settings), loaded, remaining, isPro);
}

// What she asked for in chat (requestedTotal, written only by the stream) is a
// floor on the saved practice size. The focused quiz opens on the stream's
// first stage event, before that number exists, and used to save its
// 5-question fallback into practice.settings, which then outranked the 15 she
// asked for on every later read. A Pro student asked for a full exam three
// times on 2026-10-11 and got 5 questions and a debrief each time.
export function requestedPracticeTotal(message, settings) {
  // A size she picked herself on the request brief ("Change" on an assumed
  // full exam) is hers, smaller or larger than what the stream assumed.
  const chosen = Number(settings?.chosen_total) || 0;
  if (chosen) return chosen;
  const saved = Number(settings?.requested_total) || 0;
  const asked = Number(message?.requestedTotal) || 0;
  return Math.max(saved, asked) || undefined;
}

// Questions per batch: a request planned on the backend is written ten at a
// time from its blueprint (NQBackEnd2 PLANNED_BATCH); older quizzes in fives.
export function batchSize(settings) {
  return settings?.request_plan?.id ? 10 : 5;
}

export function appendUniqueQuestions(existing, incoming) {
  const seen = new Set(existing.map(q => String(q.question).trim().toLowerCase()));
  return [...existing, ...incoming.filter(q => {
    const key = String(q.question || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

// Defaults for a quiz that saved no settings of its own. The chat's practice
// profile (practiceProfileModel.js) is applied on top of these in FocusedQuiz,
// and the backend applies it again to every batch. Ordering (casestudy) is not
// a default, matching DEFAULT_FORMATS there.
export function initialPracticeSettings(message) {
  const settings = { difficulty: 'medium', question_types: ['mcq', 'sata'],
    scope: message.quizScope || '', requested_total: message.requestedTotal || message.expectedTotal || message.quizData?.length || 5,
    ...message.practice?.settings };
  return { ...settings, requested_total: requestedPracticeTotal(message, settings) };
}
