import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './ChatAudioPlayer.css';

/**
 * ChatAudioPlayer - Premium audio player for generated lectures
 * Features: Play/pause, progress bar, speed control, download
 */
const ChatAudioPlayer = ({
  audioBase64,
  firebaseUrl,  // Firebase Storage URL (preferred for playback)
  topic,
  intent,
  duration,
  script,
  isGenerating = false,
  generatingMessage = ''
}) => {
  const { t } = useTranslation();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);

  // Use Firebase URL if available, otherwise fall back to base64
  const audioUrl = firebaseUrl
    ? firebaseUrl
    : audioBase64
      ? `data:audio/mp3;base64,${audioBase64}`
      : null;

  // Get icon based on intent
  const getIntentIcon = () => {
    switch (intent) {
      case 'teach': return '🎓';
      case 'summarize': return '📋';
      case 'deep_dive': return '🔬';
      case 'simplify': return '💡';
      case 'progress': return '📊';
      default: return '🎙️';
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle progress bar click
  const handleProgressClick = (e) => {
    if (!audioRef.current || !totalDuration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * totalDuration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle playback speed change
  const changeSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];

    setPlaybackRate(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Handle download
  const handleDownload = () => {
    if (!audioBase64) return;

    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `${topic.replace(/[^a-zA-Z0-9]/g, '_')}_audio.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Skip forward/backward
  const skip = (seconds) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, totalDuration));
  };

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setTotalDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // Generating state
  if (isGenerating) {
    return (
      <div className="chat-audio-player generating">
        <div className="audio-player-header">
          <span className="audio-player-icon">{getIntentIcon()}</span>
          <div className="audio-player-info">
            <h4 className="audio-player-topic">{topic}</h4>
            <span className="audio-player-status generating">
              <span className="generating-dot"></span>
              <span className="generating-dot"></span>
              <span className="generating-dot"></span>
              {generatingMessage || t('audio.generating', 'Generating audio...')}
            </span>
          </div>
        </div>
        <div className="audio-player-skeleton">
          <div className="skeleton-bar"></div>
        </div>
      </div>
    );
  }

  // No audio yet
  if (!audioBase64 && !firebaseUrl) {
    return null;
  }

  const progressPercent = totalDuration ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="chat-audio-player">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header */}
      <div className="audio-player-header">
        <span className="audio-player-icon">{getIntentIcon()}</span>
        <div className="audio-player-info">
          <h4 className="audio-player-topic">{topic}</h4>
          {/* Show actual duration from audio file, not estimated */}
          <span className="audio-player-duration">
            {totalDuration > 0 ? formatTime(totalDuration) : '...'}
          </span>
        </div>
        <button
          className="audio-download-btn"
          onClick={handleDownload}
          title={t('audio.download', 'Download')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>

      {/* Controls */}
      <div className="audio-player-controls">
        {/* Skip back */}
        <button className="audio-skip-btn" onClick={() => skip(-10)} title="-10s">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 17l-5-5 5-5"/>
            <path d="M18 17l-5-5 5-5"/>
          </svg>
        </button>

        {/* Play/Pause */}
        <button className="audio-play-btn" onClick={togglePlay}>
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
        </button>

        {/* Skip forward */}
        <button className="audio-skip-btn" onClick={() => skip(10)} title="+10s">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 17l5-5-5-5"/>
            <path d="M6 17l5-5-5-5"/>
          </svg>
        </button>

        {/* Progress bar */}
        <div className="audio-progress-container" onClick={handleProgressClick}>
          <div className="audio-progress-bar">
            <div className="audio-progress-fill" style={{ width: `${progressPercent}%` }} />
            <div className="audio-progress-knob" style={{ left: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Time */}
        <span className="audio-time">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>

        {/* Speed */}
        <button className="audio-speed-btn" onClick={changeSpeed} title={t('audio.speed', 'Speed')}>
          {playbackRate}x
        </button>
      </div>

      {/* Transcript toggle */}
      {script && (
        <div className="audio-transcript-section">
          <button
            className="audio-transcript-toggle"
            onClick={() => setShowTranscript(!showTranscript)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            {showTranscript
              ? t('audio.hideTranscript', 'Hide transcript')
              : t('audio.showTranscript', 'Show transcript')}
          </button>

          {showTranscript && (
            <div className="audio-transcript-content">
              {script}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatAudioPlayer;
