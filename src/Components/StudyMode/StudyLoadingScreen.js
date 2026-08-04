import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * StudyLoadingScreen — Elapsed-aware loading experience.
 *
 * The old version rotated 6 messages 3s apart and then pinned on the last one
 * forever. Anything slower than 18s became a frozen sentence with three bouncing
 * dots — no progress, no estimate, no way out. Lesson generation is synchronous
 * on the backend and routinely runs past that, which is why lesson-first plans
 * lose ~1 in 5 users before content ever arrives.
 *
 * This version never goes static:
 *   - a time-based bar that asymptotes toward (but never reaches) 100%
 *   - reassurance copy that escalates at 15s and 30s
 *   - an escape hatch at 30s so a stalled generation is recoverable
 *
 * @param {string}   nodeType  - 'lesson' | 'quiz' | 'flashcard' | 'audio' | 'mindmap' | 'exam'
 * @param {Function} [onRetry] - Regenerate this node. Escape hatch, shown at 30s.
 * @param {Function} [onBack]  - Return to the plan overview. Escape hatch, shown at 30s.
 */
const MESSAGE_KEYS = {
  lesson:    ['lessonLoading1', 'lessonLoading2', 'lessonLoading3', 'lessonLoading4', 'lessonLoading5', 'lessonLoading6'],
  quiz:      ['quizLoading1', 'quizLoading2', 'quizLoading3', 'quizLoading4', 'quizLoading5', 'quizLoading6'],
  flashcard: ['flashcardLoading1', 'flashcardLoading2', 'flashcardLoading3', 'flashcardLoading4', 'flashcardLoading5', 'flashcardLoading6'],
  audio:     ['audioLoading1', 'audioLoading2', 'audioLoading3', 'audioLoading4', 'audioLoading5'],
  mindmap:   ['mindmapLoading1', 'mindmapLoading2', 'mindmapLoading3', 'mindmapLoading4', 'mindmapLoading5'],
};

/* Seconds after which we stop pretending this is quick. */
const SLOW_AT = 15;
const ESCAPE_AT = 30;

/* Asymptotic progress: fast early, never completes. Communicates "working"
   without ever lying about being nearly done. */
const progressFor = (secs) => Math.min(93, Math.round(100 * (1 - Math.exp(-secs / 14))));

const TYPE_ICONS = {
  lesson: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  quiz: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  flashcard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  ),
  audio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  mindmap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
      <circle cx="12" cy="12" r="3" />
      <circle cx="4" cy="6" r="2" />
      <circle cx="20" cy="6" r="2" />
      <circle cx="4" cy="18" r="2" />
      <circle cx="20" cy="18" r="2" />
      <line x1="9.5" y1="10" x2="5.5" y2="7.5" />
      <line x1="14.5" y1="10" x2="18.5" y2="7.5" />
      <line x1="9.5" y1="14" x2="5.5" y2="16.5" />
      <line x1="14.5" y1="14" x2="18.5" y2="16.5" />
    </svg>
  ),
};

const StudyLoadingScreen = ({ nodeType = 'lesson', onRetry, onBack }) => {
  const { t } = useTranslation();
  const [msgIndex, setMsgIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  const keys = MESSAGE_KEYS[nodeType] || MESSAGE_KEYS.lesson;
  const icon = TYPE_ICONS[nodeType] || TYPE_ICONS.lesson;

  // Rotate the flavour messages (unchanged cadence).
  useEffect(() => {
    setMsgIndex(0);
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev < keys.length - 1 ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [nodeType, keys.length]);

  // Elapsed ticker — drives the bar and the escalating reassurance copy.
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [nodeType]);

  const isSlow = elapsed >= SLOW_AT;
  const canEscape = elapsed >= ESCAPE_AT && (onRetry || onBack);
  const pct = progressFor(elapsed);

  // Past SLOW_AT the rotating flavour text gives way to honest status copy:
  // pretending it's still "almost there" at 25s is what makes people leave.
  const message = isSlow
    ? (elapsed >= ESCAPE_AT
        ? t('study.loadingStillWorking', "Still going. Longer documents take a bit more thinking — your content is on its way.")
        : t('study.loadingTakingLonger', "This one's a little longer than usual — hang tight."))
    : t(`study.${keys[msgIndex]}`);

  return (
    <div className="study-step-card">
      <div className="study-loading-premium">
        <div className="study-loading-premium__icon">
          {icon}
        </div>
        <h3 className="study-loading-premium__title">
          {t('study.preparing', {
            type: t(`study.nodeType.${nodeType}`, nodeType).toLowerCase(),
            defaultValue: `Preparing your ${nodeType}...`
          })}
        </h3>

        <p
          className={`study-loading-premium__msg${isSlow ? ' is-slow' : ''}`}
          key={isSlow ? `slow-${elapsed >= ESCAPE_AT}` : msgIndex}
          aria-live="polite"
        >
          {message}
        </p>

        {/* Time-based bar. Always moving, never claims completion. */}
        <div
          className="study-loading-premium__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t('study.loadingProgressAria', 'Generating your content')}
        >
          <div className="study-loading-premium__bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="study-loading-premium__dots">
          <span /><span /><span />
        </div>

        {/* Escape hatch — a stalled generation must never be a dead end. */}
        {canEscape && (
          <div className="study-loading-premium__escape">
            <span className="study-loading-premium__escape-label">
              {t('study.loadingTakingTooLong', 'Taking too long?')}
            </span>
            <div className="study-loading-premium__escape-actions">
              {onRetry && (
                <button type="button" className="study-loading-premium__escape-btn" onClick={onRetry}>
                  {t('study.loadingRetry', 'Try again')}
                </button>
              )}
              {onBack && (
                <button
                  type="button"
                  className="study-loading-premium__escape-btn study-loading-premium__escape-btn--ghost"
                  onClick={onBack}
                >
                  {t('study.loadingBackToPlan', 'Back to my plan')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyLoadingScreen;
