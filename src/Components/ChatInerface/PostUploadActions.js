import React from 'react';
import { useTranslation } from 'react-i18next';
import './PostUploadActions.css';

/**
 * PostUploadActions - Friendly AI message with action buttons after file upload
 *
 * PURPOSE:
 * After a user uploads study materials, instead of just showing stats,
 * we show a conversational message that guides them on what to do next.
 * This makes the app feel like a study companion, not just a tool.
 *
 * PROPS:
 * @param {string} message - The friendly AI message (e.g., "Got it! I found material on...")
 * @param {string[]} topics - Topics extracted from uploaded files (for context)
 * @param {string[]} filenames - Names of uploaded files (for context)
 * @param {object[]} actions - Array of action buttons to display
 *   Each action: { id: 'quiz', label: 'Quiz me on these topics', icon: '🧪' }
 * @param {boolean} showActions - Whether to show action buttons (hides after click)
 * @param {function} onAction - Callback when user clicks an action button
 *
 * EXAMPLE USAGE:
 * <PostUploadActions
 *   message="Got it! I found material on Drug Interactions and Dosage Calculations."
 *   topics={['Drug Interactions', 'Dosage Calculations']}
 *   actions={[
 *     { id: 'quiz', label: 'Quiz me', icon: '🧪' },
 *     { id: 'flashcards', label: 'Create flashcards', icon: '📇' }
 *   ]}
 *   showActions={true}
 *   onAction={(actionId) => handleAction(actionId)}
 * />
 */
const PostUploadActions = ({
  message = '',
  topics = [],
  filenames = [],
  actions = [],
  showActions = true,
  onAction
}) => {
  const { t } = useTranslation();

  // Map action IDs to i18n translation keys
  const getLocalizedLabel = (actionId, fallbackLabel) => {
    const labelKeys = {
      quiz: 'postUpload.quizLabel',
      flashcards: 'postUpload.flashcardsLabel',
      studysheet: 'postUpload.studysheetLabel',
      audio: 'postUpload.audioLabel'
    };
    const key = labelKeys[actionId];
    return key ? t(key, fallbackLabel) : fallbackLabel;
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
          ACTION BUTTONS
          These guide the user on what to do next.
          They disappear after the user clicks one.
          ----------------------------------------- */}
      {showActions && actions.length > 0 && (
        <div className="post-upload-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              className="post-upload-action-btn"
              onClick={() => onAction && onAction(action.id)}
              type="button"
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{getLocalizedLabel(action.id, action.label)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostUploadActions;
