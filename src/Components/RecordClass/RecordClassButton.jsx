import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRecordClass } from './RecordClassContext';

const RecordClassButton = () => {
  const { t } = useTranslation();
  const { status, STATUS, openOverlay, expand, elapsedMs } = useRecordClass();

  const isActive = status === STATUS.RECORDING || status === STATUS.PAUSED;

  const handleClick = () => {
    if (isActive) {
      expand();
    } else {
      openOverlay();
    }
  };

  const formatTime = (ms) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <button
      type="button"
      className={`record-class-btn ${isActive ? 'is-active' : ''}`}
      onClick={handleClick}
      title={isActive ? t('chat.recordBtnActiveTitle') : t('chat.recordBtnIdleTitle')}
    >
      <span className="record-class-btn__icon" aria-hidden="true">
        {isActive ? (
          <span className="record-class-btn__pulse" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="7" r="3" />
            <path d="M2 21v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
            <path d="M15 9a3 3 0 0 1 0 4" />
            <path d="M17.5 7a6.5 6.5 0 0 1 0 8" />
          </svg>
        )}
      </span>
      <span className="record-class-btn__label">
        {isActive ? t('chat.recordBtnActive') : t('chat.recordBtnIdle')}
      </span>
      {isActive && (
        <span className="record-class-btn__time">{formatTime(elapsedMs)}</span>
      )}
    </button>
  );
};

export default RecordClassButton;
