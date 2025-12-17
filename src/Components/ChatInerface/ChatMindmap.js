import React from 'react';
import MindmapViewer from '../Mindmap/MindmapViewer';
import './ChatMindmap.css';

/**
 * ChatMindmap - Wrapper component for displaying mindmap in chat messages
 *
 * Similar to ChatQuiz, ChatFlashcard components
 * Handles loading state and renders MindmapViewer when data is ready
 */
const ChatMindmap = ({ mindmapData, isLoading, topic }) => {
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

  // Render mindmap
  return (
    <div className="chat-mindmap">
      <MindmapViewer
        mindmapData={mindmapData}
        onNodeClick={(node) => {
          console.log('Node clicked:', node);
        }}
      />
      <div className="mindmap-instructions">
        Click a node to see details. Drag to pan, scroll to zoom.
      </div>
    </div>
  );
};

export default ChatMindmap;
