import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { rateChatAnswer, SENTIMENT } from '../../Services/SatisfactionService';
import ShareFeedbackModal from './ShareFeedbackModal';

/**
 * MessageRating — thumbs on an AI answer.
 *
 * WHY THIS EXISTS
 *
 * Chat answers were the one surface collecting nothing. Quizzes and flashcards
 * at least had a rating popover; the answers those quizzes are generated from
 * had Copy and Rewrite and no way to say "this was wrong". Everything known
 * about answer quality was inferred from dwell time, which measures whether
 * something was read, not whether it was any good.
 *
 * DESIGN NOTES
 *
 *  - The thumbs are always visible, not hover-revealed. A control you have to
 *    discover is one most people never find — the same reason the quiz 💬
 *    popover collects so little.
 *
 *  - 👍 is one tap and finished. Asking a happy student to categorise their
 *    happiness adds friction to the case that needed no intervention, and the
 *    answer is rarely actionable.
 *
 *  - 👎 records the sentiment IMMEDIATELY, then opens ShareFeedbackModal. The
 *    detail is a refinement of a row that already exists, so a student who
 *    closes the modal — the common case — still leaves a counted negative. A
 *    modal that only wrote on submit would discard every abandoned one.
 *
 *  - Reasons live in the modal, multi-select, beside a free-text box. The first
 *    version offered four inline chips and nothing else, which meant a
 *    complaint we hadn't guessed got recorded as whichever guess sat closest.
 *    That is worse than no reason, because it still looks like data.
 *
 * @param {string}   chatId
 * @param {Object}   message   The AI message being rated.
 * @param {Function} onRated   Notifies the parent so transcript state stays true.
 */

// Slugs are stored; labels are translated at render. Tailored to the failure
// modes that route somewhere: "Not what I asked for" points at intent routing,
// "Not exam-style" at NCLEX formatting, "Too long" at answer discipline.
export const ANSWER_FEEDBACK_REASONS = [
  { id: 'incorrect', key: 'chat.ratingReasonIncorrect', fallback: 'Incorrect or incomplete' },
  { id: 'not_what_i_asked', key: 'chat.ratingReasonNotAsked', fallback: 'Not what I asked for' },
  { id: 'confusing', key: 'chat.ratingReasonConfusing', fallback: 'Confusing explanation' },
  { id: 'not_exam_style', key: 'chat.ratingReasonNotExamStyle', fallback: 'Not exam-style' },
  { id: 'too_long', key: 'chat.ratingReasonTooLong', fallback: 'Too long' },
  { id: 'slow_or_buggy', key: 'chat.ratingReasonSlowBuggy', fallback: 'Slow or buggy' },
  { id: 'other', key: 'chat.ratingReasonOther', fallback: 'Other' }
];

const THANKS_MS = 2600;

function ThumbUpIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <path d="M7 10l4.2-7.4a1 1 0 0 1 1.8.2l.3 1a4 4 0 0 1-.2 2.8L12 9h5.6a2 2 0 0 1 2 2.5l-1.7 7A2 2 0 0 1 16 20H7" />
    </svg>
  );
}

function ThumbDownIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1z" />
      <path d="M17 14l-4.2 7.4a1 1 0 0 1-1.8-.2l-.3-1a4 4 0 0 1 .2-2.8L12 15H6.4a2 2 0 0 1-2-2.5l1.7-7A2 2 0 0 1 8 4h9" />
    </svg>
  );
}

const MessageRating = ({ chatId, message, onRated }) => {
  const { t, i18n } = useTranslation();

  // A rating already on the message means this answer was rated in an earlier
  // session — restore it rather than asking again.
  const existing = message?.rating || null;

  const [sentiment, setSentiment] = useState(existing?.sentiment ?? null);
  // The modal opens only for a thumbs-down taken in this session. A restored
  // negative doesn't re-open it; that question was already asked.
  const [modalOpen, setModalOpen] = useState(false);
  const [thanks, setThanks] = useState(false);

  // Refs, not state: the modal can be submitted before the thumb's write has
  // come back, and a stale closure over a state value would send
  // signalId: null and insert a SECOND row — the exact double-count the refine
  // pass exists to avoid. `pendingRef` holds the in-flight write so a fast
  // submit can wait for its id instead of racing it.
  const signalRef = useRef(null);
  const pendingRef = useRef(null);
  const thanksTimer = useRef(null);

  useEffect(() => () => clearTimeout(thanksTimer.current), []);

  const showThanks = useCallback(() => {
    setThanks(true);
    clearTimeout(thanksTimer.current);
    thanksTimer.current = setTimeout(() => setThanks(false), THANKS_MS);
  }, []);

  const handleThumb = useCallback(async (value) => {
    const isNegative = value === SENTIMENT.NEGATIVE;

    // Re-tapping the active thumb is not an un-rate — the signal is already
    // counted, and silently deleting it would make the measurement depend on
    // tap parity. A repeat 👎 reopens the modal instead, so someone who closed
    // it by accident can still say what went wrong.
    if (sentiment === value) {
      if (isNegative) setModalOpen(true);
      return;
    }

    setSentiment(value);
    if (isNegative) setModalOpen(true);
    else showThanks();

    if (onRated) onRated(message.id, { sentiment: value, reasons: [] });

    signalRef.current = null;
    const pending = rateChatAnswer({
      chatId,
      message,
      sentiment: value,
      locale: i18n.language
    });
    pendingRef.current = pending;

    const result = await pending;
    if (result?.signalId) signalRef.current = result.signalId;
  }, [sentiment, chatId, message, onRated, showThanks, i18n.language]);

  const handleDetails = useCallback(async ({ reasons, comment }) => {
    showThanks();

    if (onRated) onRated(message.id, { sentiment: SENTIMENT.NEGATIVE, reasons });

    // Settle the thumb's write first if it hasn't landed yet, so this refines
    // that row rather than racing it. If it failed outright signalRef stays
    // null and this inserts instead — a duplicate row beats a lost report.
    if (!signalRef.current && pendingRef.current) {
      const first = await pendingRef.current;
      if (first?.signalId) signalRef.current = first.signalId;
    }

    await rateChatAnswer({
      chatId,
      message,
      sentiment: SENTIMENT.NEGATIVE,
      reasons,
      comment,
      signalId: signalRef.current,
      locale: i18n.language
    });
  }, [chatId, message, onRated, showThanks, i18n.language]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const isPositive = sentiment === SENTIMENT.POSITIVE;
  const isNegative = sentiment === SENTIMENT.NEGATIVE;

  return (
    <>
      <div className="message-rating" role="group" aria-label={t('chat.ratingGroupAria', 'Rate this answer')}>
        <button
          type="button"
          className={`message-rating-btn ${isPositive ? 'is-active is-positive' : ''}`}
          onClick={() => handleThumb(SENTIMENT.POSITIVE)}
          aria-pressed={isPositive}
          aria-label={t('chat.ratingHelpfulAria', 'Helpful')}
          title={t('chat.ratingHelpful', 'Helpful')}
        >
          <ThumbUpIcon filled={isPositive} />
        </button>

        <button
          type="button"
          className={`message-rating-btn ${isNegative ? 'is-active is-negative' : ''}`}
          onClick={() => handleThumb(SENTIMENT.NEGATIVE)}
          aria-pressed={isNegative}
          aria-label={t('chat.ratingNotHelpfulAria', 'Not helpful')}
          title={t('chat.ratingNotHelpful', 'Not helpful')}
        >
          <ThumbDownIcon filled={isNegative} />
        </button>

        {thanks && (
          <span className="message-rating-thanks" role="status">
            {t('chat.ratingThanks', 'Thanks — noted')}
          </span>
        )}
      </div>

      <ShareFeedbackModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSubmit={handleDetails}
        reasons={ANSWER_FEEDBACK_REASONS}
      />
    </>
  );
};

export default MessageRating;
