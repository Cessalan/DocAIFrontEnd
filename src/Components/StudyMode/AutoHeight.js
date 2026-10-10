import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Animates its own height to follow its content.
 *
 * The plan modal moves through loading, preview and saving inside one
 * surface. Without this the card snapped between heights at each step
 * ("it shows something, then something bigger"); with it, the same card
 * grows smoothly as the plan fills in (2026-10-08).
 */
export default function AutoHeight({ children, className = '', duration = 420 }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(null);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return undefined;
    const measure = () => setHeight(inner.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`auto-height ${className}`.trim()}
      style={{
        height: height === null ? 'auto' : height,
        transition: `height ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
        overflow: 'hidden',
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
