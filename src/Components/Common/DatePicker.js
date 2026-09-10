import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './DatePicker.css';

/**
 * DatePicker — the app's calendar popover.
 *
 * Native <input type="date"> can't be styled, and it renders in the BROWSER's
 * locale rather than the app's: on a French-locale machine an English user
 * gets a "jj/mm/aaaa" field. This is a small custom calendar that matches the
 * rest of the app — organic radii, coral accents, slight rotation — and takes
 * its month and weekday names from the `language` prop instead.
 *
 * Lives in Common/ and imports its own stylesheet. It previously sat beside
 * PlanOnboarding and borrowed that feature's CSS, which meant ExamDrill
 * rendered it correctly only because CRA bundles every imported stylesheet
 * globally. Any surface can now use it without that coupling.
 *
 * Used by: PlanOnboarding, ExamDrill/DrillExamDate, Nclex/NclexShell.
 *
 * Props:
 *   value     — selected date as 'YYYY-MM-DD' (or '')
 *   onChange  — (yyyy_mm_dd: string) => void
 *   minDate   — Date object; days strictly before this are disabled
 *   onClose   — called when the user dismisses (outside-click / Escape / select)
 *   anchorRef — ref to the trigger button; we measure it for popover position
 *   language  — 'en' | 'fr' (drives weekday + month labels)
 *   inline    — render in the page instead of a positioned portal
 */

const MONTHS_EN = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin',
                   'juillet','août','septembre','octobre','novembre','décembre'];

// Locale weekday headers — Sunday-first for EN (US convention), Monday-first
// for FR (European convention). Indexes line up with `weekStartsOn`.
const WEEKDAYS_EN = ['S','M','T','W','T','F','S'];
const WEEKDAYS_FR = ['L','M','M','J','V','S','D'];

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const DatePicker = ({
  value,
  onChange,
  minDate,
  onClose,
  anchorRef,
  language = 'en',
  inline = false
}) => {
  const isFr = (language || 'en').toLowerCase().startsWith('fr');
  const months   = isFr ? MONTHS_FR : MONTHS_EN;
  const weekdays = isFr ? WEEKDAYS_FR : WEEKDAYS_EN;
  const weekStartsOn = isFr ? 1 : 0;

  // Cursor month — defaults to the selected date's month, else today's month.
  const initialCursor = useMemo(() => {
    if (value) {
      const d = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }, [value]);

  const [cursor, setCursor] = useState(initialCursor);
  const popoverRef = useRef(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const min = useMemo(() => {
    if (!minDate) return null;
    const d = new Date(minDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [minDate]);
  const selected = useMemo(() => {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [value]);

  // ── Outside click + Escape close ─────────────────────────────────────
  // Ignore clicks on the anchor itself — its own onClick toggles the picker,
  // and we don't want this handler to race the toggle and close-then-reopen.
  useEffect(() => {
    if (inline) return undefined;
    const onDown = (e) => {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(e.target)) return;
      if (anchorRef && anchorRef.current && anchorRef.current.contains(e.target)) return;
      onClose && onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef, inline]);

  // ── Position the portal-rendered popover against the anchor ──────────
  // Renders into document.body to escape parent stacking contexts (the
  // onboarding card has transform:rotate which traps z-index). Uses
  // position:fixed against the anchor's bounding rect; flips above the
  // trigger when there's no room below; clamps horizontally to the viewport.
  const POPOVER_H = 340;
  const GAP = 10;
  const VIEWPORT_PAD = 10;
  const MAX_W = 300;
  const MIN_W = 240;

  const [pos, setPos] = useState(null);

  const computePos = useCallback(() => {
    if (inline) return;
    const anchor = anchorRef && anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Shrink the popover if the viewport can't hold the full width
    const width = Math.max(MIN_W, Math.min(MAX_W, vw - 2 * VIEWPORT_PAD));

    const spaceBelow = vh - rect.bottom;
    const placeAbove = spaceBelow < POPOVER_H + GAP && rect.top > POPOVER_H + GAP;

    const top = placeAbove
      ? Math.max(VIEWPORT_PAD, rect.top - GAP - POPOVER_H)
      : Math.min(vh - POPOVER_H - VIEWPORT_PAD, rect.bottom + GAP);

    let left = rect.left;
    // Clamp so the popover stays in the viewport horizontally
    left = Math.max(VIEWPORT_PAD, Math.min(left, vw - width - VIEWPORT_PAD));

    setPos({ top, left, width });
  }, [anchorRef, inline]);

  useLayoutEffect(() => {
    computePos();
  }, [computePos]);

  useEffect(() => {
    if (inline) return undefined;
    const onResize = () => computePos();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true); // capture: catch nested scrolls
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [computePos, inline]);

  // ── Build the 6×7 day grid for the cursor month ──────────────────────
  // Always render 42 cells so the grid height is constant — months that
  // start mid-week or have 31 days don't shove the picker around.
  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // Offset (0-6) to back up from the 1st to the start-of-week column
    const leadingBlanks = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;
    const start = new Date(year, month, 1 - leadingBlanks);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor, weekStartsOn]);

  const monthLabel = `${months[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const goPrev = () => {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  };
  const goNext = () => {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  };

  const canGoPrev = useMemo(() => {
    if (!min) return true;
    // Allow prev if the cursor month is after the min's month
    const cursorFirst = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const minFirst    = new Date(min.getFullYear(), min.getMonth(), 1);
    return cursorFirst > minFirst;
  }, [cursor, min]);

  const handlePick = (d) => {
    if (min && d < min) return;
    onChange && onChange(isoDate(d));
  };

  // Wait for the first measurement so we don't flash at (0,0)
  if (!inline && !pos) {
    // Render an invisible probe div to trigger the layout effect on mount
    return createPortal(
      <div ref={popoverRef} style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0 }} />,
      document.body
    );
  }

  const calendar = (
    <div
      ref={popoverRef}
      className={`nq-datepicker${inline ? ' nq-datepicker--inline' : ''}`}
      role={inline ? 'group' : 'dialog'}
      aria-label={isFr ? 'Choisir une date' : 'Pick a date'}
      style={inline ? undefined : { top: pos.top, left: pos.left, width: pos.width }}
    >
      <div className="nq-datepicker__header">
        <button
          type="button"
          className="nq-datepicker__nav"
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label={isFr ? 'Mois précédent' : 'Previous month'}
        >
          ‹
        </button>
        <div className="nq-datepicker__month" aria-live="polite">
          {monthLabel}
        </div>
        <button
          type="button"
          className="nq-datepicker__nav"
          onClick={goNext}
          aria-label={isFr ? 'Mois suivant' : 'Next month'}
        >
          ›
        </button>
      </div>

      <div className="nq-datepicker__weekdays" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i} className="nq-datepicker__weekday">{w}</span>
        ))}
      </div>

      <div className="nq-datepicker__grid" role="grid">
        {grid.map((d, i) => {
          const inMonth   = d.getMonth() === cursor.getMonth();
          const isToday   = sameDay(d, today);
          const isPicked  = selected && sameDay(d, selected);
          const isDisabled = !!(min && d < min);

          const cls = [
            'nq-datepicker__day',
            inMonth   ? '' : 'is-outside',
            isToday   ? 'is-today' : '',
            isPicked  ? 'is-selected' : '',
            isDisabled ? 'is-disabled' : ''
          ].filter(Boolean).join(' ');

          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={cls}
              onClick={() => handlePick(d)}
              disabled={isDisabled}
              // `aria-selected`, not `aria-pressed`: a gridcell is selected,
              // not toggled, and aria-pressed is not supported on this role.
              aria-selected={isPicked || false}
              aria-label={d.toDateString()}
              tabIndex={isDisabled ? -1 : 0}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
  return inline ? calendar : createPortal(calendar, document.body);
};

export default DatePicker;
