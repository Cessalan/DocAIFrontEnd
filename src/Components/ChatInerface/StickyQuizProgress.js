import React, { useEffect, useState } from 'react';
import './StickyQuizProgress.css';
import { useTranslation } from 'react-i18next';

/**
 * StickyQuizProgress Component
 * 
 * A compact progress bar that sticks to the top of the chat interface,
 * showing real-time quiz progress, score, and streak information.
 */
const StickyQuizProgress = ({
  answeredCount = 0,
  totalQuestions = 0,
  correctCount = 0,
  incorrectCount = 0,
  currentStreak = 0,
  longestStreak = 0,
  isVisible = true,
  lastAnswerWasCorrect = null
}) => {

  const { t } = useTranslation();

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  const [prevStreak, setPrevStreak] = useState(currentStreak);
  const [streakAnimation, setStreakAnimation] = useState('');
  const [showStreakToast, setShowStreakToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // ============================================
  // STREAK ANIMATION LOGIC
  // ============================================
  
  useEffect(() => {
    if (currentStreak !== prevStreak) {
      setPrevStreak(currentStreak);
      
      if (currentStreak > prevStreak) {
        setStreakAnimation('pulse');
        
        // Milestone celebrations (with i18n)
        if (currentStreak === 3) {
          triggerStreakToast(t('quizbarsticky.streak3msg'));
        } else if (currentStreak === 5) {
          triggerStreakToast(t('quizbarsticky.streak5msg'));
        } else if (currentStreak === 10) {
          triggerStreakToast(t('quizbarsticky.streak10msg'));
        }

        setTimeout(() => setStreakAnimation(''), 400);
      } 
      else if (currentStreak === 0 && prevStreak > 0) {
        setStreakAnimation('break');
        setTimeout(() => setStreakAnimation(''), 600);
      }
    }
  }, [currentStreak, prevStreak]);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const triggerStreakToast = (message) => {
    setToastMessage(message);
    setShowStreakToast(true);
    
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
    setTimeout(() => setShowStreakToast(false), 2500);
  };

  const percentage = totalQuestions > 0 
    ? Math.round((answeredCount / totalQuestions) * 100) 
    : 0;

  const getProgressTier = () => 'progress';

  const getStreakText = () => {
    if (currentStreak === 0) return null;
    if (currentStreak >= 10) return t('quizbarsticky.streak10txt');
    if (currentStreak >= 5) return t('quizbarsticky.streak5txt');
    if (currentStreak >= 3) return t('quizbarsticky.streak3txt');
    return 'STREAK';
  };

  const getFireEmojis = () => {
    if (currentStreak >= 10) return '🔥🔥🔥';
    if (currentStreak >= 5) return '🔥🔥';
    if (currentStreak >= 3) return '🔥';
    if (currentStreak >= 1) return '🔥';
    return '';
  };

  const progressTier = getProgressTier();
  const streakText = getStreakText();
  const fireEmojis = getFireEmojis();

  if (!isVisible) return null;

  // ============================================
  // RENDER
  // ============================================
  
  return (
    <>
      {/* Main Sticky Progress Bar */}
      <div className={`sticky-quiz-progress ${progressTier}`}>
        <div className="sticky-progress-content">
          
          {/* LEFT: Progress Info */}
          <div className="sticky-progress-left">
            <span className="sticky-progress-icon">🎯</span>
            <span className="sticky-progress-text">
              <strong>{answeredCount}/{totalQuestions}</strong> {t('quizbarsticky.answered')}
            </span>
          </div>

          {/* CENTER: Streak Counter */}
          {currentStreak > 0 && (
            <div className={`sticky-streak-counter ${streakAnimation}`}>
              <span className="streak-fire">{fireEmojis}</span>
              <span className="streak-number">{currentStreak}</span>
              {streakText && (
                <span className="streak-text">{streakText}</span>
              )}
            </div>
          )}

          {/* RIGHT: Score */}
          <div className="sticky-progress-right">
            <span className="sticky-stat-correct">{correctCount}✅</span>
            <span className="sticky-stat-separator">•</span>
            <span className="sticky-stat-incorrect">{incorrectCount}❌</span>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="sticky-progress-track">
          <div 
            className="sticky-progress-fill"
            style={{ width: `${percentage}%` }}
          >
            <div className="sticky-progress-shimmer"></div>
          </div>
        </div>
      </div>

      {/* Floating Toast for Streak Milestones */}
      {showStreakToast && (
        <div className="sticky-streak-toast">
          {toastMessage}
        </div>
      )}
    </>
  );
};

export default StickyQuizProgress;
