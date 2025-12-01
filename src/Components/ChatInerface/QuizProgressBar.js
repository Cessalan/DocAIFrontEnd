import React, { useMemo } from 'react';
import './ChatQuiz.css';
import { useTranslation } from 'react-i18next';

/**
 * QuizProgressBar Component - UPDATED WITH ACTIVE INDICATOR
 * 
 * NEW FEATURE:
 * - Shows subtle glow when quiz is active (user is working on it)
 * - Helps user identify which quiz the sticky bar will show for
 * 
 * NEW PROPS:
 * - isActiveQuiz: Boolean indicating if this quiz is currently active
 */
const QuizProgressBar = ({ 
  answeredCount, 
  totalQuestions, 
  correctCount, 
  incorrectCount,
  isActiveQuiz = false // NEW: Is this quiz currently active?
}) => {

  const { t } = useTranslation();
    

  // Calculate progress percentage
  const percentage = totalQuestions > 0 
    ? Math.round((answeredCount / totalQuestions) * 100) 
    : 0;

  // Calculate performance percentage (of answered questions)
  const performancePercentage = answeredCount > 0
    ? Math.round((correctCount / answeredCount) * 100)
    : 0;

  // Determine progress color tier based on completion
  const getProgressTier = () => {
    if (percentage >= 75) return 'completing'; // Green
    if (percentage >= 50) return 'momentum';   // Golden
    if (percentage >= 25) return 'building';   // Orange
    return 'starting'; // Purple
  };

  // Get encouraging message based on progress
  const getEncouragingMessage = () => {
  if (percentage === 100) {
    return t('quizbar.100');
  }
  if (percentage >= 90) {
    return t('quizbar.90');
  }
  if (percentage >= 75) {
    return t('quizbar.75');
  }
  if (percentage >= 50) {
    return t('quizbar.50');
  }
  if (percentage >= 25) {
    return t('quizbar.25');
  }
  return t('quizbar.start');
};


  const progressTier = getProgressTier();
  const message = getEncouragingMessage();

  // Determine if performance is excellent (for sparkle effect)
  const isExcellent = performancePercentage >= 80 && answeredCount >= 3;

  return (
    <div className={`
      quiz-progress-bar 
      ${progressTier} 
      ${isExcellent ? 'excellent-performance' : ''}
      ${isActiveQuiz ? 'active-quiz' : ''}
    `}>
      {/* NEW: Active Quiz Indicator */}
      {/* {isActiveQuiz && (
        <div className="active-quiz-indicator">
          <span className="active-quiz-badge">📍 Active</span>
        </div>
      )} */}

      {/* Header Row */}
      <div className="progress-header">
        <div className="progress-label">
          <span className="progress-icon">🎯</span>
          <span className="progress-text">
            {t('quizbar.progress')}: <strong>{answeredCount}/{totalQuestions}</strong> questions
          </span>
        </div>
        <div className="progress-percentage">
          {percentage}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-track">
        <div 
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        >
          {/* Animated shimmer effect */}
          <div className="progress-shimmer"></div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="progress-stats">
        <div className="progress-message">
          {message}
        </div>
        <div className="progress-score">
          <span className="stat-correct">{correctCount} ✅</span>
          <span className="stat-separator">•</span>
          <span className="stat-incorrect">{incorrectCount} ❌</span>
        </div>
      </div>

      {/* Milestone indicator (appears at 25%, 50%, 75%, 100%) */}
      {percentage > 0 && percentage % 25 === 0 && (
        <div className="progress-milestone">
          <div className="milestone-pulse"></div>
        </div>
      )}
    </div>
  );
};

export default QuizProgressBar;