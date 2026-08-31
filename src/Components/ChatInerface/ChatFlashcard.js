import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import './ChatFlashcard.css';
import FlashcardNavigation from './FlashcardNavigation';
import FlashcardResults from './FlashcardResults';
import StreamingIndicator from './StreamingIndicator';
import { useTranslation } from 'react-i18next';

// Icon Components
function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// Helper to format flashcard text with bold and line breaks
function formatFlashcardText(text) {
  if (!text) return null;

  // Split by newlines and process each line
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    // Process bold text (**text** -> <strong>text</strong>)
    const parts = [];
    let remaining = line;
    let partIndex = 0;

    while (remaining.length > 0) {
      const boldStart = remaining.indexOf('**');

      if (boldStart === -1) {
        // No more bold markers, add remaining text
        if (remaining) parts.push(<span key={partIndex++}>{remaining}</span>);
        break;
      }

      // Add text before bold
      if (boldStart > 0) {
        parts.push(<span key={partIndex++}>{remaining.substring(0, boldStart)}</span>);
      }

      // Find closing bold marker
      const boldEnd = remaining.indexOf('**', boldStart + 2);

      if (boldEnd === -1) {
        // No closing marker, treat as regular text
        parts.push(<span key={partIndex++}>{remaining.substring(boldStart)}</span>);
        break;
      }

      // Add bold text
      const boldText = remaining.substring(boldStart + 2, boldEnd);
      parts.push(<strong key={partIndex++}>{boldText}</strong>);

      remaining = remaining.substring(boldEnd + 2);
    }

    return (
      <span key={lineIndex}>
        {parts}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    );
  });
}

// Main Component
function ChatFlashcard(props) {
  const {
    flashcard,
    onCardReview,
    cardIndex = 0,
    onNext,
    isLastCard = false,
    totalCards = 0,
    allFlashcards = [],
    showReview = false,
    onSkip,
    modalOpen: externalModalOpen,
    isStreaming = false,
    onModalChange,
    onNavigate,
    showResults = false,
    onReviewFlashcards,
    onContinueLearning
  } = props;

  // State
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Use parent-controlled modal state if provided, otherwise use local state
  const [localModalOpen, setLocalModalOpen] = useState(false);
  const modalOpen = externalModalOpen !== undefined ? externalModalOpen : localModalOpen;
  const setModalOpen = onModalChange || setLocalModalOpen;

  // Translation
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.language;

  // Computed values
  const progressStyle = useMemo(() => {
    if (totalCards === 0) return { width: '0%' };
    return { width: `${((cardIndex + 1) / totalCards) * 100}%` };
  }, [cardIndex, totalCards]);

  // Calculate mastered cards
  const masteredCount = useMemo(() => {
    return allFlashcards.filter(card => card.status === 'mastered').length;
  }, [allFlashcards]);

  // Calculate results statistics based on user's session review
  const resultsData = useMemo(() => {
    if (!allFlashcards || allFlashcards.length === 0) {
      return { masteredCards: 0, learningCards: 0, newCards: 0, topicBreakdown: [] };
    }

    // Count based on userReview from this session
    const masteredCards = allFlashcards.filter(card =>
      card.userReview?.knowIt === true
    ).length;

    const learningCards = allFlashcards.filter(card =>
      card.userReview?.knowIt === false
    ).length;

    const newCards = allFlashcards.filter(card =>
      !card.userReview
    ).length;

    // Calculate topic breakdown if topics exist
    const topicMap = {};
    allFlashcards.forEach(card => {
      const topic = card.topic || 'General';
      if (!topicMap[topic]) {
        topicMap[topic] = { topic, total: 0, mastered: 0, learning: 0 };
      }
      topicMap[topic].total++;
      if (card.userReview?.knowIt === true) {
        topicMap[topic].mastered++;
      } else if (card.userReview?.knowIt === false) {
        topicMap[topic].learning++;
      }
    });

    const topicBreakdown = Object.values(topicMap);

    return { masteredCards, learningCards, newCards, topicBreakdown };
  }, [allFlashcards]);

  // Effects
  useEffect(() => {
    // Reset state when flashcard changes
    if (flashcard) {
      if (flashcard.userReview) {
        setIsFlipped(true);
        setReviewed(true);
      } else {
        setIsFlipped(false);
        setReviewed(false);
      }
      // Always reset hint visibility when card changes
      setShowHint(false);
    }
  }, [flashcard, cardIndex]);

  useEffect(() => {
    setReviewMode(showReview);
  }, [showReview]);

  // Handlers
  const handleFlip = () => {
    if (!reviewed) {
      setIsFlipped(!isFlipped);

      // Vibration feedback on flip
      if (navigator.vibrate && !isFlipped) {
        navigator.vibrate(50);
      }
    }
  };

  const handleReview = (knowIt) => {
    if (reviewed && !reviewMode) return;

    const reviewData = {
      knowIt: knowIt,
      timestamp: new Date()
    };

    setReviewed(true);

    // Update card status based on review
    if (onCardReview) {
      onCardReview(cardIndex, reviewData);
    }

    // Vibration feedback
    if (navigator.vibrate) {
      navigator.vibrate(knowIt ? [50, 50, 50] : [100]);
    }
  };

  const handleNext = () => {
    if (onNext) onNext();
  };

  const handleSkip = () => {
    if (onSkip) onSkip();
  };

  const handleExpandModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    // Add closing class for smooth animation
    const modalContent = document.querySelector('.flashcard-modal-content');
    const modalOverlay = document.querySelector('.flashcard-modal-overlay');

    if (modalContent && modalOverlay) {
      modalContent.classList.add('closing');
      modalOverlay.classList.add('closing');

      // Wait for animation to complete before actually closing
      setTimeout(() => {
        setModalOpen(false);
      }, 400); // Match animation duration (0.4s)
    } else {
      setModalOpen(false);
    }
  };

  const handleNavigation = (index) => {
    if (onNavigate) {
      onNavigate(index);
    }
  };

  if (!flashcard && !showResults) {
    return (
      <div className="flashcard-compact-container">
        <div className="flashcard-compact-loading">
          {t('flashcard.loading', 'Loading flashcard...')}
        </div>
      </div>
    );
  }

  // Determine button state
  const showSkipButton = !reviewed && !reviewMode;
  const showNextButton = reviewed || reviewMode;

  // Render flashcard content
  const renderFlashcardContent = () => (
    <div className="flashcard-compact-wrapper">
      {/* Header with topic badge */}
      {flashcard.topic && (
        <div className="flashcard-topic-badge">
          <span className="topic-badge-icon">📚</span>
          <span className="topic-badge-text">{flashcard.topic}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="flashcard-compact-progress-container">
        <div className="flashcard-compact-progress-track">
          <div className="flashcard-compact-progress-fill" style={progressStyle} />
        </div>
        <div className="flashcard-compact-progress-text">
          {cardIndex + 1} / {totalCards}
          {masteredCount > 0 && (
            <span className="flashcard-mastered-count"> • {masteredCount} {t('flashcard.mastered', 'mastered')} ✅</span>
          )}
        </div>
      </div>

      {/* The Card with 3D Flip */}
      <div
        className={`flashcard-card ${isFlipped ? 'flipped' : ''}`}
        onClick={handleFlip}
      >
        {/* Front of card */}
        <div className="flashcard-card-face flashcard-card-front">
          <div className="flashcard-content">
            <div className="flashcard-label">{t('flashcard.question', 'Question')}</div>
            <div className="flashcard-text" data-selectable="true">{flashcard.front}</div>
            {flashcard.hint && !isFlipped && (
              <div className="flashcard-hint">
                {showHint ? (
                  <div className="flashcard-hint-revealed">
                    <div className="flashcard-hint-header">
                      <span className="hint-icon">💡</span>
                      <span>{t('flashcard.hint', 'Hint')}</span>
                    </div>
                    <div className="flashcard-hint-text">{flashcard.hint}</div>
                  </div>
                ) : (
                  <button
                    className="flashcard-hint-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHint(true);
                    }}
                  >
                    <span className="hint-icon">💡</span>
                    <span>{t('flashcard.showHint', 'Show hint')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flashcard-flip-instruction">
            <FlipIcon />
            <span>{t('flashcard.tapToFlip', 'Tap to flip')}</span>
          </div>
        </div>

        {/* Back of card */}
        <div className="flashcard-card-face flashcard-card-back">
          <div className="flashcard-content">
            <div className="flashcard-label">{t('flashcard.answer', 'Answer')}</div>
            <div className="flashcard-text flashcard-text-formatted" data-selectable="true">
              {formatFlashcardText(flashcard.back)}
            </div>
          </div>
          <div className="flashcard-flip-instruction">
            <FlipIcon />
            <span>{t('flashcard.tapToFlipBack', 'Tap to flip back')}</span>
          </div>
        </div>
      </div>

      {/* Review Buttons (only show when flipped) */}
      {isFlipped && !reviewed && (
        <div className="flashcard-review-section">
          <div className="flashcard-review-prompt">{t('flashcard.howWellKnow', 'How well did you know this?')}</div>
          <div className="flashcard-review-buttons">
            <button
              className="flashcard-review-btn flashcard-review-again"
              onClick={(e) => {
                e.stopPropagation();
                handleReview(false);
              }}
            >
              <span className="review-btn-icon">😔</span>
              <span className="review-btn-text">{t('flashcard.again', 'Again')}</span>
            </button>
            <button
              className="flashcard-review-btn flashcard-review-good"
              onClick={(e) => {
                e.stopPropagation();
                handleReview(true);
              }}
            >
              <span className="review-btn-icon">✅</span>
              <span className="review-btn-text">{t('flashcard.knowIt', 'Know it')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Reviewed Feedback */}
      {reviewed && (
        <div className={`flashcard-reviewed-feedback ${flashcard.userReview?.knowIt ? 'positive' : 'negative'}`}>
          {flashcard.userReview?.knowIt ? (
            <>
              <span className="feedback-icon">✅</span>
              <span>{t('flashcard.greatKeepUp', 'Great! Keep it up!')}</span>
            </>
          ) : (
            <>
              <span className="feedback-icon">📝</span>
              <span>{t('flashcard.noWorriesNextTime', "No worries, you'll get it next time!")}</span>
            </>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flashcard-compact-navigation">
        {showSkipButton && (
          <button className="flashcard-nav-btn flashcard-skip-btn" onClick={handleSkip}>
            {t('flashcard.skipForNow', 'Skip for now')}
          </button>
        )}
        {showNextButton && (
          <button
            className="flashcard-nav-btn flashcard-next-btn"
            onClick={handleNext}
          >
            {isLastCard ? t('flashcard.viewResults', 'View Results') : t('flashcard.nextCard', 'Next Card')}
          </button>
        )}
      </div>
    </div>
  );

  // Main render (compact mode - no sidebar, full width)
  const mainContent = (
    <div className="flashcard-compact-container glassmorphic">
      {/* Streaming Indicator - Above flashcard */}
      {isStreaming && (
        <StreamingIndicator type="flashcard" />
      )}

      <div className="flashcard-compact-single">
        {totalCards > 1 && !showResults && (
          <div className="flashcard-compact-header">
            <h3 className="flashcard-compact-title">
              {t('flashcard.title', 'Flashcards')}
            </h3>
            <button
              className="flashcard-expand-btn"
              onClick={handleExpandModal}
              title={t('flashcard.expandToFullscreen', 'Expand to fullscreen')}
            >
              <ExpandIcon />
            </button>
          </div>
        )}
        {showResults ? (
          <>
            <FlashcardResults
              totalCards={totalCards}
              masteredCards={resultsData.masteredCards}
              learningCards={resultsData.learningCards}
              newCards={resultsData.newCards}
              onContinue={onContinueLearning}
              onReview={onReviewFlashcards}
              topicBreakdown={resultsData.topicBreakdown}
            />
          </>
        ) : (
          <>
            {flashcard && renderFlashcardContent()}
          </>
        )}
      </div>
    </div>
  );

  // Modal content (fullscreen view)
  const modalContent = modalOpen && createPortal(
    <div className="flashcard-modal-overlay" onClick={handleCloseModal}>
      <div className="flashcard-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flashcard-modal-header">
          <h2 className="flashcard-modal-title">{t('flashcard.title', 'Flashcards')}</h2>
          <button
            className="flashcard-modal-close"
            onClick={handleCloseModal}
            title={t('flashcard.closeFullscreen', 'Close fullscreen')}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flashcard-modal-body">
          {!showResults && totalCards > 1 && (
            <div className="flashcard-modal-sidebar">
              <FlashcardNavigation
                flashcards={allFlashcards}
                currentIndex={cardIndex}
                onNavigate={handleNavigation}
              />
            </div>
          )}
          <div className="flashcard-modal-main">
            {showResults ? (
              <FlashcardResults
                totalCards={totalCards}
                masteredCards={resultsData.masteredCards}
                learningCards={resultsData.learningCards}
                newCards={resultsData.newCards}
                onContinue={onContinueLearning}
                onReview={onReviewFlashcards}
                topicBreakdown={resultsData.topicBreakdown}
              />
            ) : (
              renderFlashcardContent()
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {mainContent}
      {modalContent}
    </>
  );
}

export default ChatFlashcard;
