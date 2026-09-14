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

/* The Semester Pass link is a LIVE Payment Link, checked in so the plan works
   without extra env setup. The env var still wins, so a dev/test link set in
   `.env.development.local` overrides it — but if none is set, a dev build
   sends you to the real one. `usesLiveFallback` exists so startCheckout can
   say so out loud instead of taking your money quietly. */
const SEMESTER_LINK_ENV = process.env.REACT_APP_STRIPE_LINK_SEMESTER || '';
const SEMESTER_LINK_LIVE = 'https://buy.stripe.com/eVqeVeghhfTW4hI3bPf3a09';

export const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    amount: 13.34,           // US$/month — display only; MUST match the Stripe price
    currency: 'USD',
    symbol: '$',
    interval: 'month',
    intervalCount: 1,
    perMonth: 13.34,
    savePct: 0,
    recommended: false,
    stripePriceId: process.env.REACT_APP_STRIPE_PRICE_MONTHLY || '',
    paymentLink: process.env.REACT_APP_STRIPE_LINK_MONTHLY || '',
  },
  {
    /* The semester pass is a RECURRING 4-month price, not a one-off. That
       matters well beyond this file: entitlement is revoked only by Stripe's
       subscription lifecycle events, and `usage.tier` is a flag with no expiry
       date anywhere in the system. A one-time "pass" would grant Pro forever.
       If this is ever re-created in Stripe, it must stay recurring. */
    id: 'semester',
    name: 'Semester Pass',
    amount: 40.17,           // US$ per 4 months — display only; MUST match Stripe
    currency: 'USD',
    symbol: '$',
    interval: 'month',
    intervalCount: 4,        // ⚠️ same `interval` as monthly — always look plans up by id
    perMonth: 10.04,         // 40.17 / 4
    savePct: 25,             // vs 4 months at 13.34 (53.36 → 40.17 = ~24.7%)
    recommended: false,
    stripePriceId: process.env.REACT_APP_STRIPE_PRICE_SEMESTER || '',
    paymentLink: SEMESTER_LINK_ENV || SEMESTER_LINK_LIVE,
    usesLiveFallback: !SEMESTER_LINK_ENV,
  },
  {
    id: 'annual',
    name: 'Annual',
    amount: 83.07,           // US$/year — display only; MUST match the Stripe price
    currency: 'USD',
    symbol: '$',
    interval: 'year',
    intervalCount: 1,
    perMonth: 6.92,          // 83.07 / 12, for the "$6.92/mo" subtitle
    savePct: 48,             // vs paying monthly (13.34*12 = 160.08 → 83.07 = ~48% off)
    recommended: true,
    stripePriceId: process.env.REACT_APP_STRIPE_PRICE_ANNUAL || '',
    paymentLink: process.env.REACT_APP_STRIPE_LINK_ANNUAL || '',
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
    if (plan.usesLiveFallback && process.env.NODE_ENV === 'development') {
      console.warn(
        `[billing] "${planId}" is falling back to the LIVE Stripe Payment Link — ` +
        `this will charge a real card. Set REACT_APP_STRIPE_LINK_${planId.toUpperCase()} ` +
        `in .env.development.local to a test link.`
      );
    }
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
