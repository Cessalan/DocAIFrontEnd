import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getStepTopicLabel } from './planFormatting';
import { getStudyNodeIcon } from './planNodeIcon';
import { buildMissionArc } from './missionArc';
import { gradedQuestionCount } from './readinessProjection';

/**
 * TodaySessionCard — today's mission, framed as an OUTCOME.
 *
 * WHY: plans generate 15–20 nodes, and production data shows the median
 * student completes ONE. Plan length doesn't predict whether they get past
 * node 1, but a 20-row wall does set the felt size of the commitment.
 *
 * The card reads top-to-bottom as a coach talking, not a dashboard reporting:
 *
 *     what we're doing today  →  why it's worth it  →  the shape of the session
 *                             →  one action  →  what it gets you
 *
 * That last beat is the point. This card used to end on "15-step plan · see
 * all" and "11 more steps, spread over your remaining 19 days" — both facts
 * about the SYSTEM. A student doesn't care that there are 15 steps; they care
 * whether they'll be ready. So the footer is a readiness projection instead:
 * finishing this session moves a number they recognise. Action → outcome.
 *
 * There is exactly ONE actionable control. The old per-node list put a CTA
 * inside a row and rendered the other rows inert, which made the card look
 * like a menu where only one item worked. Now the beats summarise and the
 * button acts.
 *
 * Behavioural levers still in play:
 *   - GOAL GRADIENT: the arc advances visibly per beat rather than per 1/16th
 *     of a plan.
 *   - ENDOWED PROGRESS: the plan arrives already tuned by onboarding, and says
 *     so. People finish what looks already started.
 *   - A DEADLINE: "Day 3 of 20" makes the slice obviously today's.
 *
 * Window from `buildStudySchedule`, numbers from `projectReadiness`, beats from
 * `buildMissionArc`. This component is presentational.
 *
 * @param {Object}   schedule      - from buildStudySchedule()
 * @param {Object}   projection    - from projectReadiness()
 * @param {Function} onNodeSelect  - (node) => start/resume that node
 * @param {boolean}  [planTuned]   - Show the endowed "tuned for you" note
 * @param {boolean}  [expanded]    - Whether the full plan is currently shown
 * @param {Function} onToggleFull  - Toggle the full plan list
 */

const PHASE_COPY = {
  learn: ['study.arcLearn', 'Learn'],
  practice: ['study.arcPractice', 'Practice'],
  review: ['study.arcReview', 'Review'],
};

const TodaySessionCard = ({
  schedule,
  projection = null,
  onNodeSelect,
  planTuned = true,
  expanded = false,
  onToggleFull,
}) => {
  const { t } = useTranslation();

  const {
    missionNodes = [],
    missionSize = 0,
    remainingMissionMinutes = 0,
    missionComplete = false,
    allDone = false,
    totalNodes = 0,
    remainingNodes = 0,
    nextUpNodes = [],
    hasExam = false,
    phase = 'none',
    dayIndex = null,
    totalDays = null,
    onTrack = true,
    examAt = null,
  } = schedule || {};

  const {
    hasData: hasReadiness = false,
    currentPct = null,
    todayPct = null,
    planPct = null,
    movesToday = false,
    focusTopic = null,
    focusLevel = null,
  } = projection || {};

  const primary = useMemo(
    () => missionNodes.find(n => n.status !== 'done') || null,
    [missionNodes]
  );

  const arc = useMemo(
    () => buildMissionArc(missionNodes, primary?.id),
    [missionNodes, primary]
  );

  // Does today produce any graded answers? Drives the copy shown to students
  // who have no readiness score yet.
  const missionHasGraded = useMemo(
    () => missionNodes.some(n => gradedQuestionCount(n.type) > 0),
    [missionNodes]
  );

  // Subtopics the session actually covers, from node tags. Real detail beats a
  // restated title — but tags are LLM-supplied and often absent, so this whole
  // line is optional rather than faked from the topic name.
  const focusTags = useMemo(() => {
    const seen = [];
    for (const n of missionNodes) {
      for (const tag of n.tags || []) {
        const clean = (tag || '').trim();
        if (clean && !seen.some(s => s.toLowerCase() === clean.toLowerCase())) {
          seen.push(clean);
        }
        if (seen.length === 3) return seen;
      }
    }
    return seen;
  }, [missionNodes]);

  // Distinct topics in tomorrow's slice — the return hook. A finished day that
  // ends in a full stop gives no reason to come back.
  const nextTopics = useMemo(() => {
    const seen = [];
    for (const n of nextUpNodes) {
      const label = getStepTopicLabel(n.label);
      if (label && !seen.includes(label)) seen.push(label);
      if (seen.length === 2) break;
    }
    return seen;
  }, [nextUpNodes]);

  if (allDone || missionSize === 0) return null;

  const eyebrow =
    phase === 'examDay'
      ? t('study.examDayReview', 'Exam day · final review')
      : phase === 'final'
        ? t('study.finalPrep', 'Final prep')
        : t('study.todayMission', "Today's mission");

  const dayLabel =
    hasExam && dayIndex && totalDays
      ? t('study.dayXofY', 'Day {{day}} of {{total}}', { day: dayIndex, total: totalDays })
      : null;

  // ── Mission complete ─────────────────────────────────────────────────
  // The day's slice is done but the plan isn't. This is where the daily loop
  // closes: pay off the work with the new number, then name tomorrow.
  if (missionComplete) {
    const examLabel = examAt
      ? examAt.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
      : null;

    return (
      <div className="tsc tsc--complete">
        <div className="tsc__done-head">
          <span className="tsc__done-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <polyline points="4 12.5 9.5 18 20 6" />
            </svg>
          </span>
          <div className="tsc__done-text">
            <p className="tsc__done-title">
              {t('study.missionComplete', "Today's mission complete")}
            </p>
            <p className="tsc__done-sub">
              {hasReadiness && currentPct != null
                ? t('study.nowReady', "You're now at {{pct}}% estimated readiness.", { pct: currentPct })
                : hasExam && examLabel
                  ? onTrack
                    ? t('study.onTrackFor', "You're on track to be ready by {{date}}.", { date: examLabel })
                    : t('study.everyDayCounts', 'Every session closes the gap before {{date}}.', { date: examLabel })
                  : t('study.comeBackTomorrow', 'Nice work — pick it back up tomorrow.')}
            </p>
          </div>
        </div>

        {nextTopics.length > 0 && (
          <div className="tsc__next">
            <span className="tsc__next-label">
              {t('study.tomorrowFocus', 'Tomorrow')}
            </span>
            <span className="tsc__next-topics">{nextTopics.join(' · ')}</span>
          </div>
        )}

        {/* Studying on is always allowed — the mission is a floor, not a cap. */}
        {remainingNodes > 0 && (
          <button
            type="button"
            className="tsc__keep-going"
            onClick={() => {
              const next = nextUpNodes.find(n => n.status !== 'done');
              if (next) onNodeSelect?.(next);
            }}
          >
            {t('study.keepGoing', 'Keep going anyway')}
          </button>
        )}
      </div>
    );
  }

  // ── Why today is worth doing ─────────────────────────────────────────
  // Said in terms of the student's standing on this topic, not the node type.
  // Omitted when we have nothing true to say — a generic "Let's study!" is
  // worse than silence.
  let whyLine = null;
  if (phase === 'examDay') {
    whyLine = t('study.whyExamDay', "Reviewing what you're most likely to miss — nothing new today.");
  } else if (phase === 'final') {
    whyLine = t('study.whyFinal', 'Consolidating what you already half-know is what pays off now.');
  } else if (focusLevel === 'untested') {
    whyLine = t('study.whyUntested', "You haven't been tested on this yet — today gives you a real score on it.");
  } else if (focusLevel === 'weak') {
    whyLine = t('study.whyWeak', "This is one of your weaker areas, so it's where today buys you the most.");
  } else if (focusLevel === 'developing') {
    whyLine = t('study.whyDeveloping', "You're close on this one. Today should tip it over.");
  } else if (focusLevel === 'strong') {
    whyLine = t('study.whyStrong', 'A quick pass to keep this one sharp.');
  }

  const headline = focusTopic || getStepTopicLabel(primary?.label) || null;

  // Medallion glyph = the beat the student is actually in, so the art always
  // matches the work. (Deliberately NOT a topic illustration: topics come from
  // whatever the student uploaded, so any per-topic artwork would be guessing.)
  const activeArc = arc.find(a => a.status === 'active') || arc[0];

  const ctaLabel = primary?.nodeProgress > 0
    ? t('study.continueMission', 'Continue mission')
    : t('study.startMission', 'Start mission');

  return (
    <div className={`tsc tsc--${phase}`}>
      <div className="tsc__head">
        <span className="tsc__eyebrow">{eyebrow}</span>
        <span className="tsc__meta">
          {dayLabel && <span className="tsc__day">{dayLabel}</span>}
          {remainingMissionMinutes > 0 && (
            <span className="tsc__minutes">
              {t('study.aboutMinutes', '~{{min}} min', { min: remainingMissionMinutes })}
            </span>
          )}
        </span>
      </div>

      {/* ── What we're doing, and why ── */}
      <div className="tsc__focus">
        {activeArc && (
          <span className="tsc__medallion" aria-hidden="true">
            {getStudyNodeIcon(activeArc.iconType)}
          </span>
        )}
        <div className="tsc__focus-text">
          {headline && <h3 className="tsc__focus-topic">{headline}</h3>}
          {focusTags.length > 0 && (
            <p className="tsc__focus-tags">
              {t('study.focusPrefix', 'Focus:')} {focusTags.join(', ')}
            </p>
          )}
          {whyLine && <p className="tsc__focus-why">{whyLine}</p>}
        </div>
      </div>

      {/* ── The shape of the session ── */}
      {arc.length > 0 && (
        <ol className="tsc__arc">
          {arc.map((beat, i) => {
            const [key, fallback] = PHASE_COPY[beat.key];
            return (
              <li key={beat.key} className={`tsc__beat is-${beat.status}`}>
                <span className="tsc__beat-icon" aria-hidden="true">
                  {getStudyNodeIcon(beat.iconType, beat.status === 'done' ? 'done' : undefined)}
                </span>
                <span className="tsc__beat-name">{t(key, fallback)}</span>
                <span className="tsc__beat-min">
                  {t('study.aboutMinutes', '~{{min}} min', { min: beat.minutes })}
                </span>
                {i < arc.length - 1 && (
                  <span className="tsc__beat-sep" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                         strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                      <path d="M5 12h13M12 6l6 6-6 6" />
                    </svg>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* ── The one action ── */}
      <button
        type="button"
        className="tsc__cta"
        onClick={() => primary && onNodeSelect?.(primary)}
      >
        <span className="tsc__cta-label">{ctaLabel}</span>
        <svg className="tsc__cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="17" height="17" aria-hidden="true">
          <path d="M5 12h13M12 6l6 6-6 6" />
        </svg>
      </button>

      {/* ── What it gets you ──
          The replacement for the old step-count footer. Only rendered with a
          real number behind it; see readinessProjection.js for the model. */}
      {hasReadiness && movesToday && currentPct != null && todayPct != null && (
        <div className="tsc__outcome">
          <span className="tsc__outcome-spark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
            </svg>
          </span>
          <span className="tsc__outcome-text">
            {t('study.completeToRaise', "Complete today's mission")}{' '}
            {/* Both numbers, not just the destination: the jump is the point,
                and it has to be legible without cross-referencing the ring. */}
            <strong className="tsc__outcome-pct">
              {t('study.readinessJump', '{{from}}% → {{to}}%', { from: currentPct, to: todayPct })}
            </strong>{' '}
            {t('study.estimatedReadiness', 'estimated readiness')}
          </span>
        </div>
      )}

      {/* First-timers have no score to move yet, but today's quiz creates one.
          Saying so is honest and still an outcome — better than the silence
          that a numbers-only footer would leave here. */}
      {!hasReadiness && missionHasGraded && (
        <div className="tsc__outcome tsc__outcome--soft">
          <span className="tsc__outcome-text">
            {t('study.firstScore', "Today's practice gives you your first readiness score.")}
          </span>
        </div>
      )}

      {/* Today doesn't move the score (no graded node in the slice), but the
          plan still lands somewhere — so point at that rather than going quiet. */}
      {hasReadiness && !movesToday && planPct != null && currentPct != null && planPct > currentPct + 2 && (
        <div className="tsc__outcome tsc__outcome--soft">
          <span className="tsc__outcome-text">
            {t('study.groundworkToday', "Groundwork today — finishing your plan puts you near {{pct}}% estimated readiness.", { pct: planPct })}
          </span>
        </div>
      )}

      {/* Reference material, deliberately quiet and last. */}
      {totalNodes > missionNodes.length && (
        <button type="button" className="tsc__toggle" onClick={onToggleFull} aria-expanded={expanded}>
          <span>
            {expanded
              ? t('study.hideFullPlan', 'Hide full plan')
              : t('study.seeWholePlan', 'See the whole plan')}
          </span>
          <svg
            className={`tsc__chev${expanded ? ' is-open' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {planTuned && (
        <p className="tsc__tuned-note">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6"
               strokeLinecap="round" strokeLinejoin="round" width="11" height="11" aria-hidden="true">
            <polyline points="3 8.5 6.5 12 13 4.5" />
          </svg>
          {t('study.tunedFromAnswers', 'Tuned from your onboarding answers')}
        </p>
      )}
    </div>
  );
};

export default TodaySessionCard;
