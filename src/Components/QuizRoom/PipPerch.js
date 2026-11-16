import React, { useId } from 'react';
import { isFestiveSeason } from './festiveSeason';
import './PipPerch.css';

/**
 * PipPerch - Pip, small, sitting on the edge of a panel.
 *
 * NurseQuizMascot is the full character at 200px. This is the same heart
 * drawn for ~56px: soft shading and a few details that survive that size,
 * and slow idle motion (breathing, a blink, dangling feet, a small bounce now and then).
 * All motion is in PipPerch.css and stops under prefers-reduced-motion.
 *
 * Anything animated from CSS sits in its own <g> INSIDE the <g> that carries
 * the SVG transform attribute: a CSS transform replaces the attribute on the
 * same element, which would throw the hat off his head.
 *
 * @param {number}  size    - Width in px (the height follows the viewBox)
 * @param {boolean} festive - Wear the Christmas hat. Defaults to the season.
 */
const PipPerch = ({ size = 56, festive = isFestiveSeason(), className = '' }) => {
  // useId returns ":r1:"; colons are awkward inside url(#...).
  const id = useId().replace(/:/g, '');
  const u = (name) => `url(#${name}-${id})`;

  return (
    <svg
      className={`pip-perch ${className}`}
      width={size}
      height={(size * 78) / 72}
      viewBox="-4 -16 72 78"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`body-${id}`} cx="34%" cy="26%" r="80%">
          <stop offset="0%" stopColor="#fdd0c2" />
          <stop offset="45%" stopColor="#ef9c8a" />
          <stop offset="100%" stopColor="#d66f5f" />
        </radialGradient>
        <radialGradient id={`limb-${id}`} cx="35%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#f6b3a3" />
          <stop offset="100%" stopColor="#cf6657" />
        </radialGradient>
        <radialGradient id={`blush-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e2574f" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#e2574f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`hat-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ee5a5a" />
          <stop offset="60%" stopColor="#d23a3f" />
          <stop offset="100%" stopColor="#a8262f" />
        </linearGradient>
        <linearGradient id={`fur-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ece2d8" />
        </linearGradient>
      </defs>

      {festive && (
        <g className="pip-perch__snow" fill="#ffffff">
          <circle cx="1" cy="-10" r="1.1" />
          <circle cx="60" cy="-12" r="1.3" />
          <circle cx="50" cy="-14" r="0.9" />
        </g>
      )}

      {/* Feet first, so the body sits on top of them */}
      <g className="pip-perch__foot pip-perch__foot--left">
        <ellipse cx="25.5" cy="58.4" rx="5.8" ry="3.4" fill={u('limb')} stroke="#b9584b" strokeWidth="0.7" />
        <ellipse cx="23.8" cy="57.3" rx="2.2" ry="0.9" fill="#ffffff" opacity="0.45" />
      </g>
      <g className="pip-perch__foot pip-perch__foot--right">
        <ellipse cx="38.5" cy="58.4" rx="5.8" ry="3.4" fill={u('limb')} stroke="#b9584b" strokeWidth="0.7" />
        <ellipse cx="36.8" cy="57.3" rx="2.2" ry="0.9" fill="#ffffff" opacity="0.45" />
      </g>

      <g className="pip-perch__body">
        {/* Heart */}
        <path
          d="M32 57 C21 48 8 37 8 24 C8 13 18 8 27 13 C29.5 14.4 31 16 32 18
             C33 16 34.5 14.4 37 13 C46 8 56 13 56 24 C56 37 43 48 32 57Z"
          fill={u('body')}
          stroke="#c25f51"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        {/* Gloss on each lobe, and a rim of light low on the left */}
        <ellipse cx="18.5" cy="19.5" rx="5.6" ry="3.3" fill="#ffffff" opacity="0.42" transform="rotate(-30 18.5 19.5)" />
        <ellipse cx="45.5" cy="17" rx="3.4" ry="1.9" fill="#ffffff" opacity="0.3" transform="rotate(24 45.5 17)" />
        <circle cx="50" cy="21.5" r="1" fill="#ffffff" opacity="0.35" />
        <path d="M13 34 C15 41 20 46 25 50" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.22" />

        {/* Face */}
        <ellipse cx="16" cy="37" rx="4.4" ry="2.9" fill={u('blush')} />
        <ellipse cx="48" cy="37" rx="4.4" ry="2.9" fill={u('blush')} />
        <path d="M20.5 25.2 Q24 23.6 27.2 25" stroke="#a84e42" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.55" />
        <path d="M36.8 25 Q40 23.6 43.5 25.2" stroke="#a84e42" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.55" />
        <g className="pip-perch__eyes">
          <ellipse cx="24" cy="31" rx="3.7" ry="4.3" fill="#2a1b1e" />
          <ellipse cx="40" cy="31" rx="3.7" ry="4.3" fill="#2a1b1e" />
          <ellipse cx="22.7" cy="29.3" rx="1.4" ry="1.7" fill="#ffffff" />
          <ellipse cx="38.7" cy="29.3" rx="1.4" ry="1.7" fill="#ffffff" />
          <circle cx="25.4" cy="32.8" r="0.75" fill="#ffffff" opacity="0.85" />
          <circle cx="41.4" cy="32.8" r="0.75" fill="#ffffff" opacity="0.85" />
          <circle cx="23.4" cy="33.6" r="0.5" fill="#f2a391" opacity="0.8" />
          <circle cx="39.4" cy="33.6" r="0.5" fill="#f2a391" opacity="0.8" />
        </g>
        <path d="M28 37.2 Q32 43.2 36 37.2 Q32 38.6 28 37.2Z" fill="#4a1a2e" stroke="#4a1a2e" strokeWidth="0.9" strokeLinejoin="round" />
        <ellipse cx="32" cy="40.1" rx="1.7" ry="0.9" fill="#f08a86" />

        {festive && (
          /* A small hat on the left lobe only. One wide enough to span both
             lobes hides the cleft, and without the cleft he is a balloon. */
          <g transform="rotate(-20 20 12)">
            {/* The shadow the brim throws on his head */}
            <ellipse cx="20" cy="14.6" rx="14" ry="2.2" fill="#a8483c" opacity="0.3" />

            <g className="pip-perch__hat-top">
              <path
                d="M8.5 9 C10 -4 20 -10 29 -7 C35 -5 38.5 0 39.5 5
                   C35.5 1.5 31 0.5 27.5 2 C30 4 31.5 6.5 32 9Z"
                fill={u('hat')}
                stroke="#96212a"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
              {/* The fold where the tip flops over, and a highlight up the back */}
              <path d="M27.5 2 C30 4 31.5 6.5 32 9 L26.5 9 C27.4 6.4 27.7 4 27.5 2Z" fill="#8f1f29" opacity="0.55" />
              <path d="M12 5 C13.5 -1 18.5 -5.5 25 -5.6" stroke="#ff9a94" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.6" />
              {/* Pom: a cluster, so the edge reads as fluff */}
              <g fill={u('fur')}>
                <circle cx="40" cy="6.5" r="3.5" />
                <circle cx="37.5" cy="4.6" r="2" />
                <circle cx="42.4" cy="4.7" r="2.1" />
                <circle cx="42.8" cy="8.2" r="2" />
                <circle cx="38" cy="8.8" r="2.1" />
                <circle cx="40.3" cy="3.2" r="1.7" />
              </g>
              <path d="M38.2 9.2 Q40.6 10.6 43 8.8" stroke="#d9cdc0" strokeWidth="0.7" strokeLinecap="round" fill="none" />
            </g>

            {/* Brim: a band with a scalloped fur edge top and bottom */}
            <g fill={u('fur')}>
              <rect x="5" y="6.8" width="30" height="6.4" rx="3.2" />
              <circle cx="7.6" cy="7.4" r="2.3" />
              <circle cx="12.4" cy="6.7" r="2.4" />
              <circle cx="17.4" cy="6.5" r="2.4" />
              <circle cx="22.4" cy="6.5" r="2.4" />
              <circle cx="27.4" cy="6.7" r="2.4" />
              <circle cx="32.2" cy="7.4" r="2.3" />
              <circle cx="7.8" cy="12.5" r="2.3" />
              <circle cx="12.6" cy="13.2" r="2.4" />
              <circle cx="17.6" cy="13.5" r="2.4" />
              <circle cx="22.6" cy="13.5" r="2.4" />
              <circle cx="27.6" cy="13.2" r="2.4" />
              <circle cx="32.2" cy="12.5" r="2.3" />
            </g>
            <path d="M9 13.6 Q20 16.4 31 13.6" stroke="#d9cdc0" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.8" />
          </g>
        )}
      </g>
    </svg>
  );
};

export default PipPerch;
