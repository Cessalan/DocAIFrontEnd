import React from 'react';

/* The action icons, shared by the in-chat action buttons (PostUploadActions)
   and the suggestions above the message box (ComposerSuggestions), so the
   two never drift into different drawings for the same action. */
export function uploadActionIcon(actionId) {
  switch (actionId) {
    case 'checkme':
      // Speech bubble with a check — "say it back, I'll confirm it"
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12a8 8 0 01-8 8H8l-4 3v-5.2A8 8 0 0113 4a8 8 0 018 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M9 12l2.5 2.5L16 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'quiz':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 10L10 12L16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'flashcards':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="6" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="9" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      );
    case 'audio':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4V20M8 8V16M4 11V13M16 6V18M20 9V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    case 'studysheet':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M14 2v6h6M8 13h8M8 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    case 'mindmap':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Left node (root) */}
          <rect x="2" y="9" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          {/* Top right node */}
          <rect x="18" y="2" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          {/* Bottom right node */}
          <rect x="18" y="16" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          {/* Horizontal line from left node */}
          <path d="M6 12H12" stroke="currentColor" strokeWidth="1.5"/>
          {/* Vertical line */}
          <path d="M12 5V19" stroke="currentColor" strokeWidth="1.5"/>
          {/* Top horizontal to right node */}
          <path d="M12 5H18" stroke="currentColor" strokeWidth="1.5"/>
          {/* Bottom horizontal to right node */}
          <path d="M12 19H18" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      );
    case 'studyjourney':
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Path/road icon representing a learning journey */}
          <path d="M12 2L12 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
          <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="12" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M14.5 5L18 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M6 12L9.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M14.5 19L18 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    default:
      return null;
  }
}
