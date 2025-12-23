import React from 'react';
import { ReactComponent as HeartLogo } from '../../assets/favicon.svg';

/**
 * StudyModeHeader - Header bar for study mode
 * Shows NurseQuizAI branding, exit button, and unit title
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
  onExit
}) => {
  return (
    <div className="study-mode-header">
      <div className="study-header-inner">
        {/* Left side: Brand logo */}
        <div className="study-header-brand">
          <HeartLogo className="study-brand-logo" />
          <span className="study-brand-name">NurseQuizAI</span>
        </div>

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
