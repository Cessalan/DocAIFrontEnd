import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './ShareFeedbackModal.css';

/**
 * ShareFeedbackModal — "tell us exactly what was wrong".
 *
 * WHY THIS EXISTS
 *
 * The thumbs-down first shipped with a row of inline chips and nothing else,
 * so the only sayable things were the four we had guessed. A student whose
 * complaint didn't match one of them had no way to say it, and the reason we
 * recorded was whichever guess sat closest — which is worse than no reason,
 * because it looks like data.
 *
 * Chips still carry most of the volume (one tap, and they aggregate), so this
 * keeps them. What it adds is room to type, and permission to pick more than
 * one — a wrong answer that is also too long is a normal thing to report.
 *
 * DESIGN NOTES
 *
 *  - Reasons are multi-select. Forcing a single choice on a student who has two
 *    complaints throws one of them away.
 *
 *  - Submit unlocks on a chip OR on typed text. Neither is required, so someone
 *    who only wants to write prose is never made to categorise first.
 *
 *  - Closing without submitting is a supported outcome, not an error. The
 *    thumbs-down is already recorded by the time this opens (see MessageRating),
 *    so an abandoned modal costs the detail, never the signal.
 *
 *  - Rendered through a portal: the action row it launches from lives inside a
 *    scrolling, transformed message container that would otherwise clip it.
 *
 * Reusable on purpose — the quiz, flashcard and study-block surfaces are due to
 * move onto this same modal, so nothing here is chat-specific beyond what the
 * caller passes in.
 *
 * @param {boolean}  isOpen
 * @param {Function} onClose
 * @param {Function} onSubmit    ({reasons, comment}) => void
 * @param {Array}    reasons     [{ id, key, fallback }] chips to offer.
 * @param {string}   [title]
 * @param {string}   [privacyNote]
 */

const MAX_COMMENT = 1000;

const ShareFeedbackModal = ({
  isOpen,
  onClose,
  onSubmit,
  reasons = [],
  title,
  privacyNote
}) => {
  const { t } = useTranslation();

  const [selected, setSelected] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(null);

  // Fresh every time it opens. A modal that remembers the last complaint would
  // pre-blame the next answer for something it didn't do.
  useEffect(() => {
    if (!isOpen) return;
    setSelected([]);
    setComment('');
    setSubmitting(false);
    restoreFocusRef.current = document.activeElement;
    // Focus the dialog itself rather than the textarea: autofocusing an input
    // yanks up the keyboard on mobile before the student has read the options.
    const id = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  // Hand focus back to whatever launched the modal, or the thumb is lost.
  useEffect(() => {
    if (isOpen) return undefined;
    const previous = restoreFocusRef.current;
    if (previous && typeof previous.focus === 'function') previous.focus();
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const toggleReason = useCallback((id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }, []);

  const canSubmit = selected.length > 0 || comment.trim().length > 0;

  const handleSubmit = useCallback(
    (e) => {
      if (e) e.preventDefault();
      if (!canSubmit || submitting) return;
      setSubmitting(true);
      // Fire and close. The write is best-effort and the caller confirms inline,
      // so holding the student here to watch a spinner buys nothing.
      onSubmit({ reasons: selected, comment: comment.trim() });
      onClose();
    },
    [canSubmit, submitting, onSubmit, selected, comment, onClose]
  );

  if (!isOpen) return null;

  const heading = title || t('chat.shareFeedbackTitle', 'Share feedback');

  return createPortal(
    <div className="share-feedback-overlay" onClick={onClose}>
      <div
        className="share-feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-feedback-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-feedback-header">
          <h3 className="share-feedback-title" id="share-feedback-title">
            {heading}
          </h3>
          <button
            type="button"
            className="share-feedback-close"
            onClick={onClose}
            aria-label={t('chat.shareFeedbackClose', 'Close')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="share-feedback-form" onSubmit={handleSubmit}>
          <div className="share-feedback-body">
            {reasons.length > 0 && (
              <div
                className="share-feedback-reasons"
                role="group"
                aria-label={t('chat.shareFeedbackReasonsAria', 'What went wrong?')}
              >
                {reasons.map((r) => {
                  const active = selected.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`share-feedback-chip ${active ? 'is-active' : ''}`}
                      onClick={() => toggleReason(r.id)}
                      aria-pressed={active}
                    >
                      {t(r.key, r.fallback)}
                    </button>
                  );
                })}
              </div>
            )}

            <label className="share-feedback-label" htmlFor="share-feedback-comment">
              <span className="share-feedback-visually-hidden">
                {t('chat.shareFeedbackDetailsAria', 'Details')}
              </span>
            </label>
            <textarea
              id="share-feedback-comment"
              className="share-feedback-textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('chat.shareFeedbackPlaceholder', 'Tell us what you needed instead (optional)')}
              maxLength={MAX_COMMENT}
              rows={3}
            />
            {comment.length > 0 && (
              <div className="share-feedback-count">
                {comment.length} / {MAX_COMMENT}
              </div>
            )}

            <p className="share-feedback-privacy">
              {privacyNote ||
                t(
                  'chat.shareFeedbackPrivacy',
                  'This conversation will be sent with your feedback so we can improve the tutor.'
                )}
            </p>
          </div>

          <div className="share-feedback-footer">
            <button
              type="submit"
              className="share-feedback-submit"
              disabled={!canSubmit || submitting}
            >
              {t('chat.shareFeedbackSubmit', 'Submit')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ShareFeedbackModal;
