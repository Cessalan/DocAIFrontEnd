import React from 'react';
import { useTranslation } from 'react-i18next';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import './StudyMode.css';

/**
 * StudyPlanOverview - Duolingo-style study path with warm notebook aesthetic
 * Shows all nodes in a winding path layout
 *
 * @param {Object} studyState - Study state with path and nodes
 * @param {Function} onNodeSelect - Callback when a node is selected
 * @param {Function} onExit - Callback to exit study mode entirely
 */
const StudyPlanOverview = ({ studyState, onNodeSelect, onExit }) => {
  const { t } = useTranslation();

  const nodes = studyState?.path?.nodes || [];
  const topics = studyState?.path?.topics || [];
  const completedCount = nodes.filter(n => n.status === 'done').length;
  const totalNodes = nodes.length;
  const progressPercent = totalNodes > 0 ? (completedCount / totalNodes) * 100 : 0;

  // Get encouraging message based on progress
  const getMascotMessage = () => {
    if (completedCount === 0) {
      return t('study.mascot.start', "Let's start learning! 📚");
    } else if (progressPercent < 50) {
      return t('study.mascot.keepGoing', "You're doing great! Keep going! ✨");
    } else if (progressPercent < 100) {
      return t('study.mascot.almostThere', "Almost there! You've got this! 💪");
    } else {
      return t('study.mascot.completed', "Amazing! You completed everything! 🎉");
    }
  };

  // Get icon for node type - friendlier icons for locked nodes
  const getNodeIcon = (type, status) => {
    if (status === 'done') {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }

    // For locked nodes, show a friendly "coming soon" star icon instead of a lock
    if (status === 'locked') {
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    }

    switch (type) {
      case 'lesson':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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
      case 'flashcard':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M12 8v8" />
            <path d="M8 12h8" />
          </svg>
        );
      case 'audio':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  // Determine position offset for winding path (like Duolingo)
  const getNodeOffset = (index) => {
    const pattern = [0, 1, 2, 1, 0, -1, -2, -1]; // Winding pattern
    const offset = pattern[index % pattern.length];
    return offset * 40; // 40px per step
  };

  return (
    <div className="study-overview-container">
      {/* Warm decorative background elements */}
      <div className="study-overview-doodle doodle-1">✿</div>
      <div className="study-overview-doodle doodle-2">♡</div>
      <div className="study-overview-doodle doodle-3">☆</div>
      <div className="study-overview-doodle doodle-4">❀</div>
      <div className="study-overview-doodle doodle-5">✧</div>
      <div className="study-overview-doodle doodle-6">♪</div>

      {/* Mascot with speech bubble */}
      <div className="study-overview-mascot">
        <div className="study-mascot-speech-bubble">
          <span>{getMascotMessage()}</span>
        </div>
        <NurseQuizMascot
          size={80}
          isExcited={progressPercent >= 50}
          lookDirection="center"
        />
      </div>

      {/* Header */}
      <div className="study-overview-header">
        <button className="study-overview-exit" onClick={onExit} aria-label="Exit study mode">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 5 12 12 19" />
          </svg>
        </button>

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

        <div className="study-overview-progress-badge">
          <span className="progress-number">{completedCount}</span>
          <span className="progress-divider">/</span>
          <span className="progress-total">{totalNodes}</span>
        </div>
      </div>

      {/* Progress bar with warm gradient */}
      <div className="study-overview-progress-bar">
        <div
          className="study-overview-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Winding path */}
      <div className="study-overview-path">
        <div className="study-path-nodes">
          {nodes.map((node, index) => {
            const isActive = node.status === 'active';
            const isDone = node.status === 'done';
            const isLocked = node.status === 'locked';
            const offset = getNodeOffset(index);

            return (
              <div
                key={node.id}
                className={`study-path-node ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isLocked ? 'locked' : ''}`}
                style={{ marginLeft: `calc(50% + ${offset}px - 35px)` }}
                onClick={() => !isLocked && onNodeSelect(node)}
              >
                {/* Connector to previous node */}
                {index > 0 && (
                  <svg className="study-path-connector" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <path
                      d={`M50,0 Q${50 + (getNodeOffset(index) - getNodeOffset(index-1)) * 0.5},25 50,50`}
                      fill="none"
                      stroke={nodes[index-1]?.status === 'done' ? '#2ed573' : 'rgba(232, 141, 125, 0.25)'}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={isLocked ? "6 4" : "none"}
                    />
                  </svg>
                )}

                {/* Node circle */}
                <div className="study-path-node-circle">
                  <div className="study-path-node-inner">
                    {getNodeIcon(node.type, node.status)}
                  </div>
                  {isActive && <div className="study-path-node-pulse" />}
                </div>

                {/* Node label - alternating sides */}
                <div className={`study-path-node-label ${index % 2 === 0 ? 'label-right' : 'label-left'}`}>
                  <span className="node-type-tag">
                    {t(`study.nodeType.${node.type}`, node.type)}
                  </span>
                  <span className="node-title">{node.label}</span>
                  {isLocked && <span className="node-coming-soon">{t('study.comingSoon', 'Coming soon!')}</span>}
                </div>

                {/* Step number */}
                <div className="study-path-step-number">{index + 1}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Continue button */}
      {nodes.some(n => n.status === 'active') && (
        <div className="study-overview-action">
          <button
            className="study-overview-continue"
            onClick={() => {
              const activeNode = nodes.find(n => n.status === 'active');
              if (activeNode) onNodeSelect(activeNode);
            }}
          >
            <span>{t('study.continue', 'Continue')}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyPlanOverview;
