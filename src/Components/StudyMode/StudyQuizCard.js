import React, { useState } from 'react';

/**
 * StudyQuizCard - Single quiz question in study mode
 *
 * @param {Object} content - Quiz content { question, options, correctIndex, rationale }
 * @param {Function} onAnswer - Callback when answer is submitted
 * @param {Function} onContinue - Callback when user is ready to continue
 */
const StudyQuizCard = ({ content, onAnswer, onContinue }) => {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const { question, options = [], correctIndex, rationale } = content || {};

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

  // Arrow right icon
  const ArrowRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const handleOptionClick = (index) => {
    if (showFeedback) return; // Already answered

    setSelectedIndex(index);
    const correct = index === correctIndex;
    setIsCorrect(correct);
    setShowFeedback(true);

    // Notify parent
    if (onAnswer) {
      onAnswer({
        selectedIndex: index,
        isCorrect: correct
      });
    }
  };

  const getOptionClass = (index) => {
    let classes = 'study-quiz-option';

    if (showFeedback) {
      classes += ' disabled';
      if (index === correctIndex) {
        classes += ' correct';
      } else if (index === selectedIndex && index !== correctIndex) {
        classes += ' incorrect';
      }
    } else if (index === selectedIndex) {
      classes += ' selected';
    }

    return classes;
  };

  return (
    <div className="study-step-card">
      <div className="study-card-header">
        <div className="study-card-icon quiz">
          <QuizIcon />
        </div>
        <h2 className="study-card-title">Quick Check</h2>
      </div>

      <div className="study-card-content">
        {/* Question text */}
        <p className="study-quiz-question">{question || 'Loading question...'}</p>

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
              <span className="study-quiz-option-text">{option}</span>
            </button>
          ))}
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`study-quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
            <div className="study-quiz-feedback-header">
              <div className="study-quiz-feedback-icon">
                {isCorrect ? <CheckIcon /> : <XIcon />}
              </div>
              <span className="study-quiz-feedback-title">
                {isCorrect ? 'Correct!' : 'Not quite...'}
              </span>
            </div>
            {rationale && (
              <p className="study-quiz-feedback-rationale">{rationale}</p>
            )}
          </div>
        )}
      </div>

      {/* Continue button - only show after answering */}
      {showFeedback && (
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

export default StudyQuizCard;
