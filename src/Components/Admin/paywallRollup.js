import { countryCodeForTimeZone, placeLabel } from './timezoneCountry';

/**
 * paywallRollup — who saw the upgrade modal, what opened it, and what they did next.
 *
 * WHY THIS EXISTS
 *
 * The paywall has written a row every time it opened since 2026-09-07, but the
 * only way to read those rows was a Python script against the Admin SDK. The
 * question that sent someone to run it — "no new Pro in days: is anyone even
 * seeing the paywall?" — has two opposite answers with opposite fixes:
 *
 *    few views               → the gates are not firing; copy work is wasted
 *    many views, no payments → the ask, the price or checkout is the problem
 *
 * The first read (2026-09-15) was the second case: 97 people had seen it, 14
 * had reached Stripe, and nobody had paid in four days. This screen makes that
 * a glance instead of a script.
 *
 * THE LOAD-BEARING DISTINCTIONS
 *
 *  - WALL vs BROWSE. A student stopped by a limit and a student who tapped the
 *    usage badge with budget left are different populations. Mixing them
 *    inflates the denominator of every rate below. `isWallView` keeps them
 *    apart, and counts the upload gate as a wall even when the row says
 *    otherwise: that gate consults no quota, and rows written before the fix
 *    landed (2026-09-14) were logged `blocked: false`.
 *
 *  - The drought is measured from the LAST NEW PRO, across all time, never
 *    clipped by the window selector. A 7-day window must not hide the fact that
 *    the last sale was nine days ago.
 *
 *  - Test accounts are dropped before anything is counted. The owner's own
 *    checkout tests would otherwise read as warm leads.
 *
 * Pure: Firestore shapes are flattened in `normalizeEvent`, so everything below
 * is plain objects and testable without a database.
 */

/** Accounts that are never counted. Lower-case; compared case-insensitively. */
export const TEST_EMAILS = ['fatsyram@gmail.com', 'ramampif@gmail.com'];

/** Triggers that mean the student was stopped, whatever `blocked` says. */
export const WALL_TRIGGERS = ['upload_gate', 'question_throttle', 'plan_quota', 'plan_ready'];

export const TRIGGER_LABELS = {
  badge: 'Usage badge',
  upload_gate: 'Upload gate',
  question_throttle: 'Question limit',
  account_menu: 'Account menu',
  plan_ready: 'Plan preview',
  plan_quota: 'Plan limit',
  manual: 'Other',
  unknown: 'Unknown',
};

export const STEPS = Object.freeze({
  VIEW: 'paywall_viewed',
  DISMISS: 'paywall_dismissed',
  CTA: 'paywall_cta_clicked',
  CHECKOUT: 'checkout_started',
});

const DAY_MS = 86400000;

/** Firestore Timestamp | Date | string | number | null → Date | null. */
const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === 'string' && v.trim() ? v : null);
const emailOf = (user) => (user && typeof user.email === 'string' ? user.email.toLowerCase() : null);

/** Local calendar day, so the chart's days match the reader's clock. */
export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Flatten one funnel row. Tolerant on purpose: early rows lack several fields,
 * and a missing one should cost that row one column, never the whole screen.
 */
export const normalizeEvent = (raw = {}) => ({
  id: raw.id || null,
  step: raw.step || null,
  uid: raw.uid || null,
  funnelId: str(raw.funnelId),
  // Server time is the truth; the client clock covers a row read before the
  // server timestamp resolved.
  at: toDate(raw.createdAt) || (typeof raw.clientTs === 'number' ? new Date(raw.clientTs) : null),
  trigger: raw.trigger || 'unknown',
  reason: raw.paywallReason || raw.reason || null,
  blocked: raw.blocked === true,
  questionsUsed: num(raw.questionsUsed),
  questionsLimit: num(raw.questionsLimit),
  plansUsed: num(raw.plansUsed),
  planLimit: num(raw.planLimit),
  examDaysAway: num(raw.examDaysAway),
  studyGoal: str(raw.studyGoal),
  topic: str(raw.topic),
  planId: str(raw.planId),
  // The verdict screen's button test (LockedPlanPreview): 'fix' or 'build'.
  ctaVariant: str(raw.ctaVariant),
  // Only on rows written after the capture shipped (2026-09-15); null on every
  // row before it. See FunnelService — this is the product's only geography.
  timeZone: str(raw.timeZone),
  locale: str(raw.locale),
});

export const isWallView = (view) => view.blocked || WALL_TRIGGERS.includes(view.trigger);

/** Uids to drop: a known test email, or a dev-tool placeholder study goal. */
export const findTestUids = (events, users = {}) => {
  const out = new Set();
  for (const e of events) {
    if (!e.uid) continue;
    if (e.studyGoal && e.studyGoal.includes('(Dev)')) out.add(e.uid);
    if (TEST_EMAILS.includes(emailOf(users[e.uid]))) out.add(e.uid);
  }
  return out;
};

const proStartOf = (user) => toDate(user?.billing?.proSince) || toDate(user?.billing?.firstProAt);

const countDistinct = (rows) => new Set(rows.map((r) => r.uid)).size;

/**
 * @param {Object} input
 * @param {Array}  input.events  Raw `funnelEvents` paywall rows.
 * @param {Object} input.users   uid → `users/{uid}` data (null when missing).
 * @param {Array}  input.pros    Every `usage.tier === 'pro'` user doc, with `id`.
 * @param {Date}   input.now
 * @param {number} input.days    Window for everything except the drought. 0 = all time.
 */
export const buildPaywallRollup = ({ events = [], users = {}, pros = [], now = new Date(), days = 30 } = {}) => {
  const all = events.map(normalizeEvent).filter((e) => e.uid && e.at);
  const testUids = findTestUids(all, users);
  const real = all.filter((e) => !testUids.has(e.uid)).sort((a, b) => a.at - b.at);

  const since = days > 0 ? new Date(now.getTime() - days * DAY_MS) : null;
  const inWindow = since ? real.filter((e) => e.at >= since) : real;
  const views = inWindow.filter((e) => e.step === STEPS.VIEW);

  // ── One row per person who saw it ───────────────────────────────────────
  const byUid = new Map();
  for (const v of views) {
    if (!byUid.has(v.uid)) byUid.set(v.uid, { views: [], dismissed: 0, checkouts: 0, plans: new Set() });
    byUid.get(v.uid).views.push(v);
  }
  for (const e of inWindow) {
    const p = byUid.get(e.uid);
    if (!p) continue;
    if (e.step === STEPS.DISMISS) p.dismissed += 1;
    if (e.step === STEPS.CHECKOUT) {
      p.checkouts += 1;
      if (e.planId) p.plans.add(e.planId);
    }
  }

  const people = [...byUid.entries()].map(([uid, p]) => {
    const user = users[uid] || {};
    const first = p.views[0];
    const last = p.views[p.views.length - 1];
    const counts = new Map();
    p.views.forEach((v) => counts.set(v.trigger, (counts.get(v.trigger) || 0) + 1));
    const isPro = user?.usage?.tier === 'pro';
    // Newest view that carried a timezone. Rows written before the capture
    // shipped have none, so one recent view is enough to place a person.
    const timeZone = [...p.views].reverse().find((v) => v.timeZone)?.timeZone || null;

    return {
      uid,
      email: str(user.email),
      name: str(user.displayName) || str(user.name),
      views: p.views.length,
      firstAt: first.at,
      lastAt: last.at,
      triggers: [...counts.entries()]
        .map(([trigger, count]) => ({ trigger, count }))
        .sort((a, b) => b.count - a.count),
      wall: p.views.some(isWallView),
      // The most recent view is the student's state now, not when she first saw it.
      questionsUsed: last.questionsUsed,
      questionsLimit: last.questionsLimit,
      plansUsed: last.plansUsed,
      planLimit: last.planLimit,
      examDaysAway: last.examDaysAway,
      studyGoal: last.studyGoal,
      topic: [...p.views].reverse().find((v) => v.topic)?.topic || null,
      timeZone,
      country: countryCodeForTimeZone(timeZone),
      place: placeLabel(timeZone),
      dismissed: p.dismissed,
      checkouts: p.checkouts,
      checkoutPlans: [...p.plans],
      // Firestore can say "Pro now" or "clicked through to Stripe". Whether an
      // unpaid checkout was abandoned or is still open lives only in Stripe.
      status: isPro ? 'paid' : p.checkouts > 0 ? 'checkout' : 'none',
      proSince: isPro ? proStartOf(user) : null,
    };
  }).sort((a, b) => b.lastAt - a.lastAt);

  const totals = {
    views: views.length,
    people: people.length,
    wallPeople: people.filter((r) => r.wall).length,
    browsePeople: people.filter((r) => !r.wall).length,
    checkoutPeople: people.filter((r) => r.checkouts > 0).length,
    paidPeople: people.filter((r) => r.status === 'paid').length,
    dismissals: inWindow.filter((e) => e.step === STEPS.DISMISS).length,
  };

  // ── What opened it ──────────────────────────────────────────────────────
  const triggerMap = new Map();
  for (const v of views) {
    const t = triggerMap.get(v.trigger) || { trigger: v.trigger, views: 0, wallViews: 0, uids: new Set() };
    t.views += 1;
    if (isWallView(v)) t.wallViews += 1;
    t.uids.add(v.uid);
    triggerMap.set(v.trigger, t);
  }
  const byTrigger = [...triggerMap.values()]
    .map(({ uids, ...t }) => ({ ...t, people: uids.size }))
    .sort((a, b) => b.views - a.views);

  // ── Where they are ──────────────────────────────────────────────────────
  // Counted per person, not per view: the question is how many students are in
  // a place, and one student with nine views would otherwise look like a crowd.
  const placeMap = new Map();
  for (const r of people) {
    const key = r.country || r.timeZone || 'unknown';
    const c = placeMap.get(key) || { key, code: r.country, label: r.place || 'Unknown', people: 0, views: 0 };
    c.people += 1;
    c.views += r.views;
    placeMap.set(key, c);
  }
  const byCountry = [...placeMap.values()].sort((a, b) => {
    // "Unknown" is a hole in the data, not a place: it sits last however big.
    if (a.key === 'unknown') return 1;
    if (b.key === 'unknown') return -1;
    return b.people - a.people;
  });

  // ── Views per day, with empty days filled so a quiet day reads as zero ──
  const dayMap = new Map();
  for (const v of views) {
    const key = dayKey(v.at);
    const d = dayMap.get(key) || { views: 0, uids: new Set() };
    d.views += 1;
    d.uids.add(v.uid);
    dayMap.set(key, d);
  }
  const byDay = [];
  if (views.length > 0) {
    const cursor = new Date(views[0].at.getFullYear(), views[0].at.getMonth(), views[0].at.getDate());
    const lastKey = dayKey(views[views.length - 1].at);
    for (let guard = 0; guard < 1000; guard += 1) {
      const key = dayKey(cursor);
      const d = dayMap.get(key);
      byDay.push({ day: key, views: d ? d.views : 0, people: d ? d.uids.size : 0 });
      if (key === lastKey) break;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // ── The drought, across all time ────────────────────────────────────────
  const realPros = pros
    .filter((u) => !TEST_EMAILS.includes(emailOf(u)))
    .map((u) => ({ uid: u.id || null, email: str(u.email), at: proStartOf(u) }))
    .filter((p) => p.at)
    .sort((a, b) => b.at - a.at);

  const lastPro = realPros[0]
    ? { ...realPros[0], daysAgo: Math.floor((now.getTime() - realPros[0].at.getTime()) / DAY_MS) }
    : null;

  let sinceLastPro = null;
  if (lastPro) {
    const after = real.filter((e) => e.at > lastPro.at);
    const afterViews = after.filter((e) => e.step === STEPS.VIEW);
    const seenBefore = new Set(
      real.filter((e) => e.step === STEPS.VIEW && e.at <= lastPro.at).map((e) => e.uid)
    );
    const viewers = new Set(afterViews.map((e) => e.uid));
    sinceLastPro = {
      views: afterViews.length,
      people: viewers.size,
      firstTimePeople: [...viewers].filter((uid) => !seenBefore.has(uid)).length,
      wallPeople: countDistinct(afterViews.filter(isWallView)),
      checkoutPeople: countDistinct(after.filter((e) => e.step === STEPS.CHECKOUT)),
    };
  }

  return {
    totals,
    byTrigger,
    byCountry,
    // How many people can be placed at all. Without it a country table reads as
    // the whole population when it may describe three of ninety-seven.
    placesKnown: people.filter((r) => r.timeZone).length,
    byDay,
    people,
    lastPro,
    sinceLastPro,
    hiddenTestAccounts: testUids.size,
    // Exposed so sibling rollups (readinessFunnel) drop the same accounts.
    testUids: [...testUids],
  };
};
