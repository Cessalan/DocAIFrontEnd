import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import './MindmapNode.css';

/**
 * Custom node component for mindmap visualization
 * Nursing concept map style: white background with colored borders
 * Supports expanded mode to show details inline
 */
const MindmapNode = memo(({ data, selected }) => {
  const { label, summary, nodeType, details, expanded, branchColor } = data;

  const hasDetails = details && details.length > 0;
  const hasSummary = summary && summary.trim().length > 0;
  const showExpanded = expanded && (hasDetails || hasSummary);

  // Dynamic style with branch color
  const nodeStyle = branchColor ? {
    borderColor: branchColor,
    '--branch-color': branchColor,
  } : {};

  return (
    <div
      className={`mindmap-node mindmap-node-${nodeType} ${selected ? 'selected' : ''} ${showExpanded ? 'expanded' : ''}`}
      style={nodeStyle}
    >
      {/* Input handle (not for central node) */}
      {nodeType !== 'central' && (
        <Handle
          type="target"
          position={Position.Left}
          className="mindmap-handle"
          style={branchColor ? { backgroundColor: branchColor } : {}}
        />
      )}

      <div className="mindmap-node-content">
        <span className="mindmap-node-label">{label}</span>

        {/* Expanded details section */}
        {showExpanded && (
          <div className="mindmap-node-details">
            {hasSummary && (
              <p className="mindmap-node-summary">{summary}</p>
            )}
            {hasDetails && (
              <ul className="mindmap-node-details-list">
                {details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="mindmap-handle"
        style={branchColor ? { backgroundColor: branchColor } : {}}
      />
    </div>
  );
});

MindmapNode.displayName = 'MindmapNode';

export default MindmapNode;
