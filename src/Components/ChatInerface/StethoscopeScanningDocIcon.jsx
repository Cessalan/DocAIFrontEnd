import React from 'react';

const PurpleScanningDocIcon = ({ size = 80 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 260 260"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <style>
        {`
          @keyframes float-doc {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }

          @keyframes pulse-doc {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.015); opacity: 0.98; }
          }

          @keyframes scan-sweep {
            0% { transform: translateY(-140px); opacity: 0; }
            15% { opacity: 1; }
            85% { opacity: 1; }
            100% { transform: translateY(140px); opacity: 0; }
          }

          /* Sparkle animation */
          @keyframes sparkle-float {
            0%, 100% { opacity: 0; transform: scale(0); }
            50% { opacity: 1; transform: scale(1); }
          }

          .float { animation: float-doc 2.8s ease-in-out infinite; }
          .pulse { animation: pulse-doc 2.5s ease-in-out infinite; }
          .scan { animation: scan-sweep 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

          .sparkle {
            animation: sparkle-float 1.8s ease-in-out infinite;
            transform-origin: center;
          }
          .sparkle-1 { animation-delay: 0s; }
          .sparkle-2 { animation-delay: 0.4s; }
          .sparkle-3 { animation-delay: 0.8s; }
        `}
      </style>

      {/* Soft shadow */}
      <ellipse cx="130" cy="225" rx="70" ry="15" fill="rgba(80,0,120,0.08)" />

      {/* Document */}
      <g className="float pulse">
        <rect
          x="70"
          y="55"
          width="120"
          height="150"
          rx="14"
          fill="url(#purpleDoc)"
          stroke="#E8D7FF"
          strokeWidth="3"
        />

        {/* Lines */}
        <rect x="90" y="80" width="80" height="8" rx="4" fill="#F4E9FF" />
        <rect x="90" y="100" width="70" height="8" rx="4" fill="#F4E9FF" />
        <rect x="90" y="120" width="85" height="8" rx="4" fill="#F4E9FF" />
        <rect x="90" y="140" width="65" height="8" rx="4" fill="#F4E9FF" />

        {/* Mini chart */}
        <path
          d="M105 170 L115 155 L125 165 L135 150"
          stroke="#C7A0FF"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="115" cy="155" r="3" fill="#C7A0FF" />
      </g>

      {/* Scan sweep */}
      <g clipPath="url(#clipDoc)">
        <rect
          x="70"
          y="55"
          width="120"
          height="40"
          fill="url(#purpleScan)"
          className="scan"
          opacity="0.9"
        />
      </g>

      {/* Sparkles */}
      <g className="sparkle sparkle-1" transform="translate(185, 80)">
        <path
          d="M 0 -3 L 2 0 L 0 3 L -2 0 Z"
          fill="#D8B6FF"
        />
        <circle cx="0" cy="0" r="1.5" fill="#F7E9FF" />
      </g>

      <g className="sparkle sparkle-2" transform="translate(165, 140)">
        <path
          d="M 0 -4 L 3 0 L 0 4 L -3 0 Z"
          fill="#CFA7FF"
        />
        <circle cx="0" cy="0" r="2" fill="#F7E9FF" />
      </g>

      <g className="sparkle sparkle-3" transform="translate(110, 60)">
        <path
          d="M 0 -3 L 2 0 L 0 3 L -2 0 Z"
          fill="#E0C4FF"
        />
        <circle cx="0" cy="0" r="1.5" fill="#FFFFFF" />
      </g>

      <defs>
        {/* Document gradient */}
        <linearGradient id="purpleDoc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FBF6FF" />
        </linearGradient>

        {/* Scan bar */}
        <linearGradient id="purpleScan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(190,140,255,0)" />
          <stop offset="50%" stopColor="rgba(190,140,255,0.55)" />
          <stop offset="100%" stopColor="rgba(190,140,255,0)" />
        </linearGradient>

        <clipPath id="clipDoc">
          <rect x="70" y="55" width="120" height="150" rx="14" />
        </clipPath>
      </defs>
    </svg>
  );
};

export default PurpleScanningDocIcon;
