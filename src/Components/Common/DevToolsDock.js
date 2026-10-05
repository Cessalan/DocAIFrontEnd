import React, { useState } from 'react';

/**
 * DevToolsDock — one small bottom-left toggle that holds the dev-only pills
 * (onboarding preview, uploads, exam debrief).
 *
 * WHY THIS EXISTS
 *
 * Each pill was fixed to the bottom-left on its own, and stacked they covered
 * the bottom of the sidebar. Collapsed, the dock is a single faded chip; open,
 * the pills stack above it in normal flow. The open/closed choice survives a
 * reload so a testing session doesn't have to re-open it every time.
 *
 * Children are expected to render in flow (the pills take a `docked` prop).
 * Returns null outside development builds.
 */

const STORAGE_KEY = 'nqDevDockOpen';

const readOpen = () => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};

const DevToolsDock = ({ children }) => {
  const [open, setOpen] = useState(readOpen);
  const [hover, setHover] = useState(false);

  if (process.env.NODE_ENV !== 'development') return null;

  const toggle = () => {
    setOpen((o) => {
      try { localStorage.setItem(STORAGE_KEY, o ? '0' : '1'); } catch { /* dev only */ }
      return !o;
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 1200, // below the debrief/onboarding overlays so their modals cover it
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        userSelect: 'none',
      }}
    >
      {open && children}
      <button
        type="button"
        onClick={toggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={open ? 'Hide dev tools' : 'Show dev tools'}
        style={{
          padding: '5px 9px',
          border: 'none',
          borderRadius: 999,
          background: '#2b2f3a',
          color: '#e8e8ea',
          font: '700 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
          letterSpacing: '0.06em',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          opacity: open || hover ? 1 : 0.45,
        }}
      >
        {open ? 'DEV ×' : 'DEV'}
      </button>
    </div>
  );
};

export default DevToolsDock;
