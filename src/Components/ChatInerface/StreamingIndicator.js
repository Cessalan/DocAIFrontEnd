import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Sleek streaming indicator bar - used for quiz and flashcard generation
 * Displays above the content with animated dots
 */
const StreamingIndicator = ({ type = 'quiz' }) => {
  const { t } = useTranslation();

  const translationKeys = {
    quiz: 'loading.generatingQuiz',
    flashcard: 'loading.generatingFlashcards'
  };

  const fallbackMessages = {
    quiz: 'Generating quiz...',
    flashcard: 'Generating flashcards...'
  };

  return (
    <div className="streaming-bar">
      <div className="streaming-animation">
        <div className="streaming-dot"></div>
        <div className="streaming-dot"></div>
        <div className="streaming-dot"></div>
      </div>
      <span className="streaming-text">
        {t(translationKeys[type], fallbackMessages[type])}
      </span>
    </div>
  );
};

export default StreamingIndicator;
