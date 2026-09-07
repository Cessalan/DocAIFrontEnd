/**
 * UsageContext
 * App-wide access to the AI-generation throttle (monetization gate).
 *
 * Exposes a live quota view (with the rolling-window reset applied in-memory,
 * ticking a countdown when the bucket is empty) plus two action helpers:
 *
 *   requireQuota()  -> boolean. Call BEFORE generating. Returns true if the
 *                      user may generate; otherwise opens the upgrade modal
 *                      and returns false. Gate point: `if (!requireQuota()) return;`
 *   consume()       -> Promise. Call AFTER a generation actually completes to
 *                      charge one unit against the rolling window.
 *
 * The provider also renders the <UpgradeModal>, so any gate point anywhere in
 * the tree can surface the paywall just by calling requireQuota().
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../AuthContext/AuthContext';
import {
  getQuota,
  consumeGeneration,
  deriveQuota,
  getPlanQuota,
  consumePlan as consumePlanUnit,
  derivePlanQuota,
} from '../../Services/UsageService';
import { logPaywall, logFunnelStep, FUNNEL } from '../../Services/FunnelService';
import { daysUntilExam } from '../../Components/Common/upgradeCopy';
import UpgradeModal from '../../Components/Common/UpgradeModal';
import UsageBadge from '../../Components/Common/UsageBadge';
import { cleanTopicLabel } from '../../Components/Common/upgradeCopy';

const UsageContext = createContext(null);

export const useUsageLimit = () => {
  const ctx = useContext(UsageContext);
  if (!ctx) {
    // Defensive default so a component rendered outside the provider (tests,
    // public pages) degrades to "always allowed" instead of crashing.
    return {
      isPro: true, limit: 0, used: 0, remaining: Infinity, canGenerate: true,
      msUntilReset: 0, requireQuota: () => true, consume: async () => {}, refresh: async () => {},
      planLimit: 0, plansUsed: 0, plansRemaining: Infinity, canCreatePlan: true,
      planMsUntilReset: 0, requirePlanQuota: () => true, consumePlan: async () => {},
      openUpgrade: () => {}, simulateLimit: () => {},
    };
  }
  return ctx;
};

export function UsageProvider({ children }) {
  const { currentUser, userProfile } = useAuth() || {};
  const uid = currentUser?.uid || null;

  // Onboarding signals for personalizing the upgrade modal (all optional).
  const studyGoal = userProfile?.onboarding?.studyGoal || null;
  const examDate = userProfile?.onboarding?.examDate || userProfile?.examDate || null;

  // Raw normalized usage: { tier, windowStart, count }. Derived values are
  // recomputed from this on every render against `now`.
  const [usage, setUsage] = useState({ tier: 'free', windowStart: 0, count: 0 });
  const [now, setNow] = useState(Date.now());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const usageRef = useRef(usage);
  usageRef.current = usage;

  // Second, independent meter: NEW study plans per rolling 30 days.
  // See the PLAN QUOTA block in UsageService for why this is separate.
  const [planUsage, setPlanUsage] = useState({ windowStart: 0, count: 0 });
  const planUsageRef = useRef(planUsage);
  planUsageRef.current = planUsage;

  // Which gate opened the modal — drives whether it talks about questions
  // or about study plans. Reset when the modal closes.
  const [upgradeReason, setUpgradeReason] = useState(null);

  // What the user was in the middle of when we interrupted them. The paywall
  // names it back ("You were practicing: Cardiac Pharmacology") — a generic
  // "you hit a limit" loses the only context that makes the offer feel like
  // a continuation instead of a toll booth. Null = card is not rendered.
  const [upgradeTopic, setUpgradeTopic] = useState(null);

  // ── Dev-only paywall preview ─────────────────────────────────────────────
  // The paywall is the hardest surface in the app to reach deliberately: you
  // have to burn a real quota to see it, and the copy branches on gate ×
  // exam-date × onboarding goal. This holds substitute numbers so the modal can
  // be forced open in its BLOCKED state for review. Null = not simulating.
  // Set only by simulateLimit(), which is itself a no-op in production builds.
  const [devSim, setDevSim] = useState(null);

  /* ══════════════════════════════════════════════════════════════════════
     PAYWALL VIEW INSTRUMENTATION

     Every route to the modal ends at setShowUpgrade(true) — requireQuota,
     requirePlanQuota, openUpgrade, the badge tap and simulateLimit. Logging
     HERE rather than at each call site is what makes the count trustworthy:
     a new gate added later is instrumented by construction, and no site can
     forget to report itself.

     Why this had to exist: until now the product emitted nothing when a
     paywall opened. We could see that ~14 people ever reached Stripe, but not
     how many were ever ASKED — and those two numbers imply opposite fixes. If
     hundreds saw a wall and 14 clicked, the copy is wrong. If twenty saw one,
     the gates simply never fire. Nobody could tell which.

     `trigger` (HOW it opened) is recorded separately from `reason` (WHICH copy
     it showed), because they are not the same question and today they collide:
     the upload gate and a voluntary badge tap both call openUpgrade(null, …),
     so in the old world they were indistinguishable — one is a wall, the other
     is a person volunteering to buy. Grouping those together would have made
     the numbers actively misleading.

     `blocked` separates a WALL from a BROWSE: opening the modal with budget
     left is a pull signal, and mixing it into the wall count inflates the
     denominator of every conversion rate below it.
     ══════════════════════════════════════════════════════════════════════ */

  // True while the modal is up, so a second blocked attempt against an
  // already-open paywall does not count as a second view. Re-opening it later
  // does — those are two separate asks.
  const paywallOpenRef = useRef(false);

  const recordPaywallView = useCallback((trigger, reason, ctx) => {
    try {
      if (paywallOpenRef.current) return;      // already on screen
      paywallOpenRef.current = true;

      const liveQ = deriveQuota(usageRef.current, Date.now());
      const liveP = derivePlanQuota(planUsageRef.current, usageRef.current?.tier, Date.now());

      // A Pro account opening this sees the manage-subscription screen. That
      // is a billing surface, not a paywall, and counting it would pollute
      // every rate computed from this collection.
      if (liveQ.isPro) return;

      const blocked = reason === 'plans' || reason === 'plan_ready'
        ? liveP.remaining <= 0
        : liveQ.remaining <= 0;

      logPaywall(reason || 'none', ctx?.reachedStep || null, {
        trigger: trigger || 'manual',
        blocked,
        tier: liveQ.tier,
        questionsUsed: liveQ.used,
        questionsLimit: liveQ.limit,
        questionsRemaining: liveQ.remaining,
        msUntilReset: liveQ.msUntilReset,
        plansUsed: liveP.used,
        planLimit: liveP.limit,
        plansRemaining: liveP.remaining,
        planMsUntilReset: liveP.msUntilReset,
        topic: cleanTopicLabel(ctx?.topic) || null,
        studyGoal: studyGoal || null,
        // Now that the exam date is stored as a parseable ISO string, this is
        // the field that says whether urgency copy was even available.
        examDaysAway: daysUntilExam(examDate),
        // Which surface she was on. /c/{chatId} in practice, so it doubles as
        // a chat correlation key without threading chatId through the context.
        path: typeof window !== 'undefined' ? window.location?.pathname || null : null,
      });
    } catch {
      /* never let instrumentation break a paywall */
    }
  }, [studyGoal, examDate]);

  // Fetch quota whenever the signed-in user changes.
  const refresh = useCallback(async () => {
    if (!uid) {
      setUsage({ tier: 'free', windowStart: 0, count: 0 });
      setPlanUsage({ windowStart: 0, count: 0 });
      return;
    }
    const [q, p] = await Promise.all([getQuota(uid), getPlanQuota(uid)]);
    setUsage({ tier: q.tier, windowStart: q.windowStart, count: q.used });
    setPlanUsage({ windowStart: p.windowStart, count: p.used });
  }, [uid]);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-check tier when the tab regains focus — catches the return trip from
  // Stripe (checkout or billing portal) so an upgrade/cancel shows without a
  // hard reload. (The webhook may lag the redirect by a few seconds; the next
  // focus/refresh picks it up.)
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  // Live quota view derived against the current tick.
  const quota = useMemo(() => deriveQuota(usage, now), [usage, now]);

  // Only tick (1s) while a countdown is actually visible — i.e. the modal is
  // open or the free bucket is empty. Avoids re-rendering the whole app tree
  // every second for no reason.
  const needsTick = !quota.isPro && (showUpgrade || quota.remaining <= 0);
  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  // Gate helper — returns whether generation is allowed, opening the modal if not.
  // `ctx.topic` (optional) is what the caller was about to generate; it becomes
  // the "You were practicing: …" line on the paywall.
  const requireQuota = useCallback((ctx = null) => {
    const live = deriveQuota(usageRef.current, Date.now());
    if (live.canGenerate) return true;
    recordPaywallView('question_throttle', 'questions', ctx);
    setUpgradeReason('questions');
    setUpgradeTopic(cleanTopicLabel(ctx?.topic));
    setShowUpgrade(true);
    return false;
  }, [recordPaywallView]);

  // Plan gate — call BEFORE generating a new study plan. Generating a path
  // plus its first node is the most expensive call in the product, so this
  // blocks before the spend rather than at the commit point.
  const requirePlanQuota = useCallback((ctx = null) => {
    const live = derivePlanQuota(planUsageRef.current, usageRef.current?.tier, Date.now());
    if (live.canCreatePlan) return true;
    recordPaywallView('plan_quota', 'plans', ctx);
    setUpgradeReason('plans');
    setUpgradeTopic(cleanTopicLabel(ctx?.topic));
    setShowUpgrade(true);
    return false;
  }, [recordPaywallView]);

  /**
   * Dev-only: open the upgrade modal exactly as a blocked FREE user sees it —
   * out of budget, and not subscribed — regardless of the signed-in account's
   * real tier. Real usage is never written or mutated; only the props handed
   * to <UpgradeModal> are substituted, and only while the modal is open.
   * No-op in production builds.
   *
   * @param {'questions'|'plans'} reason - which gate to simulate
   * @param {{ topic?: string }} [ctx]   - what they were "working on"
   */
  const simulateLimit = useCallback((reason = 'questions', ctx = null) => {
    if (process.env.NODE_ENV !== 'development') return;
    const live = deriveQuota(usageRef.current, Date.now());
    setDevSim({
      // A truly blocked user has spent the whole bucket; borrow the real count
      // when there is one so the number on screen matches this account.
      used: live.used > 0 ? live.used : live.limit,
      msUntilReset: live.msUntilReset > 0 ? live.msUntilReset : 5 * 24 * 60 * 60 * 1000,  // ~5 days
      planMsUntilReset: 11 * 24 * 60 * 60 * 1000,                                         // ~11 days
    });
    setUpgradeReason(reason === 'plans' ? 'plans' : 'questions');
    setUpgradeTopic(cleanTopicLabel(ctx?.topic));
    setShowUpgrade(true);
  }, []);

  // Charge one plan. Call AFTER createStudySession succeeds — the preview
  // flow is deliberately side-effect-free, so an abandoned preview is free.
  const consumePlan = useCallback(async () => {
    if (!uid) return;
    const p = await consumePlanUnit(uid);
    setPlanUsage({ windowStart: p.windowStart, count: p.used });
  }, [uid]);

  // Charge `amount` units (questions/cards) after a successful generation.
  const consume = useCallback(async (amount = 1) => {
    if (!uid) return;
    const q = await consumeGeneration(uid, amount);
    setUsage({ tier: q.tier, windowStart: q.windowStart, count: q.used });
  }, [uid]);

  const planQuota = useMemo(
    () => derivePlanQuota(planUsage, usage.tier, now),
    [planUsage, usage.tier, now]
  );

  const value = useMemo(() => ({
    tier: quota.tier,
    isPro: quota.isPro,
    limit: quota.limit,
    used: quota.used,
    remaining: quota.remaining,
    canGenerate: quota.canGenerate,
    msUntilReset: quota.msUntilReset,
    requireQuota,
    consume,
    refresh,
    // Plan meter
    planLimit: planQuota.limit,
    plansUsed: planQuota.used,
    plansRemaining: planQuota.remaining,
    canCreatePlan: planQuota.canCreatePlan,
    planMsUntilReset: planQuota.msUntilReset,
    requirePlanQuota,
    consumePlan,
    /**
     * Open the modal directly.
     *
     * `ctx.trigger` says WHAT opened it and should be passed by every caller.
     * Without it the upload gate (a hard block) and a badge tap (someone
     * volunteering to buy) both arrive as `openUpgrade(null, {topic})` and are
     * indistinguishable in the data — which is how you end up computing a
     * conversion rate over two populations that have nothing in common.
     */
    openUpgrade: (reason = null, ctx = null) => {
      const normalizedReason = typeof reason === 'string' ? reason : null;
      recordPaywallView(ctx?.trigger || normalizedReason || 'manual', normalizedReason, ctx);
      setUpgradeReason(normalizedReason);
      setUpgradeTopic(cleanTopicLabel(ctx?.topic));
      setShowUpgrade(true);
    },
    simulateLimit,
  }), [quota, planQuota, requireQuota, consume, refresh, requirePlanQuota, consumePlan, simulateLimit, recordPaywallView]);

  return (
    <UsageContext.Provider value={value}>
      {children}
      {uid && (
        <UsageBadge
          isPro={quota.isPro}
          remaining={quota.remaining}
          limit={quota.limit}
          msUntilReset={quota.msUntilReset}
          onClick={() => {
            // Nobody blocked her — she tapped the meter and asked to see the
            // offer. Two of the traceable checkout-openers arrived this way,
            // so pull is a real channel and must not be filed under "wall".
            recordPaywallView('badge', null, null);
            setUpgradeReason(null); setUpgradeTopic(null); setShowUpgrade(true);
          }}
        />
      )}
      <UpgradeModal
        isOpen={showUpgrade}
        // Simulating always shows the FREE-user pitch. Without this a Pro
        // account (which every dev account eventually becomes) gets the
        // manage-subscription branch instead — i.e. never the screen being
        // reviewed. Only the modal's props are faked; the real tier is intact.
        isPro={devSim ? false : quota.isPro}
        onClose={() => {
          if (paywallOpenRef.current) {
            paywallOpenRef.current = false;
            if (!quota.isPro) logFunnelStep(FUNNEL.PAYWALL_DISMISSED, { reason: upgradeReason || 'none' });
          }
          setShowUpgrade(false); setUpgradeReason(null); setUpgradeTopic(null); setDevSim(null);
        }}
        reason={upgradeReason}
        topic={upgradeTopic}
        limit={quota.limit}
        used={devSim ? devSim.used : quota.used}
        remaining={devSim ? 0 : quota.remaining}
        msUntilReset={devSim ? devSim.msUntilReset : quota.msUntilReset}
        planLimit={planQuota.limit}
        plansRemaining={devSim ? 0 : planQuota.remaining}
        planMsUntilReset={devSim ? devSim.planMsUntilReset : planQuota.msUntilReset}
        user={{ uid: currentUser?.uid, email: currentUser?.email }}
        studyGoal={studyGoal}
        examDate={examDate}
      />
    </UsageContext.Provider>
  );
}

export default UsageContext;
