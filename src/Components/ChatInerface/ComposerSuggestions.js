import React from 'react';
import { useTranslation } from 'react-i18next';
import { uploadActionIcon } from './uploadActionIcons';
import './ComposerUploads.css';

// Study plan first: a chat can hold several uploads, and the plan is built
// from all of them, so it is the one action that is about the whole chat.
export const UPLOAD_SUGGESTIONS = ['studyjourney', 'checkme', 'quiz', 'studysheet', 'flashcards'];

const LABEL_KEYS = {
  studyjourney: 'postUpload.studyjourneyLabel',
  checkme: 'postUpload.checkmeLabel',
  quiz: 'postUpload.quizLabel',
  studysheet: 'postUpload.studysheetLabel',
  flashcards: 'postUpload.flashcardsLabel',
};

/**
 * What to do with the files, shown above the message box once every upload
 * in the batch is ready. Replaces the in-chat action grid for plain attaches.
 */
export default function ComposerSuggestions({ onPick, disabled = false, actions = UPLOAD_SUGGESTIONS }) {
  const { t } = useTranslation();
  return (
    <div className="composer-suggestions" role="group" aria-label={t('composerUpload.suggestionsLabel')}>
      {actions.map((id, index) => (
        <button
          key={id}
          type="button"
          className={`composer-suggestion suggestion-${id}`}
          style={{ animationDelay: `${index * 55}ms` }}
          disabled={disabled}
          onClick={() => onPick(id)}
        >
          <span className="composer-suggestion__icon" aria-hidden="true">{uploadActionIcon(id)}</span>
          {t(LABEL_KEYS[id])}
        </button>
      ))}
    </div>
  );
}
