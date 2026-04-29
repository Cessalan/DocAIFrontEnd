import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgress } from '../../Contexts/ProgressContext/ProgressContext';
import './CompactProgressWidget.css';

/**
 * CompactProgressWidget - Always visible at top of chat (inline with title)
 * Shows: Level, Streak, Serum count, XP bar
 * Clicking opens the full ProgressDashboard
 */
const CompactProgressWidget = () => {
  const { t } = useTranslation();
  const {
    currentLevel,
    xpProgress,
    xpNeeded,
    xpForNextLevel,
    currentStreak,
    isSerumComplete,
    dailyCorrectAnswers,
    dailySerumGoal,
    isLoading,
    toggleDashboard,
    xpGainAnimation,
    clearXpAnimation,
  } = useProgress();

  // Track animation visibility
  const [showXpFloat, setShowXpFloat] = useState(false);

  // Trigger animation when xpGainAnimation changes
  useEffect(() => {
    if (xpGainAnimation) {
      setShowXpFloat(true);

      // Hide after animation completes (1s)
      const timer = setTimeout(() => {
        setShowXpFloat(false);
        clearXpAnimation();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [xpGainAnimation, clearXpAnimation]);

  if (isLoading) {
    return (
      <div className="compact-progress-widget loading">
        <div className="widget-skeleton"></div>
      </div>
    );
  }

  const xpPercentage = xpForNextLevel ? Math.min((xpProgress / xpNeeded) * 100, 100) : 100;

  return (
    <div className={`compact-progress-widget ${showXpFloat ? 'xp-pulse' : ''}`} onClick={toggleDashboard}>
      {/* +1 XP Floating Animation - commented out to reduce distraction */}
      {/* {showXpFloat && (
        <div className="xp-float-animation">
          +1 XP
        </div>
      )} */}

      {/* Level Badge */}
      <div className="level-badge">
        <span className="level-icon">⭐</span>
        <span className="level-text">{t('progress.lvl')} {currentLevel}</span>
      </div>

      {/* Streak Counter */}
      <div className="streak-section">
        <span className="streak-fire">🔥</span>
        <span className="streak-count">{currentStreak}</span>
        <span className="streak-label">{currentStreak === 1 ? t('progress.day') : t('progress.days')}</span>
      </div>

      {/* Serum */}
      <div className={`serum-section ${isSerumComplete ? 'complete' : ''}`}>
        <span className="serum-icon">💉</span>
        <span className="serum-text">{dailyCorrectAnswers}/{dailySerumGoal}</span>
      </div>

      {/* XP bar inline - commented out to reduce distraction */}
      {/* <div className="widget-xp-row">
        <div className="xp-bar-track">
          <div className="xp-bar-fill" style={{ width: `${xpPercentage}%` }}></div>
        </div>
        <span className="xp-text">{xpProgress}/{xpNeeded} {t('progress.xp')}</span>
      </div> */}

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
