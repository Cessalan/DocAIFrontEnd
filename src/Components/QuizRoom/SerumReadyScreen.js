import React, { useState, useEffect } from 'react';
import SerumTube from './SerumTube';
import './SerumReadyScreen.css';

/**
 * SerumReadyScreen - Transition screen before the quiz
 * "Your Serum Is Ready" - builds anticipation before entering the hallway
 */
const SerumReadyScreen = ({
  isVisible = false,
  quizTitle = 'Your Quiz',
  questionCount = 5,
  onStartQuiz
}) => {
  const [phase, setPhase] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  // Animate in phases
  useEffect(() => {
    if (!isVisible) {
      setPhase(0);
      return;
    }

    // Phase 1: Title fades in
    const timer1 = setTimeout(() => setPhase(1), 300);
    // Phase 2: Subtitle and tube fade in
    const timer2 = setTimeout(() => setPhase(2), 800);
    // Phase 3: Button fades in
    const timer3 = setTimeout(() => setPhase(3), 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isVisible]);

  // Handle start quiz with cinematic exit
  const handleStartQuiz = () => {
    if (isExiting) return;

    setIsExiting(true);

    // Play heartbeat effect (optional - could add audio here)
    if (navigator.vibrate) {
      navigator.vibrate([100, 100, 100, 100, 200]);
    }

    // After fade to black animation
    setTimeout(() => {
      if (onStartQuiz) onStartQuiz();
    }, 1500);
  };

  if (!isVisible) return null;

  return (
    <div className={`serum-ready-screen ${isExiting ? 'exiting' : ''}`}>
      {/* Ambient background */}
      <div className="ready-ambient" />

      {/* Heartbeat pulse effect on exit */}
      {isExiting && (
        <div className="heartbeat-overlay">
          <div className="heartbeat-pulse" />
        </div>
      )}

      {/* Main content */}
      <div className="ready-content">
        {/* Title */}
        <div className={`ready-title-container ${phase >= 1 ? 'visible' : ''}`}>
          <h1 className="ready-title">Your Serum Is Ready.</h1>
          <div className="title-glow" />
        </div>

        {/* Serum tube display */}
        <div className={`ready-tube-container ${phase >= 2 ? 'visible' : ''}`}>
          <SerumTube
            correctCount={0}
            totalQuestions={questionCount}
            size={200}
          />
        </div>

        {/* Subtitle/Description */}
        <div className={`ready-description ${phase >= 2 ? 'visible' : ''}`}>
          <p className="description-main">
            We've generated a quiz based on your materials.
          </p>
          <p className="description-sub">
            Each correct answer moves the serum closer to <span className="room-highlight">Room 217</span>.
          </p>
          <div className="quiz-info">
            <span className="quiz-info-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              {questionCount} questions
            </span>
            <span className="quiz-info-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              AI-generated
            </span>
          </div>
        </div>

        {/* Start button */}
        <div className={`ready-action ${phase >= 3 ? 'visible' : ''}`}>
          <button
            className="start-quiz-btn"
            onClick={handleStartQuiz}
            disabled={isExiting}
          >
            <span className="btn-text">Start Quiz</span>
            <span className="btn-arrow">→</span>
            <div className="btn-shine" />
          </button>
        </div>
      </div>

      {/* Vignette */}
      <div className="ready-vignette" />
    </div>
  );
};

export default SerumReadyScreen;
