import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import StudyProgressBar from './StudyProgressBar';
import StudyCelebration from './StudyCelebration';
import { playCelebrationSound, playCorrectSound } from '../../utils/soundEffects';

/**
 * StudyLessonCard - Multi-page lesson with swipeable cards
 * Duolingo-style: ONE concept per page, fun and engaging!
 *
 * @param {Object} content - Lesson content { title, pages: [{ title, content, highlight }] }
 *                          OR legacy format { title, body, keyPoints }
 * @param {Function} onContinue - Callback when user completes all pages
 * @param {Function} onExit - Callback to exit/close the card
 */
const StudyLessonCard = ({ content, onContinue, onExit }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Handle both new multi-page format and legacy format
  const isMultiPage = content?.pages && Array.isArray(content.pages);
  const pages = isMultiPage ? content.pages : null;
  const totalPages = pages ? pages.length : 1;

  // Legacy format fallback
  const { title, body, keyPoints = [] } = content || {};

  // Calculate time taken
  const getTimeTaken = () => {
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  };

  // XP for lessons (5 XP per page read)
  const xpEarned = totalPages * 5;

  // Book icon for lesson
  const LessonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );

  // Arrow right icon
  const ArrowRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );

  // Lightbulb icon for highlights
  const LightbulbIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );

  // Parse markdown-style **bold** to HTML
  const parseContent = (text) => {
    if (!text) return '';
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  };

  // Handle next page or show celebration
  const handleNext = () => {
    if (isMultiPage && currentPage < totalPages - 1) {
      // Play correct sound for "Got it!" button
      playCorrectSound();
      setCurrentPage(prev => prev + 1);
    } else {
      // Show celebration instead of immediately continuing
      setShowCelebration(true);
      playCelebrationSound();
    }
  };

  // Handle celebration continue
  const handleCelebrationContinue = () => {
    setShowCelebration(false);
    if (onContinue) onContinue();
  };

  // Handle previous page
  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Render multi-page lesson
  if (isMultiPage && pages) {
    const page = pages[currentPage];
    const isLastPage = currentPage === totalPages - 1;
    const isFirstPage = currentPage === 0;

    return (
      <div className="study-step-card study-lesson-multipage">
        <div className="study-card-header">
          <div className="study-card-icon lesson">
            <LessonIcon />
          </div>
          <h2 className="study-card-title">{content.title || t('study.lessonTitle', 'Lesson')}</h2>
          {onExit && (
            <button className="study-card-close-btn" onClick={onExit} title={t('study.close', 'Close')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress bar showing page progress */}
        <StudyProgressBar
          current={currentPage}
          total={totalPages}
          includeCurrentAsComplete={true}
        />

        {/* Show celebration or lesson content */}
        {showCelebration ? (
          <div className="study-card-content">
            <StudyCelebration
              type="complete"
              xpEarned={xpEarned}
              timeSeconds={getTimeTaken()}
              isPerfect={true}
              inline={true}
              onContinue={handleCelebrationContinue}
            />
          </div>
        ) : (
          <>
            <div className="study-card-content study-lesson-page-content">
              {/* Page title */}
              <h3 className="study-lesson-page-title">{page.title}</h3>

              {/* Page content */}
              <div
                className="study-lesson-page-body"
                dangerouslySetInnerHTML={{ __html: parseContent(page.content) }}
              />

              {/* Highlight box (if present) */}
              {page.highlight && (
                <div className="study-lesson-highlight">
                  <LightbulbIcon />
                  <span>{page.highlight}</span>
                </div>
              )}
            </div>

            <div className="study-card-footer study-lesson-footer-nav">
              {/* Previous button (hidden on first page) */}
              <button
                className={`study-lesson-nav-btn prev ${isFirstPage ? 'hidden' : ''}`}
                onClick={handlePrev}
                disabled={isFirstPage}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>

              {/* Next/Continue button */}
              <button className="study-continue-btn study-lesson-btn-green" onClick={handleNext}>
                {isLastPage ? t('study.finishLesson', 'Finish') : t('study.gotItBtn', 'Got it!')}
                <ArrowRightIcon />
              </button>

              {/* Page indicator */}
              <div className="study-lesson-page-dots">
                {pages.map((_, idx) => (
                  <span
                    key={idx}
                    className={`page-dot ${idx === currentPage ? 'active' : ''} ${idx < currentPage ? 'completed' : ''}`}
                    onClick={() => setCurrentPage(idx)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Legacy single-page format (backward compatibility)
  return (
    <div className="study-step-card">
      <div className="study-card-header">
        <div className="study-card-icon lesson">
          <LessonIcon />
        </div>
        <h2 className="study-card-title">{title || t('study.lessonTitle', 'Lesson')}</h2>
        {onExit && (
          <button className="study-card-close-btn" onClick={onExit} title={t('study.close', 'Close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Show celebration or lesson content */}
      {showCelebration ? (
        <div className="study-card-content">
          <StudyCelebration
            type="complete"
            xpEarned={xpEarned}
            timeSeconds={getTimeTaken()}
            isPerfect={true}
            inline={true}
            onContinue={handleCelebrationContinue}
          />
        </div>
      ) : (
        <>
          <div className="study-card-content">
            {/* Main lesson body */}
            <div
              className="study-lesson-body"
              dangerouslySetInnerHTML={{ __html: parseContent(body) }}
            />

            {/* Key points section */}
            {keyPoints && keyPoints.length > 0 && (
              <div className="study-lesson-key-points">
                <h4>
                  <LightbulbIcon />
                  {t('study.keyPoints', 'Key Points')}
                </h4>
                <ul>
                  {keyPoints.map((point, index) => (
                    <li key={index} dangerouslySetInnerHTML={{ __html: parseContent(point) }} />
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="study-card-footer">
            <button className="study-continue-btn study-lesson-btn-green" onClick={handleNext}>
              {t('study.finishLesson', 'Finish')}
              <ArrowRightIcon />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default StudyLessonCard;
