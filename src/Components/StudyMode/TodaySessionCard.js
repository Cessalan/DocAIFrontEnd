import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getStepTopicLabel, formatNodeType } from './planFormatting';
import { gradedQuestionCount } from './readinessProjection';
import { nextStep, supportLine } from './todayCardModel';

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
 * 2026-11-16: the card was trimmed to the topic, the next step, one button and
 * ONE reason (todayCardModel.js). The focus tags, the Learn/Practice/Review
 * strip and the tuned note are gone, and the topics panel that sat above the
 * card is now its first line, "Topic 2 of 5". Her topics themselves, and the
 * way to switch between them, are the full plan under the card: one list, not
 * a list of topics in the card and the same topics again as sections below
 * it. The overview was answering "what do I do now" three times.
 *
 * There is exactly ONE actionable control. The old per-node list put a CTA
 * inside a row and rendered the other rows inert, which made the card look
 * like a menu where only one item worked. Now the beats summarise and the
 * button acts.
 *
 * Behavioural levers still in play:
 *   - GOAL GRADIENT: one named next step with its minutes, not 1/16th of a plan.
 *   - A DEADLINE: "Day 3 of 20" makes the slice obviously today's.
 *
 * Window from `buildStudySchedule`, numbers from `projectReadiness`, the step and
 * the one reason from `todayCardModel`. This component is presentational.
 *
 * @param {Object}   schedule      - from buildStudySchedule()
 * @param {Object}   projection    - from projectReadiness()
 * @param {Function} onNodeSelect  - (node) => start/resume that node
 * @param {boolean}  [expanded]    - Whether the full plan is currently shown
 * @param {Function} onToggleFull  - Toggle the full plan list
 */

const TodaySessionCard = ({
  schedule,
  projection = null,
  onNodeSelect,
  expanded = false,
  onToggleFull,
  // Her topics (topicJourneyModel), for "Topic 2 of 5".
  journey = null,
}) => {
  const { t } = useTranslation();

  const {
    missionNodes = [],
    missionSize = 0,
    remainingMissionMinutes = 0,
    missionComplete = false,
    allDone = false,
    totalNodes = 0,
    completedCount = 0,
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
  } = projection || {};

  const step = useMemo(() => nextStep(missionNodes, completedCount), [missionNodes, completedCount]);
  const primary = step?.node || null;

  // Does today produce any graded answers? Drives the copy shown to students
  // who have no readiness score yet.
  const missionHasGraded = useMemo(
    () => missionNodes.some(n => gradedQuestionCount(n.type) > 0),
    [missionNodes]
  );

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

  // "Topic 2 of 5". Only when there is more than one.
  const currentTopic = journey && journey.total >= 2 ? journey.topics[journey.currentIndex] : null;
  const topicToggle = currentTopic ? (
    <span className="tsc__eyebrow tsc__eyebrow--topic">
      {t('topicJourney.position', 'Topic {{number}} of {{total}}', { number: journey.currentIndex + 1, total: journey.total })}
    </span>
  ) : null;
  const planToggle = totalNodes > missionNodes.length ? (
    <button type="button" className="tsc__toggle" onClick={onToggleFull} aria-expanded={expanded}>
      <span>
        {expanded
          ? t('study.hideFullPlan', 'Hide full plan')
          : t('study.seePlanProgress', 'See full plan · {{done}} of {{total}} steps done', { done: completedCount, total: totalNodes })}
      </span>
      <svg className={`tsc__chev${expanded ? ' is-open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
    </button>
  ) : null;

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
        {topicToggle && <div className="tsc__head">{topicToggle}</div>}
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
        {planToggle}
      </div>
    );
  }

  // One reason, chosen in todayCardModel: a real number first, otherwise the
  // one sentence that is true of her. Nothing when there is nothing to say.
  const support = supportLine({ phase, projection, missionHasGraded });

  const headline = currentTopic?.topic || getStepTopicLabel(primary?.label) || null;

  return (
    <div className={`tsc tsc--${phase}`}>
      <div className="tsc__head">
        {topicToggle || <span className="tsc__eyebrow">{eyebrow}</span>}
        <span className="tsc__meta">
          {dayLabel && <span className="tsc__day">{dayLabel}</span>}
          {remainingMissionMinutes > 0 && (
            <span className="tsc__minutes">
              {t('study.aboutMinutes', '~{{min}} min', { min: remainingMissionMinutes })}
            </span>
          )}
        </span>
      </div>

      {/* ── What she is on, and the step the button opens ── */}
      <div className="tsc__focus tsc__focus--plain">
        <div className="tsc__focus-text">
          {headline && <h3 className="tsc__focus-topic">{headline}</h3>}
          {step && (
            <p className="tsc__next-step">
              {t('study.nextStepLine', 'Next: {{step}}, about {{min}} min.', { step: formatNodeType(primary.type, t), min: step.minutes })}
            </p>
          )}
          {support && <p className="tsc__focus-why">{t(support.key, support.fallback, support.params)}</p>}
        </div>
      </div>

      {/* ── The one action ── */}
      <button
        type="button"
        className="tsc__cta"
        onClick={() => primary && onNodeSelect?.(primary)}
      >
        <span className="tsc__cta-label">
          {step?.started ? t('study.nextContinue', 'Continue') : t('study.nextStart', 'Start')}
        </span>
        <svg className="tsc__cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="17" height="17" aria-hidden="true">
          <path d="M5 12h13M12 6l6 6-6 6" />
        </svg>
      </button>

      {/* Reference material, deliberately quiet and last. */}
      {planToggle}
    </div>
  );
};

export default TodaySessionCard;
