import React from 'react';

/**
 * planNodeIcon — SVG icon for a study-path node, by type.
 *
 * Shared between the StartStudyModal preview and the StudyPlanOverview page
 * so a single node renders with the same glyph in both places. The icon
 * inherits color from its parent via `fill="currentColor"`.
 *
 * @param {string} type   — node type (lesson | quiz | flashcard | audio | mindmap | review | exam)
 * @param {string} status — optional; when 'done' a checkmark is rendered instead
 */
export const getStudyNodeIcon = (type, status) => {
  if (status === 'done') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  switch (type) {
    case 'lesson':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2C4.89 2 4 2.9 4 4V20C4 21.1 4.89 22 6 22H18C19.1 22 20 21.1 20 20V4C20 2.9 19.1 2 18 2H6ZM6 4H11V12L8.5 10.5L6 12V4Z" /></svg>);
    case 'quiz':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 19H11V17H13V19ZM15.07 11.25L14.17 12.17C13.45 12.9 13 13.5 13 15H11V14.5C11 13.4 11.45 12.4 12.17 11.67L13.41 10.41C13.78 10.05 14 9.55 14 9C14 7.9 13.1 7 12 7C10.9 7 10 7.9 10 9H8C8 6.79 9.79 5 12 5C14.21 5 16 6.79 16 9C16 9.88 15.64 10.68 15.07 11.25Z" /></svg>);
    case 'flashcard':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2V20C2 21.1 2.9 22 4 22H18V20H4V6ZM20 2H8C6.9 2 6 2.9 6 4V16C6 17.1 6.9 18 8 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H8V4H20V16ZM13 14H15V11H18V9H15V6H13V9H10V11H13V14Z" /></svg>);
    case 'audio':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C7.03 1 3 5.03 3 10V17C3 18.66 4.34 20 6 20H9V12H5V10C5 6.13 8.13 3 12 3C15.87 3 19 6.13 19 10V12H15V20H18C19.66 20 21 18.66 21 17V10C21 5.03 16.97 1 12 1Z" /></svg>);
    case 'mindmap':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C13.1 2 14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C15.1 7 16 7.9 16 9V10.27C16.6 10.61 17 11.26 17 12C17 12.74 16.6 13.39 16 13.73V15C16 16.1 15.1 17 14 17H13V18.27C13.6 18.61 14 19.26 14 20C14 21.1 13.1 22 12 22C10.9 22 10 21.1 10 20C10 19.26 10.4 18.61 11 18.27V17H10C8.9 17 8 16.1 8 15V13.73C7.4 13.39 7 12.74 7 12C7 11.26 7.4 10.61 8 10.27V9C8 7.9 8.9 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2ZM10 9V15H14V9H10Z" /></svg>);
    case 'review':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.76 16.26C19.54 15.03 20 13.57 20 12C20 7.58 16.42 4 12 4ZM12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.24 7.74C4.46 8.97 4 10.43 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" /></svg>);
    case 'exam':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 5C9 3.9 9.9 3 11 3H13C14.1 3 15 3.9 15 5H19C20.1 5 21 5.9 21 7V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V7C3 5.9 3.9 5 5 5H9ZM11 5V4H13V5H11ZM7 9H17V7H7V9ZM7 13H17V11H7V13ZM7 17H13V15H7V17Z" /></svg>);
    default:
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" /></svg>);
  }
};
