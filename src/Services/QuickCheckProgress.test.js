import { SaveQuickCheckProgress } from './FireBaseServiceChats';
import { doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';

jest.mock('../Firebase/config', () => ({ db: {}, auth: {}, storage: {} }));
jest.mock('./FastAPICalls', () => ({ generate_title: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...parts) => parts.slice(1).join('/')),
  collection: jest.fn(), query: jest.fn(), where: jest.fn(),
  getDoc: jest.fn(), getDocs: jest.fn(), updateDoc: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  doc.mockImplementation((...parts) => parts.slice(1).join('/'));
  getDoc.mockResolvedValue({ exists: () => true });
  updateDoc.mockResolvedValue(undefined);
});

it('serializes saves and writes only the checkpoint without moving or reviving the message', async () => {
  let release;
  let started;
  const writing = new Promise(resolve => { started = resolve; });
  updateDoc.mockImplementationOnce(() => new Promise(resolve => { release = resolve; started(); }));
  const first = SaveQuickCheckProgress('chat', 'upload', { progress: { answers: [1] } });
  const second = SaveQuickCheckProgress('chat', 'upload', { progress: { answers: [1, 2] } });
  await writing;
  expect(updateDoc).toHaveBeenCalledTimes(1);
  release();
  await Promise.all([first, second]);
  expect(updateDoc).toHaveBeenNthCalledWith(2, 'chats/chat/messages/upload', {
    quickCheck: { progress: { answers: [1, 2] } },
  });
});

it('resolves legacy message IDs and retries a failed save', async () => {
  getDoc.mockResolvedValue({ exists: () => false });
  getDocs.mockResolvedValue({ empty: false, docs: [{ ref: 'actual-message-ref' }] });
  updateDoc.mockRejectedValueOnce(new Error('temporary failure'));
  await SaveQuickCheckProgress('chat', 'legacy', { version: 1 });
  expect(updateDoc).toHaveBeenCalledTimes(2);
  expect(updateDoc).toHaveBeenLastCalledWith('actual-message-ref', { quickCheck: { version: 1 } });
});

it('does not write a checkpoint to another upload when a message is missing', async () => {
  getDoc.mockResolvedValue({ exists: () => false });
  getDocs.mockResolvedValue({ empty: true });
  await expect(SaveQuickCheckProgress('chat', 'missing', {})).rejects.toThrow('Quick-check message not found');
  expect(updateDoc).not.toHaveBeenCalled();
});
