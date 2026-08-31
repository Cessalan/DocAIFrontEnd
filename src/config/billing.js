/**
 * billing.js
 * Pricing plans + the checkout seam for upgrading to Pro.
 *
 * The plan list is presentation-only (safe to ship). The actual money is
 * processed by `startCheckout()`, which is intentionally a thin seam so the
 * processor (Stripe Checkout Session, Stripe Payment Link, Firebase Stripe
 * Extension, etc.) can be wired in one place once the account is set up.
 *
 * ⚠️ Prices here are for DISPLAY only — the real, authoritative price lives in
 * the payment processor (Stripe product/price). Never trust a client-sent
 * amount; the processor charges its own configured price.
 */

import { auth } from '../Firebase/config';
import { API_BASE_URL } from '../Services/config';

export const PLANS = [
  {
    id: 'annual',
    name: 'Annual',
    amount: 50,              // US$/year — display only; MUST match the Stripe price
    currency: 'USD',
    symbol: '$',             // shown before the amount (French copy renders "$ US" via i18n)
    interval: 'year',
    perMonth: 4.17,          // 50 / 12, for the "$4.17/mo" subtitle
    savePct: 50,             // vs paying monthly (8.33*12 = 99.96 → 50 = ~50% off)
    recommended: true,
    // Fill these from your Stripe dashboard once created:
    stripePriceId: process.env.REACT_APP_STRIPE_PRICE_ANNUAL || '',
    paymentLink: process.env.REACT_APP_STRIPE_LINK_ANNUAL || '',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    amount: 8.33,            // US$/month — display only; MUST match the Stripe price
    currency: 'USD',
    symbol: '$',
    interval: 'month',
    perMonth: 8.33,
    recommended: false,
    stripePriceId: process.env.REACT_APP_STRIPE_PRICE_MONTHLY || '',
    paymentLink: process.env.REACT_APP_STRIPE_LINK_MONTHLY || '',
  },
];

export const getPlan = (id) => PLANS.find((p) => p.id === id) || null;

/**
 * Kick off checkout for a plan. This is the single integration point — wire
 * your processor here once. Until then it surfaces a clear console warning so
 * the button is obviously "not yet connected" rather than silently failing.
 *
 * The user's uid is passed so the processor can tie the payment back to the
 * account (Stripe: client_reference_id) and a webhook can flip the user to
 * `usage.tier = 'pro'` server-side.
 *
 * @param {string} planId
 * @param {{ uid?: string, email?: string }} [user]
 */
export const startCheckout = async (planId, user = {}) => {
  const plan = getPlan(planId);
  if (!plan) {
    console.error('[billing] Unknown plan:', planId);
    return;
  }

  // --- Option A: Stripe Payment Link (fastest, no backend) -----------------
  // Create two recurring Payment Links in Stripe, drop their URLs in the env
  // vars above, and this opens them with the uid attached for the webhook.
  if (plan.paymentLink) {
    const url = new URL(plan.paymentLink);
    if (user.uid) url.searchParams.set('client_reference_id', user.uid);
    if (user.email) url.searchParams.set('prefilled_email', user.email);
    window.location.assign(url.toString());
    return;
  }

  // --- Option B: backend Checkout Session (NQBackEnd2) ---------------------
  // Uncomment + point at your FastAPI endpoint once it exists:
  //
  // const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ priceId: plan.stripePriceId, uid: user.uid }),
  // });
  // const { url } = await res.json();
  // window.location.assign(url);
  // return;

  console.warn(
    `[billing] Checkout not wired yet for "${planId}". ` +
    `Set REACT_APP_STRIPE_LINK_${planId.toUpperCase()} (Payment Link) ` +
    `or enable the backend Checkout Session path in src/config/billing.js.`
  );
  // eslint-disable-next-line no-alert
  alert('Payments are being set up — hang tight! This button isn\'t connected yet.');
};

/**
 * Open the Stripe Customer Billing Portal, where a Pro user can cancel or
 * change their subscription. The backend verifies the Firebase ID token and
 * looks up the user's Stripe customer — the client never names a customer.
 * Cancellation flows back through the webhook, which sets tier to 'free'.
 *
 * @returns {Promise<boolean>} true if we redirected to the portal
 */
export const openBillingPortal = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.error('[billing] No signed-in user for billing portal');
    return false;
  }
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE_URL}/billing/create-portal-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      console.error('[billing] Portal session failed:', res.status, detail);
      // eslint-disable-next-line no-alert
      alert(res.status === 404
        ? 'We couldn\'t find a subscription on this account. If you just upgraded, give it a minute — otherwise contact support.'
        : 'Couldn\'t open subscription management right now. Please try again in a moment.');
      return false;
    }
    const { url } = await res.json();
    window.location.assign(url);
    return true;
  } catch (err) {
    console.error('[billing] Portal session error:', err);
    // eslint-disable-next-line no-alert
    alert('Couldn\'t open subscription management right now. Please try again in a moment.');
    return false;
  }
};
