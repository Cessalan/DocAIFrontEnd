import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SelectionActionBar from './SelectionActionBar';
import SelectionExplainPopover from './SelectionExplainPopover';
import { fetchExplain } from '../../Services/FastAPICalls';
import './Selection.css';

const MARK_ATTR = 'data-nq-mark';

function getSelectableAncestor(node) {
  let el = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
  while (el) {
    if (el.dataset && el.dataset.selectable === 'true') return el;
    if (el.dataset && el.dataset.selectable === 'false') return null;
    el = el.parentElement;
  }
  return null;
}

// Map a selectable container's class names to the backend's "context" hint.
function deriveContext(el) {
  if (!el || !el.className) return 'chat';
  const cls = String(el.className);
  if (cls.includes('flashcard')) return 'flashcard';
  if (cls.includes('rationale')) return 'rationale';
  if (cls.includes('cqs-question') || cls.includes('study-card-content')) return 'quiz';
  return 'chat';
}

// Walk a Range and wrap each intersecting text-node slice in <mark>. Native
// surroundContents fails on cross-element ranges, so we split text nodes by
// the range's start/end offsets and wrap each piece individually.
function wrapRangeWithMarks(range) {
  const marks = [];
  if (!range || range.collapsed) return marks;

  const root = range.commonAncestorContainer;
  const rootEl = root.nodeType === Node.ELEMENT_NODE ? root : root.parentNode;
  if (!rootEl) return marks;

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.length) return NodeFilter.FILTER_REJECT;
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);
      const intersects =
        range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
        range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
      nodeRange.detach && nodeRange.detach();
      return intersects ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(n);

  textNodes.forEach((node) => {
    let start = 0;
    let end = node.nodeValue.length;
    if (node === range.startContainer) start = range.startOffset;
    if (node === range.endContainer) end = range.endOffset;
    if (start >= end) return;

    let target = node;
    if (end < target.nodeValue.length) target.splitText(end);
    if (start > 0) target = target.splitText(start);

    const mark = document.createElement('mark');
    mark.className = 'nq-selection';
    mark.setAttribute(MARK_ATTR, '1');
    target.parentNode.insertBefore(mark, target);
    mark.appendChild(target);
    marks.push(mark);
  });

  return marks;
}

function unwrapMarks(marks) {
  marks.forEach((mark) => {
    if (!mark.parentNode) return;
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

export default function SelectionProvider({ children }) {
  const { i18n } = useTranslation();
  const [active, setActive] = useState(null);
  const [explain, setExplain] = useState(null);
  const marksRef = useRef([]);
  // Mirror of `active` updated synchronously so the document-level click guard
  // can read the current state without waiting for React to re-render.
  const activeRef = useRef(false);
  // True for the single click that browsers fire immediately after a
  // selection-creating pointerup — we swallow that click so a drag-release
  // landing on a clickable element (glossary term, flashcard flip, etc.)
  // doesn't trigger its handler.
  const justCreatedRef = useRef(false);
  const explainReqIdRef = useRef(0);

  const teardown = useCallback(() => {
    if (marksRef.current.length) {
      unwrapMarks(marksRef.current);
      marksRef.current = [];
    }
  }, []);

  const dismiss = useCallback(() => {
    teardown();
    activeRef.current = false;
    setActive(null);
    setExplain(null);
    explainReqIdRef.current += 1;
  }, [teardown]);

  const closeExplain = useCallback(() => {
    setExplain(null);
    explainReqIdRef.current += 1;
    teardown();
    activeRef.current = false;
    setActive(null);
  }, [teardown]);

  const handleExplain = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    const anchorRect = active && active.anchorRect;
    const context = active && active.context ? active.context : 'chat';

    const reqId = ++explainReqIdRef.current;
    setExplain({ snippet: text, anchorRect, loading: true, error: false, data: null });

    try {
      const data = await fetchExplain(text, context, i18n?.language);
      if (reqId !== explainReqIdRef.current) return;
      setExplain({ snippet: text, anchorRect, loading: false, error: false, data });
    } catch (err) {
      if (reqId !== explainReqIdRef.current) return;
      console.error('Explain failed', err);
      setExplain({ snippet: text, anchorRect, loading: false, error: true, data: null });
    }
  }, [active, i18n?.language]);

  // Capture commit on pointerup. Reading the selection synchronously is fast
  // enough — the browser has already committed it before our handler fires —
  // and skipping the macrotask hop removes the visible lag before the bar
  // appears.
  useEffect(() => {
    function commitSelection() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const text = sel.toString().trim();
      if (!text) return;

      const range = sel.getRangeAt(0);
      const startAnc = getSelectableAncestor(range.startContainer);
      const endAnc = getSelectableAncestor(range.endContainer);
      if (!startAnc || startAnc !== endAnc) return;

      if (marksRef.current.length) {
        unwrapMarks(marksRef.current);
        marksRef.current = [];
      }

      const rect = range.getBoundingClientRect();
      const marks = wrapRangeWithMarks(range);
      if (!marks.length) return;
      marksRef.current = marks;
      sel.removeAllRanges();
      justCreatedRef.current = true;
      activeRef.current = true;

      setActive({
        text,
        context: deriveContext(startAnc),
        anchorRect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
      });
    }

    function onPointerUp() {
      commitSelection();
    }

    function onPointerDown() {
      // A new pointer gesture clears the "just created" flag — that flag only
      // applies to the click that immediately follows the most recent
      // selection-creating pointerup.
      justCreatedRef.current = false;
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  // Permanent capture-phase click guard — runs before any per-component
  // handler (glossary popover, flashcard flip, etc.) so we can:
  //   1. Swallow the synthetic click that follows a selection-creating
  //      pointerup, so a drag-release on top of a clickable element doesn't
  //      activate that element.
  //   2. Treat any other click while a selection is active as a dismissal —
  //      consume it iOS-style so the underlying card/button doesn't fire.
  useEffect(() => {
    function onDocClick(e) {
      const tgt = e.target;
      if (tgt && tgt.closest && (
        tgt.closest('.nq-selection-bar-root') ||
        tgt.closest('.glossary-popover-root')
      )) return;

      if (justCreatedRef.current) {
        justCreatedRef.current = false;
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (activeRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dismiss();
      }
    }
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [dismiss]);

  // Esc and scroll/resize dismiss. (Click dismissal is handled above.)
  useEffect(() => {
    if (!active) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') dismiss();
    }
    function onScroll() {
      dismiss();
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [active, dismiss]);

  // Belt-and-suspenders: if this component ever unmounts mid-selection, clean
  // the marks so we don't leak DOM mutations.
  useEffect(() => () => teardown(), [teardown]);

  return (
    <>
      {children}
      {active && !explain && (
        <SelectionActionBar
          anchorRect={active.anchorRect}
          text={active.text}
          onExplain={handleExplain}
          onDismiss={dismiss}
        />
      )}
      <SelectionExplainPopover
        open={!!explain}
        snippet={explain ? explain.snippet : ''}
        anchorRect={explain ? explain.anchorRect : null}
        data={explain ? explain.data : null}
        error={explain ? explain.error : false}
        loading={explain ? explain.loading : false}
        onClose={closeExplain}
      />
    </>
  );
}
