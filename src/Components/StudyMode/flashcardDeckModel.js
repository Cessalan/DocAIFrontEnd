/**
 * When is a flashcard step finished?
 *
 * Cards stream in one at a time, so "every card I have is mastered" is true
 * the moment she taps "Got it" on the only card that has arrived. That used
 * to fire the completion screen with the rest of the deck still on its way:
 * a five-card step could end after one card, before its content was saved.
 * (Cancellation survey, 2026-11-14: "the flashcards are not loading".)
 *
 * A deck is mastered only when nothing more is coming and every card that
 * exists is mastered. An empty deck is never mastered.
 */
/**
 * Did she recall this card?
 *
 * The card component stores 'mastered' / 'review'. The result screen used to
 * look for 'got_it', a word nothing ever saved, so every finished deck read
 * as zero recalled: five cards marked "Got it" came back as "5 cards marked
 * for review" and an offer of a guided review (found 2026-11-16 replaying a
 * cancelled student's flashcard step). 'got_it' stays accepted in case any
 * older saved progress carries it.
 */
export function isCardRecalled(status) {
  return status === 'mastered' || status === 'got_it';
}

export function isFlashcardDeckMastered({ masteredCount = 0, totalCards = 0, isStreaming = false } = {}) {
  if (isStreaming) return false;
  if (totalCards <= 0) return false;
  return masteredCount >= totalCards;
}

/**
 * The statuses a result screen should report: her first answer per card.
 *
 * A deck cannot end until every card is 'mastered' (missed cards come back in
 * a review round), so the final statuses always read N of N. Progress saved
 * before first answers were recorded has only the final statuses; those are
 * used as they are.
 */
export function firstAnswers(progress) {
  const first = progress?.firstPassStatuses;
  if (first && Object.keys(first).length > 0) return first;
  return progress?.cardStatuses || {};
}
