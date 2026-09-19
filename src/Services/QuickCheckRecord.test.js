import { QuestionAnswerRecord, QuickCheckRecord } from './QuickCheckRecord';

const question = { topic: 'ABCDE', question: 'Choose actions', options: ['A', 'B', 'C', 'D'], format: 'sata', correctIndices: [0, 1], concept: 'Airway', kind: 'prioritization' };
const answer = (overrides = {}) => new QuestionAnswerRecord({ checkId: 'check-1', questionIndex: 0, question, selection: [0], grade: { correct: false, partial: true }, ...overrides });

test('retains selected options, key and metadata in plain data without sharing input arrays', () => {
  const selected = [0];
  const row = answer({ selection: selected });
  selected.push(2);
  expect(row.toJSON()).toMatchObject({ topic: 'ABCDE', topicKey: 'abcde', selection: [0], correctIndices: [0, 1], concept: 'Airway', kind: 'prioritization', partial: true, correct: false, difficulty: null, attempt: 1 });
  expect(Object.getPrototypeOf(row.toJSON())).toBe(Object.prototype);
});

test('separates subjects and preserves partial and unsure evidence in an early-ended baseline', () => {
  const record = new QuickCheckRecord({ checkId: 'check-1', chatId: 'chat', offered: 8, answers: [answer(), answer({ questionIndex: 1, question: { ...question, topic: 'ABCDE advanced' }, selection: 'unsure', grade: { correct: false, partial: false } })] }).toJSON();
  expect(record.completion).toBe('ended_early');
  expect(record.topics).toEqual([
    { topicKey: 'abcde', name: 'ABCDE', answered: 1, correct: 0, partial: 1, unsure: 0 },
    { topicKey: 'abcde advanced', name: 'ABCDE advanced', answered: 1, correct: 0, partial: 0, unsure: 1 },
  ]);
});

test('rejects duplicate answers, foreign checks and empty baselines', () => {
  const build = answers => new QuickCheckRecord({ checkId: 'check-1', chatId: 'chat', offered: 8, answers });
  expect(() => build([answer(), answer()])).toThrow();
  expect(() => build([answer({ checkId: 'other' })])).toThrow();
  expect(() => build([])).toThrow();
});

test('fingerprint catches reordered identical options but keeps different scenarios distinct', () => {
  expect(answer().questionFingerprint).toBe(answer({ question: { ...question, options: [...question.options].reverse() } }).questionFingerprint);
  expect(answer().questionFingerprint).not.toBe(answer({ question: { ...question, scenario: 'Another patient' } }).questionFingerprint);
});
