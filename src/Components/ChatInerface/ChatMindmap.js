import React, { useEffect, useRef } from 'react';
import MindmapViewer from '../Mindmap/MindmapViewer';
import './ChatMindmap.css';

/**
 * ChatMindmap - Wrapper component for displaying mindmap in chat messages
 *
 * Similar to ChatQuiz, ChatFlashcard components
 * Handles loading state and renders MindmapViewer when data is ready
 */
const ChatMindmap = ({ mindmapData, isLoading, topic }) => {
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

  // Loading state
  if (isLoading || !mindmapData) {
    return (
      <div className="chat-mindmap chat-mindmap-loading">
        <div className="mindmap-loading-container">
          <div className="mindmap-loading-spinner"></div>
          <div className="mindmap-loading-text">
            {topic || 'Analyzing document structure...'}
          </div>
          <div className="mindmap-loading-subtext">
            Extracting concepts and relationships
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
          Could not generate mindmap. Please try again.
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
