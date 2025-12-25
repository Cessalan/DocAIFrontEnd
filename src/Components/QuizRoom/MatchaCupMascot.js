import React from 'react';

/**
 * MatchaCupMascot - Cute, tall matcha latte cup mascot with kawaii face
 * Trendy/aesthetic study themed - bright green matcha in clear cup
 *
 * @param {number} size - Size of the mascot
 * @param {boolean} isActive - Whether to show in color (true) or grayscale (false)
 * @param {string} className - Additional CSS classes
 */
const MatchaCupMascot = ({ size = 80, isActive = true, isExcited = false, className = '' }) => {
  const colors = isActive
    ? {
        // Active/colored state - pastel matcha green (soft, creamy)
        cupBody: 'rgba(255,255,255,0.3)',
        cupOutline: 'rgba(255,255,255,0.6)',
        matcha: '#B8D4B8',
        matchaDark: '#9BBF9B',
        matchaLight: '#D4E8D4',
        matchaVibrant: '#A8CCA8',
        foam: '#F8FBF8',
        foamWhite: '#FFFFFF',
        lid: '#FFFFFF',
        lidDark: '#E8E8E8',
        straw: '#9BBF9B',
        strawDark: '#7CA87C',
        eyeBg: '#1a1a2e',
        eyeShine: '#ffffff',
        blush: '#FFCDD2',
        sparkle: '#fbbf24',
        leaf: '#A8CCA8'
      }
    : {
        // Inactive/grayscale state
        cupBody: 'rgba(200,200,200,0.3)',
        cupOutline: 'rgba(180,180,180,0.6)',
        matcha: '#909090',
        matchaDark: '#707070',
        matchaLight: '#b0b0b0',
        matchaVibrant: '#888888',
        foam: '#d0d0d0',
        foamWhite: '#e8e8e8',
        lid: '#d0d0d0',
        lidDark: '#b0b0b0',
        straw: '#808080',
        strawDark: '#606060',
        eyeBg: '#3a3a3a',
        eyeShine: '#d0d0d0',
        blush: '#909090',
        sparkle: '#a0a0a0',
        leaf: '#707070'
      };

  const uniqueId = `matcha-${isActive ? 'active' : 'inactive'}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      className={`matcha-cup-mascot ${isActive ? 'active' : 'inactive'} ${className}`}
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
          {/* Matcha gradient - vibrant green */}
          <linearGradient id={`matchaGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.matchaLight} />
            <stop offset="40%" stopColor={colors.matchaVibrant} />
            <stop offset="100%" stopColor={colors.matchaDark} />
          </linearGradient>

          {/* Foam gradient */}
          <linearGradient id={`foamGrad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.foamWhite} />
            <stop offset="100%" stopColor={colors.foam} />
          </linearGradient>

          {/* Lid gradient */}
          <linearGradient id={`lidGrad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.lid} />
            <stop offset="100%" stopColor={colors.lidDark} />
          </linearGradient>

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
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor={colors.matchaDark} floodOpacity="0.25" />
          </filter>

          {/* Gloss gradient */}
          <linearGradient id={`glossGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.2" />
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
          <ellipse cx="150" cy="275" rx="45" ry="8" fill="#00000018" />

          {/* MAIN TALL CUP */}
          <g filter={`url(#cupShadow-${uniqueId})`}>
            {/* Matcha drink - the main green body */}
            <path
              d="M105 70 L112 255 C112 263, 188 263, 188 255 L195 70 C195 63, 105 63, 105 70Z"
              fill={`url(#matchaGrad-${uniqueId})`}
            />

            {/* Foam layer at top */}
            <ellipse cx="150" cy="78" rx="42" ry="10" fill={`url(#foamGrad-${uniqueId})`} />

            {/* Foam swirl pattern */}
            <path
              d="M130 78 Q140 73 150 78 Q160 83 170 78"
              stroke={colors.foamWhite}
              strokeWidth="3"
              fill="none"
              opacity="0.7"
            />

            {/* Cup outline - clear plastic effect */}
            <path
              d="M105 70 L112 255 C112 263, 188 263, 188 255 L195 70 C195 63, 105 63, 105 70Z"
              fill="none"
              stroke={colors.cupOutline}
              strokeWidth="4"
            />

            {/* Gloss highlight on cup */}
            <path
              d="M110 80 L115 245 C115 245 118 250 120 250 L115 80 C115 75 110 75 110 80Z"
              fill={`url(#glossGrad-${uniqueId})`}
            />

            {/* Dome lid */}
            <ellipse cx="150" cy="62" rx="50" ry="12" fill={`url(#lidGrad-${uniqueId})`} stroke={colors.lidDark} strokeWidth="2" />
            <ellipse cx="150" cy="55" rx="45" ry="9" fill={colors.lid} />
            <ellipse cx="150" cy="48" rx="38" ry="7" fill={colors.lid} opacity="0.9" />

            {/* Straw hole */}
            <ellipse cx="165" cy="46" rx="8" ry="5" fill={colors.lidDark} />

            {/* Straw - green to match matcha theme */}
            <rect x="161" y="8" width="8" height="45" rx="4" fill={colors.straw} />
            <rect x="163" y="8" width="3" height="45" fill={colors.leaf} opacity="0.6" />

            {/* Straw bend at top */}
            <path
              d="M165 8 Q165 0 175 0"
              stroke={colors.straw}
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* CUTE FACE - on the matcha */}
          <g>
            {/* Left eye */}
            <g>
              <ellipse cx="125" cy="150" rx="12" ry="14" fill={colors.eyeBg} />
              <ellipse cx="125" cy="150" rx="9" ry="11" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="121" cy="146" rx="4" ry="5" fill={colors.eyeShine} />
              <circle cx="128" cy="152" r="2" fill={colors.eyeShine} opacity="0.8" />
            </g>

            {/* Right eye */}
            <g>
              <ellipse cx="175" cy="150" rx="12" ry="14" fill={colors.eyeBg} />
              <ellipse cx="175" cy="150" rx="9" ry="11" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="171" cy="146" rx="4" ry="5" fill={colors.eyeShine} />
              <circle cx="178" cy="152" r="2" fill={colors.eyeShine} opacity="0.8" />
            </g>

            {/* Happy smile */}
            <path
              d="M135 180 Q150 198 165 180"
              stroke="#6B9B6B"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />

            {/* Blush cheeks */}
            <ellipse cx="108" cy="165" rx="12" ry="8" fill={`url(#blushGrad-${uniqueId})`} />
            <ellipse cx="192" cy="165" rx="12" ry="8" fill={`url(#blushGrad-${uniqueId})`} />
          </g>

          {/* Decorative leaf on lid */}
          {isActive && (
            <g>
              <path
                d="M180 30 Q195 15 188 0 Q173 10 180 30Z"
                fill={colors.leaf}
                stroke={colors.matchaDark}
                strokeWidth="1"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 180 30; 8 180 30; 0 180 30; -5 180 30; 0 180 30"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </path>
              {/* Leaf vein */}
              <line x1="181" y1="26" x2="186" y2="8" stroke={colors.matchaDark} strokeWidth="0.5" opacity="0.5" />
            </g>
          )}

          {/* Sparkles - only when active */}
          {isActive && (
            <g>
              <circle cx="75" cy="100" r="3" fill={colors.sparkle}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="220" cy="120" r="2.5" fill={colors.leaf}>
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" begin="0.5s" />
              </circle>
              <path
                d="M230 180 L233 188 L241 190 L233 192 L230 200 L227 192 L219 190 L227 188 Z"
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

export default MatchaCupMascot;
