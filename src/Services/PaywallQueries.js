import { db } from "../Firebase/config";
import { collection, query, where, limit, getDocs, getDoc, doc } from "firebase/firestore";
import { devLog } from "./devLogger";

/**
 * PaywallQueries — the read side of the paywall rows in `funnelEvents`.
 *
 * Same contract as SatisfactionQueries: this feeds a dev-only admin screen, so
 * failures THROW and the caller renders them. A silently empty paywall tracker
 * reads as "nobody is hitting the paywall", which is the exact wrong conclusion
 * to draw during a week with no new subscribers.
 *
 * WHY THE QUERY IS SHAPED LIKE THIS
 *
 * Equality on `step` only — no `createdAt` range and no `orderBy`. Combining a
 * range or order on one field with a filter on another needs a composite index,
 * and this project has none; the query would fail with FailedPrecondition. The
 * paywall steps are a small slice of the collection (~50 rows a day against
 * ~500 for the whole funnel), so the rollup applies the date window client-side.
 */

const FUNNEL_COLLECTION = "funnelEvents";

/** Every step the tracker reads. Mirrors FUNNEL in FunnelService. */
export const PAYWALL_STEPS = [
  "paywall_viewed",
  "paywall_dismissed",
  "paywall_cta_clicked",
  "checkout_started",
];

/**
 * Hard ceiling so a runaway query can't pull an unbounded collection into a
 * tab. Without an orderBy, a capped read drops arbitrary rows rather than the
 * oldest ones, so the screen warns when it is reached instead of pretending
 * the numbers are complete.
 */
export const MAX_PAYWALL_ROWS = 5000;

/** @returns {Promise<Array>} Raw paywall-step rows with `id` attached. */
export const fetchPaywallEvents = async () => {
  const snap = await getDocs(query(
    collection(db, FUNNEL_COLLECTION),
    where("step", "in", PAYWALL_STEPS),
    limit(MAX_PAYWALL_ROWS)
  ));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  devLog(`📥 paywall: ${rows.length} funnel rows`);
  return rows;
};

/**
 * The upload-side steps the readiness funnel reads. Mirrors READINESS_STEPS in
 * Components/Admin/readinessFunnel.js — kept as a plain list here so this
 * service doesn't import from a component.
 */
export const READINESS_FUNNEL_STEPS = [
  "upload_started",
  "upload_completed",
  "readiness_check_started",
  "weakness_insight_viewed",
  "readiness_rechecked",
  "quick_check_completed",
  "diagnostic_completed",
];

/**
 * Larger cap than the paywall read: upload_started alone is ~35 rows a day.
 * Same caveat — no orderBy, so hitting it drops arbitrary rows, and the screen
 * says so rather than showing a quietly short funnel.
 */
export const MAX_READINESS_ROWS = 10000;

/** @returns {Promise<Array>} Raw upload/readiness rows with `id` attached. */
export const fetchReadinessEvents = async () => {
  const snap = await getDocs(query(
    collection(db, FUNNEL_COLLECTION),
    where("step", "in", READINESS_FUNNEL_STEPS),
    limit(MAX_READINESS_ROWS)
  ));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  devLog(`📥 readiness: ${rows.length} funnel rows`);
  return rows;
};

/**
 * Resolve test accounts to uids in one query, so the readiness funnel can drop
 * them without reading a user doc for every uploader. `in` takes at most 30.
 *
 * @param {string[]} emails
 * @returns {Promise<string[]>}
 */
export const fetchUidsByEmail = async (emails = []) => {
  if (!emails.length) return [];
  const snap = await getDocs(query(collection(db, "users"), where("email", "in", emails.slice(0, 30))));
  return snap.docs.map((d) => d.id);
};

/**
 * Load `users/{uid}` for every uid on the page — email, tier and billing dates.
 * One read per person; the tracker shows at most a few hundred.
 *
 * @param {string[]} uids
 * @returns {Promise<Object>} uid → user data, or null when the doc is missing.
 */
export const fetchUsers = async (uids = []) => {
  const entries = await Promise.all(uids.map(async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    return [uid, snap.exists() ? snap.data() : null];
  }));
  return Object.fromEntries(entries);
};

/**
 * Everyone who has paid: current Pro accounts, plus anyone the webhook ever
 * stamped with `billing.firstProAt`.
 *
 * Current Pro alone is not enough. A student who paid after her verdict and
 * cancelled after her exam is still a conversion from that verdict, and the
 * downgrade flips `usage.tier` back to free — so a tier-only read would quietly
 * erase her from every conversion rate, starting with the first renewals
 * (2026-09-20). The downgrade never clears `firstProAt`, which is why it is the
 * second half of this union. Two single-field queries; no composite index.
 *
 * @returns {Promise<Array>} User docs with `id` attached, one per user.
 */
export const fetchPayingUsers = async () => {
  const [current, ever] = await Promise.all([
    getDocs(query(collection(db, "users"), where("usage.tier", "==", "pro"))),
    getDocs(query(collection(db, "users"), where("billing.firstProAt", ">", new Date(0)))),
  ]);
  const byId = new Map();
  [...current.docs, ...ever.docs].forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
  return [...byId.values()];
};
