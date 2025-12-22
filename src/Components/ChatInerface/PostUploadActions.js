import React from 'react';
import { useTranslation } from 'react-i18next';
import './PostUploadActions.css';

/**
 * PostUploadActions - Friendly AI message with colorful action buttons after file upload
 *
 * PURPOSE:
 * After a user uploads study materials, instead of just showing stats,
 * we show a conversational message that guides them on what to do next.
 * This makes the app feel like a study companion, not just a tool.
 *
 * DESIGN:
 * Matches the QuizRoomLanding aesthetic with colorful sticky-note style buttons.
 * Each action has its own signature color for quick visual recognition.
 *
 * PROPS:
 * @param {string} message - The friendly AI message (e.g., "Got it! I found material on...")
 * @param {string[]} topics - Topics extracted from uploaded files (for context)
 * @param {string[]} filenames - Names of uploaded files (for context)
 * @param {object[]} actions - Array of action buttons to display
 *   Each action: { id: 'quiz', label: 'Quiz me on these topics', icon: '🧪' }
 * @param {boolean} showActions - Whether to show action buttons (hides after click)
 * @param {function} onAction - Callback when user clicks an action button
 */
const PostUploadActions = ({
  message = '',
  topics = [],
  filenames = [],
  actions = [],
  showActions = true,
  disabled = false,
  onAction
}) => {
  const { t } = useTranslation();

  // Map action IDs to i18n translation keys
  const getLocalizedLabel = (actionId, fallbackLabel) => {
    const labelKeys = {
      quiz: 'postUpload.quizLabel',
      flashcards: 'postUpload.flashcardsLabel',
      studysheet: 'postUpload.studysheetLabel',
      audio: 'postUpload.audioLabel',
      mindmap: 'postUpload.mindmapLabel',
      studyjourney: 'postUpload.studyjourneyLabel'
    };
    const key = labelKeys[actionId];
    return key ? t(key, fallbackLabel) : fallbackLabel;
  };

  // SVG icons for each action type (matching QuizRoomLanding)
  const getActionIcon = (actionId) => {
    switch (actionId) {
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
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="post-upload-message">
      {/* -----------------------------------------
          FRIENDLY MESSAGE TEXT
          This is the conversational part that makes
          the AI feel like a study buddy
          ----------------------------------------- */}
      <div className="post-upload-text">
        {message}
      </div>

      {/* -----------------------------------------
          ACTION BUTTONS - Colorful horizontal pills
          Matches QuizRoomLanding sticky-note aesthetic
          ----------------------------------------- */}
      {showActions && actions.length > 0 && (
        <div className={`post-upload-actions ${disabled ? 'actions-disabled' : ''}`}>
          {actions.map((action) => (
            <button
              key={action.id}
              className={`post-upload-action-btn action-${action.id} ${disabled ? 'btn-disabled' : ''}`}
              onClick={() => !disabled && onAction && onAction(action.id)}
              disabled={disabled}
              type="button"
            >
              <span className="action-icon-circle">
                {getActionIcon(action.id)}
              </span>
              <span className="action-label">{getLocalizedLabel(action.id, action.label)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostUploadActions;
