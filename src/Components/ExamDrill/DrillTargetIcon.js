import React from 'react';

/**
 * DrillTargetIcon — the drill's mark: a dart landing in the bullseye.
 *
 * ONE DRAWING, TWO PLACES
 * ───────────────────────
 * The path chooser and the sidebar both need it, at 42px and 16px. Drawn
 * twice they drift — the sidebar's copy was a bare target with no dart at all,
 * so the icon a student picked on the chooser was not the icon marking the
 * chat it created.
 *
 * THE ARROW POINTS IN
 * ───────────────────
 * The first version had the shaft leaving the bullseye with the head at the
 * top right, which reads as a target being fired FROM rather than hit — the
 * opposite of what the drill does. The head is now at the centre and the
 * fletching is outside, so the dart has landed.
 *
 * Everything is `currentColor`, so each surface colours it by inheritance
 * rather than by passing a fill down.
 */
const DrillTargetIcon = ({ strokeWidth = 1.6, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Target, sat low-left to leave the top-right corner for the dart. */}
    <circle cx="10.5" cy="13.5" r="8" stroke="currentColor" strokeWidth={strokeWidth} />
    <circle cx="10.5" cy="13.5" r="4.3" stroke="currentColor" strokeWidth={strokeWidth} />
    <circle cx="10.5" cy="13.5" r="1.7" fill="currentColor" />

    {/* Shaft, running down into the centre. */}
    <path
      d="M21.5 2.5L14.8 9.2"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    {/* Head: a solid triangle rather than two open barbs. The barbs land
        inside the middle ring, where at 42px they merge with it into a smudge;
        a filled point survives all the way down to the 16px sidebar mark. */}
    <path d="M12.4 11.6L15.9 10.3L13.7 8.1Z" fill="currentColor" />
    {/* Fletching, across the tail. */}
    <path
      d="M19.4 1.4L22.6 4.6"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </svg>
);

export default DrillTargetIcon;
