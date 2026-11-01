import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openBillingPortal } from '../../config/billing';
import { logFunnelStepOnce, logFunnelStep, FUNNEL } from '../../Services/FunnelService';
import './PaymentIssueBanner.css';

/**
 * PaymentIssueBanner
 * Tells a Pro member her renewal failed while Pro is still on, with one way
 * to fix it. Rendered globally by UsageProvider (chat and study screens), in
 * the bottom-left slot the usage badge uses for free accounts. Why it exists:
 * Common/paymentIssueModel.js.
 *
 * "Later" hides it for this browser session only; the next visit asks again,
 * because the subscription is still lapsing.
 *
 * @param {{ invoiceUrl: string|null, nextAttemptAt: number|null, key: string }} issue
 */

const laterKey = (key) => `nqPaymentIssueLater:${key}`;
const readLater = (key) => {
  try { return sessionStorage.getItem(laterKey(key)) === '1'; } catch { return false; }
};

const PaymentIssueBanner = ({ issue }) => {
  const { t, i18n } = useTranslation();
  const [later, setLater] = useState(() => readLater(issue.key));
  const [opening, setOpening] = useState(false);

  useEffect(() => { setLater(readLater(issue.key)); }, [issue.key]);
  useEffect(() => {
    if (!later) logFunnelStepOnce(FUNNEL.PAYMENT_ISSUE_SHOWN, { hasInvoiceUrl: !!issue.invoiceUrl });
  }, [later, issue.invoiceUrl]);

  if (later) return null;

  const retry = issue.nextAttemptAt
    ? new Date(issue.nextAttemptAt).toLocaleDateString(i18n.language, { weekday: 'long', month: 'short', day: 'numeric' })
    : null;

  const fix = async () => {
    logFunnelStep(FUNNEL.PAYMENT_ISSUE_CLICKED, { target: issue.invoiceUrl ? 'invoice' : 'portal' });
    if (issue.invoiceUrl) {
      // A new tab keeps her place in the plan; the live profile listener
      // clears this banner when Stripe confirms the payment.
      window.open(issue.invoiceUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setOpening(true);
    if (!(await openBillingPortal())) setOpening(false);
  };

  const dismiss = () => {
    try { sessionStorage.setItem(laterKey(issue.key), '1'); } catch { /* still hide it for now */ }
    setLater(true);
  };

  return (
    <aside className="payment-issue" role="status" aria-live="polite">
      <p className="payment-issue-title">{t('paymentIssue.title', "Your card didn't go through")}</p>
      <p className="payment-issue-body">
        {retry
          ? t('paymentIssue.bodyRetry', 'Pro is still on. Stripe tries again on {{date}}. Update your card so it goes through.', { date: retry })
          : t('paymentIssue.body', 'Pro is still on for now. Update your card so it stays that way.')}
      </p>
      <div className="payment-issue-actions">
        <button type="button" className="payment-issue-fix" onClick={fix} disabled={opening}>
          {opening ? t('account.portalOpening', 'Opening…') : t('paymentIssue.fix', 'Update card')}
        </button>
        <button type="button" className="payment-issue-later" onClick={dismiss}>
          {t('paymentIssue.later', 'Later')}
        </button>
      </div>
    </aside>
  );
};

export default PaymentIssueBanner;
