import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * StudyModeHeader - Header bar for study mode
 * Shows unit title centered (close button is now inside each card)
 *
 * @param {string} unitTitle - Main title of the study unit
 * @param {string} unitSubtitle - Subtitle/description
 */
const StudyModeHeader = ({
  unitTitle,
  unitSubtitle = ''
}) => {
  const { t } = useTranslation();
  const displayTitle = unitTitle || t('study.yourStudyPlan', 'Study Session');
  return (
    <div className="study-mode-header">
      <div className="study-header-inner">
        {/* Center: title */}
        <div className="study-header-center">
          <div className="study-header-info">
            <h1 className="study-unit-title">{displayTitle}</h1>
            {unitSubtitle && (
              <p className="study-unit-subtitle">{unitSubtitle}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyModeHeader;
