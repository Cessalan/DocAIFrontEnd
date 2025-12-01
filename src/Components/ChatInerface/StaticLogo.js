import React from 'react';

/**
 * Static version of the logo (heart + medical cross) - shown when not streaming
 * Matches the StreamingLogo exactly but without animations
 */
const StaticLogo = () => {
  return (
    <svg
      className="static-logo-svg"
      viewBox="0 0 120 120"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Logo"
    >
      <defs>
        {/* Static gradient - same colors as animated version */}
        <linearGradient id="staticHeartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b794f6" />
          <stop offset="50%" stopColor="#9d7edb" />
          <stop offset="100%" stopColor="#7c5cbf" />
        </linearGradient>

        {/* Subtle glow filter */}
        <filter id="staticGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Heart shape - same as animated version */}
      <path
        d="M60 95 C38 78, 20 63, 20 45 C20 31, 29 22, 40 22 C47 22, 54 25.5, 57.5 31 C61 25.5, 68 22, 75 22 C86 22, 95 31, 95 45 C95 63, 77 78, 60 95 Z"
        fill="url(#staticHeartGradient)"
        filter="url(#staticGlow)"
      />

      {/* Medical cross - same as animated version */}
      <g>
        {/* Vertical bar */}
        <rect
          x="56"
          y="42"
          width="8"
          height="28"
          rx="2"
          fill="url(#staticHeartGradient)"
          filter="url(#staticGlow)"
        />
        {/* Horizontal bar */}
        <rect
          x="46"
          y="52"
          width="28"
          height="8"
          rx="2"
          fill="url(#staticHeartGradient)"
          filter="url(#staticGlow)"
        />
      </g>
    </svg>
  );
};

export default StaticLogo;
