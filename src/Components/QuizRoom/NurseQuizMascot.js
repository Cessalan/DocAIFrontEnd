import React from 'react';

/**
 * NurseQuizMascot - Cute, round, bouncy heart mascot with halo
 * More 3D, plump, and adorable
 */
const NurseQuizMascot = ({ size = 200, className = '' }) => {
  return (
    <div
      className={`nurse-quiz-mascot ${className}`}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
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
          {/* 3D Spherical Heart Gradient - more round and plump */}
          <radialGradient id="heartGrad3D" cx="35%" cy="30%" r="65%" fx="25%" fy="20%">
            <stop offset="0%" stopColor="#fff0f8"/>
            <stop offset="20%" stopColor="#ffd6ed"/>
            <stop offset="45%" stopColor="#ffaad9"/>
            <stop offset="70%" stopColor="#ff7cc4"/>
            <stop offset="100%" stopColor="#e84a9c"/>
          </radialGradient>

          {/* Bottom shadow gradient for 3D depth */}
          <radialGradient id="heartShadow3D" cx="50%" cy="80%" r="50%">
            <stop offset="0%" stopColor="#c9247a" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#c9247a" stopOpacity="0"/>
          </radialGradient>

          {/* Premium outline with purple tones */}
          <linearGradient id="outlineGrad3D" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7"/>
            <stop offset="50%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#5b21b6"/>
          </linearGradient>

          {/* Bouncy limb gradient - rounder feel */}
          <radialGradient id="limbGrad3D" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff5fa"/>
            <stop offset="40%" stopColor="#ffd6ed"/>
            <stop offset="100%" stopColor="#ffaad9"/>
          </radialGradient>

          {/* Halo gradient - ethereal cyan */}
          <linearGradient id="haloGrad3D" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7dd3fc"/>
            <stop offset="50%" stopColor="#22d3ee"/>
            <stop offset="100%" stopColor="#7dd3fc"/>
          </linearGradient>

          {/* Sparkle gradient */}
          <radialGradient id="sparkleGrad3D" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#bae6fd"/>
          </radialGradient>

          {/* Big glossy highlight for 3D bubble effect */}
          <radialGradient id="bigGloss" cx="30%" cy="25%" r="45%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9"/>
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
          </radialGradient>

          {/* Secondary gloss */}
          <radialGradient id="smallGloss" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
          </radialGradient>

          {/* Cheek blush - rounder */}
          <radialGradient id="blushGrad3D" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff6b9d" stopOpacity="0.6"/>
            <stop offset="70%" stopColor="#ff6b9d" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#ff6b9d" stopOpacity="0"/>
          </radialGradient>

          {/* Eye gradient for depth */}
          <radialGradient id="eyeGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2d2d44"/>
            <stop offset="100%" stopColor="#0f0f1a"/>
          </radialGradient>

          {/* Foot 3D gradient */}
          <radialGradient id="footGrad3D" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff5fa"/>
            <stop offset="50%" stopColor="#ffd6ed"/>
            <stop offset="100%" stopColor="#f9a8d4"/>
          </radialGradient>

          {/* Filters */}
          <filter id="haloGlow3D" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur1"/>
            <feGaussianBlur stdDeviation="10" result="blur2"/>
            <feMerge>
              <feMergeNode in="blur2"/>
              <feMergeNode in="blur1"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <filter id="softShadow3D" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#7c3aed" floodOpacity="0.25"/>
          </filter>

          <filter id="innerGlow3D" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>

        {/* Bouncy floating animation group */}
        <g>
          {/* More bouncy float animation */}
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-8; 0,0; 0,-3; 0,0"
            dur="2.5s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
          />

          {/* Ground shadow */}
          <ellipse cx="150" cy="270" rx="55" ry="12" fill="#00000020">
            <animate
              attributeName="rx"
              values="55;48;55;52;55"
              dur="2.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.2;0.12;0.2;0.16;0.2"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </ellipse>

          {/* HALO */}
          <g filter="url(#haloGlow3D)">
            <ellipse
              cx="150"
              cy="52"
              rx="48"
              ry="14"
              fill="none"
              stroke="url(#haloGrad3D)"
              strokeWidth="7"
              strokeLinecap="round"
            >
              <animate
                attributeName="opacity"
                values="0.7;1;0.7"
                dur="2s"
                repeatCount="indefinite"
              />
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="-2 150 52; 2 150 52; -2 150 52"
                dur="3s"
                repeatCount="indefinite"
              />
            </ellipse>
            {/* Inner halo ring */}
            <ellipse
              cx="150"
              cy="52"
              rx="40"
              ry="10"
              fill="none"
              stroke="#a5f3fc"
              strokeWidth="2"
              opacity="0.4"
            />
          </g>

          {/* SPARKLES */}
          <g>
            {/* Big sparkle left */}
            <g>
              <path
                d="M68 95 L72 106 L83 110 L72 114 L68 125 L64 114 L53 110 L64 106 Z"
                fill="url(#sparkleGrad3D)"
              >
                <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
                <animateTransform attributeName="transform" type="scale" values="0.6;1.1;0.6" dur="2s" repeatCount="indefinite" additive="sum"/>
              </path>
            </g>

            {/* Big sparkle right */}
            <g>
              <path
                d="M232 88 L235 97 L244 100 L235 103 L232 112 L229 103 L220 100 L229 97 Z"
                fill="url(#sparkleGrad3D)"
              >
                <animate attributeName="opacity" values="0;1;0" dur="2.3s" repeatCount="indefinite" begin="0.6s"/>
                <animateTransform attributeName="transform" type="scale" values="0.6;1.1;0.6" dur="2.3s" repeatCount="indefinite" begin="0.6s" additive="sum"/>
              </path>
            </g>

            {/* Small floating dots */}
            <circle cx="55" cy="140" r="3" fill="#a5f3fc">
              <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.8s" repeatCount="indefinite"/>
              <animate attributeName="cy" values="140;135;140" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="245" cy="130" r="2.5" fill="#c4b5fd">
              <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.5s" repeatCount="indefinite" begin="0.3s"/>
              <animate attributeName="cy" values="130;126;130" dur="1.8s" repeatCount="indefinite"/>
            </circle>
            <circle cx="75" cy="190" r="2" fill="#fda4af">
              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.2s" repeatCount="indefinite" begin="0.8s"/>
            </circle>
            <circle cx="225" cy="185" r="2.5" fill="#67e8f9">
              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.6s" repeatCount="indefinite" begin="1.2s"/>
            </circle>
          </g>

          {/* MAIN HEART BODY - Rounder, plumper shape */}
          <g filter="url(#softShadow3D)">
            {/* Squish animation on the heart */}
            <g>
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1 1; 1.02 0.98; 1 1; 0.99 1.01; 1 1"
                dur="2.5s"
                repeatCount="indefinite"
                additive="sum"
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; -3 2; 0 0; 1.5 -1; 0 0"
                dur="2.5s"
                repeatCount="indefinite"
                additive="sum"
              />

              {/* Main heart - rounder, more bulbous lobes */}
              <path
                d="
                  M150 238
                  C115 210, 62 165, 62 110
                  C62 62, 100 38, 145 60
                  C150 62, 150 62, 155 60
                  C200 38, 238 62, 238 110
                  C238 165, 185 210, 150 238
                "
                fill="url(#heartGrad3D)"
                stroke="url(#outlineGrad3D)"
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
                fill="url(#heartShadow3D)"
              />

              {/* Big glossy bubble highlight - top left */}
              <ellipse cx="105" cy="95" rx="35" ry="25" fill="url(#bigGloss)"/>

              {/* Secondary gloss - smaller */}
              <ellipse cx="90" cy="120" rx="15" ry="10" fill="url(#smallGloss)"/>

              {/* Tiny accent highlight */}
              <circle cx="195" cy="85" r="10" fill="#ffffff" opacity="0.25"/>
              <circle cx="200" cy="95" r="5" fill="#ffffff" opacity="0.15"/>
            </g>
          </g>

          {/* CUTE FACE */}
          <g>
            {/* Left eye - bigger and rounder */}
            <g>
              <ellipse cx="118" cy="150" rx="18" ry="20" fill="url(#eyeGrad)"/>
              {/* Big shine */}
              <ellipse cx="110" cy="142" rx="7" ry="8" fill="#ffffff"/>
              {/* Small shine */}
              <circle cx="122" cy="154" r="4" fill="#ffffff" opacity="0.85"/>
              {/* Colored reflection */}
              <circle cx="115" cy="162" r="2.5" fill="#67e8f9" opacity="0.5"/>
            </g>

            {/* Right eye */}
            <g>
              <ellipse cx="182" cy="150" rx="18" ry="20" fill="url(#eyeGrad)"/>
              <ellipse cx="174" cy="142" rx="7" ry="8" fill="#ffffff"/>
              <circle cx="186" cy="154" r="4" fill="#ffffff" opacity="0.85"/>
              <circle cx="179" cy="162" r="2.5" fill="#67e8f9" opacity="0.5"/>
            </g>

            {/* Happy eyebrows - subtle arcs */}
            <path
              d="M98 128 Q118 120 138 126"
              stroke="#e879a9"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.25"
            />
            <path
              d="M162 126 Q182 120 202 128"
              stroke="#e879a9"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.25"
            />
          </g>

          {/* BIG HAPPY SMILE */}
          <g>
            <path
              d="M118 182 Q150 210 182 182"
              stroke="#1a1a2e"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
            {/* Smile shine */}
            <path
              d="M122 180 Q150 205 178 180"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.15"
            />
          </g>

          {/* ROUNDER BLUSH CHEEKS */}
          <ellipse cx="85" cy="172" rx="18" ry="14" fill="url(#blushGrad3D)"/>
          <ellipse cx="215" cy="172" rx="18" ry="14" fill="url(#blushGrad3D)"/>

          {/* BOUNCY ROUND FEET */}
          {/* Left foot */}
          <g>
            <ellipse
              cx="120"
              cy="248"
              rx="26"
              ry="22"
              fill="url(#footGrad3D)"
              stroke="url(#outlineGrad3D)"
              strokeWidth="4"
            />
            {/* Foot gloss */}
            <ellipse cx="112" cy="240" rx="12" ry="8" fill="#ffffff" opacity="0.5"/>
            <ellipse cx="108" cy="244" rx="6" ry="4" fill="#ffffff" opacity="0.3"/>
          </g>

          {/* Right foot */}
          <g>
            <ellipse
              cx="180"
              cy="248"
              rx="26"
              ry="22"
              fill="url(#footGrad3D)"
              stroke="url(#outlineGrad3D)"
              strokeWidth="4"
            />
            <ellipse cx="172" cy="240" rx="12" ry="8" fill="#ffffff" opacity="0.5"/>
            <ellipse cx="168" cy="244" rx="6" ry="4" fill="#ffffff" opacity="0.3"/>
          </g>

          {/* Floating mini heart */}
          <g>
            <path
              d="M240 195 C240 188, 247 183, 252 188 C257 183, 264 188, 264 195 C264 204, 252 212, 252 212 C252 212, 240 204, 240 195"
              fill="#fda4af"
              opacity="0.7"
            >
              <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.8s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="translate" values="0,0; 0,-5; 0,0" dur="2s" repeatCount="indefinite"/>
              <animateTransform attributeName="transform" type="scale" values="1;1.15;1" dur="1.8s" repeatCount="indefinite" additive="sum"/>
            </path>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default NurseQuizMascot;
