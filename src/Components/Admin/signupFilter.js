import { toDate } from './paywallRollup';

/**
 * Narrow funnel rows to students who signed up in a date range.
 *
 * Sign-up is `users/{uid}.createdAt`, stamped by createUserProfile. A student
 * whose doc is missing or has no `createdAt` cannot be placed, so while the
 * filter is on she is left out and counted in `unknown` rather than guessed
 * into or out of the range.
 *
 * Upload funnels can carry rows written before sign-in, with no uid. Those
 * ride along when another row of the same funnel belongs to a kept student,
 * so filtering never splits one upload into a shorter funnel.
 *
 * @param {Array}  events          Raw funnelEvents rows (with uid, funnelId).
 * @param {Object} users           uid → users/{uid} data (null when missing).
 * @param {Object} range
 * @param {Date}   [range.from]    Inclusive.
 * @param {Date}   [range.to]      Exclusive.
 * @returns {{ events: Array, unknown: number }}
 */
export const filterBySignup = (events = [], users = {}, { from = null, to = null } = {}) => {
  if (!from && !to) return { events, unknown: 0 };

  const kept = new Set();
  const unknown = new Set();
  for (const uid of new Set(events.map((e) => e.uid).filter(Boolean))) {
    const at = toDate(users[uid]?.createdAt);
    if (!at) unknown.add(uid);
    else if ((!from || at >= from) && (!to || at < to)) kept.add(uid);
  }

  const keptFunnels = new Set(events.filter((e) => e.funnelId && kept.has(e.uid)).map((e) => e.funnelId));
  return {
    events: events.filter((e) => (e.uid ? kept.has(e.uid) : keptFunnels.has(e.funnelId))),
    unknown: unknown.size,
  };
};
