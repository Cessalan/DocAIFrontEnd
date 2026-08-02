import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import { openBillingPortal } from '../../config/billing';
import { formatCountdown } from '../../Services/UsageService';
import { handleSignOut } from '../../Firebase/auth';
import './AccountModal.css';

/**
 * AccountModal
 * The one place a user can see who they're signed in as and whether they're
 * subscribed — and act on it:
 *   - Pro:  "Manage subscription" → Stripe Billing Portal (change card/cancel)
 *   - Free: usage this window + "Upgrade to Pro" → the existing UpgradeModal
 * Also hosts sign-out so the sidebar footer link has a proper home.
 *
 * Opened from the "Account" item in the sidebar footer.
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {{ uid?: string, email?: string, displayName?: string, photoURL?: string }} user
 */
const AccountModal = ({ isOpen, onClose, user = {} }) => {
  const { t } = useTranslation();
  const { isPro, limit, used, remaining, msUntilReset, openUpgrade } = useUsageLimit();
  const [portalLoading, setPortalLoading] = useState(false);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleManage = async () => {
    setPortalLoading(true);
    const redirected = await openBillingPortal();
    if (!redirected) setPortalLoading(false);
  };

  const handleUpgrade = () => {
    onClose();       // don't stack modals — the provider renders UpgradeModal
    openUpgrade();
  };

  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  const blocked = !isPro && remaining <= 0;

  return (
    <div className="account-overlay" onClick={handleOverlayClick}>
      <div className="account-modal" role="dialog" aria-modal="true" aria-label={t('account.title', 'Account')}>
        <button className="account-close" onClick={onClose} aria-label={t('account.close', 'Close')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="account-title">{t('account.title', 'Account')}</h2>

        {/* Who am I */}
        <div className="account-identity">
          {user.photoURL ? (
            <img className="account-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="account-avatar account-avatar-initial" aria-hidden="true">{initial}</div>
          )}
          <div className="account-identity-text">
            {user.displayName && <div className="account-name">{user.displayName}</div>}
            <div className="account-email">{user.email || t('account.noEmail', 'Signed in')}</div>
          </div>
        </div>

        {/* Subscription status */}
        <div className={`account-plan ${isPro ? 'is-pro' : ''}`}>
          <div className="account-plan-head">
            <span className="account-plan-name">
              {isPro ? (
                <>
                  {/* Brand heart with an EKG pulse — the app's own mark, not a generic crown */}
                  <svg className="account-plan-heart" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                    />
                    <polyline
                      className="account-plan-heart-pulse"
                      points="5,11.4 9,11.4 10.8,8.4 13.2,14.4 14.8,11.4 19,11.4"
                      fill="none"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t('account.planPro', 'Pro')}
                </>
              ) : t('account.planFree', 'Free plan')}
            </span>
            <span className={`account-plan-badge ${isPro ? 'is-pro' : ''}`}>
              {isPro
                ? t('account.subscribed', 'Subscribed')
                : t('account.notSubscribed', 'Not subscribed')}
            </span>
          </div>

          {isPro ? (
            <p className="account-plan-detail">
              {t('account.proDetail', 'Unlimited questions, uploads, and reviews.')}
            </p>
          ) : (
            <p className="account-plan-detail">
              {blocked
                ? t('account.freeBlocked', 'Out of questions — next batch in {{time}}.', { time: formatCountdown(msUntilReset) })
                : t('account.freeDetail', '{{used}} of {{limit}} questions used this 3-hour window.', { used, limit })}
            </p>
          )}

          {isPro ? (
            <button className="account-action" onClick={handleManage} disabled={portalLoading}>
              {portalLoading
                ? t('account.portalOpening', 'Opening…')
                : t('account.manage', 'Manage subscription')}
            </button>
          ) : (
            <button className="account-action is-upgrade" onClick={handleUpgrade}>
              {t('account.upgrade', 'Upgrade to Pro')}
            </button>
          )}
          {isPro && (
            <p className="account-plan-hint">
              {t('account.manageHint', 'Change plan, update your card, or cancel — opens Stripe’s secure portal.')}
            </p>
          )}
        </div>

        <button className="account-signout" onClick={handleSignOut}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('account.signOut', 'Sign out')}
        </button>
      </div>
    </div>
  );
};

export default AccountModal;
