import React, { Suspense, useMemo, useState } from 'react';
import { lazyWithReload } from '../../Services/chunkReload';
import { Diagnostic } from './SeoMiniProduct';
import { LANDING_PRACTICE_PAGE, landingPracticePool } from './landingPracticeModel';
import './LandingPractice.css';

// The real question cards are heavy, and only a visitor who asks for them pays.
const LandingCaseRun = lazyWithReload(() => import('./LandingCaseRun'));

/**
 * Homepage practice: three quick questions, then the harder formats with their
 * walkthroughs. Lazy-loaded by LandingPracticeSlot because the catalog and the
 * question cards are heavy and the landing page has to paint on first byte. See
 * landingPracticeModel.js for why this is here at all.
 */
export default function LandingPractice() {
  const pool = useMemo(() => landingPracticePool(), []);
  const [cases, setCases] = useState(false);

  if (cases) {
    return (
      <div className="landing-practice is-cases">
        <Suspense fallback={<div className="landing-practice-loading" />}>
          <LandingCaseRun />
        </Suspense>
      </div>
    );
  }

  const keepGoing = (
    <div className="seo-continue seo-continue-lead">
      <div className="seo-continue-copy">
        <span className="seo-kicker">Keep practicing</span>
        <h3>Now try what the exam really asks.</h3>
        <p>A select-all and two patient cases. After each one, watch the tutor work it out step by step.</p>
      </div>
      <div className="seo-continue-action">
        <button type="button" className="seo-primary" onClick={() => setCases(true)}>
          Try a patient case<span aria-hidden="true">→</span>
        </button>
        <small>Still no account needed.</small>
      </div>
    </div>
  );

  return (
    <div className="landing-practice">
      <div className="seo-mini seo-embedded">
        <Diagnostic page={LANDING_PRACTICE_PAGE} pool={pool} autoStart embedded nextStep={keepGoing} />
      </div>
    </div>
  );
}
