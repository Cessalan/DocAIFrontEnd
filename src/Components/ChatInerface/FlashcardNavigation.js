import React from 'react';
import './FlashcardNavigation.css';

function FlashcardNavigation({ flashcards, currentIndex, onNavigate }) {
  if (!flashcards || flashcards.length === 0) {
    return null;
  }

  const handleCardClick = (index) => {
    if (onNavigate) {
      onNavigate(index);
    }
  };

  return (
    <div className="flashcard-navigation">
      <div className="flashcard-nav-title">Cards</div>
      <div className="flashcard-nav-list">
        {flashcards.map((card, index) => {
          const isActive = index === currentIndex;
          const isReviewed = card.userReview !== undefined && card.userReview !== null;
          const knowIt = card.userReview?.knowIt;
          const isMastered = card.status === 'mastered';
          const isLearning = card.status === 'learning';

          let statusClass = 'flashcard-nav-status-new';
          let statusIcon = '🆕';

          if (isMastered) {
            statusClass = 'flashcard-nav-status-mastered';
            statusIcon = '✅';
          } else if (isLearning) {
            statusClass = 'flashcard-nav-status-learning';
            statusIcon = '📘';
          } else if (isReviewed) {
            if (knowIt) {
              statusClass = 'flashcard-nav-status-know';
              statusIcon = '✓';
            } else {
              statusClass = 'flashcard-nav-status-again';
              statusIcon = '↻';
            }
          }

          return (
            <button
              key={index}
              className={`flashcard-nav-item ${isActive ? 'active' : ''} ${statusClass}`}
              onClick={() => handleCardClick(index)}
              title={card.topic || `Card ${index + 1}`}
            >
              <span className="flashcard-nav-number">{index + 1}</span>
              <span className="flashcard-nav-icon">{statusIcon}</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flashcard-nav-legend">
        <div className="flashcard-legend-title">Status:</div>
        <div className="flashcard-legend-item">
          <span className="flashcard-legend-icon">🆕</span>
          <span className="flashcard-legend-text">New</span>
        </div>
        <div className="flashcard-legend-item">
          <span className="flashcard-legend-icon">📘</span>
          <span className="flashcard-legend-text">Learning</span>
        </div>
        <div className="flashcard-legend-item">
          <span className="flashcard-legend-icon">✅</span>
          <span className="flashcard-legend-text">Mastered</span>
        </div>
      </div>
    </div>
  );
}

export default FlashcardNavigation;
