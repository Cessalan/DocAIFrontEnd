import React, { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ConceptMapBlock.css';

// reactflow, html2canvas and jspdf all ride along with the viewer. This module
// is itself lazily imported by ChatMessage, but keep the split so a chat with
// no diagram in it never pays for them.
const MindmapViewer = lazy(() => import('./MindmapViewer'));

/**
 * ConceptMapBlock
 *
 * Draws an ASCII diagram the tutor wrote in a fenced code block as the real,
 * pannable concept map — the same viewer the mindmap tool uses, so it comes
 * with node details and the branded PDF export students hand in.
 *
 * The original text stays one click away: it is what the model actually said,
 * and a student copying the map by hand may still want it.
 *
 * @param {Object} data   Parsed `{ central_topic, nodes, edges }`.
 * @param {string} source The raw text from the fence, for the text view.
 */
const ConceptMapBlock = ({ data, source }) => {
  const { t } = useTranslation();
  const [showText, setShowText] = useState(false);

  return (
    <div className="concept-map-block">
      <div className="concept-map-block-bar">
        <span className="concept-map-block-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="5" r="2.5" />
            <circle cx="5" cy="19" r="2.5" />
            <circle cx="19" cy="19" r="2.5" />
            <path d="M12 7.5v4M12 11.5H5.5v5M12 11.5H18.5v5" />
          </svg>
          {t('mindmap.conceptMapBadge')}
        </span>
        <button
          type="button"
          className="concept-map-block-toggle"
          onClick={() => setShowText((value) => !value)}
          aria-expanded={showText}
        >
          {showText ? t('mindmap.viewAsDiagram') : t('mindmap.viewAsText')}
        </button>
      </div>

      {showText ? (
        <pre className="concept-map-block-source">
          <code>{source}</code>
        </pre>
      ) : (
        <Suspense fallback={<div className="concept-map-block-loading">{t('mindmap.buildingDiagram')}</div>}>
          <MindmapViewer mindmapData={data} />
        </Suspense>
      )}

      <p className="concept-map-block-hint">{t('mindmap.clickForDetails')}</p>
    </div>
  );
};

export default ConceptMapBlock;
