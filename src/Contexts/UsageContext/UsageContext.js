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
import { getQuota, consumeGeneration, deriveQuota } from '../../Services/UsageService';
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

  // Fetch quota whenever the signed-in user changes.
  const refresh = useCallback(async () => {
    if (!uid) {
      setUsage({ tier: 'free', windowStart: 0, count: 0 });
      return;
    }
    const q = await getQuota(uid);
    setUsage({ tier: q.tier, windowStart: q.windowStart, count: q.used });
  }, [uid]);

  useEffect(() => { refresh(); }, [refresh]);

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
    setShowUpgrade(true);
    return false;
  }, []);

  // Charge `amount` units (questions/cards) after a successful generation.
  const consume = useCallback(async (amount = 1) => {
    if (!uid) return;
    const q = await consumeGeneration(uid, amount);
    setUsage({ tier: q.tier, windowStart: q.windowStart, count: q.used });
  }, [uid]);

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
    openUpgrade: () => setShowUpgrade(true),
  }), [quota, requireQuota, consume, refresh]);

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
        onClose={() => setShowUpgrade(false)}
        limit={quota.limit}
        remaining={quota.remaining}
        msUntilReset={quota.msUntilReset}
        user={{ uid: currentUser?.uid, email: currentUser?.email }}
        studyGoal={studyGoal}
        examDate={examDate}
      />
    </UsageContext.Provider>
  );
}

export default UsageContext;
