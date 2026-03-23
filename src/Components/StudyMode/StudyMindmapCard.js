import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MindmapViewer from '../Mindmap/MindmapViewer';

/** BFS traversal order: root → children level by level */
function buildBfsOrder(mindmapData) {
  if (!mindmapData?.nodes?.length) return [];
  const { nodes, edges } = mindmapData;
  const childrenMap = {};
  nodes.forEach(n => { childrenMap[n.id] = []; });
  edges.forEach(e => { if (childrenMap[e.source] !== undefined) childrenMap[e.source].push(e.target); });
  const hasIncoming = new Set(edges.map(e => e.target));
  const root = nodes.find(n => n.type === 'central') || nodes.find(n => !hasIncoming.has(n.id)) || nodes[0];
  const order = [];
  const seen = new Set();
  const queue = [root.id];
  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    (childrenMap[id] || []).forEach(c => queue.push(c));
  }
  return order;
}

const PAN_DURATION  = 620; // ms — pan animation length
const TOOLTIP_DELAY = PAN_DURATION + 40; // tooltip appears only after pan settles

const StudyMindmapCard = ({
  content,
  isGenerating = false,
  generatingMessage = '',
  savedProgress = null,
  onGenerateMindmap,
  onSaveProgress,
  onContinue,
  onExit
}) => {
  const { t } = useTranslation();

  // generation gate
  const [mapReady, setMapReady]         = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const isGeneratingRef                 = useRef(false);

  // traversal state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visitedIds, setVisitedIds]     = useState(new Set());

  // Refs that always hold the latest values — fixes stale closure on rapid clicks
  const currentIndexRef = useRef(0);
  const visitedIdsRef   = useRef(new Set());
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { visitedIdsRef.current   = visitedIds;   }, [visitedIds]);

  // displayNodeId is a delayed copy of currentNodeId.
  // It only flips AFTER the pan animation is done so the tooltip never
  // mounts at the wrong position.
  const [displayNodeId, setDisplayNodeId] = useState(null);

  // ReactFlow instance
  const rfInstanceRef  = useRef(null);
  // Cancel any in-flight pan timeout when a new nav fires
  const panTimeoutRef  = useRef(null);
  // Cancel any in-flight tooltip delay on rapid nav
  const tooltipTimerRef = useRef(null);

  const { topic, depth, mindmapData } = content || {};
  const bfsOrder = useMemo(() => buildBfsOrder(mindmapData), [mindmapData]);

  // ── generation ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mindmapData?.nodes?.length > 0) { setMapReady(true); return; }
    if (!mapReady && !isGenerating && !hasAttempted && !isGeneratingRef.current && onGenerateMindmap && topic) {
      setHasAttempted(true);
      isGeneratingRef.current = true;
      onGenerateMindmap({ topic, depth: depth || 'medium' });
    }
  }, [mindmapData, mapReady, isGenerating, hasAttempted, onGenerateMindmap, topic, depth]);

  useEffect(() => {
    if (mapReady) isGeneratingRef.current = false;
    return () => { isGeneratingRef.current = false; };
  }, [mapReady]);

  // ── restore saved progress ──────────────────────────────────────────────────
  useEffect(() => {
    if (!savedProgress || bfsOrder.length === 0) return;
    setCurrentIndex(savedProgress.currentNodeIndex ?? 0);
    setVisitedIds(new Set(savedProgress.visitedNodeIds ?? []));
  }, [savedProgress, bfsOrder.length]);

  // ── smooth pan — preserves zoom, cancels previous pan on rapid clicks ───────
  const panToNode = useCallback((nodeId) => {
    const rf = rfInstanceRef.current;
    if (!rf || !nodeId) return;
    // Cancel any previous pending pan
    if (panTimeoutRef.current) clearTimeout(panTimeoutRef.current);
    panTimeoutRef.current = setTimeout(() => {
      const rfNodes = rf.getNodes();
      const target  = rfNodes.find(n => n.id === nodeId);
      if (!target) return;
      const cx = target.position.x + (target.measured?.width  ?? target.width  ?? 150) / 2;
      const cy = target.position.y + (target.measured?.height ?? target.height ?? 50)  / 2;
      // Preserve current zoom but enforce a readable minimum
      const currentZoom = rf.getViewport().zoom;
      const targetZoom  = Math.max(currentZoom, 0.55);
      rf.setCenter(cx, cy, { zoom: targetZoom, duration: PAN_DURATION });
    }, 30);
  }, []);

  const currentNodeId = bfsOrder[currentIndex] ?? null;
  const isComplete    = currentIndex >= bfsOrder.length;
  const progressPct   = bfsOrder.length > 0 ? Math.round((currentIndex / bfsOrder.length) * 100) : 0;

  // Pan + delayed tooltip whenever the active node changes
  useEffect(() => {
    if (!mapReady || !currentNodeId) return;

    // Hide tooltip immediately
    setDisplayNodeId(null);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    panToNode(currentNodeId);

    // Show tooltip only after pan settles
    tooltipTimerRef.current = setTimeout(() => setDisplayNodeId(currentNodeId), TOOLTIP_DELAY);
    return () => { if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current); };
  }, [currentNodeId, mapReady, panToNode]);

  // ── navigation — uses refs so rapid clicks never see a stale index ──────────
  const navigate = useCallback((dir) => {
    const prev     = currentIndexRef.current;
    const newIndex = prev + (dir === 'forward' ? 1 : -1);
    if (newIndex < 0 || newIndex > bfsOrder.length) return;

    // Update refs immediately so back-to-back calls are correct
    currentIndexRef.current = newIndex;

    const prevNodeId  = bfsOrder[prev];
    const newVisited  = new Set(visitedIdsRef.current);
    if (dir === 'forward' && prevNodeId) newVisited.add(prevNodeId);
    visitedIdsRef.current = newVisited;

    setCurrentIndex(newIndex);
    setVisitedIds(newVisited);

    if (onSaveProgress) onSaveProgress({ currentNodeIndex: newIndex, visitedNodeIds: [...newVisited], totalNodes: bfsOrder.length });
  }, [bfsOrder, onSaveProgress]);

  const handleNext = useCallback(() => navigate('forward'), [navigate]);
  const handleBack = useCallback(() => navigate('back'),    [navigate]);

  // ── icons ───────────────────────────────────────────────────────────────────
  const MapIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
      <line x1="12" y1="7" x2="5" y2="17" /><line x1="12" y1="7" x2="19" y2="17" />
    </svg>
  );

  // ── loading ─────────────────────────────────────────────────────────────────
  if (isGenerating || (!mapReady && !mindmapData)) {
    return (
      <div className="study-step-card study-mindmap-card">
        <div className="study-card-header">
          <div className="study-card-icon audio"><MapIcon /></div>
          <h2 className="study-card-title">{t('study.conceptMap', 'Concept Map')}</h2>
          {onExit && <button className="study-card-close-btn" onClick={onExit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>}
        </div>
        <div className="study-mindmap-body">
          <div className="study-audio-generating">
            <div className="study-audio-loading-bars">
              {[...Array(5)].map((_, i) => <div key={i} className="study-audio-loading-bar" />)}
            </div>
            <p className="study-audio-status">{generatingMessage || t('study.buildingConceptMap', 'Building your concept map...')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (hasAttempted && !isGenerating && !mapReady) {
    return (
      <div className="study-step-card study-mindmap-card">
        <div className="study-card-header">
          <div className="study-card-icon audio"><MapIcon /></div>
          <h2 className="study-card-title">{t('study.conceptMap', 'Concept Map')}</h2>
          {onExit && <button className="study-card-close-btn" onClick={onExit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>}
        </div>
        <div className="study-mindmap-body">
          <div className="study-audio-generating">
            <p className="study-audio-status" style={{ color: '#ff6b6b', marginBottom: '12px' }}>
              {t('study.failedToGenerate', 'Failed to generate concept map')}
            </p>
            <button className="study-retry-btn" onClick={() => setHasAttempted(false)}
              style={{ padding: '8px 16px', background: 'var(--primary-color, #4CAF50)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
              {t('study.retry', 'Retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── complete ─────────────────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="study-step-card study-mindmap-card">
        <div className="study-card-header">
          <div className="study-card-icon audio"><MapIcon /></div>
          <h2 className="study-card-title">{t('study.conceptMap', 'Concept Map')}</h2>
          {onExit && <button className="study-card-close-btn" onClick={onExit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>}
        </div>
        <div className="study-mindmap-map-wrap">
          <MindmapViewer
            key={`study-map-${mindmapData.nodes?.length}`}
            mindmapData={mindmapData}
            onNodeClick={() => {}}
            hideToolbar
            activeNodeId={null}
            visitedNodeIds={visitedIds}
            onInit={(inst) => { rfInstanceRef.current = inst; }}
          />
        </div>
        <div className="study-mindmap-complete-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {t('study.allConceptsReviewed', 'All concepts reviewed!')}
        </div>
        <div className="study-card-footer">
          <button className="study-mindmap-back-btn" onClick={handleBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            {t('study.back', 'Back')}
          </button>
          <button className="study-continue-btn" onClick={onContinue}>
            {t('study.continueBtn', 'Continue')}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── main view ───────────────────────────────────────────────────────────────
  return (
    <div className="study-step-card study-mindmap-card">
      {/* Header */}
      <div className="study-card-header">
        <div className="study-card-icon audio"><MapIcon /></div>
        <h2 className="study-card-title">{t('study.conceptMap', 'Concept Map')}</h2>
        {onExit && (
          <button className="study-card-close-btn" onClick={onExit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="study-mindmap-progress-bar-wrap">
        <div className="study-mindmap-progress-bar-track">
          <div className="study-mindmap-progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="study-mindmap-progress-label">
          {t('study.nodeProgress', '{{current}} / {{total}}', { current: currentIndex + 1, total: bfsOrder.length })}
        </span>
      </div>

      {/* Visual mindmap */}
      <div className="study-mindmap-map-wrap">
        <MindmapViewer
          key={`study-map-${mindmapData.nodes?.length}-${mindmapData.central_topic}`}
          mindmapData={mindmapData}
          onNodeClick={() => {}}
          hideToolbar
          activeNodeId={currentNodeId}
          visitedNodeIds={visitedIds}
          onInit={(inst) => { rfInstanceRef.current = inst; }}
          autoSelectNodeId={displayNodeId}
        />
      </div>

      {/* Navigation */}
      <div className="study-mindmap-nav">
        <button
          className="study-mindmap-back-btn"
          onClick={handleBack}
          disabled={currentIndex === 0}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          {t('study.back', 'Back')}
        </button>

        <button className="study-mindmap-next-btn" onClick={handleNext}>
          {currentIndex + 1 < bfsOrder.length
            ? t('study.nextConcept', 'Next Concept →')
            : t('study.finishReview', 'Finish Review →')}
        </button>
      </div>
    </div>
  );
};

export default StudyMindmapCard;
