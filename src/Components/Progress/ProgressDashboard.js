import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgress } from '../../Contexts/ProgressContext/ProgressContext';
import SerumTube from '../QuizRoom/SerumTube';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import './ProgressDashboard.css';

/**
 * ProgressDashboard - Topic Performance focused view
 * Main focus: Topic Performance tracking
 * Secondary: Gamification stats (XP, Streak, Serum)
 */
const ProgressDashboard = () => {
  const { t } = useTranslation();
  const {
    currentLevel,
    totalXP,
    xpForNextLevel,
    currentStreak,
    serumPercentage,
    isSerumComplete,
    dailyCorrectAnswers,
    dailySerumGoal,
    topicStats,
    dashboardOpen,
    closeDashboard,
  } = useProgress();

  // Calculate stats
  const totalQuestions = useMemo(() => {
    const total = Object.values(topicStats || {}).reduce((sum, stat) => sum + (stat.total || 0), 0);
    return total;
  }, [topicStats]);

  const overallAccuracy = useMemo(() => {
    const stats = Object.values(topicStats || {});
    if (stats.length === 0) return 0;
    const totalCorrect = stats.reduce((sum, stat) => sum + (stat.correct || 0), 0);
    const totalQs = stats.reduce((sum, stat) => sum + (stat.total || 0), 0);
    if (totalQs === 0) return 0;
    return Math.round((totalCorrect / totalQs) * 100);
  }, [topicStats]);

  // Calculate how many more correct answers needed to fill serum
  const serumRemaining = Math.max(0, dailySerumGoal - dailyCorrectAnswers);

  // XP percentage for progress bar
  const xpPercentage = xpForNextLevel
    ? Math.min((totalXP / xpForNextLevel) * 100, 100)
    : 100;

  // Sort topics by total questions (most practiced first)
  const sortedTopics = useMemo(() => {
    if (!topicStats || Object.keys(topicStats).length === 0) return [];
    return Object.entries(topicStats)
      .map(([name, stats]) => ({
        name,
        correct: stats.correct || 0,
        total: stats.total || 0,
        percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [topicStats]);

  // Get color based on performance
  const getPerformanceColor = (percentage) => {
    if (percentage >= 80) return { gradient: 'linear-gradient(135deg, #22c55e, #10b981)', color: '#22c55e' };
    if (percentage >= 60) return { gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#3b82f6' };
    if (percentage >= 40) return { gradient: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#f59e0b' };
    return { gradient: 'linear-gradient(135deg, #ef4444, #f43f5e)', color: '#ef4444' };
  };

  // Get emoji based on performance
  const getPerformanceEmoji = (percentage) => {
    if (percentage >= 90) return '🏆';
    if (percentage >= 80) return '🌟';
    if (percentage >= 60) return '✨';
    if (percentage >= 40) return '📈';
    return '💪';
  };

  // Get motivational message
  const getMotivationalMessage = () => {
    if (overallAccuracy >= 80) return `${t('progress.crushingIt')} 🎯`;
    if (overallAccuracy >= 60) return `${t('progress.greatProgress')} 🚀`;
    if (overallAccuracy >= 40) return `${t('progress.improving')} 📈`;
    if (totalQuestions > 0) return `${t('progress.everyQuestion')} 💪`;
    return `${t('progress.startJourney')} 🎯`;
  };

  if (!dashboardOpen) return null;

  return (
    <div className="progress-dashboard-overlay" onClick={closeDashboard}>
      <div className="progress-dashboard-modal" onClick={(e) => e.stopPropagation()}>

        {/* Topic Performance Card - MAIN FOCUS */}
        <div className="progress-card topics-card">
          <div className="card-header">
            <div className="card-title">
              <div className="card-mascot-wrapper">
                <NurseQuizMascot size={56} isExcited={overallAccuracy >= 60} />
              </div>
              <div className="title-content">
                <span>{t('progress.topicPerformance')}</span>
                <span className="title-subtitle">{getMotivationalMessage()}</span>
              </div>
            </div>
            <div className="overall-accuracy">
              <span className="accuracy-value">{overallAccuracy}%</span>
              <span className="accuracy-label">{t('progress.overallAccuracy')}</span>
            </div>
          </div>

          {sortedTopics.length === 0 ? (
            <div className="topics-empty">
              <div className="empty-icon">🎯</div>
              <p>{t('progress.emptyTitle')}</p>
              <span className="empty-hint">{t('progress.emptyHint')}</span>
            </div>
          ) : (
            <div className="topics-list">
              {sortedTopics.map((topic, index) => {
                const colors = getPerformanceColor(topic.percentage);
                const emoji = getPerformanceEmoji(topic.percentage);
                return (
                  <div
                    key={topic.name}
                    className="topic-item"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="topic-header">
                      <span className="topic-name">{topic.name}</span>
                      <div className="topic-score">
                        <span className="topic-emoji">{emoji}</span>
                        <span className="topic-percentage" style={{ color: colors.color }}>
                          {topic.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="topic-bar-container">
                      <div className="topic-bar">
                        <div
                          className="topic-bar-fill"
                          style={{
                            width: `${topic.percentage}%`,
                            background: colors.gradient,
                          }}
                        >
                          <div className="topic-bar-shine"></div>
                        </div>
                      </div>
                      <span className="topic-stats">{topic.correct}/{topic.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gamification Stats - Compact sidebar */}
        <div className="gamification-sidebar">
          {/* Level & XP */}
          <div className="progress-card compact-card level-card">
            <div className="compact-header">
              <span className="compact-icon">⭐</span>
              <span className="compact-title">{t('progress.level')} {currentLevel}</span>
            </div>
            <div className="xp-mini-bar">
              <div className="xp-mini-fill" style={{ width: `${xpPercentage}%` }}></div>
            </div>
            <span className="xp-mini-text">{totalXP} / {xpForNextLevel || totalXP} {t('progress.xp')}</span>
          </div>

          {/* Streak */}
          <div className="progress-card compact-card streak-card">
            <div className="compact-header">
              <span className="compact-icon">🔥</span>
              <span className="compact-title">{currentStreak} {currentStreak === 1 ? t('progress.dayStreak') : t('progress.daysStreak')}</span>
            </div>
            <span className="compact-subtitle">{totalQuestions} {t('progress.questionsAnswered')}</span>
          </div>

          {/* Serum */}
          <div className="progress-card compact-card serum-card">
            <div className="compact-header">
              <span className="compact-icon">🧪</span>
              <span className="compact-title">{t('progress.dailySerum')}</span>
            </div>
            <div className="serum-mini-container">
              <SerumTube
                correctCount={dailyCorrectAnswers}
                totalQuestions={dailySerumGoal}
                size={100}
              />
            </div>
            <span className="compact-subtitle">
              {isSerumComplete
                ? `✨ ${t('progress.delivered')}`
                : `${serumRemaining} ${t('progress.moreToGo')}`
              }
            </span>
          </div>
        </div>

        {/* Close button */}
        <button className="dashboard-close-btn" onClick={closeDashboard}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ProgressDashboard;
