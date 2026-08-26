import React from 'react';
import { useTranslation } from 'react-i18next';
import './CheckUnderstandingCard.css';

/**
 * CheckUnderstandingCard
 *
 * Replaces the raw prompt bubble at the start of a "Check my understanding"
 * session.
 *
 * Before this, clicking the chip posted the literal instruction we send the
 * model ("Ask me to explain X in my own words...") as if the student had typed
 * it. That exposes the machinery and makes the product read as a chatbot
 * someone is puppeting. The prompt still goes to the backend — it's just
 * marked hidden — and this card stands in its place.
 *
 * The progress counter is DERIVED from position in the message list rather
 * than stored: `current` is computed by the caller from how many replies the
 * student has sent since the card. Nothing to keep in sync, nothing to
 * migrate, and it survives a reload for free.
 *
 * @param {string[]} topics  Concepts pulled from the upload.
 * @param {number} current   1-based concept the student is on.
 * @param {number} total     How many concepts this session covers.
 */
const CheckUnderstandingCard = ({ topics = [], current = 1, total = 0 }) => {
  const { t } = useTranslation();

  const count = total || topics.length || 0;
  // Never show "3 of 2" if the conversation runs longer than the concept list.
  const step = count ? Math.min(current, count) : current;
  const pct = count ? Math.round((step / count) * 100) : 0;
  const isDone = count > 0 && step >= count;

  return (
    <div className="check-understanding-card">
      <div className="cuc-head">
        <span className="cuc-badge">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M21 12a8 8 0 01-8 8H8l-4 3v-5.2A8 8 0 0113 4a8 8 0 018 8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M9 12l2.5 2.5L16 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t('checkme.title', 'Checking your understanding')}
        </span>

        {count > 0 && (
          <span className="cuc-counter">
            {isDone
              ? t('checkme.allCovered', 'All {{total}} covered', { total: count })
              : t('checkme.stepOf', 'Concept {{current}} of {{total}}', {
                  current: step,
                  total: count
                })}
          </span>
        )}
      </div>

      {count > 0 && (
        <div
          className="cuc-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={count}
          aria-valuenow={step}
        >
          <div className="cuc-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {topics.length > 0 && (
        <div className="cuc-topics">
          {topics.map((topic, i) => (
            <span
              key={`${topic}-${i}`}
              className={[
                'cuc-topic',
                i < step - 1 ? 'is-done' : '',
                i === step - 1 ? 'is-current' : ''
              ].filter(Boolean).join(' ')}
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CheckUnderstandingCard;
