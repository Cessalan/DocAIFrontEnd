import React from 'react';

/**
 * StudyModeHeader - Header bar for study mode
 * Shows exit button and unit title (branding is handled by App.js)
 *
 * @param {string} unitTitle - Main title of the study unit
 * @param {string} unitSubtitle - Subtitle/description
 * @param {Function} onExit - Callback to exit study mode
 */
const StudyModeHeader = ({
  unitTitle = 'Study Session',
  unitSubtitle = '',
  onExit
}) => {
  return (
    <div className="study-mode-header">
      <div className="study-header-inner">
        {/* Left side: empty spacer for balance */}
        <div className="study-header-left"></div>

        {/* Center: title */}
        <div className="study-header-center">
          <div className="study-header-info">
            <h1 className="study-unit-title">{unitTitle}</h1>
            {unitSubtitle && (
              <p className="study-unit-subtitle">{unitSubtitle}</p>
            )}
          </div>
        </div>

        {/* Right side: Exit button */}
        <div className="study-header-right">
          <button
            className="study-exit-btn"
            onClick={onExit}
            title="Exit Study Mode"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyModeHeader;
