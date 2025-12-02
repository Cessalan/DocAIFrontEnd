import React from 'react';
import { useTranslation } from 'react-i18next';
import { useProgress } from '../../Contexts/ProgressContext/ProgressContext';
import './CompactProgressWidget.css';

/**
 * CompactProgressWidget - Always visible at top of chat
 * Shows: Level, XP bar, Streak, Serum vial percentage
 * Clicking opens the full ProgressDashboard
 */
const CompactProgressWidget = () => {
  const { t } = useTranslation();
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
      {/* Top row: Pills */}
      <div className="widget-pills-row">
        {/* Level Badge */}
        <div className="widget-section level-section">
          <div className="level-badge">
            <span className="level-icon">⭐</span>
            <span className="level-text">{t('progress.lvl')} {currentLevel}</span>
          </div>
        </div>

        {/* Streak Counter */}
        <div className="widget-section streak-section">
          <span className="streak-fire">🔥</span>
          <span className="streak-count">{currentStreak}</span>
          <span className="streak-label">{currentStreak === 1 ? t('progress.day') : t('progress.days')}</span>
        </div>

        {/* Serum */}
        <div className={`widget-section serum-section ${isSerumComplete ? 'complete' : ''}`}>
          <svg className="serum-mini-svg" width="14" height="20" viewBox="0 0 120 400">
            <defs>
              <linearGradient id="miniSerumGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#0e7490" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
              <linearGradient id="miniGlassGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(180,200,220,0.35)" />
                <stop offset="50%" stopColor="rgba(210,225,240,0.15)" />
                <stop offset="100%" stopColor="rgba(180,200,220,0.3)" />
              </linearGradient>
              <clipPath id="miniTubeClip">
                <path d="M 40 65 L 40 350 Q 40 385 60 385 Q 80 385 80 350 L 80 65 Z" />
              </clipPath>
            </defs>
            {/* Glass tube */}
            <path
              d="M 35 50 L 35 355 Q 35 390 60 390 Q 85 390 85 355 L 85 50"
              fill="url(#miniGlassGradient)"
              stroke="rgba(180,200,220,0.4)"
              strokeWidth="2"
            />
            {/* Rim */}
            <ellipse cx="60" cy="50" rx="28" ry="6" fill="none" stroke="rgba(180,200,220,0.5)" strokeWidth="2" />
            {/* Liquid */}
            <g clipPath="url(#miniTubeClip)">
              <rect
                x="40"
                y={385 - (dailyCorrectAnswers / dailySerumGoal) * 320}
                width="40"
                height={(dailyCorrectAnswers / dailySerumGoal) * 320 + 20}
                fill="url(#miniSerumGradient)"
              />
            </g>
            {/* Glass highlight */}
            <line x1="42" y1="70" x2="42" y2="340" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          </svg>
          <span className="serum-text">{dailyCorrectAnswers}/{dailySerumGoal}</span>
        </div>

        {/* Click indicator */}
        <div className="widget-expand-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* Bottom row: Full width XP bar */}
      <div className="widget-xp-row">
        <div className="xp-bar-track">
          <div className="xp-bar-fill" style={{ width: `${xpPercentage}%` }}></div>
        </div>
        <span className="xp-text">{totalXP}/{xpForNextLevel || totalXP} {t('progress.xp')}</span>
      </div>
    </div>
  );
};

export default CompactProgressWidget;
