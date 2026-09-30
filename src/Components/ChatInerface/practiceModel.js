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
  const requested = message?.practice?.settings?.requested_total || message?.requestedTotal || loaded;
  return permittedTotal(requested, loaded, remaining, isPro);
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
  return { difficulty: 'medium', question_types: ['mcq', 'sata'],
    scope: message.quizScope || '', requested_total: message.requestedTotal || message.expectedTotal || message.quizData?.length || 5,
    ...message.practice?.settings };
}
