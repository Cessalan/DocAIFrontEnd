import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

const BAR_GAP = 10;
const VIEWPORT_PAD = 12;

export default function SelectionActionBar({ anchorRect, text, onCopied, onExplain, onDismiss }) {
  const { t } = useTranslation();
  const barRef = useRef(null);
  const [layout, setLayout] = useState(null);
  const [copied, setCopied] = useState(false);

  useLayoutEffect(() => {
    if (!anchorRect) return undefined;

    function compute() {
      const node = barRef.current;
      if (!node) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const barH = node.offsetHeight || 36;
      const barW = node.offsetWidth || 160;

      const spaceAbove = anchorRect.top;
      const placeAbove = spaceAbove >= barH + BAR_GAP + VIEWPORT_PAD;

      const top = placeAbove
        ? anchorRect.top - barH - BAR_GAP
        : Math.min(vh - barH - VIEWPORT_PAD, anchorRect.bottom + BAR_GAP);

      const anchorCenterX = anchorRect.left + anchorRect.width / 2;
      let left = anchorCenterX - barW / 2;
      left = Math.max(VIEWPORT_PAD, Math.min(left, vw - barW - VIEWPORT_PAD));

      const originX = `${Math.max(16, Math.min(anchorCenterX - left, barW - 16))}px`;
      const originY = placeAbove ? '100%' : '0%';

      setLayout({ top, left, originX, originY });
    }

    compute();
  }, [anchorRect]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied && onCopied();
      setTimeout(() => onDismiss && onDismiss(), 600);
    } catch (err) {
      console.error('Selection copy failed', err);
    }
  };

  // Pointerdown inside the bar should never bubble back into the document
  // listener that dismisses the selection.
  const stopPointer = (e) => e.stopPropagation();

  if (!anchorRect) return null;

  const style = layout
    ? {
        top: `${layout.top}px`,
        left: `${layout.left}px`,
        '--nq-bar-origin-x': layout.originX,
        '--nq-bar-origin-y': layout.originY,
        visibility: 'visible',
      }
    : { top: '-9999px', left: '-9999px', visibility: 'hidden' };

  return createPortal(
    <div className="nq-selection-bar-root">
      <div
        ref={barRef}
        className="nq-selection-bar"
        style={style}
        role="toolbar"
        aria-label={t('selection.toolbar', 'Selection actions')}
        onPointerDown={stopPointer}
        onMouseDown={stopPointer}
        onTouchStart={stopPointer}
      >
        <button
          type="button"
          className={`nq-selection-bar-btn${copied ? ' is-success' : ''}`}
          onClick={handleCopy}
        >
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          <span>{copied ? t('selection.copied', 'Copied') : t('selection.copy', 'Copy')}</span>
        </button>
        {onExplain && (
          <button
            type="button"
            className="nq-selection-bar-btn"
            onClick={() => onExplain(text)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.8.7-1.5 1-1.5 2.5" />
              <line x1="12" y1="17" x2="12" y2="17.01" />
            </svg>
            <span>{t('selection.explain', 'Explain')}</span>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
