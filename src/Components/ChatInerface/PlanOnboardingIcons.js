import React from 'react';

/**
 * PlanOnboardingIcons — custom line SVGs replacing emoji.
 * All inherit currentColor so the parent CSS controls tint.
 * 24x24 viewBox, 1.8px stroke, round caps/joins for a warm, drawn feel.
 */

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// ── Prep-status icons ─────────────────────────────────────────────

// not_started — flat horizon line with a single starting dot. Reads as
// "nothing yet, but there's a path to walk."
export const NotStartedIcon = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M3 17h18" />
    <path d="M5 17v-2" opacity="0.4" />
    <path d="M9 17v-2" opacity="0.4" />
    <path d="M13 17v-2" opacity="0.4" />
    <path d="M17 17v-2" opacity="0.4" />
    <circle cx="5" cy="9" r="2" fill="currentColor" stroke="none" />
  </svg>
);

// just_started — sprout. Two simple leaves on a stem.
export const JustStartedIcon = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M12 20v-7" />
    <path d="M12 13c0-3.5 2.5-6 6-6-0.3 3.5-2.7 6-6 6z" />
    <path d="M12 14c0-2.8-2.2-5-5-5 0.2 2.8 2.2 5 5 5z" />
    <path d="M7 20h10" opacity="0.5" />
  </svg>
);

// making_progress — open book with a folded corner (bookmark of progress).
export const MakingProgressIcon = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 18.3 4 17.5V5.5z" />
    <path d="M20 5.5C20 4.7 19.3 4 18.5 4H13v15h5.5c0.8 0 1.5-0.7 1.5-1.5V5.5z" />
    <path d="M7 8h2" opacity="0.55" />
    <path d="M7 11h2" opacity="0.55" />
    <path d="M15 8h2" opacity="0.55" />
    <path d="M15 11h2" opacity="0.55" />
  </svg>
);

// cramming — flame with an inner highlight.
export const CrammingIcon = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M12 3c0 4-4 5-4 9a4 4 0 008 0c0-2-1-3-2-4 0.5 2-0.5 3-1 3 0-3 2-5-1-8z" />
    <path d="M11 16c0-1 0.5-2 1-2.5 0.5 0.5 1 1.5 1 2.5a1 1 0 11-2 0z" opacity="0.55" fill="currentColor" stroke="none" />
  </svg>
);

// ── Summary icons ─────────────────────────────────────────────────

// CalendarIcon — calendar with a single highlighted day cell.
export const CalendarIcon = (props) => (
  <svg {...baseProps} {...props}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
    <rect x="14" y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
  </svg>
);

// TargetIcon — concentric bullseye with a center dot.
export const TargetIcon = (props) => (
  <svg {...baseProps} {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5.5" opacity="0.65" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  </svg>
);

// BooksIcon — three stacked book spines, one slightly tilted.
export const BooksIcon = (props) => (
  <svg {...baseProps} {...props}>
    <rect x="3.5" y="4" width="4" height="16" rx="1" />
    <rect x="9" y="4" width="4" height="16" rx="1" />
    <path d="M14.5 6.5l3.7-1 3.4 12.6c0.1 0.5-0.2 1.1-0.7 1.2l-2.6 0.7c-0.5 0.1-1.1-0.2-1.2-0.7l-2.9-10.7" transform="rotate(-8 18 12)" />
    <path d="M3.5 8h4" opacity="0.5" />
    <path d="M9 8h4" opacity="0.5" />
  </svg>
);

// SparkleIcon — 4-point star with two small accent sparkles.
export const SparkleIcon = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M12 4l1.6 4.4 4.4 1.6-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" fill="currentColor" stroke="none" />
    <path d="M19 4l0.6 1.4 1.4 0.6-1.4 0.6L19 8l-0.6-1.4L17 6l1.4-0.6z" fill="currentColor" stroke="none" opacity="0.7" />
    <path d="M5 17l0.5 1.2 1.2 0.5-1.2 0.5L5 20.4l-0.5-1.2L3.3 18.7l1.2-0.5z" fill="currentColor" stroke="none" opacity="0.55" />
  </svg>
);
