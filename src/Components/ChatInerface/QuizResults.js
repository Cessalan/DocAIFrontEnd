import React from 'react';
import './ChatQuiz.css';
import { useTranslation } from 'react-i18next';

/**
 * QuizResults Component
 * 
 * Displays quiz completion summary with:
 * - Performance tier (emoji, title, message)
 * - Score breakdown
 * - "Start Targeted Practice" CTA that pre-fills chat prompt
 * 
 * Props:
 * - totalQuestions: number
 * - correctAnswers: number
 * - incorrectAnswers: number
 * - longestStreak: number
 * - onStartTargetedPractice: (prompt: string) => void - callback to pre-fill chat
 * - onReview: () => void - callback to review the quiz
 */
const QuizResults = ({
  totalQuestions,
  correctAnswers,
  incorrectAnswers,
  longestStreak,
  onStartTargetedPractice,
  onReview
}) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  const percentage = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;

  // Determine performance tier with color, emoji, and message
  const getPerformanceTier = () => {
    if (percentage >= 90) {
      return {
        color: 'outstanding',
        emoji: '🏆',
        title: currentLanguage === 'fr' ? 'Exceptionnel!' : 'Outstanding!',
        message: currentLanguage === 'fr'
          ? 'Tu maîtrises cette matière!'
          : 'You\'re mastering this material!'
      };
    }
    if (percentage >= 80) {
      return {
        color: 'excellent',
        emoji: '🌟',
        title: currentLanguage === 'fr' ? 'Excellent!' : 'Excellent!',
        message: currentLanguage === 'fr'
          ? 'Continue comme ça!'
          : 'Great work, keep it up!'
      };
    }
    if (percentage >= 70) {
      return {
        color: 'good',
        emoji: '🎉',
        title: currentLanguage === 'fr' ? 'Bien joué!' : 'Well done!',
        message: currentLanguage === 'fr'
          ? 'Tu progresses bien!'
          : 'You\'re making good progress!'
      };
    }
    if (percentage >= 60) {
      return {
        color: 'moderate',
        emoji: '💪',
        title: currentLanguage === 'fr' ? 'Continue!' : 'Keep going!',
        message: currentLanguage === 'fr'
          ? 'Tu y arrives!'
          : 'You\'re getting there!'
      };
    }
    if (percentage >= 50) {
      return {
        color: 'review',
        emoji: '📚',
        title: currentLanguage === 'fr' ? 'À réviser!' : 'Review time!',
        message: currentLanguage === 'fr'
          ? 'Un peu plus de pratique t\'aidera!'
          : 'A bit more practice will help!'
      };
    }
    if (percentage >= 40) {
      return {
        color: 'practice',
        emoji: '🎯',
        title: currentLanguage === 'fr' ? 'Continue d\'essayer!' : 'Keep trying!',
        message: currentLanguage === 'fr'
          ? 'Concentre-toi sur les explications!'
          : 'Focus on the explanations!'
      };
    }
    return {
      color: 'study',
      emoji: '📖',
      title: currentLanguage === 'fr' ? 'À réviser!' : 'Let\'s review!',
      message: currentLanguage === 'fr'
        ? 'Prends le temps de revoir la matière!'
        : 'Take time to review the material!'
    };
  };

  const performance = getPerformanceTier();

  // Generate targeted practice prompt based on performance
  const generateTargetedPrompt = () => {
    if (percentage >= 80) {
      // High performer - challenge them
      return currentLanguage === 'fr'
        ? `Je viens de scorer ${percentage}% sur un quiz! Donne-moi 5 questions plus avancées pour me challenger.`
        : `I just scored ${percentage}% on a quiz! Give me 5 more advanced questions to challenge me.`;
    } else {
      // Needs improvement - focus on weak areas
      return currentLanguage === 'fr'
        ? `Je viens de scorer ${percentage}% sur un quiz. Peux-tu me donner 5 questions pour m'aider à améliorer mes points faibles?`
        : `I just scored ${percentage}% on a quiz. Can you give me 5 questions to help me improve on my weak areas?`;
    }
  };

  const handleStartTargetedPractice = () => {
    const prompt = generateTargetedPrompt();
    if (onStartTargetedPractice) {
      onStartTargetedPractice(prompt);
    }
  };

  return (
    <div className={`quiz-results-container quiz-summary quiz-summary-${performance.color}`}>
      {/* Header with emoji and title */}
      <div className="quiz-summary-header">
        <span className="quiz-summary-emoji">{performance.emoji}</span>
        <div>
          <div className="quiz-summary-title">{performance.title}</div>
          <div className="quiz-summary-message">{performance.message}</div>
        </div>
      </div>

      {/* Score display */}
      <div className="quiz-summary-score">
        {percentage}%
      </div>

      {/* Stats grid */}
      <div className="quiz-summary-stats">
        <div className="quiz-stat">
          <span className="quiz-stat-value">{correctAnswers}/{totalQuestions}</span>
          <span className="quiz-stat-label">
            {currentLanguage === 'fr' ? 'Correct' : 'Correct'}
          </span>
        </div>

        <div className="quiz-stat">
          <span className="quiz-stat-value">{incorrectAnswers}</span>
          <span className="quiz-stat-label">
            {currentLanguage === 'fr' ? 'Incorrect' : 'Incorrect'}
          </span>
        </div>

        <div className="quiz-stat">
          <span className="quiz-stat-value">{longestStreak} 🔥</span>
          <span className="quiz-stat-label">
            {currentLanguage === 'fr' ? 'Meilleure série' : 'Best Streak'}
          </span>
        </div>
      </div>

      {/* CTA Section */}
      <div className="quiz-results-cta">
        <button
          className="quiz-results-cta-button"
          onClick={handleStartTargetedPractice}
        >
          <span className="cta-icon">🚀</span>
          <span className="cta-text">
            {percentage >= 80
              ? (currentLanguage === 'fr' ? 'Me challenger davantage' : 'Challenge me more')
              : (currentLanguage === 'fr' ? 'Pratiquer mes points faibles' : 'Practice weak areas')
            }
          </span>
        </button>

        {/* Review Button */}
        {onReview && (
          <button
            className="quiz-results-review-button"
            onClick={onReview}
          >
            {t('quiz.reviewQuiz')}
          </button>
        )}

        <p className="quiz-results-cta-note">
          {currentLanguage === 'fr'
            ? 'L\'IA s\'adapte à tes besoins'
            : 'AI adapts to your needs'}
        </p>
      </div>

      {/* Disclaimer */}
      <p className="quiz-results-disclaimer">
        {currentLanguage === 'fr'
          ? 'À des fins éducatives seulement'
          : 'Educational purposes only'}
      </p>
    </div>
  );
};

export default QuizResults;