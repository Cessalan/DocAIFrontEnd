import React, { useEffect, useMemo, useState } from 'react';
import './WelcomeBackToast.css';

const EXIT_ANIM_MS = 320;

// Splits `message` at the first occurrence of `accent` and wraps that
// substring in a styled span. If `accent` is falsy or not found, returns
// the message unchanged. Keeps the rendered output as a single flowing
// sentence — no headers, no metadata, no numbers.
function renderHighlighted(message, accent) {
  if (!message) return null;
  if (!accent) return message;
  const idx = message.indexOf(accent);
  if (idx === -1) return message;
  return (
    <>
      {message.slice(0, idx)}
      <span className="welcome-back-toast-accent">{accent}</span>
      {message.slice(idx + accent.length)}
    </>
  );
}

const WelcomeBackToast = ({
  message,
  accent,
  onDismiss,
  durationMs = 5000,
  belowStudyHeader = false
}) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const autoTimer = setTimeout(() => setIsLeaving(true), durationMs);
    return () => clearTimeout(autoTimer);
  }, [durationMs]);

  useEffect(() => {
    if (!isLeaving) return;
    const exitTimer = setTimeout(() => onDismiss?.(), EXIT_ANIM_MS);
    return () => clearTimeout(exitTimer);
  }, [isLeaving, onDismiss]);

  const content = useMemo(() => renderHighlighted(message, accent), [message, accent]);

  return (
    <div
      className={[
        'welcome-back-toast',
        belowStudyHeader ? 'below-study-header' : '',
        isEntered ? 'is-entered' : '',
        isLeaving ? 'is-leaving' : ''
      ].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      <div className="welcome-back-toast-card">
        <span className="welcome-back-toast-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              d="M12 20.5s-7.2-4.35-9.6-9.05a5.2 5.2 0 0 1 8.4-6.06l1.2 1.3 1.2-1.3a5.2 5.2 0 0 1 8.4 6.06C19.2 16.15 12 20.5 12 20.5z"
              fill="currentColor"
            />
          </svg>
        </span>
        <p className="welcome-back-toast-message">{content}</p>
        <button
          type="button"
          className="welcome-back-toast-close"
          onClick={() => setIsLeaving(true)}
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3 3 L11 11 M11 3 L3 11"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default WelcomeBackToast;
