import { auth, db } from '../Firebase/config';
import { collection, doc, getDocs, limit, query, runTransaction, where } from 'firebase/firestore';
import { API_BASE_URL } from './config';

export async function saveFlashcardReview(chatId, messageId, review) {
  if (!auth.currentUser) throw new Error('Sign in to save your review.');
  const matches = await getDocs(query(collection(db, 'chats', chatId, 'messages'), where('id', '==', messageId), limit(1)));
  const ref = matches.empty ? doc(db, 'chats', chatId, 'messages', messageId) : matches.docs[0].ref;
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const raw = snapshot.data()?.flashcardData;
    let cards = raw;
    if (typeof raw === 'string') { try { cards = JSON.parse(raw); } catch (_) { cards = null; } }
    const fields = { flashcardReview: JSON.parse(JSON.stringify(review)) };
    // Read the latest deck in the transaction so new streamed cards survive.
    // Keep the legacy review fields in sync for existing progress consumers.
    if (Array.isArray(cards)) fields.flashcardData = cards.map((card, index) => {
      const rating = review.ratings[index];
      return rating ? { ...card, userReview: { rating: rating.rating, knowIt: rating.rating === 'got', timestamp: rating.lastReviewed || null },
        status: rating.streak >= 3 ? 'mastered' : 'learning', reviewCount: rating.attempts || 1,
        lastReviewed: rating.lastReviewed || null, nextReviewAt: rating.nextReviewAt || null } : card;
    });
    transaction.set(ref, fields, { merge: true });
  });
}

export async function askFlashcardTutor(body, signal) {
  if (!auth.currentUser) throw new Error('Sign in to talk to your tutor.');
  const response = await fetch(`${API_BASE_URL}/flashcards/tutor`, { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
    body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Your tutor could not respond. Please retry.');
  return data;
}
