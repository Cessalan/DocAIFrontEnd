import React from 'react';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';

/**
 * DevGapOfferPill — development-only control that opens the upgrade window
 * with the student's format gap (Common/gapOfferModel.js).
 *
 * The gap copy only shows to a free student who is NOT blocked by a limit, so
 * it cannot be reached from a Pro account or through DevPaywallPill (which
 * always simulates a blocked window). Two buttons, one per version:
 *   B  → badge / account-menu version: your real saved scores as percentages,
 *        or sample scores when this account has no gap
 *   C  → the version opened from the weak-areas line: readiness-check counts
 *
 * Safety: returns null outside development builds, and `simulateGapOffer()`
 * is itself a no-op there. Nothing is written to Firestore and no paywall
 * view is logged; only the props handed to <UpgradeModal> are substituted.
 * Styles are inline on purpose, following DevPaywallPill: this is scaffolding.
 *
 * @param {boolean} [docked] - render in flow inside DevToolsDock instead of fixed
 */
const btn = {
  padding: '5px 9px',
  border: 'none',
  borderRadius: 6,
  background: 'rgba(0, 0, 0, 0.18)',
  color: '#1a1a1a',
  font: '600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
  cursor: 'pointer',
};

const DevGapOfferPill = ({ docked = false }) => {
  const { simulateGapOffer } = useUsageLimit();

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div
      style={{
        ...(docked ? {} : { position: 'fixed', bottom: 56, right: 16, zIndex: 1200 }),
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        borderRadius: 999,
        background: '#e88d7d',
        color: '#000',
        fontSize: 11,
        fontWeight: 700,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        userSelect: 'none',
      }}
    >
      <span style={{ letterSpacing: '0.04em' }}>GAP</span>
      <button
        type="button"
        style={btn}
        onClick={() => simulateGapOffer('practice')}
        title="Dev only: the upgrade window as the badge opens it, with your saved scores (sample if you have no gap)"
      >
        B
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => simulateGapOffer('check')}
        title="Dev only: the upgrade window as the weak-areas line opens it (readiness-check counts)"
      >
        C
      </button>
    </div>
  );
};

export default DevGapOfferPill;
