import React from 'react';

/**
 * CoffeeCupMascot - Cute, cozy coffee cup mascot with kawaii face
 * Study/late night themed - matches NurseQuizMascot style
 *
 * @param {number} size - Size of the mascot
 * @param {boolean} isActive - Whether to show in color (true) or grayscale (false)
 * @param {string} className - Additional CSS classes
 */
const CoffeeCupMascot = ({ size = 80, isActive = true, isExcited = false, className = '' }) => {
  const colors = isActive
    ? {
        // Active/colored state - warm coffee browns
        cupBody: '#8B4513',
        cupBodyDark: '#5D2E0C',
        cupBodyLight: '#A0522D',
        cupRim: '#D2691E',
        coffee: '#3E2723',
        coffeeDark: '#1B0F0E',
        foam: '#F5DEB3',
        foamHighlight: '#FFFAF0',
        steam: '#ffffff',
        heart: '#E57373',
        eyeBg: '#1a1a2e',
        eyeShine: '#ffffff',
        blush: '#FFAB91',
        sparkle: '#fbbf24'
      }
    : {
        // Inactive/grayscale state
        cupBody: '#707070',
        cupBodyDark: '#505050',
        cupBodyLight: '#888888',
        cupRim: '#909090',
        coffee: '#404040',
        coffeeDark: '#303030',
        foam: '#c0c0c0',
        foamHighlight: '#d8d8d8',
        steam: '#a0a0a0',
        heart: '#808080',
        eyeBg: '#3a3a3a',
        eyeShine: '#d0d0d0',
        blush: '#808080',
        sparkle: '#a0a0a0'
      };

  const uniqueId = `coffee-${isActive ? 'active' : 'inactive'}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      className={`coffee-cup-mascot ${isActive ? 'active' : 'inactive'} ${className}`}
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
          {/* Cup body gradient */}
          <linearGradient id={`cupBodyGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.cupBodyLight} />
            <stop offset="50%" stopColor={colors.cupBody} />
            <stop offset="100%" stopColor={colors.cupBodyDark} />
          </linearGradient>

          {/* Coffee gradient */}
          <linearGradient id={`coffeeGrad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.coffee} />
            <stop offset="100%" stopColor={colors.coffeeDark} />
          </linearGradient>

          {/* Foam gradient */}
          <radialGradient id={`foamGrad-${uniqueId}`} cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor={colors.foamHighlight} />
            <stop offset="100%" stopColor={colors.foam} />
          </radialGradient>

          {/* Blush gradient */}
          <radialGradient id={`blushGrad-${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.blush} stopOpacity="0.7" />
            <stop offset="70%" stopColor={colors.blush} stopOpacity="0.2" />
            <stop offset="100%" stopColor={colors.blush} stopOpacity="0" />
          </radialGradient>

          {/* Eye gradient */}
          <radialGradient id={`eyeGrad-${uniqueId}`} cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2d2d44" />
            <stop offset="100%" stopColor={colors.eyeBg} />
          </radialGradient>

          {/* Shadow filter */}
          <filter id={`cupShadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor={colors.cupBodyDark} floodOpacity="0.3" />
          </filter>

          {/* Gloss gradient */}
          <linearGradient id={`glossGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
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
          <ellipse cx="150" cy="268" rx="55" ry="10" fill="#00000018" />

          {/* Steam wisps - only when active */}
          {isActive && (
            <g opacity="0.6">
              {/* Left steam */}
              <path
                d="M115 85 Q110 65 120 50 Q130 35 125 20"
                stroke={colors.steam}
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              >
                <animate
                  attributeName="d"
                  values="M115 85 Q110 65 120 50 Q130 35 125 20;M115 85 Q120 65 110 50 Q100 35 115 20;M115 85 Q110 65 120 50 Q130 35 125 20"
                  dur="3s"
                  repeatCount="indefinite"
                />
                <animate attributeName="opacity" values="0.6;0.3;0.6" dur="3s" repeatCount="indefinite" />
              </path>

              {/* Center steam */}
              <path
                d="M150 80 Q145 55 155 40 Q165 25 155 10"
                stroke={colors.steam}
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              >
                <animate
                  attributeName="d"
                  values="M150 80 Q145 55 155 40 Q165 25 155 10;M150 80 Q155 55 145 40 Q135 25 150 10;M150 80 Q145 55 155 40 Q165 25 155 10"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
                <animate attributeName="opacity" values="0.7;0.4;0.7" dur="2.5s" repeatCount="indefinite" />
              </path>

              {/* Right steam */}
              <path
                d="M185 85 Q190 65 180 50 Q170 35 180 20"
                stroke={colors.steam}
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              >
                <animate
                  attributeName="d"
                  values="M185 85 Q190 65 180 50 Q170 35 180 20;M185 85 Q180 65 190 50 Q200 35 185 20;M185 85 Q190 65 180 50 Q170 35 180 20"
                  dur="3.5s"
                  repeatCount="indefinite"
                />
                <animate attributeName="opacity" values="0.5;0.2;0.5" dur="3.5s" repeatCount="indefinite" />
              </path>
            </g>
          )}

          {/* MAIN CUP BODY */}
          <g filter={`url(#cupShadow-${uniqueId})`}>
            {/* Cup body - slightly tapered */}
            <path
              d="M85 100 L95 250 C95 258, 205 258, 205 250 L215 100 C215 92, 85 92, 85 100Z"
              fill={`url(#cupBodyGrad-${uniqueId})`}
              stroke={colors.cupBodyDark}
              strokeWidth="3"
            />

            {/* Cup rim */}
            <ellipse cx="150" cy="100" rx="67" ry="12" fill={colors.cupRim} stroke={colors.cupBodyDark} strokeWidth="2" />

            {/* Coffee surface */}
            <ellipse cx="150" cy="105" rx="58" ry="9" fill={`url(#coffeeGrad-${uniqueId})`} />

            {/* Foam/cream layer */}
            <ellipse cx="150" cy="103" rx="50" ry="7" fill={`url(#foamGrad-${uniqueId})`} />

            {/* Latte art heart */}
            <path
              d="M150 100 C145 97 138 100 138 105 C138 110 150 118 150 118 C150 118 162 110 162 105 C162 100 155 97 150 100Z"
              fill={colors.foam}
              opacity="0.8"
            />

            {/* Gloss highlight on cup */}
            <path
              d="M95 110 L100 240 C100 240 105 245 110 245 L105 110 C105 105 95 105 95 110Z"
              fill={`url(#glossGrad-${uniqueId})`}
            />

            {/* Handle */}
            <path
              d="M215 130 Q250 130 250 175 Q250 220 215 220"
              stroke={colors.cupBody}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M215 130 Q250 130 250 175 Q250 220 215 220"
              stroke={colors.cupBodyLight}
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* CUTE FACE */}
          <g>
            {/* Left eye */}
            <g>
              <ellipse cx="120" cy="170" rx="12" ry="14" fill={colors.eyeBg} />
              <ellipse cx="120" cy="170" rx="9" ry="11" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="116" cy="166" rx="4" ry="5" fill={colors.eyeShine} />
              <circle cx="123" cy="172" r="2" fill={colors.eyeShine} opacity="0.8" />
            </g>

            {/* Right eye */}
            <g>
              <ellipse cx="180" cy="170" rx="12" ry="14" fill={colors.eyeBg} />
              <ellipse cx="180" cy="170" rx="9" ry="11" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="176" cy="166" rx="4" ry="5" fill={colors.eyeShine} />
              <circle cx="183" cy="172" r="2" fill={colors.eyeShine} opacity="0.8" />
            </g>

            {/* Happy smile */}
            <path
              d="M135 200 Q150 218 165 200"
              stroke="#3E2723"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />

            {/* Blush cheeks */}
            <ellipse cx="100" cy="185" rx="12" ry="8" fill={`url(#blushGrad-${uniqueId})`} />
            <ellipse cx="200" cy="185" rx="12" ry="8" fill={`url(#blushGrad-${uniqueId})`} />
          </g>

          {/* Sparkles - only when active */}
          {isActive && (
            <g>
              <circle cx="70" cy="130" r="3" fill={colors.sparkle}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="240" cy="100" r="2.5" fill={colors.heart}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" begin="0.5s" />
              </circle>
              <path
                d="M260 160 L263 168 L271 170 L263 172 L260 180 L257 172 L249 170 L257 168 Z"
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

export default CoffeeCupMascot;
