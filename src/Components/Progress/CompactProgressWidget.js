import React from 'react';
import { useProgress } from '../../Contexts/ProgressContext/ProgressContext';
import './CompactProgressWidget.css';

/**
 * CompactProgressWidget - Always visible at top of chat
 * Shows: Level, XP bar, Streak, Serum vial percentage
 * Clicking opens the full ProgressDashboard
 */
const CompactProgressWidget = () => {
  const {
    currentLevel,
    totalXP,
    xpProgress,
    xpNeeded,
    xpForNextLevel,
    currentStreak,
    isSerumComplete,
    dailyCorrectAnswers,
    dailySerumGoal,
    isLoading,
    toggleDashboard,
  } = useProgress();

  if (isLoading) {
    return (
      <div className="compact-progress-widget loading">
        <div className="widget-skeleton"></div>
      </div>
    );
  }

  const xpPercentage = xpForNextLevel ? Math.min((xpProgress / xpNeeded) * 100, 100) : 100;

  return (
    <div className="compact-progress-widget" onClick={toggleDashboard}>
      {/* Level Badge */}
      <div className="widget-section level-section">
        <div className="level-badge">
          <span className="level-icon">⭐</span>
          <span className="level-text">Lvl {currentLevel}</span>
        </div>
      </div>

      {/* XP Progress */}
      <div className="widget-section xp-section">
        <div className="xp-info">
          <span className="xp-text">{totalXP} / {xpForNextLevel || totalXP} XP</span>
        </div>
        <div className="xp-bar-track">
          <div className="xp-bar-fill" style={{ width: `${xpPercentage}%` }}></div>
        </div>
      </div>

      {/* Streak Counter */}
      <div className="widget-section streak-section">
        <span className="streak-fire">🔥</span>
        <span className="streak-count">{currentStreak}</span>
        <span className="streak-label">day{currentStreak !== 1 ? 's' : ''}</span>
      </div>

      {/* Serum */}
      <div className={`widget-section serum-section ${isSerumComplete ? 'complete' : ''}`}>
        <span className="serum-icon">🧪</span>
        <span className="serum-text">{dailyCorrectAnswers}/{dailySerumGoal}</span>
      </div>

      {/* Click indicator */}
      <div className="widget-expand-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
  );
};

export default CompactProgressWidget;
