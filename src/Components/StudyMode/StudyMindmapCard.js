import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import MindmapViewer from '../Mindmap/MindmapViewer';

/**
 * StudyMindmapCard - Visual concept map in study mode
 * Reuses existing MindmapViewer component with toolbar hidden
 *
 * @param {Object} content - { topic, depth, mindmapData } — mindmapData populated after generation
 * @param {boolean} isGenerating - Whether mindmap is being generated
 * @param {string} generatingMessage - Status message during generation
 * @param {Function} onGenerateMindmap - Callback to trigger generation
 * @param {Function} onContinue - Callback when user is ready to continue
 * @param {Function} onExit - Callback to exit the card
 */
const StudyMindmapCard = ({
  content,
  isGenerating = false,
  generatingMessage = '',
  onGenerateMindmap,
  onContinue,
  onExit
}) => {
  const { t } = useTranslation();
  const [mapReady, setMapReady] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const isGeneratingRef = useRef(false);

  const { topic, depth, mindmapData } = content || {};

  // Check if mindmap data is already available
  useEffect(() => {
    if (mindmapData?.nodes?.length > 0) {
      setMapReady(true);
    }
  }, [mindmapData]);

  // Auto-trigger generation once on mount if not ready
  useEffect(() => {
    if (!mapReady && !isGenerating && !hasAttempted && !isGeneratingRef.current && onGenerateMindmap && topic) {
      setHasAttempted(true);
      isGeneratingRef.current = true;
      onGenerateMindmap({ topic, depth: depth || 'medium' });
    }
  }, [mapReady, isGenerating, hasAttempted, onGenerateMindmap, topic, depth]);

  // Reset ref when ready or unmount
  useEffect(() => {
    if (mapReady) isGeneratingRef.current = false;
    return () => { isGeneratingRef.current = false; };
  }, [mapReady]);

  const MapIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <line x1="12" y1="7" x2="5" y2="17" />
      <line x1="12" y1="7" x2="19" y2="17" />
      <line x1="5" y1="19" x2="19" y2="19" />
    </svg>
  );

  const ArrowRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );

  const renderBody = () => {
    if (isGenerating) {
      return (
        <div className="study-audio-generating">
          <div className="study-audio-loading-bars">
            <div className="study-audio-loading-bar" />
            <div className="study-audio-loading-bar" />
            <div className="study-audio-loading-bar" />
            <div className="study-audio-loading-bar" />
            <div className="study-audio-loading-bar" />
          </div>
          <p className="study-audio-status">
            {generatingMessage || t('study.buildingConceptMap', 'Building your concept map...')}
          </p>
        </div>
      );
    }

    if (mapReady && mindmapData) {
      return (
        <MindmapViewer
          key={`study-mindmap-${mindmapData.nodes?.length}-${mindmapData.central_topic}`}
          mindmapData={mindmapData}
          onNodeClick={() => {}}
          hideToolbar
        />
      );
    }

    // Failed / waiting state
    return (
      <div className="study-audio-generating">
        {hasAttempted && !isGenerating ? (
          <>
            <p className="study-audio-status" style={{ color: '#ff6b6b', marginBottom: '12px' }}>
              {generatingMessage || t('study.failedToGenerate', 'Failed to generate concept map')}
            </p>
            <button
              className="study-retry-btn"
              onClick={() => setHasAttempted(false)}
              style={{
                padding: '8px 16px',
                background: 'var(--primary-color, #4CAF50)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {t('study.retry', 'Retry')}
            </button>
          </>
        ) : (
          <>
            <div className="study-audio-loading-bars">
              <div className="study-audio-loading-bar" />
              <div className="study-audio-loading-bar" />
              <div className="study-audio-loading-bar" />
              <div className="study-audio-loading-bar" />
              <div className="study-audio-loading-bar" />
            </div>
            <p className="study-audio-status">
              {t('study.buildingConceptMap', 'Building your concept map...')}
            </p>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="study-step-card study-mindmap-card">
      <div className="study-card-header">
        <div className="study-card-icon audio">
          <MapIcon />
        </div>
        <h2 className="study-card-title">{t('study.conceptMap', 'Concept Map')}</h2>
      </div>

      <div className="study-mindmap-body">
        {renderBody()}
      </div>

      {mapReady && (
        <div className="study-card-footer">
          <button className="study-continue-btn" onClick={onContinue}>
            {t('study.continueBtn', 'Continue')}
            <ArrowRightIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default StudyMindmapCard;
