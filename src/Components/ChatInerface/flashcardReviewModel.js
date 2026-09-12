import { toDisplayText } from './flashcardText';

export function cleanCardTopic(value) {
  const text = toDisplayText(value).trim();
  return !text || /none yet|creating the first topic|existing_topics|category\/subject|^general$|^flashcards?$/i.test(text) ? '' : text;
}

export function deckTitle(message, cards, fallback = 'Your study notes') {
  const explicit = cleanCardTopic(message.flashcardTopic || message.topic);
  if (explicit) return explicit;
  const topics = [...new Set(cards.map(card => cleanCardTopic(card.topic)).filter(Boolean))];
  return topics.slice(0, 2).join(' · ') || fallback;
}

export function initialCardReview(cards, saved = {}) {
  const ratings = { ...saved.ratings };
  cards.forEach((card, index) => {
    if (!ratings[index] && card.userReview) ratings[index] = {
      rating: card.userReview.rating || (card.userReview.knowIt ? 'got' : 'again'),
      nextReviewAt: card.nextReviewAt || null, attempts: card.reviewCount || 1,
    };
  });
  return { ...saved, ratings, discussions: saved.discussions || {}, session: saved.session || null };
}

export function startCardSession(cards, state, mode = 'all', now = Date.now()) {
  let queue = cards.map((_, i) => i);
  if (mode === 'weak') queue = queue.filter(i => state.ratings[i]?.rating !== 'got');
  if (mode === 'due') queue = queue.filter(i => !state.ratings[i] || (state.ratings[i].nextReviewAt && Date.parse(state.ratings[i].nextReviewAt) <= now));
  return { ...state, session: { queue, knownCount: cards.length, cursor: 0, repeated: [], firstRatings: {}, revealed: false, complete: !queue.length } };
}

export function rateCard(state, rating, now = Date.now()) {
  const session = state.session;
  if (!session || session.complete || !session.revealed || !['again', 'almost', 'got'].includes(rating)) return state;
  const index = session.queue[session.cursor];
  const previous = state.ratings[index] || {};
  const streak = rating === 'got' ? (previous.streak || 0) + 1 : 0;
  const days = rating === 'got' ? Math.min(30, 2 ** (streak - 1)) : rating === 'almost' ? 1 : 0;
  const nextReviewAt = new Date(now + (days ? days * 86400000 : 600000)).toISOString();
  const queue = [...session.queue], repeated = [...session.repeated];
  if (rating !== 'got' && !repeated.includes(index)) { queue.push(index); repeated.push(index); }
  const cursor = session.cursor + 1;
  return { ...state, ratings: { ...state.ratings, [index]: { rating, streak, nextReviewAt,
    lastReviewed: new Date(now).toISOString(), attempts: (previous.attempts || 0) + 1 } },
    session: { ...session, queue, repeated, cursor, revealed: false, complete: cursor >= queue.length,
      firstRatings: { ...session.firstRatings, [index]: session.firstRatings[index] || rating } } };
}

// New streamed cards join the current round; a retry never duplicates an index.
export function includeStreamedCards(state, count) {
  if (!state.session) return state;
  const queue = [...state.session.queue];
  const knownCount = state.session.knownCount ?? Math.max(0, ...queue.map(i => i + 1));
  for (let i = knownCount; i < count; i++) if (!queue.includes(i)) queue.push(i);
  return queue.length === state.session.queue.length ? state : { ...state, session: {
    ...state.session, queue, knownCount: count, complete: state.session.cursor >= queue.length,
  } };
}
