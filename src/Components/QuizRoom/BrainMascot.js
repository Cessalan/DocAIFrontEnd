import React from 'react';

/**
 * BrainMascot - Cute, round, bouncy brain mascot with detailed brain folds
 * Matches the style of NurseQuizMascot - 3D, plump, adorable with kawaii features
 *
 * @param {boolean} isExploding - When true, triggers celebration explosion animation
 */
const BrainMascot = ({ size = 200, className = '', isExploding = false }) => {
  return (
    <div
      className={`brain-mascot ${className} ${isExploding ? 'exploding' : ''}`}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
    >
      {/* Explosion particles */}
      {isExploding && (
        <div className="brain-explosion-particles">
          {[...Array(12)].map((_, i) => (
            <span key={i} className={`particle particle-${i}`} />
          ))}
          {[...Array(8)].map((_, i) => (
            <span key={`star-${i}`} className={`star-particle star-${i}`}>✦</span>
          ))}
          {[...Array(6)].map((_, i) => (
            <span key={`spark-${i}`} className={`spark-particle spark-${i}`} />
          ))}
        </div>
      )}

      <svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
        className={isExploding ? 'brain-svg-exploding' : ''}
      >
        <defs>
          {/* 3D Spherical Brain Gradient - soft pink/coral tones */}
          <radialGradient id="brainGrad3D" cx="35%" cy="30%" r="65%" fx="25%" fy="20%">
            <stop offset="0%" stopColor="#fff5f8"/>
            <stop offset="20%" stopColor="#ffd4e0"/>
            <stop offset="45%" stopColor="#ffb3c6"/>
            <stop offset="70%" stopColor="#ff8fa3"/>
            <stop offset="100%" stopColor="#e85d75"/>
          </radialGradient>

          {/* Secondary brain gradient for lobes - more detailed */}
          <radialGradient id="brainLobeGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#fff0f5"/>
            <stop offset="40%" stopColor="#ffccd5"/>
            <stop offset="100%" stopColor="#ff99ac"/>
          </radialGradient>

          {/* Inner fold gradient - for brain wrinkles depth */}
          <linearGradient id="foldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d946a0" stopOpacity="0.5"/>
            <stop offset="50%" stopColor="#be185d" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#d946a0" stopOpacity="0.5"/>
          </linearGradient>

          {/* Bottom shadow gradient for 3D depth */}
          <radialGradient id="brainShadow3D" cx="50%" cy="80%" r="50%">
            <stop offset="0%" stopColor="#c9184a" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#c9184a" stopOpacity="0"/>
          </radialGradient>

          {/* Premium outline gradient - purple/magenta tones */}
          <linearGradient id="brainOutlineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e879a9"/>
            <stop offset="50%" stopColor="#d946a0"/>
            <stop offset="100%" stopColor="#be185d"/>
          </linearGradient>

          {/* Sparkle gradient */}
          <radialGradient id="brainSparkleGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#fce7f3"/>
          </radialGradient>

          {/* Big glossy highlight for 3D bubble effect */}
          <radialGradient id="brainBigGloss" cx="30%" cy="25%" r="45%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9"/>
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
          </radialGradient>

          {/* Secondary gloss */}
          <radialGradient id="brainSmallGloss" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
          </radialGradient>

          {/* Cheek blush */}
          <radialGradient id="brainBlushGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff6b9d" stopOpacity="0.6"/>
            <stop offset="70%" stopColor="#ff6b9d" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#ff6b9d" stopOpacity="0"/>
          </radialGradient>

          {/* Eye gradient for depth */}
          <radialGradient id="brainEyeGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2d2d44"/>
            <stop offset="100%" stopColor="#0f0f1a"/>
          </radialGradient>

          {/* Thought bubble gradient */}
          <radialGradient id="thoughtGrad" cx="40%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#f0f9ff"/>
          </radialGradient>

          {/* Neural connection gradient */}
          <linearGradient id="neuralGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0"/>
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0"/>
          </linearGradient>

          {/* Filters */}
          <filter id="brainGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur1"/>
            <feMerge>
              <feMergeNode in="blur1"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <filter id="brainSoftShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#be185d" floodOpacity="0.2"/>
          </filter>

          <filter id="foldShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="1" stdDeviation="1" floodColor="#be185d" floodOpacity="0.3"/>
          </filter>
        </defs>

        {/* Bouncy floating animation group */}
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-6; 0,0; 0,-3; 0,0"
            dur="2.8s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
          />

          {/* Ground shadow */}
          <ellipse cx="150" cy="270" rx="50" ry="10" fill="#00000018">
            <animate
              attributeName="rx"
              values="50;44;50;47;50"
              dur="2.8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.15;0.08;0.15;0.12;0.15"
              dur="2.8s"
              repeatCount="indefinite"
            />
          </ellipse>

          {/* SPARKLES */}
          <g>
            {/* Sparkle top */}
            <g>
              <path
                d="M150 35 L153 45 L163 48 L153 51 L150 61 L147 51 L137 48 L147 45 Z"
                fill="url(#brainSparkleGrad)"
              >
                <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/>
                <animateTransform attributeName="transform" type="scale" values="0.7;1.1;0.7" dur="2s" repeatCount="indefinite" additive="sum"/>
              </path>
            </g>

            {/* Sparkle left */}
            <g>
              <path
                d="M58 130 L61 138 L69 140 L61 142 L58 150 L55 142 L47 140 L55 138 Z"
                fill="url(#brainSparkleGrad)"
              >
                <animate attributeName="opacity" values="0;1;0" dur="2.2s" repeatCount="indefinite" begin="0.5s"/>
                <animateTransform attributeName="transform" type="scale" values="0.6;1;0.6" dur="2.2s" repeatCount="indefinite" begin="0.5s" additive="sum"/>
              </path>
            </g>

            {/* Sparkle right */}
            <g>
              <path
                d="M242 125 L245 133 L253 135 L245 137 L242 145 L239 137 L231 135 L239 133 Z"
                fill="url(#brainSparkleGrad)"
              >
                <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" begin="0.8s"/>
                <animateTransform attributeName="transform" type="scale" values="0.6;1;0.6" dur="1.8s" repeatCount="indefinite" begin="0.8s" additive="sum"/>
              </path>
            </g>

            {/* Small floating dots */}
            <circle cx="70" cy="95" r="2.5" fill="#fda4af">
              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="230" cy="100" r="2" fill="#f9a8d4">
              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.7s" repeatCount="indefinite" begin="0.4s"/>
            </circle>
          </g>

          {/* Thought bubble - floating above */}
          <g filter="url(#brainGlow)">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0; 0,-4; 0,0"
              dur="3s"
              repeatCount="indefinite"
            />
            {/* Small bubbles leading up */}
            <circle cx="205" cy="75" r="6" fill="url(#thoughtGrad)" stroke="#e0e7ff" strokeWidth="1.5" opacity="0.9">
              <animate attributeName="opacity" values="0.6;0.9;0.6" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="218" cy="55" r="9" fill="url(#thoughtGrad)" stroke="#e0e7ff" strokeWidth="1.5" opacity="0.9">
              <animate attributeName="opacity" values="0.7;1;0.7" dur="2.2s" repeatCount="indefinite" begin="0.3s"/>
            </circle>
            {/* Main thought bubble */}
            <ellipse cx="245" cy="35" rx="25" ry="18" fill="url(#thoughtGrad)" stroke="#c7d2fe" strokeWidth="2">
              <animate attributeName="opacity" values="0.8;1;0.8" dur="2.5s" repeatCount="indefinite"/>
            </ellipse>
            {/* Lightbulb inside thought */}
            <g transform="translate(245, 35)">
              <path d="M0 -8 L0 -2 M-4 2 L4 2 M-3 5 L3 5" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="0" cy="-4" r="6" fill="none" stroke="#fbbf24" strokeWidth="2"/>
              <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite"/>
            </g>
          </g>

          {/* MAIN BRAIN BODY */}
          <g filter="url(#brainSoftShadow)">
            {/* Squish animation */}
            <g>
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1 1; 1.015 0.985; 1 1; 0.99 1.01; 1 1"
                dur="2.8s"
                repeatCount="indefinite"
                additive="sum"
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; -2 2; 0 0; 1 -1; 0 0"
                dur="2.8s"
                repeatCount="indefinite"
                additive="sum"
              />

              {/* Brain base shape - rounded, organic with more lobes */}
              <path
                d="M150 245
                   C95 245, 55 200, 55 145
                   C55 115, 70 90, 90 75
                   C80 65, 78 50, 90 40
                   C100 30, 118 28, 135 38
                   C142 32, 158 32, 165 38
                   C182 28, 200 30, 210 40
                   C222 50, 220 65, 210 75
                   C230 90, 245 115, 245 145
                   C245 200, 205 245, 150 245Z"
                fill="url(#brainGrad3D)"
                stroke="url(#brainOutlineGrad)"
                strokeWidth="4"
                strokeLinejoin="round"
              />

              {/* TOP BRAIN LOBES - bumpy appearance */}
              {/* Left top lobe */}
              <ellipse cx="100" cy="70" rx="32" ry="26" fill="url(#brainLobeGrad)" opacity="0.7"/>
              {/* Right top lobe */}
              <ellipse cx="200" cy="70" rx="32" ry="26" fill="url(#brainLobeGrad)" opacity="0.7"/>
              {/* Center top bump */}
              <ellipse cx="150" cy="55" rx="22" ry="18" fill="url(#brainLobeGrad)" opacity="0.5"/>

              {/* DETAILED BRAIN FOLDS/GYRI - the wrinkly parts */}
              <g filter="url(#foldShadow)">
                {/* Left hemisphere - major sulci */}
                <path
                  d="M75 110 Q95 100, 115 115 Q130 125, 125 145"
                  fill="none"
                  stroke="#d946a0"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.35"
                />
                <path
                  d="M70 145 Q90 135, 110 150 Q125 162, 120 180"
                  fill="none"
                  stroke="#d946a0"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.3"
                />
                <path
                  d="M80 180 Q100 170, 115 185"
                  fill="none"
                  stroke="#d946a0"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.28"
                />
                {/* Left smaller folds */}
                <path
                  d="M90 125 Q102 118, 108 128"
                  fill="none"
                  stroke="#be185d"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.25"
                />
                <path
                  d="M85 158 Q98 152, 105 162"
                  fill="none"
                  stroke="#be185d"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.25"
                />

                {/* Right hemisphere - major sulci (mirrored) */}
                <path
                  d="M225 110 Q205 100, 185 115 Q170 125, 175 145"
                  fill="none"
                  stroke="#d946a0"
                  strokeWidth="4"
                  strokeLinecap="round"
                  opacity="0.35"
                />
                <path
                  d="M230 145 Q210 135, 190 150 Q175 162, 180 180"
                  fill="none"
                  stroke="#d946a0"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.3"
                />
                <path
                  d="M220 180 Q200 170, 185 185"
                  fill="none"
                  stroke="#d946a0"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.28"
                />
                {/* Right smaller folds */}
                <path
                  d="M210 125 Q198 118, 192 128"
                  fill="none"
                  stroke="#be185d"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.25"
                />
                <path
                  d="M215 158 Q202 152, 195 162"
                  fill="none"
                  stroke="#be185d"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.25"
                />

                {/* Center longitudinal fissure - divides hemispheres */}
                <path
                  d="M150 55 Q148 85, 150 115 Q152 145, 150 175 Q148 205, 150 230"
                  fill="none"
                  stroke="#c9184a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.2"
                />

                {/* Top fold details */}
                <path
                  d="M110 75 Q130 68, 150 72 Q170 68, 190 75"
                  fill="none"
                  stroke="#d946a0"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.25"
                />
              </g>

              {/* Neural activity pulses - subtle glowing dots */}
              <g className="neural-pulses">
                <circle cx="95" cy="120" r="3" fill="#a855f7" opacity="0.6">
                  <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.5s" repeatCount="indefinite"/>
                  <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite"/>
                </circle>
                <circle cx="205" cy="125" r="3" fill="#a855f7" opacity="0.6">
                  <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.8s" repeatCount="indefinite" begin="0.3s"/>
                  <animate attributeName="r" values="2;4;2" dur="1.8s" repeatCount="indefinite" begin="0.3s"/>
                </circle>
                <circle cx="150" cy="100" r="2.5" fill="#06b6d4" opacity="0.6">
                  <animate attributeName="opacity" values="0.2;0.7;0.2" dur="2s" repeatCount="indefinite" begin="0.6s"/>
                  <animate attributeName="r" values="1.5;3.5;1.5" dur="2s" repeatCount="indefinite" begin="0.6s"/>
                </circle>
                <circle cx="115" cy="165" r="2" fill="#f472b6" opacity="0.5">
                  <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.6s" repeatCount="indefinite" begin="0.9s"/>
                </circle>
                <circle cx="185" cy="160" r="2" fill="#f472b6" opacity="0.5">
                  <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.4s" repeatCount="indefinite" begin="1.2s"/>
                </circle>
              </g>

              {/* Synaptic connections - animated lines between neural points */}
              <g className="synaptic-lines" opacity="0.3">
                <line x1="95" y1="120" x2="150" y2="100" stroke="url(#neuralGrad)" strokeWidth="1.5">
                  <animate attributeName="opacity" values="0;0.5;0" dur="2s" repeatCount="indefinite"/>
                </line>
                <line x1="150" y1="100" x2="205" y2="125" stroke="url(#neuralGrad)" strokeWidth="1.5">
                  <animate attributeName="opacity" values="0;0.5;0" dur="2s" repeatCount="indefinite" begin="0.5s"/>
                </line>
                <line x1="115" y1="165" x2="185" y2="160" stroke="url(#neuralGrad)" strokeWidth="1">
                  <animate attributeName="opacity" values="0;0.4;0" dur="2.5s" repeatCount="indefinite" begin="1s"/>
                </line>
              </g>

              {/* 3D depth shadow at bottom */}
              <path
                d="M150 245 C205 245, 245 200, 245 145 C245 115, 230 90, 210 75"
                fill="url(#brainShadow3D)"
                opacity="0.5"
              />

              {/* Big glossy bubble highlight - top left */}
              <ellipse cx="95" cy="95" rx="32" ry="24" fill="url(#brainBigGloss)"/>

              {/* Secondary gloss - smaller */}
              <ellipse cx="82" cy="120" rx="14" ry="10" fill="url(#brainSmallGloss)"/>

              {/* Tiny accent highlights on lobes */}
              <circle cx="115" cy="60" r="8" fill="#ffffff" opacity="0.3"/>
              <circle cx="185" cy="60" r="7" fill="#ffffff" opacity="0.25"/>
              <circle cx="195" cy="95" r="6" fill="#ffffff" opacity="0.2"/>
            </g>
          </g>

          {/* CUTE FACE */}
          <g>
            {/* Face area shadow for depth */}
            <ellipse cx="150" cy="175" rx="45" ry="30" fill="#d946a0" opacity="0.06"/>

            {/* Left eye */}
            <g>
              {/* Eye socket shadow */}
              <ellipse cx="120" cy="167" rx="18" ry="20" fill="#d946a0" opacity="0.12"/>
              {/* Eye white/sclera */}
              <ellipse cx="120" cy="165" rx="14" ry="16" fill="#1a1a2e"/>
              {/* Soft outer glow */}
              <ellipse cx="120" cy="165" rx="14" ry="16" fill="none" stroke="#ffb3c6" strokeWidth="2" opacity="0.3"/>
              {/* Main pupil */}
              <ellipse cx="120" cy="165" rx="10" ry="12" fill="url(#brainEyeGrad)"/>
              {/* Big shine */}
              <ellipse cx="114" cy="159" rx="4" ry="5" fill="#ffffff"/>
              {/* Small shine */}
              <circle cx="122" cy="167" r="2.5" fill="#ffffff" opacity="0.8"/>
              {/* Pink reflection */}
              <circle cx="117" cy="172" r="1.5" fill="#fda4af" opacity="0.6"/>
            </g>

            {/* Right eye */}
            <g>
              {/* Eye socket shadow */}
              <ellipse cx="180" cy="167" rx="18" ry="20" fill="#d946a0" opacity="0.12"/>
              {/* Eye white/sclera */}
              <ellipse cx="180" cy="165" rx="14" ry="16" fill="#1a1a2e"/>
              {/* Soft outer glow */}
              <ellipse cx="180" cy="165" rx="14" ry="16" fill="none" stroke="#ffb3c6" strokeWidth="2" opacity="0.3"/>
              {/* Main pupil */}
              <ellipse cx="180" cy="165" rx="10" ry="12" fill="url(#brainEyeGrad)"/>
              {/* Big shine */}
              <ellipse cx="174" cy="159" rx="4" ry="5" fill="#ffffff"/>
              {/* Small shine */}
              <circle cx="182" cy="167" r="2.5" fill="#ffffff" opacity="0.8"/>
              {/* Pink reflection */}
              <circle cx="177" cy="172" r="1.5" fill="#fda4af" opacity="0.6"/>
            </g>

            {/* Happy eyebrows - arched for smart look */}
            <path
              d="M102 147 Q120 140 138 145"
              stroke="#d946a0"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.25"
            />
            <path
              d="M162 145 Q180 140 198 147"
              stroke="#d946a0"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.25"
            />

            {/* Happy smile */}
            <path
              d="M125 200 Q150 223 175 200"
              stroke="#c9247a"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              opacity="0.2"
            />
            <path
              d="M125 198 Q150 220 175 198"
              stroke="#4a1a2e"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Smile highlight */}
            <path
              d="M128 197 Q150 215 172 197"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.15"
            />
          </g>

          {/* ROUNDER BLUSH CHEEKS */}
          {/* Left cheek */}
          <g>
            <ellipse cx="88" cy="185" rx="18" ry="12" fill="#ff6b9d" opacity="0.12"/>
            <ellipse cx="88" cy="187" rx="14" ry="10" fill="url(#brainBlushGrad)"/>
            <ellipse cx="85" cy="184" rx="5" ry="3" fill="#ffffff" opacity="0.2"/>
          </g>
          {/* Right cheek */}
          <g>
            <ellipse cx="212" cy="185" rx="18" ry="12" fill="#ff6b9d" opacity="0.12"/>
            <ellipse cx="212" cy="187" rx="14" ry="10" fill="url(#brainBlushGrad)"/>
            <ellipse cx="209" cy="184" rx="5" ry="3" fill="#ffffff" opacity="0.2"/>
          </g>

          {/* Floating knowledge symbols */}
          <g>
            {/* Plus sign - left */}
            <g opacity="0.7">
              <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.5s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="translate" values="0,0; 0,-4; 0,0" dur="2.5s" repeatCount="indefinite"/>
              <path d="M50 205 L50 217 M44 211 L56 211" stroke="#a855f7" strokeWidth="3" strokeLinecap="round"/>
            </g>

            {/* Equals sign - right */}
            <g opacity="0.7">
              <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.8s" repeatCount="indefinite" begin="0.5s"/>
              <animateTransform attributeName="transform" type="translate" values="0,0; 0,-3; 0,0" dur="2.8s" repeatCount="indefinite" begin="0.5s"/>
              <path d="M245 203 L259 203 M245 211 L259 211" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round"/>
            </g>

            {/* Percent sign - top right */}
            <g opacity="0.6">
              <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" repeatCount="indefinite" begin="1s"/>
              <animateTransform attributeName="transform" type="translate" values="0,0; 0,-5; 0,0" dur="3s" repeatCount="indefinite" begin="1s"/>
              <circle cx="235" cy="175" r="4" fill="none" stroke="#f472b6" strokeWidth="2"/>
              <circle cx="250" cy="190" r="4" fill="none" stroke="#f472b6" strokeWidth="2"/>
              <line x1="252" y1="172" x2="233" y2="193" stroke="#f472b6" strokeWidth="2" strokeLinecap="round"/>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default BrainMascot;
