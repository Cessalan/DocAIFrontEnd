import React, { useMemo, useEffect, useState } from 'react';

/**
 * SerumTube - Realistic science lab test tube with glowing serum
 * Features proper borosilicate glass appearance and lab aesthetics
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
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains('dark-mode'));
  const [isHovered, setIsHovered] = useState(false);

  // Listen for dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains('dark-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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

  // Dimensions - taller and thinner like a real test tube
  const tubeWidth = size * 0.25;
  const tubeHeight = size;
  const viewBoxWidth = 120;
  const viewBoxHeight = 400;

  // Tube geometry - narrower, taller proportions
  const tubeOuterLeft = 35;
  const tubeOuterRight = 85;
  const tubeInnerLeft = 40;
  const tubeInnerRight = 80;
  const tubeTop = 50;
  const tubeBottom = 370;
  const roundedBottom = 355;

  // Liquid calculations
  const liquidMaxHeight = roundedBottom - tubeTop - 20;
  const liquidHeight = (fillPercentage / 100) * liquidMaxHeight;
  const liquidTop = roundedBottom - liquidHeight;

  // Glass thickness visual
  const glassThickness = 5;

  return (
    <div
      className={`serum-tube-container ${className} ${showCelebration ? 'celebrating' : ''} ${fillPercentage >= 100 ? 'complete' : ''} ${isHovered ? 'hovered' : ''}`}
      style={{ width: tubeWidth + 80, height: tubeHeight + 30 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover tooltip */}
      <div className={`serum-tube-tooltip ${isHovered ? 'visible' : ''}`}>
        <span className="tooltip-text">The patient in Room 217 needs 1 tube a day to survive</span>
      </div>
      <svg
        width={tubeWidth + 80}
        height={tubeHeight + 30}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Borosilicate glass gradient - realistic lab glass */}
          <linearGradient id="labGlassGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {isDarkMode ? (
              <>
                <stop offset="0%" stopColor="rgba(180,200,220,0.35)" />
                <stop offset="20%" stopColor="rgba(200,215,230,0.15)" />
                <stop offset="50%" stopColor="rgba(210,225,240,0.08)" />
                <stop offset="80%" stopColor="rgba(200,215,230,0.15)" />
                <stop offset="100%" stopColor="rgba(180,200,220,0.3)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="rgba(70,90,120,0.45)" />
                <stop offset="20%" stopColor="rgba(90,110,140,0.25)" />
                <stop offset="50%" stopColor="rgba(120,140,170,0.12)" />
                <stop offset="80%" stopColor="rgba(90,110,140,0.25)" />
                <stop offset="100%" stopColor="rgba(70,90,120,0.4)" />
              </>
            )}
          </linearGradient>

          {/* Glass rim gradient */}
          <linearGradient id="rimGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {isDarkMode ? (
              <>
                <stop offset="0%" stopColor="rgba(150,170,200,0.6)" />
                <stop offset="50%" stopColor="rgba(200,220,240,0.3)" />
                <stop offset="100%" stopColor="rgba(150,170,200,0.5)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="rgba(60,80,110,0.7)" />
                <stop offset="50%" stopColor="rgba(100,130,170,0.4)" />
                <stop offset="100%" stopColor="rgba(60,80,110,0.6)" />
              </>
            )}
          </linearGradient>

          {/* Left glass highlight - reflection */}
          <linearGradient id="glassHighlightLeft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.8)"} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Right glass shadow */}
          <linearGradient id="glassShadowRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor={isDarkMode ? "rgba(0,0,0,0.15)" : "rgba(50,70,100,0.25)"} />
          </linearGradient>

          {/* Serum/liquid gradient - bioluminescent cyan */}
          <linearGradient id="serumGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#0e7490" />
            <stop offset="30%" stopColor="#0891b2" />
            <stop offset="60%" stopColor="#06b6d4" />
            <stop offset="85%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>

          {/* Serum horizontal gradient for depth */}
          <linearGradient id="serumDepth" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.15)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
          </linearGradient>

          {/* Meniscus gradient */}
          <radialGradient id="meniscusGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.5" />
          </radialGradient>

          {/* Glow filter */}
          <filter id="serumGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Strong glow for milestones */}
          <filter id="celebrationGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur1" />
            <feGaussianBlur stdDeviation="12" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Clip path for liquid */}
          <clipPath id="tubeClip">
            <path d={`
              M ${tubeInnerLeft} ${tubeTop + 15}
              L ${tubeInnerLeft} ${roundedBottom - 20}
              Q ${tubeInnerLeft} ${tubeBottom - 15} 60 ${tubeBottom - 15}
              Q ${tubeInnerRight} ${tubeBottom - 15} ${tubeInnerRight} ${roundedBottom - 20}
              L ${tubeInnerRight} ${tubeTop + 15}
              Z
            `} />
          </clipPath>

          {/* Bubble gradient */}
          <radialGradient id="bubbleGradient" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="40%" stopColor="rgba(165,243,252,0.5)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.2)" />
          </radialGradient>
        </defs>

        {/* Tube stand/holder base */}
        <ellipse
          cx="60"
          cy={tubeBottom + 5}
          rx="25"
          ry="6"
          fill={isDarkMode ? "rgba(80,80,90,0.5)" : "rgba(100,110,130,0.4)"}
        />
        <rect
          x="50"
          y={tubeBottom - 10}
          width="20"
          height="15"
          rx="2"
          fill={isDarkMode ? "rgba(100,100,110,0.6)" : "rgba(80,90,110,0.5)"}
        />

        {/* Main glass tube body */}
        <g className="tube-body">
          {/* Outer glass wall */}
          <path
            d={`
              M ${tubeOuterLeft} ${tubeTop}
              L ${tubeOuterLeft} ${roundedBottom - 15}
              Q ${tubeOuterLeft} ${tubeBottom} 60 ${tubeBottom}
              Q ${tubeOuterRight} ${tubeBottom} ${tubeOuterRight} ${roundedBottom - 15}
              L ${tubeOuterRight} ${tubeTop}
            `}
            fill="url(#labGlassGradient)"
            stroke={isDarkMode ? "rgba(180,200,220,0.4)" : "rgba(70,90,120,0.5)"}
            strokeWidth="1.5"
          />

          {/* Inner wall indication */}
          <path
            d={`
              M ${tubeInnerLeft} ${tubeTop + 5}
              L ${tubeInnerLeft} ${roundedBottom - 20}
              Q ${tubeInnerLeft} ${tubeBottom - 15} 60 ${tubeBottom - 15}
              Q ${tubeInnerRight} ${tubeBottom - 15} ${tubeInnerRight} ${roundedBottom - 20}
              L ${tubeInnerRight} ${tubeTop + 5}
            `}
            fill="none"
            stroke={isDarkMode ? "rgba(200,220,240,0.2)" : "rgba(100,130,170,0.25)"}
            strokeWidth="1"
          />

          {/* Flared rim at top */}
          <path
            d={`
              M ${tubeOuterLeft - 3} ${tubeTop}
              Q ${tubeOuterLeft - 5} ${tubeTop - 8} ${tubeOuterLeft} ${tubeTop - 12}
              L ${tubeOuterRight} ${tubeTop - 12}
              Q ${tubeOuterRight + 5} ${tubeTop - 8} ${tubeOuterRight + 3} ${tubeTop}
              Z
            `}
            fill="url(#rimGradient)"
            stroke={isDarkMode ? "rgba(180,200,220,0.5)" : "rgba(70,90,120,0.6)"}
            strokeWidth="1"
          />

          {/* Rim top edge */}
          <ellipse
            cx="60"
            cy={tubeTop - 12}
            rx="28"
            ry="4"
            fill="none"
            stroke={isDarkMode ? "rgba(200,220,240,0.6)" : "rgba(90,110,140,0.7)"}
            strokeWidth="1.5"
          />
        </g>

        {/* Liquid/Serum inside tube */}
        <g clipPath="url(#tubeClip)">
          {/* Main liquid body */}
          <g filter={showCelebration || glowIntensity > 0 ? "url(#celebrationGlow)" : "url(#serumGlow)"}>
            <rect
              x={tubeInnerLeft}
              y={liquidTop}
              width={tubeInnerRight - tubeInnerLeft}
              height={liquidHeight + 40}
              fill="url(#serumGradient)"
              style={{
                transition: 'y 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            />
            {/* Depth overlay */}
            <rect
              x={tubeInnerLeft}
              y={liquidTop}
              width={tubeInnerRight - tubeInnerLeft}
              height={liquidHeight + 40}
              fill="url(#serumDepth)"
              style={{
                transition: 'y 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            />
          </g>

          {/* Meniscus - curved liquid surface */}
          {fillPercentage > 0 && (
            <ellipse
              cx="60"
              cy={liquidTop}
              rx="19"
              ry="6"
              fill="url(#meniscusGlow)"
              style={{
                transition: 'cy 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <animate
                attributeName="ry"
                values="6;8;6"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </ellipse>
          )}

          {/* Animated bubbles when filling */}
          {showBubbles && (
            <g className="rising-bubbles">
              {[...Array(10)].map((_, i) => {
                const bubbleX = tubeInnerLeft + 5 + Math.random() * (tubeInnerRight - tubeInnerLeft - 10);
                const bubbleSize = 2 + Math.random() * 4;
                const delay = i * 0.1;
                const duration = 0.7 + Math.random() * 0.4;
                return (
                  <circle
                    key={i}
                    cx={bubbleX}
                    cy={roundedBottom - 20}
                    r={bubbleSize}
                    fill="url(#bubbleGradient)"
                  >
                    <animate
                      attributeName="cy"
                      from={roundedBottom - 20}
                      to={liquidTop - 10}
                      dur={`${duration}s`}
                      begin={`${delay}s`}
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.9"
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

          {/* Ambient bubbles */}
          {fillPercentage > 20 && (
            <g className="ambient-bubbles">
              {[...Array(4)].map((_, i) => {
                const baseX = tubeInnerLeft + 8 + (i * 8);
                const baseY = liquidTop + liquidHeight * 0.4 + (i * 20);
                const size = 1.5 + (i % 2);
                return (
                  <circle
                    key={i}
                    cx={baseX}
                    r={size}
                    fill="url(#bubbleGradient)"
                    opacity="0.7"
                  >
                    <animate
                      attributeName="cy"
                      values={`${baseY};${baseY - 25};${baseY}`}
                      dur={`${2 + i * 0.4}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                );
              })}
            </g>
          )}
        </g>

        {/* Glass reflections/highlights */}
        <g className="glass-highlights">
          {/* Main left highlight streak */}
          <path
            d={`
              M ${tubeOuterLeft + 2} ${tubeTop + 10}
              L ${tubeOuterLeft + 2} ${roundedBottom - 30}
              Q ${tubeOuterLeft + 3} ${roundedBottom - 20} ${tubeOuterLeft + 6} ${roundedBottom - 15}
              L ${tubeOuterLeft + 8} ${roundedBottom - 15}
              Q ${tubeOuterLeft + 5} ${roundedBottom - 20} ${tubeOuterLeft + 5} ${roundedBottom - 30}
              L ${tubeOuterLeft + 5} ${tubeTop + 10}
              Z
            `}
            fill="url(#glassHighlightLeft)"
          />

          {/* Secondary thin highlight */}
          <line
            x1={tubeOuterLeft + 8}
            y1={tubeTop + 20}
            x2={tubeOuterLeft + 8}
            y2={roundedBottom - 40}
            stroke={isDarkMode ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.45)"}
            strokeWidth="1"
          />

          {/* Right shadow edge */}
          <path
            d={`
              M ${tubeOuterRight - 2} ${tubeTop + 10}
              L ${tubeOuterRight - 2} ${roundedBottom - 30}
              Q ${tubeOuterRight - 3} ${roundedBottom - 20} ${tubeOuterRight - 6} ${roundedBottom - 15}
              L ${tubeOuterRight - 8} ${roundedBottom - 15}
              Q ${tubeOuterRight - 5} ${roundedBottom - 20} ${tubeOuterRight - 5} ${roundedBottom - 30}
              L ${tubeOuterRight - 5} ${tubeTop + 10}
              Z
            `}
            fill="url(#glassShadowRight)"
          />
        </g>

        {/* Measurement graduations - etched into glass */}
        <g className="graduations" opacity={isDarkMode ? "0.5" : "0.8"}>
          {[20, 40, 60, 80, 100].map((mark, i) => {
            const y = roundedBottom - 20 - ((mark / 100) * liquidMaxHeight);
            const isMain = mark % 50 === 0;
            return (
              <g key={i}>
                {/* Graduation line */}
                <line
                  x1={tubeOuterRight + 2}
                  y1={y}
                  x2={tubeOuterRight + (isMain ? 12 : 8)}
                  y2={y}
                  stroke={isDarkMode ? "rgba(180,200,220,0.6)" : "rgba(60,80,110,0.7)"}
                  strokeWidth={isMain ? "1.5" : "1"}
                />
                {/* Label for main marks */}
                {isMain && (
                  <text
                    x={tubeOuterRight + 15}
                    y={y + 4}
                    fill={isDarkMode ? "rgba(180,200,220,0.7)" : "rgba(60,80,110,0.85)"}
                    fontSize="10"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fontWeight="500"
                  >
                    {mark === 100 ? 'mL' : mark}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Celebration particles */}
        {showCelebration && (
          <g className="celebration">
            {[...Array(12)].map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const distance = 50 + Math.random() * 30;
              const endX = 60 + Math.cos(angle) * distance;
              const endY = 200 + Math.sin(angle) * distance;
              const colors = ['#22d3ee', '#a855f7', '#f472b6', '#67e8f9', '#c084fc'];
              const size = 3 + Math.random() * 3;
              return (
                <circle
                  key={i}
                  cx="60"
                  cy="200"
                  r={size}
                  fill={colors[i % colors.length]}
                >
                  <animate attributeName="cx" from="60" to={endX} dur="0.8s" fill="freeze" />
                  <animate attributeName="cy" from="200" to={endY} dur="0.8s" fill="freeze" />
                  <animate attributeName="opacity" from="1" to="0" dur="0.8s" fill="freeze" />
                </circle>
              );
            })}
          </g>
        )}

        {/* Ambient glow around liquid */}
        {fillPercentage > 0 && (
          <ellipse
            cx="60"
            cy={liquidTop + liquidHeight / 2}
            rx="30"
            ry={liquidHeight / 2 + 15}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1"
            opacity={isDarkMode ? (0.2 + (fillPercentage / 100) * 0.2) : (0.1 + (fillPercentage / 100) * 0.15)}
            filter="url(#serumGlow)"
            style={{ transition: 'all 0.8s ease' }}
          >
            <animate
              attributeName="opacity"
              values={`${0.15 + (fillPercentage / 100) * 0.15};${0.25 + (fillPercentage / 100) * 0.15};${0.15 + (fillPercentage / 100) * 0.15}`}
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
