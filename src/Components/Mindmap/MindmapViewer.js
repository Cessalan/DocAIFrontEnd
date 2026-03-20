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
import { useTranslation } from 'react-i18next';
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
 * Pastel colors for nursing concept map style
 * Each main branch gets a different color
 */
const BRANCH_COLORS = [
  '#FFB3BA', // Pastel pink
  '#BAFFC9', // Pastel green
  '#BAE1FF', // Pastel blue
  '#FFFFBA', // Pastel yellow
  '#FFD9BA', // Pastel orange
  '#E0BBE4', // Pastel purple
  '#D4F0F0', // Pastel cyan
  '#FCE4EC', // Light pink
  '#F0F4C3', // Light lime
  '#B3E5FC', // Light blue
];

/**
 * Calculate positions for mindmap nodes using a horizontal tree layout
 * Root on the left, branches spreading to the right
 * @param {Array} nodes - Array of nodes
 * @param {Array} edges - Array of edges
 * @param {boolean} expanded - Whether nodes are in expanded mode (show details)
 */
const calculateHorizontalLayout = (nodes, edges, expanded = false) => {
  if (!nodes || nodes.length === 0) return [];

  const rootNode = nodes.find(n => n.data?.nodeType === 'central' || n.parent === null);
  if (!rootNode) return nodes;

  // Build parent-to-children map
  const childrenMap = {};
  const nodeMap = {};
  nodes.forEach(node => {
    childrenMap[node.id] = [];
    nodeMap[node.id] = node;
  });
  edges.forEach(edge => {
    if (childrenMap[edge.source]) {
      childrenMap[edge.source].push(edge.target);
    }
  });

  // Get main children for color assignment
  const mainChildren = childrenMap[rootNode.id] || [];

  // Assign colors to main branches
  const branchColors = {};
  const assignBranchColor = (nodeId, color) => {
    branchColors[nodeId] = color;
    const children = childrenMap[nodeId] || [];
    children.forEach(childId => assignBranchColor(childId, color));
  };
  mainChildren.forEach((childId, index) => {
    const color = BRANCH_COLORS[index % BRANCH_COLORS.length];
    assignBranchColor(childId, color);
  });

  // Layout constants - larger spacing for expanded mode
  const LEVEL_GAP = expanded ? 380 : 280; // Horizontal spacing between levels
  const VERTICAL_PADDING = expanded ? 50 : 35; // Minimum vertical space between nodes

  // Calculate node height based on content
  const getNodeHeight = (nodeId) => {
    const node = nodeMap[nodeId];
    if (!node) return 60;

    if (!expanded) return 60; // Compact mode: fixed height

    // Expanded mode: estimate height based on content
    const details = node.data?.details || [];
    const hasSummary = node.data?.summary && node.data.summary.trim().length > 0;

    let height = 60; // Base height for label
    if (hasSummary) height += 30;
    if (details.length > 0) {
      height += details.length * 20;
    }

    return Math.max(90, height);
  };

  // Recursively calculate the height needed for a subtree
  const getSubtreeHeight = (nodeId) => {
    const children = childrenMap[nodeId] || [];
    const nodeHeight = getNodeHeight(nodeId);

    if (children.length === 0) {
      return nodeHeight;
    }

    let totalChildrenHeight = 0;
    children.forEach((childId, index) => {
      totalChildrenHeight += getSubtreeHeight(childId);
      if (index < children.length - 1) {
        totalChildrenHeight += VERTICAL_PADDING;
      }
    });

    return Math.max(nodeHeight, totalChildrenHeight);
  };

  const positioned = [];

  // Recursively position nodes
  const positionNode = (nodeId, x, yStart, yEnd) => {
    const node = nodeMap[nodeId];
    if (!node) return;

    // Center this node in its allocated vertical space
    const y = (yStart + yEnd) / 2;

    positioned.push({
      ...node,
      position: { x, y },
      data: {
        ...node.data,
        branchColor: branchColors[nodeId] || '#FFD54F',
      },
      draggable: true,
    });

    const children = childrenMap[nodeId] || [];
    if (children.length === 0) return;

    // Calculate total height needed for all children
    const childHeights = children.map(childId => getSubtreeHeight(childId));
    const totalChildrenHeight = childHeights.reduce((sum, h) => sum + h, 0) +
                                 (children.length - 1) * VERTICAL_PADDING;

    // Start positioning children from the top of allocated space
    let currentY = y - totalChildrenHeight / 2;

    children.forEach((childId, index) => {
      const childHeight = childHeights[index];
      const childYStart = currentY;
      const childYEnd = currentY + childHeight;

      positionNode(childId, x + LEVEL_GAP, childYStart, childYEnd);

      currentY = childYEnd + VERTICAL_PADDING;
    });
  };

  // Calculate total height needed for the entire tree
  const totalHeight = getSubtreeHeight(rootNode.id);
  const startX = 100;
  const centerY = Math.max(500, totalHeight / 2 + 100);

  // Position starting from root
  positionNode(rootNode.id, startX, centerY - totalHeight / 2, centerY + totalHeight / 2);

  return positioned;
};

/**
 * Calculate positions for mindmap nodes using a radial/circular layout
 * Central node in the middle, main topics radiating outward
 * Much larger spacing to prevent overlap
 * @param {Array} nodes - Array of nodes
 * @param {Array} edges - Array of edges
 * @param {boolean} expanded - Whether nodes are in expanded mode (show details)
 */
const calculateRadialLayout = (nodes, edges, expanded = false) => {
  if (!nodes || nodes.length === 0) return [];

  const rootNode = nodes.find(n => n.data?.nodeType === 'central' || n.parent === null);
  if (!rootNode) return nodes;

  // Build parent-to-children map
  const childrenMap = {};
  const nodeMap = {};
  nodes.forEach(node => {
    childrenMap[node.id] = [];
    nodeMap[node.id] = node;
  });
  edges.forEach(edge => {
    if (childrenMap[edge.source]) {
      childrenMap[edge.source].push(edge.target);
    }
  });

  // Count total nodes to adjust spacing dynamically
  const totalNodes = nodes.length;
  const mainChildren = childrenMap[rootNode.id] || [];
  const numMainChildren = mainChildren.length;

  // Dynamic spacing based on content - MUCH larger for expanded mode
  const baseRadius = expanded ? 450 : 320;
  const radiusMultiplier = Math.max(1, Math.sqrt(totalNodes / 15));

  // Layout constants for radial layout - significantly increased
  const CENTER_X = 800;
  const CENTER_Y = 800;
  const FIRST_RING_RADIUS = baseRadius * radiusMultiplier;
  const SECOND_RING_RADIUS = (expanded ? 280 : 200) * radiusMultiplier;
  const THIRD_RING_RADIUS = (expanded ? 200 : 150) * radiusMultiplier;

  const positioned = [];

  // Assign colors to main branches
  const branchColors = {};
  mainChildren.forEach((childId, index) => {
    branchColors[childId] = BRANCH_COLORS[index % BRANCH_COLORS.length];
  });

  // Function to propagate branch color to all descendants
  const assignBranchColor = (nodeId, color) => {
    branchColors[nodeId] = color;
    const children = childrenMap[nodeId] || [];
    children.forEach(childId => assignBranchColor(childId, color));
  };

  // Propagate colors to all descendants
  mainChildren.forEach((childId, index) => {
    const color = BRANCH_COLORS[index % BRANCH_COLORS.length];
    assignBranchColor(childId, color);
  });

  // Position root node at center
  positioned.push({
    ...rootNode,
    position: { x: CENTER_X, y: CENTER_Y },
    data: {
      ...rootNode.data,
      branchColor: '#FFD54F', // Golden yellow for central node
    },
    draggable: true,
  });

  // Calculate how many descendants each main branch has (for angle allocation)
  const getDescendantCount = (nodeId) => {
    const children = childrenMap[nodeId] || [];
    if (children.length === 0) return 1;
    return 1 + children.reduce((sum, childId) => sum + getDescendantCount(childId), 0);
  };

  // Position main children in a circle around root
  // Use equal spacing for main nodes to prevent clustering
  const mainAngleStep = (2 * Math.PI) / Math.max(numMainChildren, 1);
  let currentAngle = -Math.PI / 2; // Start from top

  mainChildren.forEach((childId) => {
    const node = nodeMap[childId];
    if (!node) return;

    const angle = currentAngle;

    // Position main node
    const x = CENTER_X + Math.cos(angle) * FIRST_RING_RADIUS;
    const y = CENTER_Y + Math.sin(angle) * FIRST_RING_RADIUS;

    positioned.push({
      ...node,
      position: { x, y },
      data: {
        ...node.data,
        branchColor: branchColors[childId],
      },
      draggable: true,
    });

    // Position sub-children radiating outward from this main node
    const subChildren = childrenMap[childId] || [];
    if (subChildren.length > 0) {
      // Calculate sub-angle spread - wider spread for more children
      const baseSpread = Math.PI / 3; // 60 degrees base
      const extraSpread = Math.min(Math.PI / 4, (subChildren.length - 1) * 0.15);
      const subAngleSpread = baseSpread + extraSpread;
      const subStartAngle = angle - subAngleSpread / 2;
      const subAngleStep = subChildren.length > 1 ? subAngleSpread / (subChildren.length - 1) : 0;

      subChildren.forEach((subChildId, subIndex) => {
        const subNode = nodeMap[subChildId];
        if (!subNode) return;

        const subAngle = subChildren.length === 1 ? angle : subStartAngle + subIndex * subAngleStep;
        const subX = x + Math.cos(subAngle) * SECOND_RING_RADIUS;
        const subY = y + Math.sin(subAngle) * SECOND_RING_RADIUS;

        positioned.push({
          ...subNode,
          position: { x: subX, y: subY },
          data: {
            ...subNode.data,
            branchColor: branchColors[subChildId],
          },
          draggable: true,
        });

        // Position detail children
        const detailChildren = childrenMap[subChildId] || [];
        if (detailChildren.length > 0) {
          const detailBaseSpread = Math.PI / 4;
          const detailExtraSpread = Math.min(Math.PI / 6, (detailChildren.length - 1) * 0.12);
          const detailAngleSpread = detailBaseSpread + detailExtraSpread;
          const detailStartAngle = subAngle - detailAngleSpread / 2;
          const detailAngleStep = detailChildren.length > 1 ? detailAngleSpread / (detailChildren.length - 1) : 0;

          detailChildren.forEach((detailChildId, detailIndex) => {
            const detailNode = nodeMap[detailChildId];
            if (!detailNode) return;

            const detailAngle = detailChildren.length === 1 ? subAngle : detailStartAngle + detailIndex * detailAngleStep;
            const detailX = subX + Math.cos(detailAngle) * THIRD_RING_RADIUS;
            const detailY = subY + Math.sin(detailAngle) * THIRD_RING_RADIUS;

            positioned.push({
              ...detailNode,
              position: { x: detailX, y: detailY },
              data: {
                ...detailNode.data,
                branchColor: branchColors[detailChildId],
              },
              draggable: true,
            });
          });
        }
      });
    }

    currentAngle += mainAngleStep;
  });

  return positioned;
};

/**
 * Transform backend mindmap data to React Flow format
 * @param {Object} mindmapData - The mindmap data from backend
 * @param {boolean} expanded - Whether to show expanded details on nodes
 * @param {string} layoutMode - 'radial' or 'horizontal'
 */
const transformToReactFlow = (mindmapData, expanded = false, layoutMode = 'horizontal') => {
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
      details: node.details || [],
      expanded: expanded, // Pass expanded flag to each node
    },
    position: { x: 0, y: 0 },
    parent: node.parent,
    draggable: true,
  }));

  // Create a map of node colors for edge styling
  const nodeColorMap = {};
  nodes.forEach(node => {
    if (node.data?.branchColor) {
      nodeColorMap[node.id] = node.data.branchColor;
    }
  });

  const edges = mindmapData.edges.map(edge => {
    // Use the target node's branch color for the edge
    const edgeColor = nodeColorMap[edge.target] || '#c9b8a8';

    return {
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'default', // Simple curved bezier for radial layout
      animated: false,
      label: edge.label || '',
      labelStyle: {
        fill: '#555',
        fontSize: 10,
        fontWeight: 500,
        fontFamily: 'inherit',
      },
      labelBgStyle: {
        fill: 'transparent', // Let CSS handle background color matching canvas
        rx: 0,
        ry: 0,
      },
      labelBgPadding: [2, 4], // Minimal padding for inline text effect
      labelBgBorderRadius: 0,
      labelShowBg: true, // Keep bg to create "break" in line
      style: {
        stroke: edgeColor,
        strokeWidth: 2.5,
        opacity: 0.8,
      },
    };
  });

  // Choose layout based on mode
  const positionedNodes = layoutMode === 'radial'
    ? calculateRadialLayout(nodes, edges, expanded)
    : calculateHorizontalLayout(nodes, edges, expanded);

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
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Toggle for expanded details view
  const [layoutMode, setLayoutMode] = useState('horizontal'); // 'horizontal' or 'radial'
  const [rfInstance, setRfInstance] = useState(null);

  // Download mindmap as PDF - Improved version that captures all content
  const handleDownloadPDF = useCallback(async () => {
    if (!containerRef.current || isDownloading || !rfInstance) return;

    setIsDownloading(true);

    try {
      // Get the ReactFlow container
      const reactFlowContainer = containerRef.current.querySelector('.react-flow');
      const reactFlowViewport = containerRef.current.querySelector('.react-flow__viewport');

      if (!reactFlowContainer || !reactFlowViewport) {
        console.error('ReactFlow elements not found');
        setIsDownloading(false);
        return;
      }

      // Hide UI elements temporarily
      const controls = containerRef.current.querySelector('.react-flow__controls');
      const minimap = containerRef.current.querySelector('.react-flow__minimap');
      const tooltip = containerRef.current.querySelector('.mindmap-tooltip');

      if (controls) controls.style.display = 'none';
      if (minimap) minimap.style.display = 'none';
      if (tooltip) tooltip.style.display = 'none';

      // Get the bounding box of all nodes to determine content area
      const nodesBounds = rfInstance.getNodes().reduce((bounds, node) => {
        const nodeWidth = node.width || 150;
        const nodeHeight = node.height || 50;
        return {
          minX: Math.min(bounds.minX, node.position.x),
          minY: Math.min(bounds.minY, node.position.y),
          maxX: Math.max(bounds.maxX, node.position.x + nodeWidth),
          maxY: Math.max(bounds.maxY, node.position.y + nodeHeight),
        };
      }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

      // Add padding around content
      const padding = 60;
      const contentWidth = nodesBounds.maxX - nodesBounds.minX + padding * 2;
      const contentHeight = nodesBounds.maxY - nodesBounds.minY + padding * 2;

      // Create a temporary off-screen container for high-quality capture
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: ${contentWidth}px;
        height: ${contentHeight}px;
        background: #fafafa;
        overflow: visible;
      `;
      document.body.appendChild(tempContainer);

      // Clone the viewport content
      const viewportClone = reactFlowViewport.cloneNode(true);

      // Calculate transform to position content at origin with padding
      const offsetX = -nodesBounds.minX + padding;
      const offsetY = -nodesBounds.minY + padding;
      viewportClone.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1)`;
      viewportClone.style.transformOrigin = '0 0';

      tempContainer.appendChild(viewportClone);

      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture at high resolution
      const canvas = await html2canvas(tempContainer, {
        scale: 3, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#fafafa',
        logging: false,
        width: contentWidth,
        height: contentHeight,
      });

      // Clean up temp container
      document.body.removeChild(tempContainer);

      // Restore UI elements
      if (controls) controls.style.display = '';
      if (minimap) minimap.style.display = '';
      if (tooltip) tooltip.style.display = '';

      // Determine PDF orientation and size based on content
      const isWide = contentWidth > contentHeight;
      const pdf = new jsPDF({
        orientation: isWide ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Header styling
      const headerHeight = 25;
      const footerHeight = 12;
      const contentAreaHeight = pageHeight - headerHeight - footerHeight - 10;

      // Draw subtle header background
      pdf.setFillColor(250, 250, 250);
      pdf.rect(0, 0, pageWidth, headerHeight, 'F');

      // Brand name
      pdf.setFontSize(14);
      pdf.setTextColor(232, 141, 125); // Coral color
      pdf.setFont('helvetica', 'bold');
      pdf.text('NurseQuizAI', 10, 10);

      // Tagline
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.setFont('helvetica', 'normal');
      pdf.text('nursequizai.com', 10, 16);

      // Title on right
      pdf.setFontSize(12);
      pdf.setTextColor(60, 60, 60);
      pdf.setFont('helvetica', 'bold');
      const title = mindmapData.central_topic || 'Mind Map';
      pdf.text(title, pageWidth - 10, 12, { align: 'right' });

      // Subtle header line
      pdf.setDrawColor(232, 141, 125);
      pdf.setLineWidth(0.5);
      pdf.line(10, headerHeight - 2, pageWidth - 10, headerHeight - 2);

      // Calculate image dimensions to fit in content area
      const imgAspect = canvas.width / canvas.height;
      const availableWidth = pageWidth - 20;
      const availableHeight = contentAreaHeight;

      let imgWidth, imgHeight;
      if (imgAspect > availableWidth / availableHeight) {
        // Width constrained
        imgWidth = availableWidth;
        imgHeight = imgWidth / imgAspect;
      } else {
        // Height constrained
        imgHeight = availableHeight;
        imgWidth = imgHeight * imgAspect;
      }

      // Center the image
      const imgX = (pageWidth - imgWidth) / 2;
      const imgY = headerHeight + (contentAreaHeight - imgHeight) / 2;

      // Add the mindmap image
      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);

      // Footer
      const footerY = pageHeight - 6;
      pdf.setFontSize(7);
      pdf.setTextColor(180, 180, 180);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Generated with NurseQuizAI', 10, footerY);

      const date = new Date().toLocaleDateString();
      pdf.text(date, pageWidth - 10, footerY, { align: 'right' });

      // Save PDF
      const filename = `${(mindmapData.central_topic || 'mindmap').replace(/[^a-z0-9]/gi, '_')}_mindmap.pdf`;
      pdf.save(filename);

    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [mindmapData, isDownloading, rfInstance]);

  // Create fresh nodes and edges from mindmapData (reactive to isExpanded and layoutMode)
  const { nodes: freshNodes, edges: freshEdges } = useMemo(() => {
    return transformToReactFlow(mindmapData, isExpanded, layoutMode);
  }, [mindmapData, isExpanded, layoutMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(freshNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(freshEdges);

  // Toggle expanded view
  const handleToggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Toggle layout mode
  const handleToggleLayout = useCallback(() => {
    setLayoutMode(prev => prev === 'horizontal' ? 'radial' : 'horizontal');
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

  // Sync state when freshNodes/freshEdges change (crucial for updates)
  useEffect(() => {
    setNodes(freshNodes);
    setEdges(freshEdges);
    // Re-fit view when expanded mode changes
    if (rfInstance) {
      setTimeout(() => {
        rfInstance.fitView({ padding: 0.1, maxZoom: 0.5, duration: 500 });
      }, 100);
    }
  }, [freshNodes, freshEdges, setNodes, setEdges, rfInstance]);

  // Delay fitView to allow container to get dimensions AND animation to finish
  // The CSS animation is 0.3s, so we wait slightly longer to ensure layout is stable
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rfInstance && nodes.length > 0) {
        console.log("🔄 Triggering delayed fitView after animation...");
        rfInstance.fitView({ padding: 0.1, maxZoom: 0.5, duration: 800 });
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
            rfInstance.fitView({ padding: 0.1, maxZoom: 0.5, duration: 400 });
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
          rfInstance.fitView({ padding: 0.1, maxZoom: 0.5, duration: 800 });
          retryFitView(retries - 1, delay + 200);
        }
      }, delay);
    };

    if (rfInstance && nodes.length > 0) {
      retryFitView(5, 100);
    }
  }, [rfInstance, nodes.length]);

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
              title={t('mindmap.downloadPdf')}
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
              {t('mindmap.downloadPdf')}
            </button>

            <button
              className={`mindmap-modal-action-btn ${isExpanded ? 'active' : ''}`}
              onClick={handleToggleExpanded}
              title={isExpanded ? t('mindmap.compact') : t('mindmap.details')}
            >
              {isExpanded ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20"></polyline>
                  <polyline points="20 10 14 10 14 4"></polyline>
                  <line x1="14" y1="10" x2="21" y2="3"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              )}
              {isExpanded ? t('mindmap.compact') : t('mindmap.details')}
            </button>

            <button
              className={`mindmap-modal-action-btn ${layoutMode === 'radial' ? 'active' : ''}`}
              onClick={handleToggleLayout}
              title={layoutMode === 'horizontal' ? t('mindmap.switchToRadial') : t('mindmap.switchToTree')}
            >
              {layoutMode === 'horizontal' ? (
                /* Radial icon: simple center with 4 radiating lines */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <line x1="12" y1="2" x2="12" y2="9"></line>
                  <line x1="12" y1="15" x2="12" y2="22"></line>
                  <line x1="2" y1="12" x2="9" y2="12"></line>
                  <line x1="15" y1="12" x2="22" y2="12"></line>
                  <circle cx="12" cy="2" r="2"></circle>
                  <circle cx="12" cy="22" r="2"></circle>
                  <circle cx="2" cy="12" r="2"></circle>
                  <circle cx="22" cy="12" r="2"></circle>
                </svg>
              ) : (
                /* Tree icon: simple horizontal hierarchy */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="4" cy="12" r="3"></circle>
                  <line x1="7" y1="12" x2="12" y2="12"></line>
                  <line x1="12" y1="12" x2="12" y2="5"></line>
                  <line x1="12" y1="12" x2="12" y2="19"></line>
                  <line x1="12" y1="5" x2="17" y2="5"></line>
                  <line x1="12" y1="12" x2="17" y2="12"></line>
                  <line x1="12" y1="19" x2="17" y2="19"></line>
                  <circle cx="20" cy="5" r="3"></circle>
                  <circle cx="20" cy="12" r="3"></circle>
                  <circle cx="20" cy="19" r="3"></circle>
                </svg>
              )}
              {layoutMode === 'horizontal' ? t('mindmap.radial') : t('mindmap.tree')}
            </button>

            <button className="mindmap-modal-close" onClick={onClose} title={t('mindmap.close')}>
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
              fitViewOptions={{ padding: 0.1, maxZoom: 0.5 }}
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
                  // Use the branch color if available, otherwise default by type
                  if (node.data?.branchColor) {
                    return node.data.branchColor;
                  }
                  switch (node.data?.nodeType) {
                    case 'central': return '#FFD54F';
                    case 'main': return '#FFB3BA';
                    case 'sub': return '#BAFFC9';
                    case 'detail': return '#BAE1FF';
                    default: return '#e0e0e0';
                  }
                }}
                maskColor="rgba(0, 0, 0, 0.7)"
                pannable
                zoomable
              />
              <Background
                color="rgba(0, 0, 0, 0.03)"
                gap={30}
                size={1}
              />
            </ReactFlow>
          )}

          {/* Tooltip with details - only show in compact mode */}
          {!isExpanded && selectedNode && (selectedNode.data?.summary || selectedNode.data?.details?.length > 0) && (
            <div className="mindmap-tooltip mindmap-tooltip-modal" data-node-type={selectedNode.data?.nodeType}>
              <button className="tooltip-close" onClick={() => setSelectedNode(null)} title="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <div className="tooltip-header">{selectedNode.data.label}</div>
              {selectedNode.data.summary && (
                <div className="tooltip-content">{selectedNode.data.summary}</div>
              )}
              {selectedNode.data.details && selectedNode.data.details.length > 0 && (
                <ul className="tooltip-details">
                  {selectedNode.data.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mindmap-modal-footer">
          {`${layoutMode === 'horizontal' ? t('mindmap.footerTree') : t('mindmap.footerRadial')} ${isExpanded ? t('mindmap.detailsShown') : t('mindmap.clickForDetails')} ${t('mindmap.dragToRearrange')}`}
        </div>
      </div>
    </div>
  );
};

/**
 * Inline viewer component
 */
const InlineViewer = ({ mindmapData, onNodeClick, onExpand, hideToolbar = false }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const containerRef = useRef(null);

  // Transform data first - use horizontal layout for inline view
  const { nodes: transformedNodes, edges: transformedEdges } = useMemo(
    () => transformToReactFlow(mindmapData, false, 'horizontal'),
    [mindmapData]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(transformedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(transformedEdges);

  // Update nodes when mindmapData changes - this is crucial for streaming updates
  useEffect(() => {
    console.log('InlineViewer: mindmapData changed, updating nodes:', transformedNodes.length);
    setNodes(transformedNodes);
    setEdges(transformedEdges);
  }, [transformedNodes, transformedEdges, setNodes, setEdges]);

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
      // Hide controls and tooltip temporarily
      const controls = containerRef.current.querySelector('.react-flow__controls');
      const tooltip = containerRef.current.querySelector('.mindmap-tooltip');
      if (controls) controls.style.display = 'none';
      if (tooltip) tooltip.style.display = 'none';

      // Capture the actual visible ReactFlow container
      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#fdf8f3',
        logging: false,
      });

      // Restore controls and tooltip
      if (controls) controls.style.display = '';
      if (tooltip) tooltip.style.display = '';

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
        {!hideToolbar && (
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
        )}
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
          fitViewOptions={{ padding: 0.1, maxZoom: 0.5 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <Controls className="mindmap-controls" />
          <Background
            color="rgba(0, 0, 0, 0.03)"
            gap={30}
            size={1}
          />
        </ReactFlow>

        {/* Tooltip for inline with details */}
        {selectedNode && (selectedNode.data?.summary || selectedNode.data?.details?.length > 0) && (
          <div className="mindmap-tooltip" data-node-type={selectedNode.data?.nodeType}>
            <button className="tooltip-close" onClick={() => setSelectedNode(null)} title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="tooltip-header">{selectedNode.data.label}</div>
            {selectedNode.data.summary && (
              <div className="tooltip-content">{selectedNode.data.summary}</div>
            )}
            {selectedNode.data.details && selectedNode.data.details.length > 0 && (
              <ul className="tooltip-details">
                {selectedNode.data.details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * MindmapViewer - Main component that orchestrates inline and modal views
 */
const MindmapViewer = ({ mindmapData, onNodeClick, hideToolbar = false }) => {
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
          hideToolbar={hideToolbar}
        />
      </ReactFlowProvider>
    </>
  );
};

export default MindmapViewer;
