import React from 'react';
import './ChatQuiz.css';
import { useTranslation } from 'react-i18next';

const QuizSummary = ({ totalQuestions, correctAnswers, incorrectAnswers, longestStreak }) => {
  const { t } = useTranslation();
  
  const percentage = totalQuestions > 0 
    ? Math.round((correctAnswers / totalQuestions) * 100) 
    : 0;

  // Determine performance tier with color, emoji, and message
const getPerformanceTier = () => {
  if (percentage >= 90) {
    return { 
      color: 'outstanding', 
      emoji: '🏆', 
      title: t('quiz.outstandingtitle'),
      message: t('quiz.outstandingmessage')
    };
  }
  if (percentage >= 80) {
    return { 
      color: 'excellent', 
      emoji: '🌟', 
      title: t('quiz.excellenttitle'),
      message: t('quiz.excellentmessage')
    };
  }
  if (percentage >= 70) {
    return { 
      color: 'good', 
      emoji: '🎉', 
      title: t('quiz.goodtitle'),
      message: t('quiz.goodmessage')
    };
  }
  if (percentage >= 60) {
    return { 
      color: 'moderate', 
      emoji: '💪', 
      title: t('quiz.moderatetitle'),
      message: t('quiz.moderatemessage')
    };
  }
  if (percentage >= 50) {
    return { 
      color: 'review', 
      emoji: '📚', 
      title: t('quiz.reviewtitle'),
      message: t('quiz.reviewmessage')
    };
  }
  if (percentage >= 40) {
    return { 
      color: 'practice', 
      emoji: '🎯', 
      title: t('quiz.practicetitle'),
      message: t('quiz.practicemessage')
    };
  }
  return { 
    color: 'study', 
    emoji: '📖', 
    title: t('quiz.studytitle'),
    message: t('quiz.studymessage')
  };
};

  const performance = getPerformanceTier();

  return (
    <div className={`quiz-summary quiz-summary-${performance.color}`}>
      <div className="quiz-summary-header">
        <span className="quiz-summary-emoji">{performance.emoji}</span>
        <div>
          <div className="quiz-summary-title">{performance.title}</div>
          <div className="quiz-summary-message">{performance.message}</div>
        </div>
      </div>

      <div className="quiz-summary-score">
        {percentage}%
      </div>

      <div className="quiz-summary-stats">
        <div className="quiz-stat">
          <span className="quiz-stat-value">{correctAnswers}/{totalQuestions}</span>
          <span className="quiz-stat-label">Correct</span>
        </div>

        <div className="quiz-stat">
          <span className="quiz-stat-value">{incorrectAnswers}</span>
          <span className="quiz-stat-label">Incorrect</span>
        </div>

        <div className="quiz-stat">
          <span className="quiz-stat-value">{longestStreak} 🔥</span>
          <span className="quiz-stat-label">Streak</span>
        </div>
      </div>
    </div>
  );
};

export default QuizSummary;