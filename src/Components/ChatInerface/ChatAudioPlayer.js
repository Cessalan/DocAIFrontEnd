import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './ChatAudioPlayer.css';

/**
 * ChatAudioPlayer - Premium audio player with waveform visualization
 * Features: Animated waveform, play/pause, progress bar, speed control, download
 */
const ChatAudioPlayer = ({
  audioBase64,
  firebaseUrl,
  topic,
  intent,
  duration,
  script,
  isGenerating = false,
  generatingMessage = ''
}) => {
  const { t } = useTranslation();
  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationRef = useRef(null);
  const sourceRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [waveformBars, setWaveformBars] = useState(Array(20).fill(0.15));

  // Use Firebase URL if available, otherwise fall back to base64
  const audioUrl = firebaseUrl
    ? firebaseUrl
    : audioBase64
      ? `data:audio/mp3;base64,${audioBase64}`
      : null;

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize Web Audio API for waveform visualization
  const initAudioContext = () => {
    if (!audioContextRef.current && audioRef.current) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;

        // Only create source once
        if (!sourceRef.current) {
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        }
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
      }
    }
  };

  // Animate waveform based on audio frequency data
  const animateWaveform = () => {
    if (!analyserRef.current || !isPlaying) {
      // Reset to idle state
      setWaveformBars(Array(20).fill(0.15));
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Map frequency data to 20 bars
    const bars = [];
    const step = Math.floor(dataArray.length / 20);
    for (let i = 0; i < 20; i++) {
      const value = dataArray[i * step] / 255;
      // Add minimum height and smooth the values
      bars.push(Math.max(0.1, value * 0.9 + 0.1));
    }
    setWaveformBars(bars);

    animationRef.current = requestAnimationFrame(animateWaveform);
  };

  // Handle play/pause
  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      cancelAnimationFrame(animationRef.current);
      setWaveformBars(Array(20).fill(0.15));
    } else {
      initAudioContext();
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      await audioRef.current.play();
      animateWaveform();
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
  const handleDownload = async () => {
    if (!audioUrl) return;

    const filename = `${(topic || 'audio').replace(/[^a-zA-Z0-9]/g, '_')}_audio.mp3`;

    try {
      if (firebaseUrl) {
        const response = await fetch(firebaseUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else if (audioBase64) {
        const byteCharacters = atob(audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) {
      console.error('Download failed:', error);
      window.open(audioUrl, '_blank');
    }
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
    const handleEnded = () => {
      setIsPlaying(false);
      cancelAnimationFrame(animationRef.current);
      setWaveformBars(Array(20).fill(0.15));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      cancelAnimationFrame(animationRef.current);
    };
  }, [audioUrl]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update waveform animation when playing state changes
  useEffect(() => {
    if (isPlaying) {
      animateWaveform();
    } else {
      cancelAnimationFrame(animationRef.current);
      setWaveformBars(Array(20).fill(0.15));
    }
  }, [isPlaying]);

  // Generating state - premium shimmer with waveform placeholder
  if (isGenerating) {
    return (
      <div className="chat-audio-player generating">
        <div className="audio-player-header">
          <div className="audio-waveform-container generating">
            <div className="waveform-bars">
              {Array(20).fill(0).map((_, i) => (
                <div
                  key={i}
                  className="waveform-bar generating"
                  style={{ animationDelay: `${i * 0.05}s` }}
                />
              ))}
            </div>
          </div>
          <div className="audio-player-info">
            <h4 className="audio-player-topic">{topic}</h4>
            <span className="audio-player-status generating">
              <span className="generating-text-shimmer">
                {generatingMessage || t('audio.generating', 'Generating audio...')}
              </span>
            </span>
          </div>
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
      <audio ref={audioRef} src={audioUrl} preload="metadata" crossOrigin="anonymous" />

      {/* Title row */}
      <div className="audio-player-title-row">
        <h4 className="audio-player-topic">{topic}</h4>
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

      {/* Main player layout */}
      <div className="audio-player-main">
        {/* Play button */}
        <button className={`audio-play-btn ${isPlaying ? 'playing' : ''}`} onClick={togglePlay}>
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3"/>
            </svg>
          )}
        </button>

        {/* Waveform visualization */}
        <div className="audio-waveform-container" onClick={handleProgressClick}>
          <div className="waveform-bars">
            {waveformBars.map((height, i) => (
              <div
                key={i}
                className={`waveform-bar ${isPlaying ? 'active' : ''} ${(i / 20) * 100 < progressPercent ? 'played' : ''}`}
                style={{ height: `${height * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Skip buttons */}
        <div className="audio-skip-controls">
          <button className="audio-skip-btn" onClick={() => skip(-10)} title="-10s">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 17l-5-5 5-5"/>
              <path d="M18 17l-5-5 5-5"/>
            </svg>
          </button>
          <button className="audio-skip-btn" onClick={() => skip(10)} title="+10s">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 17l5-5-5-5"/>
              <path d="M6 17l5-5-5-5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Time and controls row */}
      <div className="audio-player-footer">
        <span className="audio-time-display">
          <span className="time-current">{formatTime(currentTime)}</span>
          <span className="time-separator">/</span>
          <span className="time-total">{formatTime(totalDuration)}</span>
        </span>
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
