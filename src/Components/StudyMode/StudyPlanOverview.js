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
 */
const StudyPlanOverview = ({ studyState, onNodeSelect }) => {
  const { t } = useTranslation();
  const activeNodeRef = useRef(null);

  const nodes = studyState?.path?.nodes || [];
  const topics = studyState?.path?.topics || [];
  const completedCount = nodes.filter(n => n.status === 'done').length;
  const totalNodes = nodes.length;

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

  return (
    <div className="study-overview-container study-overview-v2">
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
        </div>
      </div>

      {/* Winding path with bold nodes */}
      <div className="study-overview-path-v2">
        <div className="study-path-nodes-v2">
          {nodes.map((node, index) => {
            const isActive = node.status === 'active';
            const isDone = node.status === 'done';
            const isLocked = node.status === 'locked';
            const offset = getNodeOffset(index);
            const ringData = getProgressRing(node);

            // Check if mascot should appear at this node
            const mascotData = getMascotAtIndex(index);
            const hasMascot = !!mascotData;
            // Label is on right for even indices, left for odd
            // Mascot goes on the opposite side
            const mascotSide = index % 2 === 0 ? 'left' : 'right';

            // SVG progress ring calculations
            const radius = 44;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference - (ringData.progress / 100) * circumference;

            return (
              <div
                key={node.id}
                ref={isActive ? activeNodeRef : null}
                className={`study-path-node-v2 ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isLocked ? 'locked' : ''}`}
                style={{ transform: `translateX(${offset}px)` }}
                onClick={() => !isLocked && onNodeSelect(node)}
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
                  {/* Progress ring (SVG circle) */}
                  <svg className="study-node-ring" viewBox="0 0 100 100">
                    {/* Background ring */}
                    <circle
                      className="ring-bg"
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      strokeWidth="8"
                    />
                    {/* Progress ring */}
                    {!isLocked && (
                      <circle
                        className={`ring-progress ${ringData.color}`}
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        transform="rotate(-90 50 50)"
                      />
                    )}
                  </svg>

                  {/* Inner circle with icon */}
                  <div className="study-node-inner">
                    {getNodeIcon(node.type, node.status)}
                  </div>

                  {/* Pulse effect for active */}
                  {isActive && <div className="study-node-pulse" />}

                  {/* START label for active node */}
                  {isActive && (
                    <div className="study-node-start-label">START</div>
                  )}
                </div>

                {/* Mascot positioned next to node */}
                {hasMascot && (
                  <div className={`study-path-mascot-wrapper ${mascotSide}`}>
                    <StudyPathMascot
                      size={70}
                      isActive={mascotData.isActive}
                    />
                  </div>
                )}

                {/* Node label card */}
                <div className={`study-node-label-v2 ${index % 2 === 0 ? 'right' : 'left'}`}>
                  <span className={`node-type-badge ${node.type}`}>
                    {t(`study.nodeType.${node.type}`, node.type).toUpperCase()}
                  </span>
                  <span className="node-title-v2">{node.label}</span>
                  {isLocked && <span className="node-locked-hint">{t('study.comingSoon', 'Coming soon!')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default StudyPlanOverview;
