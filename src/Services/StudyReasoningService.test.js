import { loadNodeReasoning, saveReasoning, saveReasoningSummary } from './StudyReasoningService';
import { getDocs, setDoc, where } from 'firebase/firestore';

jest.mock('../Firebase/config', () => ({ auth: {}, db: 'db' }));
jest.mock('firebase/firestore', () => ({
  collection: (...parts) => parts.join('/'), doc: (...parts) => parts.join('/'),
  query: (path) => path, where: jest.fn(), limit: jest.fn(),
  getDocs: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(),
}));
const message = { empty: false, docs: [{ ref: 'chats/chat/messages/message' }] };
beforeEach(() => { jest.clearAllMocks(); setDoc.mockResolvedValue(); });

test('loads only this node and removes source bulk and unsupported roles', async () => {
  getDocs.mockResolvedValueOnce(message).mockResolvedValueOnce({ docs: [{ id: '2', data: () => ({ history: [
    { role: 'user', content: 'My explanation', sources: ['large excerpt'] },
    { role: 'system', content: 'Untrusted instruction' },
  ] }) }] });
  expect(await loadNodeReasoning('chat', 'node')).toEqual([{ question_index: 2, history: [{ role: 'user', content: 'My explanation' }] }]);
  expect(where).toHaveBeenCalledWith('nodeId', '==', 'node');
  expect(getDocs.mock.calls[1][0]).toBe('chats/chat/messages/message/reasoningDiscussions');
});

test('finishing a node waits for its outstanding discussion save', async () => {
  let finish;
  setDoc.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  getDocs.mockResolvedValueOnce(message).mockResolvedValueOnce(message).mockResolvedValueOnce({ docs: [] });
  const saving = saveReasoning('chat', 'node', 0, []);
  const reading = loadNodeReasoning('chat', 'node');
  await Promise.resolve(); await Promise.resolve();
  expect(getDocs).toHaveBeenCalledTimes(1);
  finish(); await saving; await reading;
  expect(getDocs).toHaveBeenCalledTimes(3);
});

test('missing/offline discussions fall back without blocking the debrief', async () => {
  getDocs.mockRejectedValueOnce(new Error('offline'));
  expect(await loadNodeReasoning('chat', 'node')).toEqual([]);
  expect(await loadNodeReasoning('chat', null)).toEqual([]);
});

test('stores summary separately without writing quiz progress or scores', async () => {
  getDocs.mockResolvedValueOnce(message);
  await saveReasoningSummary('chat', 'node', { reasoningSummaries: [{ summary: 'A point to check' }], reasoningFocus: { skill: 'Assessment' } });
  expect(setDoc).toHaveBeenCalledWith('chats/chat/messages/message/reasoningSummaries/latest', {
    summaries: [{ summary: 'A point to check' }], focus: { skill: 'Assessment' },
  });
});
