import { isFlashcardDeckMastered, isCardRecalled, firstAnswers } from './flashcardDeckModel';

describe('isCardRecalled', () => {
  it('reads the words the flashcard card actually saves', () => {
    expect(isCardRecalled('mastered')).toBe(true);
    expect(isCardRecalled('review')).toBe(false);
  });

  it('still accepts the older word, and nothing else', () => {
    expect(isCardRecalled('got_it')).toBe(true);
    expect(isCardRecalled('need_review')).toBe(false);
    expect(isCardRecalled(undefined)).toBe(false);
  });
});

describe('isFlashcardDeckMastered', () => {
  it('is not mastered while cards are still arriving, even at 1 of 1', () => {
    expect(isFlashcardDeckMastered({ masteredCount: 1, totalCards: 1, isStreaming: true })).toBe(false);
    expect(isFlashcardDeckMastered({ masteredCount: 4, totalCards: 4, isStreaming: true })).toBe(false);
  });

  it('is mastered once the stream has ended and every card is mastered', () => {
    expect(isFlashcardDeckMastered({ masteredCount: 5, totalCards: 5, isStreaming: false })).toBe(true);
  });

  it('accepts a short deck: the stream ended with fewer cards than planned', () => {
    expect(isFlashcardDeckMastered({ masteredCount: 2, totalCards: 2, isStreaming: false })).toBe(true);
  });

  it('is not mastered with cards left to review', () => {
    expect(isFlashcardDeckMastered({ masteredCount: 3, totalCards: 5, isStreaming: false })).toBe(false);
  });

  it('never calls an empty deck mastered', () => {
    expect(isFlashcardDeckMastered({ masteredCount: 0, totalCards: 0, isStreaming: false })).toBe(false);
    expect(isFlashcardDeckMastered()).toBe(false);
  });
});

describe('firstAnswers', () => {
  it('prefers her first answer over the final, always-mastered statuses', () => {
    const progress = {
      cardStatuses: { 0: 'mastered', 1: 'mastered' },
      firstPassStatuses: { 0: 'mastered', 1: 'review' },
    };
    expect(firstAnswers(progress)).toEqual({ 0: 'mastered', 1: 'review' });
  });

  it('falls back to the final statuses for progress saved before first answers existed', () => {
    expect(firstAnswers({ cardStatuses: { 0: 'mastered' } })).toEqual({ 0: 'mastered' });
    expect(firstAnswers({ cardStatuses: { 0: 'mastered' }, firstPassStatuses: {} })).toEqual({ 0: 'mastered' });
    expect(firstAnswers(undefined)).toEqual({});
  });
});
