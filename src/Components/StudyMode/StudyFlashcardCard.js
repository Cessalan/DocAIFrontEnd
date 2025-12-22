import React, { useState } from 'react';

/**
 * StudyFlashcardCard - Single flip flashcard in study mode
 *
 * @param {Object} content - Flashcard content { front, back }
 * @param {Function} onReview - Callback when user reviews (got it / need review)
 * @param {Function} onContinue - Callback when user is ready to continue
 */
const StudyFlashcardCard = ({ content, onReview, onContinue }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const { front, back } = content || {};

  // Flashcard icon
  const FlashcardIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="12" rx="2" />
      <rect x="8" y="8" width="14" height="12" rx="2" />
    </svg>
  );

  // Tap icon
  const TapIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  );

  // Checkmark icon
  const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  // Refresh icon
  const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );

  // Arrow right icon
  const ArrowRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleGotIt = () => {
    setHasReviewed(true);
    if (onReview) {
      onReview({ status: 'got_it' });
    }
  };

  const handleNeedReview = () => {
    setHasReviewed(true);
    if (onReview) {
      onReview({ status: 'need_review' });
    }
  };

  return (
    <div className="study-step-card study-flashcard-card">
      <div className="study-card-header">
        <div className="study-card-icon flashcard">
          <FlashcardIcon />
        </div>
        <h2 className="study-card-title">Flashcard</h2>
      </div>

      <div className="study-card-content study-flashcard-content-area">
        {/* Flip card */}
        <div className="study-flashcard-wrapper">
          <div
            className={`study-flashcard ${isFlipped ? 'flipped' : ''}`}
            onClick={handleFlip}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleFlip()}
          >
            {/* Front */}
            <div className="study-flashcard-face study-flashcard-front">
              <p className="study-flashcard-text">
                {front || 'Loading...'}
              </p>
              <span className="study-flashcard-hint">
                <TapIcon />
                Tap to flip
              </span>
            </div>

            {/* Back */}
            <div className="study-flashcard-face study-flashcard-back">
              <p className="study-flashcard-text">
                {back || 'Loading...'}
              </p>
              <span className="study-flashcard-hint">
                <TapIcon />
                Tap to flip back
              </span>
            </div>
          </div>

          {/* Review actions - only show when flipped and not yet reviewed */}
          {isFlipped && !hasReviewed && (
            <div className="study-flashcard-actions">
              <button
                className="study-flashcard-btn got-it"
                onClick={(e) => { e.stopPropagation(); handleGotIt(); }}
              >
                <CheckIcon />
                Got it!
              </button>
              <button
                className="study-flashcard-btn review"
                onClick={(e) => { e.stopPropagation(); handleNeedReview(); }}
              >
                <RefreshIcon />
                Need review
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Continue button - only show after reviewing */}
      {hasReviewed && (
        <div className="study-card-footer">
          <button className="study-continue-btn" onClick={onContinue}>
            Continue
            <ArrowRightIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyFlashcardCard;
