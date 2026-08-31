import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildExamNudge } from './examNudgeModel';
import './WarmUrgencyDashboard.css';

/* ──────────────────────────────────────────────────────────
   WarmUrgencyDashboard — "where am I, and am I on track?"

   Answers the first three questions a student should never have
   to hunt for: what exam, how long left, how ready am I. The
   fourth ("what do I do now?") belongs to TodaySessionCard, one
   block below — this card deliberately has no mid-plan CTA, so
   there's exactly one obvious next action on the page.

   Effort-framed, no deficit language: urgency comes from tone
   and a concrete next step, never from a ticking clock.

   Props:
     schedule            — from buildStudySchedule() (drives phase + countdown)
     examName            — string|null   ("Pharmacology Final")
     readinessPct        — number|null   coverage-aware readiness estimate
     questionsAnswered   — number        evidence behind readinessPct
     nodesCompleted      — number
     topicsCompleted     — number  (locked-in / strong topic count)
     topicsTotal         — number  (curriculum topic count)
     nextTopicName       — string|null  (first ready-to-explore topic)
     studyComplete       — boolean
     estimatedMinutes    — number|null
     onCtaClick          — fn      (phase-2 practice round; only when complete)
     language            — string  ('en'|'fr'|...) for date formatting
   ────────────────────────────────────────────────────────── */

/* The four countdown states from the product spec collapse onto the three
   existing accent palettes. Keeping three palettes (rather than adding a
   fourth) means exam day and the final 48h share one visual register — which
   is right: both are "stop learning, start consolidating". */
const TIER_BY_PHASE = {
  examDay: 'urgent',
  final: 'urgent',
  focus: 'moderate',
  steady: 'calm',
  past: 'calm',
  none: 'calm',
};

const formatExamDate = (exam, language) => {
  if (!exam) return null;
  const locale = language || undefined;
  return {
    short: exam.toLocaleDateString(locale, { month: 'long', day: 'numeric' }),
    full: exam.toLocaleDateString(locale, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }),
  };
};

/* ── Inline SVG icon set — single-color, current-color filled.
   Kept inline so the component has no asset dependencies. ── */
/* Growth, not a deadline. The literal date now lives in the page header, so
   this slot is free to carry tone instead of repeating information. */
const SproutIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21v-8" />
    <path d="M12 13c0-3.3-2.7-6-6-6 0 3.3 2.7 6 6 6z" />
    <path d="M12 13c0-3.9 3.1-7 7-7 0 3.9-3.1 7-7 7z" />
  </svg>
);

const FlagIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21V4" />
    <path d="M5 4h11l-1.6 3.5L16 11H5z" />
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
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

/* Lead icon carries the tone of the countdown phase: growing → aiming →
   finishing. It replaces a calendar glyph that just restated the header. */
const LEAD_ICON_BY_TIER = {
  urgent: <FlagIcon />,
  moderate: <TargetIcon />,
  calm: <SproutIcon />,
};

/**
 * Readiness ring. A gauge reads as "how full am I" at a glance; the bare
 * number it replaces read as a statistic. Same value, and the same honest
 * label — this is an estimate, not a predicted grade.
 */
const ReadinessRing = ({ pct }) => {
  const R = 26;
  const CIRC = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg className="wud-ring" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <circle
        className="wud-ring__track"
        cx="32" cy="32" r={R}
        fill="none" strokeWidth="6" strokeLinecap="round"
      />
      <circle
        className="wud-ring__value"
        cx="32" cy="32" r={R}
        fill="none" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * CIRC} ${CIRC}`}
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
};

const WarmUrgencyDashboard = ({
  schedule = null,
  examName = null,
  readinessPct = null,
  questionsAnswered = 0,
  nodesCompleted = 0,
  topicsCompleted = 0,
  topicsTotal = 0,
  nextTopicName = null,
  studyComplete = false,
  estimatedMinutes = null,
  onCtaClick,
  language,
}) => {
  const { t } = useTranslation();

  const {
    hasExam = false,
    examAt = null,
    daysRemaining = null,
    phase = 'none',
    onTrack = true,
  } = schedule || {};

  const tier = TIER_BY_PHASE[phase] || 'calm';
  const dateInfo = useMemo(() => formatExamDate(examAt, language), [examAt, language]);

  const remaining = Math.max(0, topicsTotal - topicsCompleted);
  const allLocked = topicsTotal > 0 && remaining === 0;

  // ── Countdown headline ──────────────────────────────────────────────
  // The days number is the biggest thing on the card. It's the one fact that
  // makes every other number on the page mean something.
  let countdownLabel = null;
  if (hasExam) {
    if (phase === 'examDay') {
      countdownLabel = t('warmUrgency.examToday', 'Your exam is today');
    } else if (daysRemaining === 1) {
      countdownLabel = t('warmUrgency.examTomorrow', 'Your exam is tomorrow');
    } else {
      countdownLabel = t('warmUrgency.daysUntilExam', '{{count}} days until your exam', {
        count: daysRemaining,
      });
    }
  }

  // ── Nudge — one sentence: an honest read plus one instruction ───────
  // The branching lives in examNudgeModel so the copy can be asserted. It
  // reads the calendar AND the readiness estimate, because the night before
  // an exam the advice for someone at 67% (consolidate what you have) is the
  // opposite of the advice for someone at 25% (abandon most of it and get one
  // thing solid). The previous version used one sentence for both, and told
  // her off about cramming while it did so.
  const nudge = useMemo(
    () =>
      buildExamNudge({
        phase,
        daysRemaining,
        nextTopic: nextTopicName,
        // Gate on evidence, exactly as the readiness ring does below: an
        // estimate off two answered questions must not be allowed to tell
        // her she is in good shape.
        readinessPct: questionsAnswered > 0 ? readinessPct : null,
        onTrack,
        studyComplete,
        allLocked,
      }),
    [phase, daysRemaining, nextTopicName, readinessPct, questionsAnswered,
     onTrack, studyComplete, allLocked]
  );
  const nudgeText = t(nudge.key, nudge.fallback, nudge.params);

  // ── Readiness ───────────────────────────────────────────────────────
  // Only shown once questions have actually been answered. Before that the
  // score is structurally 0% (untested topics count as zero), and rendering
  // "0% ready" as a new student's biggest number is the exact zero-state
  // mistake the old journey block made.
  //
  // Labelled an ESTIMATE on purpose: it's coverage-weighted accuracy over a
  // few dozen questions, not a predicted exam grade, and calling it one would
  // be false precision the data can't back.
  const showReadiness = readinessPct != null && questionsAnswered > 0;

  // ── Progress line ───────────────────────────────────────────────────
  const progressParts = [];
  if (nodesCompleted > 0) {
    progressParts.push(t('warmUrgency.nodesDone', '{{count}} done', { count: nodesCompleted }));
  }
  if (topicsCompleted > 0) {
    progressParts.push(
      t('warmUrgency.topicsLocked', '{{count}} of {{total}} topics locked in', {
        count: topicsCompleted,
        total: topicsTotal,
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
  if (!dateInfo && !showProgress && !showCta && !showReadiness) return null;

  return (
    <div className={`wud wud--${tier}`}>
      {dateInfo && (
        <div className="wud-exam">
          <div className="wud-exam__row">
            <span className="wud-exam__icon">{LEAD_ICON_BY_TIER[tier]}</span>
            <div className="wud-exam__text">
              {/* Countdown leads. The exam's name and literal date are the page
                  header's job — repeating them here would be a third printing
                  of the same fact. */}
              <div className="wud-exam__date" title={dateInfo.full}>
                {countdownLabel || dateInfo.short}
              </div>
              <div className="wud-exam__sub">{nudgeText}</div>
            </div>

            {showReadiness && (
              <div className="wud-ready" title={t(
                'warmUrgency.readinessTooltip',
                'Estimated from {{count}} practice questions across your topics. Topics you have not been tested on yet count as zero.',
                { count: questionsAnswered }
              )}>
                <ReadinessRing pct={readinessPct} />
                <div className="wud-ready__inner">
                  <div className="wud-ready__pct">{readinessPct}%</div>
                  <div className="wud-ready__label">
                    {t('warmUrgency.readinessLabel', 'Readiness')}
                  </div>
                  <div className="wud-ready__sub">
                    {t('warmUrgency.readinessEstimated', 'estimated')}
                  </div>
                </div>
              </div>
            )}
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
