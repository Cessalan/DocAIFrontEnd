import React from 'react';

/* ══════════════════════════════════════════════════════════════════════
   NCLEX ICONS — a drawn set, not the operating system's emoji.

   WHY THIS FILE EXISTS
   ────────────────────
   The area tiles first shipped with emoji. Emoji are rendered by the
   viewer's platform, so the same page is Apple's glyph set on a Mac,
   Segoe on Windows and Noto on Android — three different weights, three
   different palettes, none of them ours. They also cannot take a colour,
   so a tile could never tint with the accent or adapt to dark mode.

   These are stroke icons on a shared 24-unit grid, drawn from circles,
   rects, lines and simple arcs so their geometry is exact rather than
   approximated by hand-written path data. Every one inherits
   `currentColor`, so a tile tints itself by setting `color` and dark mode
   needs no second set.

   REUSE IS DELIBERATE, NOT LAZY
   ─────────────────────────────
   "Respiratory" and "Pediatric respiratory" share the lungs; "Antibiotics"
   and "Infection control" share the microbe. Two areas that are the same
   idea at different ages should look the same — inventing a distinct mark
   for each would make the grid harder to scan, which is the one job these
   have.
   ══════════════════════════════════════════════════════════════════════ */

/** Shared frame. Optical stroke weight for a ~20px render. */
const Svg = ({ children, ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    width="100%"
    height="100%"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

/* ── Body systems ─────────────────────────────────────────────────────── */

export const HeartIcon = () => (
  <Svg>
    <path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.5 12 20 12 20Z" />
  </Svg>
);

export const LungsIcon = () => (
  <Svg>
    <path d="M12 4v8" />
    <path d="M12 8c-1.5 0-2.5.8-3 2" />
    <path d="M12 8c1.5 0 2.5.8 3 2" />
    <path d="M9 10c-2 1.5-3.5 4-3.5 6.5 0 1.7.8 2.5 2 2.5 1.6 0 3-1.4 3-3.2V11" />
    <path d="M15 10c2 1.5 3.5 4 3.5 6.5 0 1.7-.8 2.5-2 2.5-1.6 0-3-1.4-3-3.2V11" />
  </Svg>
);

export const BrainIcon = () => (
  <Svg>
    <path d="M9 5.5A2.5 2.5 0 0 0 6.5 8 2.5 2.5 0 0 0 5 10.3c0 1 .5 1.8 1.3 2.2A2.6 2.6 0 0 0 8.8 17H12V5.5H9Z" />
    <path d="M15 5.5A2.5 2.5 0 0 1 17.5 8 2.5 2.5 0 0 1 19 10.3c0 1-.5 1.8-1.3 2.2A2.6 2.6 0 0 1 15.2 17H12V5.5h3Z" />
    <path d="M12 17v3" />
  </Svg>
);

export const KidneyIcon = () => (
  <Svg>
    <path d="M10 4.5c-3 0-5 2.6-5 6.2 0 4.3 2.6 8.8 5.6 8.8 1.6 0 2.2-1.2 2.2-2.6 0-1.6-1.2-2.3-1.2-3.7 0-2.6 3.4-2.3 3.4-5.2 0-2.2-2-3.5-5-3.5Z" />
    <path d="M11.6 11.5 14 9.6" />
  </Svg>
);

export const BoneIcon = () => (
  <Svg>
    <circle cx="6.5" cy="7" r="2.2" />
    <circle cx="8.6" cy="9.6" r="2" />
    <circle cx="17.5" cy="17" r="2.2" />
    <circle cx="15.4" cy="14.4" r="2" />
    <path d="M8.4 8.6 15.6 15.8" />
  </Svg>
);

export const DnaIcon = () => (
  <Svg>
    <path d="M8 3c0 4.5 8 5.5 8 10S8 19.5 8 21" />
    <path d="M16 3c0 4.5-8 5.5-8 10s8 5 8 8" />
    <path d="M9.2 7h5.6M8.4 11h7.2M9.2 15.5h5.6" />
  </Svg>
);

/* ── Fluids, meds, labs ───────────────────────────────────────────────── */

export const DropletIcon = () => (
  <Svg>
    <path d="M12 3.5c3 3.6 5 6.3 5 8.6a5 5 0 0 1-10 0c0-2.3 2-5 5-8.6Z" />
  </Svg>
);

export const PillIcon = () => (
  <Svg>
    <rect x="2.6" y="8.4" width="18.8" height="7.2" rx="3.6" transform="rotate(-45 12 12)" />
    <path d="M9.2 9.2l5.6 5.6" />
  </Svg>
);

export const SyringeIcon = () => (
  <Svg>
    <path d="M19.5 4.5 15 9" />
    <path d="M17.5 2.5 21.5 6.5" />
    <path d="m15.5 6.5 2 2" />
    <path d="M13.8 7.7 6.5 15v2.5H9L16.3 10.2Z" />
    <path d="M5 19 3 21" />
    <path d="M9.6 10.6l1.8 1.8M11.8 8.4l1.8 1.8" />
  </Svg>
);

export const VialIcon = () => (
  <Svg>
    <path d="M9 3h6" />
    <path d="M10 3v5.5L7.4 18a2.5 2.5 0 0 0 2.4 3h4.4a2.5 2.5 0 0 0 2.4-3L14 8.5V3" />
    <path d="M8.2 14h7.6" />
  </Svg>
);

export const MicrobeIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="5.2" />
    <circle cx="10.4" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="13.4" cy="13.4" r="1" fill="currentColor" stroke="none" />
    <path d="M12 6.8V3.6M12 17.2v3.2M6.8 12H3.6M17.2 12h3.2M8.3 8.3 6 6M15.7 15.7 18 18M15.7 8.3 18 6M8.3 15.7 6 18" />
  </Svg>
);

export const BandageIcon = () => (
  <Svg>
    <rect x="1.8" y="8.2" width="20.4" height="7.6" rx="3.8" transform="rotate(-45 12 12)" />
    <path d="M9.6 9.6 14.4 14.4" strokeDasharray="0.1 3" />
  </Svg>
);

/* ── Assessment & safety ──────────────────────────────────────────────── */

export const PulseIcon = () => (
  <Svg>
    <path d="M2.5 12h4l2-5 3.5 10 2.5-6 1.5 3h5.5" />
  </Svg>
);

export const ThermometerIcon = () => (
  <Svg>
    <path d="M13.5 13.6V5a1.8 1.8 0 0 0-3.6 0v8.6a4 4 0 1 0 3.6 0Z" />
    <path d="M11.7 16.6v-4" />
  </Svg>
);

export const ShieldIcon = () => (
  <Svg>
    <path d="M12 3 5 5.8v5.4c0 4 2.9 7.6 7 9 4.1-1.4 7-5 7-9V5.8L12 3Z" />
    <path d="m9.2 11.8 2 2 3.6-3.8" />
  </Svg>
);

export const AlertIcon = () => (
  <Svg>
    <path d="M12 4.2 2.8 19.4h18.4L12 4.2Z" />
    <path d="M12 10v3.6" />
    <circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);

export const HospitalIcon = () => (
  <Svg>
    <path d="M4 20V8.6L12 4l8 4.6V20" />
    <path d="M2.5 20h19" />
    <path d="M12 9.5v5M9.5 12h5" />
  </Svg>
);

export const AppleIcon = () => (
  <Svg>
    <path d="M12 7.6c-1-1-2.2-1.4-3.4-1.2C6.2 6.8 5 9 5 11.8c0 3.6 2.4 8 4.6 8 .9 0 1.5-.5 2.4-.5s1.5.5 2.4.5c2.2 0 4.6-4.4 4.6-8 0-2.8-1.2-5-3.6-5.4-1.2-.2-2.4.2-3.4 1.2Z" />
    <path d="M12 7.6V5.4c0-1 .9-2 2.2-2.2" />
  </Svg>
);

/* ── Maternal, newborn, paediatric ────────────────────────────────────── */

export const PregnancyIcon = () => (
  <Svg>
    <circle cx="10.6" cy="4.6" r="2.1" />
    <path d="M10.6 8.2c-1.6 0-2.6 1.2-2.8 2.8L7 17h2l.5 4h3" />
    <path d="M11.4 10.6c2.6 0 4.4 1.8 4.4 4.2s-1.8 4.2-4.4 4.2" />
  </Svg>
);

export const BabyIcon = () => (
  <Svg>
    <circle cx="12" cy="8" r="4.6" />
    <circle cx="10.2" cy="7.6" r=".8" fill="currentColor" stroke="none" />
    <circle cx="13.8" cy="7.6" r=".8" fill="currentColor" stroke="none" />
    <path d="M10.4 10.2c.9.7 2.3.7 3.2 0" />
    <path d="M6.6 14.5C5.6 15.6 5 17 5 18.6V21h14v-2.4c0-1.6-.6-3-1.6-4.1" />
  </Svg>
);

export const BottleIcon = () => (
  <Svg>
    <path d="M11 2.4h2v2h-2z" />
    <path d="M9.6 4.4h4.8v2.2H9.6z" />
    <path d="M9 6.6h6a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8.6a2 2 0 0 1 2-2Z" />
    <path d="M7.4 11h3M7.4 14h3" />
  </Svg>
);

export const FlowerIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="2.1" />
    <circle cx="12" cy="6.6" r="2.6" />
    <circle cx="17.2" cy="10.4" r="2.6" />
    <circle cx="15.2" cy="16.6" r="2.6" />
    <circle cx="8.8" cy="16.6" r="2.6" />
    <circle cx="6.8" cy="10.4" r="2.6" />
  </Svg>
);

export const RulerIcon = () => (
  <Svg>
    <rect x="2.6" y="8.6" width="18.8" height="6.8" rx="1.6" />
    <path d="M6.6 8.6v3M10.2 8.6v2M13.8 8.6v3M17.4 8.6v2" />
  </Svg>
);

export const ScaleIcon = () => (
  <Svg>
    <path d="M12 4.6V21" />
    <path d="M7.5 21h9" />
    <path d="M4.5 7.6h15" />
    <circle cx="12" cy="6" r="1.4" />
    <path d="M4.6 7.8 2 14h5.2L4.6 7.8Z" />
    <path d="M19.4 7.8 16.8 14H22l-2.6-6.2Z" />
  </Svg>
);

/* ── Mental health ────────────────────────────────────────────────────── */

export const ChatIcon = () => (
  <Svg>
    <path d="M9.5 4h8A2.5 2.5 0 0 1 20 6.5v5a2.5 2.5 0 0 1-2.5 2.5H15l-3 3v-3H9.5A2.5 2.5 0 0 1 7 11.5v-5A2.5 2.5 0 0 1 9.5 4Z" />
    <path d="M7 8.5H6A2 2 0 0 0 4 10.5v4A2 2 0 0 0 6 16.5h.5V20l2.5-3.5" />
  </Svg>
);

export const CloudRainIcon = () => (
  <Svg>
    <path d="M7.5 14a3.5 3.5 0 0 1-.3-7 5 5 0 0 1 9.5 1.2 3 3 0 0 1-.7 5.8H7.5Z" />
    <path d="M9 17.2v2M12 17.8v2.6M15 17.2v2" />
  </Svg>
);

export const SpiralIcon = () => (
  <Svg>
    <path d="M12 12a1.8 1.8 0 1 1 1.8 1.8A3.6 3.6 0 0 1 10.2 10a5.4 5.4 0 0 1 5.4-5.4A7.2 7.2 0 0 1 22.8 12" />
    <path d="M12 12a1.8 1.8 0 1 0-1.8-1.8A3.6 3.6 0 0 0 13.8 14a5.4 5.4 0 0 1-5.4 5.4A7.2 7.2 0 0 1 1.2 12" opacity=".45" />
  </Svg>
);

export const NoEntryIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M6.1 6.1 17.9 17.9" />
  </Svg>
);

export const LifebuoyIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.4" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="M6.1 6.1 9.6 9.6M17.9 6.1 14.4 9.6M17.9 17.9 14.4 14.4M6.1 17.9 9.6 14.4" />
  </Svg>
);

/* ── Leadership & systems ─────────────────────────────────────────────── */

export const UsersIcon = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.4 19.4a5.6 5.6 0 0 1 11.2 0" />
    <path d="M16.2 5.2a3.2 3.2 0 0 1 0 5.9" />
    <path d="M17.6 14.4a5.6 5.6 0 0 1 3 5" />
  </Svg>
);

export const RankIcon = () => (
  <Svg>
    <rect x="3.4" y="12.6" width="4.4" height="7.8" rx="1.2" />
    <rect x="9.8" y="8.2" width="4.4" height="12.2" rx="1.2" />
    <rect x="16.2" y="4.4" width="4.4" height="16" rx="1.2" />
  </Svg>
);

export const LinkIcon = () => (
  <Svg>
    <path d="M10.2 13.8a3.6 3.6 0 0 0 5.4.4l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.5 1.5" />
    <path d="M13.8 10.2a3.6 3.6 0 0 0-5.4-.4l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.5-1.5" />
  </Svg>
);

export const ClipboardIcon = () => (
  <Svg>
    <rect x="4.6" y="4.6" width="14.8" height="16.4" rx="2.2" />
    <path d="M9 4.6V3.4A1.4 1.4 0 0 1 10.4 2h3.2A1.4 1.4 0 0 1 15 3.4v1.2Z" />
    <path d="m9.2 13.4 2 2 3.6-3.8" />
  </Svg>
);

export const SoapIcon = () => (
  <Svg>
    <path d="M4.6 12.4h10.8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6.6a2 2 0 0 1-2-2v-6Z" />
    <path d="M7.6 12.4V10a2.4 2.4 0 0 1 2.4-2.4h2A2.4 2.4 0 0 1 14.4 10v2.4" />
    <path d="M18.6 4.6v3M20.6 6.6h-4" />
  </Svg>
);

/* ── Confidence scale ─────────────────────────────────────────────────────
   Drawn as a PROGRESSION rather than three unrelated marks: an open circle
   with a question, the same circle half filled, then the same circle
   resolved with a check. The fill increasing left to right is what makes it
   read as a scale before any of the labels are read. ──────────────────── */

export const UnsureIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M9.7 9.5a2.4 2.4 0 0 1 4.7.8c0 1.6-2.3 2-2.3 3.6" />
    <circle cx="12" cy="16.8" r=".95" fill="currentColor" stroke="none" />
  </Svg>
);

export const HalfSureIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 3.4a8.6 8.6 0 0 1 0 17.2Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const SureIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.6" />
    <path d="m8.1 12.2 2.7 2.7 5.1-5.6" />
  </Svg>
);

/** Confidence level id → mark. Order is the scale. */
export const CONFIDENCE_ICONS = {
  not_sure: UnsureIcon,
  pretty_sure: HalfSureIcon,
  very_sure: SureIcon,
};

/* ── Hero marks ───────────────────────────────────────────────────────── */

export const TargetIcon = () => (
  <Svg strokeWidth="1.5">
    <circle cx="12" cy="12" r="8.6" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
  </Svg>
);

export const CompassIcon = () => (
  <Svg strokeWidth="1.5">
    <circle cx="12" cy="12" r="8.6" />
    <path d="m15.4 8.6-2 4.8-4.8 2 2-4.8 4.8-2Z" />
  </Svg>
);

/* ── Registry ─────────────────────────────────────────────────────────── */

/**
 * Area label → icon component.
 *
 * Keyed on the LABEL, matching AREA_ICONS in nclexCurriculum for the same
 * reason: the label is what the attempt log stores and the profile buckets
 * on, so introducing a second identifier would be a key that can drift.
 */
export const AREA_ICON_COMPONENTS = {
  // Pharmacology
  'Medication safety': PillIcon,
  'Cardiovascular drugs': HeartIcon,
  'Antibiotics': MicrobeIcon,
  'Endocrine & insulin': VialIcon,
  'Pain management': BandageIcon,
  'Adverse effects & interactions': AlertIcon,
  // Fundamentals
  'Infection control & precautions': SoapIcon,
  'Mobility & positioning': BoneIcon,
  'Nutrition & elimination': AppleIcon,
  'Vital signs & assessment basics': ThermometerIcon,
  'Patient safety & falls': ShieldIcon,
  // Adult health
  'Cardiovascular': HeartIcon,
  'Respiratory': LungsIcon,
  'Fluid & electrolytes': DropletIcon,
  'Renal & endocrine': KidneyIcon,
  'Neurological': BrainIcon,
  'Perioperative care': HospitalIcon,
  // Maternal & newborn
  'Antepartum care': PregnancyIcon,
  'Labor & delivery': BabyIcon,
  'Postpartum complications': FlowerIcon,
  'Newborn assessment': BottleIcon,
  'Fetal monitoring': PulseIcon,
  // Pediatrics
  'Growth & development': RulerIcon,
  'Pediatric respiratory': LungsIcon,
  'Congenital conditions': DnaIcon,
  'Immunizations': SyringeIcon,
  'Pediatric dosing & safety': ScaleIcon,
  // Mental health
  'Therapeutic communication': ChatIcon,
  'Mood & anxiety disorders': CloudRainIcon,
  'Psychotic disorders': SpiralIcon,
  'Substance use & withdrawal': NoEntryIcon,
  'Crisis & suicide risk': LifebuoyIcon,
  // Leadership
  'Delegation & supervision': UsersIcon,
  'Prioritization': RankIcon,
  'Legal & ethical practice': ScaleIcon,
  'Care coordination': LinkIcon,
  'Quality & safety systems': ClipboardIcon,
};

/**
 * Render the icon for an area. Falls back to the clipboard rather than to
 * nothing, so a newly added area never renders a ragged hole in the grid.
 */
export const AreaIcon = ({ area }) => {
  const Cmp = AREA_ICON_COMPONENTS[area] || ClipboardIcon;
  return <Cmp />;
};

export default AreaIcon;
