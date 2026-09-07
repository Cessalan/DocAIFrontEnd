import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { buildPlanPreview } from './planPreviewModel';
import { FUNNEL, logFunnelStep, logFunnelStepOnce } from '../../Services/FunnelService';
import './LockedPlanPreview.css';

/**
 * LockedPlanPreview — her plan, shown before she is asked to pay for it.
 *
 * THE CHANGE THIS IS
 *
 * The plan gate used to fire before generation, so a student at 3/3 plans
 * saw an upgrade modal saying she had used her three plans. Five of the ten
 * paying subscribers converted at exactly that moment, which made it the
 * most productive paywall in the product — and it was still selling the
 * wrong thing. "You have run out of plans" names our accounting. It says
 * nothing about the twelve study sessions she was thirty seconds away from.
 *
 * So the order flips. She sees the plan — her topics, ranked by her own
 * diagnostic, sized to her exam date — and only then is asked to unlock it.
 * Same gate, same limit, different question: not "buy more quota" but
 * "continue the thing you are already looking at".
 *
 * WHY IT IS DERIVED, NOT GENERATED
 *
 * We cannot generate a real plan for someone the server will refuse to
 * generate one for, and doing it anyway would spend the most expensive call
 * in the product on a request that gets rejected. Everything on this card
 * therefore comes from planPreviewModel, which mirrors the planner's own
 * shaping arithmetic over data already on the client. See that file for the
 * cross-repo contract this depends on.
 *
 * WHAT IT MUST NOT DO
 *
 * It must not show anything she will not get. No invented lesson titles, no
 * inflated session count, no topic that the calendar has already trimmed
 * out. She is about to pay against this screen; every line on it is a
 * promise, and `trimmed` is rendered rather than hidden for that reason.
 */
const LockedPlanPreview = ({
  topics = [],
  diagnostic = null,
  daysToExam = null,
  onUnlock,
  onClose,
}) => {
  const { t } = useTranslation();

  const preview = buildPlanPreview({ topics, diagnostic, daysToExam });

  useEffect(() => {
    logFunnelStepOnce(FUNNEL.PLAN_PREVIEW_VIEWED, {
      locked: true,
      sessionCount: preview.sessionCount,
      archetype: preview.archetype,
      topicCount: preview.rows.length,
      daysToExam,
    });
  }, [preview.sessionCount, preview.archetype, preview.rows.length, daysToExam]);

  const handleUnlock = () => {
    logFunnelStep(FUNNEL.PAYWALL_CTA_CLICKED, {
      from: 'plan_preview',
      sessionCount: preview.sessionCount,
    });
    onUnlock && onUnlock();
  };

  // The headline names the deadline she gave us. A plan that knows the date
  // is the whole reason the date was worth asking for.
  const headline =
    daysToExam === null || daysToExam === undefined
      ? t('lockedPlan.titleNoDate', 'Your study plan is ready')
      : daysToExam === 0
        ? t('lockedPlan.titleToday', 'Your exam is today — your plan is ready')
        : daysToExam === 1
          ? t('lockedPlan.titleTomorrow', 'Your exam is tomorrow — your plan is ready')
          : t('lockedPlan.titleDays', '{{days}} days until your exam', { days: daysToExam });

  const TIER_LABEL = {
    gap: t('lockedPlan.tiers.gap', 'Needs work'),
    shaky: t('lockedPlan.tiers.shaky', 'Review'),
    untested: t('lockedPlan.tiers.untested', 'To cover'),
    solid: t('lockedPlan.tiers.solid', 'Quick refresh'),
  };

  return (
    <div className="locked-plan">
      <div className="locked-plan__head">
        <p className="locked-plan__eyebrow">{t('lockedPlan.eyebrow', 'Your plan')}</p>
        <h2 className="locked-plan__title">{headline}</h2>
      </div>

      <ul className="locked-plan__rows">
        {preview.rows.map((row, i) => (
          <li key={`${row.topic}-${i}`} className={`locked-plan__row is-${row.tier}`}>
            <span className="locked-plan__row-main">
              <span className="locked-plan__topic">{row.topic}</span>
              <span className="locked-plan__tier">
                {TIER_LABEL[row.tier]}
                {/* Her actual diagnostic score, when there is one. This is the
                    line that proves the ordering was earned rather than
                    decorative. */}
                {row.percent !== null && row.percent !== undefined && (
                  <span className="locked-plan__score">
                    {t('lockedPlan.scored', '· you scored {{percent}}%', { percent: Math.round(row.percent) })}
                  </span>
                )}
              </span>
            </span>
            <span className="locked-plan__count">
              {t('lockedPlan.sessionCount', { count: row.nodeCount })}
            </span>
          </li>
        ))}
      </ul>

      <div className="locked-plan__summary">
        <strong>{t('lockedPlan.totalSessions', { count: preview.sessionCount })}</strong>
        <span>{t('lockedPlan.totalMinutes', { count: preview.estimatedMinutes })}</span>
      </div>

      {/* Said out loud rather than hidden: a sprint plan genuinely cannot
          cover everything, and a student who later notices a missing topic
          should have been told here, not discover it mid-plan. */}
      {preview.trimmed > 0 && (
        <p className="locked-plan__trimmed">
          {t('lockedPlan.trimmed', { count: preview.trimmed })}
        </p>
      )}

      <div className="locked-plan__gate">
        <p className="locked-plan__gate-copy">
          {t('lockedPlan.gateCopy', "You've got a lot to learn — but not everything matters equally. This plan is ordered by what your exam is most likely to test and what you actually missed.")}
        </p>
        <button type="button" className="locked-plan__cta" onClick={handleUnlock}>
          <span className="locked-plan__lock" aria-hidden="true">🔒</span>
          {t('lockedPlan.cta', 'Unlock my study plan')}
        </button>
        <button type="button" className="locked-plan__later" onClick={onClose}>
          {t('lockedPlan.later', 'Not now')}
        </button>
      </div>
    </div>
  );
};

export default LockedPlanPreview;
