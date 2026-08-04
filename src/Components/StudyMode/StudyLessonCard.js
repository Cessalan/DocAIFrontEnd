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
 * @param {boolean} isReviewMode - If true, this is a review of completed content (only 5 XP)
 * @param {Function} onContinue - Callback when user completes all pages
 * @param {Function} onExit - Callback to exit/close the card
 */
const StudyLessonCard = ({ content, isReviewMode = false, onContinue, onExit }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Handle both new multi-page format and legacy format
  const isMultiPage = content?.pages && Array.isArray(content.pages);
  const pages = isMultiPage ? content.pages : null;

  // ── Streaming support ────────────────────────────────────────────────
  // Lessons now arrive page-by-page. `pages` grows while the student is
  // already reading page 1, so anything derived from its length has to
  // tolerate growth mid-render:
  //   - progress bar uses the EXPECTED total so it doesn't rescale on
  //     every arrival (which reads as the goal moving away from you)
  //   - "Finish" must never appear before the last page has landed
  const isStreaming = !!content?._isStreaming;
  const receivedPages = pages ? pages.length : 0;
  const expectedTotal = content?._expectedTotal || 0;
  const totalPages = pages
    ? (isStreaming ? Math.max(receivedPages, expectedTotal) : receivedPages)
    : 1;

  // Legacy format fallback
  const { title, body, keyPoints = [] } = content || {};

  // Calculate time taken
  const getTimeTaken = () => {
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  };

  // XP for lessons - commented out to reduce distraction
  // // Review mode: flat 5 XP for completing review
  // // Normal mode: 5 XP per page read
  // const xpEarned = isReviewMode ? 5 : totalPages * 5;

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

  // Handle next page or show celebration.
  // Bounded by pages RECEIVED, not expected: while streaming, advancing past
  // the last arrived page would render an undefined page.
  const handleNext = () => {
    if (isMultiPage && currentPage < receivedPages - 1) {
      // Play correct sound for "Got it!" button
      playCorrectSound();
      setCurrentPage(prev => prev + 1);
    } else if (isMultiPage && isStreaming) {
      // Last received page but more still coming — no-op (button is disabled).
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
    // "Last page" only once streaming has finished — otherwise the Finish
    // button would appear on page 1 of a 1-page-so-far lesson.
    const isLastPage = !isStreaming && currentPage === receivedPages - 1;
    const isFirstPage = currentPage === 0;
    const waitingForNextPage = isStreaming && currentPage >= receivedPages - 1;

    // Nothing has landed yet: the stream is open but page 1 is still being
    // written. Show the shell (title, progress) so the transition from the
    // loading screen is continuous rather than a second blank state.
    if (!page) {
      return (
        <div className="study-step-card study-lesson-multipage">
          <div className="study-card-header">
            <div className="study-card-icon lesson">
              <LessonIcon />
            </div>
            <h2 className="study-card-title">
              {content.title || t('study.lessonTitle', 'Lesson')}
            </h2>
            {onExit && (
              <button className="study-card-close-btn" onClick={onExit} title={t('study.close', 'Close')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <div className="study-card-content study-lesson-page-content">
            <div className="study-lesson-skeleton" aria-live="polite">
              <span className="study-lesson-skeleton__line" />
              <span className="study-lesson-skeleton__line" />
              <span className="study-lesson-skeleton__line study-lesson-skeleton__line--short" />
              <p className="study-lesson-skeleton__label">
                {t('study.lessonWritingFirstPage', 'Writing your first page…')}
              </p>
            </div>
          </div>
        </div>
      );
    }

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
              /* xpEarned={xpEarned} */
              timeSeconds={getTimeTaken()}
              isPerfect={true}
              inline={true}
              onContinue={handleCelebrationContinue}
            />
          </div>
        ) : (
          <>
            <div className="study-card-content study-lesson-page-content" data-selectable="true">
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

              {/* Next/Continue button.
                  While the next page is still streaming the button stays put
                  but goes into a waiting state — the student reads on, and it
                  re-enables the moment the page arrives. */}
              <button
                className={`study-continue-btn study-lesson-btn-green${waitingForNextPage ? ' is-waiting' : ''}`}
                onClick={handleNext}
                disabled={waitingForNextPage}
              >
                {waitingForNextPage
                  ? t('study.lessonWritingNextPage', 'Writing next page…')
                  : isLastPage
                    ? t('study.finishLesson', 'Finish')
                    : t('study.gotItBtn', 'Got it!')}
                {!waitingForNextPage && <ArrowRightIcon />}
              </button>

              {/* Page indicator — received pages are navigable; pages still
                  being written show as ghosts so the lesson's real length is
                  visible from the start. */}
              <div className="study-lesson-page-dots">
                {pages.map((_, idx) => (
                  <span
                    key={idx}
                    className={`page-dot ${idx === currentPage ? 'active' : ''} ${idx < currentPage ? 'completed' : ''}`}
                    onClick={() => setCurrentPage(idx)}
                  />
                ))}
                {isStreaming && Array.from(
                  { length: Math.max(0, expectedTotal - receivedPages) },
                  (_, idx) => <span key={`ghost-${idx}`} className="page-dot is-pending" />
                )}
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
            /* xpEarned={xpEarned} */
            timeSeconds={getTimeTaken()}
            isPerfect={true}
            inline={true}
            onContinue={handleCelebrationContinue}
          />
        </div>
      ) : (
        <>
          <div className="study-card-content" data-selectable="true">
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
