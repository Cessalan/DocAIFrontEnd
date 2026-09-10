import React from 'react';

/**
 * Line icons for the course-intelligence flow.
 *
 * Drawn rather than emoji for the same reason the rest of the study surfaces
 * are: emoji render differently on every platform, and this flow's whole job
 * is to look like one deliberate system rather than a page of stickers.
 *
 * They inherit `currentColor` and a 1.6 stroke, matching StudyLoadingScreen's
 * set, so a step's icon takes the colour of its state without extra rules.
 */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
};

const Icon = ({ size = 20, children, ...rest }) => (
  <svg {...base} width={size} height={size} aria-hidden="true" focusable="false" {...rest}>
    {children}
  </svg>
);

export const CourseIcon = (props) => (
  <Icon {...props}>
    <path d="M22 10L12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
  </Icon>
);

export const DocumentsIcon = (props) => (
  <Icon {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <line x1="8" y1="13" x2="15" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </Icon>
);

export const SearchIcon = (props) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </Icon>
);

export const InstructorIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </Icon>
);

export const LibraryIcon = (props) => (
  <Icon {...props}>
    <path d="M4 4h5a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4z" />
    <path d="M20 4h-5a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H20z" />
  </Icon>
);

export const ExamIcon = (props) => (
  <Icon {...props}>
    <path d="M9 3h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V4a1 1 0 0 1 1-1z" />
    <path d="M9 13l2 2 4-4" />
  </Icon>
);

export const ConnectIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="6" r="2" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="18" r="2" />
    <line x1="10" y1="10.5" x2="6.5" y2="7.5" />
    <line x1="14" y1="10.5" x2="17.5" y2="7.5" />
    <line x1="10" y1="13.5" x2="6.5" y2="16.5" />
    <line x1="14" y1="13.5" x2="17.5" y2="16.5" />
  </Icon>
);

export const StrategyIcon = (props) => (
  <Icon {...props}>
    <path d="M12 2l2.4 5.4 5.6.6-4.2 4 1.2 5.8L12 15l-5 2.8 1.2-5.8-4.2-4 5.6-.6z" />
  </Icon>
);

export const CheckIcon = (props) => (
  <Icon {...props}>
    <path d="M4 12.5l5 5L20 6.5" />
  </Icon>
);

export const SkipIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </Icon>
);

export const LinkIcon = (props) => (
  <Icon {...props}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
  </Icon>
);

export const SparkIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
  </Icon>
);

export const STEP_ICONS = {
  course: CourseIcon,
  documents: DocumentsIcon,
  search: SearchIcon,
  instructor: InstructorIcon,
  library: LibraryIcon,
  exam: ExamIcon,
  connect: ConnectIcon,
  strategy: StrategyIcon,
};
