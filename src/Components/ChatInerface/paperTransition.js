import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/* The genie: a sheet of paper unfolding out of the thing that was tapped.
 *
 * Two pieces live here because they have to agree — the geometry that builds
 * the clip-path frames, and the state machine that decides when they run. The
 * CSS half is paperTransition.css; the keyframe names below are a contract
 * with it (handleAnimationEnd matches on them).
 *
 * Used by chat's FocusedQuiz and by study mode's node view. The two mount in
 * very different boxes — FocusedQuiz portals to <body> and covers the viewport,
 * study mode's container is fixed but inset by the sidebar — which is the whole
 * reason paperOriginStyle takes `bounds`. clip-path resolves against the
 * element's own border box, so feeding it raw viewport rects makes the paper
 * unfold from a point that drifts with the sidebar. */

/* Short on purpose. The fold is a transition, not a feature — at 700ms it read
   as something to sit through, and every extra frame is another full-surface
   repaint on a machine that may not have one to spare. */
export const PAPER_OPEN_MS = 420;
export const PAPER_FOLD_MS = 260;

// Matching path commands let the browser interpolate a curved, narrowing sheet.
// The lower edge stays attached to the launch card as the upper edge unfurls.
export function paperContour(left, right, top, bottom, footLeft, footRight, radius) {
  const depth = bottom - top;
  return `path('M ${left + radius} ${top} L ${right - radius} ${top} Q ${right} ${top} ${right} ${top + radius} C ${right} ${top + depth * .58} ${footRight} ${bottom - depth * .42} ${footRight} ${bottom - radius} Q ${footRight} ${bottom} ${footRight - radius} ${bottom} L ${footLeft + radius} ${bottom} Q ${footLeft} ${bottom} ${footLeft} ${bottom - radius} C ${footLeft} ${bottom - depth * .42} ${left} ${top + depth * .58} ${left} ${top + radius} Q ${left} ${top} ${left + radius} ${top} Z')`;
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * The three clip-path frames, expressed in the animating element's own
 * coordinate space.
 *
 * @param {{left:number,top:number,width:number,height:number}} [origin]
 *        Viewport rect of whatever was tapped. Missing or zero-sized (every
 *        programmatic launch — auto-start, an inserted recommendation node, a
 *        retry) falls back to a centred sheet, which reads as a plain zoom.
 * @param {{left:number,top:number,width:number,height:number}} [bounds]
 *        Viewport rect of the animating element. Defaults to the viewport.
 */
export function paperOriginStyle(origin, bounds) {
  const viewport = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  // jsdom and a not-yet-laid-out element both measure zero; the viewport is a
  // better guess than a degenerate box that would collapse every path.
  const box = bounds?.width > 0 && bounds?.height > 0 ? bounds : viewport;
  const { width, height } = box;
  const source = origin?.width > 0 && origin?.height > 0 ? origin
    : { left: box.left + width * .3, top: box.top + height * .3, width: width * .4, height: height * .3 };
  // An origin can sit outside the animating box — a node scrolled half out of
  // view, or a control in the sidebar the box is inset from. Clamping keeps the
  // fold inside the sheet instead of throwing it off-screen.
  const left = clamp(source.left - box.left, 0, width);
  const right = clamp(source.left + source.width - box.left, left + 1, width);
  const top = clamp(source.top - box.top, 0, height);
  const bottom = clamp(source.top + source.height - box.top, top + 1, height);
  return {
    '--paper-source': paperContour(left, right, top, bottom, left, right, 22),
    '--paper-bend': paperContour(0, width, 0, Math.max(bottom, height * .76), left, right, 18),
    '--paper-full': paperContour(0, width, 0, height, 0, width, 0),
    /* The shading needs the same numbers as the silhouette. The foot is where
       the sheet stays pinched against the launch control, so that is where the
       creases converge and where the paper is darkest — a gradient anchored to
       the middle of the element instead would light a fold that isn't there. */
    '--paper-foot-x': `${Math.round((left + right) / 2)}px`,
    '--paper-foot-width': `${Math.round(right - left)}px`,
    '--paper-foot-y': `${Math.round(bottom)}px`,
    '--paper-height': `${Math.round(height)}px`,
  };
}

const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* How much paper this device gets.
 *
 *   full   — the fold, the grain and the shading
 *   plain  — the fold with no decorative layers (diagnostic: forced only)
 *   simple — a transform-and-opacity open out of the same point. Only the
 *            compositor is involved, so it cannot drop a frame, but it is a
 *            zoom rather than a fold
 *   off    — no animation
 *
 * Setting localStorage.nqPaperFold to one of these and reopening tells you
 * which layer costs what on a machine you can actually feel it on: still slow
 * at 'off' and the animation was never the problem; smooth at 'simple' and the
 * clip-path repaint is; smooth at 'plain' but not 'full' and it is the grain
 * and shading.
 *
 * Animating clip-path is a main-thread repaint, and its cost scales with the
 * pixels being repainted: measured on a 2560x1440 viewport the fold holds 60fps
 * but drops a single long frame when the browser first allocates the layers for
 * it. A machine with less to spare drops more than one, which is why this is a
 * capability check and not a constant. localStorage.nqPaperFold overrides it. */
export function paperMode() {
  try {
    const forced = window.localStorage?.getItem('nqPaperFold');
    if (['full', 'plain', 'simple', 'off'].includes(forced)) return forced;
  } catch { /* storage can throw in private mode; the capability check still applies */ }
  if (prefersReducedMotion()) return 'off';
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  return cores <= 4 || memory <= 4 ? 'simple' : 'full';
}

/**
 * Open/close state for a paper sheet.
 *
 * Returns a ref to put on the animating element: the origin frames are written
 * to it in a layout effect rather than passed as inline style, because they
 * depend on the element's measured box and must land before first paint.
 *
 * `close()` is deliberately not the same thing as unmounting — the caller does
 * its own work first (saving, completion) and the sheet folds afterwards.
 * onClosed fires exactly once per close, whether the animation ends normally,
 * is interrupted by the browser, or never runs at all under reduced motion.
 */
export function usePaperTransition({ visible = true, origin, onClosed } = {}) {
  const ref = useRef(null);
  const [closing, setClosing] = useState(false);
  /* 'arming' exists to move a cost off the animation's first frame. Mounting a
     view, painting it for the first time and starting a clip-path animation in
     one commit means the browser allocates the animation's layers during the
     frame that is already the most expensive in the sequence — which is the
     hitch you feel at the moment something opens. Arming holds the sheet at its
     start frame with will-change set, so the allocation lands on a frame that
     isn't animating, and the fold begins on a warm layer. */
  const [phase, setPhase] = useState(visible ? 'arming' : 'idle');
  const mode = useMemo(() => paperMode(), []);
  const pending = useRef(false);
  const closedCallback = useRef(onClosed); closedCallback.current = onClosed;

  useLayoutEffect(() => {
    if (!visible) { setPhase('idle'); return undefined; }
    if (mode === 'off') { setPhase('open'); return undefined; }
    setPhase('arming');
    let second;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setPhase('opening')); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [visible, mode]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !visible) return;
    const style = paperOriginStyle(origin, element.getBoundingClientRect());
    Object.entries(style).forEach(([name, value]) => element.style.setProperty(name, value));
  }, [visible, origin]);

  const finish = useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    closedCallback.current?.();
  }, []);

  const close = useCallback(() => {
    if (pending.current) return false;
    pending.current = true;
    if (mode === 'off') finish();
    else setClosing(true);
    return true;
  }, [finish, mode]);

  // Also finish if the browser interrupts the CSS animation.
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(finish, PAPER_FOLD_MS + 80);
    return () => clearTimeout(timer);
  }, [closing, finish]);

  useEffect(() => { if (!visible) { pending.current = false; setClosing(false); } }, [visible]);


  const handleAnimationEnd = useCallback(event => {
    if (event.target !== event.currentTarget) return;
    if (event.animationName === 'paper-fold' || event.animationName === 'paper-zoom-out') finish();
    if (event.animationName === 'paper-unfold' || event.animationName === 'paper-zoom-in') setPhase('open');
  }, [finish]);

  // Memoised: callers put this in useCallback dependency lists, and a fresh
  // object every render would invalidate their handlers on every keystroke.
  return useMemo(() => ({ ref, mode, closing, pending, close, finish, handleAnimationEnd,
    opening: phase === 'opening',
    className: `${closing ? 'is-folding' : phase === 'arming' ? 'is-arming' : phase === 'opening' ? 'is-opening' : ''}`,
    'data-paper': mode }),
    [phase, mode, closing, close, finish, handleAnimationEnd]);
}
