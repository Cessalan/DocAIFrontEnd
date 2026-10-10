import React from 'react';
import { useTranslation } from 'react-i18next';
import { uploadActionIcon } from './uploadActionIcons';
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
 * @param {string} selectedActionId - Which action the student chose. Once set,
 *   the menu stays on screen: the chosen chip is marked and the others go
 *   quiet, so the history shows what was picked instead of a blank gap.
 * @param {function} onAction - Callback when user clicks an action button
 */
const PostUploadActions = ({
  message = '',
  topics = [],
  filenames = [],
  actions = [],
  showActions = true,
  disabled = false,
  selectedActionId = null,
  onAction
}) => {
  const { t } = useTranslation();

  // Map action IDs to i18n translation keys
  const getLocalizedLabel = (actionId, fallbackLabel) => {
    const labelKeys = {
      checkme: 'postUpload.checkmeLabel',
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

  // Shared with the composer suggestions (uploadActionIcons.js).
  const getActionIcon = (actionId) => uploadActionIcon(actionId);

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
        <div
          className={`post-upload-actions ${disabled ? 'actions-disabled' : ''} ${selectedActionId ? 'actions-resolved' : ''}`}
        >
          {actions.map((action) => {
            const isChosen = selectedActionId === action.id;
            const isPassedOver = Boolean(selectedActionId) && !isChosen;
            // Once a choice is made every chip is inert — re-clicking the
            // chosen one would fire the action a second time.
            const isDisabled = disabled || Boolean(selectedActionId);

            return (
              <button
                key={action.id}
                className={[
                  'post-upload-action-btn',
                  `action-${action.id}`,
                  disabled ? 'btn-disabled' : '',
                  isChosen ? 'btn-chosen' : '',
                  isPassedOver ? 'btn-passed-over' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => !isDisabled && onAction && onAction(action.id)}
                disabled={isDisabled}
                aria-pressed={selectedActionId ? isChosen : undefined}
                type="button"
              >
                <span className="action-icon-circle">
                  {isChosen ? (
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12.5L10 17.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    getActionIcon(action.id)
                  )}
                </span>
                <span className="action-label">{getLocalizedLabel(action.id, action.label)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PostUploadActions;
