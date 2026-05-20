import React from 'react';
import { useRecordClass } from './RecordClassContext';

const formatTime = (ms) => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const RecordClassMinimizedPill = () => {
  const { STATUS, status, isMinimized, elapsedMs, expand, stopRecording } = useRecordClass();

  const isLive = status === STATUS.RECORDING || status === STATUS.PAUSED;
  if (!isMinimized || !isLive) return null;

  const isPaused = status === STATUS.PAUSED;

  return (
    <div className="rc-pill" role="status" aria-live="polite">
      <button className="rc-pill__main" onClick={expand} title="Expand recording">
        <span className={`rc-pill__dot ${isPaused ? 'is-paused' : ''}`} />
        <span className="rc-pill__label">{isPaused ? 'Paused' : 'Recording'}</span>
        <span className="rc-pill__time">{formatTime(elapsedMs)}</span>
      </button>
      <button className="rc-pill__stop" onClick={stopRecording} aria-label="Stop recording" title="Stop">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
    </div>
  );
};

export default RecordClassMinimizedPill;
