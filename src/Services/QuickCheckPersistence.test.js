import { saveQuickCheckRecord, createStudySession, saveQuizProgress, insertNodeAfterCurrent } from './StudySessionService';
import { runTransaction, doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth } from '../Firebase/config';

jest.mock('../Firebase/config', () => ({ db: {}, auth: { currentUser: { uid: 'student' } }, storage: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(() => 'target'), getDoc: jest.fn(), runTransaction: jest.fn(), updateDoc: jest.fn(), serverTimestamp: jest.fn(() => 'now') }));

beforeEach(() => { jest.clearAllMocks(); doc.mockReturnValue('target'); auth.currentUser = { uid: 'student' }; });

test('saves the detour between the current activity and its original next step', async () => {
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ study: { path: { nodes: [
    { id: 'review', type: 'lesson', status: 'active' }, { id: 'quiz', type: 'quiz', status: 'locked' },
  ] } } }) });
  const detour = { fromNodeId: 'review', returnNodeId: 'quiz' };
  const result = await insertNodeAfterCurrent('chat', 'review', { type: 'flashcard', label: 'Airway', detour });
  expect(result.updatedNodes.map(node => node.id)).toEqual(['review', result.insertedNode.id, 'quiz']);
  expect(result.insertedNode.detour).toEqual(detour);
  expect(updateDoc).toHaveBeenCalledWith('target', expect.objectContaining({
    'study.path.nodes': expect.arrayContaining([expect.objectContaining({ detour })]),
  }));
});

test('persists original selections and mini-test answers for resume', async () => {
  const firstAttemptAnswers = { 0: { correct: false, partial: true, selection: [1] } };
  const answers = { 0: { isCorrect: false, selectedIndices: [1], isPartial: true } };
  await saveQuizProgress('chat', 'message', { firstAttemptAnswers, answers, currentIndex: 1 });
  expect(updateDoc).toHaveBeenCalledWith('target', { quizProgress: expect.objectContaining({ firstAttemptAnswers, answers, currentIndex: 1 }) });
});

test('writes a new baseline and leaves the existing baseline untouched on retry', async () => {
  let saved;
  const transaction = { get: jest.fn(async () => ({ exists: () => !!saved })), set: jest.fn((target, value) => { saved = value; }) };
  runTransaction.mockImplementation((db, callback) => callback(transaction));
  const data = { chatId: 'chat', checkId: 'check', answers: [{ correct: false }] };
  const record = { toJSON: () => data };
  await saveQuickCheckRecord(record);
  await saveQuickCheckRecord({ toJSON: () => ({ ...data, answers: [{ correct: true }] }) });
  expect(doc).toHaveBeenCalledWith({}, 'users', 'student', 'studyPerformance', 'chat', 'quickChecks', 'check');
  expect(transaction.set).toHaveBeenCalledTimes(1);
  expect(saved.answers[0].correct).toBe(false);
});

test('does not attempt persistence without an authenticated student', async () => {
  auth.currentUser = null;
  await expect(saveQuickCheckRecord({ toJSON: () => ({}) })).rejects.toThrow('User not authenticated');
  expect(runTransaction).not.toHaveBeenCalled();
});

test('preserves the backend topic and evidence on saved study steps', async () => {
  const reviewReason = { source: 'quick_check', checkId: 'check', topic: 'ABCDE', correct: 0, answered: 4 };
  const result = await createStudySession('chat', { quickCheckId: 'check', topics: ['ABCDE'], nodes: [{ id: 'lesson', type: 'lesson', label: 'Review ABCDE', topic: 'ABCDE', topicKey: 'abcde', reviewReason }] });
  expect(result.path.quickCheckId).toBe('check');
  expect(result.path.nodes[0]).toMatchObject({ topic: 'ABCDE', topicKey: 'abcde', reviewReason });
  expect(updateDoc).toHaveBeenCalledWith('target', expect.objectContaining({ study: expect.objectContaining({ path: expect.objectContaining({ nodes: expect.arrayContaining([expect.objectContaining({ reviewReason })]) }) }) }));
});
