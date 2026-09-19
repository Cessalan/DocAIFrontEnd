import { PracticeAttemptRecord, compareTopicResult, baselineTopics } from './topicProgressModel';

const input = { checkId: 'check', node: { id: 'quiz', type: 'quiz', topic: 'ABCDE', topicKey: 'abcde' },
  content: { questions: [{ question: 'First?', options: ['A', 'B', 'C', 'D'] }] },
  progress: { questionStatuses: { 0: 'correct' }, firstAttemptStatuses: { 0: 'incorrect' } } };

test('uses first attempts even when a retry became correct', () => {
  expect(new PracticeAttemptRecord(input).answers[0].correct).toBe(false);
});
test('does not infer a first pass from mutable review statuses or unfinished content', () => {
  expect(new PracticeAttemptRecord({ ...input, progress: { questionStatuses: { 0: 'correct' } } }).answers).toEqual([]);
  expect(new PracticeAttemptRecord({ ...input, content: { questions: [...input.content.questions, { question: 'Next?' }] } }).answers).toEqual([]);
});
test('records fully correct exam answers separately from partial credit', () => {
  const record = new PracticeAttemptRecord({ ...input, node: { ...input.node, type: 'exam' },
    progress: { answers: { 0: { isCorrect: false, isPartial: true, score: 2, maxScore: 3 } } } });
  expect(record.answers[0]).toMatchObject({ correct: false, partial: true });
});
test('reports higher, lower and unchanged accuracy without assuming mastery', () => {
  const baseline = { correct: 1, answered: 4 };
  expect(compareTopicResult(baseline, { correct: 4, answered: 5 })).toMatchObject({ delta: 55, direction: 'higher' });
  expect(compareTopicResult(baseline, { correct: 0, answered: 5 }).direction).toBe('lower');
  expect(compareTopicResult(baseline, { correct: 2, answered: 8 }).direction).toBe('same');
  expect(compareTopicResult(null, { correct: 4, answered: 5 })).toBeNull();
});
test('does not merge similarly named subjects or count partial credit as correct', () => {
  const topics = baselineTopics({ answers: [{ topic: 'Sleep', correct: false, partial: true }, { topic: 'Sleep apnea', correct: true }] });
  expect(Object.keys(topics)).toHaveLength(2);
  expect(topics.sleep.correct).toBe(0);
});
