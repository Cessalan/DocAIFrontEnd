import { saveFlashcardReview } from './FlashcardPracticeService';
import { getDocs, runTransaction } from 'firebase/firestore';
jest.mock('../Firebase/config', () => ({ auth: { currentUser: { uid: 'owner' } }, db: {} }));
jest.mock('./config', () => ({ API_BASE_URL: 'http://localhost:8000' }));
jest.mock('firebase/firestore', () => ({ getDocs: jest.fn(), runTransaction: jest.fn(),
  collection: jest.fn(), doc: jest.fn(() => 'direct-ref'), limit: jest.fn(), query: jest.fn(), where: jest.fn() }));

test('saves to legacy message ID while preserving new cards and original timestamp', async () => {
  const cards = [{ front: 'First', back: 'One' }, { front: 'Just streamed', back: 'Two' }];
  getDocs.mockResolvedValue({ empty: false, docs: [{ ref: 'legacy-ref' }] });
  const transaction = { get: jest.fn().mockResolvedValue({ data: () => ({ flashcardData: cards, timestamp: 'original' }) }), set: jest.fn() };
  runTransaction.mockImplementation((db, callback) => callback(transaction));
  const review = { ratings: { 0: { rating: 'almost', attempts: 1, streak: 0, nextReviewAt: 'tomorrow' } }, session: { cursor: 1 } };
  await saveFlashcardReview('chat', 'deck', review);
  expect(transaction.get).toHaveBeenCalledWith('legacy-ref');
  const [ref, patch, options] = transaction.set.mock.calls[0];
  expect(ref).toBe('legacy-ref');
  expect(options).toEqual({ merge: true });
  expect(patch).not.toHaveProperty('timestamp');
  expect(patch.flashcardData[1]).toEqual(cards[1]);
  expect(patch.flashcardData[0]).toMatchObject({ status: 'learning', userReview: { knowIt: false, rating: 'almost' } });
  expect(patch.flashcardReview.session.cursor).toBe(1);
});
