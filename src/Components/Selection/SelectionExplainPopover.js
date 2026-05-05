import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

const SKELETON_DELAY_MS = 80;
const POPOVER_GAP = 10;
const POPOVER_WIDTH = 360;
const POPOVER_VIEWPORT_PAD = 12;

function isMobileViewport() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(max-width: 768px)').matches;
}

function truncate(text, max = 70) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function Skeleton() {
  return (
    <div className="glossary-skeleton" aria-hidden="true">
      <div className="glossary-skel-row label" />
      <div className="glossary-skel-row line-a" />
      <div className="glossary-skel-row line-b" />
      <div className="glossary-skel-row line-c" />
    </div>
  );
}

function Body({ data, error, loading, showSkeleton, t }) {
  if (error) {
    return (
      <div className="glossary-popover-body">
        <p className="glossary-error">
          {t('selection.explainError', "Couldn't load that one. Try again in a moment.")}
        </p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="glossary-popover-body">
        {showSkeleton ? <Skeleton /> : null}
      </div>
    );
  }
  if (!data) return null;

  if (data.not_explainable || !data.explanation) {
    return (
      <div className="glossary-popover-body">
        <p className="glossary-error">
          {t('selection.explainEmpty', "No clinical explanation for that selection.")}
        </p>
      </div>
    );
  }

  return (
    <div className="glossary-popover-body">
      <div className="glossary-section">
        <span className="glossary-section-label">
          {t('selection.explainTitle', 'Explanation')}
        </span>
        <p>{data.explanation}</p>
      </div>
      {Array.isArray(data.key_points) && data.key_points.length > 0 ? (
        <div className="glossary-section">
          <span className="glossary-section-label">
            {t('selection.keyPoints', 'Key points')}
          </span>
          <ul className="nq-explain-points">
            {data.key_points.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AnchoredPopover({ anchorRect, snippet, data, error, loading, onClose, t }) {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const popoverRef = useRef(null);
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    if (!loading) { setShowSkeleton(false); return undefined; }
    const id = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => clearTimeout(id);
  }, [loading]);

  useLayoutEffect(() => {
    if (!anchorRect) return;
    const node = popoverRef.current;
    if (!node) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popH = node.offsetHeight || 240;
    const popW = Math.min(POPOVER_WIDTH, vw - POPOVER_VIEWPORT_PAD * 2);

    const spaceBelow = vh - anchorRect.bottom;
    const placement = spaceBelow >= popH + POPOVER_GAP + POPOVER_VIEWPORT_PAD || spaceBelow >= vh / 2
      ? 'bottom'
      : 'top';

    const top = placement === 'bottom'
      ? anchorRect.bottom + POPOVER_GAP
      : Math.max(POPOVER_VIEWPORT_PAD, anchorRect.top - popH - POPOVER_GAP);

    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    let left = anchorCenterX - popW / 2;
    left = Math.max(POPOVER_VIEWPORT_PAD, Math.min(left, vw - popW - POPOVER_VIEWPORT_PAD));

    const arrowX = Math.max(16, Math.min(anchorCenterX - left, popW - 16));
    setLayout({
      top, left, width: popW, placement, arrowX,
      originX: `${arrowX}px`,
      originY: placement === 'bottom' ? '0%' : '100%',
    });
  }, [anchorRect, data, loading]);

  if (!anchorRect) return null;

  const style = layout
    ? {
        top: `${layout.top}px`,
        left: `${layout.left}px`,
        width: `${layout.width}px`,
        '--gp-arrow-x': `${layout.arrowX}px`,
        '--gp-origin-x': layout.originX,
        '--gp-origin-y': layout.originY,
        visibility: 'visible',
      }
    : { top: '-9999px', left: '-9999px', visibility: 'hidden' };

  return (
    <div
      ref={popoverRef}
      className="glossary-popover"
      data-placement={layout ? layout.placement : 'bottom'}
      style={style}
      role="dialog"
      aria-label={t('selection.explainAria', 'Explanation of selection')}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="glossary-popover-header">
        <div className="glossary-popover-term" title={snippet}>{truncate(snippet)}</div>
        <button
          type="button"
          className="glossary-popover-close"
          aria-label={t('common.close', 'Close')}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <Body data={data} error={error} loading={loading} showSkeleton={showSkeleton} t={t} />
    </div>
  );
}

function BottomSheet({ snippet, data, error, loading, onClose, t }) {
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {
    if (!loading) { setShowSkeleton(false); return undefined; }
    const id = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => clearTimeout(id);
  }, [loading]);

  return (
    <div
      className="glossary-sheet"
      role="dialog"
      aria-label={t('selection.explainAria', 'Explanation of selection')}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="glossary-sheet-handle" />
      <div className="glossary-popover-header">
        <div className="glossary-popover-term" title={snippet}>{truncate(snippet, 90)}</div>
        <button
          type="button"
          className="glossary-popover-close"
          aria-label={t('common.close', 'Close')}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <Body data={data} error={error} loading={loading} showSkeleton={showSkeleton} t={t} />
    </div>
  );
}

export default function SelectionExplainPopover({
  open, snippet, anchorRect, data, error, loading, onClose,
}) {
  const { t } = useTranslation();
  const [isSheet, setIsSheet] = useState(false);

  useEffect(() => {
    if (open) setIsSheet(isMobileViewport());
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    function onScroll() {
      onClose();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`glossary-popover-root${isSheet ? ' is-sheet' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget || e.target.classList.contains('glossary-popover-backdrop')) {
          onClose();
        }
      }}
    >
      <div className="glossary-popover-backdrop" />
      {isSheet
        ? <BottomSheet snippet={snippet} data={data} error={error} loading={loading} onClose={onClose} t={t} />
        : <AnchoredPopover anchorRect={anchorRect} snippet={snippet} data={data} error={error} loading={loading} onClose={onClose} t={t} />}
    </div>,
    document.body
  );
}
