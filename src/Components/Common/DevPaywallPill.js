import React from 'react';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';

/**
 * DevPaywallPill — development-only control that forces the upgrade modal open
 * in its BLOCKED state so the paywall can be reviewed without burning a real
 * quota (30+ generations) or waiting out a 3-hour window.
 *
 * Two buttons because the modal has two genuinely different pitches:
 *   Q  → the question throttle ("Don't stop now." + "You were practicing: X")
 *   P  → the study-plan meter  ("One plan won't cover your semester.")
 *
 * Safety: this returns null outside development builds, AND the underlying
 * `simulateLimit()` in UsageContext is itself a no-op there — so if this ever
 * ships by accident it cannot paywall a real user. Nothing is written to
 * Firestore; only the props handed to <UpgradeModal> are substituted.
 *
 * Styles are inline on purpose: this is scaffolding, and it should be
 * deletable in one file with no leftovers in a stylesheet.
 *
 * @param {string} [topic] - what to show in the "You were practicing" card
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

const DevPaywallPill = ({ topic = null }) => {
  const { simulateLimit } = useUsageLimit();

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1200,          // below .upgrade-overlay (9999) so the modal covers it
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        borderRadius: 999,
        background: '#ff9800',
        color: '#000',
        fontSize: 11,
        fontWeight: 700,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        userSelect: 'none',
      }}
    >
      <span style={{ letterSpacing: '0.04em' }}>PAYWALL</span>
      <button
        type="button"
        style={btn}
        onClick={() => simulateLimit('questions', { topic })}
        title={`Dev only: preview the question-limit paywall${topic ? ` for "${topic}"` : ''}`}
      >
        Q
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => simulateLimit('plans', { topic })}
        title="Dev only: preview the study-plan-limit paywall"
      >
        P
      </button>
    </div>
  );
};

export default DevPaywallPill;
