import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import MindmapViewer from '../Mindmap/MindmapViewer';
import './ChatMindmap.css';

/**
 * ChatMindmap - Wrapper component for displaying mindmap in chat messages
 *
 * Similar to ChatQuiz, ChatFlashcard components
 * Handles loading state and renders MindmapViewer when data is ready
 */
const ChatMindmap = ({ mindmapData, isLoading, topic }) => {
  const { t } = useTranslation();
  const renderCount = useRef(0);
  renderCount.current += 1;

  // Debug log to track state changes
  console.log(`ChatMindmap render #${renderCount.current}:`, {
    isLoading,
    hasMindmapData: !!mindmapData,
    nodesCount: mindmapData?.nodes?.length,
    centralTopic: mindmapData?.central_topic
  });

  // Log when props change
  useEffect(() => {
    console.log('📊 ChatMindmap: mindmapData prop changed', {
      hasData: !!mindmapData,
      nodesCount: mindmapData?.nodes?.length
    });
  }, [mindmapData]);

  useEffect(() => {
    console.log('📊 ChatMindmap: isLoading prop changed to', isLoading);
  }, [isLoading]);

  // Loading state - Premium shimmer skeleton (horizontal left-to-right layout)
  if (isLoading || !mindmapData) {
    return (
      <div className="chat-mindmap chat-mindmap-loading">
        <div className="mindmap-skeleton">
          {/* SVG-based mindmap skeleton with realistic curved connections */}
          <svg className="skeleton-svg" viewBox="0 0 500 280" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Connection paths - drawn first so nodes appear on top */}
            {/* Root to Level 1 connections */}
            <path className="skeleton-path path-root-l1-1" d="M140 140 C170 140, 180 60, 210 60" />
            <path className="skeleton-path path-root-l1-2" d="M140 140 C170 140, 180 140, 210 140" />
            <path className="skeleton-path path-root-l1-3" d="M140 140 C170 140, 180 220, 210 220" />

            {/* Level 1 to Level 2 connections */}
            <path className="skeleton-path path-l1-l2-1" d="M310 60 C340 60, 350 35, 380 35" />
            <path className="skeleton-path path-l1-l2-2" d="M310 60 C340 60, 350 85, 380 85" />
            <path className="skeleton-path path-l1-l2-3" d="M310 140 C340 140, 350 140, 380 140" />
            <path className="skeleton-path path-l1-l2-4" d="M310 220 C340 220, 350 195, 380 195" />
            <path className="skeleton-path path-l1-l2-5" d="M310 220 C340 220, 350 245, 380 245" />

            {/* Root node */}
            <g className="skeleton-node-group node-root">
              <rect x="40" y="122" width="100" height="36" rx="18" className="skeleton-node-rect node-root-rect" />
              <rect x="40" y="122" width="100" height="36" rx="18" className="skeleton-node-shimmer" />
            </g>

            {/* Level 1 nodes */}
            <g className="skeleton-node-group node-l1-1">
              <rect x="210" y="42" width="100" height="32" rx="16" className="skeleton-node-rect node-l1-rect" />
              <rect x="210" y="42" width="100" height="32" rx="16" className="skeleton-node-shimmer" />
            </g>
            <g className="skeleton-node-group node-l1-2">
              <rect x="210" y="124" width="100" height="32" rx="16" className="skeleton-node-rect node-l1-rect" />
              <rect x="210" y="124" width="100" height="32" rx="16" className="skeleton-node-shimmer" />
            </g>
            <g className="skeleton-node-group node-l1-3">
              <rect x="210" y="204" width="100" height="32" rx="16" className="skeleton-node-rect node-l1-rect" />
              <rect x="210" y="204" width="100" height="32" rx="16" className="skeleton-node-shimmer" />
            </g>

            {/* Level 2 nodes */}
            <g className="skeleton-node-group node-l2-1">
              <rect x="380" y="20" width="80" height="28" rx="14" className="skeleton-node-rect node-l2-rect" />
              <rect x="380" y="20" width="80" height="28" rx="14" className="skeleton-node-shimmer" />
            </g>
            <g className="skeleton-node-group node-l2-2">
              <rect x="380" y="70" width="80" height="28" rx="14" className="skeleton-node-rect node-l2-rect" />
              <rect x="380" y="70" width="80" height="28" rx="14" className="skeleton-node-shimmer" />
            </g>
            <g className="skeleton-node-group node-l2-3">
              <rect x="380" y="126" width="80" height="28" rx="14" className="skeleton-node-rect node-l2-rect" />
              <rect x="380" y="126" width="80" height="28" rx="14" className="skeleton-node-shimmer" />
            </g>
            <g className="skeleton-node-group node-l2-4">
              <rect x="380" y="181" width="80" height="28" rx="14" className="skeleton-node-rect node-l2-rect" />
              <rect x="380" y="181" width="80" height="28" rx="14" className="skeleton-node-shimmer" />
            </g>
            <g className="skeleton-node-group node-l2-5">
              <rect x="380" y="231" width="80" height="28" rx="14" className="skeleton-node-rect node-l2-rect" />
              <rect x="380" y="231" width="80" height="28" rx="14" className="skeleton-node-shimmer" />
            </g>
          </svg>

          {/* Loading text with shimmer */}
          <div className="mindmap-loading-status">
            <div className="mindmap-text-shimmer">
              <span className="mindmap-loading-text">{topic || t('mindmap.extractingConcepts')}</span>
              <div className="mindmap-shimmer-overlay"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state - no nodes
  if (!mindmapData.nodes || mindmapData.nodes.length === 0) {
    return (
      <div className="chat-mindmap chat-mindmap-error">
        <div className="mindmap-error-icon">!</div>
        <div className="mindmap-error-text">
          {t('mindmap.errorGenerating')}
        </div>
      </div>
    );
  }

  // Render mindmap - use key to force re-render when data changes
  return (
    <div className="chat-mindmap">
      <MindmapViewer
        key={`mindmap-${mindmapData?.nodes?.length || 0}-${mindmapData?.central_topic || 'loading'}`}
        mindmapData={mindmapData}
        onNodeClick={(node) => {
          console.log('Node clicked:', node);
        }}
      />
    </div>
  );
};

export default ChatMindmap;
