import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';

const LandingPractice = lazy(() => import('../SeoPractice/LandingPractice'));

/**
 * Homepage analytics that do not start an SEO acquisition record. trackSeo
 * writes one, which would label an ordinary visitor who merely scrolled past as
 * an SEO signup. Her first answer goes through trackSeo; this covers before it.
 */
export const trackLandingPractice = (step) => {
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
  import('../../Services/FunnelService')
    .then(({ logFunnelStep }) => logFunnelStep(step, { environment: process.env.NODE_ENV }))
    .catch(() => {});
};

/**
 * Stays in the landing bundle, so it must stay small: it holds the space and
 * fetches the questions only as she approaches them. Also records that she saw
 * them, the denominator for "how many visitors answered".
 */
export default function LandingPracticeSlot() {
  const slot = useRef(null);
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !slot.current) return undefined;
    const loader = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); loader.disconnect(); }
    }, { rootMargin: '600px 0px' });
    const viewed = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { trackLandingPractice('landing_practice_viewed'); viewed.disconnect(); }
    }, { threshold: 0.3 });
    loader.observe(slot.current);
    viewed.observe(slot.current);
    return () => { loader.disconnect(); viewed.disconnect(); };
  }, []);

  return (
    <div ref={slot} className="landing-practice-slot">
      {/* Space held so the button below does not jump when the questions land. */}
      {near ? (
        <Suspense fallback={<div className="landing-practice-placeholder" />}>
          <LandingPractice />
        </Suspense>
      ) : <div className="landing-practice-placeholder" />}
    </div>
  );
}
