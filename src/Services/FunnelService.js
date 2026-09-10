import { db, auth } from "../Firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { devLog } from "./devLogger";

/**
 * FunnelService — one row per step of the upload → plan → paywall funnel.
 *
 * WHY THIS EXISTS
 *
 * Until now the product emitted nothing when a paywall opened. Every
 * conversion question — which gate fired, how far the student got before it
 * fired, whether she had seen her plan yet — had to be reconstructed after
 * the fact by joining Firestore write timestamps against Stripe session
 * logs. That reconstruction is slow, lossy, and cannot see the students who
 * dropped BEFORE writing anything, who are precisely the ones the funnel is
 * being changed for.
 *
 * So the new upload flow instruments itself as it goes. Each step writes one
 * flat row, and the rows share a `funnelId` so a single query can replay one
 * student's path from upload to checkout without any joining.
 *
 * WHAT MAKES A ROW TRUSTWORTHY
 *
 *  - `funnelId` is minted per upload attempt, not per session or per user. A
 *    student who uploads three decks has three funnels, and averaging them
 *    into one "session" is how a 3-of-3 completion looks like a 1-of-1.
 *
 *  - Steps are logged where they HAPPEN, not where they are inferred. A
 *    `plan_preview_viewed` written by the code that opens the paywall would
 *    always show 100% preview→paywall, which is a tautology, not a funnel.
 *
 *  - Writes are best-effort and never block the UI. A dropped analytics row
 *    is a gap in a chart; a thrown one is a student stuck on a spinner. Every
 *    call swallows its own failure, exactly like markMessageEngaged.
 *
 *  - `logFunnelStepOnce` exists because React renders more than once and a
 *    step counted twice inflates the top of the funnel and deflates every
 *    rate below it. View events must use it.
 *
 * WHY NOT A THIRD-PARTY ANALYTICS SDK
 *
 * The questions being asked are joins against data already in Firestore
 * ("of the students blocked at the plan gate, how many had completed the
 * first lesson?"). Shipping those answers to a service that cannot see
 * `chats/{id}.study` means exporting both sides to answer either. One
 * collection next to the data it describes is queryable today, with the
 * admin read path already documented for the satisfaction dashboard.
 */

const COLLECTION = "funnelEvents";

/**
 * The steps, in the order a student walks them. Exported as a frozen map so
 * call sites are typo-proof — a mistyped string literal is a step that
 * silently never appears in the funnel, and nothing surfaces the mistake.
 */
export const FUNNEL = Object.freeze({
  UPLOAD_STARTED: 'upload_started',
  UPLOAD_COMPLETED: 'upload_completed',
  // Course intelligence. The context form runs alongside the upload rather
  // than in front of it, so CONTEXT_SHOWN and UPLOAD_STARTED land within a
  // second of each other — the gap worth watching is SHOWN -> SUBMITTED, and
  // SKIPPED is a legitimate outcome rather than a drop.
  COURSE_CONTEXT_SHOWN: 'course_context_shown',
  COURSE_CONTEXT_SUBMITTED: 'course_context_submitted',
  COURSE_CONTEXT_SKIPPED: 'course_context_skipped',
  INTELLIGENCE_STARTED: 'intelligence_started',
  INTELLIGENCE_COMPLETED: 'intelligence_completed',
  INTELLIGENCE_FAILED: 'intelligence_failed',
  REPORT_VIEWED: 'report_viewed',
  REVEAL_VIEWED: 'reveal_viewed',
  INSIGHTS_VIEWED: 'insights_viewed',
  FIRST_LESSON_STARTED: 'first_lesson_started',
  FIRST_LESSON_COMPLETED: 'first_lesson_completed',
  QUICK_CHECK_STARTED: 'quick_check_started',
  QUICK_CHECK_COMPLETED: 'quick_check_completed',
  EXAM_DATE_STARTED: 'exam_date_started',
  EXAM_DATE_COMPLETED: 'exam_date_completed',
  FOCUS_STARTED: 'focus_started',
  FOCUS_COMPLETED: 'focus_completed',
  FOCUS_SKIPPED: 'focus_skipped',
  DIAGNOSTIC_STARTED: 'diagnostic_started',
  DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
  PLAN_PREVIEW_VIEWED: 'plan_preview_viewed',
  PAYWALL_VIEWED: 'paywall_viewed',
  // The other half of a view. Without it you know who was asked but not
  // whether she said no or simply never answered, and those are different
  // problems with different fixes.
  PAYWALL_DISMISSED: 'paywall_dismissed',
  PAYWALL_CTA_CLICKED: 'paywall_cta_clicked',
  CHECKOUT_STARTED: 'checkout_started',
  PLAN_STARTED: 'plan_started',
  FLOW_ABANDONED: 'flow_abandoned',
});

/**
 * One id per upload attempt. Held in module scope rather than on `window`
 * because the flag it replaces (`window._pendingStudyJourney`) is exactly the
 * mutable global this file is trying not to add a second of.
 */
let currentFunnelId = null;
let currentFunnelContext = {};

/** Steps already written for the current funnel, for `logFunnelStepOnce`. */
const seenSteps = new Set();

/**
 * Begin a funnel. Called once when an upload starts.
 *
 * `context` is stamped onto every subsequent row so a single-row query can
 * segment without re-joining: entry point, first-upload flag, plan count and
 * question count at the moment the funnel began. Those last two are what turn
 * "she saw a paywall" into "she saw the plan gate at 3/3 with 40 questions
 * left", which is the difference between a number and a decision.
 */
export const startFunnel = (context = {}) => {
  currentFunnelId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  currentFunnelContext = { ...context };
  seenSteps.clear();
  devLog('📊 Funnel started:', currentFunnelId, context);
  return currentFunnelId;
};

/** Add or overwrite context on the running funnel (e.g. the exam date once known). */
export const enrichFunnel = (context = {}) => {
  currentFunnelContext = { ...currentFunnelContext, ...context };
};

export const getFunnelId = () => currentFunnelId;

/**
 * Write one step.
 *
 * Never throws and never returns a rejected promise: callers are UI event
 * handlers and must not have to defend against an analytics outage.
 */
export const logFunnelStep = (step, props = {}) => {
  try {
    if (!step) return Promise.resolve(null);

    // A step logged outside a funnel still tells us something (a paywall on a
    // path we have not instrumented), so record it rather than dropping it.
    const row = {
      step,
      funnelId: currentFunnelId,
      uid: auth.currentUser?.uid || null,
      isAnonymous: !auth.currentUser,
      ...currentFunnelContext,
      ...props,
      // Client clock for ordering within a funnel (serverTimestamp is null in
      // the local write and only resolves on the server, so two rows written
      // in the same tick cannot be ordered by it), server clock for truth.
      clientTs: Date.now(),
      createdAt: serverTimestamp(),
    };

    devLog(`📊 ${step}`, props);

    return addDoc(collection(db, COLLECTION), row).catch((err) => {
      // Best-effort: a lost row is a gap in a chart, not a broken study session.
      devLog('📊 funnel write failed (ignored):', err?.message);
      return null;
    });
  } catch (err) {
    devLog('📊 funnel step failed (ignored):', err?.message);
    return Promise.resolve(null);
  }
};

/**
 * Write a step at most once per funnel.
 *
 * For anything triggered by a render or an effect. Without this a card that
 * re-renders four times logs four `insights_viewed`, and every conversion
 * rate computed against that denominator is understated by 4x.
 */
export const logFunnelStepOnce = (step, props = {}) => {
  const key = `${currentFunnelId || 'nofunnel'}:${step}`;
  if (seenSteps.has(key)) return Promise.resolve(null);
  seenSteps.add(key);
  return logFunnelStep(step, props);
};

/**
 * Record a paywall opening, with the step the student had reached.
 *
 * Separate from logFunnelStep only to make `reason` and `reachedStep`
 * non-optional at the call site. Those two fields are the entire reason this
 * service was written — "which gate fired, and how much value had she already
 * been shown when it did".
 */
export const logPaywall = (reason, reachedStep, props = {}) =>
  logFunnelStep(FUNNEL.PAYWALL_VIEWED, {
    paywallReason: reason || 'unknown',
    reachedStep: reachedStep || null,
    ...props,
  });

export default logFunnelStep;
