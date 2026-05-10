import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import GlossaryPopover from './GlossaryPopover';
import { fetchGlossaryTerm } from '../../Services/FastAPICalls';
import './Glossary.css';

/**
 * Treats a <strong> as an option-header (NOT a clickable medical term) when
 * the text matches any of these patterns. New rationales use <b> for headers
 * so this filter mostly handles the legacy question bank where <strong> was
 * used for "Option X is correct".
 */
function isOptionHeader(rawText) {
  if (!rawText) return true;
  const t = rawText.trim();
  if (t.length === 0) return true;
  if (t.length > 80) return true; // sentence-length, not a single term

  // Explicit "Option X" headers (EN/FR)
  if (/\boption\b/i.test(t)) return true;

  // "is correct/incorrect", "are correct/incorrect" verdict phrases
  if (/\b(is|are)\s+(correct|incorrect|right|wrong)\b/i.test(t)) return true;
  // French verdicts
  if (/\b(est|sont)\s+(correct|incorrect)/i.test(t)) return true;

  // Lists like "A, C, D, and F are correct" / "A and B are incorrect"
  if (/^[A-Fa-f](\s*(?:,|and|et|&)\s*[A-Fa-f])+/i.test(t)) return true;

  // Numbered step header: "1. Oxygen first", "1) Notify", "1:"
  if (/^\d+\s*[\.\)\:]/.test(t)) return true;

  // Trailing colon → header style ("Priority Order Rationale:")
  if (/[:：]\s*$/.test(t)) return true;

  return false;
}

/**
 * Walk all <strong> elements in the rationale and mark term-vs-header so the
 * CSS only applies tappable styling to real medical terms. Without this,
 * legacy questions whose justifications still wrap "<strong>Option X is
 * correct</strong>" would visually look clickable even though the click
 * handler skips them.
 */
function tagTerms(node) {
  if (!node) return [];
  const terms = [];
  node.querySelectorAll('strong').forEach((el) => {
    if (isOptionHeader(el.textContent || '')) {
      el.classList.remove('glossary-term');
    } else {
      el.classList.add('glossary-term');
      terms.push(el);
    }
  });
  return terms;
}

/**
 * useGlossary — wire clickable medical-term popovers to a rationale container.
 *
 * Returns:
 *   rationaleRef     → ref object to attach to the rationale div
 *   rationaleHandlers → { onClick, 'data-glossary': 'true' } to spread on it
 *   popover          → JSX to render somewhere in the tree
 *
 * Usage:
 *   const { rationaleRef, rationaleHandlers, popover } = useGlossary();
 *   <div ref={rationaleRef} {...rationaleHandlers}
 *        className="feedback-rationale-content"
 *        dangerouslySetInnerHTML={{ __html: justification }} />
 *   {popover}
 */
export default function useGlossary() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [anchorRect, setAnchorRect] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeElRef = useRef(null);
  const containerRef = useRef(null);
  const requestIdRef = useRef(0);

  const clearActiveTermClass = useCallback(() => {
    if (activeElRef.current) {
      activeElRef.current.classList.remove('glossary-term-active');
      activeElRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setError(false);
    clearActiveTermClass();
  }, [clearActiveTermClass]);

  const handleTermClick = useCallback(async (el) => {
    if (!el) return;
    const text = (el.textContent || '').trim();
    if (!text) return;
    if (!el.classList.contains('glossary-term') && isOptionHeader(text)) return;

    clearActiveTermClass();
    el.classList.add('glossary-term-active');
    activeElRef.current = el;

    const rect = el.getBoundingClientRect();
    setAnchorRect({
      top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
      width: rect.width, height: rect.height,
    });
    setTerm(text);
    setData(null);
    setError(false);
    setLoading(true);
    setOpen(true);

    const reqId = ++requestIdRef.current;
    try {
      const res = await fetchGlossaryTerm(text);
      if (reqId !== requestIdRef.current) return;
      setData(res);
      setLoading(false);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      console.error('Glossary fetch failed', err);
      setError(true);
      setLoading(false);
    }
  }, [clearActiveTermClass]);

  const onRationaleClick = useCallback((e) => {
    const el = e.target.closest('strong');
    if (!el) return;
    if (!containerRef.current || !containerRef.current.contains(el)) return;
    e.preventDefault();
    e.stopPropagation();
    handleTermClick(el);
  }, [handleTermClick]);

  // Re-tag terms after every render. The rationale's content can change via
  // dangerouslySetInnerHTML without remounting the container, so a one-shot
  // ref-callback isn't enough — running on every render is cheap (a single
  // querySelectorAll over a small fragment) and keeps the .glossary-term
  // class in sync with whatever content is currently rendered.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    tagTerms(containerRef.current);
  });

  // Document-level capture-phase fallback. Some component trees may stop
  // click events before they reach the rationale container's React handler;
  // this guarantees a tap on a tagged term inside our container always fires.
  useEffect(() => {
    function onDocClick(e) {
      const container = containerRef.current;
      if (!container) return;
      const el = e.target instanceof Element ? e.target.closest('strong') : null;
      if (!el || !container.contains(el)) return;
      if (!el.classList.contains('glossary-term')) return;
      e.preventDefault();
      e.stopPropagation();
      handleTermClick(el);
    }
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [handleTermClick]);

  useEffect(() => {
    return () => {
      clearActiveTermClass();
    };
  }, [clearActiveTermClass]);

  const rationaleHandlers = {
    onClick: onRationaleClick,
    'data-glossary': 'true',
  };

  const popover = (
    <GlossaryPopover
      open={open}
      term={term}
      anchorRect={anchorRect}
      data={data}
      error={error}
      loading={loading}
      onClose={handleClose}
    />
  );

  return {
    rationaleRef: containerRef,
    rationaleHandlers,
    // Backwards-compat: keep the old single-spread API working too.
    rationaleProps: { ref: containerRef, ...rationaleHandlers },
    popover,
  };
}
