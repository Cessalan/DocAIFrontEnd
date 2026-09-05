import React from 'react';
import { openExamDebriefDev } from './devTrigger';

/**
 * DevExamDebriefPill — development-only control that opens the post-exam
 * conversation on demand.
 *
 * WHY THIS EXISTS
 *
 * The real trigger needs an exam whose day is already over, within the last
 * fortnight, that has never been debriefed. Once you have answered or dismissed
 * it, it is gone for good — by design. That makes the conversation almost
 * impossible to iterate on: every copy tweak, dark-mode check or prompt change
 * otherwise means editing Firestore by hand or waiting for a real exam to pass.
 *
 * Three buttons, because they exercise genuinely different paths:
 *   N  → a named fake exam ("Your Pharmacology exam…") — the common case
 *   ∅  → an unnamed fake exam ("Your exam…") — the PlanOnboarding path, which
 *        has no exam name and different opening copy
 *   R  → this account's REAL pending exam, if it has one. Writes for real and
 *        marks the exam handled, so it can be used exactly once — that is the
 *        point of it: it is the only way to rehearse the real thing.
 *
 * Safety: returns null outside development, and `openExamDebriefDev` is itself
 * a no-op there. The two fake modes write rows flagged `context.devPreview`,
 * which the dashboard rollup drops before counting.
 *
 * Styles are inline on purpose, following DevPaywallPill: this is scaffolding,
 * and it should be deletable in two files with no leftovers in a stylesheet.
 */

const btn = {
  padding: '5px 9px',
  border: 'none',
  borderRadius: 6,
  background: 'rgba(0, 0, 0, 0.18)',
  color: '#1a1a1a',
  font: '600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
  cursor: 'pointer'
};

const DevExamDebriefPill = () => {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        // Left, because DevPaywallPill already owns bottom-right.
        left: 16,
        zIndex: 1200, // below .exam-debrief-overlay (10000) so the modal covers it
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        borderRadius: 999,
        background: '#7cb9a8',
        color: '#000',
        fontSize: 11,
        fontWeight: 700,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        userSelect: 'none'
      }}
    >
      <span style={{ letterSpacing: '0.04em' }}>DEBRIEF</span>
      <button
        type="button"
        style={btn}
        onClick={() => openExamDebriefDev({ label: 'Pharmacology' })}
        title="Dev only: open the post-exam conversation for a fake named exam"
      >
        N
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => openExamDebriefDev({ label: null })}
        title="Dev only: open it for a fake UNNAMED exam (the PlanOnboarding path)"
      >
        ∅
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => openExamDebriefDev({ useReal: true })}
        title="Dev only: open it for this account's REAL pending exam. Writes for real and marks it handled — one shot."
      >
        R
      </button>
    </div>
  );
};

export default DevExamDebriefPill;
