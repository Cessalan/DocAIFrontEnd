import React, { useState, useEffect } from 'react';
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
  onContinue
}) => {
  const [hasListened, setHasListened] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

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

  // Auto-trigger audio generation if not ready
  useEffect(() => {
    if (!audioReady && !isGenerating && onGenerateAudio) {
      onGenerateAudio({
        topic,
        intent: intent || 'teach',
        duration: suggestedDuration || 2
      });
    }
  }, [audioReady, isGenerating, onGenerateAudio, topic, intent, suggestedDuration]);

  // Mark as listened when audio ends
  const handleAudioEnd = () => {
    setHasListened(true);
  };

  return (
    <div className="study-step-card">
      <div className="study-card-header">
        <div className="study-card-icon audio">
          <AudioIcon />
        </div>
        <h2 className="study-card-title">Listen & Learn</h2>
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
                {generatingMessage || 'Generating audio lesson...'}
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
              <div className="study-audio-loading-bars">
                <div className="study-audio-loading-bar" />
                <div className="study-audio-loading-bar" />
                <div className="study-audio-loading-bar" />
                <div className="study-audio-loading-bar" />
                <div className="study-audio-loading-bar" />
              </div>
              <p className="study-audio-status">
                Preparing audio...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Continue button - show after audio is ready (user can skip) */}
      {audioReady && (
        <div className="study-card-footer">
          <button className="study-continue-btn" onClick={onContinue}>
            Continue
            <ArrowRightIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyAudioCard;
