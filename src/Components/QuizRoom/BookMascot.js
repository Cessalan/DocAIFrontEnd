import React from 'react';

/**
 * BookMascot - Cute, bouncy open book mascot with kawaii face
 * School/study themed - matches NurseQuizMascot style
 *
 * @param {number} size - Size of the mascot
 * @param {boolean} isActive - Whether to show in color (true) or grayscale (false)
 * @param {string} className - Additional CSS classes
 */
const BookMascot = ({ size = 80, isActive = true, isExcited = false, className = '' }) => {
  const colors = isActive
    ? {
        // Active/colored state - warm coral/peach tones
        bookCover: '#e88d7d',
        bookCoverDark: '#c46a5a',
        bookCoverLight: '#f4a896',
        pages: '#fff8f5',
        pageLines: '#e8d4cf',
        ribbon: '#67e8f9',
        ribbonDark: '#22d3ee',
        eyeBg: '#1a1a2e',
        eyeShine: '#ffffff',
        blush: '#e88d7d',
        sparkle: '#fbbf24'
      }
    : {
        // Inactive/grayscale state
        bookCover: '#888888',
        bookCoverDark: '#606060',
        bookCoverLight: '#a0a0a0',
        pages: '#e8e8e8',
        pageLines: '#c8c8c8',
        ribbon: '#a0a0a0',
        ribbonDark: '#808080',
        eyeBg: '#3a3a3a',
        eyeShine: '#d0d0d0',
        blush: '#808080',
        sparkle: '#a0a0a0'
      };

  const uniqueId = `book-${isActive ? 'active' : 'inactive'}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      className={`book-mascot ${isActive ? 'active' : 'inactive'} ${className}`}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isActive ? 1 : 0.6
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Book cover gradient */}
          <linearGradient id={`bookCoverGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.bookCoverLight} />
            <stop offset="50%" stopColor={colors.bookCover} />
            <stop offset="100%" stopColor={colors.bookCoverDark} />
          </linearGradient>

          {/* Page gradient */}
          <linearGradient id={`pageGrad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={colors.pages} />
          </linearGradient>

          {/* Ribbon gradient */}
          <linearGradient id={`ribbonGrad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.ribbon} />
            <stop offset="100%" stopColor={colors.ribbonDark} />
          </linearGradient>

          {/* Blush gradient */}
          <radialGradient id={`blushGrad-${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.blush} stopOpacity="0.6" />
            <stop offset="70%" stopColor={colors.blush} stopOpacity="0.2" />
            <stop offset="100%" stopColor={colors.blush} stopOpacity="0" />
          </radialGradient>

          {/* Eye gradient */}
          <radialGradient id={`eyeGrad-${uniqueId}`} cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2d2d44" />
            <stop offset="100%" stopColor={colors.eyeBg} />
          </radialGradient>

          {/* Shadow filter */}
          <filter id={`bookShadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor={colors.bookCoverDark} floodOpacity="0.25" />
          </filter>

          {/* Gloss gradient */}
          <radialGradient id={`glossGrad-${uniqueId}`} cx="30%" cy="25%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Bouncy animation group - key forces re-mount when isExcited changes */}
        <g key={isExcited ? 'excited' : 'normal'}>
          {isExcited ? (
            /* Jumping animation when excited/correct answer */
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 0,-25; 0,0; 0,-15; 0,0; 0,-8; 0,0"
              dur="0.8s"
              repeatCount="1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
            />
          ) : isActive && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 0,-5; 0,0; 0,-2; 0,0"
              dur="2.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
            />
          )}

          {/* Ground shadow */}
          <ellipse cx="150" cy="265" rx="60" ry="12" fill="#00000018" />

          {/* MAIN BOOK BODY */}
          <g filter={`url(#bookShadow-${uniqueId})`}>
            {/* Book spine */}
            <rect x="140" y="80" width="20" height="150" rx="3" fill={colors.bookCoverDark} />

            {/* Left cover */}
            <path
              d="M60 85 L140 80 L140 230 L60 235 C55 235, 50 230, 50 225 L50 95 C50 90, 55 85, 60 85Z"
              fill={`url(#bookCoverGrad-${uniqueId})`}
              stroke={colors.bookCoverDark}
              strokeWidth="3"
            />

            {/* Right cover */}
            <path
              d="M240 85 L160 80 L160 230 L240 235 C245 235, 250 230, 250 225 L250 95 C250 90, 245 85, 240 85Z"
              fill={`url(#bookCoverGrad-${uniqueId})`}
              stroke={colors.bookCoverDark}
              strokeWidth="3"
            />

            {/* Left pages */}
            <path
              d="M65 90 L138 85 L138 225 L65 230 C62 230, 60 228, 60 225 L60 95 C60 92, 62 90, 65 90Z"
              fill={`url(#pageGrad-${uniqueId})`}
            />

            {/* Right pages */}
            <path
              d="M235 90 L162 85 L162 225 L235 230 C238 230, 240 228, 240 225 L240 95 C240 92, 238 90, 235 90Z"
              fill={`url(#pageGrad-${uniqueId})`}
            />

            {/* Page lines - left */}
            <g opacity="0.4">
              <line x1="75" y1="110" x2="125" y2="107" stroke={colors.pageLines} strokeWidth="2" />
              <line x1="75" y1="130" x2="125" y2="127" stroke={colors.pageLines} strokeWidth="2" />
              <line x1="75" y1="150" x2="125" y2="147" stroke={colors.pageLines} strokeWidth="2" />
            </g>

            {/* Page lines - right */}
            <g opacity="0.4">
              <line x1="175" y1="107" x2="225" y2="110" stroke={colors.pageLines} strokeWidth="2" />
              <line x1="175" y1="127" x2="225" y2="130" stroke={colors.pageLines} strokeWidth="2" />
              <line x1="175" y1="147" x2="225" y2="150" stroke={colors.pageLines} strokeWidth="2" />
            </g>

            {/* Ribbon bookmark */}
            <path
              d="M150 75 L150 260 L140 245 L150 230 L160 245 L150 260"
              fill={`url(#ribbonGrad-${uniqueId})`}
              stroke={colors.ribbonDark}
              strokeWidth="2"
            />

            {/* Gloss highlight on left cover */}
            <ellipse cx="95" cy="120" rx="25" ry="20" fill={`url(#glossGrad-${uniqueId})`} />
          </g>

          {/* CUTE FACE */}
          <g>
            {/* Left eye */}
            <g>
              <ellipse cx="100" cy="175" rx="14" ry="16" fill={colors.eyeBg} />
              <ellipse cx="100" cy="175" rx="10" ry="12" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="95" cy="170" rx="4" ry="5" fill={colors.eyeShine} />
              <circle cx="103" cy="177" r="2" fill={colors.eyeShine} opacity="0.8" />
            </g>

            {/* Right eye */}
            <g>
              <ellipse cx="200" cy="175" rx="14" ry="16" fill={colors.eyeBg} />
              <ellipse cx="200" cy="175" rx="10" ry="12" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="195" cy="170" rx="4" ry="5" fill={colors.eyeShine} />
              <circle cx="203" cy="177" r="2" fill={colors.eyeShine} opacity="0.8" />
            </g>

            {/* Happy smile */}
            <path
              d="M130 200 Q150 218 170 200"
              stroke="#4a1a2e"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Blush cheeks */}
            <ellipse cx="80" cy="190" rx="12" ry="8" fill={`url(#blushGrad-${uniqueId})`} />
            <ellipse cx="220" cy="190" rx="12" ry="8" fill={`url(#blushGrad-${uniqueId})`} />
          </g>

          {/* Sparkles - only when active */}
          {isActive && (
            <g>
              <circle cx="55" cy="100" r="3" fill={colors.sparkle}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="245" cy="95" r="2.5" fill={colors.ribbon}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" begin="0.5s" />
              </circle>
              <path
                d="M260 150 L263 158 L271 160 L263 162 L260 170 L257 162 L249 160 L257 158 Z"
                fill={colors.sparkle}
                opacity="0.8"
              >
                <animate attributeName="opacity" values="0;1;0" dur="2.2s" repeatCount="indefinite" begin="0.3s" />
              </path>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

export default BookMascot;
