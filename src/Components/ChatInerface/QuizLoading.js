import React from 'react';
import './ChatQuiz.css';

/**
 * QuizLoading Component
 * 
 * Displays a skeleton loading state while waiting for the next question
 * to stream in from the backend. Matches the quiz card design for
 * seamless visual continuity.
 */
const QuizLoading = () => {
  return (
    <div className="quiz-container quiz-loading">
      {/* Question skeleton */}
      <div className="quiz-loading-question">
        <div className="skeleton-line skeleton-line-long"></div>
        <div className="skeleton-line skeleton-line-medium"></div>
      </div>

      {/* Options skeleton */}
      <ul className="quiz-options">
        {[1, 2, 3, 4].map((_, index) => (
          <li 
            key={index} 
            className="quiz-option quiz-option-skeleton"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="skeleton-option-content">
              <div className="skeleton-circle"></div>
              <div className="skeleton-line skeleton-option-text"></div>
            </div>
          </li>
        ))}
      </ul>

      {/* Loading indicator */}
      <div className="quiz-loading-indicator">
        <div className="quiz-loading-spinner">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span className="quiz-loading-text">Loading next question...</span>
      </div>
    </div>
  );
};

export default QuizLoading;