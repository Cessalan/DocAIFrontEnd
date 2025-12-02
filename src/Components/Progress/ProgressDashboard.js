import React, { useMemo } from 'react';
import { useProgress } from '../../Contexts/ProgressContext/ProgressContext';
import SerumTube from '../QuizRoom/SerumTube';
import './ProgressDashboard.css';

/**
 * ProgressDashboard - Full detailed view matching the design mockup
 * Two main cards: Your Progress + Serum Progress
 */
const ProgressDashboard = () => {
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
  const weeklyQuizzes = useMemo(() => {
    // For now, we'll show total questions answered as a proxy
    // You can enhance this later with actual weekly tracking
    const total = Object.values(topicStats || {}).reduce((sum, stat) => sum + (stat.total || 0), 0);
    return total;
  }, [topicStats]);

  const overallAccuracy = useMemo(() => {
    const stats = Object.values(topicStats || {});
    if (stats.length === 0) return 0;
    const totalCorrect = stats.reduce((sum, stat) => sum + (stat.correct || 0), 0);
    const totalQuestions = stats.reduce((sum, stat) => sum + (stat.total || 0), 0);
    if (totalQuestions === 0) return 0;
    return Math.round((totalCorrect / totalQuestions) * 100);
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
    if (percentage >= 80) return '🌟';
    if (percentage >= 60) return '👍';
    if (percentage >= 40) return '📈';
    return '💪';
  };

  if (!dashboardOpen) return null;

  return (
    <div className="progress-dashboard-overlay" onClick={closeDashboard}>
      <div className="progress-dashboard-modal" onClick={(e) => e.stopPropagation()}>

        {/* Your Progress Card */}
        <div className="progress-card main-progress-card">
          <div className="card-header">
            <div className="card-title">
              <span className="card-icon">⭐</span>
              <span>Your Progress</span>
            </div>
            <div className="level-badge-large">
              Level {currentLevel}
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="xp-progress-container">
            <div className="xp-bar-large">
              <div
                className="xp-bar-fill-large"
                style={{ width: `${xpPercentage}%` }}
              ></div>
            </div>
            <div className="xp-labels">
              <span className="xp-current">{totalXP} XP</span>
              <span className="xp-target">/ {xpForNextLevel || totalXP} XP</span>
            </div>
          </div>

          {/* Stats Row */}
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-icon-wrapper fire">
                <span className="stat-icon">🔥</span>
              </div>
              <div className="stat-info">
                <span className="stat-value">{currentStreak}</span>
                <span className="stat-label">day streak</span>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon-wrapper books">
                <span className="stat-icon">📚</span>
              </div>
              <div className="stat-info">
                <span className="stat-value">{weeklyQuizzes}</span>
                <span className="stat-label">questions</span>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon-wrapper target">
                <span className="stat-icon">🎯</span>
              </div>
              <div className="stat-info">
                <span className="stat-value">{overallAccuracy}%</span>
                <span className="stat-label">accuracy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Serum Progress Card */}
        <div className="progress-card serum-progress-card">
          <div className="card-header centered">
            <div className="card-title">
              <span className="card-icon">🧪</span>
              <span>Serum Progress</span>
            </div>
          </div>

          {/* Serum Vial Visual */}
          <div className="serum-vial-container">
            <SerumTube
              correctCount={dailyCorrectAnswers}
              totalQuestions={dailySerumGoal}
              size={140}
            />
          </div>

          {/* Serum Status Text */}
          <div className="serum-status">
            {isSerumComplete ? (
              <span className="serum-complete-text">
                ✨ Serum delivered to Room 217!
              </span>
            ) : (
              <span className="serum-progress-text">
                Vial {Math.round(serumPercentage)}% filled – {serumRemaining} more correct {serumRemaining === 1 ? 'answer' : 'answers'} to deliver to Room 217
              </span>
            )}
          </div>
        </div>

        {/* Topic Performance Card */}
        <div className="progress-card topics-card">
          <div className="card-header">
            <div className="card-title">
              <span className="card-icon">📊</span>
              <span>Topic Performance</span>
            </div>
          </div>

          {sortedTopics.length === 0 ? (
            <div className="topics-empty">
              <div className="empty-icon">🎯</div>
              <p>Complete quizzes to track your topic performance!</p>
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
                    style={{ animationDelay: `${index * 0.1}s` }}
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
