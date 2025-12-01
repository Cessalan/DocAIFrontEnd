import React, { useState, useEffect, useMemo } from 'react';
import './ProcessingScreen.css';

/**
 * ProcessingScreen - Cinematic file processing animation
 * Shows a vial slowly filling while displaying processing messages
 * Creates anticipation and emotional tension for the quiz
 */
const ProcessingScreen = ({
  isVisible = false,
  progress = 0,
  onComplete,
  fileName = 'Your file'
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [messageOpacity, setMessageOpacity] = useState(1);
  const [isExiting, setIsExiting] = useState(false);

  // Processing messages that cycle through
  const processingMessages = useMemo(() => [
    'Analyzing your material…',
    'Extracting key nursing points…',
    'Preparing questions that matter…',
    'Calibrating difficulty levels…',
    'Stabilizing serum for Room 217…'
  ], []);

  // Cycle through messages based on progress
  useEffect(() => {
    if (!isVisible) return;

    const messageInterval = setInterval(() => {
      setMessageOpacity(0);

      setTimeout(() => {
        setCurrentMessageIndex(prev =>
          (prev + 1) % processingMessages.length
        );
        setMessageOpacity(1);
      }, 300);
    }, 2500);

    return () => clearInterval(messageInterval);
  }, [isVisible, processingMessages.length]);

  // Handle completion
  useEffect(() => {
    if (progress >= 100 && !isExiting) {
      setIsExiting(true);
      // Delay before calling onComplete to show the full vial
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 1500);
    }
  }, [progress, isExiting, onComplete]);

  // Calculate vial fill level (0-100)
  const fillLevel = Math.min(100, Math.max(0, progress));

  if (!isVisible) return null;

  return (
    <div className={`processing-screen ${isExiting ? 'exiting' : ''}`}>
      {/* Ambient background */}
      <div className="processing-ambient" />

      {/* Soft hospital hum visual indicator */}
      <div className="ambient-pulse" />

      {/* Main content container */}
      <div className="processing-content">
        {/* File name display */}
        <div className="processing-file-info">
          <div className="file-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2V7H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="file-name">{fileName}</span>
        </div>

        {/* Central vial animation */}
        <div className="processing-vial-container">
          <svg
            className="processing-vial"
            viewBox="0 0 120 280"
            width="120"
            height="280"
          >
            <defs>
              {/* Glass gradient */}
              <linearGradient id="processGlassGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                <stop offset="20%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="80%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
              </linearGradient>

              {/* Serum gradient */}
              <linearGradient id="processSerumGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#0891b2" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>

              {/* Glow filter */}
              <filter id="processGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>

              {/* Clip path for liquid */}
              <clipPath id="vialClip">
                <rect x="25" y="60" width="70" height="180" rx="35" />
              </clipPath>
            </defs>

            {/* Vial cap */}
            <rect x="40" y="20" width="40" height="25" rx="4" fill="rgba(100,100,120,0.8)" />
            <rect x="35" y="40" width="50" height="15" rx="3" fill="rgba(80,80,100,0.9)" />

            {/* Vial body outline */}
            <rect
              x="25" y="55"
              width="70" height="185"
              rx="35"
              fill="url(#processGlassGrad)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
            />

            {/* Liquid fill - animated based on progress */}
            <g clipPath="url(#vialClip)">
              <rect
                x="25"
                y={240 - (fillLevel * 1.8)}
                width="70"
                height={fillLevel * 1.8}
                fill="url(#processSerumGrad)"
                filter="url(#processGlow)"
                className="vial-liquid"
              />

              {/* Liquid surface wave */}
              <ellipse
                cx="60"
                cy={240 - (fillLevel * 1.8)}
                rx="35"
                ry="8"
                fill="rgba(34, 211, 238, 0.6)"
                className="liquid-surface"
              />

              {/* Bubbles */}
              {fillLevel > 10 && (
                <>
                  <circle cx="45" cy={220 - (fillLevel * 1.5)} r="3" fill="rgba(255,255,255,0.4)" className="bubble bubble-1" />
                  <circle cx="70" cy={200 - (fillLevel * 1.4)} r="2" fill="rgba(255,255,255,0.3)" className="bubble bubble-2" />
                  <circle cx="55" cy={180 - (fillLevel * 1.3)} r="2.5" fill="rgba(255,255,255,0.35)" className="bubble bubble-3" />
                </>
              )}
            </g>

            {/* Glass reflection */}
            <rect
              x="30" y="60"
              width="8" height="120"
              rx="4"
              fill="rgba(255,255,255,0.1)"
            />

            {/* Measurement marks */}
            {[0, 25, 50, 75, 100].map((mark, i) => (
              <g key={mark}>
                <line
                  x1="95"
                  y1={235 - (mark * 1.75)}
                  x2="100"
                  y2={235 - (mark * 1.75)}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="1"
                />
                <text
                  x="105"
                  y={238 - (mark * 1.75)}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {mark}
                </text>
              </g>
            ))}
          </svg>

          {/* Glow effect around vial */}
          <div className="vial-glow" style={{ opacity: fillLevel / 100 }} />
        </div>

        {/* Processing messages */}
        <div className="processing-messages">
          <p
            className="processing-message"
            style={{ opacity: messageOpacity }}
          >
            {processingMessages[currentMessageIndex]}
          </p>
        </div>

        {/* Progress percentage */}
        <div className="processing-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${fillLevel}%` }}
            />
          </div>
          <span className="progress-text">{Math.round(fillLevel)}%</span>
        </div>
      </div>

      {/* Subtle vignette */}
      <div className="processing-vignette" />
    </div>
  );
};

export default ProcessingScreen;
