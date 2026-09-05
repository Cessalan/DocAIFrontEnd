import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { atTurnLimit, MAX_MESSAGE_CHARS } from './examDebriefConversation';
import './ExamDebriefModal.css';

/**
 * ExamDebriefModal — the conversation we have with a student after her exam.
 *
 * WHY IT IS A CONVERSATION AND NOT A FORM
 *
 * This started as three survey questions, and a survey is what made it
 * worthless. The most valuable thing a student can tell us about her exam is
 * the thing we did not think to put on the list — and a fixed question shown
 * after she has just typed something specific teaches her, correctly, that
 * nothing is reading her answers. So the tutor asks one question, reads what
 * she says, and decides what is worth asking next.
 *
 * DESIGN NOTES
 *
 *  - The opening line is composed HERE, not fetched. It uses her actual exam
 *    name, and it must be on screen the instant the modal opens: a chat that
 *    opens on a spinner is a chat you close. The model only enters from her
 *    first reply onward, which is also when it has something to react to.
 *
 *  - Three suggestion chips sit under the opener, and only under the opener.
 *    They are openings, not options — tapping one sends it as her own words and
 *    the tutor follows it wherever it goes. Without them the first move on a
 *    phone is "tap the box, wait for the keyboard, compose a sentence", which
 *    is where most of the drop-off lives. Offering them again on later turns
 *    would turn her answers back into a menu, so they never come back.
 *
 *  - The transcript never shows a step counter or a progress bar. She is
 *    talking to someone, and someone does not display how many questions they
 *    have left.
 *
 *  - A failed turn ends the conversation warmly instead of showing an error and
 *    a retry. She has just walked out of an exam; the cost of a lost follow-up
 *    is one missing detail, and everything she already said is saved by the
 *    caller regardless.
 *
 *  - The overlay does NOT close on a stray click, unlike every other modal
 *    here. A dismissal is permanent by design, and a misplaced tap should not
 *    spend a question we only get to ask once. The × and Esc still close it,
 *    because a student who wants out must always have an obvious way out.
 *
 * @param {Object}   exam       {label, daysAgo, isThisWeek, date} — for the opener.
 * @param {Array}    messages   [{role, content}] — the transcript so far.
 * @param {boolean}  isThinking Waiting on the tutor's next line.
 * @param {boolean}  isDone     The conversation has closed.
 * @param {Function} onSend     (text) => void
 * @param {Function} onDismiss  Closed without saying anything.
 * @param {Function} onClose    Closed after taking part.
 */

const ExamDebriefModal = ({
  exam,
  messages,
  isThinking,
  isDone,
  onSend,
  onDismiss,
  onClose
}) => {
  const { t } = useTranslation();

  const [draft, setDraft] = useState('');

  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const feedRef = useRef(null);

  const hasSpoken = messages.some((m) => m.role === 'user');
  const canType = !isDone && !isThinking && !atTurnLimit(messages);

  // Leaving is always allowed. Whether it counts as a dismissal depends only on
  // whether she said anything — after that the row exists, and closing costs a
  // follow-up rather than the answer.
  const leave = useCallback(() => {
    if (hasSpoken) onClose();
    else onDismiss();
  }, [hasSpoken, onClose, onDismiss]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        leave();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [leave]);

  // Focus the dialog, never the input: autofocusing a textarea throws up the
  // keyboard on mobile and covers the question she has not read yet.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Follow the conversation down as it grows.
  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages, isThinking]);

  const send = useCallback(
    (text) => {
      const trimmed = (text || '').trim();
      if (!trimmed || !canType) return;
      setDraft('');
      onSend(trimmed.slice(0, MAX_MESSAGE_CHARS));
    },
    [canType, onSend]
  );

  const onKeyDown = (e) => {
    // Enter sends, Shift+Enter breaks the line — the convention every chat uses.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  };

  if (!exam) return null;

  /* Openings, not options — see DESIGN NOTES. Deliberately three moods rather
     than a scale, so whichever she picks, the tutor has something specific to
     follow rather than a rating to acknowledge. */
  const suggestions = [
    t('examDebrief.suggestWell', 'It went well'),
    t('examDebrief.suggestHarder', 'Harder than I expected'),
    t('examDebrief.suggestRough', 'It was rough')
  ];

  return createPortal(
    <div className="exam-debrief-overlay">
      <div
        className="exam-debrief-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-debrief-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="exam-debrief-bar">
          <h2 className="exam-debrief-title" id="exam-debrief-title">
            {exam.label
              ? t('examDebrief.headingNamed', '{{exam}} exam', { exam: exam.label })
              : t('examDebrief.heading', 'Your exam')}
          </h2>
          <button
            type="button"
            className="exam-debrief-close"
            onClick={leave}
            aria-label={t('examDebrief.close', 'Close')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div
          className="exam-debrief-feed"
          ref={feedRef}
          role="log"
          aria-live="polite"
        >
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`exam-debrief-msg exam-debrief-msg--${message.role}`}
            >
              {message.content}
            </div>
          ))}

          {isThinking && (
            <div
              className="exam-debrief-msg exam-debrief-msg--assistant exam-debrief-typing"
              aria-label={t('examDebrief.typing', 'Typing')}
            >
              <span /><span /><span />
            </div>
          )}

          {!hasSpoken && !isThinking && (
            <div className="exam-debrief-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="exam-debrief-suggestion"
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {isDone ? (
          <div className="exam-debrief-footer">
            <button type="button" className="exam-debrief-send" onClick={onClose}>
              {t('examDebrief.done', 'Close')}
            </button>
          </div>
        ) : (
          <div className="exam-debrief-composer">
            <textarea
              ref={inputRef}
              className="exam-debrief-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('examDebrief.placeholder', 'Tell us how it went…')}
              maxLength={MAX_MESSAGE_CHARS}
              rows={1}
              disabled={!canType}
            />
            <button
              type="button"
              className="exam-debrief-send exam-debrief-send--icon"
              onClick={() => send(draft)}
              disabled={!canType || !draft.trim()}
              aria-label={t('examDebrief.send', 'Send')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ExamDebriefModal;
