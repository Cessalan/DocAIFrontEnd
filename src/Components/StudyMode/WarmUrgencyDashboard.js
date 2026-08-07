import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './WarmUrgencyDashboard.css';

/* ──────────────────────────────────────────────────────────
   WarmUrgencyDashboard
   Replaces the old countdown-timer + confidence-gauge layout.
   Same data, opposite emotional posture: effort-framed, no
   deficit language, urgency expressed through tone + a
   single concrete next step instead of a ticking clock.

   Props:
     examDate            — Date|string|number|Firestore Timestamp|null
     questionsAnswered   — number  (total questions student has answered)
     topicsCompleted     — number  (locked-in / strong topic count)
     topicsTotal         — number  (curriculum topic count)
     nextTopicName       — string|null  (first ready-to-explore topic)
     topicsList          — Array<{ name: string, status: 'locked_in' | 'ready' }>
     onCtaClick          — fn      (called on primary CTA + card click)
     language            — string  ('en'|'fr'|...) for date formatting
   ────────────────────────────────────────────────────────── */

const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;

const coerceDate = (raw) => {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number' || typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const computeTier = (exam) => {
  if (!exam) return 'calm';
  const hours = (exam.getTime() - Date.now()) / HOUR_MS;
  if (hours <= 24) return 'urgent';
  if (hours <= 72) return 'moderate';
  return 'calm';
};

const formatExamDate = (exam, language) => {
  if (!exam) return null;
  const now = new Date();
  const days = Math.round((startOfDay(exam) - startOfDay(now)) / DAY_MS);
  const locale = language || undefined;
  if (days <= 0) return { label: 'Today', full: exam.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' }) };
  if (days === 1) {
    return {
      label: `Tomorrow, ${exam.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}`,
      full: exam.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })
    };
  }
  if (days <= 7) {
    return {
      label: exam.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' }),
      full: exam.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
    };
  }
  return {
    label: exam.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
    full: exam.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  };
};

/* ── Inline SVG icon set — single-color, current-color filled.
   Kept inline so the component has no asset dependencies. ── */
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18" />
    <path d="M8 3v4M16 3v4" />
  </svg>
);

const BoltIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V5z" />
    <path d="M6 17h14" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 8.5 6.5 12 13 4.5" />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const NUDGE_ICON_BY_TIER = {
  urgent: <BoltIcon />,
  moderate: <TargetIcon />,
  calm: <BookIcon />
};

const WarmUrgencyDashboard = ({
  examDate,
  nodesCompleted = 0,
  topicsCompleted = 0,
  topicsTotal = 0,
  nextTopicName = null,
  studyComplete = false,
  estimatedMinutes = null,
  onCtaClick,
  language
}) => {
  const { t } = useTranslation();

  const exam = useMemo(() => coerceDate(examDate), [examDate]);
  const tier = useMemo(() => computeTier(exam), [exam]);
  const dateInfo = useMemo(() => formatExamDate(exam, language), [exam, language]);

  const remaining = Math.max(0, topicsTotal - topicsCompleted);
  const allLocked = topicsTotal > 0 && remaining === 0;

  // ── Nudge — one sentence, tone driven by how close the exam is ──────
  let nudgeText;
  if (studyComplete) {
    nudgeText = allLocked
      ? t('warmUrgency.nudgeCompleteAllLocked', "Plan's done and topics are locked in — a practice round keeps it sharp.")
      : t('warmUrgency.nudgeCompletePartial', "You've made it through the plan — one practice round can solidify everything.");
  } else if (tier === 'urgent') {
    nudgeText = nextTopicName
      ? t('warmUrgency.nudgeUrgent', 'One focused session on {{topic}} could lock it in before tomorrow.', { topic: nextTopicName })
      : t('warmUrgency.nudgeUrgentGeneric', 'A short focused session today could lock things in before tomorrow.');
  } else if (tier === 'moderate') {
    nudgeText = t('warmUrgency.nudgeModerate', "You've got time — a 20-min focus session today keeps your momentum going.");
  } else {
    nudgeText = t('warmUrgency.nudgeCalm', 'No rush — steady practice beats cramming every time.');
  }

  // ── Progress line ───────────────────────────────────────────────────
  // Replaces the old journey block (headline + dot pair + full topic list).
  // That block announced "0 of 4 topics locked in" to every new student —
  // a zero state rendered as the biggest number on the page — and repeated
  // the topic list that TodaySessionCard and the full plan already show.
  // Only render once there is something real to report.
  const progressParts = [];
  if (nodesCompleted > 0) {
    progressParts.push(t('warmUrgency.nodesDone', '{{count}} done', { count: nodesCompleted }));
  }
  if (topicsCompleted > 0) {
    progressParts.push(
      t('warmUrgency.topicsLocked', '{{count}} of {{total}} topics locked in', {
        count: topicsCompleted,
        total: topicsTotal
      })
    );
  }
  const showProgress = progressParts.length > 0;

  // ── CTA — only when the plan is finished ────────────────────────────
  // Mid-plan, TodaySessionCard owns "what do I do next", so a second button
  // here was a duplicate. Once the plan is complete that card unmounts, and
  // this becomes the only route into the phase-2 practice round.
  const showCta = studyComplete && typeof onCtaClick === 'function';
  const ctaTitle = allLocked
    ? t('warmUrgency.ctaCompletePractice', 'Build my practice round')
    : t('warmUrgency.ctaCompleteFocused', 'Build my focused review');
  const ctaSub = estimatedMinutes
    ? t('warmUrgency.ctaCompleteSub', '~{{min}} min · pull it all together', { min: estimatedMinutes })
    : t('warmUrgency.ctaCompleteSubGeneric', 'Pull it all together');

  // Nothing worth a card: no exam date, no progress, no action.
  if (!dateInfo && !showProgress && !showCta) return null;

  return (
    <div className={`wud wud--${tier}`}>
      {dateInfo && (
        <div className="wud-exam">
          <div className="wud-exam__row">
            <span className="wud-exam__icon"><CalendarIcon /></span>
            <div className="wud-exam__text">
              <div className="wud-exam__label">{t('warmUrgency.yourExam', 'Your exam')}</div>
              <div className="wud-exam__date" title={dateInfo.full}>{dateInfo.label}</div>
            </div>
          </div>
          <div className="wud-exam__nudge">
            <span className="wud-exam__nudge-icon">
              {NUDGE_ICON_BY_TIER[tier]}
            </span>
            <span className="wud-exam__nudge-text">{nudgeText}</span>
          </div>
        </div>
      )}

      {showProgress && (
        <p className="wud-progress">
          <span className="wud-progress__icon" aria-hidden="true"><CheckIcon /></span>
          {progressParts.join(' · ')}
        </p>
      )}

      {showCta && (
        <button
          type="button"
          className={`wud-cta wud-cta--${tier}`}
          onClick={(e) => { e.stopPropagation(); onCtaClick(e); }}
        >
          <div className="wud-cta__text">
            <div className="wud-cta__title">{ctaTitle}</div>
            <div className="wud-cta__sub">{ctaSub}</div>
          </div>
          <span className="wud-cta__arrow" aria-hidden="true">
            <ArrowIcon />
          </span>
        </button>
      )}
    </div>
  );
};

export default WarmUrgencyDashboard;
