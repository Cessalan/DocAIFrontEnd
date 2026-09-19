import { getTopicProgress, savePracticeAttempt } from './TopicProgressService';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { PracticeAttemptRecord } from './topicProgressModel';

jest.mock('../Firebase/config', () => ({ db: 'db', auth: { currentUser: { uid: 'student' } } }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), runTransaction: jest.fn() }));
let stored;
const root = 'db/users/student/studyPerformance/chat/quickChecks/check';
const snapshot = path => ({ exists: () => stored.has(path), data: () => stored.get(path) });
const q = text => ({ question: text, options: ['A', 'B', 'C', 'D'] });
const attempt = (id, questions, statuses) => new PracticeAttemptRecord({ checkId: 'check', node: { id, type: 'quiz', topic: 'ABCDE', topicKey: 'abcde' }, content: { questions }, progress: { firstAttemptStatuses: statuses } });
beforeEach(() => {
  stored = new Map([[root, { answers: [{ ...q('Baseline'), topic: 'ABCDE', correct: false }] }]]);
  doc.mockImplementation((...parts) => parts.join('/'));
  getDoc.mockImplementation(async path => snapshot(path));
  runTransaction.mockImplementation(async (db, callback) => callback({ get: async path => snapshot(path), set: (path, value) => stored.set(path, value) }));
});

test('ignores baseline repeats and duplicates, persists fresh counts, and restores on reload', async () => {
  const record = attempt('n1', [q('Baseline'), q('Fresh'), q('Fresh')], { 0: 'correct', 1: 'incorrect', 2: 'correct' });
  let result = await savePracticeAttempt('chat', record);
  expect(result.latest.abcde).toMatchObject({ correct: 0, answered: 1 });
  result = await savePracticeAttempt('chat', record);
  expect(result.latest.abcde.answered).toBe(1);
  await savePracticeAttempt('chat', attempt('n2', [q('Fresh'), q('New')], { 0: 'correct', 1: 'correct' }));
  const restored = await getTopicProgress('chat', 'check');
  expect(restored.latest.abcde).toMatchObject({ correct: 1, answered: 1, nodeId: 'n2' });
  expect(restored.baseline.abcde).toMatchObject({ correct: 0, answered: 1 });
});
test('does not invent a baseline for older plans or record ungraded lessons', async () => {
  expect(await getTopicProgress('chat', null)).toBeNull();
  const record = new PracticeAttemptRecord({ checkId: 'check', node: { id: 'lesson', type: 'lesson' } });
  expect(await savePracticeAttempt('chat', record)).toBeNull();
});
