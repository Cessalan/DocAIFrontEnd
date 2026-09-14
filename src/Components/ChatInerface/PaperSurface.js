import React from 'react';
import './paperTransition.css';

/* The paper itself: grain at rest, and the shading that makes the fold read as
 * a curved sheet rather than a shape being cropped.
 *
 * Two layers, both decorative and inert:
 *   - grain, always on, very faint — stock, not an effect. Without it the
 *     "paper" is a flat rectangle and the fold looks like a mask sliding.
 *   - shade, only while the sheet is moving — the pinch at the foot and the
 *     curled sides in shadow
 *
 * Two layers and no blend modes, deliberately. Every layer here is the size of
 * the sheet and is repainted on each frame of the fold; a travelling highlight
 * and a multiply pass were a third and a fourth full-surface cost for something
 * you see for a quarter of a second.
 *
 * Both are anchored to the fold geometry (--paper-foot-*) that usePaperTransition
 * writes onto the sheet, so the light falls where the paper actually bends.
 */
export default function PaperSurface({ mode = 'full' }) {
  /* On the cheap path there is no fold to shade, and the layers would be three
     more full-screen surfaces for a device that already cannot afford one. */
  if (mode !== 'full') return null;
  return <div className="paper-surface" aria-hidden="true">
    <span className="paper-grain" />
    <span className="paper-shade" />
  </div>;
}
