import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

const SKELETON_DELAY_MS = 80;
const POPOVER_GAP = 10;
const POPOVER_WIDTH = 340;
const POPOVER_VIEWPORT_PAD = 12;

function isMobileViewport() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(max-width: 768px)').matches;
}

function Skeleton() {
  return (
    <div className="glossary-skeleton" aria-hidden="true">
      <div className="glossary-skel-row label" />
      <div className="glossary-skel-row line-a" />
      <div className="glossary-skel-row line-b" />
      <div className="glossary-skel-row label" />
      <div className="glossary-skel-row line-a" />
      <div className="glossary-skel-row line-c" />
    </div>
  );
}

function Body({ data, error, loading, showSkeleton }) {
  if (error) {
    return (
      <div className="glossary-popover-body">
        <p className="glossary-error">Couldn’t load that one. Tap another term or try again.</p>
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

  if (data.not_a_term || (!data.definition && !data.nclex_relevance && !data.nursing_consideration)) {
    return (
      <div className="glossary-popover-body">
        <p className="glossary-error">No clinical definition available for this term.</p>
      </div>
    );
  }

  return (
    <div className="glossary-popover-body">
      {data.definition ? (
        <div className="glossary-section">
          <span className="glossary-section-label">Definition</span>
          <p>{data.definition}</p>
        </div>
      ) : null}
      {data.nclex_relevance ? (
        <div className="glossary-section">
          <span className="glossary-section-label">Why it matters on NCLEX</span>
          <p>{data.nclex_relevance}</p>
        </div>
      ) : null}
      {data.nursing_consideration ? (
        <div className="glossary-section">
          <span className="glossary-section-label">Nursing consideration</span>
          <p>{data.nursing_consideration}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Anchored popover (desktop / iPad-landscape).
 * Computes position from the anchor's getBoundingClientRect().
 */
function AnchoredPopover({ anchorRect, term, data, error, loading, onClose }) {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const popoverRef = useRef(null);
  const [layout, setLayout] = useState(null);

  // Delay skeleton render so cache hits feel instant
  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return undefined;
    }
    const id = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => clearTimeout(id);
  }, [loading]);

  // Compute position once we have a rect; re-measure when popover height changes.
  // useLayoutEffect runs synchronously after DOM mutations but before paint, so
  // the popover never gets a frame at the offscreen fallback position.
  useLayoutEffect(() => {
    if (!anchorRect) return undefined;

    function compute() {
      const node = popoverRef.current;
      if (!node) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const popH = node.offsetHeight || 200;
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

      const originX = `${arrowX}px`;
      const originY = placement === 'bottom' ? '0%' : '100%';

      setLayout({ top, left, width: popW, placement, arrowX, originX, originY });
    }

    compute();
    // Re-measure once content lays out (skeleton → real text changes height).
    const id = requestAnimationFrame(compute);
    return () => cancelAnimationFrame(id);
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
      aria-label={`Definition of ${term}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="glossary-popover-header">
        <div className="glossary-popover-term">{(data && data.term) || term}</div>
        <button
          type="button"
          className="glossary-popover-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <Body data={data} error={error} loading={loading} showSkeleton={showSkeleton} />
    </div>
  );
}

function BottomSheet({ term, data, error, loading, onClose }) {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return undefined;
    }
    const id = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => clearTimeout(id);
  }, [loading]);

  return (
    <div
      className="glossary-sheet"
      role="dialog"
      aria-label={`Definition of ${term}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="glossary-sheet-handle" />
      <div className="glossary-popover-header">
        <div className="glossary-popover-term">{(data && data.term) || term}</div>
        <button
          type="button"
          className="glossary-popover-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <Body data={data} error={error} loading={loading} showSkeleton={showSkeleton} />
    </div>
  );
}

export default function GlossaryPopover({ open, term, anchorRect, data, error, loading, onClose }) {
  // Re-evaluate sheet vs anchored on each open. We don't reflow on resize during
  // a single popover lifetime — that's an edge case at this scale.
  const [isSheet, setIsSheet] = useState(false);
  useEffect(() => {
    if (open) setIsSheet(isMobileViewport());
  }, [open]);

  // Esc + scroll dismiss
  useEffect(() => {
    if (!open) return undefined;

    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    function onScroll() {
      onClose();
    }

    window.addEventListener('keydown', onKey);
    // Capture phase: catches scroll inside the rationale container too.
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const root = (
    <div
      className={`glossary-popover-root${isSheet ? ' is-sheet' : ''}`}
      onMouseDown={(e) => {
        // Tap-outside dismiss. Children stop propagation in their own handlers.
        if (e.target === e.currentTarget || e.target.classList.contains('glossary-popover-backdrop')) {
          onClose();
        }
      }}
    >
      <div className="glossary-popover-backdrop" />
      {isSheet
        ? <BottomSheet term={term} data={data} error={error} loading={loading} onClose={onClose} />
        : <AnchoredPopover anchorRect={anchorRect} term={term} data={data} error={error} loading={loading} onClose={onClose} />}
    </div>
  );

  return createPortal(root, document.body);
}
