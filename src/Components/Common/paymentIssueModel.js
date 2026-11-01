/**
 * paymentIssueModel
 *
 * Whether to tell a Pro member her renewal failed, and where to send her.
 *
 * Until 2026-10-30 a failed renewal was invisible: the webhook ignored
 * `past_due`, Pro stayed on, and Stripe deleted the subscription about three
 * weeks later. cyates lost a month that way and only came back for her next
 * exam. Three more were past_due and still studying when it was found. These
 * students never read messages but open the app before every exam, so the
 * notice lives in the app.
 *
 * The backend (NQBackEnd2 stripe_billing.record_payment_issue) writes
 * `users/{uid}.billing.paymentIssue`; `billing` is backend-only in
 * firestore.rules. The link is still checked against Stripe's hosts, since a
 * notice that says "update your card" is the one place a bad link does harm.
 */

const STRIPE_HOSTS = ['invoice.stripe.com', 'billing.stripe.com', 'checkout.stripe.com'];

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

export const isStripeUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && STRIPE_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
};

/**
 * @returns {null | { invoiceUrl: string|null, since: number|null, nextAttemptAt: number|null, key: string }}
 *   null when there is nothing to say. `invoiceUrl` null = no safe direct
 *   link, so the banner falls back to the billing portal. `key` changes per
 *   failure, so "Later" on one does not hide the next.
 */
export const paymentIssueFrom = (profile) => {
  if (profile?.usage?.tier !== 'pro') return null;
  const issue = profile?.billing?.paymentIssue;
  if (!issue || typeof issue !== 'object') return null;
  const since = toMillis(issue.since);
  const nextAttemptAt = toMillis(issue.nextAttemptAt);
  return {
    invoiceUrl: isStripeUrl(issue.invoiceUrl) ? issue.invoiceUrl : null,
    since,
    // A retry date already behind us says nothing useful.
    nextAttemptAt: nextAttemptAt && nextAttemptAt > Date.now() ? nextAttemptAt : null,
    key: `${issue.subscriptionId || 'sub'}:${since || 0}`,
  };
};
