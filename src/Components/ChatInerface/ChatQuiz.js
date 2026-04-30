import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import './ChatInterface.css';
import './ChatQuizCompact.css';
import QuizNavigation from './QuizNavigation';
import ShareQuizButton from './ShareQuizButton';
import SATAQuestion from './SATAQuestion';
import CaseStudyQuestion from './CaseStudyQuestion';
import UnfoldingCaseStudy from './UnfoldingCaseStudy';
import { useTranslation } from 'react-i18next';
import { getQuestionType } from '../../utils/quizScoring';
import useGlossary from '../Glossary/useGlossary';

// Constants
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Helper function to strip letter prefix from options (e.g., "A) Answer" -> "Answer")
function stripLetterPrefix(text) {
  if (!text) return '';
  // Match patterns like "A)", "A.", "A ", "A:" at the start
  return text.replace(/^[A-Fa-f][\)\.\:\s]\s*/, '').trim();
}

// Helper function to clean justification text
function sanitizeJustification(justification) {
  if (!justification) return '';

  // Remove unwanted instruction text that might slip through from backend
  let cleaned = justification
    .replace(/Use this EXACT format with html:\s*/gi, '')
    .replace(/Use this format with html:\s*/gi, '')
    .replace(/\[1-2 sentences.*?\]/gi, '')
    .replace(/\[1 sentence.*?\]/gi, '')
    .trim();

  return cleaned;
}

// Icon Components
function CheckmarkIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XMarkIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

// Main Component
function ChatQuiz(props) {
  const {
    quiz,
    onAnswerSelect,
    messageId,
    quizIndex = 0,
    onNext,
    isLastQuestion = false,
    totalQuestions = 0,
    allQuizzes = [],
    userAnswers = [],
    showReview = false,
    onSkip,  // New prop for skipping questions
    modalOpen: externalModalOpen,  // Modal state from parent
    onModalChange,  // Callback to update parent modal state
    skippedQuestions = [], // New prop for skipped questions
    onNavigate, // New prop for navigation
    onFeedbackSubmit, // New prop for feedback submission
    feedbackData, // Feedback data from message (if already submitted)
    isStreaming = false, // Whether quiz is still being generated
    expectedTotal = 10 // Expected total questions (for progress bar during streaming)
  } = props;

  // State
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState(feedbackData);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  const handleFeedbackSubmit = (data) => {
    console.log('Quiz Feedback Submitted:', data);
    setFeedbackGiven(true);
    setSubmittedFeedback(data);
    if (onFeedbackSubmit) {
      onFeedbackSubmit(messageId, data);
    }
  };

  // Development mode detection
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Use parent-controlled modal state if provided, otherwise use local state
  const [localModalOpen, setLocalModalOpen] = useState(false);
  const modalOpen = externalModalOpen !== undefined ? externalModalOpen : localModalOpen;
  const setModalOpen = onModalChange || setLocalModalOpen;

  // Translation
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  // Glossary popover for clickable medical terms in rationales
  const { rationaleRef, rationaleHandlers, popover: glossaryPopover } = useGlossary();

  // Computed values
  const correctIndex = useMemo(() => {
    if (!quiz || !Array.isArray(quiz.options)) return -1;
    return quiz.options.findIndex(opt => opt === quiz.answer);
  }, [quiz]);

  const isCorrect = selectedIndex === correctIndex;

  // Use expectedTotal for progress bar during streaming, actual total otherwise
  const progressTotal = isStreaming ? Math.max(expectedTotal, totalQuestions) : totalQuestions;

  const progressStyle = useMemo(() => {
    if (progressTotal === 0) return { width: '0%' };
    return { width: `${((quizIndex + 1) / progressTotal) * 100}%` };
  }, [quizIndex, progressTotal]);

  // Effects
  useEffect(() => {
    // Reset state when quiz changes (smooth transition)
    if (quiz) {
      if (quiz.userSelection) {
        setSelectedIndex(quiz.userSelection.selectedIndex);
        setRevealed(true);
        setShowFeedback(true);
      } else {
        // Reset for new unanswered question
        setSelectedIndex(null);
        setRevealed(false);
        setShowFeedback(false);
      }
    }
  }, [quiz, quizIndex]); // Added quizIndex to ensure reset on question change

  // Initialize feedbackGiven from message data
  useEffect(() => {
    // Check if message has feedbackData to determine if feedback was already given
    console.log('📊 Checking feedbackData:', feedbackData);
    if (feedbackData && feedbackData.submittedAt) {
      console.log('✅ Feedback already submitted, hiding feedback button');
      setFeedbackGiven(true);
    } else {
      console.log('❌ No feedback found, showing feedback button');
      setFeedbackGiven(false);
    }
  }, [feedbackData]);

  useEffect(() => {
    if (showReview) {
      setReviewMode(true);
    }
  }, [showReview]);

  // Handlers
  const handleSelect = useCallback((index) => {
    if (revealed || !quiz) return;

    setSelectedIndex(index);
    setRevealed(true);

    const correctIdx = quiz.options.findIndex(opt => opt === quiz.answer);
    const isAnswerCorrect = index === correctIdx;

    if (isAnswerCorrect) {
      // Vibrate on correct answer
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      // Show +1 XP animation
      setShowXpAnimation(true);
      setTimeout(() => {
        setShowXpAnimation(false);
      }, 1500);
    }

    setTimeout(() => {
      setShowFeedback(true);
    }, 300);

    if (onAnswerSelect) {
      onAnswerSelect({
        quizIndex,
        questionText: quiz.question,
        selectedOptionIndex: index,
        selectedOptionText: quiz.options[index],
        correctOptionIndex: correctIdx,
        correctOptionText: quiz.answer,
        isCorrect: isAnswerCorrect,
        timestamp: new Date(),
        topic: quiz.topic || null  // Include topic for progress tracking
      });
    }
  }, [revealed, quiz, quizIndex, onAnswerSelect]);

  const handleOpenModal = useCallback(() => {
    console.log('🔍 Opening modal, setModalOpen:', setModalOpen);
    setModalOpen(true);
    document.body.style.overflow = 'hidden';
  }, [setModalOpen]);

  const handleCloseModal = useCallback(() => {
    console.log('🔍 Closing modal');
    // Add closing class for smooth animation
    const modalContent = document.querySelector('.quiz-modal-content');
    const modalOverlay = document.querySelector('.quiz-modal-overlay');

    if (modalContent && modalOverlay) {
      modalContent.classList.add('closing');
      modalOverlay.classList.add('closing');

      // Wait for animation to complete before actually closing
      setTimeout(() => {
        setModalOpen(false);
        document.body.style.overflow = '';
      }, 400); // Match animation duration (0.4s)
    } else {
      setModalOpen(false);
      document.body.style.overflow = '';
    }
  }, [setModalOpen]);

  const handleCopyJson = useCallback(() => {
    const data = allQuizzes.length > 0 ? allQuizzes : (quiz ? [quiz] : []);
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    });
  }, [allQuizzes, quiz]);

  // Early return after all hooks
  if (!quiz && !reviewMode) {
    return null;
  }

  // Review Content
  function renderReviewContent() {
    const correctCount = userAnswers.filter(a => a.isCorrect).length;

    return (
      <div className="quiz-review-container">
        <div className="quiz-review-header">
          <h3>📋 {t('quiz.answerReview')}</h3>
          <p>{correctCount}/{allQuizzes.length} {t('quiz.correct')}</p>
        </div>

        <div className="quiz-review-list">
          {allQuizzes.map((q, idx) => {
            const answer = userAnswers.find(a => a.quizIndex === idx);
            const qCorrectIndex = q.options.findIndex(opt => opt === q.answer);
            const answerIsCorrect = answer && answer.isCorrect;

            return (
              <div key={idx} className={`quiz-review-item ${answerIsCorrect ? 'correct' : 'incorrect'}`}>
                <div className="review-item-header">
                  <span className="review-item-number">Q{idx + 1}</span>
                  <span className={`review-item-status ${answerIsCorrect ? 'correct' : 'incorrect'}`}>
                    {answerIsCorrect ? '✓' : '✗'}
                  </span>
                </div>
                <p className="review-item-question">{q.question}</p>
                <div className="review-item-answers">
                  <div className="review-answer your-answer">
                    <span className="answer-label">
                      {t('quiz.yourAnswer')}
                    </span>
                    <span className={`answer-text ${answerIsCorrect ? 'correct' : 'incorrect'}`}>
                      {answer ? `${OPTION_LETTERS[answer.selectedOptionIndex]} ${answer.selectedOptionText}` : 'No answer'}
                    </span>
                  </div>
                  {!answerIsCorrect && (
                    <div className="review-answer correct-answer">
                      <span className="answer-label">
                        {t('quiz.correctAnswer')}
                      </span>
                      <span className="answer-text correct">
                        {OPTION_LETTERS[qCorrectIndex]} {q.answer}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Quiz Content
  function renderQuizContent(inModal) {
    if (!quiz) return null;

    // Detect question type (mcq, sata, etc.)
    const questionType = getQuestionType(quiz);

    // For SATA questions, render the specialized SATA component
    if (questionType === 'sata') {
      // Get previous answer for review mode
      const previousAnswer = userAnswers.find(a => a.quizIndex === quizIndex);

      return (
        <div className={`quiz-compact-container glassmorphic ${inModal ? 'in-modal' : ''}`}>
          {/* Side Navigation - Only show in modal (fullscreen) */}
          {inModal && allQuizzes.length > 1 && (
            <div className="quiz-sidebar">
              <QuizNavigation
                questions={allQuizzes}
                currentIndex={quizIndex}
                onNavigate={onNavigate}
                userAnswers={userAnswers}
                skippedQuestions={skippedQuestions}
                onFeedbackSubmit={handleFeedbackSubmit}
                hasGivenFeedback={feedbackGiven}
              />
            </div>
          )}

          <div className="quiz-main-content">
            <SATAQuestion
              quiz={quiz}
              quizIndex={quizIndex}
              totalQuestions={totalQuestions}
              onAnswerSelect={onAnswerSelect}
              onNext={onNext}
              onSkip={onSkip}
              isLastQuestion={isLastQuestion}
              inModal={inModal}
              reviewMode={reviewMode}
              previousAnswer={previousAnswer}
              onOpenModal={!inModal ? handleOpenModal : undefined}
            />
          </div>
        </div>
      );
    }

    // For Case Study / Ordering questions, render the CaseStudyQuestion component
    // Note: CaseStudyQuestion handles its own glassmorphic styling, so we use a plain wrapper
    if (questionType === 'casestudy' || questionType === 'ordering' || questionType === 'bowtie') {
      // Get previous answer for review mode
      const previousAnswer = userAnswers.find(a => a.quizIndex === quizIndex);

      return (
        <div className={`quiz-compact-container case-study-wrapper ${inModal ? 'in-modal' : ''}`}>
          {/* Side Navigation - Only show in modal (fullscreen) */}
          {inModal && allQuizzes.length > 1 && (
            <div className="quiz-sidebar">
              <QuizNavigation
                questions={allQuizzes}
                currentIndex={quizIndex}
                onNavigate={onNavigate}
                userAnswers={userAnswers}
                skippedQuestions={skippedQuestions}
                onFeedbackSubmit={handleFeedbackSubmit}
                hasGivenFeedback={feedbackGiven}
              />
            </div>
          )}

          <div className="quiz-main-content">
            <CaseStudyQuestion
              quiz={quiz}
              quizIndex={quizIndex}
              totalQuestions={totalQuestions}
              onAnswerSelect={onAnswerSelect}
              onNext={onNext}
              onSkip={onSkip}
              isLastQuestion={isLastQuestion}
              inModal={inModal}
              reviewMode={reviewMode}
              previousAnswer={previousAnswer}
              onOpenModal={!inModal ? handleOpenModal : undefined}
            />
          </div>
        </div>
      );
    }

    // For Unfolding Case Study (NGN 6-item format), render the specialized component
    // This is an advanced format with multiple items, two-column layout, and mixed question types
    if (questionType === 'unfoldingCase' || questionType === 'unfoldingcase') {
      // Get previous answers for this case (could be multiple items)
      const previousAnswer = userAnswers.find(a => a.quizIndex === quizIndex);

      return (
        <div className={`quiz-compact-container case-study-wrapper ${inModal ? 'in-modal' : ''}`}>
          {/* Side Navigation - Only show in modal (fullscreen) */}
          {inModal && allQuizzes.length > 1 && (
            <div className="quiz-sidebar">
              <QuizNavigation
                questions={allQuizzes}
                currentIndex={quizIndex}
                onNavigate={onNavigate}
                userAnswers={userAnswers}
                skippedQuestions={skippedQuestions}
                onFeedbackSubmit={handleFeedbackSubmit}
                hasGivenFeedback={feedbackGiven}
              />
            </div>
          )}

          <div className="quiz-main-content">
            <UnfoldingCaseStudy
              question={quiz}
              questionIndex={quizIndex}
              inModal={inModal}
              onAnswerChange={(answers) => {
                // Handle answer changes for all 6 items
                if (onAnswerSelect) {
                  onAnswerSelect({
                    quizIndex,
                    questionText: quiz.scenario?.patientInfo || 'Unfolding Case Study',
                    selectedAnswers: answers,
                    questionType: 'unfoldingCase',
                    timestamp: new Date()
                  });
                }
              }}
              showResults={reviewMode}
              userAnswers={previousAnswer?.selectedAnswers || []}
            />

            {/* Next Button - for navigating between quiz questions */}
            {onNext && (
              <button
                className="quiz-compact-next-btn"
                onClick={onNext}
                type="button"
                style={{ marginTop: '16px' }}
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

    // Default: MCQ (Multiple Choice Question) rendering
    // In review mode, we always show the answer and feedback
    const isReviewing = reviewMode;
    const effectiveRevealed = revealed || isReviewing;
    const effectiveShowFeedback = showFeedback || isReviewing;

    // Get user's answer for this specific question if in review mode
    let reviewAnswer = null;
    let reviewSelectedIndex = -1;

    if (isReviewing) {
      reviewAnswer = userAnswers.find(a => a.quizIndex === quizIndex);
      if (reviewAnswer) {
        reviewSelectedIndex = reviewAnswer.selectedOptionIndex;
      }
    }

    const displaySelectedIndex = isReviewing ? reviewSelectedIndex : selectedIndex;

    return (
      <div className={`quiz-compact-container glassmorphic ${inModal ? 'in-modal' : ''}`}>
        {/* Side Navigation - Only show in modal (fullscreen) */}
        {inModal && allQuizzes.length > 1 && (
          <div className="quiz-sidebar">
            <QuizNavigation
              questions={allQuizzes}
              currentIndex={quizIndex}
              onNavigate={onNavigate}
              userAnswers={userAnswers}
              skippedQuestions={skippedQuestions}
              onFeedbackSubmit={handleFeedbackSubmit}
              hasGivenFeedback={feedbackGiven}
            />
          </div>
        )}

        <div className="quiz-main-content">
          {/* +1 XP Animation - Shows on correct answer */}
          {showXpAnimation && (
            <div className="quiz-xp-animation">
              +1 XP
            </div>
          )}

          <div className="quiz-content-wrapper" key={quizIndex}>
            {/* Header */}
            <div className="quiz-compact-header">
              <div className="quiz-compact-title-row">
                <span className="quiz-compact-title">
                  {t('quiz.question')} {quizIndex + 1} {t('quiz.of')} {isStreaming ? `${totalQuestions}+` : totalQuestions}
                  {isReviewing && (
                    <span className="review-badge">
                      {' ('}{t('quiz.review')}{')'}
                    </span>
                  )}
                  {isStreaming && (
                    <span className="quiz-streaming-badge">
                      <span className="streaming-dot-mini"></span>
                      <span className="streaming-dot-mini"></span>
                      <span className="streaming-dot-mini"></span>
                    </span>
                  )}
                </span>
                {!inModal && (
                  <button
                    className="quiz-expand-btn"
                    onClick={handleOpenModal}
                    aria-label="View fullscreen"
                    type="button"
                  >
                    <ExpandIcon />
                  </button>
                )}
              </div>
              <div className="quiz-compact-progress-track">
                <div className="quiz-compact-progress-fill" style={progressStyle} />
                {isStreaming && (
                  <div className="quiz-progress-streaming-indicator" />
                )}
              </div>
            </div>

            {/* Topic Badge - Above Question */}
            {quiz.topic && (
              <div className="quiz-topic-badge">
                <span className="topic-badge-icon">📚</span>
                <span className="topic-badge-text">{quiz.topic}</span>
              </div>
            )}

            {/* Question */}
            <div className="quiz-compact-question">
              {quiz.question}
            </div>

            {/* Options */}
            <div className="quiz-compact-options">
              {quiz.options && quiz.options.map((choice, index) => {
                const isSelected = index === displaySelectedIndex;
                const isAnswer = index === correctIndex;
                const shouldHighlightCorrect = effectiveRevealed && (!isCorrect || isReviewing) && isAnswer;

                let optionClass = 'quiz-compact-option';
                if (effectiveRevealed) {
                  if (isAnswer) {
                    optionClass += ' correct';
                  } else if (isSelected) {
                    optionClass += ' incorrect';
                  } else {
                    optionClass += ' disabled';
                  }
                }
                if (isSelected) {
                  optionClass += ' selected';
                }
                if (shouldHighlightCorrect) {
                  optionClass += ' correct-highlight';
                }

                let letterClass = 'option-letter';
                if (isSelected) {
                  letterClass += ' selected';
                }
                if (effectiveRevealed && isAnswer) {
                  letterClass += ' correct';
                }

                return (
                  <div
                    key={index}
                    onClick={() => !isReviewing && handleSelect(index)}
                    className={optionClass}
                    role="button"
                    tabIndex={isReviewing ? -1 : 0}
                    style={{ cursor: isReviewing ? 'default' : 'pointer' }}
                    onKeyDown={(e) => {
                      if (!isReviewing && (e.key === 'Enter' || e.key === ' ')) {
                        handleSelect(index);
                      }
                    }}
                  >
                    <span className={letterClass}>
                      {OPTION_LETTERS[index]}
                    </span>
                    <span className="option-text">{stripLetterPrefix(choice)}</span>

                    {effectiveRevealed && isAnswer && (isSelected || isReviewing) && (
                      <span className="compact-icon checkmark">
                        <CheckmarkIcon />
                      </span>
                    )}

                    {effectiveRevealed && !isAnswer && isSelected && (
                      <span className="compact-icon x-mark">
                        <XMarkIcon />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Feedback */}
            {effectiveShowFeedback && correctIndex !== -1 && (
              <div className={`quiz-compact-feedback ${(displaySelectedIndex !== null && displaySelectedIndex === correctIndex) ? 'correct' : 'incorrect'}`}>
                <div className="feedback-header">
                  <span className={`feedback-status ${(displaySelectedIndex !== null && displaySelectedIndex === correctIndex) ? 'correct' : 'incorrect'}`}>
                    {(displaySelectedIndex !== null && displaySelectedIndex === correctIndex)
                      ? `✓ ${t('quiz.thatsRight')}`
                      : `✗ ${t('quiz.notQuite')}`
                    }
                  </span>
                </div>

                <div className="feedback-rationale-container">
                  <div
                    ref={rationaleRef}
                    className="feedback-rationale-content"
                    {...rationaleHandlers}
                    dangerouslySetInnerHTML={{ __html: sanitizeJustification(quiz.justification) }}
                  />
                </div>
              </div>
            )}

            {/* Skip Button - Only visible before answering and NOT in review mode */}
            {!effectiveRevealed && onSkip && !isReviewing && (
              <button
                className="quiz-skip-btn"
                onClick={onSkip}
                type="button"
              >
                {t('quiz.skipQuestion')} →
              </button>
            )}

            {/* Next Button - Appears after answering OR in review mode */}
            {(effectiveShowFeedback || isReviewing) && onNext && (
              <button
                className="quiz-compact-next-btn"
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
      </div>
    );
  }

  // Modal
  function renderModal() {
    if (!modalOpen) return null;

    // Prepare quiz data for sharing
    const quizDataForSharing = {
      quizzes: allQuizzes,
      topic: quiz?.topic || 'Quiz',
      totalQuestions: totalQuestions
    };

    // Prepare user results for sharing
    const userResultsForSharing = {
      totalQuestions: totalQuestions,
      correctAnswers: userAnswers.filter(a => a.isCorrect).length,
      incorrectAnswers: userAnswers.filter(a => !a.isCorrect).length,
      percentage: totalQuestions > 0
        ? Math.round((userAnswers.filter(a => a.isCorrect).length / totalQuestions) * 100)
        : 0
    };

    const modalContent = (
      <div className="quiz-modal-overlay" onClick={handleCloseModal}>
        <div className="quiz-modal-content" onClick={e => e.stopPropagation()}>
          <div className="quiz-modal-header-actions">
            <ShareQuizButton
              quizData={quizDataForSharing}
              userResults={userResultsForSharing}
              disabled={false}
            />
            <button
              className="quiz-modal-close"
              onClick={handleCloseModal}
              aria-label="Close"
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="quiz-modal-scroll-wrapper">
            {reviewMode ? renderQuizContent(true) : renderQuizContent(true)}
          </div>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  }

  // Main render
  return (
    <>
      {renderQuizContent(false)}
      {renderModal()}
      {glossaryPopover}

      {/* Dev Mode: Copy Quiz JSON */}
      {isDevelopment && (
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={handleCopyJson}
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 10px', fontSize: '11px', fontWeight: '600',
              background: jsonCopied ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.10)',
              border: `1px solid ${jsonCopied ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.35)'}`,
              borderRadius: '6px', cursor: 'pointer',
              color: jsonCopied ? '#16a34a' : '#6366f1', transition: 'all 0.2s'
            }}
          >
            <span style={{ background: jsonCopied ? '#22c55e' : '#6366f1', color: 'white', fontSize: '9px', padding: '2px 5px', borderRadius: '3px', fontWeight: '700' }}>DEV</span>
            {jsonCopied ? '✓ Copied!' : 'Copy Quiz JSON'}
          </button>
        </div>
      )}

      {/* Dev Mode: Show collected feedback below quiz */}
      {isDevelopment && submittedFeedback && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '8px', fontSize: '13px' }}>
          <div style={{ fontWeight: '600', color: '#ea580c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ background: '#f97316', color: 'white', fontSize: '9px', padding: '2px 5px', borderRadius: '3px', fontWeight: '700' }}>DEV</span>
            Quiz Feedback Collected
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
            <div>
              <span style={{ fontWeight: '600', color: '#9a3412' }}>Rating: </span>
              <span style={{ color: '#ea580c' }}>
                {submittedFeedback.rating === 'bad' && '☹️ Bad'}
                {submittedFeedback.rating === 'neutral' && '😐 Neutral'}
                {submittedFeedback.rating === 'good' && '😄 Good'}
              </span>
            </div>
            <div>
              <span style={{ fontWeight: '600', color: '#9a3412' }}>Detail: </span>
              <span style={{ color: '#ea580c' }}>{submittedFeedback.detail}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatQuiz;