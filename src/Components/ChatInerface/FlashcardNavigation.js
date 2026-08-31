import React from 'react';
import './FlashcardNavigation.css';

/**
 * FlashcardNavigation - Clean sidebar navigation for flashcards
 */
function FlashcardNavigation({
  flashcards,
  currentIndex,
  onNavigate
}) {
  if (!flashcards || flashcards.length === 0) {
    return null;
  }

  const handleCardClick = (index) => {
    if (onNavigate) {
      onNavigate(index);
    }
  };

  // Count cards by status
  const knownCount = flashcards.filter(card =>
    card.userReview?.knowIt || card.status === 'mastered'
  ).length;

  const reviewCount = flashcards.filter(card =>
    card.userReview && !card.userReview.knowIt && card.status !== 'mastered'
  ).length;

  const newCount = flashcards.length - knownCount - reviewCount;

  // Get status for a card
  const getCardStatus = (card) => {
    if (card.status === 'mastered' || card.userReview?.knowIt) return 'known';
    if (card.userReview && !card.userReview.knowIt) return 'review';
    return 'new';
  };

  return (
    <div className="flashcard-nav">
      {/* Progress header */}
      <div className="flashcard-nav-header">
        <div className="nav-stat">
          <span className="nav-dot known"></span>
          <span className="nav-value">{knownCount}</span>
        </div>
        <div className="nav-stat">
          <span className="nav-dot review"></span>
          <span className="nav-value">{reviewCount}</span>
        </div>
        <div className="nav-stat">
          <span className="nav-dot new"></span>
          <span className="nav-value">{newCount}</span>
        </div>
      </div>

      {/* Card Grid */}
      <div className="flashcard-nav-grid">
        {flashcards.map((card, index) => {
          const isActive = index === currentIndex;
          const status = getCardStatus(card);

          return (
            <button
              key={index}
              className={`nav-card-btn ${isActive ? 'active' : ''} status-${status}`}
              onClick={() => handleCardClick(index)}
              aria-label={`Card ${index + 1}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FlashcardNavigation;
