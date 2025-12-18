import React from 'react';
import { useTranslation } from 'react-i18next';
import './QuizModeSelector.css';

/**
 * QuizModeSelector - Modal for choosing between NCLEX and Knowledge quiz modes
 *
 * Displayed after user clicks the Quiz button in PostUploadActions.
 * Allows users to choose between:
 * - NCLEX Practice: Clinical scenarios testing judgment (existing behavior)
 * - Knowledge Test: Direct factual questions (new feature)
 */
const QuizModeSelector = ({ isOpen, onClose, onSelectMode, topics = [] }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleModeSelect = (mode) => {
    onSelectMode(mode);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="quiz-mode-overlay" onClick={handleOverlayClick}>
      <div className="quiz-mode-modal">
        {/* Header */}
        <div className="quiz-mode-header">
          <h2 className="quiz-mode-title">
            {t('quiz.modeSelector.title', 'Choose Quiz Type')}
          </h2>
          <button className="quiz-mode-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Topic context */}
        {topics.length > 0 && (
          <p className="quiz-mode-context">
            {t('quiz.modeSelector.context', 'Generating questions about: {{topics}}', { topics: topics.slice(0, 3).join(', ') })}
          </p>
        )}

        {/* Mode options */}
        <div className="quiz-mode-options">
          {/* Knowledge Test Option - Default/Recommended */}
          <button
            className="quiz-mode-option knowledge"
            onClick={() => handleModeSelect('knowledge')}
          >
            <div className="mode-icon knowledge-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M8 10h8" />
                <path d="M8 14h5" />
                <circle cx="16" cy="14" r="2" />
              </svg>
            </div>
            <div className="mode-content">
              <span className="mode-name">
                {t('quiz.modeSelector.knowledge', 'Knowledge Test')}
              </span>
              <span className="mode-description">
                {t('quiz.modeSelector.knowledgeDesc', 'Direct questions testing factual recall')}
              </span>
            </div>
            <div className="mode-badge recommended">
              {t('quiz.modeSelector.recommended', 'Recommended')}
            </div>
          </button>

          {/* NCLEX Practice Option - Advanced */}
          <button
            className="quiz-mode-option nclex"
            onClick={() => handleModeSelect('nclex')}
          >
            <div className="mode-icon nclex-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 4.5c-4.5 0-8 3-8 6s3.5 6 8 6 8-3 8-6-3.5-6-8-6z" />
                <path d="M12 10.5v3" />
                <path d="M10 14l2 2 4-4" />
                <path d="M8 7.5h8" />
              </svg>
            </div>
            <div className="mode-content">
              <span className="mode-name">
                {t('quiz.modeSelector.nclex', 'NCLEX Practice')}
              </span>
              <span className="mode-description">
                {t('quiz.modeSelector.nclexDesc', 'Clinical scenarios testing your judgment')}
              </span>
            </div>
            <div className="mode-badge">
              {t('quiz.modeSelector.advanced', 'Advanced')}
            </div>
          </button>
        </div>

        {/* Hint text */}
        <p className="quiz-mode-hint">
          {t('quiz.modeSelector.hint', 'Not sure? Start with Knowledge Test for basic review, then try NCLEX Practice when ready.')}
        </p>
      </div>
    </div>
  );
};

export default QuizModeSelector;
