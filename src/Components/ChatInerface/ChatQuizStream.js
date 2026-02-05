import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { playCorrectSound, playIncorrectSound, playCelebrationSound, playMilestoneSound } from '../../utils/soundEffects';
import './ChatQuizStream.css';

/**
 * ChatQuizStream - High-dopamine quiz component for chat interface
 * Based on StudyQuizCard with streaming support, sounds, and celebrations
 *
 * Adapts backend quiz format: { question, options, answer, justification, topic }
 * to the internal format needed for the Duolingo-style experience.
 */
const ChatQuizStream = ({
  quizData = [],
  messageId,
  isStreaming = false,
  expectedTotal = 10,
  onAnswerSelect,
  onComplete,
  onFeedbackSubmit,
  feedbackData
}) => {
  const { t } = useTranslation();

  // Convert backend format to internal format
  // Backend: { question, options, answer, justification, topic, userSelection?, correctIndex? }
  // Internal: { question, options, correctIndex, rationale, topic }
  const questions = useMemo(() => {
    return quizData.map(q => {
      // Determine correctIndex - multiple strategies
      let correctIndex = -1;

      // Get the answer field - could be 'answer', 'correct_answer', or 'correctAnswer'
      const answerValue = q.answer ?? q.correct_answer ?? q.correctAnswer;

      // Strategy 1: If correctIndex is already provided as a number
      if (typeof q.correctIndex === 'number') {
        correctIndex = q.correctIndex;
      }
      // Strategy 2: If correct_index is provided (snake_case from backend)
      else if (typeof q.correct_index === 'number') {
        correctIndex = q.correct_index;
      }
      // Strategy 3: If answer is a number or numeric string (0-indexed)
      else if (answerValue !== undefined && !isNaN(parseInt(answerValue)) && parseInt(answerValue) < (q.options?.length || 0)) {
        correctIndex = parseInt(answerValue);
      }
      // Strategy 4: Robust Letter Parsing
      else if (typeof answerValue === 'string') {
        const trimmed = answerValue.trim();

        // Pattern 1: "Option X is correct" or "Option X:" or "Option X " (with anything after)
        const optionIsCorrectMatch = trimmed.match(/^Option\s+([A-F])(?:\s+is\s+correct|\s*:|(?=\s|$))/i);

        // Pattern 2: Explicit "Answer: X" or "Answer X" format
        const answerMatch = trimmed.match(/^Answer[:\s]+([A-F])(?:\b|$)/i);

        // Pattern 3: Standalone letter with optional punctuation "A", "A.", "(A)", "[A]"
        const standaloneMatch = trimmed.match(/^[\(\[]?([A-F])[\.\)\]]?$/i);

        // Pattern 4: Just letter followed by any text (e.g., "A. They regulate..." - extract first letter)
        const letterStartMatch = trimmed.match(/^([A-F])[\.\)\:\s]/i);

        if (optionIsCorrectMatch) {
          correctIndex = optionIsCorrectMatch[1].toUpperCase().charCodeAt(0) - 65;
        } else if (answerMatch) {
          correctIndex = answerMatch[1].toUpperCase().charCodeAt(0) - 65;
        } else if (standaloneMatch) {
          correctIndex = standaloneMatch[1].toUpperCase().charCodeAt(0) - 65;
        } else if (letterStartMatch) {
          correctIndex = letterStartMatch[1].toUpperCase().charCodeAt(0) - 65;
        }
      }

      // Strategy 5: Extract letter from sentences like "Option A is correct because..."
      if (correctIndex === -1 && typeof answerValue === 'string') {
        // Look for "Option X is correct" anywhere in the string
        const optionCorrectAnywhere = answerValue.match(/Option\s+([A-F])\s+is\s+correct/i);
        if (optionCorrectAnywhere) {
          correctIndex = optionCorrectAnywhere[1].toUpperCase().charCodeAt(0) - 65;
        }
      }

      // Strategy 5b: Check if justification contains "Option X is correct" (fallback)
      if (correctIndex === -1 && q.justification) {
        const justificationMatch = q.justification.match(/Option\s+([A-F])\s+is\s+correct/i);
        if (justificationMatch) {
          correctIndex = justificationMatch[1].toUpperCase().charCodeAt(0) - 65;
        }
      }

      // Strategy 6: Full text match (if not found by letter)
      if (correctIndex === -1 && q.options && answerValue) {
        const answerStr = String(answerValue).trim();

        // Try exact match first
        const exactMatch = q.options.findIndex(opt => String(opt).trim() === answerStr);
        if (exactMatch !== -1) {
          correctIndex = exactMatch;
        } else {
          // Strategy 7: Normalize both and compare
          const normalizeText = (text) => {
            return String(text)
              .trim()
              .toLowerCase()
              .replace(/^[a-f][\)\.\:\s]+\s*/i, '') // Remove letter prefix like "A) " or "A. "
              .replace(/\s+/g, ' ') // Normalize whitespace
              .replace(/[^\w\s]/g, ''); // Remove punctuation
          };

          const normalizedAnswer = normalizeText(answerStr);

          // Only proceed with fuzzy match if we have enough content
          // This prevents "A" from matching "Apple" via includes()
          if (normalizedAnswer.length >= 2) {
            correctIndex = q.options.findIndex(opt => {
              const normalizedOpt = normalizeText(opt);
              // Check various matching strategies
              return normalizedOpt === normalizedAnswer ||
                normalizedOpt.includes(normalizedAnswer) ||
                (normalizedAnswer.length > 5 && normalizedAnswer.includes(normalizedOpt)) ||
                // Also try matching first 50 chars in case of truncation
                (normalizedAnswer.length > 10 && normalizedOpt.substring(0, 50) === normalizedAnswer.substring(0, 50));
            });
          }
        }
      }

      // Debug logging - especially useful when correctIndex is -1
      if (correctIndex === -1) {
        console.warn('⚠️ Quiz correctIndex could not be determined:', {
          questionPreview: q.question?.substring(0, 50),
          rawAnswer: q.answer,
          rawCorrectAnswer: q.correct_answer,
          answerValue: answerValue,
          answerValueType: typeof answerValue,
          answerValueLength: answerValue?.length,
          providedCorrectIndex: q.correctIndex,
          providedCorrectIndexSnake: q.correct_index,
          optionsCount: q.options?.length,
          options: q.options?.map((o, i) => `${i}: ${String(o).substring(0, 50)}`)
        });
      } else {
        console.log('🎯 Quiz correctIndex calculated:', {
          questionPreview: q.question?.substring(0, 50),
          answerValue: String(answerValue).substring(0, 50),
          calculatedIndex: correctIndex
        });
      }

      return {
        ...q,
        correctIndex,
        rationale: q.justification || '',
        // Preserve userSelection if already answered
        userSelection: q.userSelection
      };
    });
  }, [quizData]);

  const totalQuestions = questions.length;

  // UI state
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showFullRationale, setShowFullRationale] = useState(false);

  // Question queue management
  const [queueIndex, setQueueIndex] = useState(0);
  const [questionStatuses, setQuestionStatuses] = useState({});
  const [isReviewRound, setIsReviewRound] = useState(false);
  // Initialize queue with indices when questions exist - critical for streaming!
  const [questionQueue, setQuestionQueue] = useState(() =>
    quizData.length > 0 ? quizData.map((_, i) => i) : []
  );

  // Celebration states
  const [showMilestoneCelebration, setShowMilestoneCelebration] = useState(false);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const [showReviewTransition, setShowReviewTransition] = useState(false);
  const [reviewTransitionCount, setReviewTransitionCount] = useState(0);
  const [hasShownMilestone, setHasShownMilestone] = useState(false);
  const [waitingForNextQuestion, setWaitingForNextQuestion] = useState(false);

  // Post-completion review mode (browse questions without answering)
  const [isPostReviewMode, setIsPostReviewMode] = useState(false);
  const [postReviewIndex, setPostReviewIndex] = useState(0);

  // XP animation
  const [showXpPopup, setShowXpPopup] = useState(false);

  // Tracking
  const startTimeRef = useRef(Date.now());
  const hasRestoredProgress = useRef(false);

  // Option letters
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Initialize/update queue when questions change (streaming support)
  useEffect(() => {
    if (totalQuestions === 0) return;

    // Restore previous answers from quizData
    if (!hasRestoredProgress.current) {
      const restoredStatuses = {};
      questions.forEach((q, idx) => {
        if (q.userSelection) {
          restoredStatuses[idx] = q.userSelection.isCorrect ? 'correct' : 'incorrect';
        }
      });

      if (Object.keys(restoredStatuses).length > 0) {
        setQuestionStatuses(restoredStatuses);
        // Find first unanswered
        const firstUnanswered = questions.findIndex((q, idx) => !restoredStatuses[idx]);
        if (firstUnanswered === -1) {
          // All answered - check if review needed
          const incorrectCount = Object.values(restoredStatuses).filter(s => s === 'incorrect').length;
          if (incorrectCount > 0 && !isStreaming) {
            setIsReviewRound(true);
            const reviewQueue = Object.entries(restoredStatuses)
              .filter(([_, status]) => status === 'incorrect')
              .map(([idx]) => parseInt(idx));
            setQuestionQueue(reviewQueue);
            setQueueIndex(0);
          } else if (incorrectCount === 0) {
            setShowCompletionCelebration(true);
            playCelebrationSound();
          }
        } else {
          setQueueIndex(firstUnanswered);
        }
      }
      // Always mark as restored after first check, even if no data to restore
      // This prevents the restore logic from running again when userSelection is saved
      hasRestoredProgress.current = true;
    }

    // Update queue for streaming
    if (!isReviewRound) {
      const newQueue = questions.map((_, i) => i);
      if (newQueue.length !== questionQueue.length) {
        setQuestionQueue(newQueue);

        // Auto-advance if waiting for next question
        if (waitingForNextQuestion && newQueue.length > queueIndex + 1) {
          setWaitingForNextQuestion(false);
          setQueueIndex(queueIndex + 1);
          resetQuestionState();
        }
      }
    }
  }, [questions, totalQuestions, isStreaming, isReviewRound, questionQueue.length, queueIndex, waitingForNextQuestion]);

  // ✅ Sync questionStatuses with quizData.userSelection when props update (save as you go)
  // This ensures answers are persisted and restored correctly when quizData is updated from Firebase
  useEffect(() => {
    if (totalQuestions === 0) return;

    // Build status map from current quizData userSelections
    const statusesFromProps = {};
    questions.forEach((q, idx) => {
      if (q.userSelection) {
        statusesFromProps[idx] = q.userSelection.isCorrect ? 'correct' : 'incorrect';
      }
    });

    // Merge with existing statuses (props take precedence for answered questions)
    setQuestionStatuses(prev => {
      const merged = { ...prev };
      let hasChanges = false;

      Object.entries(statusesFromProps).forEach(([idx, status]) => {
        if (merged[idx] !== status) {
          merged[idx] = status;
          hasChanges = true;
        }
      });

      return hasChanges ? merged : prev;
    });
  }, [questions, totalQuestions]);

  // Current question - use direct index if queue not yet populated (streaming)
  // This ensures the first question shows IMMEDIATELY when it arrives
  const currentQueuePosition = questionQueue.length > 0 ? (questionQueue[queueIndex] ?? 0) : queueIndex;
  const currentQuestion = questions[currentQueuePosition] || {};
  const { question, options = [], correctIndex, rationale, topic } = currentQuestion;

  // Progress calculations
  const correctCount = Object.values(questionStatuses).filter(s => s === 'correct').length;
  const allQuestionsReceived = !isStreaming || totalQuestions >= expectedTotal;
  const allCorrect = correctCount === totalQuestions && totalQuestions > 0 && allQuestionsReceived;

  // Milestone at 30% of expected total
  const milestoneTotal = expectedTotal || 10;
  const minQuestionsForMilestone = Math.ceil(milestoneTotal * 0.3);

  // Trigger milestone celebration
  useEffect(() => {
    if (correctCount >= minQuestionsForMilestone && !hasShownMilestone && !isReviewRound && correctCount < totalQuestions) {
      setShowMilestoneCelebration(true);
      setHasShownMilestone(true);
      playMilestoneSound();
    }
  }, [correctCount, minQuestionsForMilestone, hasShownMilestone, isReviewRound, totalQuestions]);

  // Trigger completion celebration
  useEffect(() => {
    // Don't auto-trigger if already in post-review mode
    if (allCorrect && totalQuestions > 0 && !showCompletionCelebration && !isPostReviewMode) {
      const timer = setTimeout(() => {
        setShowCompletionCelebration(true);
        playCelebrationSound();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allCorrect, totalQuestions, showCompletionCelebration, isPostReviewMode]);

  // Reset question state helper
  const resetQuestionState = useCallback(() => {
    setSelectedIndex(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setShowFullRationale(false);
  }, []);

  // Track previous queue position to detect navigation
  const prevQueuePositionRef = useRef(currentQueuePosition);

  // ✅ Restore UI state when navigating to a NEW question
  // In review round, allow re-answering so reset state when navigating
  useEffect(() => {
    // Only run when actually navigating to a different question
    if (prevQueuePositionRef.current === currentQueuePosition) {
      return;
    }
    prevQueuePositionRef.current = currentQueuePosition;

    // In review round, questions should be answerable again - reset state for each question
    if (isReviewRound) {
      // Reset to allow re-answering
      setSelectedIndex(null);
      setShowFeedback(false);
      setIsCorrect(false);
      setShowFullRationale(false);
      return;
    }

    const currentQ = questions[currentQueuePosition];
    if (currentQ?.userSelection) {
      // Question was previously answered - restore the UI state
      const userSel = currentQ.userSelection;
      setSelectedIndex(userSel.selectedIndex ?? userSel.selectedOptionIndex ?? null);
      setIsCorrect(userSel.isCorrect);
      setShowFeedback(true);
      setShowFullRationale(false);
    }
    // If no userSelection, the question is unanswered - state should already be clean from resetQuestionState
  }, [currentQueuePosition, isReviewRound, questions]);

  // Strip letter prefix from options
  const stripLetterPrefix = (text) => {
    if (!text) return '';
    if (typeof text !== 'string') return String(text);
    return text.replace(/^[A-Fa-f][).:]\s*/, '');
  };

  // Get short rationale
  const getShortRationale = (fullRationale) => {
    if (!fullRationale) return null;
    const textOnly = fullRationale.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const correctMatch = textOnly.match(/Option\s+[A-D]\s+is\s+correct[^.]*\./i);
    if (correctMatch) return correctMatch[0];
    const firstSentence = textOnly.match(/^[^.!?]+[.!?]/);
    if (firstSentence && firstSentence[0].length < 200) return firstSentence[0];
    return textOnly.substring(0, 150) + '...';
  };

  const hasMoreRationale = (fullRationale, shortRationale) => {
    if (!fullRationale || !shortRationale) return false;
    const textOnly = fullRationale.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return textOnly.length > shortRationale.length + 20;
  };

  // Handle option click
  const handleOptionClick = useCallback((index) => {
    if (showFeedback) return;

    setSelectedIndex(index);
    const correct = index === correctIndex;
    setIsCorrect(correct);
    setShowFeedback(true);

    // Play sound
    if (correct) {
      playCorrectSound();
      // Show XP popup
      setShowXpPopup(true);
      setTimeout(() => setShowXpPopup(false), 1500);
      // Vibrate on mobile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } else {
      playIncorrectSound();
    }

    // Update status
    const newStatuses = {
      ...questionStatuses,
      [currentQueuePosition]: correct ? 'correct' : 'incorrect'
    };
    setQuestionStatuses(newStatuses);

    // Notify parent
    if (onAnswerSelect) {
      onAnswerSelect({
        messageId,
        quizIndex: currentQueuePosition,
        questionText: question,
        selectedOptionIndex: index,
        selectedOptionText: options[index],
        correctOptionIndex: correctIndex,
        correctOptionText: options[correctIndex],
        isCorrect: correct,
        timestamp: new Date().toISOString(),
        topic: topic || null,
        isReviewAttempt: isReviewRound // Flag to tell parent to override existing answer
      });
    }
  }, [showFeedback, correctIndex, questionStatuses, currentQueuePosition, messageId, question, options, topic, onAnswerSelect, isReviewRound]);

  // Handle next question
  const handleNextQuestion = useCallback(() => {
    const nextQueueIndex = queueIndex + 1;

    if (nextQueueIndex >= questionQueue.length) {
      // Check if still streaming
      if (isStreaming && totalQuestions < expectedTotal) {
        setWaitingForNextQuestion(true);
        resetQuestionState();
        return;
      }

      // Check for questions that still need review (answered incorrectly)
      const questionsToReview = Object.entries(questionStatuses)
        .filter(([_, status]) => status === 'incorrect')
        .map(([idx]) => parseInt(idx));

      if (questionsToReview.length > 0) {
        if (!isReviewRound) {
          // First time entering review round - show transition
          setReviewTransitionCount(questionsToReview.length);
          setShowReviewTransition(true);
          setIsReviewRound(true);
        }
        // Cycle through incorrect questions again (whether first time or continuing review)
        setQuestionQueue(questionsToReview);
        setQueueIndex(0);
        resetQuestionState();
      } else {
        // No questions to review - all correct, trigger completion immediately
        setShowCompletionCelebration(true);
        playCelebrationSound();
      }
    } else {
      setQueueIndex(nextQueueIndex);
      resetQuestionState();
    }
  }, [queueIndex, questionQueue.length, isStreaming, totalQuestions, expectedTotal, questionStatuses, resetQuestionState, isReviewRound]);

  // Calculate progress for display
  const getProgressPercent = () => {
    const displayTotal = isStreaming ? expectedTotal : totalQuestions;
    if (displayTotal === 0) return 0;
    if (allCorrect) return 100;
    if (isReviewRound) {
      // In review mode, show progress through the review queue (not overall correctness)
      const reviewTotal = questionQueue.length;
      if (reviewTotal === 0) return 0;
      return ((queueIndex + (showFeedback ? 1 : 0)) / reviewTotal) * 100;
    }
    return ((queueIndex + (showFeedback ? 1 : 0)) / displayTotal) * 100;
  };

  // Check if there are more questions
  const hasMoreQuestions = queueIndex < questionQueue.length - 1;
  const moreQuestionsExpected = isStreaming && totalQuestions < expectedTotal;
  const needsReviewRound = () => {
    if (hasMoreQuestions || moreQuestionsExpected) return false;
    return Object.values(questionStatuses).filter(s => s === 'incorrect').length > 0;
  };

  // Calculate XP earned
  const xpEarned = correctCount * 10;
  const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
  const isPerfect = correctCount === totalQuestions && Object.values(questionStatuses).every(s => s === 'correct');

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Icons
  const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  const ChevronDownIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  const ChevronUpIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );

  const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );

  // Render milestone celebration
  if (showMilestoneCelebration) {
    return (
      <div className="chat-quiz-stream-card">
        <div className="cqs-milestone-celebration">
          <div className="cqs-milestone-icon">
            <span>🎯</span>
          </div>
          <h2 className="cqs-milestone-title">{t('study.milestoneGreat1', "You're doing great!")}</h2>
          <p className="cqs-milestone-stats">
            {correctCount} / {totalQuestions} {t('quiz.correct', 'correct')}
          </p>
          <button
            className="cqs-milestone-btn"
            onClick={() => setShowMilestoneCelebration(false)}
          >
            {t('study.continue', 'CONTINUE')}
          </button>
        </div>
      </div>
    );
  }

  // Render completion celebration
  if (showCompletionCelebration) {
    return (
      <div className="chat-quiz-stream-card">
        <div className="cqs-completion-celebration">
          {/* Confetti */}
          <div className="cqs-confetti">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={`cqs-confetti-particle cqs-confetti-${i % 5}`}
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${1.5 + Math.random() * 1}s`
                }}
              />
            ))}
          </div>

          <div className="cqs-completion-icon">
            <span>🎉</span>
          </div>
          <h2 className="cqs-completion-title">{t('study.lessonComplete', 'Amazing work!')}</h2>

          <div className="cqs-completion-stats">
            <div className="cqs-stat-card cqs-stat-xp">
              <span className="cqs-stat-label">{t('study.totalXP', 'TOTAL XP')}</span>
              <div className="cqs-stat-value">
                <span className="cqs-stat-icon">⚡</span>
                <span className="cqs-stat-number">{xpEarned}</span>
              </div>
            </div>
          </div>

          <div className="cqs-completion-buttons">
            <button
              className="cqs-review-questions-btn"
              onClick={() => {
                setShowCompletionCelebration(false);
                setIsPostReviewMode(true);
                setPostReviewIndex(0);
              }}
            >
              {t('study.reviewQuestions', 'Review Questions')} 📖
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render review transition
  if (showReviewTransition) {
    return (
      <div className="chat-quiz-stream-card">
        <div className="cqs-review-transition">
          <div className="cqs-review-icon">
            <RefreshIcon />
          </div>
          <h2 className="cqs-review-title">{t('study.timeToReview', 'Time to Review!')}</h2>
          <p className="cqs-review-message">
            {t('study.reviewQuestionMessage', {
              count: reviewTransitionCount,
              defaultValue: `You have ${reviewTransitionCount} question${reviewTransitionCount > 1 ? 's' : ''} to review. Let's try again!`
            })}
          </p>
          <button
            className="cqs-review-btn"
            onClick={() => setShowReviewTransition(false)}
          >
            {t('study.startReview', "Let's Go!")} →
          </button>
        </div>
      </div>
    );
  }

  // Render post-completion review mode (browse questions without answering)
  if (isPostReviewMode) {
    const reviewQuestion = questions[postReviewIndex] || {};
    const reviewOptions = reviewQuestion.options || [];
    const reviewCorrectIndex = reviewQuestion.correctIndex;
    const reviewRationale = reviewQuestion.rationale;

    return (
      <div className="chat-quiz-stream-card">
        {/* Progress bar for review */}
        <div className="cqs-progress-container">
          <div className="cqs-progress-bar">
            <div
              className="cqs-progress-fill"
              style={{ width: `${((postReviewIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
          <div className="cqs-progress-text">
            <span className="cqs-progress-count">
              {postReviewIndex + 1} / {totalQuestions}
            </span>
            <span className="cqs-review-badge">
              📖 {t('study.reviewMode', 'Review Mode')}
            </span>
          </div>
        </div>

        {/* Question content */}
        <div className="cqs-question-wrapper">
          {/* Question number badge */}
          <div className="cqs-question-number">
            {t('quiz.questionNumber', 'Question')} {postReviewIndex + 1} {t('quiz.of', 'of')} {totalQuestions}
          </div>

          {/* Topic badge */}
          {reviewQuestion.topic && (
            <div className="cqs-topic-badge">
              <span className="cqs-topic-icon">📚</span>
              <span className="cqs-topic-text">{reviewQuestion.topic}</span>
            </div>
          )}

          {/* Question */}
          <div className="cqs-question">
            {reviewQuestion.question || 'Loading question...'}
          </div>

          {/* Options - show correct answer highlighted */}
          <div className="cqs-options">
            {reviewOptions.map((option, index) => {
              const isCorrectOption = index === reviewCorrectIndex;
              return (
                <div
                  key={index}
                  className={`cqs-option disabled ${isCorrectOption ? 'correct' : ''}`}
                >
                  <span className="cqs-option-letter">{letters[index]}</span>
                  <span className="cqs-option-text">{stripLetterPrefix(option)}</span>
                  {isCorrectOption && <span className="cqs-correct-indicator">✓</span>}
                </div>
              );
            })}
          </div>

          {/* Always show rationale in review mode */}
          {reviewRationale && (
            <div className="cqs-feedback correct" style={{ marginTop: '20px' }}>
              <div className="cqs-feedback-header">
                <div className="cqs-feedback-icon">
                  <CheckIcon />
                </div>
                <span className="cqs-feedback-title">{t('study.explanation', 'Explanation')}</span>
              </div>
              <div
                className="cqs-feedback-rationale"
                style={{ marginLeft: 0, marginTop: '12px' }}
                dangerouslySetInnerHTML={{ __html: reviewRationale }}
              />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="cqs-post-review-nav">
            <button
              className="cqs-nav-btn cqs-nav-prev"
              onClick={() => setPostReviewIndex(prev => Math.max(0, prev - 1))}
              disabled={postReviewIndex === 0}
            >
              ← {t('study.previous', 'Previous')}
            </button>

            <button
              className="cqs-nav-btn cqs-nav-done"
              onClick={() => {
                setIsPostReviewMode(false);
                if (onComplete) onComplete({ xpEarned, timeTaken, isPerfect, correctCount, totalQuestions });
              }}
            >
              {t('study.done', 'Done')}
            </button>

            <button
              className="cqs-nav-btn cqs-nav-next"
              onClick={() => setPostReviewIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
              disabled={postReviewIndex === totalQuestions - 1}
            >
              {t('study.next', 'Next')} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render waiting for questions (streaming) - Now shows skeleton preview
  // Only show skeleton if NO questions at all, or if waiting for next AND current question isn't ready
  const hasValidCurrentQuestion = currentQuestion && currentQuestion.question && options.length > 0;
  if ((isStreaming && totalQuestions === 0) || (waitingForNextQuestion && !hasValidCurrentQuestion)) {
    return (
      <div className="chat-quiz-stream-card">
        <div className="cqs-skeleton-loading">
          {/* Progress indicator */}
          <div className="cqs-skeleton-progress">
            <div className="cqs-skeleton-progress-bar">
              <div className="cqs-skeleton-progress-pulse" />
            </div>
            <div className="cqs-skeleton-progress-text">
              <span className="cqs-skeleton-count">
                {waitingForNextQuestion
                  ? t('study.loadingNextQuestion', 'Loading next question...')
                  : t('study.generatingQuestions', 'Generating questions...')}
              </span>
              <span className="cqs-streaming-indicator">
                <span className="cqs-streaming-dot"></span>
                <span className="cqs-streaming-dot"></span>
                <span className="cqs-streaming-dot"></span>
              </span>
            </div>
          </div>

          {/* Skeleton question */}
          <div className="cqs-skeleton-question">
            <div className="cqs-skeleton-line cqs-skeleton-line-long"></div>
            <div className="cqs-skeleton-line cqs-skeleton-line-medium"></div>
          </div>

          {/* Skeleton options */}
          <div className="cqs-skeleton-options">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="cqs-skeleton-option" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="cqs-skeleton-option-letter"></div>
                <div className="cqs-skeleton-option-text">
                  <div className="cqs-skeleton-line cqs-skeleton-line-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render quiz question
  const shortRationale = getShortRationale(rationale);
  const hasMore = hasMoreRationale(rationale, shortRationale);

  // Key for question animation - changes when question changes
  const questionKey = `question-${currentQueuePosition}-${isReviewRound ? 'review' : 'initial'}`;

  return (
    <div className="chat-quiz-stream-card">
      {/* XP Popup */}
      {showXpPopup && (
        <div className="cqs-xp-popup">
          +10 XP
        </div>
      )}

      {/* Progress bar */}
      <div className="cqs-progress-container">
        <div className="cqs-progress-bar">
          <div
            className="cqs-progress-fill"
            style={{ width: `${getProgressPercent()}%` }}
          />
          {isStreaming && <div className="cqs-progress-shimmer" />}
        </div>
        <div className="cqs-progress-text">
          <span className="cqs-progress-count">
            {isReviewRound
              ? `${queueIndex + 1} / ${questionQueue.length}`
              : `${queueIndex + 1} / ${isStreaming ? `${totalQuestions}+` : totalQuestions}`
            }
          </span>
          {isStreaming && !isReviewRound && (
            <span className="cqs-streaming-indicator">
              <span className="cqs-streaming-dot"></span>
              <span className="cqs-streaming-dot"></span>
              <span className="cqs-streaming-dot"></span>
            </span>
          )}
          {isReviewRound && (
            <span className="cqs-review-badge">
              <RefreshIcon /> {t('quiz.review', 'Review')} ({questionQueue.length} {t('quiz.remaining', 'left')})
            </span>
          )}
        </div>
      </div>

      {/* Question content with animation wrapper */}
      <div key={questionKey} className="cqs-question-wrapper cqs-question-enter">
        {/* Question number badge */}
        <div className="cqs-question-number">
          {t('quiz.questionNumber', 'Question')} {queueIndex + 1}
          {isStreaming && !isReviewRound && ` ${t('quiz.of', 'of')} ${totalQuestions}+`}
          {!isStreaming && !isReviewRound && ` ${t('quiz.of', 'of')} ${totalQuestions}`}
        </div>

        {/* Topic badge */}
        {topic && (
          <div className="cqs-topic-badge">
            <span className="cqs-topic-icon">📚</span>
            <span className="cqs-topic-text">{topic}</span>
          </div>
        )}

        {/* Question */}
        <div className="cqs-question">
          {question || 'Loading question...'}
        </div>

        {/* Options */}
        <div className="cqs-options">
          {options.map((option, index) => {
            let optionClass = 'cqs-option cqs-option-enter';
            if (showFeedback) {
              optionClass += ' disabled';
              if (index === selectedIndex) {
                if (isCorrect) {
                  optionClass += ' correct';
                } else {
                  optionClass += ' incorrect';
                }
              }
            } else if (index === selectedIndex) {
              optionClass += ' selected';
            }

            return (
              <button
                key={index}
                className={optionClass}
                onClick={() => handleOptionClick(index)}
                disabled={showFeedback}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <span className="cqs-option-letter">{letters[index]}</span>
                <span className="cqs-option-text">{stripLetterPrefix(option)}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`cqs-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
            <div className="cqs-feedback-header">
              <div className="cqs-feedback-icon">
                {isCorrect ? <CheckIcon /> : <XIcon />}
              </div>
              <span className="cqs-feedback-title">
                {isCorrect ? t('study.correct', 'Correct!') : t('study.incorrect', 'Incorrect')}
              </span>
            </div>

            {/* Show correct answer when wrong */}
            {!isCorrect && correctIndex >= 0 && correctIndex < options.length && (
              <div className="cqs-correct-answer">
                <span className="cqs-correct-label">{t('study.correctAnswer', 'Correct Answer:')}</span>
                <span className="cqs-correct-text">
                  {letters[correctIndex]}. {stripLetterPrefix(options[correctIndex])}
                </span>
              </div>
            )}

            {/* Short rationale */}
            {shortRationale && (
              <p className="cqs-feedback-short">{shortRationale}</p>
            )}

            {/* Learn more button */}
            {hasMore && (
              <>
                <button
                  className="cqs-learn-more-btn"
                  onClick={() => setShowFullRationale(!showFullRationale)}
                >
                  {showFullRationale ? (
                    <>
                      <ChevronUpIcon />
                      {t('study.showLess', 'Show less')}
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon />
                      {t('study.learnMore', 'Learn more')}
                    </>
                  )}
                </button>

                {showFullRationale && (
                  <div
                    className="cqs-feedback-rationale"
                    dangerouslySetInnerHTML={{ __html: rationale }}
                  />
                )}
              </>
            )}

            {/* Continue/Next button - always show when feedback is visible */}
            <button
              className={`cqs-feedback-btn ${isCorrect ? 'correct' : 'incorrect'}`}
              onClick={handleNextQuestion}
            >
              {hasMoreQuestions || moreQuestionsExpected || needsReviewRound()
                ? (isCorrect ? t('study.continue', 'CONTINUE') : t('study.gotIt', 'GOT IT'))
                : t('study.finish', 'FINISH')
              }
            </button>
          </div>
        )}

        {/* Streaming status - shows when more questions are generating */}
        {isStreaming && !isReviewRound && !showFeedback && totalQuestions < expectedTotal && (
          <div className="cqs-streaming-status">
            <span className="cqs-streaming-status-text">
              {t('quiz.generatingMore', 'Generating more questions')}
            </span>
            <span className="cqs-streaming-status-count">{totalQuestions}/{expectedTotal}</span>
            <span className="cqs-streaming-indicator">
              <span className="cqs-streaming-dot"></span>
              <span className="cqs-streaming-dot"></span>
              <span className="cqs-streaming-dot"></span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatQuizStream;
