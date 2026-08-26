import React from 'react';

/**
 * CountryFlags — small inline SVG flags for the landing page social proof.
 *
 * WHY SVG AND NOT EMOJI
 *
 * Emoji flags (🇺🇸, 🇨🇦, …) are regional-indicator letter pairs, and Windows
 * ships no glyphs for them. Chrome and Edge on Windows fall back to rendering
 * the raw letters — "US", "CA", "PH" — so the row reads as an unstyled acronym
 * soup for a large share of nursing students. These draw identically
 * everywhere.
 *
 * Drawn at a 24×16 viewBox (3:2) and simplified for legibility at ~18px wide:
 * the US keeps 7 stripes rather than 13, the Union Jack drops its fimbriation,
 * and star fields become dots. At this size the extra detail turns to mud.
 *
 * Each flag is aria-hidden — FlagStrip carries one label for the whole group,
 * so a screen reader announces the claim once instead of spelling out five
 * separate country names mid-sentence.
 */

const USFlag = () => (
  <svg viewBox="0 0 24 16" aria-hidden="true" focusable="false">
    <rect width="24" height="16" fill="#B22234" />
    <rect y="2.29" width="24" height="2.29" fill="#FFFFFF" />
    <rect y="6.86" width="24" height="2.29" fill="#FFFFFF" />
    <rect y="11.43" width="24" height="2.29" fill="#FFFFFF" />
    <rect width="10.5" height="9.14" fill="#3C3B6E" />
    <g fill="#FFFFFF">
      <circle cx="2" cy="1.9" r="0.52" />
      <circle cx="4.6" cy="1.9" r="0.52" />
      <circle cx="7.2" cy="1.9" r="0.52" />
      <circle cx="9.2" cy="1.9" r="0.52" />
      <circle cx="3.3" cy="4.1" r="0.52" />
      <circle cx="5.9" cy="4.1" r="0.52" />
      <circle cx="8.3" cy="4.1" r="0.52" />
      <circle cx="2" cy="6.3" r="0.52" />
      <circle cx="4.6" cy="6.3" r="0.52" />
      <circle cx="7.2" cy="6.3" r="0.52" />
      <circle cx="9.2" cy="6.3" r="0.52" />
    </g>
  </svg>
);

const CanadaFlag = () => (
  <svg viewBox="0 0 24 16" aria-hidden="true" focusable="false">
    <rect width="24" height="16" fill="#FFFFFF" />
    <rect width="6" height="16" fill="#D52B1E" />
    <rect x="18" width="6" height="16" fill="#D52B1E" />
    {/* Eleven-point leaf, reduced to its silhouette: crown, two side lobes,
        two notches and a stem. */}
    <path
      fill="#D52B1E"
      d="M12 3.1l.78 1.62.92-.22-.36 1.72 1.62-.36-.3 1.02 1.62.9-.94.62.42 1.06-1.86-.3-.12.68-1.14-1.2.28 3.06h-1.64l.28-3.06-1.14 1.2-.12-.68-1.86.3.42-1.06-.94-.62 1.62-.9-.3-1.02 1.62.36-.36-1.72.92.22z"
    />
  </svg>
);

const PhilippinesFlag = () => (
  <svg viewBox="0 0 24 16" aria-hidden="true" focusable="false">
    <rect width="24" height="8" fill="#0038A8" />
    <rect y="8" width="24" height="8" fill="#CE1126" />
    <path d="M0 0L11 8L0 16Z" fill="#FFFFFF" />
    <g fill="#FCD116">
      <circle cx="3.5" cy="8" r="1.45" />
      {/* Eight rays as dots — actual triangular rays close up at this scale. */}
      <circle cx="3.5" cy="5.35" r="0.42" />
      <circle cx="3.5" cy="10.65" r="0.42" />
      <circle cx="0.85" cy="8" r="0.42" />
      <circle cx="6.15" cy="8" r="0.42" />
      <circle cx="1.63" cy="6.13" r="0.38" />
      <circle cx="5.37" cy="6.13" r="0.38" />
      <circle cx="1.63" cy="9.87" r="0.38" />
      <circle cx="5.37" cy="9.87" r="0.38" />
      {/* Three stars, one per triangle corner. */}
      <circle cx="1.1" cy="1.5" r="0.55" />
      <circle cx="1.1" cy="14.5" r="0.55" />
      <circle cx="9.1" cy="8" r="0.55" />
    </g>
  </svg>
);

const AustraliaFlag = () => (
  <svg viewBox="0 0 24 16" aria-hidden="true" focusable="false">
    <rect width="24" height="16" fill="#00247D" />
    {/* Union Jack canton, clipped so the diagonals stop at its edge. */}
    <defs>
      <clipPath id="nq-au-canton">
        <rect width="12" height="8" />
      </clipPath>
    </defs>
    <g clipPath="url(#nq-au-canton)">
      <path d="M0 0L12 8M12 0L0 8" stroke="#FFFFFF" strokeWidth="2.4" />
      <path d="M0 0L12 8M12 0L0 8" stroke="#CF142B" strokeWidth="1" />
      <path d="M6 0V8M0 4H12" stroke="#FFFFFF" strokeWidth="2.8" />
      <path d="M6 0V8M0 4H12" stroke="#CF142B" strokeWidth="1.5" />
    </g>
    <g fill="#FFFFFF">
      {/* Commonwealth Star, then the Southern Cross. */}
      <circle cx="6" cy="12" r="1.05" />
      <circle cx="17" cy="3.4" r="0.5" />
      <circle cx="20.2" cy="6.6" r="0.62" />
      <circle cx="16.4" cy="9.4" r="0.5" />
      <circle cx="19.4" cy="12.2" r="0.55" />
      <circle cx="17.9" cy="7.6" r="0.34" />
    </g>
  </svg>
);

const SouthAfricaFlag = () => (
  <svg viewBox="0 0 24 16" aria-hidden="true" focusable="false">
    <rect width="24" height="8" fill="#E03C31" />
    <rect y="8" width="24" height="8" fill="#002395" />
    {/* The pall is drawn as three strokes — white first, green narrower on top,
        which gives the fimbriation for free. */}
    <g fill="none" strokeLinecap="butt">
      <g stroke="#FFFFFF" strokeWidth="6">
        <path d="M-1 -1.6L10.5 8" />
        <path d="M-1 17.6L10.5 8" />
        <path d="M8 8H24" />
      </g>
      <g stroke="#007A4D" strokeWidth="3.4">
        <path d="M-1 -1.6L10.6 8" />
        <path d="M-1 17.6L10.6 8" />
        <path d="M8 8H24" />
      </g>
    </g>
    <path d="M0 1.6L7.4 8L0 14.4Z" fill="#FFB612" />
    <path d="M0 3.1L5.6 8L0 12.9Z" fill="#000000" />
  </svg>
);

/**
 * The five countries, in the order they appear on the landing page.
 * `label` feeds the group's accessible name, not per-flag text.
 */
export const LANDING_COUNTRIES = [
  { code: 'us', label: 'the United States', Flag: USFlag },
  { code: 'ca', label: 'Canada', Flag: CanadaFlag },
  { code: 'ph', label: 'the Philippines', Flag: PhilippinesFlag },
  { code: 'au', label: 'Australia', Flag: AustraliaFlag },
  { code: 'za', label: 'South Africa', Flag: SouthAfricaFlag }
];

/**
 * @param {Array}  [countries] Defaults to LANDING_COUNTRIES.
 * @param {string} [ariaLabel] Accessible name for the whole strip.
 */
export const FlagStrip = ({ countries = LANDING_COUNTRIES, ariaLabel }) => (
  <span className="flag-strip" role="img" aria-label={ariaLabel}>
    {countries.map(({ code, Flag }) => (
      <span className="flag-strip-item" key={code}>
        <Flag />
      </span>
    ))}
  </span>
);

export default FlagStrip;
