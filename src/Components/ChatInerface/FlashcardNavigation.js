import React from 'react';
import { useTranslation } from 'react-i18next';
import './FlashcardNavigation.css';
import FlashcardFeedback from './FlashcardFeedback';

function FlashcardNavigation({ flashcards, currentIndex, onNavigate, onFeedbackSubmit, hasGivenFeedback, feedbackData }) {
  const { t } = useTranslation();
  const isDev = process.env.NODE_ENV === 'development';
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
      <div className="flashcard-nav-title">{t('flashcardNavigation.cards', 'Cards')}</div>
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
        <div className="flashcard-legend-title">{t('flashcardNavigation.status', 'Status:')}</div>
        <div className="flashcard-legend-item">
          <span className="flashcard-legend-icon">🆕</span>
          <span className="flashcard-legend-text">{t('flashcardNavigation.new', 'New')}</span>
        </div>
        <div className="flashcard-legend-item">
          <span className="flashcard-legend-icon">📘</span>
          <span className="flashcard-legend-text">{t('flashcardNavigation.learning', 'Learning')}</span>
        </div>
        <div className="flashcard-legend-item">
          <span className="flashcard-legend-icon">✅</span>
          <span className="flashcard-legend-text">{t('flashcardNavigation.mastered', 'Mastered')}</span>
        </div>
      </div>

      {/* Feedback Button */}
      <div className="flashcard-nav-footer">
        <FlashcardFeedback
          onFeedbackSubmit={onFeedbackSubmit}
          hasSubmitted={hasGivenFeedback}
        />
      </div>

      {/* DEV MODE: Display Feedback Data */}
      {isDev && feedbackData && (
        <div className="flashcard-feedback-dev-display">
          <div className="dev-feedback-header">
            <span className="dev-badge">DEV</span>
            <span className="dev-feedback-title">Flashcard Feedback Collected</span>
          </div>
          <div className="dev-feedback-content">
            <div className="dev-feedback-row">
              <span className="dev-feedback-label">Rating:</span>
              <span className="dev-feedback-value">
                {feedbackData.rating === 'good' ? '😄 Good' :
                 feedbackData.rating === 'neutral' ? '😐 Okay' :
                 feedbackData.rating === 'bad' ? '☹️ Bad' : feedbackData.rating}
              </span>
            </div>
            <div className="dev-feedback-row">
              <span className="dev-feedback-label">Detail:</span>
              <span className="dev-feedback-value">{feedbackData.detail}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlashcardNavigation;
