import React from 'react';
import StudyNodeIcon from './StudyNodeIcon';

/**
 * StudyPathView - Duolingo-style vertical path with connected nodes
 * Shows the entire study journey with progress visualization
 *
 * @param {Array} nodes - Array of node objects
 * @param {string} activeNodeId - ID of the currently active node
 * @param {Function} onStartNode - Callback when START is clicked on active node
 */
const StudyPathView = ({ nodes = [], activeNodeId, onStartNode }) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="study-path-container">
        <div className="study-path-empty">
          <p>No study path available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="study-path-container">
      {/* Background connector line */}
      <div className="study-path-line" />

      <div className="study-path-nodes">
        {nodes.map((node, index) => (
          <React.Fragment key={node.id}>
            {/* Connector segment above node (except first) */}
            {index > 0 && (
              <div
                className={`study-node-connector ${
                  nodes[index - 1].status === 'done' ? 'done' : ''
                }`}
              />
            )}

            <StudyNodeIcon
              node={node}
              isActive={node.id === activeNodeId}
              onStartNode={onStartNode}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default StudyPathView;
