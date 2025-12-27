import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import StudyProgressBar from './StudyProgressBar';
import StudyCelebration from './StudyCelebration';
import { playCorrectSound, playIncorrectSound, playCelebrationSound, playMilestoneSound, playFlipSound } from '../../utils/soundEffects';

/**
 * Parse markdown-style formatting into HTML
 * Supports: **bold**, • bullets, and line breaks
 */
const parseFlashcardText = (text) => {
  if (!text) return '';

  // Ensure text is a string (handle objects/arrays gracefully)
  if (typeof text !== 'string') {
    console.warn('parseFlashcardText received non-string:', text);
    return String(text);
  }

  // Debug: log input
  console.log('📝 parseFlashcardText input:', text);
  console.log('📝 Has asterisks:', text.includes('**'));

  let parsed = text
    // Convert **bold** to <strong> - use global flag and non-greedy match
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Convert comma-bullet patterns (,•) to line breaks
    .replace(/,\s*•/g, '<br/>• ')
    // Convert standalone bullet points to line breaks (not at start)
    .replace(/([^>])•\s*/g, '$1<br/>• ')
    // Handle bullet at the very start
    .replace(/^•\s*/, '• ')
    // Convert newlines to <br/>
    .replace(/\n/g, '<br/>');

  // Clean up any <br/> at the start
  parsed = parsed.replace(/^(<br\/>)+/, '');
  // Clean up multiple consecutive <br/>
  parsed = parsed.replace(/(<br\/>){2,}/g, '<br/>');

  // Debug: log output
  console.log('📝 parseFlashcardText output:', parsed);

  return parsed;
};

/**
 * StudyFlashcardCard - Multiple flashcards in study mode (Duolingo-style)
 * Cards marked "need review" are shown again until mastered.
 *
 * @param {Object} content - Flashcard content { cards: [{ front, back }, ...] } or legacy { front, back }
 * @param {Object} savedProgress - Saved progress for resuming { cardStatuses, queueIndex, isReviewRound }
 * @param {Function} onReview - Callback when user reviews (got it / need review)
 * @param {Function} onContinue - Callback when user completes all cards
 * @param {Function} onExit - Callback to exit/close the card
 */
const StudyFlashcardCard = ({ content, savedProgress, onReview, onContinue, onExit }) => {
  const { t } = useTranslation();

  // Debug: log savedProgress on every render
  console.log('🃏 StudyFlashcardCard rendered, savedProgress:', savedProgress);

  const [isFlipped, setIsFlipped] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Track card statuses: 'pending' | 'mastered' | 'review'
  // Initialize from savedProgress if available to avoid flash of empty progress
  const [cardStatuses, setCardStatuses] = useState(() =>
    savedProgress?.cardStatuses || {}
  );

  // Queue of card indices to show (includes review cards at the end)
  const [cardQueue, setCardQueue] = useState([]);
  // Initialize queueIndex from savedProgress to show correct card immediately
  const [queueIndex, setQueueIndex] = useState(() =>
    savedProgress?.queueIndex || 0
  );

  // Track if we're in review round
  const [isReviewRound, setIsReviewRound] = useState(() =>
    savedProgress?.isReviewRound || false
  );

  // Celebration and transition state
  const [showMilestoneCelebration, setShowMilestoneCelebration] = useState(false);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const [showReviewTransition, setShowReviewTransition] = useState(false);
  const [reviewTransitionCount, setReviewTransitionCount] = useState(0);
  const [hasShownMilestone, setHasShownMilestone] = useState(false);
  const [waitingForNextCard, setWaitingForNextCard] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Handle both new format { cards: [...] } and legacy format { front, back }
  const cards = useMemo(() => {
    if (!content) {
      console.log('⚠️ Flashcard content is null/undefined');
      return [];
    }
    return content.cards || [content];
  }, [content]);
  const isStreaming = content?._isStreaming || false;
  const expectedTotal = content?._expectedTotal || cards.length;
  // Use actual cards length for logic, but expectedTotal for progress display
  const totalCards = cards.length;

  // Track if we've already restored progress (to avoid re-initializing)
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  // Restore from saved progress OR initialize fresh queue
  useEffect(() => {
    // Skip if no cards yet
    if (totalCards === 0) return;

    // If we have saved progress to restore
    if (savedProgress?.cardStatuses && Object.keys(savedProgress.cardStatuses).length > 0) {
      if (!hasRestoredProgress) {
        console.log('📊 Restoring flashcard progress:', savedProgress);

        setCardStatuses(savedProgress.cardStatuses);
        setIsReviewRound(savedProgress.isReviewRound || false);

        // Rebuild the queue based on saved state
        if (savedProgress.isReviewRound) {
          // In review round - queue only contains cards that need review
          const reviewCards = Object.entries(savedProgress.cardStatuses)
            .filter(([_, status]) => status === 'review')
            .map(([idx]) => parseInt(idx));
          setCardQueue(reviewCards);
          setQueueIndex(savedProgress.queueIndex || 0);
        } else {
          // First pass - start from where we left off
          setCardQueue(cards.map((_, i) => i));
          setQueueIndex(savedProgress.queueIndex || 0);
        }

        setHasRestoredProgress(true);
      }
    } else if (!hasRestoredProgress && !isReviewRound) {
      // Fresh start or streaming - update queue to match available cards
      // This allows us to show cards as they stream in
      // Don't reset queue if we're in review round (queue is already filtered to review cards)
      const newQueue = cards.map((_, i) => i);
      if (newQueue.length !== cardQueue.length) {
        console.log(`🔄 Updating card queue: ${cardQueue.length} -> ${newQueue.length}`);
        setCardQueue(newQueue);

        // If user was waiting for next card, auto-advance now
        if (waitingForNextCard && newQueue.length > queueIndex + 1) {
          setWaitingForNextCard(false);
          setQueueIndex(queueIndex + 1);
          setIsFlipped(false);
          setHasReviewed(false);
        }
      }
    }
  }, [savedProgress, cards, totalCards, cardQueue.length, hasRestoredProgress, waitingForNextCard, queueIndex, isReviewRound]);

  // Current card from queue
  const currentQueuePosition = cardQueue[queueIndex];
  const currentCard = (currentQueuePosition !== undefined && cards[currentQueuePosition]) ? cards[currentQueuePosition] : {};
  const { front, back } = currentCard;

  // Debug logging for review mode issues
  if (isReviewRound && !front) {
    console.log('🔍 Review mode debug:', {
      cardQueue,
      queueIndex,
      currentQueuePosition,
      cardsLength: cards.length,
      cards: cards.slice(0, 3), // First 3 cards for debugging
      currentCard,
      content: content ? { hasCards: !!content.cards, cardsLength: content.cards?.length } : null
    });
  }

  // Calculate progress
  const masteredCount = Object.values(cardStatuses).filter(s => s === 'mastered').length;

  // Check if all cards are mastered
  const allMastered = masteredCount === totalCards;

  // Calculate XP earned (10 XP per mastered card)
  const xpEarned = masteredCount * 10;

  // Milestone calculation constants
  // IMPORTANT: Use expectedTotal (default 12) for milestone calculations, not actual cards received
  // This prevents milestone from triggering too early during streaming (e.g., 1/1 = 100% vs 1/12 = 8%)
  const milestoneTotal = expectedTotal || 12;
  const minCardsForMilestone = Math.ceil(milestoneTotal * 0.3); // 30% of expected total (e.g., 4 out of 12)
  const isPerfect = masteredCount === totalCards;

  // Trigger milestone celebration at 30%
  // Only trigger when we've mastered at least 4 cards (30% of 12) to ensure meaningful progress
  useEffect(() => {
    if (masteredCount >= minCardsForMilestone && !hasShownMilestone && !isReviewRound) {
      setShowMilestoneCelebration(true);
      setHasShownMilestone(true);
      playMilestoneSound();
    }
  }, [masteredCount, minCardsForMilestone, hasShownMilestone, isReviewRound]);

  // Trigger completion celebration when all mastered
  useEffect(() => {
    if (allMastered && totalCards > 0) {
      // Small delay to let the UI update first
      const timer = setTimeout(() => {
        setShowCompletionCelebration(true);
        playCelebrationSound();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allMastered, totalCards]);

  // Handle milestone celebration continue
  const handleMilestoneContinue = () => {
    setShowMilestoneCelebration(false);
  };

  // Handle completion celebration continue
  const handleCompletionContinue = () => {
    setShowCompletionCelebration(false);
    if (onContinue) onContinue();
  };

  // Calculate time taken
  const getTimeTaken = () => {
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  };

  // Progress bar logic:
  // Progress only advances when user clicks "Next Card" (not when flipping or reviewing)
  // This matches Duolingo behavior - progress fills as you complete cards
  // Use expectedTotal (12) for progress bar during streaming for consistent display
  const getProgressValues = () => {
    // Use expectedTotal (12) for progress bar total during streaming
    const displayTotal = expectedTotal;

    if (allMastered) {
      // All done - full progress
      return { current: displayTotal, total: displayTotal, includeCurrentAsComplete: false };
    }

    if (isReviewRound) {
      // Review round - show mastered cards out of total
      return {
        current: masteredCount,
        total: totalCards, // Use actual count during review
        includeCurrentAsComplete: hasReviewed && cardStatuses[currentQueuePosition] === 'mastered'
      };
    }

    // First pass - progress = queueIndex (cards we've moved past)
    // Current card fills when user clicks "Got it" or "Need review"
    return {
      current: queueIndex,
      total: displayTotal,
      includeCurrentAsComplete: hasReviewed
    };
  };

  const progressValues = getProgressValues();

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
    playFlipSound();
  };

  const handleGotIt = () => {
    setHasReviewed(true);
    playCorrectSound();
    const newStatuses = { ...cardStatuses, [currentQueuePosition]: 'mastered' };
    setCardStatuses(newStatuses);

    if (onReview) {
      onReview({
        status: 'got_it',
        cardIndex: currentQueuePosition,
        progress: {
          cardStatuses: newStatuses,
          queueIndex: queueIndex,
          isReviewRound: isReviewRound
        }
      });
    }
  };

  const handleNeedReview = () => {
    setHasReviewed(true);
    playIncorrectSound();
    const newStatuses = { ...cardStatuses, [currentQueuePosition]: 'review' };
    setCardStatuses(newStatuses);

    if (onReview) {
      onReview({
        status: 'need_review',
        cardIndex: currentQueuePosition,
        progress: {
          cardStatuses: newStatuses,
          queueIndex: queueIndex,
          isReviewRound: isReviewRound
        }
      });
    }
  };

  const handleNextCard = () => {
    const nextQueueIndex = queueIndex + 1;

    // Check if we've finished the current queue
    if (nextQueueIndex >= cardQueue.length) {
      // If still streaming and we haven't reached expected total, wait for more
      if (isStreaming && totalCards < expectedTotal) {
        // Show waiting state - user went through cards faster than generation
        setWaitingForNextCard(true);
        setIsFlipped(false);
        setHasReviewed(false);
        return;
      }

      // Get cards that need review
      const cardsToReview = Object.entries(cardStatuses)
        .filter(([_, status]) => status === 'review')
        .map(([idx, _]) => parseInt(idx));

      if (cardsToReview.length > 0) {
        // Show review transition screen before starting review round
        setReviewTransitionCount(cardsToReview.length);
        setShowReviewTransition(true);

        // Set review round FIRST to prevent useEffect from resetting the queue
        setIsReviewRound(true);

        // Prepare the review queue (will be activated when transition continues)
        setCardQueue(cardsToReview);
        setQueueIndex(0);
        setIsFlipped(false);
        setHasReviewed(false);

        // Save progress when entering review round
        if (onReview) {
          onReview({
            status: 'next_card',
            cardIndex: null,
            progress: {
              cardStatuses: cardStatuses,
              queueIndex: 0,
              isReviewRound: true
            }
          });
        }
      }
      // If no cards to review, allMastered will be true and we show completion
    } else {
      // Move to next card in queue
      setQueueIndex(nextQueueIndex);
      setIsFlipped(false);
      setHasReviewed(false);

      // Save progress after advancing to next card
      if (onReview) {
        onReview({
          status: 'next_card',
          cardIndex: null,
          progress: {
            cardStatuses: cardStatuses,
            queueIndex: nextQueueIndex,
            isReviewRound: isReviewRound
          }
        });
      }
    }
  };

  // Handle review transition continue
  const handleReviewTransitionContinue = () => {
    setShowReviewTransition(false);
    // isReviewRound is already set to true when entering review mode
  };

  return (
    <div className="study-step-card study-flashcard-card">
      <div className="study-card-header">
        <div className="study-card-icon flashcard">
          <FlashcardIcon />
        </div>
        <h2 className="study-card-title">{t('study.flashcardsTitle', 'Flashcards')}</h2>
        {onExit && (
          <button className="study-card-close-btn" onClick={onExit} title={t('study.close', 'Close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar - fills as you go through cards, completes when all mastered */}
      <StudyProgressBar
        current={progressValues.current}
        total={progressValues.total}
        includeCurrentAsComplete={progressValues.includeCurrentAsComplete}
      />

      {/* Show celebration/transition INSIDE the card content, or show flashcard content */}
      {showMilestoneCelebration ? (
        <div className="study-card-content">
          <StudyCelebration
            type="milestone"
            inline={true}
            correctCount={masteredCount}
            totalCount={totalCards}
            expectedTotal={milestoneTotal}
            onContinue={handleMilestoneContinue}
          />
        </div>
      ) : showCompletionCelebration ? (
        <div className="study-card-content">
          <StudyCelebration
            type="complete"
            xpEarned={xpEarned}
            timeSeconds={getTimeTaken()}
            isPerfect={isPerfect}
            inline={true}
            onContinue={handleCompletionContinue}
          />
        </div>
      ) : showReviewTransition ? (
        <div className="study-card-content">
          <div className="study-review-transition">
            <div className="review-transition-icon">
              <RefreshIcon />
            </div>
            <h3 className="review-transition-title">
              {t('study.timeToReview', 'Time to Review!')}
            </h3>
            <p className="review-transition-message">
              {t('study.reviewMessage', {
                count: reviewTransitionCount,
                defaultValue: `You have ${reviewTransitionCount} card${reviewTransitionCount > 1 ? 's' : ''} to review. Let's go over them again!`
              })}
            </p>
            <button className="study-continue-btn" onClick={handleReviewTransitionContinue}>
              {t('study.startReview', "Let's Go!")}
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      ) : (isStreaming && totalCards === 0) || waitingForNextCard || (cardQueue.length === 0 && !allMastered) ? (
        // Show loading state while waiting for first flashcard, next card to stream in, or queue not ready
        <div className="study-card-content">
          <div className="study-streaming-loading">
            <div className="study-loading-spinner" />
            <p className="study-loading-text">
              {t('study.generatingFlashcards', 'Generating flashcards...')}
            </p>
          </div>
        </div>
      ) : !front && isReviewRound ? (
        // Edge case: in review mode but card not found - this shouldn't happen but handle gracefully
        <div className="study-card-content">
          <div className="study-streaming-loading">
            <div className="study-loading-spinner" />
            <p className="study-loading-text">
              {t('study.loadingCard', 'Loading card...')}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Review badge - show when reviewing cards */}
          {isReviewRound && !allMastered && (
            <div className="study-review-badge">
              <RefreshIcon />
              <span>{t('study.reviewingCards', { count: cardQueue.length, defaultValue: `Reviewing ${cardQueue.length} card${cardQueue.length > 1 ? 's' : ''}` })}</span>
            </div>
          )}

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
                  <div
                    className="study-flashcard-text"
                    dangerouslySetInnerHTML={{ __html: parseFlashcardText(front) || 'Loading...' }}
                  />
                  <span className="study-flashcard-hint">
                    <TapIcon />
                    {t('study.tapToFlip', 'Tap to flip')}
                  </span>
                </div>

                {/* Back */}
                <div className="study-flashcard-face study-flashcard-back">
                  <div
                    className="study-flashcard-text"
                    dangerouslySetInnerHTML={{ __html: parseFlashcardText(back) || t('study.loading', 'Loading...') }}
                  />
                  <span className="study-flashcard-hint">
                    <TapIcon />
                    {t('study.tapToFlipBack', 'Tap to flip back')}
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
                    {t('study.gotItBtn', 'Got it!')}
                  </button>
                  <button
                    className="study-flashcard-btn review"
                    onClick={(e) => { e.stopPropagation(); handleNeedReview(); }}
                  >
                    <RefreshIcon />
                    {t('study.needReview', 'Need review')}
                  </button>
                </div>
              )}

              {/* Next card button - show after reviewing if not all mastered */}
              {hasReviewed && !allMastered && (
                <div className="study-flashcard-actions">
                  <button
                    className="study-flashcard-btn got-it"
                    onClick={(e) => { e.stopPropagation(); handleNextCard(); }}
                  >
                    {t('study.continueBtn', 'Continue')}
                    <ArrowRightIcon />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Summary and Continue - show when all cards mastered */}
          {allMastered && (
            <div className="study-card-footer study-card-footer-stacked">
              <div className="study-completion-message">
                {t('study.greatJob', "Great job! You've mastered all the cards.")}
              </div>
              <div className="study-flashcard-summary">
                <span className="summary-item got-it">
                  <CheckIcon /> {t('study.masteredCount', { count: totalCards, defaultValue: `${totalCards} mastered` })}
                </span>
              </div>
              <button className="study-continue-btn" onClick={onContinue}>
                {t('study.continueBtn', 'Continue')}
                <ArrowRightIcon />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudyFlashcardCard;
