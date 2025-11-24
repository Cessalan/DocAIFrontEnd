import React from 'react';

/**
 * Animated streaming logo (heart + medical cross) - Gemini-style premium animation
 * Features: Ultra-fast spinning cross, morphing gradient, pulsing glow
 */
const StreamingLogo = () => {
  return (
    <svg
      className="streaming-logo-svg"
      viewBox="0 0 120 120"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Streaming"
    >
      <defs>
        {/* Animated gradient - shifts colors like Gemini */}
        <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="gradient-stop-1" />
          <stop offset="50%" className="gradient-stop-2" />
          <stop offset="100%" className="gradient-stop-3" />
        </linearGradient>

        {/* Enhanced glow filter for premium effect */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        {/* Stronger glow for cross */}
        <filter id="crossGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Outer pulsing glow ring */}
      <circle
        cx="60"
        cy="60"
        r="42"
        fill="none"
        stroke="url(#heartGradient)"
        strokeWidth="2.5"
        opacity="0.35"
        className="pulse-ring"
      />

      {/* Heart shape - perfectly centered and sized */}
      <path
        d="M60 95 C38 78, 20 63, 20 45 C20 31, 29 22, 40 22 C47 22, 54 25.5, 57.5 31 C61 25.5, 68 22, 75 22 C86 22, 95 31, 95 45 C95 63, 77 78, 60 95 Z"
        fill="url(#heartGradient)"
        filter="url(#glow)"
        className="heart-shape"
      />

      {/* Medical cross - ultra-fast spinning */}
      <g className="cross-group">
        {/* Vertical bar */}
        <rect
          x="56"
          y="42"
          width="8"
          height="28"
          rx="2"
          fill="url(#heartGradient)"
          filter="url(#crossGlow)"
        />
        {/* Horizontal bar */}
        <rect
          x="46"
          y="52"
          width="28"
          height="8"
          rx="2"
          fill="url(#heartGradient)"
          filter="url(#crossGlow)"
        />
      </g>
    </svg>
  );
};

export default StreamingLogo;
