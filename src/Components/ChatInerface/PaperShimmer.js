import React from 'react';
import './paperTransition.css';

/* The skeleton shown while questions are still arriving.
 *
 * Shaped like the card it replaces — a short line, a question-sized block, four
 * options — so the content lands in the space the skeleton was already holding
 * instead of shoving the page around. Shared with study mode's loading screen,
 * where it is only the body: the surrounding progress bar, escalating copy and
 * escape hatch there exist because study generation is routinely slow, and a
 * bare skeleton would be a frozen rectangle at 30s.
 */
export default function PaperShimmer({ label = 'Preparing your questions…', options = 4, className = '' }) {
  /* With no label the skeleton is pure decoration sitting next to copy that is
     already announced — role="status" here would read the wait out twice. */
  const announce = label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': 'true' };
  return <div className={`paper-shimmer ${className}`.trim()} {...announce}>
    <span className="paper-skeleton short" /><span className="paper-skeleton title" />
    {Array.from({ length: options }, (_, i) => <span key={i} className="paper-skeleton option" />)}
    {label && <p>{label}</p>}
  </div>;
}
