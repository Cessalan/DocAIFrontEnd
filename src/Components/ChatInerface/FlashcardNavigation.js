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

  // Count cards by status
  const newCount = flashcards.filter(c => !c.userReview && c.status !== 'mastered' && c.status !== 'learning').length;
  const knownCount = flashcards.filter(c => c.userReview?.knowIt || c.status === 'mastered').length;
  const againCount = flashcards.filter(c => c.userReview && !c.userReview.knowIt && c.status !== 'mastered').length;

  return (
    <div className="flashcard-navigation">
      {/* Progress Summary */}
      <div className="flashcard-nav-progress">
        <div className="progress-stat">
          <span className="progress-count known">{knownCount}</span>
          <span className="progress-label">{t('flashcardNavigation.known', 'Known')}</span>
        </div>
        <div className="progress-divider" />
        <div className="progress-stat">
          <span className="progress-count again">{againCount}</span>
          <span className="progress-label">{t('flashcardNavigation.review', 'Review')}</span>
        </div>
        <div className="progress-divider" />
        <div className="progress-stat">
          <span className="progress-count new">{newCount}</span>
          <span className="progress-label">{t('flashcardNavigation.new', 'New')}</span>
        </div>
      </div>

      {/* Card List */}
      <div className="flashcard-nav-list">
        {flashcards.map((card, index) => {
          const isActive = index === currentIndex;
          const isReviewed = card.userReview !== undefined && card.userReview !== null;
          const knowIt = card.userReview?.knowIt;
          const isMastered = card.status === 'mastered';

          let statusClass = 'status-new';
          if (isMastered || knowIt) {
            statusClass = 'status-known';
          } else if (isReviewed && !knowIt) {
            statusClass = 'status-again';
          }

          return (
            <button
              key={index}
              className={`flashcard-nav-item ${isActive ? 'active' : ''} ${statusClass}`}
              onClick={() => handleCardClick(index)}
              aria-label={`Card ${index + 1}${isReviewed ? (knowIt ? ' - Known' : ' - Review') : ' - New'}`}
            >
              <span className="flashcard-nav-number">{index + 1}</span>
            </button>
          );
        })}
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
            <span className="dev-feedback-title">Feedback</span>
          </div>
          <div className="dev-feedback-content">
            <div className="dev-feedback-row">
              <span className="dev-feedback-label">Rating:</span>
              <span className="dev-feedback-value">{feedbackData.rating}</span>
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
