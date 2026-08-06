import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PLANS, startCheckout, openBillingPortal } from '../../config/billing';
import { daysUntilExam } from './upgradeCopy';
import { formatCountdown } from '../../Services/UsageService';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import './UpgradeModal.css';

/**
 * UpgradeModal
 * Shown when a free user has exhausted their question budget for the current
 * 3-hour window, or when they tap the usage badge. Communicates the wait
 * ("next batch in H:MM:SS") and offers the two Pro plans.
 *
 * Checkout is delegated to `startCheckout(planId, user)` in config/billing.js.
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {number} limit         - questions per window (for copy)
 * @param {number} remaining     - questions left this window (0 = out)
 * @param {number} msUntilReset  - ms until the bucket refills (live countdown)
 * @param {{ uid?: string, email?: string }} [user]
 * @param {string} [studyGoal]   - onboarding goal: 'NCLEX Prep' | 'Course Exam' | 'General Review'
 * @param {string} [examDate]    - ISO exam date, for urgency copy (optional)
 * @param {boolean} [isPro]      - already subscribed: show manage/cancel instead of the pitch
 */

const UpgradeModal = ({
  isOpen, onClose, limit = 50, remaining = Infinity, msUntilReset = 0,
  user = {}, studyGoal = null, examDate = null, isPro = false,
  reason = null, planLimit = 3, plansRemaining = Infinity, planMsUntilReset = 0,
}) => {
  const { t } = useTranslation();
  const [portalLoading, setPortalLoading] = useState(false);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    const redirected = await openBillingPortal();
    if (!redirected) setPortalLoading(false);
  };

  // ── Already Pro: manage/cancel instead of the upgrade pitch ───────────────
  // Stripe's hosted Billing Portal handles cancellation; the webhook then
  // flips the tier back to free.
  if (isPro) {
    return (
      <div className="upgrade-overlay" onClick={handleOverlayClick}>
        <div className="upgrade-modal" role="dialog" aria-modal="true">
          <button className="upgrade-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="upgrade-icon" aria-hidden="true">
            <NurseQuizMascot size={84} isExcited lookDirection="center" />
          </div>

          <h2 className="upgrade-title">{t('upgrade.proTitle', "You're on Pro")}</h2>

          <p className="upgrade-body">
            {t('upgrade.proBody', 'Unlimited practice, uploads, and weak-spot reviews — you have it all. Manage your plan, update payment details, or cancel anytime.')}
          </p>

          <div className="upgrade-plans">
            <button
              className="upgrade-plan is-recommended"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              <span className="upgrade-plan-name">
                {portalLoading
                  ? t('upgrade.portalOpening', 'Opening…')
                  : t('upgrade.manage', 'Manage subscription')}
              </span>
              <span className="upgrade-plan-sub">
                {t('upgrade.manageSub', 'Change plan, update card, or cancel')}
              </span>
            </button>
          </div>

          <button className="upgrade-wait" onClick={onClose}>
            {t('upgrade.close', 'Close')}
          </button>
        </div>
      </div>
    );
  }

  // Which meter opened this? The plan gate and the question throttle are
  // different promises, so they get different copy — telling someone who
  // wanted a new subject that they're "out of questions" reads as a bug.
  const isPlanGate = reason === 'plans';

  // "Blocked" = actually out of budget on whichever meter fired. Opening the
  // modal proactively (badge tap with budget left) shows the marketing pitch.
  const blocked = isPlanGate ? plansRemaining <= 0 : remaining <= 0;

  // ── Personalization from onboarding (all fallback-safe) ──────────────────
  // Goal → headline. Exam date → urgency woven into the subtext.
  const title =
    studyGoal === 'NCLEX Prep' ? t('upgrade.titleNclex', 'Pass your NCLEX without limits')
    : studyGoal === 'Course Exam' ? t('upgrade.titleCourse', 'Ace your course exam')
    : t('upgrade.title', 'Study without limits');

  const daysAway = daysUntilExam(examDate);
  const examSoon = daysAway != null && daysAway <= 30;
  const whenLabel = daysAway === 0
    ? t('upgrade.examToday', 'today')
    : daysAway === 1
      ? t('upgrade.examTomorrow', 'tomorrow')
      : t('upgrade.examInDays', 'in {{days}} days', { days: daysAway });

  let subtitle;
  if (isPlanGate) {
    subtitle = blocked
      ? (examSoon
          ? t('upgrade.bodyPlanBlockedExam', "You've started your {{count}} study plans for this month — and your exam is {{when}}. Go unlimited and add every subject you're carrying.", { count: planLimit, when: whenLabel })
          : t('upgrade.bodyPlanBlocked', "You've started your {{count}} study plans for this month. Pro lets you add a plan for every subject you're taking.", { count: planLimit }))
      : t('upgrade.bodyPlan', 'Pro lets you run a study plan for every subject you’re taking, not just a few.');
  } else if (blocked) {
    subtitle = examSoon
      ? t('upgrade.bodyBlockedExam', "You've used your {{limit}} questions for this 3-hour window — and your exam is {{when}}. Don't lose momentum: go unlimited.", { limit, when: whenLabel })
      : t('upgrade.bodyBlocked', "You've used your {{limit}} questions for this 3-hour window. Keep your momentum going — practice as much as you need to be ready.", { limit });
  } else {
    subtitle = examSoon
      ? t('upgrade.bodyExam', "Your exam is {{when}} — don't let a question limit slow your final push. Practice unlimited.", { when: whenLabel })
      : t('upgrade.body', 'Master every topic, find your weak spots faster, and walk into your exam ready — with unlimited practice.');
  }

  return (
    <div className="upgrade-overlay" onClick={handleOverlayClick}>
      <div className="upgrade-modal" role="dialog" aria-modal="true">
        <button className="upgrade-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="upgrade-icon" aria-hidden="true">
          <NurseQuizMascot size={84} isExcited lookDirection="center" />
        </div>

        <h2 className="upgrade-title">{title}</h2>

        <p className="upgrade-body">{subtitle}</p>

        {/* Countdown. Demoted when the exam is close — "wait 3 hours" is not a
            real option the night before, and giving it equal weight to the
            plans costs conversions at the only moment that matters. */}
        {blocked && !examSoon && (
          <div className="upgrade-countdown" aria-live="polite">
            <span className="upgrade-countdown-label">
              {isPlanGate
                ? t('upgrade.nextPlanIn', 'Or wait — next plan unlocks in')
                : t('upgrade.nextBatch', 'Or wait — next batch in')}
            </span>
            <span className="upgrade-countdown-time">
              {formatCountdown(isPlanGate ? planMsUntilReset : msUntilReset)}
            </span>
          </div>
        )}

        {/* Free vs Pro — framed around outcomes, not features */}
        <div className="upgrade-compare">
          <div className="upgrade-compare-row upgrade-compare-head">
            <span className="upgrade-compare-feature" />
            <span className="upgrade-compare-free">{t('upgrade.cmp.free', 'Free')}</span>
            <span className="upgrade-compare-pro">{t('upgrade.cmp.pro', 'Pro')}</span>
          </div>

          <div className="upgrade-compare-row">
            <span className="upgrade-compare-feature">{t('upgrade.cmp.plans', 'Study plans')}</span>
            <span className="upgrade-compare-free">
              {t('upgrade.cmp.plansPerMonth', '{{count}} / month', { count: planLimit })}
            </span>
            <span className="upgrade-compare-pro">{t('upgrade.cmp.unlimited', 'Unlimited')}</span>
          </div>

          <div className="upgrade-compare-row">
            <span className="upgrade-compare-feature">{t('upgrade.cmp.practice', 'Practice every topic')}</span>
            <span className="upgrade-compare-free">{t('upgrade.cmp.perHour', '{{limit}} / 3 hrs', { limit })}</span>
            <span className="upgrade-compare-pro">{t('upgrade.cmp.unlimited', 'Unlimited')}</span>
          </div>

          <div className="upgrade-compare-row">
            <span className="upgrade-compare-feature">{t('upgrade.cmp.uploads', 'Upload your notes')}</span>
            <span className="upgrade-compare-free">{t('upgrade.cmp.onePerChat', '1 per chat')}</span>
            <span className="upgrade-compare-pro">{t('upgrade.cmp.unlimited', 'Unlimited')}</span>
          </div>

          <div className="upgrade-compare-row">
            <span className="upgrade-compare-feature">{t('upgrade.cmp.weakSpots', 'Find your weak spots')}</span>
            <span className="upgrade-compare-free">{t('upgrade.cmp.hourlyCap', '3-hour limit')}</span>
            <span className="upgrade-compare-pro">{t('upgrade.cmp.anytime', 'Anytime')}</span>
          </div>

          <div className="upgrade-compare-row">
            <span className="upgrade-compare-feature">{t('upgrade.cmp.momentum', 'Keep your momentum')}</span>
            <span className="upgrade-compare-free">{t('upgrade.cmp.pausesAt', 'Pauses at {{limit}}', { limit })}</span>
            <span className="upgrade-compare-pro">{t('upgrade.cmp.neverBreaks', 'Never breaks')}</span>
          </div>

          <div className="upgrade-compare-row">
            <span className="upgrade-compare-feature">{t('upgrade.cmp.readyFaster', 'Get exam-ready faster')}</span>
            <span className="upgrade-compare-free">{t('upgrade.cmp.slower', 'Slowed by waits')}</span>
            <span className="upgrade-compare-pro">{t('upgrade.cmp.fullSpeed', 'Full speed')}</span>
          </div>
        </div>

        <div className="upgrade-plans">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              className={`upgrade-plan ${plan.recommended ? 'is-recommended' : ''}`}
              onClick={() => startCheckout(plan.id, user)}
            >
              {plan.recommended && (
                <span className="upgrade-plan-badge">
                  {t('upgrade.bestValue', 'Best value')}
                </span>
              )}
              <span className="upgrade-plan-name">
                {plan.id === 'annual' ? t('upgrade.annual', 'Annual') : t('upgrade.monthly', 'Monthly')}
              </span>
              <span className="upgrade-plan-price">
                <span className="upgrade-plan-amount">{plan.symbol || '$'}{plan.amount}</span>
                <span className="upgrade-plan-interval">/{plan.interval === 'year' ? t('upgrade.yr', 'yr') : t('upgrade.mo', 'mo')}</span>
              </span>
              {plan.interval === 'year' ? (
                <span className="upgrade-plan-sub">
                  {t('upgrade.perMonthSave', 'CA${{perMonth}}/mo · save {{savePct}}%', { perMonth: plan.perMonth, savePct: plan.savePct })}
                </span>
              ) : (
                <span className="upgrade-plan-sub">
                  {t('upgrade.billedMonthly', 'Billed monthly')}
                </span>
              )}
            </button>
          ))}
        </div>

        <button className="upgrade-wait" onClick={onClose}>
          {blocked ? t('upgrade.wait', "I'll wait") : t('upgrade.notNow', 'Not now')}
        </button>

        {/* When the countdown is demoted (exam within 30 days) it still has to
            be reachable — hiding the free path entirely would be dishonest. */}
        {blocked && examSoon && (
          <p className="upgrade-countdown-inline" aria-live="polite">
            {isPlanGate
              ? t('upgrade.nextPlanInline', 'Next free plan in {{time}}', { time: formatCountdown(planMsUntilReset) })
              : t('upgrade.nextBatchInline', 'Next free questions in {{time}}', { time: formatCountdown(msUntilReset) })}
          </p>
        )}
      </div>
    </div>
  );
};

export default UpgradeModal;
