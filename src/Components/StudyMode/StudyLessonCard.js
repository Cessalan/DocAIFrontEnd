import React from 'react';

/**
 * StudyLessonCard - Displays a mini-lesson in study mode
 *
 * @param {Object} content - Lesson content { title, body, keyPoints }
 * @param {Function} onContinue - Callback when user is ready to continue
 */
const StudyLessonCard = ({ content, onContinue }) => {
  const { title, body, keyPoints = [] } = content || {};

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

  // Lightbulb icon for key points
  const LightbulbIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );

  return (
    <div className="study-step-card">
      <div className="study-card-header">
        <div className="study-card-icon lesson">
          <LessonIcon />
        </div>
        <h2 className="study-card-title">{title || 'Lesson'}</h2>
      </div>

      <div className="study-card-content">
        {/* Main lesson body */}
        <div className="study-lesson-body">
          {body || 'Loading lesson content...'}
        </div>

        {/* Key points section */}
        {keyPoints && keyPoints.length > 0 && (
          <div className="study-lesson-key-points">
            <h4>
              <LightbulbIcon />
              Key Points
            </h4>
            <ul>
              {keyPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="study-card-footer">
        <button className="study-continue-btn" onClick={onContinue}>
          Continue
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
};

export default StudyLessonCard;
