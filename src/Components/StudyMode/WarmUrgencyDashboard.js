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

const SparkIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
    <path d="M8 1l1.5 4.6L14 7l-4.5 1.4L8 13l-1.5-4.6L2 7l4.5-1.4L8 1z" />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const QuestionDotIcon = () => (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M7 7.5a3 3 0 1 1 3.5 3v1.5" strokeLinecap="round" />
    <circle cx="10" cy="15" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);

const NUDGE_ICON_BY_TIER = {
  urgent: <BoltIcon />,
  moderate: <TargetIcon />,
  calm: <BookIcon />
};

const WarmUrgencyDashboard = ({
  examDate,
  questionsAnswered = 0,
  topicsCompleted = 0,
  topicsTotal = 0,
  nextTopicName = null,
  topicsList = [],
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

  const journeyHeadline = t(
    'warmUrgency.journeyHeadline',
    "You've tackled {{count}} questions so far",
    { count: questionsAnswered }
  );

  // Journey sub — completion-aware. When the plan is done, switch the
  // closer from "more to do" to "consolidate what you've learned" so we
  // don't badger a student who has finished every node to "lock in" more.
  let journeySub;
  if (studyComplete) {
    journeySub = allLocked
      ? t(
          'warmUrgency.completeAllLocked',
          "You've made it through your plan and locked in all {{total}} topics — you're ready.",
          { total: topicsTotal }
        )
      : t(
          'warmUrgency.completePartial',
          "You've made it through your plan — {{completed}} of {{total}} fully locked in. A practice round will fold in the rest.",
          { completed: topicsCompleted, total: topicsTotal }
        );
  } else if (topicsTotal === 0) {
    journeySub = t('warmUrgency.journeyNoTopics', 'A few questions in — keep going.');
  } else if (allLocked) {
    journeySub = t(
      'warmUrgency.journeyAllLocked',
      "You've locked in all {{total}} topics — you're ready.",
      { total: topicsTotal }
    );
  } else if (remaining === 1) {
    journeySub = t(
      'warmUrgency.journeyOneMore',
      "You've locked in {{completed}} of {{total}} topics — one more session gets you there.",
      { completed: topicsCompleted, total: topicsTotal }
    );
  } else {
    journeySub = t(
      'warmUrgency.journeySome',
      "You've locked in {{completed}} of {{total}} topics — plenty of time to cover the rest.",
      { completed: topicsCompleted, total: topicsTotal }
    );
  }

  // Nudge — when the plan is complete the message shifts away from
  // "carve out a session" to "consolidate" regardless of tier. We still
  // honor tier-driven palette so the visual urgency cue is preserved.
  let nudgeText;
  if (studyComplete) {
    nudgeText = allLocked
      ? t('warmUrgency.nudgeCompleteAllLocked', "Plan's done and topics are locked in — a practice round keeps it sharp.")
      : t('warmUrgency.nudgeCompletePartial', "You've made it through the plan — one practice round can solidify everything.");
  } else if (tier === 'urgent') {
    nudgeText = nextTopicName
      ? t(
          'warmUrgency.nudgeUrgent',
          'One focused session on {{topic}} could lock it in before tomorrow.',
          { topic: nextTopicName }
        )
      : t(
          'warmUrgency.nudgeUrgentGeneric',
          'A short focused session today could lock things in before tomorrow.'
        );
  } else if (tier === 'moderate') {
    nudgeText = t(
      'warmUrgency.nudgeModerate',
      "You've got time — a 20-min focus session today keeps your momentum going."
    );
  } else {
    nudgeText = t(
      'warmUrgency.nudgeCalm',
      'No rush — steady practice beats cramming every time.'
    );
  }

  // CTA — completed state offers a practice round; otherwise tier-driven.
  let ctaTitle;
  let ctaSub;
  if (studyComplete) {
    ctaTitle = allLocked
      ? t('warmUrgency.ctaCompletePractice', 'Build my practice round')
      : t('warmUrgency.ctaCompleteFocused', 'Build my focused review');
    ctaSub = estimatedMinutes
      ? t('warmUrgency.ctaCompleteSub', '~{{min}} min · pull it all together', { min: estimatedMinutes })
      : t('warmUrgency.ctaCompleteSubGeneric', 'Pull it all together');
  } else if (tier === 'urgent') {
    ctaTitle = t('warmUrgency.ctaUrgentTitle', 'Quick review: 10 key questions');
    ctaSub = nextTopicName
      ? t('warmUrgency.ctaUrgentSub', '~15 min · focused on {{topic}}', { topic: nextTopicName })
      : t('warmUrgency.ctaUrgentSubGeneric', '~15 min · keep it sharp');
  } else if (tier === 'moderate') {
    ctaTitle = nextTopicName
      ? t('warmUrgency.ctaModerateTitle', 'Focus session: {{topic}}', { topic: nextTopicName })
      : t('warmUrgency.ctaModerateTitleGeneric', 'Focus session');
    ctaSub = t('warmUrgency.ctaModerateSub', '~20 min · build on what you already know');
  } else {
    ctaTitle = t('warmUrgency.ctaCalmTitle', 'Continue studying');
    ctaSub = t('warmUrgency.ctaCalmSub', 'Pick up where you left off');
  }

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

      <div className="wud-journey">
        <div className="wud-journey__row">
          <div className="wud-journey__text">
            <div className="wud-section-label">
              {t('warmUrgency.yourStudyJourney', 'Your study journey')}
            </div>
            <h3 className="wud-journey__headline">{journeyHeadline}</h3>
            <p className="wud-journey__sub">{journeySub}</p>
          </div>

          {topicsTotal > 0 && (
            <div className="wud-journey__progress" aria-hidden="true">
              <div className="wud-journey__dots">
                <span className={`wud-journey__dot wud-journey__dot--locked`}>
                  <CheckIcon />
                </span>
                {remaining > 0 && (
                  <>
                    <span className="wud-journey__dot-line" />
                    <span className="wud-journey__dot wud-journey__dot--ready">
                      <QuestionDotIcon />
                    </span>
                  </>
                )}
              </div>
              <div className="wud-journey__dot-count">
                {topicsCompleted} {t('warmUrgency.ofTotal', 'of')} {topicsTotal}
              </div>
            </div>
          )}
        </div>

        {topicsList.length > 0 && (
          <ul className="wud-topics">
            {topicsList.map((topic) => (
              <li
                key={topic.name}
                className={`wud-topic wud-topic--${topic.status}`}
                title={topic.name}
              >
                <span className="wud-topic__icon">
                  {topic.status === 'locked_in' ? <CheckIcon /> : <SparkIcon />}
                </span>
                <span className="wud-topic__name">{topic.name}</span>
                <span className={`wud-badge wud-badge--${topic.status}`}>
                  {topic.status === 'locked_in'
                    ? t('warmUrgency.lockedInBadge', 'Locked in')
                    : studyComplete
                      ? t('warmUrgency.couldUseRefresh', 'One more pass')
                      : t('warmUrgency.readyToExplore', 'Ready to explore')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className={`wud-cta wud-cta--${tier}`}
        onClick={(e) => {
          e.stopPropagation();
          onCtaClick?.(e);
        }}
      >
        <div className="wud-cta__text">
          <div className="wud-cta__title">{ctaTitle}</div>
          <div className="wud-cta__sub">{ctaSub}</div>
        </div>
        <span className="wud-cta__arrow" aria-hidden="true">
          <ArrowIcon />
        </span>
      </button>
    </div>
  );
};

export default WarmUrgencyDashboard;
