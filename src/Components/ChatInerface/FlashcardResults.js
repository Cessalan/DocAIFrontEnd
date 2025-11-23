import React from 'react';
import './FlashcardResults.css';
import { useTranslation } from 'react-i18next';

/**
 * FlashcardResults Component
 *
 * Displays flashcard session summary with:
 * - Mastery level (emoji, title, message)
 * - Score breakdown (mastered, learning, new)
 * - Topic-based performance
 * - "Continue Learning" CTA
 *
 * Props:
 * - totalCards: number
 * - masteredCards: number
 * - learningCards: number
 * - newCards: number
 * - onContinue: () => void - callback to continue reviewing
 * - onReview: () => void - callback to review cards
 * - topicBreakdown: array of { topic, total, mastered, learning }
 */
const FlashcardResults = ({
  totalCards,
  masteredCards,
  learningCards,
  newCards,
  onContinue,
  onReview,
  topicBreakdown = []
}) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  const percentage = totalCards > 0
    ? Math.round((masteredCards / totalCards) * 100)
    : 0;

  // Determine mastery tier with color, emoji, and message
  const getMasteryTier = () => {
    if (percentage >= 90) {
      return {
        color: 'outstanding',
        emoji: '🏆',
        title: currentLanguage === 'fr' ? 'Maîtrise Exceptionnelle!' : 'Outstanding Mastery!',
        message: currentLanguage === 'fr'
          ? 'Tu maîtrises presque tout le contenu!'
          : 'You\'ve mastered almost all the content!'
      };
    }
    if (percentage >= 70) {
      return {
        color: 'excellent',
        emoji: '🌟',
        title: currentLanguage === 'fr' ? 'Excellente Progression!' : 'Excellent Progress!',
        message: currentLanguage === 'fr'
          ? 'Continue comme ça!'
          : 'Great work, keep it up!'
      };
    }
    if (percentage >= 50) {
      return {
        color: 'good',
        emoji: '📘',
        title: currentLanguage === 'fr' ? 'Bon Progrès!' : 'Good Progress!',
        message: currentLanguage === 'fr'
          ? 'Tu apprends bien!'
          : 'You\'re learning well!'
      };
    }
    if (percentage >= 30) {
      return {
        color: 'moderate',
        emoji: '💪',
        title: currentLanguage === 'fr' ? 'Continue!' : 'Keep Going!',
        message: currentLanguage === 'fr'
          ? 'Continue de réviser!'
          : 'Keep reviewing!'
      };
    }
    return {
      color: 'study',
      emoji: '📚',
      title: currentLanguage === 'fr' ? 'Commence Fort!' : 'Strong Start!',
      message: currentLanguage === 'fr'
        ? 'Continue de réviser ces cartes!'
        : 'Keep reviewing these cards!'
    };
  };

  const tier = getMasteryTier();

  return (
    <div className={`flashcard-results-container tier-${tier.color}`}>
      {/* Compact Header - No Circle */}
      <div className="flashcard-results-header">
        <div className="flashcard-results-title-wrapper">
          <div>
            <h2 className="flashcard-results-title">
              <span className="flashcard-results-emoji">{tier.emoji}</span>
              {tier.title}
            </h2>
            <p className="flashcard-results-message">{tier.message}</p>
          </div>
          <div className={`flashcard-score-percentage-inline tier-${tier.color}`}>
            {percentage}%
          </div>
        </div>
      </div>

      {/* Compact Stats Grid */}
      <div className="flashcard-results-breakdown">
        <div className="flashcard-breakdown-item mastered">
          <div className="flashcard-breakdown-icon">✅</div>
          <div className="flashcard-breakdown-details">
            <div className="flashcard-breakdown-count">{masteredCards}</div>
            <div className="flashcard-breakdown-label">
              {currentLanguage === 'fr' ? 'Maîtrisées' : 'Mastered'}
            </div>
          </div>
        </div>

        <div className="flashcard-breakdown-item learning">
          <div className="flashcard-breakdown-icon">📘</div>
          <div className="flashcard-breakdown-details">
            <div className="flashcard-breakdown-count">{learningCards}</div>
            <div className="flashcard-breakdown-label">
              {currentLanguage === 'fr' ? 'En Cours' : 'Learning'}
            </div>
          </div>
        </div>

        <div className="flashcard-breakdown-item new">
          <div className="flashcard-breakdown-icon">🆕</div>
          <div className="flashcard-breakdown-details">
            <div className="flashcard-breakdown-count">{newCards}</div>
            <div className="flashcard-breakdown-label">
              {currentLanguage === 'fr' ? 'Nouvelles' : 'New'}
            </div>
          </div>
        </div>
      </div>

      {/* Topic Breakdown */}
      {topicBreakdown && topicBreakdown.length > 0 && (
        <div className="flashcard-topic-breakdown">
          <h3 className="flashcard-topic-title">
            📚 {currentLanguage === 'fr' ? 'Performance par Sujet' : 'Performance by Topic'}
          </h3>
          <div className="flashcard-topic-list">
            {topicBreakdown.map((topic, index) => {
              const topicPercentage = topic.total > 0
                ? Math.round((topic.mastered / topic.total) * 100)
                : 0;

              return (
                <div key={index} className="flashcard-topic-item">
                  <div className="flashcard-topic-header">
                    <span className="flashcard-topic-name">{topic.topic}</span>
                    <span className="flashcard-topic-percentage">{topicPercentage}%</span>
                  </div>
                  <div className="flashcard-topic-progress">
                    <div
                      className="flashcard-topic-progress-bar"
                      style={{ width: `${topicPercentage}%` }}
                    />
                  </div>
                  <div className="flashcard-topic-stats">
                    <span className="count-correct">{topic.mastered}</span>
                    <span className="count-divider">/</span>
                    <span className="count-total">{topic.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flashcard-results-actions">
        {onReview && (
          <button className="flashcard-results-btn flashcard-review-btn" onClick={onReview}>
            <span className="btn-icon">👁️</span>
            <span className="btn-text">
              {currentLanguage === 'fr' ? 'Réviser' : 'Review Cards'}
            </span>
          </button>
        )}
        {onContinue && (
          <button className="flashcard-results-btn flashcard-continue-btn" onClick={onContinue}>
            <span className="btn-icon">▶️</span>
            <span className="btn-text">
              {currentLanguage === 'fr' ? 'Continuer' : 'Continue Learning'}
            </span>
          </button>
        )}
      </div>

      {/* Motivational Footer */}
      <div className="flashcard-results-footer">
        {percentage < 50 && (
          <p>{currentLanguage === 'fr'
            ? '💡 Astuce: Révise régulièrement pour mieux mémoriser!'
            : '💡 Tip: Review regularly to improve retention!'}
          </p>
        )}
        {percentage >= 50 && percentage < 90 && (
          <p>{currentLanguage === 'fr'
            ? '🎯 Tu y es presque! Continue de réviser les cartes difficiles.'
            : '🎯 Almost there! Keep reviewing the challenging cards.'}
          </p>
        )}
        {percentage >= 90 && (
          <p>{currentLanguage === 'fr'
            ? '🌟 Bravo! Tu maîtrises ce contenu!'
            : '🌟 Amazing! You\'ve mastered this content!'}
          </p>
        )}
      </div>
    </div>
  );
};

export default FlashcardResults;
