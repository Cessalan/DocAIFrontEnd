import React from 'react';

/**
 * StudyProgressBar - Duolingo-style progress bar component
 *
 * @param {number} current - Current step (0-indexed or completed count)
 * @param {number} total - Total number of steps
 * @param {boolean} includeCurrentAsComplete - Whether to count current step as complete (default: false)
 */
const StudyProgressBar = ({ current, total, includeCurrentAsComplete = false }) => {
  if (total <= 1) return null;

  const completed = includeCurrentAsComplete ? current + 1 : current;
  const percentage = (completed / total) * 100;

  return (
    <div className="study-progress-bar-container">
      <div
        className="study-progress-bar-fill"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

export default StudyProgressBar;
