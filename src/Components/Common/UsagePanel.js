import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import './UsagePanel.css';

/**
 * UsagePanel
 * Minimal, non-invasive usage + upgrade strip for the sidebar footer.
 * A single slim row: count · thin progress bar · compact crown "Upgrade" pill.
 * Deliberately background-less so it blends into the footer; the only colored
 * elements are the bar fill and the upgrade pill (which keeps converting).
 * - Free: "18/30" + bar + Upgrade pill (or live "Resets in M:SS" when empty).
 * - Pro: a single "Pro · Unlimited" line with a crown.
 */
const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const CrownIcon = () => (
  <svg className="usage-crown" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M2.5 7.2c.7 0 1.3.6 1.3 1.3 0 .2-.05.4-.13.6l1.9 1.1 2.6-3.6a1.3 1.3 0 1 1 2.06-.36L12 9.4l1.7-3.16a1.3 1.3 0 1 1 2.06.36l2.6 3.6 1.9-1.1a1.32 1.32 0 0 1-.13-.6 1.3 1.3 0 1 1 1.55 1.28l-1.36 7.02a1 1 0 0 1-.98.8H5.06a1 1 0 0 1-.98-.8L2.72 9.78A1.3 1.3 0 0 1 2.5 7.2Zm3 11.3h13a.9.9 0 0 1 0 1.8h-13a.9.9 0 0 1 0-1.8Z" />
  </svg>
);

const UsagePanel = () => {
  const { t } = useTranslation();
  const { isPro, limit, used, remaining, msUntilReset, openUpgrade } = useUsageLimit();

  if (isPro) {
    // Clicking opens the modal in its Pro state: manage / cancel subscription
    // via the Stripe Billing Portal.
    return (
      <div className="usage-panel is-pro">
        <CrownIcon />
        <span className="usage-panel-pro-text">{t('usagePanel.proUnlimited', 'Pro · Unlimited')}</span>
        <button
          className="usage-panel-manage"
          onClick={openUpgrade}
          title={t('usagePanel.manageTitle', 'Manage or cancel your subscription')}
        >
          {t('usagePanel.manage', 'Manage')}
        </button>
      </div>
    );
  }

  const blocked = remaining <= 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div
      className={`usage-panel ${blocked ? 'is-blocked' : ''}`}
      title={t('usagePanel.tooltip', 'Questions used this hour')}
    >
      <span className="usage-panel-count">
        {blocked ? (
          <span className="usage-panel-reset">{formatCountdown(msUntilReset)}</span>
        ) : (
          <>{used}<span className="usage-panel-limit">/{limit}</span></>
        )}
      </span>

      <div className="usage-panel-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="usage-panel-fill" style={{ width: `${pct}%` }} />
      </div>

      <button className="usage-panel-upgrade" onClick={openUpgrade} title={t('usagePanel.upgradeTitle', 'Upgrade to Pro')}>
        <CrownIcon />{t('usagePanel.upgrade', 'Upgrade')}
      </button>
    </div>
  );
};

export default UsagePanel;
