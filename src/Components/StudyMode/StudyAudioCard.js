import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ChatAudioPlayer from '../ChatInerface/ChatAudioPlayer';

/**
 * StudyAudioCard - Audio lesson in study mode
 * Reuses existing ChatAudioPlayer component
 *
 * @param {Object} content - Audio content { topic, intent, suggestedDuration, audioBase64, firebaseUrl }
 * @param {boolean} isGenerating - Whether audio is currently being generated
 * @param {string} generatingMessage - Message to show during generation
 * @param {Function} onGenerateAudio - Callback to trigger audio generation
 * @param {Function} onContinue - Callback when user is ready to continue
 */
const StudyAudioCard = ({
  content,
  isGenerating = false,
  generatingMessage = '',
  onGenerateAudio,
  onContinue,
  onExit,
  // Fired once when playback actually starts. Node status tells us a student
  // advanced past this lesson; it does NOT tell us whether they listened to
  // it. Optional — omit to record nothing.
  onFirstPlay
}) => {
  const { t } = useTranslation();
  const [hasListened, setHasListened] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  // Use ref to prevent duplicate calls (survives re-renders)
  const isGeneratingRef = useRef(false);

  const { topic, intent, suggestedDuration, audioBase64, firebaseUrl } = content || {};

  // Check if audio is already cached (from a previous visit). If so, we
  // skip the intro entirely and go straight to the player.
  const hasCachedAudio = !!(audioBase64 || firebaseUrl);

  // Check if audio is ready
  useEffect(() => {
    if (audioBase64 || firebaseUrl) {
      setAudioReady(true);
    }
  }, [audioBase64, firebaseUrl]);

  // Audio icon
  const AudioIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );

  // Arrow right icon
  const ArrowRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );

  // Tracks whether the user has explicitly chosen to listen. Generation is
  // gated on this flag so users who want to skip the audio (e.g. they're
  // listening to music, or just don't care for audio) never trigger the
  // expensive backend TTS pipeline. Token cost stays at zero for skippers.
  const [hasAttempted, setHasAttempted] = useState(false);

  // Reset ref when audio is ready or on unmount
  useEffect(() => {
    if (audioReady) {
      isGeneratingRef.current = false;
    }
    return () => {
      isGeneratingRef.current = false;
    };
  }, [audioReady]);

  // User clicked "Listen" — kick off backend audio generation. Same payload
  // shape as the previous auto-trigger.
  const handleListen = () => {
    if (isGeneratingRef.current || isGenerating || !onGenerateAudio || !topic) return;
    setHasAttempted(true);
    isGeneratingRef.current = true;
    onGenerateAudio({
      topic,
      intent: intent || 'teach',
      duration: suggestedDuration || 2
    });
  };

  // User clicked "Skip" — advance to the next study node without ever
  // calling the backend. We pass `{ skipped: true }` to onContinue so the
  // parent's transition screen shows "You skipped…" instead of the default
  // "You listened to…" copy. This is the entire point of the intro screen.
  const handleSkip = () => {
    if (onContinue) onContinue({ skipped: true });
  };

  // Mark as listened when audio ends and auto-advance
  const handleAudioEnd = () => {
    setHasListened(true);
    if (onContinue) onContinue();
  };

  // Format the suggested duration as a friendly "~Xmin" hint when present.
  const durationLabel = (() => {
    if (!suggestedDuration) return null;
    const rounded = Math.max(1, Math.round(suggestedDuration));
    return t('study.audioIntroDuration', '~{{duration}} min listen', { duration: rounded });
  })();

  // Decide whether to show the intro choice screen. Three conditions all
  // need to hold: no cached audio, no generation in flight, and the user
  // hasn't already clicked Listen this session. If they HAVE clicked
  // Listen but generation failed, the existing failure-with-retry state
  // takes over instead.
  const showIntro = !hasCachedAudio && !isGenerating && !hasAttempted;

  return (
    <div className="study-step-card">
      <div className="study-card-header">
        <div className="study-card-icon audio">
          <AudioIcon />
        </div>
        <h2 className="study-card-title">{t('study.listenLearn', 'Listen & Learn')}</h2>
        {onExit && (
          <button className="study-card-close-btn" onClick={onExit} title={t('study.close', 'Close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className="study-card-content">
        <div className="study-audio-wrapper">
          {/* Intro screen — shown BEFORE we ever hit the backend. Lets the
              user choose to listen (kicks off generation) or skip (advances
              to the next node with zero token cost). Once a choice is made
              we don't show this again for the same node. */}
          {showIntro ? (
            <div className="study-audio-intro">
              <div className="study-audio-intro-icon">
                <AudioIcon />
              </div>
              <h3 className="study-audio-intro-title">{topic}</h3>
              {durationLabel && (
                <p className="study-audio-intro-duration">{durationLabel}</p>
              )}
              <p className="study-audio-intro-prompt">
                {t('study.audioIntroPrompt', 'Want to hear this lesson, or skip ahead?')}
              </p>
              <div className="study-audio-intro-actions">
                <button
                  type="button"
                  className="study-audio-listen-btn"
                  onClick={handleListen}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                  </svg>
                  {t('study.audioIntroListen', 'Listen')}
                </button>
                <button
                  type="button"
                  className="study-audio-skip-btn"
                  onClick={handleSkip}
                >
                  {t('study.audioIntroSkip', 'Skip')}
                  <ArrowRightIcon />
                </button>
              </div>
            </div>
          ) : isGenerating ? (
            <div className="study-audio-generating">
              <div className="study-audio-loading-bars">
                <div className="study-audio-loading-bar" />
                <div className="study-audio-loading-bar" />
                <div className="study-audio-loading-bar" />
                <div className="study-audio-loading-bar" />
                <div className="study-audio-loading-bar" />
              </div>
              <p className="study-audio-status">
                {generatingMessage || t('study.creatingAudioLesson', 'Creating your audio lesson...')}
              </p>
            </div>
          ) : audioReady ? (
            <ChatAudioPlayer
              audioBase64={audioBase64}
              firebaseUrl={firebaseUrl}
              topic={topic}
              intent={intent}
              duration={suggestedDuration}
              onEnded={handleAudioEnd}
              onFirstPlay={onFirstPlay}
            />
          ) : (
            <div className="study-audio-generating">
              {hasAttempted && !isGenerating ? (
                // Show retry button if generation failed
                <>
                  <p className="study-audio-status" style={{ color: '#ff6b6b', marginBottom: '12px' }}>
                    {generatingMessage || t('study.failedToGenerate', 'Failed to generate audio')}
                  </p>
                  <button
                    className="study-retry-btn"
                    onClick={() => {
                      setHasAttempted(false); // Reset to allow retry
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--primary-color, #4CAF50)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {t('study.retry', 'Retry')}
                  </button>
                </>
              ) : (
                // Show loading state
                <>
                  <div className="study-audio-loading-bars">
                    <div className="study-audio-loading-bar" />
                    <div className="study-audio-loading-bar" />
                    <div className="study-audio-loading-bar" />
                    <div className="study-audio-loading-bar" />
                    <div className="study-audio-loading-bar" />
                  </div>
                  <p className="study-audio-status">
                    {generatingMessage || t('study.creatingAudioLesson', 'Creating your audio lesson...')}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Continue button - show after audio is ready (user can skip) */}
      {audioReady && (
        <div className="study-card-footer">
          <button className="study-continue-btn" onClick={onContinue}>
            {t('study.continueBtn', 'Continue')}
            <ArrowRightIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyAudioCard;
