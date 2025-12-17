import React, { useMemo } from 'react';

/**
 * NurseQuizMascot - Cute, round, bouncy heart mascot with halo
 * More 3D, plump, and adorable
 * Now with eye tracking for hovering cards!
 *
 * @param {string} lookDirection - 'center', 'left', 'right', 'down-left', 'down-center', 'down-right'
 * @param {boolean} isExcited - When true, shows big open mouth smile (for CTA hovers)
 * @param {boolean} isSurprised - When true, shows surprised expression with blink (for theme toggle)
 */
const NurseQuizMascot = ({ size = 200, className = '', lookDirection = 'center', isExcited = false, isSurprised = false }) => {
  // Calculate eye offsets based on look direction
  const eyeOffset = useMemo(() => {
    switch (lookDirection) {
      case 'left':
        return { x: -3, y: 0 };
      case 'right':
        return { x: 3, y: 0 };
      case 'down-left':
        return { x: -3, y: 3 };
      case 'down-center':
        return { x: 0, y: 4 };
      case 'down-right':
        return { x: 3, y: 3 };
      case 'up':
        return { x: 0, y: -3 };
      default:
        return { x: 0, y: 0 };
    }
  }, [lookDirection]);

  // Calculate body rotation and tilt based on look direction
  // Only subtle movement for action cards, no movement for nav buttons
  const bodyTransform = useMemo(() => {
    switch (lookDirection) {
      case 'left':
        return { rotate: 0, translateX: 0, translateY: 0 }; // No body turn for nav
      case 'right':
        return { rotate: 0, translateX: 0, translateY: 0 }; // No body turn for nav
      case 'down-left':
        return { rotate: -3, translateX: -1, translateY: 1 };
      case 'down-center':
        return { rotate: 0, translateX: 0, translateY: 2 };
      case 'down-right':
        return { rotate: 3, translateX: 1, translateY: 1 };
      case 'up':
        return { rotate: 0, translateX: 0, translateY: -1 };
      default:
        return { rotate: 0, translateX: 0, translateY: 0 };
    }
  }, [lookDirection]);
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
          {/* 3D Spherical Heart Gradient - Warm Peach/Coral (matching logo) */}
          <radialGradient id="heartGrad3D" cx="35%" cy="30%" r="65%" fx="25%" fy="20%">
            <stop offset="0%" stopColor="#fff8f5" />
            <stop offset="20%" stopColor="#fcd5c8" />
            <stop offset="45%" stopColor="#f8b4a0" />
            <stop offset="70%" stopColor="#e88d7d" />
            <stop offset="100%" stopColor="#d4736a" />
          </radialGradient>

          {/* Bottom shadow gradient for 3D depth */}
          <radialGradient id="heartShadow3D" cx="50%" cy="80%" r="50%">
            <stop offset="0%" stopColor="#b85a4a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#b85a4a" stopOpacity="0" />
          </radialGradient>

          {/* Premium outline with warm coral tones */}
          <linearGradient id="outlineGrad3D" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8a090" />
            <stop offset="50%" stopColor="#d4736a" />
            <stop offset="100%" stopColor="#c45d54" />
          </linearGradient>

          {/* Bouncy limb gradient - creamy white/peach */}
          <radialGradient id="limbGrad3D" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff8f5" />
            <stop offset="40%" stopColor="#fcd5c8" />
            <stop offset="100%" stopColor="#e88d7d" />
          </radialGradient>

          {/* Halo gradient - ethereal cyan - more vibrant */}
          <linearGradient id="haloGrad3D" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="30%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="70%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>

          {/* Sparkle gradient */}
          <radialGradient id="sparkleGrad3D" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#bae6fd" />
          </radialGradient>

          {/* Big glossy highlight for 3D bubble effect */}
          <radialGradient id="bigGloss" cx="30%" cy="25%" r="45%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Secondary gloss */}
          <radialGradient id="smallGloss" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Cheek blush - rounder, warm peach */}
          <radialGradient id="blushGrad3D" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e88d7d" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#e88d7d" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#e88d7d" stopOpacity="0" />
          </radialGradient>

          {/* Eye gradient for depth */}
          <radialGradient id="eyeGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2d2d44" />
            <stop offset="100%" stopColor="#0f0f1a" />
          </radialGradient>

          {/* Foot 3D gradient - warm peach */}
          <radialGradient id="footGrad3D" cx="30%" cy="25%" r="75%">
            <stop offset="0%" stopColor="#fff8f5" />
            <stop offset="30%" stopColor="#fde8df" />
            <stop offset="60%" stopColor="#f8c4b4" />
            <stop offset="100%" stopColor="#e88d7d" />
          </radialGradient>

          {/* Foot bottom shadow gradient */}
          <linearGradient id="footShadowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d4736a" stopOpacity="0" />
            <stop offset="70%" stopColor="#c45d54" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#b85a4a" stopOpacity="0.35" />
          </linearGradient>

          {/* Toe highlight gradient */}
          <radialGradient id="toeGrad" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#fff8f5" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fcd5c8" stopOpacity="0" />
          </radialGradient>

          {/* Filters */}
          <filter id="haloGlow3D" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur1" />
            <feGaussianBlur stdDeviation="8" result="blur2" />
            <feGaussianBlur stdDeviation="15" result="blur3" />
            <feMerge>
              <feMergeNode in="blur3" />
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="softShadow3D" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#d4736a" floodOpacity="0.25" />
          </filter>

          <filter id="innerGlow3D" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Body rotation wrapper - subtle lean towards look direction */}
        <g
          style={{
            transformOrigin: '150px 170px',
            transition: 'transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)',
            transform: `rotate(${bodyTransform.rotate}deg) translate(${bodyTransform.translateX}px, ${bodyTransform.translateY}px)`
          }}
        >
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

            {/* HALO - commented out
            <g filter="url(#haloGlow3D)">
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0,0; 0,-3; 0,0; 0,-1; 0,0"
                dur="2.5s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
              />
              <ellipse
                cx="150"
                cy="38"
                rx="52"
                ry="16"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="12"
                opacity="0.3"
              />
              <ellipse
                cx="150"
                cy="38"
                rx="48"
                ry="14"
                fill="none"
                stroke="url(#haloGrad3D)"
                strokeWidth="8"
                strokeLinecap="round"
              >
                <animate
                  attributeName="opacity"
                  values="0.85;1;0.85"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="-3 150 38; 3 150 38; -3 150 38"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse
                cx="150"
                cy="36"
                rx="44"
                ry="11"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                opacity="0.5"
              />
              <ellipse
                cx="150"
                cy="38"
                rx="40"
                ry="10"
                fill="none"
                stroke="#67e8f9"
                strokeWidth="3"
                opacity="0.6"
              />
            </g>
            */}

            {/* SPARKLES */}
            <g>
              {/* Big sparkle left */}
              <g>
                <path
                  d="M68 95 L72 106 L83 110 L72 114 L68 125 L64 114 L53 110 L64 106 Z"
                  fill="url(#sparkleGrad3D)"
                >
                  <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
                  <animateTransform attributeName="transform" type="scale" values="0.6;1.1;0.6" dur="2s" repeatCount="indefinite" additive="sum" />
                </path>
              </g>

              {/* Big sparkle right */}
              <g>
                <path
                  d="M232 88 L235 97 L244 100 L235 103 L232 112 L229 103 L220 100 L229 97 Z"
                  fill="url(#sparkleGrad3D)"
                >
                  <animate attributeName="opacity" values="0;1;0" dur="2.3s" repeatCount="indefinite" begin="0.6s" />
                  <animateTransform attributeName="transform" type="scale" values="0.6;1.1;0.6" dur="2.3s" repeatCount="indefinite" begin="0.6s" additive="sum" />
                </path>
              </g>

              {/* Small floating dots */}
              <circle cx="55" cy="140" r="3" fill="#a5f3fc">
                <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="cy" values="140;135;140" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="245" cy="130" r="2.5" fill="#c4b5fd">
                <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
                <animate attributeName="cy" values="130;126;130" dur="1.8s" repeatCount="indefinite" />
              </circle>
              <circle cx="75" cy="190" r="2" fill="#e88d7d">
                <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.2s" repeatCount="indefinite" begin="0.8s" />
              </circle>
              <circle cx="225" cy="185" r="2.5" fill="#67e8f9">
                <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.6s" repeatCount="indefinite" begin="1.2s" />
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
                <ellipse cx="105" cy="95" rx="35" ry="25" fill="url(#bigGloss)" />

                {/* Secondary gloss - smaller */}
                <ellipse cx="90" cy="120" rx="15" ry="10" fill="url(#smallGloss)" />

                {/* Tiny accent highlight */}
                <circle cx="195" cy="85" r="10" fill="#ffffff" opacity="0.25" />
                <circle cx="200" cy="95" r="5" fill="#ffffff" opacity="0.15" />
              </g>
            </g>

            {/* CUTE FACE - softer, more integrated */}
            <g>
              {/* Subtle face area shadow for depth */}
              <ellipse cx="150" cy="160" rx="50" ry="35" fill="#c45d54" opacity="0.08" />

              {/* Left eye - softer, rounder */}
              <g style={{
                transition: 'transform 0.15s ease-out',
                transform: isSurprised ? 'scaleY(0.1)' : 'scaleY(1)',
                transformOrigin: '118px 150px'
              }}>
                {/* Eye socket shadow - stays fixed */}
                <ellipse cx="118" cy="152" rx="20" ry="22" fill="#c45d54" opacity="0.15" />
                {/* Eye white/sclera - wider when surprised */}
                <ellipse
                  cx="118"
                  cy="150"
                  rx="16"
                  ry="18"
                  fill="#1a1a2e"
                  style={{
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                  }}
                />
                {/* Soft outer glow to blend */}
                <ellipse cx="118" cy="150" rx="16" ry="18" fill="none" stroke="#f8b4a0" strokeWidth="2" opacity="0.3" />
                {/* Pupil group - moves with look direction, smaller when surprised */}
                <g style={{
                  transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`
                }}>
                  {/* Main pupil */}
                  <ellipse cx="118" cy="150" rx="12" ry="14" fill="url(#eyeGrad)" />
                  {/* Big shine */}
                  <ellipse cx="111" cy="143" rx="5" ry="6" fill="#ffffff" />
                  {/* Small shine */}
                  <circle cx="120" cy="152" r="3" fill="#ffffff" opacity="0.8" />
                  {/* Pink reflection - matches body */}
                  <circle cx="115" cy="158" r="2" fill="#e88d7d" opacity="0.6" />
                </g>
              </g>

              {/* Right eye */}
              <g style={{
                transition: 'transform 0.15s ease-out',
                transform: isSurprised ? 'scaleY(0.1)' : 'scaleY(1)',
                transformOrigin: '182px 150px'
              }}>
                {/* Eye socket shadow - stays fixed */}
                <ellipse cx="182" cy="152" rx="20" ry="22" fill="#c45d54" opacity="0.15" />
                {/* Eye white/sclera - wider when surprised */}
                <ellipse
                  cx="182"
                  cy="150"
                  rx="16"
                  ry="18"
                  fill="#1a1a2e"
                  style={{
                    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                  }}
                />
                {/* Soft outer glow to blend */}
                <ellipse cx="182" cy="150" rx="16" ry="18" fill="none" stroke="#f8b4a0" strokeWidth="2" opacity="0.3" />
                {/* Pupil group - moves with look direction */}
                <g style={{
                  transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`
                }}>
                  {/* Main pupil */}
                  <ellipse cx="182" cy="150" rx="12" ry="14" fill="url(#eyeGrad)" />
                  {/* Big shine */}
                  <ellipse cx="175" cy="143" rx="5" ry="6" fill="#ffffff" />
                  {/* Small shine */}
                  <circle cx="184" cy="152" r="3" fill="#ffffff" opacity="0.8" />
                  {/* Pink reflection - matches body */}
                  <circle cx="179" cy="158" r="2" fill="#e88d7d" opacity="0.6" />
                </g>
              </g>

              {/* Happy eyebrows - raised when surprised */}
              <path
                d="M100 130 Q118 123 136 128"
                stroke="#c45d54"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                opacity="0.2"
                style={{
                  transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  transform: isSurprised ? 'translateY(-8px)' : 'translateY(0)',
                  transformOrigin: '118px 125px'
                }}
              />
              <path
                d="M164 128 Q182 123 200 130"
                stroke="#c45d54"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                opacity="0.2"
                style={{
                  transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  transform: isSurprised ? 'translateY(-8px)' : 'translateY(0)',
                  transformOrigin: '182px 125px'
                }}
              />
            </g>

            {/* MOUTH - all states rendered with opacity transitions for smooth morphing */}
            <g>
              {/* Surprised small "o" mouth - always rendered, opacity controlled */}
              <g
                style={{
                  opacity: isSurprised ? 1 : 0,
                  willChange: 'opacity',
                  transform: 'translateZ(0)'
                }}
                className="mouth-surprised"
              >
                <ellipse cx="150" cy="190" rx="12" ry="10" fill="#b85a4a" opacity="0.2" />
                <ellipse cx="150" cy="188" rx="10" ry="8" fill="#4a1a2e" />
                <ellipse cx="150" cy="189" rx="7" ry="5" fill="#2d0f1a" />
              </g>

              {/* Default happy smile - always rendered, opacity controlled */}
              <g
                style={{
                  opacity: (!isExcited && !isSurprised) ? 1 : 0,
                  willChange: 'opacity',
                  transform: 'translateZ(0)'
                }}
                className="mouth-default"
              >
                <path
                  d="M120 184 Q150 210 180 184"
                  stroke="#b85a4a"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.2"
                />
                <path
                  d="M120 182 Q150 208 180 182"
                  stroke="#4a1a2e"
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

              {/* Excited happy smile - always rendered, opacity controlled */}
              <g
                style={{
                  opacity: (isExcited && !isSurprised) ? 1 : 0,
                  willChange: 'opacity',
                  transform: 'translateZ(0)'
                }}
                className="mouth-excited"
              >
                <path
                  d="M117 186 C125 188, 135 214, 150 214 C165 214, 175 188, 183 186"
                  fill="#b85a4a"
                  opacity="0.15"
                />
                <path
                  d="M120 183 C128 185, 138 210, 150 210 C162 210, 172 185, 180 183"
                  fill="#4a1a2e"
                />
                <path
                  d="M124 186 C130 188, 140 205, 150 205 C160 205, 170 188, 176 186"
                  fill="#2d0f1a"
                />
                <ellipse cx="150" cy="198" rx="11" ry="7" fill="#e88d7d" />
                <ellipse cx="147" cy="195" rx="6" ry="3.5" fill="#f8b4a0" opacity="0.6" />
                <path
                  d="M122 184 C130 185, 140 208, 150 208"
                  fill="none"
                  stroke="#f8b4a0"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.2"
                />
              </g>
            </g>

            {/* ROUNDER BLUSH CHEEKS - more integrated */}
            {/* Left cheek - layered for softer blend */}
            <g>
              <ellipse cx="85" cy="170" rx="22" ry="16" fill="#e88d7d" opacity="0.15" />
              <ellipse cx="85" cy="172" rx="16" ry="12" fill="url(#blushGrad3D)" />
              <ellipse cx="82" cy="169" rx="6" ry="4" fill="#ffffff" opacity="0.25" />
            </g>
            {/* Right cheek */}
            <g>
              <ellipse cx="215" cy="170" rx="22" ry="16" fill="#e88d7d" opacity="0.15" />
              <ellipse cx="215" cy="172" rx="16" ry="12" fill="url(#blushGrad3D)" />
              <ellipse cx="212" cy="169" rx="6" ry="4" fill="#ffffff" opacity="0.25" />
            </g>

            {/* CUTE DETAILED FEET */}
            {/* Left foot */}
            <g>
              {/* Foot shadow underneath */}
              <ellipse cx="120" cy="258" rx="22" ry="8" fill="#00000015" />

              {/* Main foot shape - rounder, more organic */}
              <path
                d="M94 248
                 C94 235, 105 228, 120 228
                 C135 228, 146 235, 146 248
                 C146 260, 135 268, 120 268
                 C105 268, 94 260, 94 248Z"
                fill="url(#footGrad3D)"
                stroke="url(#outlineGrad3D)"
                strokeWidth="3.5"
              />

              {/* Bottom shadow for 3D depth */}
              <path
                d="M98 255 C98 260, 108 266, 120 266 C132 266, 142 260, 142 255 C142 262, 132 268, 120 268 C108 268, 98 262, 98 255Z"
                fill="url(#footShadowGrad)"
              />

              {/* Toe bumps - cute rounded toes */}
              <ellipse cx="106" cy="262" rx="8" ry="6" fill="url(#footGrad3D)" stroke="url(#outlineGrad3D)" strokeWidth="2" />
              <ellipse cx="120" cy="264" rx="9" ry="7" fill="url(#footGrad3D)" stroke="url(#outlineGrad3D)" strokeWidth="2" />
              <ellipse cx="134" cy="262" rx="8" ry="6" fill="url(#footGrad3D)" stroke="url(#outlineGrad3D)" strokeWidth="2" />

              {/* Toe highlights */}
              <ellipse cx="104" cy="259" rx="4" ry="3" fill="url(#toeGrad)" />
              <ellipse cx="118" cy="260" rx="5" ry="3.5" fill="url(#toeGrad)" />
              <ellipse cx="132" cy="259" rx="4" ry="3" fill="url(#toeGrad)" />

              {/* Main foot gloss highlights */}
              <ellipse cx="110" cy="238" rx="14" ry="9" fill="#ffffff" opacity="0.55" />
              <ellipse cx="105" cy="242" rx="7" ry="5" fill="#ffffff" opacity="0.35" />

              {/* Tiny sparkle accent */}
              <circle cx="130" cy="235" r="2" fill="#ffffff" opacity="0.6" />
            </g>

            {/* Right foot */}
            <g>
              {/* Foot shadow underneath */}
              <ellipse cx="180" cy="258" rx="22" ry="8" fill="#00000015" />

              {/* Main foot shape */}
              <path
                d="M154 248
                 C154 235, 165 228, 180 228
                 C195 228, 206 235, 206 248
                 C206 260, 195 268, 180 268
                 C165 268, 154 260, 154 248Z"
                fill="url(#footGrad3D)"
                stroke="url(#outlineGrad3D)"
                strokeWidth="3.5"
              />

              {/* Bottom shadow for 3D depth */}
              <path
                d="M158 255 C158 260, 168 266, 180 266 C192 266, 202 260, 202 255 C202 262, 192 268, 180 268 C168 268, 158 262, 158 255Z"
                fill="url(#footShadowGrad)"
              />

              {/* Toe bumps */}
              <ellipse cx="166" cy="262" rx="8" ry="6" fill="url(#footGrad3D)" stroke="url(#outlineGrad3D)" strokeWidth="2" />
              <ellipse cx="180" cy="264" rx="9" ry="7" fill="url(#footGrad3D)" stroke="url(#outlineGrad3D)" strokeWidth="2" />
              <ellipse cx="194" cy="262" rx="8" ry="6" fill="url(#footGrad3D)" stroke="url(#outlineGrad3D)" strokeWidth="2" />

              {/* Toe highlights */}
              <ellipse cx="164" cy="259" rx="4" ry="3" fill="url(#toeGrad)" />
              <ellipse cx="178" cy="260" rx="5" ry="3.5" fill="url(#toeGrad)" />
              <ellipse cx="192" cy="259" rx="4" ry="3" fill="url(#toeGrad)" />

              {/* Main foot gloss highlights */}
              <ellipse cx="170" cy="238" rx="14" ry="9" fill="#ffffff" opacity="0.55" />
              <ellipse cx="165" cy="242" rx="7" ry="5" fill="#ffffff" opacity="0.35" />

              {/* Tiny sparkle accent */}
              <circle cx="190" cy="235" r="2" fill="#ffffff" opacity="0.6" />
            </g>

            {/* Floating mini heart */}
            <g>
              <path
                d="M240 195 C240 188, 247 183, 252 188 C257 183, 264 188, 264 195 C264 204, 252 212, 252 212 C252 212, 240 204, 240 195"
                fill="#e88d7d"
                opacity="0.7"
              >
                <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.8s" repeatCount="indefinite" />
                <animateTransform attributeName="transform" type="translate" values="0,0; 0,-5; 0,0" dur="2s" repeatCount="indefinite" />
                <animateTransform attributeName="transform" type="scale" values="1;1.15;1" dur="1.8s" repeatCount="indefinite" additive="sum" />
              </path>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default NurseQuizMascot;
