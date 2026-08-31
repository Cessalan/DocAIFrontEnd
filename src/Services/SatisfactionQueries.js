import { db } from "../Firebase/config";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { devLog } from "./devLogger";

/**
 * SatisfactionQueries — the read side of `satisfactionSignals`.
 *
 * Kept apart from SatisfactionService because the two have opposite risk
 * profiles. Writes are best-effort and must never surface a failure to a
 * student mid-session; reads are an admin tool where a silent empty result is
 * the worst possible outcome, because it is indistinguishable from "nobody has
 * complained". So these throw, and the caller renders the error.
 *
 * This is a client-side read of the whole collection within a window. That is
 * fine at the volume this app produces and for a dev-only screen; it is not a
 * pattern to reach for on a user-facing surface. If the collection ever grows
 * past a few thousand rows in a window, this needs an aggregation written by
 * the backend rather than a bigger `limit`.
 */

const COLLECTION = "satisfactionSignals";

/** Hard ceiling so a runaway query can't pull the whole collection into a tab. */
const MAX_ROWS = 2000;

/**
 * Fetch signals from the last N days.
 *
 * Ordered by `timestamp`, which is the server value. Rows written while
 * offline briefly carry a null there and will sort last until the server
 * resolves them — `normalizeRow` falls back to `createdAt`, so the rollup still
 * dates them correctly even when this ordering doesn't.
 *
 * @param {Object} [options]
 * @param {number} [options.days=30]  Window size. 0 or less means everything.
 * @param {number} [options.max=2000]
 * @returns {Promise<Array>} Raw documents with `id` attached.
 */
export const fetchSignals = async ({ days = 30, max = MAX_ROWS } = {}) => {
  const capped = Math.min(max, MAX_ROWS);
  const ref = collection(db, COLLECTION);

  const constraints = [];
  if (days > 0) {
    const since = new Date(Date.now() - days * 86400000);
    constraints.push(where("timestamp", ">=", Timestamp.fromDate(since)));
  }
  constraints.push(orderBy("timestamp", "desc"));
  constraints.push(limit(capped));

  const snap = await getDocs(query(ref, ...constraints));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  devLog(`📥 satisfaction: ${rows.length} signals (last ${days || "all"} days)`);
  return rows;
};
