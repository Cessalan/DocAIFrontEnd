import React, { useCallback, useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
 * Calculate positions for mindmap nodes using a horizontal left-to-right tree layout
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

  // Horizontal spacing between levels
  const levelGap = 280;
  // Vertical spacing between nodes at same level
  const nodeGap = 100;

  // Start position (left side)
  const startX = 80;
  const startY = 300;

  // Position root node on the left
  positioned.push({
    ...rootNode,
    position: { x: startX, y: startY },
    draggable: true,
  });

  const mainNodes = nodes.filter(n => n.parent === rootNode.id);
  const mainCount = mainNodes.length;
  const mainStartY = startY - ((mainCount - 1) * nodeGap) / 2;

  mainNodes.forEach((node, index) => {
    const x = startX + levelGap;
    const y = mainStartY + index * nodeGap;

    positioned.push({
      ...node,
      position: { x, y },
      draggable: true,
    });

    const subNodes = nodes.filter(n => n.parent === node.id);
    const subCount = subNodes.length;
    const subStartY = y - ((subCount - 1) * (nodeGap * 0.7)) / 2;

    subNodes.forEach((subNode, subIndex) => {
      const subX = x + levelGap * 0.85;
      const subY = subStartY + subIndex * (nodeGap * 0.7);

      positioned.push({
        ...subNode,
        position: { x: subX, y: subY },
        draggable: true,
      });

      const detailNodes = nodes.filter(n => n.parent === subNode.id);
      const detailCount = detailNodes.length;
      const detailStartY = subY - ((detailCount - 1) * (nodeGap * 0.5)) / 2;

      detailNodes.forEach((detailNode, detailIndex) => {
        const detailX = subX + levelGap * 0.7;
        const detailY = detailStartY + detailIndex * (nodeGap * 0.5);

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
      stroke: '#e8a090',
      strokeWidth: 2,
      opacity: 0.8,
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
  const [isDownloading, setIsDownloading] = useState(false);
  // Removed isVisible state to force immediate render
  const [rfInstance, setRfInstance] = useState(null);

  // Download mindmap as PDF
  const handleDownloadPDF = useCallback(async () => {
    if (!containerRef.current || isDownloading) return;

    setIsDownloading(true);

    try {
      // Get the ReactFlow viewport element (the actual rendered canvas)
      const reactFlowViewport = containerRef.current.querySelector('.react-flow__viewport');
      if (!reactFlowViewport) {
        console.error('ReactFlow viewport not found');
        return;
      }

      // Hide controls and minimap temporarily
      const controls = containerRef.current.querySelector('.react-flow__controls');
      const minimap = containerRef.current.querySelector('.react-flow__minimap');
      if (controls) controls.style.display = 'none';
      if (minimap) minimap.style.display = 'none';

      // Capture the actual visible ReactFlow container
      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#fdf8f3',
        logging: false,
      });

      // Restore controls and minimap
      if (controls) controls.style.display = '';
      if (minimap) minimap.style.display = '';

      // Create PDF in landscape
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add header with logo and branding
      // Draw header background
      pdf.setFillColor(253, 248, 243);
      pdf.rect(0, 0, pageWidth, 30, 'F');

      // Add logo (we'll use text since image loading can be tricky)
      pdf.setFontSize(18);
      pdf.setTextColor(31, 31, 31);
      pdf.setFont('helvetica', 'bold');
      pdf.text('NurseQuizAI', 15, 15);

      // Add website link
      pdf.setFontSize(10);
      pdf.setTextColor(224, 112, 101);
      pdf.setFont('helvetica', 'normal');
      pdf.text('nursequizai.com', 15, 22);

      // Add tagline on right
      pdf.setFontSize(9);
      pdf.setTextColor(136, 136, 136);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Your AI-Powered Nursing Study Companion', pageWidth - 15, 15, { align: 'right' });

      // Draw header line
      pdf.setDrawColor(224, 112, 101);
      pdf.setLineWidth(0.8);
      pdf.line(10, 28, pageWidth - 10, 28);

      // Add title
      pdf.setFontSize(16);
      pdf.setTextColor(31, 31, 31);
      pdf.setFont('helvetica', 'bold');
      const title = mindmapData.central_topic || 'Concept Map';
      pdf.text(title, pageWidth / 2, 38, { align: 'center' });

      // Add subtitle
      pdf.setFontSize(10);
      pdf.setTextColor(224, 112, 101);
      pdf.setFont('helvetica', 'normal');
      pdf.text('CONCEPT MIND MAP', pageWidth / 2, 45, { align: 'center' });

      // Add the mindmap image
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 20; // margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const maxImgHeight = pageHeight - 65; // leave room for header and footer

      // Scale down if too tall
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      if (imgHeight > maxImgHeight) {
        finalHeight = maxImgHeight;
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }

      const imgX = (pageWidth - finalWidth) / 2;
      const imgY = 50;

      pdf.addImage(imgData, 'PNG', imgX, imgY, finalWidth, finalHeight);

      // Add footer
      const footerY = pageHeight - 8;
      pdf.setDrawColor(238, 238, 238);
      pdf.setLineWidth(0.5);
      pdf.line(10, footerY - 5, pageWidth - 10, footerY - 5);

      pdf.setFontSize(9);
      pdf.setTextColor(136, 136, 136);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Generated by NurseQuizAI', 15, footerY);

      pdf.setTextColor(224, 112, 101);
      pdf.setFont('helvetica', 'bold');
      pdf.text('nursequizai.com', pageWidth - 15, footerY, { align: 'right' });

      // Save PDF
      const filename = `${(mindmapData.central_topic || 'mindmap').replace(/[^a-z0-9]/gi, '_')}_mindmap.pdf`;
      pdf.save(filename);

    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [mindmapData, isDownloading]);

  // Create fresh nodes and edges from mindmapData
  const { nodes: freshNodes, edges: freshEdges } = useMemo(() => {
    return transformToReactFlow(mindmapData);
  }, [mindmapData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(freshNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(freshEdges);

  const handleNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [onNodeClick]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Sync state when freshNodes/freshEdges change (crucial for updates)
  useEffect(() => {
    setNodes(freshNodes);
    setEdges(freshEdges);
  }, [freshNodes, freshEdges, setNodes, setEdges]);

  // Delay fitView to allow container to get dimensions AND animation to finish
  // The CSS animation is 0.3s, so we wait slightly longer to ensure layout is stable
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rfInstance && nodes.length > 0) {
        console.log("🔄 Triggering delayed fitView after animation...");
        rfInstance.fitView({ padding: 0.2, maxZoom: 0.85, duration: 800 });
      }
    }, 450); // Wait 450ms (300ms animation + buffer)

    return () => {
      clearTimeout(timer);
    };
  }, [rfInstance, nodes.length]); // Added dependencies to retry if instance comes late

  // Re-fit view when dependencies change, but debounce it
  // layout-aware centering
  const fitViewTriggeredRef = useRef(false);

  // ResizeObserver to handle layout changes (modal animation, window resize)
  useLayoutEffect(() => {
    if (!containerRef.current || !rfInstance || nodes.length === 0) return;

    const currentContainer = containerRef.current;

    // Observer to watch for dimension changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Only fit view if we have valid dimensions
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          console.log(`📏 Container resize detected: ${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`);

          // Debounce the fitView call
          window.requestAnimationFrame(() => {
            rfInstance.fitView({ padding: 0.15, duration: 400 });
          });

          if (!fitViewTriggeredRef.current) {
            fitViewTriggeredRef.current = true;
          }
        }
      }
    });

    resizeObserver.observe(currentContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }, [rfInstance, nodes.length]);

  // Initial FitView - wait for instance and nodes
  useEffect(() => {
    // Retry sequence for fitView (brute force to ensure visibility)
    const retryFitView = (retries = 3, delay = 300) => {
      if (retries <= 0) return;

      setTimeout(() => {
        if (rfInstance && nodes.length > 0) {
          console.log(`🔄 Retry fitView (${retries} left)`);
          rfInstance.fitView({ padding: 0.15, duration: 800 });
          retryFitView(retries - 1, delay + 200);
        }
      }, delay);
    };

    if (rfInstance && nodes.length > 0) {
      retryFitView(5, 100);
    }
  }, [rfInstance, nodes.length]);

  const handleCenterMap = useCallback((e) => {
    e.stopPropagation();
    if (rfInstance) {
      rfInstance.fitView({ padding: 0.15, duration: 800 });
    }
  }, [rfInstance]);

  return (
    <div className="mindmap-modal-overlay" onClick={onClose}>
      <div className="mindmap-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="mindmap-modal-header">
          <h2 className="mindmap-modal-title">{mindmapData.central_topic || 'Mindmap'}</h2>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="mindmap-modal-action-btn"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              title="Download PDF"
            >
              {isDownloading ? (
                <span className="mindmap-btn-spinner"></span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
              PDF
            </button>

            <button
              className="mindmap-modal-action-btn"
              onClick={handleCenterMap}
              title="Center Map"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
              Center
            </button>

            <button className="mindmap-modal-close" onClick={onClose} title="Close (Esc)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="mindmap-modal-content" ref={containerRef}>
          {nodes.length > 0 && (
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
              onInit={(inst) => {
                console.log("🚀 Modal ReactFlow Init Success!");
                setRfInstance(inst);
              }}
              style={{ width: '100%', height: '100%' }}
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
            </ReactFlow>
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
  const [isDownloading, setIsDownloading] = useState(false);
  const containerRef = useRef(null);

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

  // Download mindmap as PDF
  const handleDownloadPDF = useCallback(async () => {
    if (!containerRef.current || isDownloading) return;

    setIsDownloading(true);

    try {
      // Hide controls temporarily
      const controls = containerRef.current.querySelector('.react-flow__controls');
      if (controls) controls.style.display = 'none';

      // Capture the actual visible ReactFlow container
      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#fdf8f3',
        logging: false,
      });

      // Restore controls
      if (controls) controls.style.display = '';

      // Create PDF in landscape
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add header with logo and branding
      pdf.setFillColor(253, 248, 243);
      pdf.rect(0, 0, pageWidth, 30, 'F');

      pdf.setFontSize(18);
      pdf.setTextColor(31, 31, 31);
      pdf.setFont('helvetica', 'bold');
      pdf.text('NurseQuizAI', 15, 15);

      pdf.setFontSize(10);
      pdf.setTextColor(224, 112, 101);
      pdf.setFont('helvetica', 'normal');
      pdf.text('nursequizai.com', 15, 22);

      pdf.setFontSize(9);
      pdf.setTextColor(136, 136, 136);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Your AI-Powered Nursing Study Companion', pageWidth - 15, 15, { align: 'right' });

      pdf.setDrawColor(224, 112, 101);
      pdf.setLineWidth(0.8);
      pdf.line(10, 28, pageWidth - 10, 28);

      // Add title
      pdf.setFontSize(16);
      pdf.setTextColor(31, 31, 31);
      pdf.setFont('helvetica', 'bold');
      const title = mindmapData.central_topic || 'Concept Map';
      pdf.text(title, pageWidth / 2, 38, { align: 'center' });

      pdf.setFontSize(10);
      pdf.setTextColor(224, 112, 101);
      pdf.setFont('helvetica', 'normal');
      pdf.text('CONCEPT MIND MAP', pageWidth / 2, 45, { align: 'center' });

      // Add the mindmap image
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const maxImgHeight = pageHeight - 65;

      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      if (imgHeight > maxImgHeight) {
        finalHeight = maxImgHeight;
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }

      const imgX = (pageWidth - finalWidth) / 2;
      const imgY = 50;

      pdf.addImage(imgData, 'PNG', imgX, imgY, finalWidth, finalHeight);

      // Add footer
      const footerY = pageHeight - 8;
      pdf.setDrawColor(238, 238, 238);
      pdf.setLineWidth(0.5);
      pdf.line(10, footerY - 5, pageWidth - 10, footerY - 5);

      pdf.setFontSize(9);
      pdf.setTextColor(136, 136, 136);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Generated by NurseQuizAI', 15, footerY);

      pdf.setTextColor(224, 112, 101);
      pdf.setFont('helvetica', 'bold');
      pdf.text('nursequizai.com', pageWidth - 15, footerY, { align: 'right' });

      // Save PDF
      const filename = `${(mindmapData.central_topic || 'mindmap').replace(/[^a-z0-9]/gi, '_')}_mindmap.pdf`;
      pdf.save(filename);

    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [mindmapData, isDownloading]);

  return (
    <div className="mindmap-viewer">
      <div className="mindmap-header">
        <h3 className="mindmap-title">{mindmapData.central_topic || 'Mindmap'}</h3>
        <div className="mindmap-header-actions">
          <button
            className="mindmap-action-btn"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            title="Download PDF"
          >
            {isDownloading ? (
              <span className="mindmap-btn-spinner"></span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            <span>PDF</span>
          </button>
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

      <div className="mindmap-container" ref={containerRef}>
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
          fitViewOptions={{ padding: 0.15, maxZoom: 0.9 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <Controls className="mindmap-controls" />
          <Background
            color="rgba(200, 180, 220, 0.15)"
            gap={24}
            size={1}
          />
        </ReactFlow>

        {/* Tooltip for inline */}
        {selectedNode && selectedNode.data?.summary && (
          <div className="mindmap-tooltip">
            <div className="tooltip-header">{selectedNode.data.label}</div>
            <div className="tooltip-content">{selectedNode.data.summary}</div>
          </div>
        )}
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
      {/* Modal - rendered completely separately via Portal to escape stacking contexts */}
      {isModalOpen && createPortal(
        <ReactFlowProvider>
          <MindmapModal
            mindmapData={mindmapData}
            onClose={handleCloseModal}
            onNodeClick={onNodeClick}
          />
        </ReactFlowProvider>,
        document.body
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
