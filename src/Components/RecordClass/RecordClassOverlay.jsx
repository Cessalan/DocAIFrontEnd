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
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Waveform = ({ level, active }) => {
  const bars = 32;
  return (
    <div className={`rc-waveform ${active ? 'is-active' : 'is-idle'}`}>
      {Array.from({ length: bars }).map((_, i) => {
        const center = (bars - 1) / 2;
        const distance = Math.abs(i - center) / center;
        const baseHeight = (1 - distance * 0.6) * 100;
        const scaled = active ? Math.max(8, baseHeight * (0.2 + level * 1.8)) : 8;
        return (
          <span
            key={i}
            className="rc-waveform__bar"
            style={{
              height: `${Math.min(100, scaled)}%`,
              animationDelay: `${i * 40}ms`,
            }}
          />
        );
      })}
    </div>
  );
};

const IdleScreen = ({ onStart, error }) => (
  <div className="rc-screen rc-screen--idle">
    <div className="rc-mic-circle">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </div>
    <h2 className="rc-title">Record a class</h2>
    <p className="rc-subtitle">
      We&apos;ll transcribe your lecture and open a chat where you can ask questions about it.
    </p>
    <div className="rc-disclosure">
      <span className="rc-disclosure__dot" />
      Audio is sent to OpenAI Whisper for transcription, then deleted.
    </div>
    {error && <div className="rc-error">{error}</div>}
    <button className="rc-btn rc-btn--primary rc-btn--lg" onClick={onStart}>
      Start recording
    </button>
    <p className="rc-hint">Tip: keep this tab open for the full lecture.</p>
  </div>
);

const RecordingScreen = ({
  elapsedMs,
  bytesRecorded,
  audioLevel,
  isPaused,
  onPause,
  onResume,
  onStop,
  onMinimize,
}) => (
  <div className="rc-screen rc-screen--recording">
    <div className="rc-status-row">
      <span className={`rc-rec-dot ${isPaused ? 'is-paused' : ''}`} />
      <span className="rc-status-label">
        {isPaused ? 'Paused' : 'Recording'}
      </span>
    </div>

    <div className="rc-timer">{formatTime(elapsedMs)}</div>

    <Waveform level={audioLevel} active={!isPaused} />

    <div className="rc-controls">
      {isPaused ? (
        <button className="rc-btn rc-btn--secondary" onClick={onResume}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Resume
        </button>
      ) : (
        <button className="rc-btn rc-btn--secondary" onClick={onPause}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
          Pause
        </button>
      )}
      <button className="rc-btn rc-btn--primary" onClick={onStop}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
        Stop &amp; transcribe
      </button>
    </div>

    <div className="rc-meta-row">
      <span>{formatBytes(bytesRecorded)} recorded</span>
      <span className="rc-meta-sep">·</span>
      <button className="rc-link" onClick={onMinimize}>Minimize</button>
    </div>
  </div>
);

const TX_LABELS = {
  uploading: 'Uploading audio…',
  transcribing: 'Transcribing with Whisper…',
  finalizing: 'Generating title…',
};

const ReviewScreen = ({
  txStatus,
  TX_STATUS,
  txError,
  elapsedMs,
  bytesRecorded,
  resultTitle,
  resultPreview,
  onOpenChat,
  onDiscard,
  onRetry,
}) => {
  const isReady = txStatus === TX_STATUS.READY;
  const isError = txStatus === TX_STATUS.ERROR;
  const isWorking = !isReady && !isError;

  return (
    <div className="rc-screen rc-screen--review">
      {isWorking && (
        <div className="rc-working">
          <div className="rc-shimmer-text" key={txStatus}>
            {TX_LABELS[txStatus] || 'Processing…'}
          </div>
        </div>
      )}

      {isError && (
        <>
          <div className="rc-error-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h2 className="rc-title rc-title--sm">Transcription failed</h2>
          <div className="rc-error">{txError || 'Something went wrong.'}</div>
        </>
      )}

      {isReady && (
        <>
          <div className="rc-check">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="rc-result-title">{resultTitle || 'Recorded lecture'}</div>
          {resultPreview && (
            <div className="rc-transcript-preview">
              &ldquo;{resultPreview}&rdquo;
            </div>
          )}
        </>
      )}

      <div className="rc-review-meta">
        <span>{formatTime(elapsedMs)}</span>
        <span className="rc-meta-sep">·</span>
        <span>{formatBytes(bytesRecorded)}</span>
      </div>

      {isReady && (
        <button className="rc-btn rc-btn--primary rc-btn--lg rc-btn--block" onClick={onOpenChat}>
          Open chat
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6 }}>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      )}

      {isError && (
        <div className="rc-controls">
          <button className="rc-btn rc-btn--secondary" onClick={onDiscard}>Discard</button>
          <button className="rc-btn rc-btn--primary" onClick={onRetry}>Retry</button>
        </div>
      )}

      {isReady && (
        <button className="rc-link rc-link--danger" onClick={onDiscard}>
          Discard recording
        </button>
      )}
    </div>
  );
};

const RecordClassOverlay = () => {
  const {
    STATUS,
    TX_STATUS,
    status,
    txStatus,
    txError,
    isOverlayOpen,
    elapsedMs,
    bytesRecorded,
    audioLevel,
    audioBlob,
    resultTitle,
    resultPreview,
    error,
    minimize,
    reset,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    openResultChat,
    discardResult,
    processRecording,
  } = useRecordClass();

  if (!isOverlayOpen) return null;

  const isRecordingOrPaused = status === STATUS.RECORDING || status === STATUS.PAUSED;
  const isReviewing = status === STATUS.REVIEWING;
  const isReadyOrError = txStatus === TX_STATUS.READY || txStatus === TX_STATUS.ERROR;

  const handleClose = () => {
    if (isRecordingOrPaused) {
      minimize();
    } else if (isReviewing && isReadyOrError) {
      const confirmed = window.confirm('Close without opening the chat? Your transcript is saved.');
      if (confirmed) reset();
    } else if (isReviewing) {
      // Transcription in flight — discourage closing
      const confirmed = window.confirm('Transcription is in progress. Cancel anyway?');
      if (confirmed) discardResult();
    } else {
      reset();
    }
  };

  const handleRetry = () => {
    if (audioBlob) processRecording(audioBlob);
  };

  return (
    <div className="rc-overlay" role="dialog" aria-modal="true" aria-label="Record a class">
      <div className="rc-overlay__backdrop" onClick={handleClose} />
      <div className="rc-overlay__panel">
        <button
          className="rc-close"
          onClick={handleClose}
          aria-label={isRecordingOrPaused ? 'Minimize' : 'Close'}
        >
          {isRecordingOrPaused ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </button>

        {(status === STATUS.IDLE || status === STATUS.REQUESTING) && (
          <IdleScreen onStart={startRecording} error={error} />
        )}

        {isRecordingOrPaused && (
          <RecordingScreen
            elapsedMs={elapsedMs}
            bytesRecorded={bytesRecorded}
            audioLevel={audioLevel}
            isPaused={status === STATUS.PAUSED}
            onPause={pauseRecording}
            onResume={resumeRecording}
            onStop={stopRecording}
            onMinimize={minimize}
          />
        )}

        {isReviewing && (
          <ReviewScreen
            txStatus={txStatus}
            TX_STATUS={TX_STATUS}
            txError={txError}
            elapsedMs={elapsedMs}
            bytesRecorded={bytesRecorded}
            resultTitle={resultTitle}
            resultPreview={resultPreview}
            onOpenChat={openResultChat}
            onDiscard={discardResult}
            onRetry={handleRetry}
          />
        )}
      </div>
    </div>
  );
};

export default RecordClassOverlay;
