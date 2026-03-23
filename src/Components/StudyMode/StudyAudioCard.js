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
  onExit
}) => {
  const { t } = useTranslation();
  const [hasListened, setHasListened] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  // Use ref to prevent duplicate calls (survives re-renders)
  const isGeneratingRef = useRef(false);

  const { topic, intent, suggestedDuration, audioBase64, firebaseUrl } = content || {};

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

  // Track if we've already attempted generation to prevent infinite retries
  const [hasAttempted, setHasAttempted] = useState(false);

  // Auto-trigger audio generation if not ready (only once)
  useEffect(() => {
    // Check content directly (not audioReady state) to avoid React batching race where
    // audioReady is still false on first render even though firebaseUrl is already in content
    const hasAudio = !!(audioBase64 || firebaseUrl);
    if (!hasAudio && !isGenerating && !hasAttempted && !isGeneratingRef.current && onGenerateAudio && topic) {
      console.log('🎵 StudyAudioCard: Triggering audio generation for:', topic);
      setHasAttempted(true);
      isGeneratingRef.current = true;
      onGenerateAudio({
        topic,
        intent: intent || 'teach',
        duration: suggestedDuration || 2
      });
    }
  }, [audioBase64, firebaseUrl, isGenerating, hasAttempted, onGenerateAudio, topic, intent, suggestedDuration]);

  // Reset ref when audio is ready or on unmount
  useEffect(() => {
    if (audioReady) {
      isGeneratingRef.current = false;
    }
    return () => {
      isGeneratingRef.current = false;
    };
  }, [audioReady]);

  // Mark as listened when audio ends and auto-advance
  const handleAudioEnd = () => {
    setHasListened(true);
    if (onContinue) onContinue();
  };

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
          {/* Show generating state or player */}
          {isGenerating ? (
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
