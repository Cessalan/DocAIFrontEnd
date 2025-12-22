import React from 'react';

/**
 * StudyModeHeader - Header bar for study mode
 * Shows unit title, progress, and exit button
 *
 * @param {string} unitTitle - Main title of the study unit
 * @param {string} unitSubtitle - Subtitle/description
 * @param {number} currentStep - Current step number (1-indexed)
 * @param {number} totalSteps - Total number of steps
 * @param {Function} onExit - Callback to exit study mode
 */
const StudyModeHeader = ({
  unitTitle = 'Study Session',
  unitSubtitle = '',
  currentStep = 1,
  totalSteps = 1,
  onExit
}) => {
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="study-mode-header">
      <div className="study-header-inner">
        <div className="study-header-left">
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

          <div className="study-header-info">
            <h1 className="study-unit-title">{unitTitle}</h1>
            {unitSubtitle && (
              <p className="study-unit-subtitle">{unitSubtitle}</p>
            )}
          </div>
        </div>

        <div className="study-header-right">
          <div className="study-progress-indicator">
            <span className="study-progress-text">
              Step {currentStep} of {totalSteps}
            </span>
            <div className="study-progress-bar">
              <div
                className="study-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyModeHeader;
