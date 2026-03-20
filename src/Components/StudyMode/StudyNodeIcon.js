import React from 'react';

/**
 * StudyNodeIcon - Individual node in the study path
 * Renders different icons based on node type with status-based styling
 *
 * @param {Object} node - Node data { id, type, label, status, difficulty }
 * @param {boolean} isActive - Whether this is the currently active node
 * @param {Function} onStartNode - Callback when START is clicked (only for active nodes)
 */
const StudyNodeIcon = ({ node, isActive, onStartNode }) => {
  const { type, label, status } = node;

  // Get icon SVG based on node type
  const getNodeIcon = () => {
    switch (type) {
      case 'lesson':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1="8" y1="7" x2="16" y2="7" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        );
      case 'flashcard':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="14" height="12" rx="2" />
            <rect x="8" y="8" width="14" height="12" rx="2" />
          </svg>
        );
      case 'quiz':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'audio':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
        );
      case 'mindmap':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
            <line x1="12" y1="7" x2="5" y2="17" />
            <line x1="12" y1="7" x2="19" y2="17" />
            <line x1="5" y1="19" x2="19" y2="19" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
        );
    }
  };

  // Checkmark icon for completed nodes
  const CheckmarkIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const statusClass = status === 'done' ? 'done' : status === 'active' ? 'active' : 'locked';

  return (
    <div
      className={`study-node ${statusClass}`}
      data-type={type}
    >
      <div className="study-node-circle">
        {getNodeIcon()}

        {/* Checkmark badge for completed nodes */}
        {status === 'done' && (
          <div className="study-node-checkmark">
            <CheckmarkIcon />
          </div>
        )}
      </div>

      <span className="study-node-label">{label}</span>

      {/* START button only shows on active node */}
      {isActive && status === 'active' && (
        <button
          className="study-start-btn"
          onClick={() => onStartNode && onStartNode(node)}
        >
          START
        </button>
      )}
    </div>
  );
};

export default StudyNodeIcon;
