import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * StudyLoadingScreen — Premium loading experience with
 * node-type-specific rotating messages and animated dots.
 *
 * @param {string} nodeType - 'lesson' | 'quiz' | 'flashcard' | 'audio' | 'mindmap' | 'exam'
 */
const MESSAGE_KEYS = {
  lesson:    ['lessonLoading1', 'lessonLoading2', 'lessonLoading3', 'lessonLoading4', 'lessonLoading5', 'lessonLoading6'],
  quiz:      ['quizLoading1', 'quizLoading2', 'quizLoading3', 'quizLoading4', 'quizLoading5', 'quizLoading6'],
  flashcard: ['flashcardLoading1', 'flashcardLoading2', 'flashcardLoading3', 'flashcardLoading4', 'flashcardLoading5', 'flashcardLoading6'],
  audio:     ['audioLoading1', 'audioLoading2', 'audioLoading3', 'audioLoading4', 'audioLoading5'],
  mindmap:   ['mindmapLoading1', 'mindmapLoading2', 'mindmapLoading3', 'mindmapLoading4', 'mindmapLoading5'],
};

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

const StudyLoadingScreen = ({ nodeType = 'lesson' }) => {
  const { t } = useTranslation();
  const [msgIndex, setMsgIndex] = useState(0);

  const keys = MESSAGE_KEYS[nodeType] || MESSAGE_KEYS.lesson;
  const icon = TYPE_ICONS[nodeType] || TYPE_ICONS.lesson;

  useEffect(() => {
    setMsgIndex(0);
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev < keys.length - 1 ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [nodeType, keys.length]);

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
        <p className="study-loading-premium__msg" key={msgIndex}>
          {t(`study.${keys[msgIndex]}`)}
        </p>
        <div className="study-loading-premium__dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
};

export default StudyLoadingScreen;
