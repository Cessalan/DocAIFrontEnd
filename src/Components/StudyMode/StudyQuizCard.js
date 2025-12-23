import React, { useState, useEffect } from 'react';
import StudyProgressBar from './StudyProgressBar';

/**
 * StudyQuizCard - Multiple quiz questions in study mode (Duolingo-style)
 * Questions answered incorrectly are retried at the end until all are correct.
 *
 * @param {Object} content - Quiz content { questions: [{ question, options, correctIndex, rationale }, ...] } or legacy single question
 * @param {Object} savedProgress - Saved progress for resuming { questionStatuses, queueIndex, isReviewRound }
 * @param {Function} onAnswer - Callback when answer is submitted
 * @param {Function} onContinue - Callback when user completes all questions
 */
const StudyQuizCard = ({ content, savedProgress, onAnswer, onContinue }) => {
  // Handle both new format { questions: [...] } and legacy format { question, options, ... }
  const questions = content?.questions || [content];
  const totalQuestions = questions.length;

  // UI state
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showFullRationale, setShowFullRationale] = useState(false);

  // Question queue (like flashcard queue)
  const [questionQueue, setQuestionQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(() =>
    savedProgress?.queueIndex || 0
  );

  // Track question statuses: 'pending' | 'correct' | 'incorrect'
  const [questionStatuses, setQuestionStatuses] = useState(() =>
    savedProgress?.questionStatuses || {}
  );

  // Track if we're in review round
  const [isReviewRound, setIsReviewRound] = useState(() =>
    savedProgress?.isReviewRound || false
  );

  // Track if we've already restored progress
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  // Restore from saved progress OR initialize fresh queue
  useEffect(() => {
    if (totalQuestions === 0) return;

    if (savedProgress?.questionStatuses && Object.keys(savedProgress.questionStatuses).length > 0) {
      if (!hasRestoredProgress) {
        console.log('📊 Restoring quiz progress:', savedProgress);

        setQuestionStatuses(savedProgress.questionStatuses);
        setIsReviewRound(savedProgress.isReviewRound || false);

        // Rebuild the queue based on saved state
        if (savedProgress.isReviewRound) {
          // In review round - queue only contains questions that were incorrect
          const reviewQuestions = Object.entries(savedProgress.questionStatuses)
            .filter(([_, status]) => status === 'incorrect')
            .map(([idx]) => parseInt(idx));
          setQuestionQueue(reviewQuestions);
          setQueueIndex(savedProgress.queueIndex || 0);
        } else {
          // First pass - start from where we left off
          setQuestionQueue(questions.map((_, i) => i));
          setQueueIndex(savedProgress.queueIndex || 0);
        }

        setHasRestoredProgress(true);
      }
    } else if (questionQueue.length === 0 && !hasRestoredProgress) {
      // Fresh start
      console.log('🆕 Fresh start - initializing question queue');
      setQuestionQueue(questions.map((_, i) => i));
    }
  }, [savedProgress, questions, totalQuestions, questionQueue.length, hasRestoredProgress]);

  // Current question from queue
  const currentQueuePosition = questionQueue[queueIndex];
  const currentQuestion = questions[currentQueuePosition] || {};
  const { question, options = [], correctIndex: rawCorrectIndex, rationale } = currentQuestion;

  // Normalize correctIndex - convert to number if string
  const correctIndex = (() => {
    if (rawCorrectIndex === undefined || rawCorrectIndex === null) return -1;

    // If it's already a number, use it directly (backend sends 0-indexed)
    if (typeof rawCorrectIndex === 'number') {
      return rawCorrectIndex;
    }

    // If it's a string, try to parse it
    if (typeof rawCorrectIndex === 'string') {
      // Check if it's a letter like "D" or "d"
      if (/^[A-Fa-f]$/.test(rawCorrectIndex)) {
        return rawCorrectIndex.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
      }

      // Try parsing as number
      const parsed = parseInt(rawCorrectIndex, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return -1;
  })();

  // Debug: log correctIndex to help diagnose grading issues
  console.log('🎯 Quiz grading debug:', {
    rawCorrectIndex,
    normalizedCorrectIndex: correctIndex,
    optionsCount: options.length,
    currentQueuePosition,
    queueIndex
  });

  // Calculate progress - count correct answers BEFORE current question
  // This ensures progress only updates when clicking "Next", not when answering
  const getCorrectCountBeforeCurrent = () => {
    let count = 0;
    for (const [idx, status] of Object.entries(questionStatuses)) {
      // Don't count the current question - it will be shown via includeCurrentAsComplete
      if (parseInt(idx) !== currentQueuePosition && status === 'correct') {
        count++;
      }
    }
    return count;
  };

  const correctCountBeforeCurrent = getCorrectCountBeforeCurrent();
  const correctCount = Object.values(questionStatuses).filter(s => s === 'correct').length;
  const allCorrect = correctCount === totalQuestions;

  // Progress bar logic (same as flashcards):
  // - First pass: progress = queueIndex (advances on "Next Question" click, not on answer)
  // - Review round: progress = correctCountBeforeCurrent, current shown via includeCurrentAsComplete
  const getProgressValues = () => {
    if (allCorrect) {
      // All done - full progress
      return { current: totalQuestions, total: totalQuestions, includeCurrentAsComplete: false };
    }

    if (isReviewRound) {
      // Review round - show progress toward all correct (mastered)
      // Use correctCountBeforeCurrent so it doesn't jump when answering
      return {
        current: correctCountBeforeCurrent,
        total: totalQuestions,
        includeCurrentAsComplete: showFeedback && questionStatuses[currentQueuePosition] === 'correct'
      };
    }

    // First pass - progress is based on queueIndex (how many we've moved past)
    // Only advances when clicking "Next Question", not when answering
    return {
      current: queueIndex,
      total: totalQuestions,
      includeCurrentAsComplete: showFeedback
    };
  };

  const progressValues = getProgressValues();

  // Quiz icon
  const QuizIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );

  // Checkmark icon
  const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  // X icon
  const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  // Refresh icon for review round
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

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Strip letter prefix from option text (e.g., "A) To ensure..." -> "To ensure...")
  const stripLetterPrefix = (text) => {
    if (!text) return '';
    // Match patterns like "A) ", "A. ", "a) ", "a. ", "A: ", "a: " at the start
    return text.replace(/^[A-Fa-f][).:]\s*/, '');
  };

  // Extract short rationale (first sentence or paragraph about the correct answer)
  const getShortRationale = (fullRationale) => {
    if (!fullRationale) return null;

    // Remove HTML tags for text processing
    const textOnly = fullRationale.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Look for the correct answer explanation (usually starts with "Option X is correct" or similar)
    const correctMatch = textOnly.match(/Option\s+[A-D]\s+is\s+correct[^.]*\./i);
    if (correctMatch) {
      return correctMatch[0];
    }

    // Fallback: get first sentence
    const firstSentence = textOnly.match(/^[^.!?]+[.!?]/);
    if (firstSentence && firstSentence[0].length < 200) {
      return firstSentence[0];
    }

    // If first sentence is too long, truncate
    return textOnly.substring(0, 150) + '...';
  };

  // Check if rationale has more content beyond the short version
  const hasMoreRationale = (fullRationale, shortRationale) => {
    if (!fullRationale || !shortRationale) return false;
    const textOnly = fullRationale.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return textOnly.length > shortRationale.length + 20;
  };

  // Chevron down icon
  const ChevronDownIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  // Chevron up icon
  const ChevronUpIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );

  const handleOptionClick = (index) => {
    if (showFeedback) return; // Already answered

    // Get the current correct index at click time (avoid stale closure)
    const currentCorrectIndex = questions[currentQueuePosition]?.correctIndex;
    const normalizedCorrect = typeof currentCorrectIndex === 'number'
      ? currentCorrectIndex
      : typeof currentCorrectIndex === 'string'
        ? (/^[A-Fa-f]$/.test(currentCorrectIndex)
            ? currentCorrectIndex.toUpperCase().charCodeAt(0) - 65
            : parseInt(currentCorrectIndex, 10))
        : -1;

    console.log('🎯 Option clicked:', {
      clickedIndex: index,
      correctIndex,
      currentCorrectIndex,
      normalizedCorrect,
      isMatch: index === normalizedCorrect,
      rawCorrectIndex
    });

    setSelectedIndex(index);
    const correct = index === normalizedCorrect;
    setIsCorrect(correct);
    setShowFeedback(true);

    // Update question status
    const newStatuses = {
      ...questionStatuses,
      [currentQueuePosition]: correct ? 'correct' : 'incorrect'
    };
    setQuestionStatuses(newStatuses);

    // Notify parent with progress for saving
    if (onAnswer) {
      onAnswer({
        selectedIndex: index,
        isCorrect: correct,
        questionIndex: currentQueuePosition,
        progress: {
          questionStatuses: newStatuses,
          queueIndex: queueIndex,
          isReviewRound: isReviewRound
        }
      });
    }
  };

  const handleNextQuestion = () => {
    const nextQueueIndex = queueIndex + 1;

    // Check if we've finished the current queue
    if (nextQueueIndex >= questionQueue.length) {
      // Get questions that were incorrect (need review)
      const questionsToReview = Object.entries(questionStatuses)
        .filter(([_, status]) => status === 'incorrect')
        .map(([idx]) => parseInt(idx));

      if (questionsToReview.length > 0) {
        // Start review round with incorrect questions
        setQuestionQueue(questionsToReview);
        setQueueIndex(0);
        setIsReviewRound(true);
        setSelectedIndex(null);
        setShowFeedback(false);
        setIsCorrect(false);
        setShowFullRationale(false);

        // Save progress when entering review round
        if (onAnswer) {
          onAnswer({
            selectedIndex: null,
            isCorrect: null,
            questionIndex: null,
            progress: {
              questionStatuses: questionStatuses,
              queueIndex: 0,
              isReviewRound: true
            }
          });
        }
      }
      // If no questions to review, allCorrect will be true and we show completion
    } else {
      // Move to next question in queue
      setQueueIndex(nextQueueIndex);
      setSelectedIndex(null);
      setShowFeedback(false);
      setIsCorrect(false);
      setShowFullRationale(false);

      // Save progress after advancing
      if (onAnswer) {
        onAnswer({
          selectedIndex: null,
          isCorrect: null,
          questionIndex: null,
          progress: {
            questionStatuses: questionStatuses,
            queueIndex: nextQueueIndex,
            isReviewRound: isReviewRound
          }
        });
      }
    }
  };

  const getOptionClass = (index) => {
    let classes = 'study-quiz-option';

    if (showFeedback) {
      classes += ' disabled';
      // Highlight user's selection: green if correct, peach if wrong
      if (index === selectedIndex) {
        if (isCorrect) {
          classes += ' correct'; // User picked correctly - show green
        } else {
          classes += ' incorrect'; // User picked wrong - show peach
        }
      }
    } else if (index === selectedIndex) {
      classes += ' selected';
    }

    return classes;
  };

  // Check if there are more questions in the queue
  const hasMoreQuestions = queueIndex < questionQueue.length - 1;

  // Check if we need to start review round after current question
  const needsReviewRound = () => {
    if (hasMoreQuestions) return false;
    const incorrectCount = Object.values(questionStatuses).filter(s => s === 'incorrect').length;
    return incorrectCount > 0;
  };

  return (
    <div className="study-step-card">
      <div className="study-card-header">
        <div className="study-card-icon quiz">
          <QuizIcon />
        </div>
        <h2 className="study-card-title">Quick Check</h2>
      </div>

      {/* Progress bar - Duolingo style */}
      <StudyProgressBar
        current={progressValues.current}
        total={progressValues.total}
        includeCurrentAsComplete={progressValues.includeCurrentAsComplete}
      />

      {/* Review badge - show when reviewing questions */}
      {isReviewRound && !allCorrect && (
        <div className="study-review-badge">
          <RefreshIcon />
          <span>Reviewing {questionQueue.length} question{questionQueue.length > 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="study-card-content">
        {/* Question text */}
        <p className="study-quiz-question">{question || 'Loading question...'}</p>

        {/* DEV MODE: Show correct answer for testing */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            background: '#fef3c7',
            border: '1px dashed #f59e0b',
            padding: '4px 8px',
            borderRadius: '4px',
            marginBottom: '6px',
            fontSize: '10px',
            color: '#92400e'
          }}>
            🧪 DEV: Answer <strong>{letters[correctIndex] || '?'}</strong>
          </div>
        )}

        {/* Options */}
        <div className="study-quiz-options">
          {options.map((option, index) => (
            <button
              key={index}
              className={getOptionClass(index)}
              onClick={() => handleOptionClick(index)}
              disabled={showFeedback}
            >
              <span className="study-quiz-option-letter">
                {letters[index]}
              </span>
              <span className="study-quiz-option-text">{stripLetterPrefix(option)}</span>
            </button>
          ))}
        </div>

        {/* Feedback */}
        {showFeedback && (() => {
          const shortRationale = getShortRationale(rationale);
          const hasMore = hasMoreRationale(rationale, shortRationale);

          return (
            <div className={`study-quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
              <div className="study-quiz-feedback-header">
                <div className="study-quiz-feedback-icon">
                  {isCorrect ? <CheckIcon /> : <XIcon />}
                </div>
                <span className="study-quiz-feedback-title">
                  {isCorrect ? 'Correct!' : 'Incorrect'}
                </span>
              </div>

              {/* Show correct answer when wrong - Duolingo style */}
              {!isCorrect && (
                <div className="study-quiz-correct-answer">
                  <span className="correct-answer-label">Correct Answer:</span>
                  <span className="correct-answer-text">
                    {letters[correctIndex]}. {stripLetterPrefix(options[correctIndex])}
                  </span>
                </div>
              )}

              {/* Short rationale - always visible */}
              {shortRationale && (
                <p className="study-quiz-feedback-short">
                  {shortRationale}
                </p>
              )}

              {/* Expandable full rationale */}
              {hasMore && (
                <>
                  <button
                    className="study-quiz-learn-more-btn"
                    onClick={() => setShowFullRationale(!showFullRationale)}
                  >
                    {showFullRationale ? (
                      <>
                        <ChevronUpIcon />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon />
                        Learn more
                      </>
                    )}
                  </button>

                  {showFullRationale && (
                    <div
                      className="study-quiz-feedback-rationale"
                      dangerouslySetInnerHTML={{ __html: rationale }}
                    />
                  )}
                </>
              )}

              {/* Duolingo-style action button inside feedback */}
              {(hasMoreQuestions || needsReviewRound()) && (
                <button
                  className={`study-quiz-feedback-btn ${isCorrect ? 'correct' : 'incorrect'}`}
                  onClick={handleNextQuestion}
                >
                  {isCorrect ? 'CONTINUE' : 'GOT IT'}
                </button>
              )}
            </div>
          );
        })()}
      </div>

      {/* Summary and Continue - show when all questions are correct */}
      {allCorrect && (
        <div className="study-card-footer study-card-footer-stacked">
          <div className="study-completion-message">
            Excellent work! You got them all right.
          </div>
          <div className="study-quiz-summary">
            <span className="summary-item got-it">
              <CheckIcon /> {totalQuestions} correct
            </span>
          </div>
          <button className="study-continue-btn" onClick={onContinue}>
            Continue
            <ArrowRightIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyQuizCard;
