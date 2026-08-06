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
import UpgradeModal from '../../Components/Common/UpgradeModal';
import UsageBadge from '../../Components/Common/UsageBadge';

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
      openUpgrade: () => {},
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
  const requireQuota = useCallback(() => {
    const live = deriveQuota(usageRef.current, Date.now());
    if (live.canGenerate) return true;
    setUpgradeReason('questions');
    setShowUpgrade(true);
    return false;
  }, []);

  // Plan gate — call BEFORE generating a new study plan. Generating a path
  // plus its first node is the most expensive call in the product, so this
  // blocks before the spend rather than at the commit point.
  const requirePlanQuota = useCallback(() => {
    const live = derivePlanQuota(planUsageRef.current, usageRef.current?.tier, Date.now());
    if (live.canCreatePlan) return true;
    setUpgradeReason('plans');
    setShowUpgrade(true);
    return false;
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
    openUpgrade: (reason = null) => {
      setUpgradeReason(typeof reason === 'string' ? reason : null);
      setShowUpgrade(true);
    },
  }), [quota, planQuota, requireQuota, consume, refresh, requirePlanQuota, consumePlan]);

  return (
    <UsageContext.Provider value={value}>
      {children}
      {uid && (
        <UsageBadge
          isPro={quota.isPro}
          remaining={quota.remaining}
          limit={quota.limit}
          msUntilReset={quota.msUntilReset}
          onClick={() => setShowUpgrade(true)}
        />
      )}
      <UpgradeModal
        isOpen={showUpgrade}
        isPro={quota.isPro}
        onClose={() => { setShowUpgrade(false); setUpgradeReason(null); }}
        reason={upgradeReason}
        limit={quota.limit}
        remaining={quota.remaining}
        msUntilReset={quota.msUntilReset}
        planLimit={planQuota.limit}
        plansRemaining={planQuota.remaining}
        planMsUntilReset={planQuota.msUntilReset}
        user={{ uid: currentUser?.uid, email: currentUser?.email }}
        studyGoal={studyGoal}
        examDate={examDate}
      />
    </UsageContext.Provider>
  );
}

export default UsageContext;
