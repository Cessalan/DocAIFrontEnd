// Historical evidence only. No scoring, generation, or inference of unseen clicks.
export const timeMs = value => {
  if (!value) return null;
  const n = typeof value?.seconds === 'number' ? value.seconds * 1000
    : typeof value?._seconds === 'number' ? value._seconds * 1000
      : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(n) ? n : null;
};

export const textOf = value => {
  if (value == null) return '';
  if (typeof value !== 'string') return JSON.stringify(value, null, 2);
  return value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
};

export const correctness = value => {
  if (value === 'correct' || value === true) return true;
  if (value === 'incorrect' || value === false) return false;
  if (typeof value?.isCorrect === 'boolean') return value.isCorrect;
  if (typeof value?.correct === 'boolean') return value.correct;
  return null;
};

export function questionsOf(message = {}) {
  if (message.type !== 'quiz') {
    if (Array.isArray(message.studyContent?.questions)) return message.studyContent.questions;
    return (Array.isArray(message.quizData) ? message.quizData : []).flatMap(block => block.questions || []);
  }
  const seen = new Set();
  return [...(Array.isArray(message.quizData) ? message.quizData : []), ...(message.practice?.questions || [])]
    .filter(q => { const key = String(q.question || '').trim().toLowerCase();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
}

export function answerEvidence(message, index) {
  const p = message.practice || {}, g = message.quizProgress || {};
  const first = message.type === 'quiz' ? p.firstAnswers?.[index] : g.firstAttemptAnswers?.[index];
  const status = message.type === 'quiz' ? p.snapshot?.firstAttemptStatuses?.[index] : g.firstAttemptStatuses?.[index];
  const firstAt = timeMs(first?.recordedAt || first?.timestamp), created = timeMs(message.timestamp || message.createdAt);
  const stale = firstAt !== null && created !== null && firstAt < created;
  const conflict = correctness(first) !== null && correctness(status) !== null && correctness(first) !== correctness(status);
  const question = questionsOf(message)[index];
  const latest = message.type === 'quiz' ? p.answers?.[index] ?? question?.userSelection : g.answers?.[index] ?? g.matrixAnswers?.[index];
  const latestStatus = message.type === 'quiz' ? p.snapshot?.questionStatuses?.[index] : g.questionStatuses?.[index];
  return { first, latest, status, stale, conflict,
    firstCorrect: stale || conflict ? null : correctness(first) ?? correctness(status),
    latestCorrect: correctness(latest) ?? correctness(latestStatus),
  };
}

export function selectionText(answer, question) {
  if (answer == null) return 'Selection not recorded';
  if (Array.isArray(answer)) return answer.map(v => typeof v === 'number' ? textOf(question.options?.[v] ?? v) : textOf(v)).join('\n');
  if (typeof answer === 'number') return textOf(question.options?.[answer] ?? answer);
  if (typeof answer === 'string') return answer;
  if (answer.selectedOption != null) return textOf(answer.selectedOption);
  if (answer.selectedRows) return Object.entries(answer.selectedRows).map(([row, column]) =>
    `${question.rows?.find(r => r.id === row)?.text || row}: ${question.columns?.find(c => c.id === column)?.label || column}`).join('\n');
  const list = answer.selectedOptions ?? answer.userOrder ?? answer.selectedIndices;
  if (Array.isArray(list)) return list.map(value => typeof value === 'number' ? textOf(question.options?.[value] ?? value) : textOf(value)).join('\n');
  const selection = answer.selectedIndex ?? answer.selection;
  if (Array.isArray(selection)) return selection.map(value => typeof value === 'number' ? textOf(question.options?.[value] ?? value) : textOf(value)).join('\n');
  if (typeof selection === 'number') return textOf(question.options?.[selection] ?? selection);
  return selection == null ? 'Selection not recorded' : textOf(selection);
}

export function answerKey(question) {
  if (question.rows?.length && question.columns?.length) return question.rows.map(row =>
    `${row.text}: ${question.columns.find(c => c.id === row.correctColumnId)?.label || row.correctColumnId || 'Not recorded'}`).join('\n');
  if (Array.isArray(question.correctOrder)) return question.correctOrder.map(v => typeof v === 'number' ? question.options?.[v] ?? v : v).join('\n');
  if (Array.isArray(question.correctAnswers)) return question.correctAnswers.map(v => typeof v === 'number' ? question.options?.[v] ?? v : v).join('\n');
  const index = question.correctIndex ?? question.metadata?.correctAnswerIndex;
  if (typeof index === 'number') return textOf(question.options?.[index] ?? index);
  let answer = question.answer;
  if (typeof answer === 'string' && answer.trim().startsWith('[')) {
    try { answer = JSON.parse(answer); } catch (_) { /* Preserve non-JSON explanations. */ }
  }
  return (Array.isArray(answer) ? selectionText(answer, question) : textOf(answer)) || 'Answer key not recorded';
}

export function questionOutcome(evidence) {
  if (evidence.stale || evidence.conflict) return { label: 'First result uncertain', tone: 'uncertain' };
  if (evidence.firstCorrect === false && evidence.latestCorrect === true) return { label: 'Wrong initially · latest correct', tone: 'recovered' };
  if (evidence.latestCorrect === false) return { label: 'Latest answer incorrect', tone: 'missed' };
  if (evidence.firstCorrect === false) return { label: 'Missed on first attempt', tone: 'missed' };
  if (evidence.firstCorrect === true) return { label: 'Correct on first attempt', tone: 'correct' };
  if (evidence.latestCorrect === true) return { label: 'Latest answer correct', tone: 'correct' };
  return { label: 'No reliable result', tone: 'unknown' };
}

export function questionReview(data) {
  const questions = questionsOf(data.message);
  return questions.map((question, index) => {
    const evidence = answerEvidence(data.message, index);
    const history = [...(data.discussions?.find(d => d.id === String(index))?.history || []),
      ...(data.message.practice?.discussions?.[index] || [])];
    return { index, question, evidence, ...questionOutcome(evidence),
      studentTurns: history.filter(t => t.role === 'user'), tutorTurns: history.filter(t => t.role === 'assistant') };
  });
}

// Summarize only saved evidence. Generated content does not prove it was viewed.
export function journeyRows(steps, events) {
  return steps.map(step => {
    const activity = events.filter(e => e.stepId === step.id);
    const answers = activity.filter(e => /^(first|latest):/.test(e.id) && !e.warning);
    const completed = !!step.node?.completedAt || ['done', 'completed'].includes(step.node?.status);
    const warnings = activity.filter(e => e.warning).length;
    const observed = activity.filter(e => !e.warning && (!e.id.startsWith('message:') || step.messages.some(m => m.id === e.messageId && m.role === 'user')));
    const dated = observed.filter(e => timeMs(e.at) !== null);
    const last = dated[dated.length - 1];
    return { ...step, completed, warnings, last, hasActivity: completed || observed.length > 0,
      answerCount: new Set(answers.map(e => `${e.messageId}:${e.questionIndex}`)).size,
      statusLabel: completed ? 'Marked complete' : answers.length ? 'Answers recorded' : observed.length ? 'Progress recorded'
        : step.messages.length ? 'Content saved · use not confirmed' : 'No saved content' };
  });
}

export function contentType(node, message) {
  const type = (message?.type || node?.type || '').replace(/^study_/, '');
  const labels = { quiz: 'Quiz', exam: 'Practice exam', lesson: 'Lesson', audio: 'Audio',
    flashcard: 'Flashcards', flashcards: 'Flashcards', mindmap: 'Mindmap',
    practice_debrief: 'Practice review', plan_onboarding: 'Plan setup',
    upload_loading: 'Upload', post_upload_actions: 'Upload actions' };
  return labels[type] || (type ? type.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
    : message?.role === 'user' ? 'Student message' : 'Saved message');
}

export function buildSteps(chat = {}, messages = []) {
  const assigned = new Set();
  const steps = (chat.study?.path?.nodes || []).map((node, index) => {
    const records = messages.filter(m => m.nodeId === node.id || m.id === node.messageId || (m.storedId && m.storedId === node.messageId));
    records.forEach(m => assigned.add(m.id));
    records.sort((a, b) => (timeMs(a.timestamp || a.createdAt) ?? Infinity) - (timeMs(b.timestamp || b.createdAt) ?? Infinity) || a.id.localeCompare(b.id));
    return { id: node.id, number: index + 1, label: node.label || `Step ${index + 1}`, node, messages: records };
  });
  for (const m of messages.filter(m => !assigned.has(m.id))) {
    steps.push({ id: 'message:' + m.id, number: null, label: m.type === 'practice_debrief' ? 'Practice review' : m.role === 'user' ? 'Student message' : m.type?.replace(/_/g, ' ') || 'Saved message',
      node: null, messages: [m] });
  }
  return steps;
}

export function buildTimeline(chat = {}, messages = [], performance = {}) {
  const steps = buildSteps(chat, messages);
  const stepFor = id => steps.find(s => s.messages.some(m => m.id === id));
  const events = [];
  const add = (id, label, at, extra = {}) => {
    const step = steps.find(s => s.id === extra.stepId);
    const message = messages.find(m => m.id === extra.messageId);
    events.push({ id, label, at, ...extra, contentType: step || message ? contentType(step?.node, message) : 'Plan' });
  };
  add('plan', 'Plan saved', chat.study?.startedAt || chat.createdAt);
  for (const m of messages) {
    const step = stepFor(m.id), at = m.timestamp || m.createdAt;
    const base = { stepId: step?.id, messageId: m.id, hidden: !!m.hidden };
    add('message:' + m.id, m.role === 'user' ? 'Student message saved' : m.type === 'practice_debrief' ? 'AI practice review saved' : 'Content saved', at, { ...base, detail: step?.label });
    const records = m.answerRecords || {};
    const indices = new Set([...Object.keys(records.first || {}), ...Object.keys(records.statuses || {}), ...Object.keys(records.latest || {})]);
    for (const index of indices) {
      const first = records.first?.[index], latest = records.latest?.[index], status = records.statuses?.[index];
      const firstAt = first?.recordedAt || first?.timestamp;
      const stale = timeMs(firstAt) !== null && timeMs(at) !== null && timeMs(firstAt) < timeMs(at);
      const conflict = correctness(first) !== null && correctness(status) !== null && correctness(first) !== correctness(status);
      const firstCorrect = correctness(first) ?? correctness(status);
      if (first != null || status != null) add(`first:${m.id}:${index}`, `Question ${Number(index) + 1} · first-answer record`, firstAt,
        { ...base, questionIndex: Number(index), detail: stale || conflict ? 'Conflicting record — inspect before using' : firstCorrect === true ? 'Correct' : firstCorrect === false ? 'Incorrect' : 'Result not recorded', warning: stale || conflict });
      if (latest != null) add(`latest:${m.id}:${index}`, `Question ${Number(index) + 1} · latest saved answer`, latest.timestamp || latest.recordedAt,
        { ...base, questionIndex: Number(index), detail: correctness(latest) === true ? 'Correct' : correctness(latest) === false ? latest.isPartial ? 'Partially correct' : 'Incorrect' : 'Result not recorded' });
    }
    if (m.progressUpdatedAt) add('progress:' + m.id, 'Progress saved', m.progressUpdatedAt, { ...base, detail: 'Latest update; earlier saves are not preserved.' });
  }
  for (const row of performance.history || []) {
    const step = steps.find(s => s.node?.id === row.nodeId);
    add('history:' + row.nodeId + ':' + row.at, 'Result added to study history', row.at,
      { stepId: step?.id, messageId: step?.messages[0]?.id, detail: `${row.correct ?? '?'} / ${row.total ?? '?'} · ${row.topic || ''}` });
  }
  for (const step of steps.filter(s => s.node)) {
    if (step.node.completedAt) add('completed:' + step.id, 'Step marked complete', step.node.completedAt, { stepId: step.id, messageId: step.messages[0]?.id, detail: step.label });
  }
  return events.sort((a, b) => (timeMs(a.at) ?? Infinity) - (timeMs(b.at) ?? Infinity) || a.id.localeCompare(b.id));
}
