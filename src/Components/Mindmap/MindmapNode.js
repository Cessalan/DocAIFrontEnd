import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import './MindmapNode.css';

/**
 * Custom node component for mindmap visualization
 * Styled based on node type (central, main, sub, detail)
 */
const MindmapNode = memo(({ data, selected }) => {
  const { label, summary, nodeType } = data;

  return (
    <div className={`mindmap-node mindmap-node-${nodeType} ${selected ? 'selected' : ''}`}>
      {/* Input handle (not for central node) */}
      {nodeType !== 'central' && (
        <Handle
          type="target"
          position={Position.Left}
          className="mindmap-handle"
        />
      )}

      <div className="mindmap-node-content">
        <span className="mindmap-node-label">{label}</span>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="mindmap-handle"
      />
    </div>
  );
});

MindmapNode.displayName = 'MindmapNode';

export default MindmapNode;
