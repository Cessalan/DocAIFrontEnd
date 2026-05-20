import React from 'react';
import { useRecordClass } from './RecordClassContext';

const RecordClassButton = () => {
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
      title={isActive ? 'Recording in progress' : 'Record a class'}
    >
      <span className="record-class-btn__icon" aria-hidden="true">
        {isActive ? (
          <span className="record-class-btn__pulse" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </span>
      <span className="record-class-btn__label">
        {isActive ? 'Recording' : 'Record a class'}
      </span>
      {isActive && (
        <span className="record-class-btn__time">{formatTime(elapsedMs)}</span>
      )}
    </button>
  );
};

export default RecordClassButton;
