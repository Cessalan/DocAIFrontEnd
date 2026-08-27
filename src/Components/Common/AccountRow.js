import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import { formatCountdown } from '../../Services/UsageService';
import { DevLimitPill } from './UsagePanel';
import './AccountRow.css';

/**
 * AccountRow
 * ChatGPT/Gemini-style profile block for the sidebar footer: avatar + name +
 * plan subtitle with an Upgrade pill, and (for free users) the usage bar for
 * the current weekly window directly below the username. This is the single
 * merged quota/account surface — it replaced the separate UsagePanel meter.
 * Clicking the row opens the AccountModal (profile + subscription management).
 *
 * @param {{ uid?: string, email?: string, displayName?: string, photoURL?: string }} user
 * @param {() => void} onOpenAccount
 */
const AccountRow = ({ user = {}, onOpenAccount }) => {
  const { t } = useTranslation();
  const { isPro, limit, used, remaining, msUntilReset, openUpgrade } = useUsageLimit();

  // Prefer the real name; fall back to the email's local part ("fatsyram").
  const name = user.displayName || (user.email ? user.email.split('@')[0] : t('account.title', 'Account'));
  const initial = name.charAt(0).toUpperCase();

  const blocked = !isPro && remaining <= 0;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const handleUpgrade = (e) => {
    e.stopPropagation(); // pill acts alone — don't also open the modal
    openUpgrade();
  };

  return (
    <div
      className="account-block"
      onClick={onOpenAccount}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenAccount(); } }}
      title={t('account.rowTitle', 'Account & subscription')}
    >
      <div className="account-row">
        {user.photoURL ? (
          <img className="account-row-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="account-row-avatar account-row-avatar-initial" aria-hidden="true">{initial}</div>
        )}

        <div className="account-row-text">
          <span className="account-row-name">{name}</span>
          <span className={`account-row-plan ${isPro ? 'is-pro' : ''}`}>
            {isPro ? t('account.planPro', 'Pro') : t('account.planFreeShort', 'Free')}
          </span>
        </div>

        {!isPro && (
          <button className="account-row-upgrade" onClick={handleUpgrade}>
            {t('account.upgradeShort', 'Upgrade')}
          </button>
        )}
      </div>

      {/* Usage for the current weekly window — free users only. */}
      {!isPro && (
        <div
          className={`account-usage ${blocked ? 'is-blocked' : ''}`}
          title={t('usagePanel.tooltip', 'Questions used — refills every week')}
        >
          <span className="account-usage-count">
            {blocked
              ? formatCountdown(msUntilReset)
              : <>{used}<span className="account-usage-limit">/{limit}</span></>}
          </span>
          <div className="account-usage-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="account-usage-fill" style={{ width: `${pct}%` }} />
          </div>
          <span onClick={(e) => e.stopPropagation()}><DevLimitPill /></span>
        </div>
      )}
    </div>
  );
};

export default AccountRow;
