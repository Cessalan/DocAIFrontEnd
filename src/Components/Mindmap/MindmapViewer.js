import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import MindmapNode from './MindmapNode';
import './MindmapViewer.css';

// Suppress ResizeObserver loop error (common with React Flow)
if (typeof window !== 'undefined') {
  const resizeObserverErr = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    if (message && message.includes && message.includes('ResizeObserver loop')) {
      return true;
    }
    if (resizeObserverErr) {
      return resizeObserverErr(message, source, lineno, colno, error);
    }
    return false;
  };
}

// Custom node types
const nodeTypes = {
  mindmapNode: MindmapNode,
};

/**
 * Calculate positions for mindmap nodes using a spacious radial layout
 */
const calculateLayout = (nodes, edges) => {
  if (!nodes || nodes.length === 0) return [];

  const rootNode = nodes.find(n => n.data?.nodeType === 'central' || n.parent === null);
  if (!rootNode) return nodes;

  const childrenMap = {};
  nodes.forEach(node => {
    childrenMap[node.id] = [];
  });
  edges.forEach(edge => {
    if (childrenMap[edge.source]) {
      childrenMap[edge.source].push(edge.target);
    }
  });

  const positioned = [];
  const centerX = 600;
  const centerY = 400;

  positioned.push({
    ...rootNode,
    position: { x: centerX - 100, y: centerY - 40 },
    draggable: true,
  });

  const mainNodes = nodes.filter(n => n.parent === rootNode.id);
  const mainRadius = 320;

  mainNodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / mainNodes.length - Math.PI / 2;
    const x = centerX + mainRadius * Math.cos(angle) - 70;
    const y = centerY + mainRadius * Math.sin(angle) - 30;

    positioned.push({
      ...node,
      position: { x, y },
      draggable: true,
    });

    const subNodes = nodes.filter(n => n.parent === node.id);
    const subRadius = 180;

    subNodes.forEach((subNode, subIndex) => {
      const spreadAngle = Math.PI / 2.5;
      const startAngle = angle - spreadAngle / 2;
      const subAngle = subNodes.length === 1
        ? angle
        : startAngle + (spreadAngle * subIndex) / Math.max(subNodes.length - 1, 1);

      const subX = x + 70 + subRadius * Math.cos(subAngle) - 55;
      const subY = y + 30 + subRadius * Math.sin(subAngle) - 25;

      positioned.push({
        ...subNode,
        position: { x: subX, y: subY },
        draggable: true,
      });

      const detailNodes = nodes.filter(n => n.parent === subNode.id);
      const detailRadius = 120;

      detailNodes.forEach((detailNode, detailIndex) => {
        const detailSpread = Math.PI / 3;
        const detailStartAngle = subAngle - detailSpread / 2;
        const detailAngle = detailNodes.length === 1
          ? subAngle
          : detailStartAngle + (detailSpread * detailIndex) / Math.max(detailNodes.length - 1, 1);

        const detailX = subX + 55 + detailRadius * Math.cos(detailAngle) - 45;
        const detailY = subY + 25 + detailRadius * Math.sin(detailAngle) - 20;

        positioned.push({
          ...detailNode,
          position: { x: detailX, y: detailY },
          draggable: true,
        });
      });
    });
  });

  return positioned;
};

/**
 * Transform backend mindmap data to React Flow format
 */
const transformToReactFlow = (mindmapData) => {
  if (!mindmapData || !mindmapData.nodes) {
    return { nodes: [], edges: [] };
  }

  const nodes = mindmapData.nodes.map(node => ({
    id: node.id,
    type: 'mindmapNode',
    data: {
      label: node.label,
      summary: node.summary,
      nodeType: node.type,
    },
    position: { x: 0, y: 0 },
    parent: node.parent,
    draggable: true,
  }));

  const edges = mindmapData.edges.map(edge => ({
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: false,
    style: {
      stroke: '#b8a5d4',
      strokeWidth: 2.5,
      opacity: 0.7,
    },
  }));

  const positionedNodes = calculateLayout(nodes, edges);

  return {
    nodes: positionedNodes,
    edges,
  };
};

/**
 * Standalone Modal Component - Completely independent from inline viewer
 * This component manages its own ReactFlow instance and state
 */
const MindmapModal = ({ mindmapData, onClose, onNodeClick }) => {
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  // Create fresh nodes and edges from mindmapData
  const { nodes: freshNodes, edges: freshEdges } = useMemo(() => {
    return transformToReactFlow(mindmapData);
  }, [mindmapData]);

  const [nodes, , onNodesChange] = useNodesState(freshNodes);
  const [edges, , onEdgesChange] = useEdgesState(freshEdges);

  // Delay visibility to allow container to get dimensions
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [onNodeClick]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="mindmap-modal-overlay" onClick={onClose}>
      <div className="mindmap-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="mindmap-modal-header">
          <h2 className="mindmap-modal-title">{mindmapData.central_topic || 'Mindmap'}</h2>
          <button className="mindmap-modal-close" onClick={onClose} title="Close (Esc)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="mindmap-modal-content" ref={containerRef}>
          {isVisible && nodes.length > 0 && (
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onPaneClick={handlePaneClick}
                nodeTypes={nodeTypes}
                nodesDraggable={true}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 0.8 }}
                minZoom={0.1}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
              >
                <Controls className="mindmap-controls" />
                <MiniMap
                  className="mindmap-minimap"
                  nodeColor={(node) => {
                    switch (node.data?.nodeType) {
                      case 'central': return '#e88d7d';
                      case 'main': return '#b8a5d4';
                      case 'sub': return '#5eead4';
                      case 'detail': return '#64748b';
                      default: return '#64748b';
                    }
                  }}
                  maskColor="rgba(0, 0, 0, 0.7)"
                  pannable
                  zoomable
                />
                <Background
                  color="rgba(200, 180, 220, 0.15)"
                  gap={24}
                  size={1}
                />
                <Panel position="bottom-center" className="mindmap-hint-panel">
                  Drag nodes to rearrange
                </Panel>
              </ReactFlow>
            </ReactFlowProvider>
          )}

          {/* Tooltip */}
          {selectedNode && selectedNode.data?.summary && (
            <div className="mindmap-tooltip mindmap-tooltip-modal">
              <div className="tooltip-header">{selectedNode.data.label}</div>
              <div className="tooltip-content">{selectedNode.data.summary}</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mindmap-modal-footer">
          Click a node to see details. Drag to rearrange. Scroll to zoom.
        </div>
      </div>
    </div>
  );
};

/**
 * Inline viewer component
 */
const InlineViewer = ({ mindmapData, onNodeClick, onExpand }) => {
  const [selectedNode, setSelectedNode] = useState(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => transformToReactFlow(mindmapData),
    [mindmapData]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when mindmapData changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = transformToReactFlow(mindmapData);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [mindmapData, setNodes, setEdges]);

  const handleNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [onNodeClick]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="mindmap-viewer">
      <div className="mindmap-header">
        <h3 className="mindmap-title">{mindmapData.central_topic || 'Mindmap'}</h3>
        <div className="mindmap-header-actions">
          <button
            className="mindmap-expand-btn"
            onClick={onExpand}
            title="Expand mindmap"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            <span>Expand</span>
          </button>
        </div>
      </div>

      <div className="mindmap-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          nodesDraggable={true}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="mindmap-controls" />
          <Background
            color="rgba(200, 180, 220, 0.15)"
            gap={24}
            size={1}
          />
          <Panel position="bottom-center" className="mindmap-hint-panel">
            Drag nodes to rearrange
          </Panel>
        </ReactFlow>
      </div>

      {/* Tooltip for inline */}
      {selectedNode && selectedNode.data?.summary && (
        <div className="mindmap-tooltip">
          <div className="tooltip-header">{selectedNode.data.label}</div>
          <div className="tooltip-content">{selectedNode.data.summary}</div>
        </div>
      )}

      <div className="mindmap-instructions">
        Click a node to see details. Drag to rearrange. Scroll to zoom.
      </div>
    </div>
  );
};

/**
 * MindmapViewer - Main component that orchestrates inline and modal views
 */
const MindmapViewer = ({ mindmapData, onNodeClick }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!mindmapData || !mindmapData.nodes || mindmapData.nodes.length === 0) {
    return (
      <div className="mindmap-empty">
        <p>No mindmap data available</p>
      </div>
    );
  }

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      {/* Modal - rendered completely separately */}
      {isModalOpen && (
        <MindmapModal
          mindmapData={mindmapData}
          onClose={handleCloseModal}
          onNodeClick={onNodeClick}
        />
      )}

      {/* Inline Viewer */}
      <ReactFlowProvider>
        <InlineViewer
          mindmapData={mindmapData}
          onNodeClick={onNodeClick}
          onExpand={handleOpenModal}
        />
      </ReactFlowProvider>
    </>
  );
};

export default MindmapViewer;
