import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import StudyPathMascot from '../QuizRoom/StudyPathMascot';
import './StudyMode.css';

/**
 * StudyPlanOverview - Duolingo-style study path with bold circular progress
 * Shows all nodes in a winding path layout with type-specific icons
 * Mascots appear along the path: colored at active node, gray further ahead
 *
 * @param {Object} studyState - Study state with path and nodes
 * @param {Function} onNodeSelect - Callback when a node is selected
 * @param {boolean} sidebarOpen - Whether the sidebar is open (for centering)
 */
const StudyPlanOverview = ({
  studyState,
  onNodeSelect,
  onShowInsights,
  insightsData = null,
  sidebarOpen = true,
  isGeneratingPhase2 = false,
  onStartPhase2,
  isDev = false
}) => {
  const { t } = useTranslation();
  const activeNodeRef = useRef(null);

  const nodes = studyState?.path?.nodes || [];
  const topics = studyState?.path?.topics || [];
  const realNodes = nodes.filter(n => n.type !== 'section_banner');
  const completedCount = realNodes.filter(n => n.status === 'done').length;
  const totalNodes = realNodes.length;

  // Auto-scroll to active node when component mounts
  useEffect(() => {
    if (activeNodeRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        activeNodeRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
    }
  }, [nodes]);

  // Find the active node index for mascot positioning
  const activeNodeIndex = nodes.findIndex(n => n.status === 'active');

  // Determine which nodes should have mascots
  // Place mascot at active node (colored) and at intervals further down (gray)
  const getMascotPositions = () => {
    const positions = [];

    // Always show colored mascot at active node position
    if (activeNodeIndex >= 0) {
      positions.push({ index: activeNodeIndex, isActive: true });
    } else if (completedCount === totalNodes && totalNodes > 0) {
      // All completed - show at the end
      positions.push({ index: totalNodes - 1, isActive: true });
    }

    // Show gray mascots at intervals after the active node
    // Place them every 3-4 nodes after active, similar to Duolingo checkpoints
    const mascotInterval = 4;
    for (let i = activeNodeIndex + mascotInterval; i < totalNodes; i += mascotInterval) {
      positions.push({ index: i, isActive: false });
    }

    return positions;
  };

  const mascotPositions = getMascotPositions();

  // Get type-specific icon for each node type
  const getNodeIcon = (type, status) => {
    // Done state - always show checkmark
    if (status === 'done') {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }

    // Type-specific icons
    switch (type) {
      case 'lesson':
        // Book icon
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 2C4.89 2 4 2.9 4 4V20C4 21.1 4.89 22 6 22H18C19.1 22 20 21.1 20 20V4C20 2.9 19.1 2 18 2H6ZM6 4H11V12L8.5 10.5L6 12V4Z" />
          </svg>
        );
      case 'quiz':
        // Question mark icon
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 19H11V17H13V19ZM15.07 11.25L14.17 12.17C13.45 12.9 13 13.5 13 15H11V14.5C11 13.4 11.45 12.4 12.17 11.67L13.41 10.41C13.78 10.05 14 9.55 14 9C14 7.9 13.1 7 12 7C10.9 7 10 7.9 10 9H8C8 6.79 9.79 5 12 5C14.21 5 16 6.79 16 9C16 9.88 15.64 10.68 15.07 11.25Z" />
          </svg>
        );
      case 'flashcard':
        // Cards/layers icon
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 6H2V20C2 21.1 2.9 22 4 22H18V20H4V6ZM20 2H8C6.9 2 6 2.9 6 4V16C6 17.1 6.9 18 8 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H8V4H20V16ZM13 14H15V11H18V9H15V6H13V9H10V11H13V14Z" />
          </svg>
        );
      case 'audio':
        // Headphones icon
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1C7.03 1 3 5.03 3 10V17C3 18.66 4.34 20 6 20H9V12H5V10C5 6.13 8.13 3 12 3C15.87 3 19 6.13 19 10V12H15V20H18C19.66 20 21 18.66 21 17V10C21 5.03 16.97 1 12 1Z" />
          </svg>
        );
      case 'mindmap':
        // Mind map / network icon
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C13.1 2 14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C15.1 7 16 7.9 16 9V10.27C16.6 10.61 17 11.26 17 12C17 12.74 16.6 13.39 16 13.73V15C16 16.1 15.1 17 14 17H13V18.27C13.6 18.61 14 19.26 14 20C14 21.1 13.1 22 12 22C10.9 22 10 21.1 10 20C10 19.26 10.4 18.61 11 18.27V17H10C8.9 17 8 16.1 8 15V13.73C7.4 13.39 7 12.74 7 12C7 11.26 7.4 10.61 8 10.27V9C8 7.9 8.9 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2ZM10 9V15H14V9H10Z" />
          </svg>
        );
      case 'review':
        // Review/repeat icon
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.76 16.26C19.54 15.03 20 13.57 20 12C20 7.58 16.42 4 12 4ZM12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.24 7.74C4.46 8.97 4 10.43 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" />
          </svg>
        );
      case 'exam':
        // Clipboard/exam icon
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 5C9 3.9 9.9 3 11 3H13C14.1 3 15 3.9 15 5H19C20.1 5 21 5.9 21 7V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V7C3 5.9 3.9 5 5 5H9ZM11 5V4H13V5H11ZM7 9H17V7H7V9ZM7 13H17V11H7V13ZM7 17H13V15H7V17Z" />
          </svg>
        );
      default:
        // Star icon for unknown types
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" />
          </svg>
        );
    }
  };

  // Determine position offset for winding path (like Duolingo)
  const getNodeOffset = (index) => {
    const pattern = [0, 1, 1, 0, -1, -1]; // Gentler winding pattern
    const offset = pattern[index % pattern.length];
    return offset * 50; // 50px per step
  };

  // Estimated minutes per node type (for Quick Start button label)
  const getNodeEstimate = (type) => {
    const map = { lesson: 5, quiz: 4, flashcard: 3, audio: 6, mindmap: 5, review: 2, exam: 15 };
    return map[type] || 4;
  };

  // First locked non-banner node after the active node → "next preview"
  const nextNodeId = (() => {
    const activeIdx = nodes.findIndex(n => n.status === 'active');
    if (activeIdx < 0) return null;
    return nodes.slice(activeIdx + 1).find(n => n.type !== 'section_banner' && n.status === 'locked')?.id ?? null;
  })();

  // Calculate progress ring values
  const getProgressRing = (node) => {
    const { status, nodeProgress } = node;

    // Done nodes: full ring
    if (status === 'done') {
      return { progress: 100, color: 'done' };
    }
    // Active node: show partial progress if available, otherwise show ring without fill
    if (status === 'active') {
      // If node has progress (flashcard/quiz), show that percentage
      if (nodeProgress !== undefined && nodeProgress > 0) {
        return { progress: nodeProgress, color: 'active' };
      }
      // No progress yet - show empty ring with active styling
      return { progress: 0, color: 'active' };
    }
    // Locked: no progress
    return { progress: 0, color: 'locked' };
  };

  // Check if a mascot should be shown at this node index
  const getMascotAtIndex = (index) => {
    return mascotPositions.find(pos => pos.index === index);
  };

  // Check if phase 2 nodes already exist (real ones, not placeholders)
  const hasPhase2Nodes = nodes.some(n => n.phase === 2);

  // Phase 1 is done when all real nodes are completed and no phase 2 exists yet
  const phase1AllDone = completedCount === totalNodes && totalNodes > 0 && !hasPhase2Nodes;

  // Placeholder nodes shown before phase 2 is generated
  const placeholderNodes = [
    { id: 'ph_1', type: 'lesson', label: t('study.targetedLesson', 'Strengthen Weak Areas') },
    { id: 'ph_2', type: 'flashcard', label: t('study.masterConcepts', 'Master Key Concepts') },
    { id: 'ph_3', type: 'quiz', label: t('study.proveKnowledge', 'Prove Your Knowledge') }
  ];

  const masteryPercent = totalNodes > 0 ? Math.round((completedCount / totalNodes) * 100) : 0;

  return (
    <div className={`study-overview-container study-overview-v2 ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>

      {/* ── Living background canvas ── */}
      <div className="study-bg-canvas" aria-hidden="true">
        {/* Soft gradient orbs */}
        <div className="sbg-orb sbg-orb--1" />
        <div className="sbg-orb sbg-orb--2" />
        <div className="sbg-orb sbg-orb--3" />
        <div className="sbg-orb sbg-orb--4" />

        {/* 1. Stethoscope */}
        <svg className="sbg-doodle sbg-d1" viewBox="0 0 54 64" fill="none">
          <path d="M11 8 C11 18 19 24 27 29" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M43 8 C43 18 35 24 27 29" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M27 29 C27 38 33 46 39 55" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
          <circle cx="39" cy="55" r="8" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.08"/>
          <circle cx="39" cy="55" r="4.5" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.4"/>
          <circle cx="39" cy="55" r="2" fill="currentColor"/>
          <circle cx="11" cy="7" r="4" fill="currentColor"/>
          <circle cx="43" cy="7" r="4" fill="currentColor"/>
        </svg>

        {/* 2. Heart with ECG pulse line */}
        <svg className="sbg-doodle sbg-d2" viewBox="0 0 48 44" fill="none">
          <path d="M24 40 C24 40 3 27 3 14 A10.5 10.5 0 0 1 24 10 A10.5 10.5 0 0 1 45 14 C45 27 24 40 24 40 Z"
                fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5 24 L13 24 L16 14 L20 34 L23 19 L26 24 L43 24"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {/* 3. Syringe */}
        <svg className="sbg-doodle sbg-d3" viewBox="0 0 64 22" fill="none">
          <path d="M50 11 L64 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M46 8.5 L50 10.5 L50 11.5 L46 13.5 Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          <rect x="14" y="5" width="32" height="12" rx="6" stroke="currentColor" strokeWidth="1.8"/>
          <line x1="22" y1="5.5" x2="22" y2="16.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.4"/>
          <line x1="30" y1="5.5" x2="30" y2="16.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.4"/>
          <line x1="38" y1="5.5" x2="38" y2="16.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.4"/>
          <line x1="6" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <rect x="2" y="6.5" width="7.5" height="9" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        </svg>

        {/* 5. Medical cross */}
        <svg className="sbg-doodle sbg-d5" viewBox="0 0 30 30" fill="currentColor">
          <rect x="12" y="2" width="6" height="26" rx="3"/>
          <rect x="2" y="12" width="26" height="6" rx="3"/>
        </svg>

        {/* 6. Pill capsule */}
        <svg className="sbg-doodle sbg-d6" viewBox="0 0 50 22" fill="none">
          <rect x="1" y="2" width="48" height="18" rx="9" stroke="currentColor" strokeWidth="2"/>
          <path d="M10 2 L25 2 L25 20 L10 20 A9 9 0 0 1 10 2 Z" fill="currentColor" fillOpacity="0.2"/>
          <line x1="25" y1="3" x2="25" y2="19" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.45"/>
        </svg>

        {/* 7. Band-aid */}
        <svg className="sbg-doodle sbg-d7" viewBox="0 0 46 46" fill="none">
          <g transform="rotate(45 23 23)">
            <rect x="2" y="15" width="9" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.7"/>
            <rect x="11" y="12" width="24" height="22" rx="3" stroke="currentColor" strokeWidth="1.7"/>
            <rect x="35" y="15" width="9" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.7"/>
            <circle cx="18" cy="23" r="1.4" fill="currentColor" opacity="0.55"/>
            <circle cx="28" cy="23" r="1.4" fill="currentColor" opacity="0.55"/>
          </g>
        </svg>

        {/* 8. Thermometer */}
        <svg className="sbg-doodle sbg-d8" viewBox="0 0 18 54" fill="none">
          <rect x="5.5" y="2" width="7" height="30" rx="3.5" stroke="currentColor" strokeWidth="1.8"/>
          <rect x="7.5" y="18" width="3" height="16" rx="1.5" fill="currentColor" fillOpacity="0.35"/>
          <circle cx="9" cy="43" r="7" stroke="currentColor" strokeWidth="1.8"/>
          <circle cx="9" cy="43" r="4" fill="currentColor" fillOpacity="0.3"/>
          <line x1="12.5" y1="7"  x2="15" y2="7"  stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          <line x1="12.5" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          <line x1="12.5" y1="19" x2="15" y2="19" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          <line x1="12.5" y1="25" x2="14" y2="25" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>

        {/* 9. ECG heartbeat line */}
        <svg className="sbg-doodle sbg-d9" viewBox="0 0 84 26" fill="none">
          <path d="M2 13 L19 13 L23 3 L27 23 L31 7 L35 13 L82 13"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {/* 10. Medicine bottle */}
        <svg className="sbg-doodle sbg-d10" viewBox="0 0 26 38" fill="none">
          <rect x="5" y="1" width="16" height="7" rx="3" stroke="currentColor" strokeWidth="1.7"/>
          <path d="M8 7.5 L8 11 M18 7.5 L18 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <rect x="2" y="11" width="22" height="26" rx="4" stroke="currentColor" strokeWidth="1.7"/>
          <rect x="5.5" y="15" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5"/>
          <line x1="13" y1="17.5" x2="13" y2="23.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="10" y1="20.5" x2="16" y2="20.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Header with title */}
      <div className="study-overview-header-v2">
        <div className="study-overview-title-section">
          <h1 className="study-overview-title">
            {topics.length > 0 ? topics[0] : t('study.yourStudyPlan', 'Your Study Plan')}
          </h1>
          {topics.length > 1 && (
            <p className="study-overview-subtitle">
              {topics.slice(1, 3).join(', ')}
            </p>
          )}
          {/* Mastery progress bar */}
          {totalNodes > 0 && (
            <div className="study-mastery-bar-wrapper">
              <div className="study-mastery-bar">
                <div className="study-mastery-bar-fill" style={{ width: `${masteryPercent}%` }} />
              </div>
            </div>
          )}
        </div>
        {/* Show insights button only when there's no inline panel (no data yet) */}
        {onShowInsights && !insightsData?.topics && (
          <button
            className="study-overview-insights-btn"
            onClick={onShowInsights}
            title={t('study.viewInsights', 'View your progress insights')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t('study.insights', 'Insights')}</span>
          </button>
        )}
      </div>

      {/* ── Inline insights strip — only when data is available ── */}
      {insightsData?.topics && (() => {
        const groups = { weak: [], developing: [], strong: [] };
        for (const [name, tp] of Object.entries(insightsData.topics)) {
          const qAcc = tp.questionsTotal > 0 ? tp.questionsCorrect / tp.questionsTotal : null;
          const fAcc = tp.flashcardsTotal > 0 ? tp.flashcardsMastered / tp.flashcardsTotal : null;
          const scores = [qAcc, fAcc].filter(s => s !== null);
          if (scores.length === 0) continue;
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          const level = avg >= 0.85 ? 'strong' : avg >= 0.6 ? 'developing' : 'weak';
          groups[level].push({ name, pct: Math.round(avg * 100), level });
        }
        const hasAny = Object.values(groups).some(g => g.length > 0);
        if (!hasAny) return null;

        const groupConfig = [
          { key: 'weak',       label: t('study.weak', 'Needs Work'),    icon: '✗' },
          { key: 'developing', label: t('study.developing', 'Developing'), icon: '◎' },
          { key: 'strong',     label: t('study.strong', 'Strong'),       icon: '✓' },
        ];

        return (
          <div className="study-inline-insights" onClick={onShowInsights} role="button" title={t('study.viewInsights', 'View full insights')}>
            <div className="sii-header">
              <svg className="sii-header__icon" viewBox="0 0 14 14" fill="currentColor" width="13" height="13">
                <rect x="0" y="7" width="3.5" height="7" rx="1"/>
                <rect x="5.25" y="3.5" width="3.5" height="10.5" rx="1"/>
                <rect x="10.5" y="0" width="3.5" height="14" rx="1"/>
              </svg>
              <span className="sii-header__title">{t('study.insights', 'Insights')}</span>
              <svg className="sii-header__arrow" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
                <path d="M2 8L8 2M8 2H4M8 2v4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {groupConfig.filter(g => groups[g.key].length > 0).map(({ key, label, icon }) => (
              <div key={key} className={`sii-group sii-group--${key}`}>
                <div className={`sii-group__hdr sii-group__hdr--${key}`}>
                  <span className="sii-group__icon">{icon}</span>
                  <span className="sii-group__label">{label}</span>
                  <span className="sii-group__count">{groups[key].length}</span>
                </div>
                {groups[key].slice(0, 3).map(topic => (
                  <div key={topic.name} className="sii-row">
                    <span className="sii-row__name" title={topic.name}>{topic.name}</span>
                    <div className="sii-row__track">
                      <div
                        className={`sii-row__fill sii-row__fill--${key}`}
                        style={{ width: `${Math.max(topic.pct, 8)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Winding path with bold nodes */}
      <div className="study-overview-path-v2">
        <div className="study-path-nodes-v2">
          {(() => {
            // Extract base topic by matching against known topics array,
            // then falling back to stripping " - suffix" patterns
            const getBaseTopic = (label) => {
              if (!label) return label;
              for (const topic of topics) {
                if (label.toLowerCase().startsWith(topic.toLowerCase())) return topic;
              }
              return label.replace(/\s*[-–]\s*\S.*$/, '').trim() || label;
            };

            let prevTopic = null;
            return nodes.map((node, index) => {
            // Render section banner divider
            if (node.type === 'section_banner') {
              prevTopic = null; // reset after banner so first phase-2 node gets a separator
              return (
                <div key={node.id} className="study-section-banner" style={{ transform: 'translateX(0)' }}>
                  <div className="study-section-banner__divider" />
                  <div className="study-section-banner__content">
                    <span className="study-section-banner__badge">
                      {t('study.sectionLabel', 'SECTION {{number}}', { number: node.phase || 2 })}
                    </span>
                    <h3 className="study-section-banner__title">{node.label}</h3>
                    <p className="study-section-banner__subtitle">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t('study.builtFromResults', 'Built from your results')}
                    </p>
                  </div>
                </div>
              );
            }

            const isActive = node.status === 'active';
            const isDone = node.status === 'done';
            const isLocked = node.status === 'locked';
            const isNextPreview = node.id === nextNodeId;
            const isFarLocked = isLocked && !isNextPreview;
            const offset = getNodeOffset(index);
            const ringData = getProgressRing(node);

            // Topic separator: show for every topic group including the first
            // Adaptive nodes are detours within a topic — never trigger a new separator
            const baseTopic = node.adaptive ? prevTopic : getBaseTopic(node.label);
            const showTopicSeparator = !node.adaptive && baseTopic && baseTopic !== prevTopic;
            if (!node.adaptive) prevTopic = baseTopic;

            // Check if mascot should appear at this node
            const mascotData = getMascotAtIndex(index);
            const hasMascot = !!mascotData;
            // Label is on right for even indices, left for odd
            // Mascot goes on the opposite side
            const mascotSide = index % 2 === 0 ? 'left' : 'right';

            return (
              <React.Fragment key={node.id}>
                {showTopicSeparator && (
                  <div className="study-topic-separator">
                    <span className="study-topic-separator__label">{baseTopic}</span>
                  </div>
                )}
              <div
                ref={isActive ? activeNodeRef : null}
                className={[
                  'study-path-node-v2',
                  isActive  ? 'active'       : '',
                  isDone    ? 'done'         : '',
                  isLocked && !isDev ? (isFarLocked ? 'locked far-locked' : 'locked next-preview') : '',
                  isLocked && isDev  ? 'dev-unlocked' : '',
                  node.adaptive ? 'adaptive' : '',
                  node.type === 'exam' ? 'exam-node' : '',
                ].filter(Boolean).join(' ')}
                style={{ transform: `translateX(${offset}px)` }}
                onClick={() => (!isLocked || isDev) && onNodeSelect(node)}
              >
                {/* Connector to previous node */}
                {index > 0 && (
                  <div
                    className={`study-path-connector-v2 ${nodes[index-1]?.status === 'done' ? 'done' : ''}`}
                    style={{
                      '--connector-offset': `${getNodeOffset(index) - getNodeOffset(index - 1)}px`
                    }}
                  />
                )}

                {/* Node with progress ring */}
                <div className="study-node-wrapper">
                  {/* Inner circle — padlock for far-locked, type icon otherwise */}
                  <div className="study-node-inner">
                    {isFarLocked && !isDev ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                        <path d="M18 10h-1V7a5 5 0 00-10 0v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2zM9 7a3 3 0 016 0v3H9V7zm3 9a2 2 0 110-4 2 2 0 010 4z"/>
                      </svg>
                    ) : (
                      getNodeIcon(node.type, node.status)
                    )}
                  </div>

                  {/* Pulse effect for active */}
                  {isActive && <div className="study-node-pulse" />}

                  {/* Progress indicator - shows partial progress */}
                  {!isLocked && !isDone && ringData.progress > 0 && (
                    <div className="study-node-progress-bar">
                      <div
                        className="study-node-progress-fill"
                        style={{ width: `${ringData.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Quick Start button for active node */}
                  {isActive && (
                    <button className="quick-start-btn" onClick={(e) => { e.stopPropagation(); onNodeSelect(node); }}>
                      {ringData.progress > 0
                        ? `▶ ${t('study.continue', 'Continue')}`
                        : `${t('study.start', 'Start')} · ${getNodeEstimate(node.type)} min`}
                    </button>
                  )}

                  {/* "Up Next" badge for the immediately next node */}
                  {isNextPreview && !isDev && (
                    <div className="up-next-badge">{t('study.upNext', 'Up Next')}</div>
                  )}
                </div>

                {/* Mascot positioned next to node */}
                {hasMascot && (
                  <div className={`study-path-mascot-wrapper ${mascotSide}`}>
                    <StudyPathMascot
                      size={90}
                      isActive={mascotData.isActive}
                      pointingDirection={mascotSide === 'left' ? 'right' : 'left'}
                    />
                  </div>
                )}

                {/* Node label — type badge, or reason for adaptive nodes */}
                <div className={`study-node-label-v2 ${index % 2 === 0 ? 'right' : 'left'}`}>
                  {node.adaptive && node.reason ? (
                    <span className="node-type-badge adaptive-reason" title={node.reason}>
                      {node.reason.length > 28 ? node.reason.substring(0, 28) + '...' : node.reason}
                    </span>
                  ) : node.adaptive ? (
                    <span className="node-type-badge adaptive-focus">
                      {t(`study.nodeType.${node.type}`, node.type).toUpperCase()}
                    </span>
                  ) : (
                    <span className={`node-type-badge ${node.type}`}>
                      {t(`study.nodeType.${node.type}`, node.type).toUpperCase()}
                    </span>
                  )}
                </div>

              </div>
              </React.Fragment>
            );
          });
          })()}

          {/* Phase 2 preview — shown before phase 2 is generated */}
          {false && !hasPhase2Nodes && (
            <>
              {/* Section divider */}
              <div className="study-section-banner" style={{ transform: 'translateX(0)' }}>
                <div className="study-section-banner__divider" />
                <div className="study-section-banner__content">
                  <span className="study-section-banner__badge">
                    {t('study.sectionLabel', 'SECTION {{number}}', { number: 2 })}
                  </span>
                  <h3 className="study-section-banner__title">{t('study.basedOnInsights', 'Based on Your Insights')}</h3>
                  <p className="study-section-banner__subtitle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t('study.builtFromResults', 'Built from your results')}
                  </p>
                </div>
              </div>

              {/* Loading state while generating */}
              {isGeneratingPhase2 && (
                <div className="study-phase2-loading" style={{ transform: 'translateX(0)' }}>
                  <div className="study-loading-spinner" />
                  <p>{t('study.generatingPlan', 'Analyzing your results...')}</p>
                </div>
              )}

              {/* Placeholder nodes — first becomes active when phase 1 is done */}
              {!isGeneratingPhase2 && placeholderNodes.map((ph, i) => {
                const isFirstAndReady = i === 0 && phase1AllDone;
                const canClick = isFirstAndReady || isDev;
                const phOffset = getNodeOffset(nodes.length + 1 + i);

                return (
                  <div
                    key={ph.id}
                    ref={isFirstAndReady ? activeNodeRef : null}
                    className={`study-path-node-v2 ${isFirstAndReady ? 'active' : canClick ? 'dev-unlocked' : 'locked'} ${!isFirstAndReady && !isDev ? 'placeholder' : ''}`}
                    style={{ transform: `translateX(${phOffset}px)` }}
                    onClick={canClick ? onStartPhase2 : undefined}
                  >
                    {/* Connector */}
                    <div className="study-path-connector-v2" style={{ '--connector-offset': `${phOffset - getNodeOffset(nodes.length + i)}px` }} />

                    <div className="study-node-wrapper">
                      <div className="study-node-inner">
                        {getNodeIcon(ph.type, isFirstAndReady ? 'active' : 'locked')}
                      </div>

                      {/* Pulse effect for the active first placeholder */}
                      {isFirstAndReady && <div className="study-node-pulse" />}

                      {/* START label for the active first placeholder */}
                      {isFirstAndReady && (
                        <div className="study-node-start-label">
                          {t('study.start', 'START')}
                        </div>
                      )}
                    </div>

                    {/* Node label — type badge only */}
                    <div className={`study-node-label-v2 ${i % 2 === 0 ? 'right' : 'left'}`}>
                      <span className={`node-type-badge ${ph.type}`}>
                        {t(`study.nodeType.${ph.type}`, ph.type).toUpperCase()}
                      </span>
                    </div>

                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default StudyPlanOverview;
