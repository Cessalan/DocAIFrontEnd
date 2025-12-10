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

  // Get custom SVG icon based on performance
  const getPerformanceIcon = (percentage) => {
    if (percentage >= 90) {
      // Trophy with sparkles - Mastered
      return (
        <svg viewBox="0 0 24 24" fill="none" className="performance-icon mastered">
          <path d="M12 17v3M8 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M7 4h10v6c0 2.76-2.24 5-5 5s-5-2.24-5-5V4z" fill="url(#goldGradient)" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M7 6H4c0 2.5 1.5 4 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M17 6h3c0 2.5-1.5 4-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="19" cy="3" r="1" fill="#fbbf24"/>
          <circle cx="5" cy="4" r="0.8" fill="#fbbf24"/>
          <defs>
            <linearGradient id="goldGradient" x1="7" y1="4" x2="17" y2="15">
              <stop offset="0%" stopColor="#fcd34d"/>
              <stop offset="100%" stopColor="#f59e0b"/>
            </linearGradient>
          </defs>
        </svg>
      );
    }
    if (percentage >= 80) {
      // Star badge - Excellent
      return (
        <svg viewBox="0 0 24 24" fill="none" className="performance-icon excellent">
          <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" fill="url(#starGradient)" stroke="currentColor" strokeWidth="1"/>
          <defs>
            <linearGradient id="starGradient" x1="12" y1="2" x2="12" y2="21">
              <stop offset="0%" stopColor="#22c55e"/>
              <stop offset="100%" stopColor="#16a34a"/>
            </linearGradient>
          </defs>
        </svg>
      );
    }
    if (percentage >= 60) {
      // Upward trend arrow - Good progress
      return (
        <svg viewBox="0 0 24 24" fill="none" className="performance-icon good">
          <path d="M3 20L9 14L13 18L21 10" stroke="url(#trendGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M17 10h4v4" stroke="url(#trendGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="trendGradient" x1="3" y1="20" x2="21" y2="10">
              <stop offset="0%" stopColor="#3b82f6"/>
              <stop offset="100%" stopColor="#8b5cf6"/>
            </linearGradient>
          </defs>
        </svg>
      );
    }
    if (percentage >= 40) {
      // Book with bookmark - Learning
      return (
        <svg viewBox="0 0 24 24" fill="none" className="performance-icon learning">
          <path d="M4 4h12a2 2 0 012 2v14l-7-3-7 3V6a2 2 0 012-2z" fill="url(#bookGradient)" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M14 4v8l-2-1.5L10 12V4" fill="#f97316" stroke="#ea580c" strokeWidth="1"/>
          <defs>
            <linearGradient id="bookGradient" x1="4" y1="4" x2="18" y2="20">
              <stop offset="0%" stopColor="#fed7aa"/>
              <stop offset="100%" stopColor="#fdba74"/>
            </linearGradient>
          </defs>
        </svg>
      );
    }
    // Target with arrow - Needs practice
    return (
      <svg viewBox="0 0 24 24" fill="none" className="performance-icon practice">
        <circle cx="12" cy="12" r="9" stroke="#ef4444" strokeWidth="1.5" fill="none"/>
        <circle cx="12" cy="12" r="5" stroke="#ef4444" strokeWidth="1.5" fill="none"/>
        <circle cx="12" cy="12" r="1.5" fill="#ef4444"/>
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
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
            <div className="topics-grid">
              {sortedTopics.map((topic, index) => {
                const colors = getPerformanceColor(topic.percentage);
                return (
                  <div
                    key={topic.name}
                    className={`topic-chip ${topic.percentage >= 80 ? 'mastered' : topic.percentage >= 50 ? 'learning' : 'needs-work'}`}
                    style={{
                      animationDelay: `${index * 0.03}s`,
                      '--performance-color': colors.color,
                      '--performance-gradient': colors.gradient
                    }}
                    title={`${topic.correct}/${topic.total} correct`}
                  >
                    <div className="chip-icon-wrapper">
                      {getPerformanceIcon(topic.percentage)}
                    </div>
                    <div className="chip-content">
                      <span className="chip-name">{topic.name}</span>
                      <span className="chip-stats" style={{ color: colors.color }}>
                        {topic.percentage}%
                        <span className="chip-ratio">{topic.correct}/{topic.total}</span>
                      </span>
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
