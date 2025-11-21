import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import './ChatInterface.css';
import './ChatQuizCompact.css';
import { useTranslation } from 'react-i18next';

// Constants
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

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
    onModalChange  // Callback to update parent modal state
  } = props;

  // State
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  
  // Use parent-controlled modal state if provided, otherwise use local state
  const [localModalOpen, setLocalModalOpen] = useState(false);
  const modalOpen = externalModalOpen !== undefined ? externalModalOpen : localModalOpen;
  const setModalOpen = onModalChange || setLocalModalOpen;

  // Translation
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language;

  // Computed values
  const correctIndex = useMemo(() => {
    if (!quiz || !Array.isArray(quiz.options)) return -1;
    return quiz.options.findIndex(opt => opt === quiz.answer);
  }, [quiz]);

  const isCorrect = selectedIndex === correctIndex;

  const progressStyle = useMemo(() => {
    if (totalQuestions === 0) return { width: '0%' };
    return { width: `${((quizIndex + 1) / totalQuestions) * 100}%` };
  }, [quizIndex, totalQuestions]);

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

    if (isAnswerCorrect && navigator.vibrate) {
      navigator.vibrate(50);
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
        timestamp: new Date()
      });
    }
  }, [revealed, quiz, quizIndex, onAnswerSelect]);

  const handleOpenModal = useCallback(() => {
    setModalOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    document.body.style.overflow = '';
  }, []);

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
          <h3>📋 {currentLanguage === 'fr' ? 'Révision des réponses' : 'Answer Review'}</h3>
          <p>{correctCount}/{allQuizzes.length} correct</p>
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
                      {currentLanguage === 'fr' ? 'Votre réponse:' : 'Your answer:'}
                    </span>
                    <span className={`answer-text ${answerIsCorrect ? 'correct' : 'incorrect'}`}>
                      {answer ? `${OPTION_LETTERS[answer.selectedOptionIndex]} ${answer.selectedOptionText}` : 'No answer'}
                    </span>
                  </div>
                  {!answerIsCorrect && (
                    <div className="review-answer correct-answer">
                      <span className="answer-label">
                        {currentLanguage === 'fr' ? 'Bonne réponse:' : 'Correct answer:'}
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

    return (
      <div className={`quiz-compact-container glassmorphic ${inModal ? 'in-modal' : ''}`}>
        <div className="quiz-content-wrapper" key={quizIndex}>
          {/* Header */}
          <div className="quiz-compact-header">
            <div className="quiz-compact-title-row">
              <span className="quiz-compact-title">
                {currentLanguage === 'fr' ? 'Question' : 'Question'} {quizIndex + 1} {currentLanguage === 'fr' ? 'sur' : 'of'} {totalQuestions}
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
            </div>
          </div>

          {/* Question */}
          <div className="quiz-compact-question">
            {quiz.question}
          </div>

          {/* Options */}
          <div className="quiz-compact-options">
          {quiz.options && quiz.options.map((choice, index) => {
            const isSelected = index === selectedIndex;
            const isAnswer = index === correctIndex;
            const shouldHighlightCorrect = revealed && !isCorrect && isAnswer;

            let optionClass = 'quiz-compact-option';
            if (revealed) {
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
            if (revealed && isAnswer) {
              letterClass += ' correct';
            }

            return (
              <div
                key={index}
                onClick={() => handleSelect(index)}
                className={optionClass}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleSelect(index);
                  }
                }}
              >
                <span className={letterClass}>
                  {OPTION_LETTERS[index]}
                </span>
                <span className="option-text">{choice}</span>
                
                {revealed && isAnswer && isSelected && (
                  <span className="compact-icon checkmark">
                    <CheckmarkIcon />
                  </span>
                )}
                
                {revealed && !isAnswer && isSelected && (
                  <span className="compact-icon x-mark">
                    <XMarkIcon />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Feedback */}
        {showFeedback && correctIndex !== -1 && (
          <div className={`quiz-compact-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
            <div className="feedback-header">
              <span className={`feedback-status ${isCorrect ? 'correct' : 'incorrect'}`}>
                {isCorrect 
                  ? (currentLanguage === 'fr' ? '✓ Bonne réponse!' : '✓ Correct!') 
                  : (currentLanguage === 'fr' ? '✗ Incorrect' : '✗ Incorrect')
                }
              </span>
            </div>
            
            <div className="feedback-rationale-container">
              <div className="feedback-rationale-label">
                💡 {currentLanguage === 'fr' ? 'Explication' : 'Rationale'}
              </div>
              <div 
                className="feedback-rationale-content"
                dangerouslySetInnerHTML={{ __html: quiz.justification }}
              />
            </div>
          </div>
        )}

        {/* Skip Button - Only visible before answering */}
        {!revealed && onSkip && (
          <button 
            className="quiz-skip-btn"
            onClick={onSkip}
            type="button"
          >
            {currentLanguage === 'fr' ? 'Passer la question →' : 'Skip Question →'}
          </button>
        )}
        
        {/* Next Button - Appears after answering */}
        {showFeedback && onNext && (
          <button 
            className="quiz-compact-next-btn"
            onClick={onNext}
            type="button"
          >
            {isLastQuestion 
              ? (currentLanguage === 'fr' ? 'Voir les résultats →' : 'View Results →')
              : (currentLanguage === 'fr' ? 'Question suivante →' : 'Next Question →')
            }
          </button>
        )}
        </div>
      </div>
    );
  }

  // Modal
  function renderModal() {
    if (!modalOpen) return null;

    const modalContent = (
      <div className="quiz-modal-overlay" onClick={handleCloseModal}>
        <div className="quiz-modal-content" onClick={e => e.stopPropagation()}>
          <button 
            className="quiz-modal-close"
            onClick={handleCloseModal}
            aria-label="Close"
            type="button"
          >
            <CloseIcon />
          </button>
          
          <div className="quiz-modal-scroll-wrapper">
            {reviewMode ? renderReviewContent() : renderQuizContent(true)}
          </div>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  }

  // Main render
  return (
    <>
      {reviewMode ? renderReviewContent() : renderQuizContent(false)}
      {renderModal()}
    </>
  );
}

export default ChatQuiz;