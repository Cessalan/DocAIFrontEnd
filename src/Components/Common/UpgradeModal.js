import React from 'react';
import { useTranslation } from 'react-i18next';
import { PLANS, startCheckout } from '../../config/billing';
import { daysUntilExam } from './upgradeCopy';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import './UpgradeModal.css';

/**
 * UpgradeModal
 * Shown when a free user has exhausted their hourly question budget, or when
 * they tap the usage badge. Communicates the wait ("next batch in MM:SS") and
 * offers the two Pro plans.
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
 */
const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const UpgradeModal = ({ isOpen, onClose, limit = 30, remaining = Infinity, msUntilReset = 0, user = {}, studyGoal = null, examDate = null }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // "Blocked" = actually out of questions — only then show the wait/countdown.
  // Opening the modal proactively (badge tap with budget left) shows the plain
  // marketing pitch instead.
  const blocked = remaining <= 0;

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
  if (blocked) {
    subtitle = examSoon
      ? t('upgrade.bodyBlockedExam', "You've hit your {{limit}} questions this hour — and your exam is {{when}}. Don't lose momentum: go unlimited.", { limit, when: whenLabel })
      : t('upgrade.bodyBlocked', "You've hit your {{limit}} questions this hour. Keep your momentum going — practice as much as you need to be ready.", { limit });
  } else {
    subtitle = examSoon
      ? t('upgrade.bodyExam', "Your exam is {{when}} — don't let an hourly limit slow your final push. Practice unlimited.", { when: whenLabel })
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

        {blocked && (
          <div className="upgrade-countdown" aria-live="polite">
            <span className="upgrade-countdown-label">
              {t('upgrade.nextBatch', 'Or wait — next batch in')}
            </span>
            <span className="upgrade-countdown-time">{formatCountdown(msUntilReset)}</span>
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
            <span className="upgrade-compare-feature">{t('upgrade.cmp.practice', 'Practice every topic')}</span>
            <span className="upgrade-compare-free">{t('upgrade.cmp.perHour', '{{limit}}/hr', { limit })}</span>
            <span className="upgrade-compare-pro">{t('upgrade.cmp.unlimited', 'Unlimited')}</span>
          </div>

          <div className="upgrade-compare-row">
            <span className="upgrade-compare-feature">{t('upgrade.cmp.uploads', 'Upload your notes')}</span>
            <span className="upgrade-compare-free">{t('upgrade.cmp.onePerChat', '1 per chat')}</span>
            <span className="upgrade-compare-pro">{t('upgrade.cmp.unlimited', 'Unlimited')}</span>
          </div>

          <div className="upgrade-compare-row">
            <span className="upgrade-compare-feature">{t('upgrade.cmp.weakSpots', 'Find your weak spots')}</span>
            <span className="upgrade-compare-free">{t('upgrade.cmp.hourlyCap', 'Hourly limit')}</span>
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
                <span className="upgrade-plan-amount">${plan.amount}</span>
                <span className="upgrade-plan-interval">/{plan.interval === 'year' ? t('upgrade.yr', 'yr') : t('upgrade.mo', 'mo')}</span>
              </span>
              {plan.interval === 'year' ? (
                <span className="upgrade-plan-sub">
                  {t('upgrade.perMonthSave', '${{perMonth}}/mo · save {{savePct}}%', { perMonth: plan.perMonth, savePct: plan.savePct })}
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
      </div>
    </div>
  );
};

export default UpgradeModal;
