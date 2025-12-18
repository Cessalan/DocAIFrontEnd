import React from 'react';
import { useTranslation } from 'react-i18next';
import './QuickWinComplete.css';

/**
 * QuickWinComplete - Minimal momentum screen after first 2 flashcards
 *
 * Shows a simple celebration and offers next small step
 * No counters, no stats, just momentum
 */
const QuickWinComplete = ({
  onTryQuestion,
  onSaveLater,
  topic = null
}) => {
  const { t } = useTranslation();

  return (
    <div className="quick-win-complete">
      <div className="quick-win-content">
        {/* Title */}
        <h2 className="quick-win-title">
          {t('quickWin.niceStart')} 👏
        </h2>

        {/* Subtitle */}
        <p className="quick-win-subtitle">
          {t('quickWin.coveredBasics')}
        </p>

        {/* CTAs */}
        <div className="quick-win-actions">
          <button
            className="quick-win-btn quick-win-btn-primary"
            onClick={onTryQuestion}
          >
            <span className="btn-icon">▶</span>
            <span className="btn-text">{t('quickWin.tryQuestion')}</span>
          </button>

          <button
            className="quick-win-btn quick-win-btn-secondary"
            onClick={onSaveLater}
          >
            {t('quickWin.saveLater')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickWinComplete;
