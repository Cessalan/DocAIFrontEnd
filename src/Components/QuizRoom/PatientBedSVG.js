import React from 'react';

/**
 * PatientBedSVG - Multiple patient variations for hospital bed scene
 * @param {number} variant - Patient variant (0-5)
 */
function PatientBedSVG({ variant = 0 }) {
  // Patient configurations for different appearances
  const patients = [
    // Variant 0: Original - Male, short brown hair, medium skin
    {
      skinColor: 'rgba(180,150,130,0.95)',
      skinColorDark: 'rgba(160,130,110,0.95)',
      hairColor: 'rgba(60,45,35,0.9)',
      hairStyle: 'short',
      gownColor: 'rgba(140,180,200,0.9)',
      gownColorDark: 'rgba(110,150,175,0.9)',
    },
    // Variant 1: Female, long dark hair, light skin
    {
      skinColor: 'rgba(225,195,175,0.95)',
      skinColorDark: 'rgba(205,175,155,0.95)',
      hairColor: 'rgba(35,25,20,0.95)',
      hairStyle: 'long',
      gownColor: 'rgba(200,160,180,0.9)',
      gownColorDark: 'rgba(170,130,155,0.9)',
    },
    // Variant 2: Male, bald/shaved, dark skin
    {
      skinColor: 'rgba(120,85,65,0.95)',
      skinColorDark: 'rgba(100,70,55,0.95)',
      hairColor: 'rgba(40,30,25,0.6)',
      hairStyle: 'bald',
      gownColor: 'rgba(140,180,200,0.9)',
      gownColorDark: 'rgba(110,150,175,0.9)',
    },
    // Variant 3: Female, grey/white hair (elderly), fair skin
    {
      skinColor: 'rgba(235,215,200,0.95)',
      skinColorDark: 'rgba(215,195,180,0.95)',
      hairColor: 'rgba(180,175,170,0.9)',
      hairStyle: 'short-curly',
      gownColor: 'rgba(180,200,180,0.9)',
      gownColorDark: 'rgba(150,175,155,0.9)',
    },
    // Variant 4: Child, medium brown hair, olive skin
    {
      skinColor: 'rgba(195,165,140,0.95)',
      skinColorDark: 'rgba(175,145,120,0.95)',
      hairColor: 'rgba(70,50,35,0.9)',
      hairStyle: 'messy',
      gownColor: 'rgba(255,200,150,0.9)',
      gownColorDark: 'rgba(235,175,130,0.9)',
      isChild: true,
    },
    // Variant 5: Female, black hair, Asian skin tone
    {
      skinColor: 'rgba(235,200,170,0.95)',
      skinColorDark: 'rgba(215,180,150,0.95)',
      hairColor: 'rgba(20,15,15,0.95)',
      hairStyle: 'long-straight',
      gownColor: 'rgba(170,190,210,0.9)',
      gownColorDark: 'rgba(140,160,185,0.9)',
    },
  ];

  const patient = patients[variant % patients.length];
  const isChild = patient.isChild || false;

  // Render different hair styles
  const renderHair = () => {
    switch (patient.hairStyle) {
      case 'long':
        return (
          <>
            {/* Long hair flowing on pillow */}
            <path
              d="M75 88 Q88 75, 101 88 Q105 92, 105 100 Q100 105, 88 105 Q76 105, 72 98 Q70 92, 75 88"
              fill={patient.hairColor}
            />
            {/* Hair strands on pillow */}
            <path d="M72 100 Q60 105, 55 115" stroke={patient.hairColor} strokeWidth="3" fill="none" />
            <path d="M70 102 Q58 108, 52 118" stroke={patient.hairColor} strokeWidth="2.5" fill="none" />
            <path d="M105 100 Q115 105, 120 112" stroke={patient.hairColor} strokeWidth="2" fill="none" />
          </>
        );
      case 'bald':
        return (
          <>
            {/* Very short stubble/shadow */}
            <ellipse cx="88" cy="92" rx="13" ry="12" fill={patient.hairColor} />
          </>
        );
      case 'short-curly':
        return (
          <>
            {/* Short curly/wavy hair */}
            <path d="M76 90 Q80 82, 88 80 Q96 82, 100 90" stroke={patient.hairColor} strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M78 87 Q82 83, 88 82 Q94 83, 98 87" stroke={patient.hairColor} strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* Some curl texture */}
            <circle cx="80" cy="86" r="2" fill={patient.hairColor} />
            <circle cx="88" cy="84" r="2" fill={patient.hairColor} />
            <circle cx="96" cy="86" r="2" fill={patient.hairColor} />
          </>
        );
      case 'messy':
        return (
          <>
            {/* Messy child hair */}
            <path d="M77 90 Q85 78, 95 88" stroke={patient.hairColor} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M80 88 Q88 80, 96 86" stroke={patient.hairColor} strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* Stray strands */}
            <path d="M82 85 L80 80" stroke={patient.hairColor} strokeWidth="2" strokeLinecap="round" />
            <path d="M92 84 L94 79" stroke={patient.hairColor} strokeWidth="2" strokeLinecap="round" />
          </>
        );
      case 'long-straight':
        return (
          <>
            {/* Long straight black hair */}
            <path
              d="M74 88 Q88 76, 102 88 Q104 95, 102 102 Q95 106, 88 106 Q81 106, 74 102 Q72 95, 74 88"
              fill={patient.hairColor}
            />
            {/* Straight hair on pillow */}
            <path d="M74 102 Q65 108, 58 120" stroke={patient.hairColor} strokeWidth="4" fill="none" />
            <path d="M72 104 Q62 112, 55 122" stroke={patient.hairColor} strokeWidth="3" fill="none" />
          </>
        );
      case 'short':
      default:
        return (
          <>
            {/* Short hair */}
            <path d="M77 92 Q88 82, 99 93" stroke={patient.hairColor} strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        );
    }
  };

  // Child has smaller proportions
  const headSize = isChild ? { rx: 10, ry: 9 } : { rx: 12, ry: 11 };
  const bodyScale = isChild ? 0.85 : 1;

  return (
    <svg className="hospital-bed-svg" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid meet">
      <defs>
        {/* Gradients for realistic shading */}
        <linearGradient id="bedFrameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(70,65,90,1)" />
          <stop offset="100%" stopColor="rgba(45,40,65,1)" />
        </linearGradient>
        {/* White/cream blanket gradient */}
        <linearGradient id="blanketGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(220,215,200,0.95)" />
          <stop offset="50%" stopColor="rgba(200,195,180,0.95)" />
          <stop offset="100%" stopColor="rgba(180,175,160,0.95)" />
        </linearGradient>
        {/* White pillow */}
        <linearGradient id="pillowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(240,238,230,0.98)" />
          <stop offset="100%" stopColor="rgba(210,205,195,0.95)" />
        </linearGradient>
        <linearGradient id="ivPoleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(140,138,150,1)" />
          <stop offset="50%" stopColor="rgba(170,168,180,1)" />
          <stop offset="100%" stopColor="rgba(130,128,140,1)" />
        </linearGradient>
        {/* Dark blue mattress */}
        <linearGradient id="mattressGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(60,70,100,1)" />
          <stop offset="100%" stopColor="rgba(45,55,85,1)" />
        </linearGradient>
        {/* Dynamic skin tone gradient */}
        <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={patient.skinColor} />
          <stop offset="100%" stopColor={patient.skinColorDark} />
        </linearGradient>
        {/* Dynamic hospital gown */}
        <linearGradient id="gownGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={patient.gownColor} />
          <stop offset="100%" stopColor={patient.gownColorDark} />
        </linearGradient>
      </defs>

      {/* IV Stand - Left side */}
      <g className="iv-stand">
        {/* IV Pole base */}
        <ellipse cx="30" cy="172" rx="20" ry="6" fill="rgba(80,78,95,0.9)" />
        <ellipse cx="30" cy="170" rx="16" ry="4" fill="rgba(100,98,115,0.9)" />
        {/* IV Pole */}
        <rect x="27" y="20" width="6" height="150" rx="3" fill="url(#ivPoleGrad)" />
        {/* IV Pole top hook */}
        <path d="M24 25 L24 18 Q24 12, 30 12 L30 12 Q36 12, 36 18 L36 25" stroke="rgba(150,148,165,1)" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* IV Bag holder hooks */}
        <path d="M18 28 Q18 20, 24 20" stroke="rgba(150,148,165,1)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M42 28 Q42 20, 36 20" stroke="rgba(150,148,165,1)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* IV Bag */}
        <rect x="14" y="24" width="18" height="28" rx="3" fill="rgba(230,245,250,0.85)" stroke="rgba(180,200,210,0.9)" strokeWidth="1" />
        <rect x="16" y="26" width="14" height="22" rx="2" fill="rgba(200,230,240,0.6)" />
        {/* Fluid level */}
        <rect x="16" y="32" width="14" height="16" rx="2" fill="rgba(180,220,235,0.7)" />
        {/* IV drip chamber */}
        <rect x="21" y="52" width="8" height="12" rx="2" fill="rgba(230,245,250,0.8)" stroke="rgba(180,200,210,0.8)" strokeWidth="0.5" />
        {/* IV Tube to patient */}
        <path d="M25 64 Q25 80, 40 95 Q60 115, 80 125" stroke="rgba(200,230,240,0.7)" strokeWidth="2" fill="none" />
      </g>

      {/* Hospital Bed Frame */}
      <g className="bed-frame">
        {/* Bed base/rails */}
        <rect x="50" y="138" width="225" height="10" rx="2" fill="url(#bedFrameGrad)" />
        {/* Bed legs */}
        <rect x="58" y="146" width="8" height="22" rx="2" fill="rgba(60,58,80,1)" />
        <rect x="258" y="146" width="8" height="22" rx="2" fill="rgba(60,58,80,1)" />
        {/* Bed wheels */}
        <ellipse cx="62" cy="170" rx="7" ry="4" fill="rgba(50,48,65,1)" />
        <ellipse cx="262" cy="170" rx="7" ry="4" fill="rgba(50,48,65,1)" />
        {/* Headboard */}
        <path d="M50 50 L50 138 L65 138 L65 65 Q65 55, 75 52 L50 50 Z" fill="url(#bedFrameGrad)" />
        <rect x="50" y="48" width="28" height="6" rx="2" fill="rgba(80,78,100,1)" />
        {/* Footboard */}
        <path d="M265 85 L265 138 L280 138 L280 90 Q280 82, 272 80 L265 85 Z" fill="url(#bedFrameGrad)" />
        <rect x="262" y="78" width="22" height="5" rx="2" fill="rgba(80,78,100,1)" />
        {/* Side safety rail */}
        <rect x="85" y="80" width="90" height="3" rx="1.5" fill="rgba(140,138,160,0.9)" />
        <rect x="85" y="80" width="3" height="30" rx="1" fill="rgba(140,138,160,0.9)" />
        <rect x="127" y="80" width="3" height="30" rx="1" fill="rgba(140,138,160,0.9)" />
        <rect x="172" y="80" width="3" height="30" rx="1" fill="rgba(140,138,160,0.9)" />
      </g>

      {/* Mattress */}
      <rect x="55" y="115" width="220" height="25" rx="3" fill="url(#mattressGrad)" />

      {/* Pillow */}
      <ellipse cx="90" cy="105" rx="32" ry="16" fill="url(#pillowGrad)" />
      <ellipse cx="90" cy="102" rx="28" ry="12" fill="rgba(250,248,242,0.7)" />

      {/* Patient - Dynamic based on variant */}
      {/* Patient head on pillow */}
      <ellipse cx="88" cy="98" rx={headSize.rx} ry={headSize.ry} fill="url(#skinGrad)" />

      {/* Hair - Dynamic style */}
      {renderHair()}

      {/* Ear */}
      <ellipse cx="100" cy="98" rx="3" ry="4" fill={patient.skinColorDark} />

      {/* Patient upper body/shoulders - hospital gown */}
      <path
        d={isChild
          ? "M72 108 Q88 102, 104 108 L110 125 Q90 128, 70 125 Z"
          : "M70 108 Q88 100, 108 108 L115 125 Q90 130, 68 125 Z"
        }
        fill="url(#gownGrad)"
      />

      {/* Blanket covering body */}
      <path
        d={isChild
          ? "M70 120 Q77 116, 90 118 Q120 112, 155 114 Q190 110, 230 116 Q248 120, 255 128 L258 138 Q220 142, 155 140 Q100 142, 68 138 Z"
          : "M68 120 Q75 115, 90 118 Q120 110, 160 112 Q200 108, 240 115 Q255 118, 262 125 L265 138 Q230 142, 160 140 Q100 142, 65 138 Z"
        }
        fill="url(#blanketGrad)"
      />
      {/* Blanket fold details */}
      <path d="M90 138 Q130 144, 180 138" stroke="rgba(160,155,140,0.5)" strokeWidth="1.5" fill="none" />
      <path d="M100 118 Q140 114, 180 117" stroke="rgba(190,185,170,0.4)" strokeWidth="1" fill="none" />
      <path d="M200 115 Q230 112, 250 118" stroke="rgba(190,185,170,0.4)" strokeWidth="1" fill="none" />

      {/* Body contour bumps under blanket */}
      <ellipse cx={isChild ? 125 : 130} cy="118" rx={isChild ? 22 : 25} ry="8" fill="rgba(210,205,190,0.4)" />
      <ellipse cx={isChild ? 190 : 200} cy="122" rx={isChild ? 30 : 35} ry="6" fill="rgba(210,205,190,0.3)" />
      {/* Feet bump */}
      <ellipse cx={isChild ? 245 : 255} cy="125" rx={isChild ? 8 : 10} ry={isChild ? 10 : 12} fill="rgba(200,195,180,0.95)" />

      {/* Patient arm outside blanket */}
      <path
        d={isChild
          ? "M104 122 Q110 125, 114 133"
          : "M108 122 Q115 125, 120 135"
        }
        stroke="url(#skinGrad)"
        strokeWidth={isChild ? 5 : 6}
        fill="none"
        strokeLinecap="round"
      />
      {/* Hand */}
      <ellipse
        cx={isChild ? 115 : 121}
        cy={isChild ? 135 : 137}
        rx={isChild ? 4 : 5}
        ry={isChild ? 3 : 4}
        fill={patient.skinColorDark}
      />

      {/* Monitor/Equipment on right side */}
      <g className="monitor">
        <rect x="278" y="55" width="18" height="40" rx="2" fill="rgba(45,42,60,0.98)" />
        <rect x="280" y="58" width="14" height="20" rx="1" fill="rgba(15,25,20,0.95)" />
        {/* Heart rate waveform */}
        <path d="M282 68 L285 68 L287 62 L289 74 L291 68 L294 68" stroke="rgba(80,220,120,1)" strokeWidth="1.5" fill="none" />
        {/* Vitals numbers */}
        <rect x="281" y="72" width="6" height="4" rx="0.5" fill="rgba(80,220,120,0.8)" />
        <rect x="289" y="72" width="4" height="4" rx="0.5" fill="rgba(100,180,255,0.8)" />
        {/* Monitor buttons */}
        <circle cx="283" cy="90" r="2" fill="rgba(100,98,120,0.9)" />
        <circle cx="289" cy="90" r="2" fill="rgba(100,98,120,0.9)" />
        {/* Monitor stand */}
        <rect x="285" y="95" width="4" height="55" fill="rgba(70,68,90,1)" />
        <ellipse cx="287" cy="152" rx="12" ry="5" fill="rgba(55,52,70,0.95)" />
        {/* Wires to patient */}
        <path d="M280 75 Q260 80, 240 95 Q220 110, 200 120" stroke="rgba(80,78,95,0.6)" strokeWidth="1.5" fill="none" />
      </g>
    </svg>
  );
}

export default PatientBedSVG;
