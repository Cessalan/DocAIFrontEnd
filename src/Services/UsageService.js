/**
 * UsageService.js
 * Frontend usage throttle for AI generations (monetization gate).
 *
 * Model: a rolling 3-hour window. Free users get FREE_LIMIT *questions*
 * per window; when the window has elapsed the bucket refills automatically.
 * Pro users (usage.tier === 'pro') are unlimited.
 *
 * The unit is QUESTIONS (items), not whole generations — so a 3-question quiz
 * costs 3 and a 20-question quiz costs 20, scaling with how much is generated.
 * A quiz charges its question count, a flashcard set its card count; mindmaps,
 * lessons, summaries, scenarios and audio charge a flat 1. Plain conversational
 * text replies don't count. Use `generationUnits()` to derive the amount from a
 * generated payload, then pass it to `consumeGeneration(uid, amount)`.
 *
 * ⚠️ This is a CLIENT-SIDE gate only — it is bypassable (devtools / direct
 * API calls). It exists to start monetizing fast and to drive the upgrade
 * nudge. Real enforcement must live in NQBackEnd2 (reject over-quota
 * generation requests server-side). Keep the field shape below in sync with
 * whatever the backend ends up reading.
 *
 * Firestore shape: users/{uid}.usage = {
 *   tier: 'free' | 'pro',
 *   windowStart: number (ms epoch),   // start of the current rolling window
 *   count: number                     // generations consumed in this window
 * }
 */

import { db } from '../Firebase/config';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { devLog } from './devLogger';

// Tunable knobs — change these two constants to retune the throttle.
// Backstop, not the commercial gate. The plan quota below is what free users
// are meant to hit; this only exists to cap runaway generation INSIDE an
// active plan (retakes, regenerated nodes, configurable exams), which the plan
// quota doesn't bound. Sized to sit above real usage: a topic unit costs 17
// units, so 50 buys ~14 nodes per window — comfortably past the ~6-node depth
// that predicts a user returning.
export const FREE_LIMIT = 50;                 // questions (items) per window for free tier
export const WINDOW_MS = 3 * 60 * 60 * 1000;  // rolling window length (3 hours)

/**
 * Dev-only limit override, so the throttle can be exercised without burning
 * through 30 real generations. In a development build, set it from the
 * browser console and reload:
 *
 *   localStorage.nqDevFreeLimit = 3     // pretend the free cap is 3
 *   delete localStorage.nqDevFreeLimit  // back to the real FREE_LIMIT
 *
 * Ignored entirely in production builds.
 */
const DEV_LIMIT_KEY = 'nqDevFreeLimit';

/** Current dev override, or null when unset / not a dev build. */
export const getDevFreeLimitOverride = () => {
  if (process.env.NODE_ENV !== 'development') return null;
  try {
    const n = parseInt(window.localStorage.getItem(DEV_LIMIT_KEY), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    // Storage unavailable (SSR/tests) — behave as if unset.
    return null;
  }
};

/** Set (n > 0) or clear (anything else) the dev override. Dev builds only. */
export const setDevFreeLimitOverride = (n) => {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    if (Number.isFinite(n) && n > 0) {
      window.localStorage.setItem(DEV_LIMIT_KEY, String(Math.floor(n)));
    } else {
      window.localStorage.removeItem(DEV_LIMIT_KEY);
    }
  } catch {
    // Storage unavailable — nothing to do.
  }
};

export const getFreeLimit = () => getDevFreeLimitOverride() ?? FREE_LIMIT;

/**
 * Format a reset countdown for display. Hour-aware since the window is 3
 * hours: "2:14:09" when an hour or more remains, "14:09" below that.
 * Shared by UsageBadge, UsagePanel and UpgradeModal.
 *
 * @param {number} ms - milliseconds until the bucket refills
 * @returns {string}
 */
export const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Derive how many units (questions/cards) a generated payload should charge.
 * Quiz → question count, flashcard set → card count; anything else (mindmap,
 * lesson, summary, scenario, audio) charges a flat 1. Accepts either the array
 * itself (e.g. quiz_data) or the content object ({ questions } / { cards }).
 *
 * @param {Array|Object|undefined} payload
 * @returns {number} units to charge (>= 1)
 */
export const generationUnits = (payload) => {
  if (Array.isArray(payload)) return Math.max(1, payload.length);
  if (payload && typeof payload === 'object') {
    const n = payload.questions?.length || payload.cards?.length || payload.flashcards?.length;
    if (n) return Math.max(1, n);
  }
  return 1;
};

/**
 * Normalize a raw usage object against the current time, applying the
 * rolling-window reset. Pure function — does not write to Firestore.
 *
 * @param {Object|undefined} raw - usage sub-object from the user doc
 * @param {number} now - Date.now()
 * @returns {{ tier: string, windowStart: number, count: number }}
 */
const normalizeUsage = (raw, now) => {
  const tier = raw?.tier === 'pro' ? 'pro' : 'free';
  let windowStart = typeof raw?.windowStart === 'number' ? raw.windowStart : 0;
  let count = typeof raw?.count === 'number' ? raw.count : 0;

  // Window expired (or never started) → fresh empty bucket.
  if (!windowStart || now - windowStart >= WINDOW_MS) {
    windowStart = now;
    count = 0;
  }

  return { tier, windowStart, count };
};

/**
 * Derive the public quota view from a normalized usage object.
 *
 * @param {{ tier: string, windowStart: number, count: number }} usage
 * @param {number} now - Date.now()
 */
export const deriveQuota = (usage, now = Date.now()) => {
  const norm = normalizeUsage(usage, now);
  const isPro = norm.tier === 'pro';
  const limit = getFreeLimit();
  const remaining = isPro ? Infinity : Math.max(0, limit - norm.count);
  const canGenerate = isPro || remaining > 0;
  // Time until the bucket refills (only meaningful when blocked / free).
  const msUntilReset = isPro ? 0 : Math.max(0, norm.windowStart + WINDOW_MS - now);

  return { tier: norm.tier, isPro, limit, used: norm.count, windowStart: norm.windowStart, remaining, canGenerate, msUntilReset };
};

/* ══════════════════════════════════════════════════════════════════════
   PLAN QUOTA — a second, independent meter.

   The question throttle above meters CONSUMPTION inside a plan. This one
   meters how many NEW study plans a free user may create per month.

   Why a separate meter: plan generation is by far the most expensive call
   in the product (a full path plus the first node), and metering it is the
   only gate that lands on engaged users rather than on anyone who studies
   for twenty minutes. Production data (2026-08-03): 72.9% of users create
   exactly one plan and 15.5% create two, so a cap of 3 is invisible to ~88%
   of users and bites only the multi-subject cohort.

   Three per window (not one) is deliberate: 66.5% of second plans are
   created the SAME DAY — students set up several courses in one sitting.
   A cap of one would wall that session and also destroy retry-after-failure,
   which matters while ~1 in 8 first nodes still fails to generate.

   Stored separately at users/{uid}.planUsage so the two meters never
   interfere. Charged at plan COMMIT (createStudySession), not at generation,
   because the preview flow is deliberately side-effect-free.
   ══════════════════════════════════════════════════════════════════════ */

export const FREE_PLANS_PER_WINDOW = 3;
export const PLAN_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, rolling

const DEV_PLAN_LIMIT_KEY = 'nqDevPlanLimit';

/** Dev-only plan-limit override (dev builds only), mirroring the question one. */
export const getDevPlanLimitOverride = () => {
  if (process.env.NODE_ENV !== 'development') return null;
  try {
    const n = parseInt(window.localStorage.getItem(DEV_PLAN_LIMIT_KEY), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

export const getPlanLimit = () => getDevPlanLimitOverride() ?? FREE_PLANS_PER_WINDOW;

/** Normalize planUsage against the rolling 30-day window. Pure. */
const normalizePlanUsage = (raw, tier, now) => {
  let windowStart = typeof raw?.windowStart === 'number' ? raw.windowStart : 0;
  let count = typeof raw?.count === 'number' ? raw.count : 0;
  if (!windowStart || now - windowStart >= PLAN_WINDOW_MS) {
    windowStart = now;
    count = 0;
  }
  return { tier: tier === 'pro' ? 'pro' : 'free', windowStart, count };
};

/**
 * Public plan-quota view.
 * @param {Object|undefined} planUsage - planUsage sub-object from the user doc
 * @param {string} tier - 'free' | 'pro' (lives on usage.tier, the billing source of truth)
 */
export const derivePlanQuota = (planUsage, tier, now = Date.now()) => {
  const norm = normalizePlanUsage(planUsage, tier, now);
  const isPro = norm.tier === 'pro';
  const limit = getPlanLimit();
  const remaining = isPro ? Infinity : Math.max(0, limit - norm.count);
  return {
    isPro,
    limit,
    used: norm.count,
    remaining,
    canCreatePlan: isPro || remaining > 0,
    windowStart: norm.windowStart,
    msUntilReset: isPro ? 0 : Math.max(0, norm.windowStart + PLAN_WINDOW_MS - now),
  };
};

/** Read-only plan quota for a user. Fails open (as Pro) on read errors. */
export const getPlanQuota = async (uid) => {
  if (!uid) return derivePlanQuota(undefined, 'free');
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.exists() ? snap.data() : {};
    return derivePlanQuota(data.planUsage, data.usage?.tier);
  } catch (error) {
    console.error('Error reading plan quota:', error);
    return derivePlanQuota(undefined, 'pro'); // fail open
  }
};

/**
 * Charge one plan against the rolling window. Call AFTER the plan is
 * successfully committed to Firestore.
 */
export const consumePlan = async (uid) => {
  const now = Date.now();
  if (!uid) return derivePlanQuota(undefined, 'free', now);

  try {
    const userRef = doc(db, 'users', uid);
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists() ? snap.data() : {};
      const norm = normalizePlanUsage(data.planUsage, data.usage?.tier, now);

      if (norm.tier === 'pro') return { planUsage: norm, tier: 'pro' };

      const next = { windowStart: norm.windowStart, count: norm.count + 1 };
      tx.set(userRef, { planUsage: next, updatedAt: serverTimestamp() }, { merge: true });
      return { planUsage: next, tier: 'free' };
    });

    devLog('🗂️ Plan consumed:', result.planUsage.count, '/', getPlanLimit());
    return derivePlanQuota(result.planUsage, result.tier, now);
  } catch (error) {
    console.error('Error consuming plan:', error);
    return derivePlanQuota(undefined, 'pro', now); // fail open
  }
};

/**
 * Read the user's current quota view (with rolling reset applied in-memory).
 * Does NOT mutate Firestore — read-only.
 *
 * @param {string} uid
 * @returns {Promise<ReturnType<typeof deriveQuota>>}
 */
export const getQuota = async (uid) => {
  if (!uid) return deriveQuota({ tier: 'free', windowStart: 0, count: 0 });
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const usage = snap.exists() ? snap.data().usage : undefined;
    return deriveQuota(usage);
  } catch (error) {
    console.error('Error reading usage quota:', error);
    // Fail open — never lock a paying/working user out due to a read error.
    return deriveQuota({ tier: 'pro', windowStart: 0, count: 0 });
  }
};

/**
 * Atomically consume `amount` units (questions/cards) against the rolling
 * window. Resets the window first if it has elapsed. Pro users are never
 * charged. The full amount is added even if it pushes count past the limit
 * (the generation already completed) — the gate prevents *starting* when
 * already at/over the cap, so this is the intended over-shoot generosity.
 *
 * Returns the post-consume quota view, plus `allowed` indicating whether the
 * user had any budget when charged.
 *
 * @param {string} uid
 * @param {number} amount - units to charge (defaults to 1)
 * @returns {Promise<ReturnType<typeof deriveQuota> & { allowed: boolean }>}
 */
export const consumeGeneration = async (uid, amount = 1) => {
  const now = Date.now();
  const charge = Math.max(1, Math.floor(amount) || 1);
  if (!uid) return { ...deriveQuota({ tier: 'free', windowStart: now, count: getFreeLimit() }), allowed: false };

  try {
    const userRef = doc(db, 'users', uid);
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      const raw = snap.exists() ? snap.data().usage : undefined;
      const norm = normalizeUsage(raw, now);

      if (norm.tier === 'pro') {
        // Pro: keep the window fresh but never increment a cap.
        return { usage: norm, allowed: true };
      }

      const allowed = norm.count < getFreeLimit();
      const nextCount = norm.count + charge;
      const nextUsage = { tier: 'free', windowStart: norm.windowStart, count: nextCount };

      tx.set(userRef, { usage: nextUsage, updatedAt: serverTimestamp() }, { merge: true });
      return { usage: nextUsage, allowed };
    });

    devLog('🪙 Consumed', charge, 'units:', result.usage.count, '/', getFreeLimit(), 'allowed:', result.allowed);
    return { ...deriveQuota(result.usage, now), allowed: result.allowed };
  } catch (error) {
    console.error('Error consuming generation:', error);
    // Fail open so a transient Firestore error never blocks a user mid-flow.
    return { ...deriveQuota({ tier: 'pro', windowStart: now, count: 0 }, now), allowed: true };
  }
};
