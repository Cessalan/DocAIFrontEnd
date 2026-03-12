import React from 'react';

/**
 * StudyPathMascot - Simplified mascot for the study path view
 * Can be shown in full color (active) or grayscale (inactive/locked)
 * Based on NurseQuizMascot but without animations for better performance
 *
 * @param {number} size - Size of the mascot
 * @param {boolean} isActive - Whether to show in color (true) or grayscale (false)
 * @param {string} className - Additional CSS classes
 */
const StudyPathMascot = ({ size = 80, isActive = true, className = '', pointingDirection = null }) => {
  // Define color schemes for active vs inactive states
  const colors = isActive
    ? {
        // Active/colored state - warm peach/coral tones
        heartMain: '#f8b4a0',
        heartHighlight: '#fff8f5',
        heartMid: '#fcd5c8',
        heartDark: '#e88d7d',
        heartDeep: '#d4736a',
        heartShadow: '#b85a4a',
        outline: '#c45d54',
        eyeBg: '#1a1a2e',
        eyePupil: '#0f0f1a',
        eyeShine: '#ffffff',
        blush: '#e88d7d',
        mouthDark: '#4a1a2e',
        sparkle: '#67e8f9',
        miniHeart: '#e88d7d'
      }
    : {
        // Inactive/grayscale state
        heartMain: '#9a9a9a',
        heartHighlight: '#e8e8e8',
        heartMid: '#c8c8c8',
        heartDark: '#888888',
        heartDeep: '#707070',
        heartShadow: '#5a5a5a',
        outline: '#606060',
        eyeBg: '#3a3a3a',
        eyePupil: '#2a2a2a',
        eyeShine: '#d0d0d0',
        blush: '#808080',
        mouthDark: '#4a4a4a',
        sparkle: '#a0a0a0',
        miniHeart: '#808080'
      };

  const uniqueId = `mascot-${isActive ? 'active' : 'inactive'}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      className={`study-path-mascot ${isActive ? 'active' : 'inactive'} ${className}`}
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
          {/* 3D Spherical Heart Gradient */}
          <radialGradient id={`heartGrad-${uniqueId}`} cx="35%" cy="30%" r="65%" fx="25%" fy="20%">
            <stop offset="0%" stopColor={colors.heartHighlight} />
            <stop offset="20%" stopColor={colors.heartMid} />
            <stop offset="45%" stopColor={colors.heartMain} />
            <stop offset="70%" stopColor={colors.heartDark} />
            <stop offset="100%" stopColor={colors.heartDeep} />
          </radialGradient>

          {/* Bottom shadow gradient */}
          <radialGradient id={`heartShadow-${uniqueId}`} cx="50%" cy="80%" r="50%">
            <stop offset="0%" stopColor={colors.heartShadow} stopOpacity="0.4" />
            <stop offset="100%" stopColor={colors.heartShadow} stopOpacity="0" />
          </radialGradient>

          {/* Outline gradient */}
          <linearGradient id={`outlineGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.heartDark} />
            <stop offset="50%" stopColor={colors.heartDeep} />
            <stop offset="100%" stopColor={colors.outline} />
          </linearGradient>

          {/* Foot gradient */}
          <radialGradient id={`footGrad-${uniqueId}`} cx="30%" cy="25%" r="75%">
            <stop offset="0%" stopColor={colors.heartHighlight} />
            <stop offset="30%" stopColor={colors.heartMid} />
            <stop offset="60%" stopColor={colors.heartMain} />
            <stop offset="100%" stopColor={colors.heartDark} />
          </radialGradient>

          {/* Big glossy highlight */}
          <radialGradient id={`bigGloss-${uniqueId}`} cx="30%" cy="25%" r="45%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Small gloss */}
          <radialGradient id={`smallGloss-${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Cheek blush */}
          <radialGradient id={`blushGrad-${uniqueId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.blush} stopOpacity="0.6" />
            <stop offset="70%" stopColor={colors.blush} stopOpacity="0.2" />
            <stop offset="100%" stopColor={colors.blush} stopOpacity="0" />
          </radialGradient>

          {/* Eye gradient */}
          <radialGradient id={`eyeGrad-${uniqueId}`} cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor={colors.eyeBg} />
            <stop offset="100%" stopColor={colors.eyePupil} />
          </radialGradient>

          {/* Toe highlight */}
          <radialGradient id={`toeGrad-${uniqueId}`} cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="60%" stopColor={colors.heartHighlight} stopOpacity="0.5" />
            <stop offset="100%" stopColor={colors.heartMid} stopOpacity="0" />
          </radialGradient>

          {/* Foot shadow gradient */}
          <linearGradient id={`footShadowGrad-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.heartDeep} stopOpacity="0" />
            <stop offset="70%" stopColor={colors.outline} stopOpacity="0.2" />
            <stop offset="100%" stopColor={colors.heartShadow} stopOpacity="0.35" />
          </linearGradient>

          {/* Soft shadow filter */}
          <filter id={`softShadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor={colors.heartDeep} floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Static mascot - no animations for performance */}
        <g>
          {/* Ground shadow */}
          <ellipse cx="150" cy="270" rx="55" ry="12" fill="#00000020" />

          {/* MAIN HEART BODY */}
          <g filter={`url(#softShadow-${uniqueId})`}>
            {/* Main heart shape */}
            <path
              d="
              M150 238
              C115 210, 62 165, 62 110
              C62 62, 100 38, 145 60
              C150 62, 150 62, 155 60
              C200 38, 238 62, 238 110
              C238 165, 185 210, 150 238
            "
              fill={`url(#heartGrad-${uniqueId})`}
              stroke={`url(#outlineGrad-${uniqueId})`}
              strokeWidth="6"
              strokeLinejoin="round"
            />

            {/* 3D depth shadow at bottom */}
            <path
              d="
              M150 238
              C185 210, 238 165, 238 110
              C238 62, 200 38, 155 60
              C150 62, 150 62, 145 60
            "
              fill={`url(#heartShadow-${uniqueId})`}
            />

            {/* Big glossy bubble highlight */}
            <ellipse cx="105" cy="95" rx="35" ry="25" fill={`url(#bigGloss-${uniqueId})`} />

            {/* Secondary gloss */}
            <ellipse cx="90" cy="120" rx="15" ry="10" fill={`url(#smallGloss-${uniqueId})`} />

            {/* Tiny accent highlights */}
            <circle cx="195" cy="85" r="10" fill="#ffffff" opacity="0.25" />
            <circle cx="200" cy="95" r="5" fill="#ffffff" opacity="0.15" />
          </g>

          {/* FACE */}
          <g>
            {/* Face area shadow */}
            <ellipse cx="150" cy="160" rx="50" ry="35" fill={colors.outline} opacity="0.08" />

            {/* Left eye */}
            <g>
              <ellipse cx="118" cy="152" rx="20" ry="22" fill={colors.outline} opacity="0.15" />
              <ellipse cx="118" cy="150" rx="16" ry="18" fill={colors.eyeBg} />
              <ellipse cx="118" cy="150" rx="16" ry="18" fill="none" stroke={colors.heartMain} strokeWidth="2" opacity="0.3" />
              <ellipse cx="118" cy="150" rx="12" ry="14" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="111" cy="143" rx="5" ry="6" fill={colors.eyeShine} />
              <circle cx="120" cy="152" r="3" fill={colors.eyeShine} opacity="0.8" />
              <circle cx="115" cy="158" r="2" fill={colors.heartDark} opacity="0.6" />
            </g>

            {/* Right eye */}
            <g>
              <ellipse cx="182" cy="152" rx="20" ry="22" fill={colors.outline} opacity="0.15" />
              <ellipse cx="182" cy="150" rx="16" ry="18" fill={colors.eyeBg} />
              <ellipse cx="182" cy="150" rx="16" ry="18" fill="none" stroke={colors.heartMain} strokeWidth="2" opacity="0.3" />
              <ellipse cx="182" cy="150" rx="12" ry="14" fill={`url(#eyeGrad-${uniqueId})`} />
              <ellipse cx="175" cy="143" rx="5" ry="6" fill={colors.eyeShine} />
              <circle cx="184" cy="152" r="3" fill={colors.eyeShine} opacity="0.8" />
              <circle cx="179" cy="158" r="2" fill={colors.heartDark} opacity="0.6" />
            </g>

            {/* Eyebrows */}
            <path
              d="M100 130 Q118 123 136 128"
              stroke={colors.outline}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.2"
            />
            <path
              d="M164 128 Q182 123 200 130"
              stroke={colors.outline}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.2"
            />
          </g>

          {/* MOUTH - happy smile */}
          <g>
            <path
              d="M120 184 Q150 210 180 184"
              stroke={colors.heartShadow}
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
              opacity="0.2"
            />
            <path
              d="M120 182 Q150 208 180 182"
              stroke={colors.mouthDark}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M124 181 Q150 203 176 181"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.15"
            />
          </g>

          {/* BLUSH CHEEKS */}
          <g>
            <ellipse cx="85" cy="170" rx="22" ry="16" fill={colors.blush} opacity="0.15" />
            <ellipse cx="85" cy="172" rx="16" ry="12" fill={`url(#blushGrad-${uniqueId})`} />
            <ellipse cx="82" cy="169" rx="6" ry="4" fill="#ffffff" opacity="0.25" />
          </g>
          <g>
            <ellipse cx="215" cy="170" rx="22" ry="16" fill={colors.blush} opacity="0.15" />
            <ellipse cx="215" cy="172" rx="16" ry="12" fill={`url(#blushGrad-${uniqueId})`} />
            <ellipse cx="212" cy="169" rx="6" ry="4" fill="#ffffff" opacity="0.25" />
          </g>

          {/* FEET */}
          {/* Left foot — transforms into pointing hand when isActive && pointingDirection === 'left' */}
          <g transform={(isActive && pointingDirection === 'left') ? `translate(5, 115) rotate(90) translate(-120, -248)` : undefined}>
            {!(isActive && pointingDirection === 'left') && <ellipse cx="120" cy="258" rx="22" ry="8" fill="#00000015" />}
            <path
              d="M94 248
               C94 235, 105 228, 120 228
               C135 228, 146 235, 146 248
               C146 260, 135 268, 120 268
               C105 268, 94 260, 94 248Z"
              fill={`url(#footGrad-${uniqueId})`}
              stroke={`url(#outlineGrad-${uniqueId})`}
              strokeWidth="3.5"
            />
            <path
              d="M98 255 C98 260, 108 266, 120 266 C132 266, 142 260, 142 255 C142 262, 132 268, 120 268 C108 268, 98 262, 98 255Z"
              fill={`url(#footShadowGrad-${uniqueId})`}
            />
            <ellipse cx="106" cy="262" rx="8" ry="6" fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2" />
            <ellipse cx="120" cy="264" rx="9" ry="7" fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2" />
            <ellipse cx="134" cy="262" rx="8" ry="6" fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2" />
            <ellipse cx="104" cy="259" rx="4" ry="3" fill={`url(#toeGrad-${uniqueId})`} />
            <ellipse cx="118" cy="260" rx="5" ry="3.5" fill={`url(#toeGrad-${uniqueId})`} />
            <ellipse cx="132" cy="259" rx="4" ry="3" fill={`url(#toeGrad-${uniqueId})`} />
            <ellipse cx="110" cy="238" rx="14" ry="9" fill="#ffffff" opacity="0.55" />
            <ellipse cx="105" cy="242" rx="7" ry="5" fill="#ffffff" opacity="0.35" />
            <circle cx="130" cy="235" r="2" fill="#ffffff" opacity="0.6" />
            {/* Pointing finger — extends from LEFT outer toe (becomes index finger after rotate(90)) */}
            {(isActive && pointingDirection === 'left') && (
              <g>
                <rect x="97" y="266" width="19" height="48" rx="9.5"
                  fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2.5" />
                <ellipse cx="106" cy="313" rx="10" ry="9" fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2.5" />
                <ellipse cx="106" cy="311" rx="7" ry="6" fill={`url(#toeGrad-${uniqueId})`} />
                <ellipse cx="103" cy="305" rx="4" ry="3" fill="#ffffff" opacity="0.55" />
                <ellipse cx="106" cy="274" rx="5" ry="3" fill="#ffffff" opacity="0.4" />
              </g>
            )}
          </g>

          {/* Right foot — transforms into pointing hand when isActive && pointingDirection === 'right' */}
          <g transform={(isActive && pointingDirection === 'right') ? `translate(295, 115) rotate(-90) translate(-180, -248)` : undefined}>
            {!(isActive && pointingDirection === 'right') && <ellipse cx="180" cy="258" rx="22" ry="8" fill="#00000015" />}
            <path
              d="M154 248
               C154 235, 165 228, 180 228
               C195 228, 206 235, 206 248
               C206 260, 195 268, 180 268
               C165 268, 154 260, 154 248Z"
              fill={`url(#footGrad-${uniqueId})`}
              stroke={`url(#outlineGrad-${uniqueId})`}
              strokeWidth="3.5"
            />
            <path
              d="M158 255 C158 260, 168 266, 180 266 C192 266, 202 260, 202 255 C202 262, 192 268, 180 268 C168 268, 158 262, 158 255Z"
              fill={`url(#footShadowGrad-${uniqueId})`}
            />
            <ellipse cx="166" cy="262" rx="8" ry="6" fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2" />
            <ellipse cx="180" cy="264" rx="9" ry="7" fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2" />
            <ellipse cx="194" cy="262" rx="8" ry="6" fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2" />
            <ellipse cx="164" cy="259" rx="4" ry="3" fill={`url(#toeGrad-${uniqueId})`} />
            <ellipse cx="178" cy="260" rx="5" ry="3.5" fill={`url(#toeGrad-${uniqueId})`} />
            <ellipse cx="192" cy="259" rx="4" ry="3" fill={`url(#toeGrad-${uniqueId})`} />
            <ellipse cx="170" cy="238" rx="14" ry="9" fill="#ffffff" opacity="0.55" />
            <ellipse cx="165" cy="242" rx="7" ry="5" fill="#ffffff" opacity="0.35" />
            <circle cx="190" cy="235" r="2" fill="#ffffff" opacity="0.6" />
            {/* Pointing finger — extends from RIGHT outer toe (becomes index finger after rotate(-90)) */}
            {(isActive && pointingDirection === 'right') && (
              <g>
                <rect x="184" y="266" width="19" height="48" rx="9.5"
                  fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2.5" />
                <ellipse cx="194" cy="313" rx="10" ry="9" fill={`url(#footGrad-${uniqueId})`} stroke={`url(#outlineGrad-${uniqueId})`} strokeWidth="2.5" />
                <ellipse cx="194" cy="311" rx="7" ry="6" fill={`url(#toeGrad-${uniqueId})`} />
                <ellipse cx="191" cy="305" rx="4" ry="3" fill="#ffffff" opacity="0.55" />
                <ellipse cx="194" cy="274" rx="5" ry="3" fill="#ffffff" opacity="0.4" />
              </g>
            )}
          </g>

          {/* Mini floating heart - only show when active */}
          {isActive && (
            <g>
              <path
                d="M240 195 C240 188, 247 183, 252 188 C257 183, 264 188, 264 195 C264 204, 252 212, 252 212 C252 212, 240 204, 240 195"
                fill={colors.miniHeart}
                opacity="0.7"
              />
            </g>
          )}

          {/* Sparkles - only show when active */}
          {isActive && (
            <g>
              <circle cx="55" cy="140" r="3" fill={colors.sparkle} opacity="0.6" />
              <circle cx="245" cy="130" r="2.5" fill="#c4b5fd" opacity="0.6" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

export default StudyPathMascot;
