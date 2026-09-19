import { normalizeEvent, STEPS as PAYWALL_STEPS } from './paywallRollup';

/**
 * readinessFunnel — does seeing a weakness finding make a student pay?
 *
 * WHY THIS EXISTS
 *
 * The readiness-engine strategy (2026-09-16) bets that the purchase trigger is
 * the moment a student sees, with evidence, where she is weak — not the moment
 * she runs out of questions. That bet is only testable if two numbers are on
 * screen: how many uploads reach a finding, and how many of those students pay
 * within a week.
 *
 * Until the readiness check ships, the only scored result a new upload produces
 * is the 2-question quick check (plus the derived diagnostic). It is shown as a
 * PROXY row, labelled as one, and never merged into the finding count — a
 * two-question recall score is not the verdict the strategy is about, and
 * blending them would make the launch look like a smaller change than it is.
 * Baseline when this was written (14 days): 34.5% of uploads reached that
 * proxy; 4 of 115 such students paid, against 2 of 122 without one.
 *
 * RULES
 *
 *  - The unit is the upload funnel (`funnelId`), as in FunnelService: three
 *    decks are three funnels.
 *  - "Paid within 7 days" is judged only for people whose moment is at least
 *    7 days old. Yesterday's finding that hasn't paid yet is not a miss, and
 *    counting it as one understates every rate during a launch week. Recent
 *    people are reported separately as "too recent".
 *  - Someone who was already Pro at that moment is not a conversion from it,
 *    and is left out of the rate.
 *  - A person lands in the best group she reached: finding > proxy > neither,
 *    anchored on the first time she reached it.
 *  - The paywall and checkout stages count only when they come AFTER the
 *    finding in the same funnel. A paywall before the verdict says nothing
 *    about the verdict.
 *
 * Pure. Rows are flattened by paywallRollup's `normalizeEvent`.
 */

export const READINESS_STEPS = Object.freeze({
  UPLOAD_STARTED: 'upload_started',
  UPLOAD_COMPLETED: 'upload_completed',
  CHECK_STARTED: 'readiness_check_started',
  FINDING: 'weakness_insight_viewed',
  RECHECKED: 'readiness_rechecked',
  QUICK_CHECK: 'quick_check_completed',
  DIAGNOSTIC: 'diagnostic_completed',
});

const PROXY_STEPS = [READINESS_STEPS.QUICK_CHECK, READINESS_STEPS.DIAGNOSTIC];

export const CONVERSION_WINDOW_DAYS = 7;

const DAY_MS = 86400000;
const GROUP_RANK = { finding: 3, proxy: 2, neither: 1 };

export const GROUP_LABELS = {
  finding: 'Saw a weakness finding',
  proxy: 'Quick-check score only (proxy)',
  neither: 'Neither',
};

const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** The first time she paid; the current run's start only as a fallback. */
const firstPaidAt = (user) => toDate(user?.billing?.firstProAt) || toDate(user?.billing?.proSince);

const earliest = (dates) => dates.filter(Boolean).sort((a, b) => a - b)[0] || null;

const blankGroup = (key) => ({
  key,
  label: GROUP_LABELS[key],
  people: 0,
  judged: 0,
  paid: 0,
  tooRecent: 0,
  // Paid already, but still inside the window. Kept out of the rate (judging
  // only early payers would inflate it) and shown beside "too recent", so a
  // launch-week conversion is visible the day it happens.
  tooRecentPaid: 0,
  alreadyPro: 0,
  rate: null,
});

/**
 * @param {Object} input
 * @param {Array}  input.events       Raw funnel rows: upload/readiness steps AND paywall steps.
 * @param {Array}  input.pros         Pro user docs with `id` (for payment dates).
 * @param {Array}  input.excludeUids  Test accounts to drop.
 * @param {Date}   input.now
 * @param {number} input.days         Window on the upload's start. 0 = all time.
 */
export const buildReadinessFunnel = ({ events = [], pros = [], excludeUids = [], now = new Date(), days = 30 } = {}) => {
  const exclude = new Set(excludeUids);
  const since = days > 0 ? now.getTime() - days * DAY_MS : null;

  // funnelId → { uid, steps: step → first time it happened }
  const funnels = new Map();
  for (const e of events.map(normalizeEvent)) {
    if (!e.at || !e.funnelId || (e.uid && exclude.has(e.uid))) continue;
    const f = funnels.get(e.funnelId) || { uid: null, steps: new Map() };
    if (e.uid) f.uid = e.uid;
    if (e.step === READINESS_STEPS.FINDING && e.ctaVariant) f.variant = e.ctaVariant;
    const seen = f.steps.get(e.step);
    if (!seen || e.at < seen) f.steps.set(e.step, e.at);
    funnels.set(e.funnelId, f);
  }

  const uploads = [...funnels.values()].filter((f) => {
    const started = f.steps.get(READINESS_STEPS.UPLOAD_STARTED);
    return started && (since === null || started.getTime() >= since);
  });

  const has = (f, step) => f.steps.has(step);
  const findingAt = (f) => f.steps.get(READINESS_STEPS.FINDING) || null;
  const proxyAt = (f) => earliest(PROXY_STEPS.map((s) => f.steps.get(s)));
  const afterFinding = (f, step) => {
    const at = f.steps.get(step);
    const anchor = findingAt(f);
    return Boolean(at && anchor && at >= anchor);
  };
  const count = (pred) => uploads.filter(pred).length;

  const stages = [
    { key: 'uploads', label: 'Uploads started', count: uploads.length },
    { key: 'completed', label: 'Upload completed', count: count((f) => has(f, READINESS_STEPS.UPLOAD_COMPLETED)) },
    { key: 'check', label: 'Readiness check started', count: count((f) => has(f, READINESS_STEPS.CHECK_STARTED)) },
    { key: 'finding', label: 'Saw a weakness finding', count: count((f) => has(f, READINESS_STEPS.FINDING)) },
    { key: 'findingPaywall', label: 'Then saw the paywall', count: count((f) => afterFinding(f, PAYWALL_STEPS.VIEW)) },
    { key: 'findingCheckout', label: 'Then started checkout', count: count((f) => afterFinding(f, PAYWALL_STEPS.CHECKOUT)) },
    { key: 'proxy', label: 'Quick-check score (current proxy)', count: count((f) => Boolean(proxyAt(f))), proxy: true },
  ].map((s) => ({ ...s, share: uploads.length ? s.count / uploads.length : null }));

  // ── The verdict screen's button test ───────────────────────────────────
  // Per upload that showed a verdict under a known label. Clicks and checkouts
  // only count when they come after that verdict, as for the stages above.
  const variantMap = new Map();
  for (const f of uploads) {
    if (!findingAt(f) || !f.variant) continue;
    const v = variantMap.get(f.variant) || { variant: f.variant, shown: 0, clicked: 0, checkout: 0 };
    v.shown += 1;
    if (afterFinding(f, PAYWALL_STEPS.CTA)) v.clicked += 1;
    if (afterFinding(f, PAYWALL_STEPS.CHECKOUT)) v.checkout += 1;
    variantMap.set(f.variant, v);
  }
  const byCtaVariant = [...variantMap.values()].sort((a, b) => a.variant.localeCompare(b.variant));

  // ── One place per person: the best moment she reached ──────────────────
  const people = new Map();
  for (const f of uploads) {
    if (!f.uid) continue; // a logged-out upload can't be followed to a payment
    const candidate = findingAt(f)
      ? { group: 'finding', anchor: findingAt(f) }
      : proxyAt(f)
        ? { group: 'proxy', anchor: proxyAt(f) }
        : { group: 'neither', anchor: f.steps.get(READINESS_STEPS.UPLOAD_STARTED) };
    const prev = people.get(f.uid);
    const better = !prev
      || GROUP_RANK[candidate.group] > GROUP_RANK[prev.group]
      || (candidate.group === prev.group && candidate.anchor < prev.anchor);
    if (better) people.set(f.uid, candidate);
  }

  const paidAt = new Map();
  for (const u of pros) {
    const at = firstPaidAt(u);
    if (u.id && at) paidAt.set(u.id, at);
  }

  const groups = { finding: blankGroup('finding'), proxy: blankGroup('proxy'), neither: blankGroup('neither') };
  for (const [uid, { group, anchor }] of people) {
    const g = groups[group];
    g.people += 1;
    const paid = paidAt.get(uid);
    if (paid && paid < anchor) {
      g.alreadyPro += 1;
      continue;
    }
    const deadline = anchor.getTime() + CONVERSION_WINDOW_DAYS * DAY_MS;
    const converted = Boolean(paid && paid.getTime() <= deadline);
    if (now.getTime() < deadline) {
      g.tooRecent += 1;
      if (converted) g.tooRecentPaid += 1;
      continue;
    }
    g.judged += 1;
    if (converted) g.paid += 1;
  }
  Object.values(groups).forEach((g) => { g.rate = g.judged ? g.paid / g.judged : null; });

  // The strategy's north-star, per PERSON: of everyone who uploaded in the
  // window, how many reached a finding. The stage table above is per upload.
  const uploaders = people.size;
  const reachedFinding = groups.finding.people;

  return {
    uploads: uploads.length,
    reach: {
      uploaders,
      finding: reachedFinding,
      share: uploaders ? reachedFinding / uploaders : null,
    },
    stages,
    byCtaVariant,
    groups: [groups.finding, groups.proxy, groups.neither],
    windowDays: CONVERSION_WINDOW_DAYS,
  };
};
