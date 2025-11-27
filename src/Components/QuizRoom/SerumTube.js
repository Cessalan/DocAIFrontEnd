import React, { useMemo, useEffect, useState } from 'react';

/**
 * SerumTube - Realistic animated science test tube that fills with glowing liquid
 * as the user answers questions correctly.
 */
const SerumTube = ({
  correctCount = 0,
  totalQuestions = 10,
  isAnimating = false,
  size = 320,
  className = ''
}) => {
  const [showBubbles, setShowBubbles] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevCorrectCount, setPrevCorrectCount] = useState(correctCount);
  const [glowIntensity, setGlowIntensity] = useState(0);

  // Calculate fill percentage
  const fillPercentage = useMemo(() => {
    if (totalQuestions === 0) return 0;
    return Math.min((correctCount / totalQuestions) * 100, 100);
  }, [correctCount, totalQuestions]);

  // Trigger animations when correctCount increases
  useEffect(() => {
    if (correctCount > prevCorrectCount) {
      setShowBubbles(true);
      setGlowIntensity(1);

      // Check if we hit a milestone
      const prevPercentage = (prevCorrectCount / totalQuestions) * 100;
      const newPercentage = (correctCount / totalQuestions) * 100;

      if (
        (prevPercentage < 25 && newPercentage >= 25) ||
        (prevPercentage < 50 && newPercentage >= 50) ||
        (prevPercentage < 75 && newPercentage >= 75) ||
        (prevPercentage < 100 && newPercentage >= 100)
      ) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 1500);
      }

      setTimeout(() => {
        setShowBubbles(false);
        setGlowIntensity(0);
      }, 1500);
      setPrevCorrectCount(correctCount);
    }
  }, [correctCount, prevCorrectCount, totalQuestions]);

  // Dimensions
  const tubeWidth = size * 0.32;
  const tubeHeight = size;
  const viewBoxWidth = 140;
  const viewBoxHeight = 380;

  // Liquid calculations
  const tubeInnerTop = 65;
  const tubeInnerBottom = 340;
  const liquidMaxHeight = tubeInnerBottom - tubeInnerTop;
  const liquidHeight = (fillPercentage / 100) * liquidMaxHeight;
  const liquidTop = tubeInnerBottom - liquidHeight;

  return (
    <div
      className={`serum-tube-container ${className} ${showCelebration ? 'celebrating' : ''} ${fillPercentage >= 100 ? 'complete' : ''}`}
      style={{ width: tubeWidth + 60, height: tubeHeight + 40 }}
    >
      <svg
        width={tubeWidth + 60}
        height={tubeHeight + 40}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Realistic glass gradient */}
          <linearGradient id="glassBody" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="15%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="85%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
          </linearGradient>

          {/* Glass edge highlight */}
          <linearGradient id="glassEdgeLeft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          <linearGradient id="glassEdgeRight" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Glowing cyan liquid gradient */}
          <linearGradient id="liquidGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#0891b2" />
            <stop offset="20%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="80%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#a5f3fc" />
          </linearGradient>

          {/* Liquid glow */}
          <radialGradient id="liquidGlow" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0891b2" stopOpacity="0.4" />
          </radialGradient>

          {/* Liquid shine overlay */}
          <linearGradient id="liquidShine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Cork/stopper gradient */}
          <linearGradient id="corkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e8d5b7" />
            <stop offset="20%" stopColor="#d4b896" />
            <stop offset="50%" stopColor="#c4a67a" />
            <stop offset="80%" stopColor="#a8895e" />
            <stop offset="100%" stopColor="#8b7049" />
          </linearGradient>

          <linearGradient id="corkSide" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a8895e" />
            <stop offset="50%" stopColor="#c4a67a" />
            <stop offset="100%" stopColor="#8b7049" />
          </linearGradient>

          {/* Glow filter for liquid */}
          <filter id="liquidGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Strong glow for celebration */}
          <filter id="strongGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="16" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Clip path for liquid inside tube */}
          <clipPath id="tubeInterior">
            <path d={`
              M 35 ${tubeInnerTop}
              L 35 320
              Q 35 345 70 345
              Q 105 345 105 320
              L 105 ${tubeInnerTop}
              Z
            `} />
          </clipPath>

          {/* Bubble gradient */}
          <radialGradient id="bubbleGrad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="50%" stopColor="rgba(167,243,252,0.4)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.1)" />
          </radialGradient>
        </defs>

        {/* Tube shadow on ground */}
        <ellipse
          cx="70"
          cy="365"
          rx="35"
          ry="8"
          fill="rgba(0,0,0,0.3)"
          filter="url(#liquidGlowFilter)"
        />

        {/* Cork/Stopper */}
        <g className="cork">
          {/* Cork body */}
          <rect
            x="42"
            y="20"
            width="56"
            height="35"
            rx="4"
            fill="url(#corkGradient)"
          />
          {/* Cork bottom rim */}
          <ellipse cx="70" cy="55" rx="28" ry="6" fill="#a8895e" />
          <ellipse cx="70" cy="53" rx="26" ry="5" fill="#c4a67a" />
          {/* Cork top */}
          <ellipse cx="70" cy="20" rx="28" ry="6" fill="#d4b896" />
          <ellipse cx="70" cy="18" rx="24" ry="4" fill="#e8d5b7" />
          {/* Cork texture lines */}
          {[0, 1, 2, 3].map(i => (
            <line
              key={i}
              x1={50 + i * 12}
              y1="25"
              x2={50 + i * 12}
              y2="50"
              stroke="#8b7049"
              strokeWidth="0.5"
              opacity="0.3"
            />
          ))}
        </g>

        {/* Main glass tube */}
        <g className="tube-glass">
          {/* Tube neck */}
          <path
            d={`
              M 40 55
              L 40 65
              L 30 75
              L 30 320
              Q 30 350 70 350
              Q 110 350 110 320
              L 110 75
              L 100 65
              L 100 55
            `}
            fill="url(#glassBody)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />

          {/* Inner glass effect */}
          <path
            d={`
              M 35 65
              L 35 320
              Q 35 345 70 345
              Q 105 345 105 320
              L 105 65
            `}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        </g>

        {/* Liquid inside tube */}
        <g clipPath="url(#tubeInterior)">
          {/* Main liquid body with glow */}
          <g filter={showCelebration || glowIntensity > 0 ? "url(#strongGlow)" : undefined}>
            <rect
              x="35"
              y={liquidTop}
              width="70"
              height={liquidHeight + 30}
              fill="url(#liquidGradient)"
              style={{
                transition: 'y 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            />
          </g>

          {/* Liquid surface meniscus */}
          {fillPercentage > 0 && (
            <ellipse
              cx="70"
              cy={liquidTop}
              rx="34"
              ry="8"
              fill="url(#liquidGlow)"
              style={{
                transition: 'cy 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <animate
                attributeName="ry"
                values="8;10;8"
                dur="3s"
                repeatCount="indefinite"
              />
            </ellipse>
          )}

          {/* Liquid shine/reflection */}
          {fillPercentage > 0 && (
            <rect
              x="40"
              y={liquidTop + 5}
              width="15"
              height={liquidHeight - 10}
              fill="url(#liquidShine)"
              opacity="0.6"
              style={{
                transition: 'y 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            />
          )}

          {/* Animated bubbles when filling */}
          {showBubbles && (
            <g className="rising-bubbles">
              {[...Array(12)].map((_, i) => {
                const bubbleX = 45 + Math.random() * 50;
                const bubbleSize = 3 + Math.random() * 6;
                const delay = i * 0.08;
                const duration = 0.8 + Math.random() * 0.4;
                return (
                  <circle
                    key={i}
                    cx={bubbleX}
                    cy={tubeInnerBottom - 10}
                    r={bubbleSize}
                    fill="url(#bubbleGrad)"
                  >
                    <animate
                      attributeName="cy"
                      from={tubeInnerBottom - 10}
                      to={liquidTop - 20}
                      dur={`${duration}s`}
                      begin={`${delay}s`}
                      fill="freeze"
                    />
                    <animate
                      attributeName="r"
                      from={bubbleSize}
                      to={bubbleSize * 0.5}
                      dur={`${duration}s`}
                      begin={`${delay}s`}
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.8"
                      to="0"
                      dur={`${duration}s`}
                      begin={`${delay}s`}
                      fill="freeze"
                    />
                  </circle>
                );
              })}
            </g>
          )}

          {/* Ambient bubbles in liquid */}
          {fillPercentage > 15 && (
            <g className="ambient-bubbles">
              {[...Array(6)].map((_, i) => {
                const baseX = 45 + (i * 10);
                const baseY = liquidTop + liquidHeight * 0.3 + (i * 15);
                const size = 2 + (i % 3);
                return (
                  <circle
                    key={i}
                    cx={baseX}
                    r={size}
                    fill="url(#bubbleGrad)"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="cy"
                      values={`${baseY};${baseY - 30};${baseY}`}
                      dur={`${2.5 + i * 0.3}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0.9;0.6"
                      dur={`${2.5 + i * 0.3}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                );
              })}
            </g>
          )}
        </g>

        {/* Glass reflections/highlights */}
        <g className="glass-reflections">
          {/* Main left highlight */}
          <path
            d={`
              M 33 80
              L 33 300
              Q 34 310 38 310
              L 38 80
              Z
            `}
            fill="url(#glassEdgeLeft)"
          />

          {/* Secondary highlight */}
          <path
            d={`
              M 42 90
              Q 44 200 42 280
              L 44 280
              Q 46 200 44 90
              Z
            `}
            fill="rgba(255,255,255,0.15)"
          />

          {/* Right subtle edge */}
          <path
            d={`
              M 107 80
              L 107 300
              Q 106 310 102 310
              L 102 80
              Z
            `}
            fill="url(#glassEdgeRight)"
            opacity="0.5"
          />

          {/* Top rim highlight */}
          <ellipse
            cx="70"
            cy="65"
            rx="32"
            ry="4"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
          />
        </g>

        {/* Measurement marks */}
        <g className="measurements" opacity="0.4">
          {[25, 50, 75, 100].map((mark, i) => {
            const y = tubeInnerBottom - (mark / 100) * liquidMaxHeight;
            return (
              <g key={i}>
                <line
                  x1="108"
                  y1={y}
                  x2="118"
                  y2={y}
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth="1.5"
                />
                <text
                  x="122"
                  y={y + 4}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="11"
                  fontFamily="system-ui"
                >
                  {mark}%
                </text>
              </g>
            );
          })}
        </g>

        {/* Celebration particles */}
        {showCelebration && (
          <g className="celebration">
            {[...Array(16)].map((_, i) => {
              const angle = (i / 16) * Math.PI * 2;
              const distance = 70 + Math.random() * 40;
              const endX = 70 + Math.cos(angle) * distance;
              const endY = 180 + Math.sin(angle) * distance;
              const colors = ['#22d3ee', '#a855f7', '#f472b6', '#67e8f9', '#c084fc', '#34d399'];
              const size = 4 + Math.random() * 4;
              return (
                <circle
                  key={i}
                  cx="70"
                  cy="180"
                  r={size}
                  fill={colors[i % colors.length]}
                >
                  <animate
                    attributeName="cx"
                    from="70"
                    to={endX}
                    dur="0.8s"
                    fill="freeze"
                    begin="0s"
                  />
                  <animate
                    attributeName="cy"
                    from="180"
                    to={endY}
                    dur="0.8s"
                    fill="freeze"
                    begin="0s"
                  />
                  <animate
                    attributeName="opacity"
                    from="1"
                    to="0"
                    dur="0.8s"
                    fill="freeze"
                    begin="0s"
                  />
                </circle>
              );
            })}
            {/* Sparkle stars */}
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
              const distance = 50 + Math.random() * 30;
              const endX = 70 + Math.cos(angle) * distance;
              const endY = 180 + Math.sin(angle) * distance;
              return (
                <text
                  key={`star-${i}`}
                  x="70"
                  y="180"
                  fontSize="14"
                  fill="#fcd34d"
                  textAnchor="middle"
                >
                  ✦
                  <animate
                    attributeName="x"
                    from="70"
                    to={endX}
                    dur="0.7s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="y"
                    from="180"
                    to={endY}
                    dur="0.7s"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    from="1"
                    to="0"
                    dur="0.7s"
                    fill="freeze"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 70 180"
                    to="180 70 180"
                    dur="0.7s"
                    fill="freeze"
                  />
                </text>
              );
            })}
          </g>
        )}

        {/* Ambient glow when liquid is present */}
        {fillPercentage > 0 && (
          <ellipse
            cx="70"
            cy={liquidTop + liquidHeight / 2}
            rx="50"
            ry={liquidHeight / 2 + 20}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1"
            opacity={0.15 + (fillPercentage / 100) * 0.2}
            filter="url(#liquidGlowFilter)"
            style={{
              transition: 'all 0.8s ease'
            }}
          >
            <animate
              attributeName="opacity"
              values={`${0.15 + (fillPercentage / 100) * 0.2};${0.25 + (fillPercentage / 100) * 0.2};${0.15 + (fillPercentage / 100) * 0.2}`}
              dur="3s"
              repeatCount="indefinite"
            />
          </ellipse>
        )}
      </svg>

      {/* Score display */}
      <div className="serum-tube-score">
        <span className="score-correct">{correctCount}</span>
        <span className="score-divider">/</span>
        <span className="score-total">{totalQuestions}</span>
      </div>
    </div>
  );
};

export default SerumTube;
