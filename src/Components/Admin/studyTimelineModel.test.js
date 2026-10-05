import { answerEvidence, answerKey, buildSteps, buildTimeline, journeyRows, questionReview, questionsOf, selectionText } from './studyTimelineModel';

test('opens historical nodes and retains orphan records and multiple saved versions', () => {
  const steps = buildSteps({ study: { path: { nodes: [{ id: 'n1', messageId: 'logical-id', label: 'Old step' }, { id: 'locked', status: 'locked' }] } } }, [
    { id: 'doc', storedId: 'logical-id', timestamp: '2025-01-01' },
    { id: 'version2', nodeId: 'n1', timestamp: '2025-01-02' },
    { id: 'orphan', type: 'practice_debrief' },
  ]);
  expect(steps[0].messages.map(m => m.id)).toEqual(['doc', 'version2']);
  expect(steps[1].messages).toEqual([]);
  expect(steps[2].messages[0].id).toBe('orphan');
});

test('does not count a copied first answer or use the latest answer as first-attempt evidence', () => {
  const message = { type: 'study_exam', timestamp: '2026-09-28T12:00:00Z', studyContent: { questions: [{ question: 'New question' }] },
    quizProgress: { firstAttemptAnswers: { 0: { correct: true, recordedAt: '2026-09-28T11:00:00Z' } }, answers: { 0: { isCorrect: false } } } };
  expect(answerEvidence(message, 0)).toMatchObject({ stale: true, firstCorrect: null, latestCorrect: false });
  delete message.quizProgress.firstAttemptAnswers;
  expect(answerEvidence(message, 0)).toMatchObject({ firstCorrect: null, latestCorrect: false });
});

test('marks contradictory first-attempt fields without choosing a score', () => {
  expect(answerEvidence({ type: 'study_quiz', quizProgress: { firstAttemptStatuses: { 0: 'correct' }, firstAttemptAnswers: { 0: { correct: false } } } }, 0))
    .toMatchObject({ conflict: true, firstCorrect: null });
});

test('shows chat extensions once and separates first answers from corrected answers', () => {
  const message = { type: 'quiz', quizData: [{ question: 'Q1' }], practice: { questions: [{ question: 'Q1' }, { question: 'Q2' }],
    firstAnswers: { 1: { isCorrect: false } }, answers: { 1: { isCorrect: true } } } };
  expect(questionsOf(message)).toHaveLength(2);
  expect(answerEvidence(message, 1)).toMatchObject({ firstCorrect: false, latestCorrect: true });
});

test('keeps unknown times undated and preserves conflicting evidence in the timeline', () => {
  const timeline = buildTimeline({ createdAt: '2026-09-20', study: { path: { nodes: [{ id: 'n', label: 'Step' }] } } }, [
    { id: 'm', nodeId: 'n', timestamp: '2026-09-22', answerRecords: {
      first: { 0: { correct: true, recordedAt: '2026-09-21' } }, latest: { 0: { isCorrect: false } },
    } },
  ]);
  expect(timeline.find(e => e.id === 'first:m:0').warning).toBe(true);
  expect(timeline.at(-1)).toMatchObject({ id: 'latest:m:0', at: undefined });
  expect(timeline.some(e => e.label.includes('clicked'))).toBe(false);
});

test('renders zero-index, select-all, ordering and matrix evidence', () => {
  const question = { options: ['Assess', 'Act'] };
  expect(selectionText({ selection: 0 }, question)).toBe('Assess');
  expect(selectionText({ selectedIndices: [0, 1] }, question)).toBe('Assess\nAct');
  expect(answerKey({ ...question, correctOrder: [1, 0] })).toBe('Act\nAssess');
  const matrix = { rows: [{ id: 'r', text: 'Sign', correctColumnId: 'yes' }], columns: [{ id: 'yes', label: 'Present' }] };
  expect(selectionText({ selectedRows: { r: 'yes' } }, matrix)).toBe('Sign: Present');
  expect(answerKey(matrix)).toBe('Sign: Present');
  expect(answerKey({ answer: '["Assess", "Act"]' })).toBe('Assess\nAct');
});

test('generated lessons are not counted as student engagement; copied answers are excluded', () => {
  const chat = { study: { path: { nodes: [{ id: 'lesson', type: 'lesson' }, { id: 'quiz', type: 'quiz' }] } } };
  const messages = [{ id: 'l', nodeId: 'lesson', timestamp: '2026-09-22' },
    { id: 'q', nodeId: 'quiz', timestamp: '2026-09-22', answerRecords: { first: { 0: { correct: true, recordedAt: '2026-09-21' } } } }];
  const rows = journeyRows(buildSteps(chat, messages), buildTimeline(chat, messages));
  expect(rows[0]).toMatchObject({ hasActivity: false, statusLabel: 'Content saved · use not confirmed' });
  expect(rows[1]).toMatchObject({ hasActivity: false, answerCount: 0, warnings: 1 });
});

test('question review separates changed answers, uncertain first scores and student help requests', () => {
  const rows = questionReview({ message: { type: 'study_quiz', studyContent: { questions: [{}, {}] },
    quizProgress: { firstAttemptAnswers: { 0: { correct: false }, 1: { correct: false } },
      firstAttemptStatuses: { 1: 'correct' }, matrixAnswers: { 0: { isCorrect: true, selectedIndices: [0, 1] } } } },
    discussions: [{ id: '0', history: [{ role: 'user', content: 'Why is that first?' }, { role: 'assistant', content: 'Check the sequence.' }] }] });
  expect(rows[0]).toMatchObject({ label: 'Wrong initially · latest correct', evidence: { firstCorrect: false, latestCorrect: true } });
  expect(rows[0].studentTurns).toHaveLength(1);
  expect(rows[1]).toMatchObject({ label: 'First result uncertain', evidence: { firstCorrect: null } });
});
