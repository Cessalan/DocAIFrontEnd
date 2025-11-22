import React, { useMemo } from 'react';
import './QuizResultsAnalytics.css';
import { useTranslation } from 'react-i18next';

/**
 * QuizResultsAnalytics Component
 *
 * Compact, visual, and premium quiz analytics with charts
 */
const QuizResultsAnalytics = ({
  quizData,
  totalQuestions,
  correctAnswers,
  incorrectAnswers,
  longestStreak,
  onStartTargetedPractice,
  onReview
}) => {
  const { t } = useTranslation();

  const percentage = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;

  // Calculate topic-based performance
  const topicPerformance = useMemo(() => {
    const topicMap = {};
    let hasTopics = false;

    quizData.forEach((question) => {
      const topic = question.topic || t('quizAnalytics.generalTopic');

      if (question.topic) {
        hasTopics = true;
      }

      if (!topicMap[topic]) {
        topicMap[topic] = {
          topic,
          total: 0,
          correct: 0,
          incorrect: 0,
          questions: []
        };
      }

      topicMap[topic].total += 1;
      topicMap[topic].questions.push(question);

      if (question.userSelection?.isCorrect) {
        topicMap[topic].correct += 1;
      } else if (question.userSelection) {
        topicMap[topic].incorrect += 1;
      }
    });

    const topics = Object.values(topicMap).map(topic => ({
      ...topic,
      percentage: topic.total > 0
        ? Math.round((topic.correct / topic.total) * 100)
        : 0
    })).sort((a, b) => b.percentage - a.percentage);

    return { topics, hasTopics };
  }, [quizData, t]);

  const { topics, hasTopics } = topicPerformance;
  const weakTopics = hasTopics ? topics.filter(t => t.percentage < 60) : [];

  // Get performance tier
  const getPerformanceTier = () => {
    if (percentage >= 90) return { color: 'outstanding', emoji: '🏆', title: t('quizAnalytics.outstanding') };
    if (percentage >= 80) return { color: 'excellent', emoji: '🌟', title: t('quizAnalytics.excellent') };
    if (percentage >= 70) return { color: 'good', emoji: '🎉', title: t('quizAnalytics.wellDone') };
    if (percentage >= 60) return { color: 'moderate', emoji: '💪', title: t('quizAnalytics.keepGoing') };
    if (percentage >= 50) return { color: 'review', emoji: '📚', title: t('quizAnalytics.reviewTime') };
    return { color: 'study', emoji: '📖', title: t('quizAnalytics.letsReview') };
  };

  const performance = getPerformanceTier();

  const getTopicColor = (percentage) => {
    if (percentage >= 80) return '#10b981';
    if (percentage >= 60) return '#3b82f6';
    if (percentage >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const generateTargetedPrompt = (specificTopics = null) => {
    if (specificTopics && specificTopics.length > 0) {
      const topicDetails = specificTopics.map(t =>
        `${t.topic} (${t.correct}/${t.total} correct - ${t.percentage}%)`
      ).join(', ');

      // Empathetic prompt based on performance level
      if (percentage < 50) {
        return t('common.language') === 'fr'
          ? `Je comprends que cela peut être difficile, mais ne te décourage pas. Nous allons travailler ensemble sur ces sujets : ${topicDetails}.

          Peux-tu m'aider à m'améliorer ? Crée un quiz de pratique ciblé de 5 questions qui :
          1. Se concentre spécifiquement sur ces domaines faibles
          2. Commence avec des questions plus faciles pour renforcer ma confiance
          3. Augmente progressivement en difficulté
          4. Inclut des explications détaillées et encourageantes pour chaque réponse

          Je veux vraiment comprendre ces concepts. Aide-moi à progresser pas à pas.`
          : `I understand it can be hard, but don't get discouraged. We'll work on this together. Here are the areas I'm struggling with: ${topicDetails}.

          Can you help me improve? Please create a targeted 5-question practice quiz that:
          1. Focuses specifically on these weak areas
          2. Starts with easier questions to build my confidence
          3. Gradually increases in difficulty
          4. Includes detailed, encouraging explanations for each answer

          I really want to understand these concepts. Help me progress step by step.`;
      } else if (percentage < 70) {
        return t('common.language') === 'fr'
          ? `J'ai obtenu ${percentage}% - pas mal, mais je sais que je peux faire mieux ! J'ai besoin de plus de pratique sur : ${topicDetails}.

          Aide-moi à maîtriser ces sujets avec 5 questions ciblées. Fais-les challengeantes mais justes, et donne-moi des explications qui m'aident vraiment à comprendre où je me trompe.`
          : `I scored ${percentage}% - not bad, but I know I can do better! I need more practice with: ${topicDetails}.

          Help me master these topics with 5 targeted questions. Make them challenging but fair, and give me explanations that really help me understand where I'm going wrong.`;
      } else if (percentage < 85) {
        return t('common.language') === 'fr'
          ? `Bonne nouvelle ! J'ai obtenu ${percentage}%. Cependant, je veux perfectionner ces domaines : ${topicDetails}.

          Crée 5 questions de pratique avancées sur ces sujets pour m'aider à atteindre la maîtrise complète. Je suis prêt pour un défi !`
          : `Good news! I scored ${percentage}%. However, I want to perfect these areas: ${topicDetails}.

          Create 5 advanced practice questions on these topics to help me achieve complete mastery. I'm ready for a challenge!`;
      } else {
        return t('common.language') === 'fr'
          ? `Excellent travail ! ${percentage}% ! Mais je veux être impeccable. Aide-moi à perfectionner : ${topicDetails}.

          Donne-moi 5 questions expertes sur ces sujets - vraiment difficiles, pour que je puisse atteindre 100% de maîtrise.`
          : `Excellent work! ${percentage}%! But I want to be flawless. Help me perfect: ${topicDetails}.

          Give me 5 expert-level questions on these topics - really challenging ones, so I can reach 100% mastery.`;
      }
    }

    // Fallback if no specific topics (shouldn't normally happen)
    if (percentage >= 80) {
      return t('common.language') === 'fr'
        ? `Je viens de scorer ${percentage}% sur un quiz! Donne-moi 5 questions plus avancées pour me challenger davantage.`
        : `I just scored ${percentage}% on a quiz! Give me 5 more advanced questions to challenge me further.`;
    } else {
      return t('common.language') === 'fr'
        ? `Je viens de scorer ${percentage}% sur un quiz. Peux-tu m'aider à m'améliorer avec 5 questions ciblées sur mes points faibles?`
        : `I just scored ${percentage}% on a quiz. Can you help me improve with 5 targeted questions on my weak areas?`;
    }
  };

  const handlePracticeWeakTopics = () => {
    const prompt = generateTargetedPrompt(weakTopics);
    if (onStartTargetedPractice) {
      onStartTargetedPractice(prompt);
    }
  };

  const handleChallengeMore = () => {
    const prompt = generateTargetedPrompt();
    if (onStartTargetedPractice) {
      onStartTargetedPractice(prompt);
    }
  };

  return (
    <div className={`quiz-results-analytics-v2 tier-${performance.color}`}>
      {/* Compact Header with Score */}
      <div className="results-header">
        <div className="score-display">
          <div className="score-circle">
            <svg viewBox="0 0 120 120" className="score-svg">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                opacity="0.1"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeDasharray={`${percentage * 3.39} 339`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                className="score-progress"
              />
            </svg>
            <div className="score-content">
              <div className="score-percentage">{percentage}%</div>
            </div>
          </div>
        </div>
        <div className="score-title">
          <h3>Let's review!</h3>
          <p>Take time to review the material!</p>
        </div>
      </div>

      {/* Compact Stats Grid */}
      <div className="stats-compact">
        <div className="stat-item stat-correct">
          <div className="stat-icon">✓</div>
          <div className="stat-data">
            <div className="stat-value">{correctAnswers}</div>
            <div className="stat-label">{t('quizAnalytics.correct')}</div>
          </div>
        </div>
        <div className="stat-item stat-incorrect">
          <div className="stat-icon">✗</div>
          <div className="stat-data">
            <div className="stat-value">{incorrectAnswers}</div>
            <div className="stat-label">{t('quizAnalytics.incorrect')}</div>
          </div>
        </div>
        <div className="stat-item stat-streak">
          <div className="stat-icon">🔥</div>
          <div className="stat-data">
            <div className="stat-value">{longestStreak}</div>
            <div className="stat-label">{t('quizAnalytics.bestStreak')}</div>
          </div>
        </div>
        {hasTopics && (
          <div className="stat-item stat-topics">
            <div className="stat-icon">📊</div>
            <div className="stat-data">
              <div className="stat-value">{topics.length}</div>
              <div className="stat-label">{t('quizAnalytics.topics')}</div>
            </div>
          </div>
        )}
      </div>

      {/* Topic Performance - Compact Chart */}
      {hasTopics && topics.length > 0 && (
        <div className="topics-section">
          <h4 className="section-header">{t('quizAnalytics.performanceByTopic')}</h4>
          <div className="topics-chart">
            {topics.map((topic, index) => (
              <div key={index} className="topic-bar-item">
                <div className="topic-info">
                  <span className="topic-label">{topic.topic}</span>
                  <span className="topic-score">{topic.percentage}%</span>
                </div>
                <div className="topic-bar-track">
                  <div
                    className="topic-bar-fill"
                    style={{
                      width: `${topic.percentage}%`,
                      backgroundColor: getTopicColor(topic.percentage)
                    }}
                  />
                </div>
                <div className="topic-counts">
                  <span className="count-correct">✓ {topic.correct}</span>
                  <span className="count-divider">/</span>
                  <span className="count-total">{topic.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons - Compact */}
      <div className="actions-compact">
        {weakTopics.length > 0 && (
          <button className="action-btn primary" onClick={handlePracticeWeakTopics}>
            <span className="btn-icon">🎯</span>
            <span className="btn-text">{t('quizAnalytics.practiceWeakTopics')}</span>
          </button>
        )}
        {onReview && (
          <button className="action-btn secondary" onClick={onReview}>
            <span className="btn-icon">👁️</span>
            <span className="btn-text">{t('quizAnalytics.reviewQuiz')}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizResultsAnalytics;
