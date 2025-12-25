import React from 'react';

/**
 * PillMascot - Cute, bouncy pill/capsule mascot with kawaii face
 * Nursing/medical themed - matches NurseQuizMascot style
 *
 * @param {number} size - Size of the mascot
 * @param {boolean} isActive - Whether to show in color (true) or grayscale (false)
 * @param {string} className - Additional CSS classes
 */
const PillMascot = ({ size = 80, isActive = true, isExcited = false, className = '' }) => {
  const colors = isActive
    ? {
        // Active/colored state - medical teal/mint tones
        pillTop: '#5eead4',
        pillTopDark: '#14b8a6',
        pillTopLight: '#99f6e4',
        pillBottom: '#f0abfc',
        pillBottomDark: '#d946ef',
        pillBottomLight: '#f5d0fe',
        pillLine: '#ffffff',
        eyeBg: '#1a1a2e',
        eyeShine: '#ffffff',
        blush: '#f9a8d4',
        sparkle: '#fbbf24',
        sparkle2: '#67e8f9'
      }
    : {
        // Inactive/grayscale state
        pillTop: '#a0a0a0',
        pillTopDark: '#707070',
        pillTopLight: '#c0c0c0',
        pillBottom: '#888888',
        pillBottomDark: '#606060',
        pillBottomLight: '#a8a8a8',
        pillLine: '#d0d0d0',
        eyeBg: '#3a3a3a',
        eyeShine: '#d0d0d0',
        blush: '#808080',
        sparkle: '#a0a0a0',
        sparkle2: '#909090'
      };

  const uniqueId = `pill-${isActive ? 'active' : 'inactive'}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      className={`pill-mascot ${isActive ? 'active' : 'inactive'} ${className}`}
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
          {/* Top half gradient (teal/mint) */}
          <linearGradient id={`pillTopGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.pillTopLight} />
            <stop offset="50%" stopColor={colors.pillTop} />
            <stop offset="100%" stopColor={colors.pillTopDark} />
          </linearGradient>

          {/* Bottom half gradient (pink/purple) */}
          <linearGradient id={`pillBottomGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.pillBottomLight} />
            <stop offset="50%" stopColor={colors.pillBottom} />
            <stop offset="100%" stopColor={colors.pillBottomDark} />
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
          <filter id={`pillShadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor={colors.pillBottomDark} floodOpacity="0.25" />
          </filter>

          {/* Gloss gradient */}
          <radialGradient id={`glossGrad-${uniqueId}`} cx="30%" cy="25%" r="40%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
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
          <ellipse cx="150" cy="270" rx="50" ry="10" fill="#00000018" />

          {/* MAIN PILL BODY - Capsule shape */}
          <g filter={`url(#pillShadow-${uniqueId})`}>
            {/* Top half of capsule (teal) */}
            <path
              d="M100 150 L100 100 C100 55, 200 55, 200 100 L200 150 L100 150Z"
              fill={`url(#pillTopGrad-${uniqueId})`}
              stroke={colors.pillTopDark}
              strokeWidth="3"
            />

            {/* Bottom half of capsule (pink) */}
            <path
              d="M100 150 L100 200 C100 245, 200 245, 200 200 L200 150 L100 150Z"
              fill={`url(#pillBottomGrad-${uniqueId})`}
              stroke={colors.pillBottomDark}
              strokeWidth="3"
            />

            {/* Center dividing line */}
            <line
              x1="100"
              y1="150"
              x2="200"
              y2="150"
              stroke={colors.pillLine}
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Gloss highlight on top half */}
            <ellipse cx="130" cy="95" rx="25" ry="20" fill={`url(#glossGrad-${uniqueId})`} />

            {/* Small shine dots */}
            <circle cx="175" cy="85" r="6" fill="#ffffff" opacity="0.5" />
            <circle cx="185" cy="95" r="3" fill="#ffffff" opacity="0.4" />
          </g>

          {/* CUTE FACE */}
          <g>
            {/* Left eye */}
            <g>
              <ellipse cx="125" cy="125" rx="12" ry="14" fill={colors.eyeBg} />
              <ellipse cx="125" cy="125" rx="9" ry="11" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="121" cy="121" rx="4" ry="5" fill={colors.eyeShine} />
              <circle cx="128" cy="127" r="2" fill={colors.eyeShine} opacity="0.8" />
            </g>

            {/* Right eye */}
            <g>
              <ellipse cx="175" cy="125" rx="12" ry="14" fill={colors.eyeBg} />
              <ellipse cx="175" cy="125" rx="9" ry="11" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="171" cy="121" rx="4" ry="5" fill={colors.eyeShine} />
              <circle cx="178" cy="127" r="2" fill={colors.eyeShine} opacity="0.8" />
            </g>

            {/* Happy smile - on the pink half */}
            <path
              d="M130 185 Q150 200 170 185"
              stroke="#9333ea"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />

            {/* Blush cheeks */}
            <ellipse cx="105" cy="135" rx="10" ry="7" fill={`url(#blushGrad-${uniqueId})`} />
            <ellipse cx="195" cy="135" rx="10" ry="7" fill={`url(#blushGrad-${uniqueId})`} />
          </g>

          {/* Tiny arms/hands waving */}
          {isActive && (
            <g>
              {/* Left arm */}
              <path
                d="M95 160 Q75 150 70 130"
                stroke={colors.pillBottom}
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 95 160; -10 95 160; 0 95 160; 5 95 160; 0 95 160"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </path>

              {/* Right arm */}
              <path
                d="M205 160 Q225 150 230 130"
                stroke={colors.pillBottom}
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 205 160; 10 205 160; 0 205 160; -5 205 160; 0 205 160"
                  dur="1.5s"
                  repeatCount="indefinite"
                  begin="0.2s"
                />
              </path>
            </g>
          )}

          {/* Sparkles - only when active */}
          {isActive && (
            <g>
              <circle cx="70" cy="90" r="3" fill={colors.sparkle}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="230" cy="85" r="2.5" fill={colors.sparkle2}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" begin="0.5s" />
              </circle>
              <path
                d="M245 170 L248 178 L256 180 L248 182 L245 190 L242 182 L234 180 L242 178 Z"
                fill={colors.sparkle}
                opacity="0.8"
              >
                <animate attributeName="opacity" values="0;1;0" dur="2.2s" repeatCount="indefinite" begin="0.3s" />
              </path>
              {/* Medical cross sparkle */}
              <g opacity="0.7">
                <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.5s" repeatCount="indefinite" begin="0.8s" />
                <rect x="55" cy="175" width="16" height="5" rx="2" fill={colors.sparkle2} />
                <rect x="60.5" cy="169.5" width="5" height="16" rx="2" fill={colors.sparkle2} />
              </g>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

export default PillMascot;
