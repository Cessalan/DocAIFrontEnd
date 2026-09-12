import { cleanCardTopic, deckTitle, initialCardReview, startCardSession, rateCard, includeStreamedCards } from './flashcardReviewModel';

const cards = [{ front: 'One?', back: 'First', topic: 'None yet - you are creating the first topic' }, { front: 'Two?', back: 'Second', topic: 'Trauma assessment' }];
const answer = (state, rating) => rateCard({ ...state, session: { ...state.session, revealed: true } }, rating, 1000000);

test('legacy placeholders never become deck subjects', () => {
  expect(cleanCardTopic(cards[0].topic)).toBe('');
  expect(deckTitle({}, cards)).toBe('Trauma assessment');
  expect(deckTitle({}, [{ topic: { unexpected: true } }])).toBe('Your study notes');
});

test('missed cards return once, remain answer-hidden, and never trap the student in an endless loop', () => {
  let state = startCardSession(cards, initialCardReview(cards));
  expect(rateCard(state, 'got')).toBe(state);
  state = answer(state, 'again');
  expect(state.session.queue).toEqual([0, 1, 0]);
  expect(state.session.revealed).toBe(false);
  state = answer(state, 'almost');
  state = answer(state, 'again');
  state = answer(state, 'got');
  expect(state.session.complete).toBe(true);
  expect(state.session.queue).toEqual([0, 1, 0, 1]);
  expect(state.session.firstRatings).toEqual({ 0: 'again', 1: 'almost' });
  expect(state.ratings[0].rating).toBe('again');
});

test('recall choices save different next review dates and resume from serialized state', () => {
  const base = startCardSession(cards, initialCardReview(cards));
  const again = answer(base, 'again'), got = answer(base, 'got');
  expect(Date.parse(again.ratings[0].nextReviewAt)).toBe(1600000);
  expect(Date.parse(got.ratings[0].nextReviewAt)).toBe(87400000);
  expect(initialCardReview(cards, JSON.parse(JSON.stringify(again)))).toEqual(again);
  expect(startCardSession(cards, got, 'due', 2000000).session.queue).toEqual([1]);
});

test('streamed cards join without losing pending retries', () => {
  let state = answer(startCardSession(cards, initialCardReview(cards)), 'again');
  state = includeStreamedCards(state, 3);
  expect(state.session.queue).toEqual([0, 1, 0, 2]);
  expect(includeStreamedCards(state, 3)).toBe(state);
});

test('legacy reviewed cards migrate without revealing answers at the start of another round', () => {
  const old = [{ userReview: { knowIt: false } }, { userReview: { knowIt: true } }];
  const state = startCardSession(old, initialCardReview(old), 'weak');
  expect(state.session.queue).toEqual([0]);
  expect(state.session.revealed).toBe(false);
  expect(includeStreamedCards(state, 2)).toBe(state);
});
