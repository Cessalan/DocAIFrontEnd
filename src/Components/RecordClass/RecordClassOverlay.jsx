import React from 'react';
import { useTranslation } from 'react-i18next';
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

const IdleScreen = ({ onStart, error, attachToChatId, audioSource, setAudioSource }) => {
  const { t } = useTranslation();
  const [topic, setTopic] = React.useState('');
  const isAttachingToChat = Boolean(attachToChatId);
  const isDevice = audioSource === 'device';
  // macOS doesn't expose system audio via getDisplayMedia (browser/OS
  // limitation), so capturing audio from desktop apps like the Zoom
  // client won't work — only tab audio. We warn Mac users explicitly.
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  const handleStart = () => {
    onStart(topic.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleStart();
    }
  };

  return (
    <div className="rc-screen rc-screen--idle">
      <div className="rc-mic-circle">
        {/* Audio waveform — unique to this overlay so it doesn't repeat the
            chat input's mic (voice-input) or the empty-state card's person
            icon. Reads as "live audio capture" at a glance. */}
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="11" x2="4" y2="13" />
          <line x1="8" y1="9" x2="8" y2="15" />
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="16" y1="8" x2="16" y2="16" />
          <line x1="20" y1="10.5" x2="20" y2="13.5" />
        </svg>
      </div>
      <h2 className="rc-title">
        {isAttachingToChat ? t('chat.recordTitleAttached') : t('chat.recordTitle')}
      </h2>

      {!isAttachingToChat && (
        <input
          type="text"
          placeholder={t('chat.recordTopicPlaceholder')}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          className="rc-topic-input rc-topic-input--large"
        />
      )}

      {/* Class type picker. "In-person" uses the mic; "Virtual" pulls
          audio straight from the tab/window the user picks (Zoom, a
          recorded lecture, a podcast, etc.). */}
      <div className="rc-source-picker" role="radiogroup" aria-label={t('chat.recordClassTypeInPerson')}>
        <button
          type="button"
          role="radio"
          aria-checked={!isDevice}
          className={`rc-source-option ${!isDevice ? 'is-selected' : ''}`}
          onClick={() => setAudioSource('mic')}
        >
          {/* Two people — represents a room with classmates */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="8" r="3" />
            <path d="M2 21v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
            <circle cx="17" cy="8" r="2.5" />
            <path d="M15 15h1.5a4 4 0 0 1 3.5 5.5" />
          </svg>
          <span>{t('chat.recordClassTypeInPerson')}</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isDevice}
          className={`rc-source-option ${isDevice ? 'is-selected' : ''}`}
          onClick={() => setAudioSource('device')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="13" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>{t('chat.recordClassTypeVirtual')}</span>
        </button>
      </div>

      <p className="rc-subtitle">
        {isDevice
          ? t('chat.recordSubtitleVirtual')
          : isAttachingToChat
            ? t('chat.recordSubtitleAttached')
            : t('chat.recordSubtitleNewChat')}
      </p>

      {isDevice && (
        <div className="rc-compat" aria-label={t('chat.recordCompatWorks')}>
          <section className="rc-compat__section rc-compat__section--yes">
            <header className="rc-compat__header">
              <span className="rc-compat__dot" aria-hidden="true" />
              <span className="rc-compat__label">{t('chat.recordCompatWorks')}</span>
            </header>
            <ul className="rc-compat__list">
              <li>{t('chat.recordCompatTabs')} <span className="rc-compat__sub">{t('chat.recordCompatTabsDetail')}</span></li>
              <li>{t('chat.recordCompatWindows')} <span className="rc-compat__sub">{t('chat.recordCompatWindowsDetail')}</span></li>
            </ul>
          </section>
          <section className="rc-compat__section rc-compat__section--no">
            <header className="rc-compat__header">
              <span className="rc-compat__dot" aria-hidden="true" />
              <span className="rc-compat__label">{t('chat.recordCompatWontWork')}</span>
            </header>
            <ul className="rc-compat__list">
              <li>{t('chat.recordCompatMacApps')} <span className="rc-compat__sub">{t('chat.recordCompatMacAppsDetail')}</span></li>
              <li>{t('chat.recordCompatBrowsers')} <span className="rc-compat__sub">{t('chat.recordCompatBrowsersDetail')}</span></li>
            </ul>
          </section>
        </div>
      )}

      {error && <div className="rc-error">{error}</div>}
      <button className="rc-btn rc-btn--primary rc-btn--lg" onClick={handleStart}>
        {t('chat.recordStart')}
      </button>
      <p className="rc-hint">
        {isDevice ? t('chat.recordHintDevice') : t('chat.recordHintMic')}
      </p>
    </div>
  );
};

const RecordingScreen = ({
  topic,
  elapsedMs,
  bytesRecorded,
  audioLevel,
  isPaused,
  onPause,
  onResume,
  onStop,
  onMinimize,
  liveKeyPoints,
  onFlagConfusion,
  onMarkImportant,
}) => {
  const { t } = useTranslation();
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveKeyPoints]);

  return (
    <div className="rc-screen rc-screen--recording">
      <div className="rc-status-row">
        <span className={`rc-rec-dot ${isPaused ? 'is-paused' : ''}`} />
        <span className="rc-status-label">
          {t('chat.recordingLabel')} · {topic || t('chat.recordLectureDefault')}
        </span>
      </div>

      <div className="rc-timer">{formatTime(elapsedMs)}</div>

      <Waveform level={audioLevel} active={!isPaused} />

      <hr className="rc-divider" />

      <div className="rc-live-keypoints-container">
        <div className="rc-live-keypoints-title">{t('chat.recordLiveKeyPoints')}</div>
        <div className="rc-live-keypoints-list" ref={scrollRef}>
          {liveKeyPoints.length === 0 ? (
            <div className="rc-placeholder-text">{t('chat.recordListeningPlaceholder')}</div>
          ) : (
            liveKeyPoints.map((item, idx) => {
              if (typeof item === 'object' && item.isEvent) {
                const isImportant = item.type === 'important';
                return (
                  <div
                    key={idx}
                    className={`rc-live-keypoint-item is-event ${
                      isImportant ? 'is-important' : 'is-confusion'
                    }`}
                  >
                    {item.text}
                  </div>
                );
              }
              return (
                <div key={idx} className="rc-live-keypoint-item">
                  {item}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rc-mark-btns">
        <button
          type="button"
          className="rc-mark-btn rc-mark-btn--confusion"
          onClick={onFlagConfusion}
          disabled={isPaused}
          title={t('chat.recordFlagConfusionTitle')}
        >
          {t('chat.recordFlagConfusion')}
        </button>
        <button
          type="button"
          className="rc-mark-btn rc-mark-btn--important"
          onClick={onMarkImportant}
          disabled={isPaused}
          title={t('chat.recordImportantTitle')}
        >
          {t('chat.recordImportant')}
        </button>
      </div>

      <hr className="rc-divider" />

      <div className="rc-controls">
        {isPaused ? (
          <button className="rc-btn rc-btn--secondary" onClick={onResume}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            {t('chat.recordResume')}
          </button>
        ) : (
          <button className="rc-btn rc-btn--secondary" onClick={onPause}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
            {t('chat.recordPause')}
          </button>
        )}
        <button className="rc-btn rc-btn--primary" onClick={onStop}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
          {t('chat.recordFinish')}
        </button>
      </div>

      <div className="rc-meta-row">
        <span>{t('chat.recordRecorded', { size: formatBytes(bytesRecorded) })}</span>
        <span className="rc-meta-sep">·</span>
        <button className="rc-link" onClick={onMinimize}>{t('chat.recordMinimize')}</button>
      </div>
    </div>
  );
};

// Map a TxStatus to its i18n key. The actual translated string is resolved
// inside the component (so we react to language switches).
const TX_LABEL_KEYS = {
  uploading: 'chat.recordTxSaving',
  transcribing: 'chat.recordTxTranscribing',
  finalizing: 'chat.recordTxFinalizing',
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
  attachedToExistingChat,
}) => {
  const { t } = useTranslation();
  const isReady = txStatus === TX_STATUS.READY;
  const isError = txStatus === TX_STATUS.ERROR;
  const isWorking = !isReady && !isError;

  return (
    <div className="rc-screen rc-screen--review">
      {isWorking && (
        <div className="rc-working">
          <div className="rc-shimmer-text" key={txStatus}>
            {TX_LABEL_KEYS[txStatus] ? t(TX_LABEL_KEYS[txStatus]) : t('chat.recordTxProcessing')}
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
          <h2 className="rc-title rc-title--sm">{t('chat.recordErrorTitle')}</h2>
          <div className="rc-error">{txError || t('chat.recordErrorGeneric')}</div>
        </>
      )}

      {isReady && (
        <>
          <div className="rc-check">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="rc-result-title">{resultTitle || t('chat.recordedLectureDefault')}</div>
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
          {attachedToExistingChat ? t('chat.recordDone') : t('chat.recordOpenChat')}
          {!attachedToExistingChat && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6 }}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          )}
        </button>
      )}

      {isError && (
        <div className="rc-controls">
          <button className="rc-btn rc-btn--secondary" onClick={onDiscard}>{t('chat.recordDiscardBtn')}</button>
          <button className="rc-btn rc-btn--primary" onClick={onRetry}>{t('chat.recordRetry')}</button>
        </div>
      )}

      {isReady && (
        <button className="rc-link rc-link--danger" onClick={onDiscard}>
          {t('chat.recordDiscardLink')}
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
    topic,
    liveKeyPoints,
    minimize,
    reset,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    openResultChat,
    discardResult,
    addEvent,
    processRecording,
    attachToChatId,
    audioSource,
    setAudioSource,
  } = useRecordClass();
  const { t } = useTranslation();

  if (!isOverlayOpen) return null;

  const isRecordingOrPaused = status === STATUS.RECORDING || status === STATUS.PAUSED;
  const isReviewing = status === STATUS.REVIEWING;
  const isReadyOrError = txStatus === TX_STATUS.READY || txStatus === TX_STATUS.ERROR;

  const handleClose = () => {
    if (isRecordingOrPaused) {
      minimize();
    } else if (isReviewing && isReadyOrError) {
      const confirmed = window.confirm(t('chat.recordConfirmCloseReady'));
      if (confirmed) reset();
    } else if (isReviewing) {
      const confirmed = window.confirm(t('chat.recordConfirmCancelInProgress'));
      if (confirmed) discardResult();
    } else {
      reset();
    }
  };

  const handleRetry = () => {
    if (audioBlob) processRecording(audioBlob);
  };

  return (
    <div className="rc-overlay" role="dialog" aria-modal="true" aria-label={t('chat.recordTitle')}>
      <div className="rc-overlay__backdrop" onClick={handleClose} />
      <div className="rc-overlay__panel">
        <button
          className="rc-close"
          onClick={handleClose}
          aria-label={isRecordingOrPaused ? t('chat.recordMinimizeLabel') : t('chat.recordCloseLabel')}
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
          <IdleScreen
            onStart={startRecording}
            error={error}
            attachToChatId={attachToChatId}
            audioSource={audioSource}
            setAudioSource={setAudioSource}
          />
        )}

        {isRecordingOrPaused && (
          <RecordingScreen
            topic={topic}
            elapsedMs={elapsedMs}
            bytesRecorded={bytesRecorded}
            audioLevel={audioLevel}
            isPaused={status === STATUS.PAUSED}
            onPause={pauseRecording}
            onResume={resumeRecording}
            onStop={stopRecording}
            onMinimize={minimize}
            liveKeyPoints={liveKeyPoints}
            onFlagConfusion={() => addEvent('confusion')}
            onMarkImportant={() => addEvent('important')}
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
            attachedToExistingChat={Boolean(attachToChatId)}
          />
        )}
      </div>
    </div>
  );
};

export default RecordClassOverlay;
