/**
 * ============================================
 * SATA QUESTION COMPONENT
 * ============================================
 *
 * A Select All That Apply (SATA) question component for NCLEX-style quizzes.
 *
 * Key Features:
 * - Multiple selection via checkboxes
 * - Manual submit button (user clicks when ready)
 * - NCLEX-style partial credit scoring
 * - Visual feedback for each option (correct/incorrect/missed)
 * - Accessible with keyboard navigation
 * - Responsive design matching existing quiz styles
 *
 * Props:
 * - quiz: The question data object
 * - quizIndex: Index of current question (for display "Question X of Y")
 * - totalQuestions: Total number of questions
 * - onAnswerSelect: Callback when answer is submitted
 * - onNext: Callback to move to next question
 * - isLastQuestion: Boolean indicating if this is the last question
 * - inModal: Boolean for fullscreen modal styling
 *
 * @author NurseQuiz Team
 * @version 1.1.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  calculateSATAScore,
  getSATAOptionFeedback
} from '../../utils/quizScoring';
import './SATAQuestion.css';

// ============================================
// CONSTANTS
// ============================================

/** Letters to display for each option (A, B, C, D, E, F) */
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Minimum selections required before submit is allowed */
const MIN_SELECTIONS = 1;

// ============================================
// ICON COMPONENTS
// ============================================

/**
 * Checkmark icon for correct selections
 */
function CheckmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * X mark icon for incorrect selections
 */
function XMarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Circle icon for missed correct options
 */
function MissedIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" strokeWidth="2" />
    </svg>
  );
}

/**
 * Checkbox icon (unchecked state)
 */
function CheckboxEmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="checkbox-icon" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="none" strokeWidth="2" />
    </svg>
  );
}

/**
 * Checkbox icon (checked state)
 */
function CheckboxCheckedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="checkbox-icon checked" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" strokeWidth="0" />
      <polyline points="7 12 10 15 17 8" stroke="white" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

/**
 * Expand icon for fullscreen button
 */
function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Cleans up justification text from backend
 * Removes any instruction artifacts that might slip through
 */
function sanitizeJustification(justification) {
  if (!justification) return '';

  return justification
    .replace(/Use this EXACT format with html:\s*/gi, '')
    .replace(/Use this format with html:\s*/gi, '')
    .replace(/\[1-2 sentences.*?\]/gi, '')
    .replace(/\[1 sentence.*?\]/gi, '')
    .trim();
}

/**
 * Strips the letter prefix from option text
 * Backend sends options like "A) Crushing chest pain..." but we render
 * the letter badge separately, so we need to remove the prefix
 *
 * Handles formats: "A) text", "A. text", "A: text", "A - text"
 */
function stripLetterPrefix(optionText) {
  if (!optionText) return '';

  // Match patterns like "A) ", "A. ", "A: ", "A - " at the start
  // Supports A-H (up to 8 options)
  return optionText.replace(/^[A-Ha-h][\)\.\:\-]\s*/i, '').trim();
}

/**
 * Gets the appropriate feedback message based on score percentage
 */
function getFeedbackMessage(percentage, t) {
  if (percentage >= 100) return t('sata.feedback100');
  if (percentage >= 80) return t('sata.feedback80');
  if (percentage >= 60) return t('sata.feedback60');
  if (percentage >= 40) return t('sata.feedback40');
  return t('sata.feedback0');
}

// ============================================
// MAIN COMPONENT
// ============================================

function SATAQuestion({
  quiz,
  quizIndex = 0,
  totalQuestions = 0,
  onAnswerSelect,
  onNext,
  onSkip,
  isLastQuestion = false,
  inModal = false,
  reviewMode = false,
  previousAnswer = null,
  onOpenModal
}) {
  // ----------------------------------------
  // Hooks & State
  // ----------------------------------------
  const { t } = useTranslation();

  // Track which options are currently selected (by option text)
  const [selectedOptions, setSelectedOptions] = useState([]);

  // Track if the answer has been submitted/revealed
  const [revealed, setRevealed] = useState(false);

  // Track if feedback section should be shown
  const [showFeedback, setShowFeedback] = useState(false);

  // Store the calculated score result after submission
  const [scoreResult, setScoreResult] = useState(null);

  // Store option feedback for visual display
  const [optionFeedback, setOptionFeedback] = useState([]);

  // ----------------------------------------
  // Derived Values
  // ----------------------------------------

  // Get correct answers as array
  const correctAnswers = useMemo(() => {
    if (!quiz) return [];
    return Array.isArray(quiz.answer) ? quiz.answer : [quiz.answer];
  }, [quiz]);

  // Check if current selection meets minimum requirement
  const canSubmit = selectedOptions.length >= MIN_SELECTIONS;

  // Calculate progress percentage for progress bar
  const progressStyle = useMemo(() => {
    if (totalQuestions === 0) return { width: '0%' };
    return { width: `${((quizIndex + 1) / totalQuestions) * 100}%` };
  }, [quizIndex, totalQuestions]);

  // ----------------------------------------
  // Effects
  // ----------------------------------------

  // Track the quiz question to detect actual question changes
  // Using question text as a stable identifier (more reliable than quiz object reference)
  const quizQuestionId = quiz?.question || '';

  /**
   * Reset state when question actually changes (not just reference changes)
   * This prevents state from resetting during normal re-renders
   */
  useEffect(() => {
    // Check if we have a previous answer (review mode or returning)
    if (previousAnswer && previousAnswer.selectedOptions) {
      setSelectedOptions(previousAnswer.selectedOptions);
      setRevealed(true);
      setShowFeedback(true);
      setScoreResult(previousAnswer.scoreResult || null);
      // Recalculate option feedback
      if (quiz && quiz.options) {
        const feedback = getSATAOptionFeedback(
          quiz.options,
          previousAnswer.selectedOptions,
          correctAnswers
        );
        setOptionFeedback(feedback);
      }
    } else {
      // Reset for new unanswered question
      setSelectedOptions([]);
      setRevealed(false);
      setShowFeedback(false);
      setScoreResult(null);
      setOptionFeedback([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizQuestionId, quizIndex]); // Only depend on stable identifiers, not object references

  // ----------------------------------------
  // Handlers
  // ----------------------------------------

  /**
   * Handles clicking/selecting an option
   * Toggles the option in the selected array
   */
  const handleOptionToggle = useCallback((optionText) => {
    // Don't allow changes after submission or in review mode
    if (revealed || reviewMode) return;

    setSelectedOptions(prev => {
      if (prev.includes(optionText)) {
        // Remove if already selected
        return prev.filter(opt => opt !== optionText);
      } else {
        // Add if not selected
        return [...prev, optionText];
      }
    });
  }, [revealed, reviewMode]);

  /**
   * Handles keyboard interaction for accessibility
   */
  const handleKeyDown = useCallback((event, optionText) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOptionToggle(optionText);
    }
  }, [handleOptionToggle]);

  /**
   * Submits the answer and calculates score
   */
  const handleSubmit = () => {
    // Prevent double submission
    if (revealed || !quiz) return;

    // Require at least one selection (button is disabled anyway, but safety check)
    if (selectedOptions.length < MIN_SELECTIONS) return;

    // Mark as revealed
    setRevealed(true);

    // Calculate NCLEX-style score
    const result = calculateSATAScore(selectedOptions, correctAnswers, 'partial');
    setScoreResult(result);

    // Get feedback for each option
    const feedback = getSATAOptionFeedback(quiz.options, selectedOptions, correctAnswers);
    setOptionFeedback(feedback);

    // Haptic feedback on good score
    if (result.percentage >= 80 && navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Show feedback section after brief delay
    setTimeout(() => {
      setShowFeedback(true);
    }, 300);

    // Call parent callback with answer data
    if (onAnswerSelect) {
      onAnswerSelect({
        quizIndex,
        questionType: 'sata',
        questionText: quiz.question,
        selectedOptions: selectedOptions,
        correctOptions: correctAnswers,
        scoreResult: result,
        isCorrect: result.isFullyCorrect,
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        timestamp: new Date(),
        topic: quiz.topic || null  // Include topic for progress tracking
      });
    }
  };

  // ----------------------------------------
  // Early Return
  // ----------------------------------------

  if (!quiz) {
    return null;
  }

  // ----------------------------------------
  // Render Helpers
  // ----------------------------------------

  /**
   * Determines the CSS class for an option based on its state
   */
  const getOptionClassName = (optionText, index) => {
    const isSelected = selectedOptions.includes(optionText);
    const feedback = optionFeedback.find(f => f.option === optionText);

    let className = 'sata-option';

    if (isSelected) {
      className += ' selected';
    }

    if (revealed && feedback) {
      className += ` ${feedback.status}`;
    }

    if (revealed && !isSelected && feedback?.status !== 'missed') {
      className += ' disabled';
    }

    return className;
  };

  /**
   * Renders the status icon for an option after reveal
   */
  const renderStatusIcon = (optionText) => {
    if (!revealed) return null;

    const feedback = optionFeedback.find(f => f.option === optionText);
    if (!feedback) return null;

    switch (feedback.status) {
      case 'correct':
        return (
          <span className="sata-icon checkmark" aria-label={t('sata.correctlySelected')}>
            <CheckmarkIcon />
          </span>
        );
      case 'incorrect':
        return (
          <span className="sata-icon x-mark" aria-label={t('sata.incorrectlySelected')}>
            <XMarkIcon />
          </span>
        );
      case 'missed':
        return (
          <span className="sata-icon missed" aria-label={t('sata.shouldHaveSelected')}>
            <MissedIcon />
          </span>
        );
      default:
        return null;
    }
  };

  // ----------------------------------------
  // Main Render
  // ----------------------------------------

  return (
    <div className={`sata-container glassmorphic ${inModal ? 'in-modal' : ''}`}>
      <div className="sata-content-wrapper" key={quizIndex}>
        {/* Header with progress */}
        <div className="sata-header">
          <div className="sata-title-row">
            <span className="sata-title">
              {t('quiz.question')} {quizIndex + 1} {t('quiz.of')} {totalQuestions}
              {reviewMode && (
                <span className="review-badge"> ({t('quiz.review')})</span>
              )}
            </span>
            <div className="sata-header-actions">
              {/* SATA Badge */}
              <span className="sata-type-badge">
                {t('sata.instructions')}
              </span>
              {/* Expand button - only show when not in modal */}
              {!inModal && onOpenModal && (
                <button
                  className="sata-expand-btn"
                  onClick={onOpenModal}
                  aria-label="View fullscreen"
                  type="button"
                >
                  <ExpandIcon />
                </button>
              )}
            </div>
          </div>
          <div className="sata-progress-track">
            <div className="sata-progress-fill" style={progressStyle} />
          </div>
        </div>

        {/* Topic Badge (if available) */}
        {quiz.topic && (
          <div className="sata-topic-badge">
            <span className="topic-badge-icon">📚</span>
            <span className="topic-badge-text">{quiz.topic}</span>
          </div>
        )}

        {/* Question Text */}
        <div className="sata-question">
          {quiz.question}
        </div>

        {/* Instructions Hint */}
        {!revealed && (
          <div className="sata-hint">
            {t('sata.selectAtLeast')}
          </div>
        )}

        {/* Options List */}
        <div className="sata-options" role="group" aria-label={t('sata.instructions')}>
          {quiz.options && quiz.options.map((option, index) => {
            const isSelected = selectedOptions.includes(option);
            const feedback = optionFeedback.find(f => f.option === option);

            return (
              <div
                key={index}
                className={getOptionClassName(option, index)}
                onClick={() => handleOptionToggle(option)}
                onKeyDown={(e) => handleKeyDown(e, option)}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={reviewMode ? -1 : 0}
                aria-disabled={revealed || reviewMode}
              >
                {/* Checkbox */}
                <span className={`sata-checkbox ${isSelected ? 'checked' : ''}`}>
                  {isSelected ? <CheckboxCheckedIcon /> : <CheckboxEmptyIcon />}
                </span>

                {/* Option Letter */}
                <span className={`sata-letter ${isSelected ? 'selected' : ''} ${revealed && feedback ? feedback.status : ''}`}>
                  {OPTION_LETTERS[index]}
                </span>

                {/* Option Text (stripped of letter prefix since we render it separately) */}
                <span className="sata-option-text">{stripLetterPrefix(option)}</span>

                {/* Status Icon (after reveal) */}
                {renderStatusIcon(option)}
              </div>
            );
          })}
        </div>

        {/* Submit Button - shown when user has made selections */}
        {!revealed && !reviewMode && (
          <button
            className={`sata-submit-btn ${canSubmit ? 'enabled' : 'disabled'}`}
            onClick={handleSubmit}
            disabled={!canSubmit}
            type="button"
          >
            {t('sata.submitAnswer')}
            {canSubmit && <span className="submit-count">({selectedOptions.length} {t('sata.selected')})</span>}
          </button>
        )}

        {/* Skip Button - Only visible before answering and NOT in review mode */}
        {!revealed && onSkip && !reviewMode && (
          <button
            className="sata-skip-btn"
            onClick={onSkip}
            type="button"
          >
            {t('quiz.skipQuestion')} →
          </button>
        )}

        {/* Feedback Section - Combined score and rationale */}
        {showFeedback && scoreResult && (
          <div className={`sata-feedback ${scoreResult.isFullyCorrect ? 'correct' : scoreResult.percentage >= 50 ? 'partial' : 'incorrect'}`}>
            <div className="feedback-header">
              <span className={`feedback-status ${scoreResult.isFullyCorrect ? 'correct' : scoreResult.percentage >= 50 ? 'partial' : 'incorrect'}`}>
                {scoreResult.isFullyCorrect
                  ? `✓ ${t('quiz.thatsRight')}`
                  : scoreResult.percentage >= 50
                    ? `◐ ${t('sata.partialCredit')}`
                    : `✗ ${t('quiz.notQuite')}`
                }
              </span>
              <span className="feedback-score">
                {scoreResult.score}/{scoreResult.maxScore}
              </span>
            </div>

            {/* Breakdown Legend */}
            <div className="sata-breakdown">
              {scoreResult.breakdown.correctSelections.length > 0 && (
                <div className="breakdown-item correct">
                  <span className="breakdown-icon">✓</span>
                  <span className="breakdown-label">{t('sata.correctlySelected')}: </span>
                  <span className="breakdown-count">{scoreResult.breakdown.correctSelections.length}</span>
                </div>
              )}
              {scoreResult.breakdown.incorrectSelections.length > 0 && (
                <div className="breakdown-item incorrect">
                  <span className="breakdown-icon">✗</span>
                  <span className="breakdown-label">{t('sata.incorrectlySelected')}: </span>
                  <span className="breakdown-count">{scoreResult.breakdown.incorrectSelections.length}</span>
                </div>
              )}
              {scoreResult.breakdown.missedCorrect.length > 0 && (
                <div className="breakdown-item missed">
                  <span className="breakdown-icon">○</span>
                  <span className="breakdown-label">{t('sata.shouldHaveSelected')}: </span>
                  <span className="breakdown-count">{scoreResult.breakdown.missedCorrect.length}</span>
                </div>
              )}
            </div>

            {/* Justification/Rationale */}
            {quiz.justification && (
              <div className="feedback-rationale-container">
                <div
                  className="feedback-rationale-content"
                  dangerouslySetInnerHTML={{ __html: sanitizeJustification(quiz.justification) }}
                />
              </div>
            )}
          </div>
        )}

        {/* Next Button */}
        {showFeedback && onNext && (
          <button
            className="sata-next-btn"
            onClick={onNext}
            type="button"
          >
            {isLastQuestion
              ? `${t('quiz.viewResults')} →`
              : `${t('quiz.nextQuestion')} →`
            }
          </button>
        )}
      </div>
    </div>
  );
}

export default SATAQuestion;
