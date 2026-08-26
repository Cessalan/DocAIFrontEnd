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
 * 3-hour window, when the study-plan meter is empty, or when they tap the
 * usage badge.
 *
 * Structure, top to bottom — this order is the pitch and is deliberate:
 *   1. what they were in the middle of  (the thing being interrupted)
 *   2. what they've already done today  (sunk momentum, not sunk cost)
 *   3. what Pro gets them, as OUTCOMES  (not a feature checklist)
 *   4. one price, one CTA
 *   5. the free path, de-emphasized below the fold of the decision
 *
 * The earlier free-vs-Pro comparison table sold capabilities ("1 per chat",
 * "3-hour limit"), which asks the student to do the translation work into
 * "…and therefore I'll do better on my exam". The outcome grid does that
 * translation for them.
 *
 * Checkout is delegated to `startCheckout(planId, user)` in config/billing.js.
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {number} limit         - questions per window (for copy)
 * @param {number} used          - questions already spent this window
 * @param {number} remaining     - questions left this window (0 = out)
 * @param {number} msUntilReset  - ms until the bucket refills (live countdown)
 * @param {{ uid?: string, email?: string }} [user]
 * @param {string} [studyGoal]   - onboarding goal: 'NCLEX Prep' | 'Course Exam' | 'General Review'
 * @param {string} [examDate]    - ISO exam date, for urgency copy (optional)
 * @param {string} [topic]       - what they were working on when we interrupted them
 * @param {boolean} [isPro]      - already subscribed: show manage/cancel instead of the pitch
 */

/* ── Icons ────────────────────────────────────────────────────────────────
   Inline so the modal has no icon-library dependency and no network cost at
   the one moment where a slow render costs money. */
const svgProps = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round',
};

const IconInfinity = () => (
  <svg {...svgProps}><path d="M6.5 8.5a3.5 3.5 0 1 0 0 7c2.5 0 3.5-2 5.5-3.5s3-3.5 5.5-3.5a3.5 3.5 0 1 1 0 7c-2.5 0-3.5-2-5.5-3.5S9 8.5 6.5 8.5Z" /></svg>
);
const IconCalendar = () => (
  <svg {...svgProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M8 15h3" /></svg>
);
const IconUpload = () => (
  <svg {...svgProps}><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16" /></svg>
);
const IconBolt = () => (
  <svg {...svgProps}><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" /></svg>
);
const IconTarget = () => (
  <svg {...svgProps}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>
);
const IconBrain = () => (
  <svg {...svgProps}>
    <path d="M12 5.2A2.7 2.7 0 0 0 7 4a2.5 2.5 0 0 0-2.3 3.6A2.6 2.6 0 0 0 4.9 12a2.6 2.6 0 0 0 4.3 3.4L12 17.6" />
    <path d="M12 5.2A2.7 2.7 0 0 1 17 4a2.5 2.5 0 0 1 2.3 3.6A2.6 2.6 0 0 1 19.1 12a2.6 2.6 0 0 1-4.3 3.4" />
    <path d="M12 5.2v13.6" />
  </svg>
);
const IconClipboard = () => (
  <svg {...svgProps}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><path d="M9 11h6M9 15h4" /></svg>
);
const IconTrophy = () => (
  <svg {...svgProps}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4.5v1A3.5 3.5 0 0 0 8 10.5M17 6h2.5v1a3.5 3.5 0 0 1-3.5 3.5" /><path d="M12 14v3M9 20h6M10 17h4" /></svg>
);
const IconLock = () => (
  <svg {...svgProps}><rect x="4.5" y="10" width="15" height="10.5" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></svg>
);
const IconSpark = () => (
  <svg {...svgProps}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);

/* Outcome first, mechanism second — the bold line is what they get, the small
   line is only there to make the promise believable. */
const OUTCOMES = [
  { key: 'practice',  Icon: IconInfinity, title: 'Practice until it clicks',       sub: 'No limits, no waiting' },
  { key: 'plans',     Icon: IconCalendar, title: 'A plan for every exam',          sub: 'Built around your exam date' },
  { key: 'uploads',   Icon: IconUpload,   title: 'Your notes become questions',    sub: "Study what's actually on your test" },
  { key: 'faster',    Icon: IconBolt,     title: 'Get exam-ready sooner',          sub: "Practice what you're weakest at" },
  { key: 'weakSpots', Icon: IconTarget,   title: 'Turn weak spots into strengths', sub: "We track them so you don't have to" },
  { key: 'nextStep',  Icon: IconBrain,    title: 'Know what to study next',        sub: 'Never waste a study session' },
];

const fmtAmount = (n) => (Number.isInteger(n) ? String(n) : Number(n).toFixed(2));

const UpgradeModal = ({
  isOpen, onClose, limit = 50, used = 0, remaining = Infinity, msUntilReset = 0,
  user = {}, studyGoal = null, examDate = null, topic = null, isPro = false,
  reason = null, planLimit = 3, plansRemaining = Infinity, planMsUntilReset = 0,
}) => {
  const { t } = useTranslation();
  const [portalLoading, setPortalLoading] = useState(false);

  const monthly = PLANS.find((p) => p.interval === 'month') || PLANS[0] || null;
  const annual = PLANS.find((p) => p.interval === 'year') || null;

  // Default to monthly: it's the lowest-commitment yes. Annual is offered as a
  // one-tap swap rather than a second competing button, so the CTA stays single.
  const [annualSelected, setAnnualSelected] = useState(false);
  const selected = (annualSelected && annual) || monthly;

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
  const daysAway = daysUntilExam(examDate);
  const examSoon = daysAway != null && daysAway <= 30;
  const whenLabel = daysAway === 0
    ? t('upgrade.examToday', 'today')
    : daysAway === 1
      ? t('upgrade.examTomorrow', 'tomorrow')
      : t('upgrade.examInDays', 'in {{days}} days', { days: daysAway });

  // Headline: interruption first when we actually blocked them, goal-based
  // aspiration when they opened this themselves.
  let title;
  if (blocked && isPlanGate) {
    title = t('upgrade.titlePlanBlocked', "You've got more exams to prepare for.");
  } else if (blocked) {
    title = t('upgrade.titleBlocked', "Don't stop now. 🔥");
  } else if (studyGoal === 'NCLEX Prep') {
    title = t('upgrade.titleNclex', 'Pass your NCLEX with room to spare');
  } else if (studyGoal === 'Course Exam') {
    title = t('upgrade.titleCourse', 'Ace your course exam');
  } else {
    title = t('upgrade.title', 'Study without limits');
  }

  let subtitle;
  if (isPlanGate) {
    subtitle = blocked
      ? (examSoon
          ? t('upgrade.bodyPlanBlockedExam', "You've already started {{count}} study plans this month — and your exam is {{when}}. Give every course its own personalized plan with Pro.", { count: planLimit, when: whenLabel })
          : t('upgrade.bodyPlanBlocked', "You've already started {{count}} study plans this month. Give every course its own personalized plan with Pro.", { count: planLimit }))
      : t('upgrade.bodyPlan', "Pro gives every course you're taking its own plan — not just the first few.");
  } else if (blocked) {
    subtitle = examSoon
      ? t('upgrade.bodyBlockedExam', "You've reached your free practice limit — and your exam is {{when}}. Upgrade to Pro and keep preparing.", { when: whenLabel })
      : t('upgrade.bodyBlocked', "You've reached your free practice limit. Upgrade to Pro and keep preparing for your exam.");
  } else {
    subtitle = examSoon
      ? t('upgrade.bodyExam', "Your exam is {{when}} — don't let a question limit slow your final push.", { when: whenLabel })
      : t('upgrade.body', 'Master every topic, find your weak spots faster, and walk into your exam ready.');
  }

  const countdownText = isPlanGate
    ? t('upgrade.nextPlanInline', 'Continue free in {{time}} (next plan)', { time: formatCountdown(planMsUntilReset) })
    : t('upgrade.nextBatchInline', 'Continue free in {{time}} (next batch)', { time: formatCountdown(msUntilReset) });

  return (
    <div className="upgrade-overlay" onClick={handleOverlayClick}>
      <div className="upgrade-modal" role="dialog" aria-modal="true">
        <button className="upgrade-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Everything above the CTA scrolls; the CTA itself never does. On a
            short laptop window the old single-scroll layout pushed the button
            below the fold, so the one action we want was the one thing you
            couldn't see. */}
        <div className="upgrade-scroll">
        {/* Mascot beside the headline rather than above it — stacked, it cost
            ~80px of height and pushed the price off screen on a laptop. She
            looks right, into the copy. */}
        <div className="upgrade-head">
          <div className="upgrade-icon" aria-hidden="true">
            <NurseQuizMascot size={64} isExcited lookDirection="right" />
          </div>
          <div className="upgrade-head-text">
            <h2 className="upgrade-title">{title}</h2>
            <p className="upgrade-body">{subtitle}</p>
          </div>
        </div>

        {/* What we interrupted. Naming it is the difference between "you hit a
            limit" and "you were 10 minutes from finishing Cardiac Pharm". */}
        {topic && (
          <div className="upgrade-context">
            <span className="upgrade-context-icon" aria-hidden="true"><IconClipboard /></span>
            <span className="upgrade-context-text">
              <span className="upgrade-context-label">
                {t('upgrade.wereStudying', 'You were practicing')}
              </span>
              <span className="upgrade-context-topic">{topic}</span>
            </span>
          </div>
        )}

        {/* Momentum they already have — theirs to keep or to drop. */}
        {(used > 0 || examSoon) && (
          <div className="upgrade-stats">
            {used > 0 && (
              <span className="upgrade-stat">
                <span className="upgrade-stat-num">{used}</span>
                {t('upgrade.questionsDone', 'questions completed')}
              </span>
            )}
            <span className="upgrade-stat">
              <span className="upgrade-stat-icon" aria-hidden="true"><IconSpark /></span>
              {examSoon
                ? t('upgrade.examIs', 'Your exam is {{when}}', { when: whenLabel })
                : t('upgrade.momentumNudge', 'Keep your momentum going!')}
            </span>
          </div>
        )}

        {/* The offer, framed as results rather than capabilities. */}
        <div className="upgrade-pro">
          <div className="upgrade-pro-head">
            <span className="upgrade-pro-badge">{t('upgrade.proBadge', 'PRO')}</span>
            <span className="upgrade-pro-trophy" aria-hidden="true"><IconTrophy /></span>
          </div>

          <h3 className="upgrade-pro-title">
            {t('upgrade.excelTitle', 'Study to excel, not just to pass.')}
          </h3>

          <ul className="upgrade-outcomes">
            {OUTCOMES.map(({ key, Icon, title: outTitle, sub }) => (
              <li className="upgrade-outcome" key={key}>
                <span className="upgrade-outcome-icon" aria-hidden="true"><Icon /></span>
                <span className="upgrade-outcome-text">
                  <span className="upgrade-outcome-title">{t(`upgrade.out.${key}`, outTitle)}</span>
                  <span className="upgrade-outcome-sub">{t(`upgrade.out.${key}Sub`, sub)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* One price on screen at a time. Annual is a swap, not a rival CTA. */}
        {selected && (
          <div className="upgrade-price">
            <span className="upgrade-price-main">
              <span className="upgrade-price-amount">
                {selected.symbol || '$'}{fmtAmount(annualSelected ? selected.perMonth : selected.amount)}
              </span>
              <span className="upgrade-price-interval">{t('upgrade.perMonth', '/ month')}</span>
              <span className="upgrade-price-sub">
                {annualSelected
                  ? t('upgrade.billedYearly', 'Billed {{symbol}}{{amount}} yearly. Cancel anytime.', { symbol: selected.symbol || '$', amount: fmtAmount(selected.amount) })
                  : t('upgrade.cancelAnytime', 'Cancel anytime. No commitments.')}
              </span>
            </span>

            {annual && (
              <button
                type="button"
                className={`upgrade-price-swap ${annualSelected ? 'is-on' : ''}`}
                onClick={() => setAnnualSelected((v) => !v)}
                aria-pressed={annualSelected}
              >
                {annualSelected ? (
                  <span className="upgrade-swap-main">{t('upgrade.switchMonthly', 'Switch to monthly')}</span>
                ) : (
                  <>
                    <span className="upgrade-swap-main">
                      {t('upgrade.savePct', 'Save {{pct}}%', { pct: annual.savePct })}
                    </span>
                    <span className="upgrade-swap-sub">{t('upgrade.withAnnual', 'with annual')}</span>
                  </>
                )}
                <span className="upgrade-swap-chevron" aria-hidden="true">›</span>
              </button>
            )}
          </div>
        )}
        </div>

        <div className="upgrade-footer">
          <button
            className="upgrade-cta"
            onClick={() => selected && startCheckout(selected.id, user)}
            disabled={!selected}
          >
            <span className="upgrade-cta-lock" aria-hidden="true"><IconLock /></span>
            {isPlanGate
              ? t('upgrade.ctaPlans', 'Unlock every plan with Pro')
              : t('upgrade.ctaContinue', 'Continue studying with Pro')}
            <span className="upgrade-cta-arrow" aria-hidden="true">→</span>
          </button>

          {/* The free path stays honest and reachable, but it no longer competes
              with the CTA for attention — it used to sit above it in 30px type. */}
          <div className="upgrade-or"><span>{t('upgrade.or', 'or')}</span></div>

          <button className="upgrade-wait" onClick={onClose}>
            {blocked ? countdownText : t('upgrade.notNow', 'Not now')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
