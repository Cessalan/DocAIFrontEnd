/* ══════════════════════════════════════════════════════════════════════
   NCLEX SERVICE — the attempt log, and nothing else.

   WHY THERE IS NO PROFILE DOCUMENT HERE
   ────────────────────────────────────
   The obvious shape is a `nclexProfile` document that each answer updates.
   This file deliberately does not have one. Every aggregate the product
   shows is folded out of the raw log by Components/Nclex/nclexProfile.js at
   render time, so the numbers can never disagree with the answers behind
   them.

   We already know what the other design costs: incrementally-written
   aggregates elsewhere in this app have drifted from their events twice
   (conceptLedger's duplicate keys with conflicting mastery, study nodes
   stuck at status 'active' after being completed), and in both cases
   nothing noticed because the events were the only thing that could have
   contradicted them and nobody was reading the events.

   Here the events are the only stored thing, so that class of bug is gone.

   THE COST, STATED HONESTLY
   ─────────────────────────
   Deriving per render means reading the log per session. `ATTEMPT_CAP`
   bounds that. A student who exceeds it is reading her most recent
   attempts, which is the right window anyway — a select-all score from
   nine weeks ago should not be weighing on today's verdict.

   Firestore path: users/{uid}/nclexAttempts/{autoId}
   Already writable under the existing rules (users/{userId}/{subcollection}
   allows write for anything but billingEvents) — no rules change needed.
   ══════════════════════════════════════════════════════════════════════ */

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../Firebase/config';
import { devLog, devWarn } from './devLogger';

/** Most recent attempts folded into a profile. See the cost note above. */
export const ATTEMPT_CAP = 1000;

const attemptsRef = (uid) => collection(db, 'users', uid, 'nclexAttempts');
const metaRef = (uid) => doc(db, 'users', uid, 'nclexMeta', 'profile');

/**
 * Record one answered question.
 *
 * `at` is an ISO string rather than serverTimestamp(): these rows are
 * compared and ordered client-side, and sentinels do not survive that round
 * trip in the shapes we read them back in. Same rule as conceptLedger and
 * node completedAt.
 *
 * Every field the profile folds on is optional. A row missing `category` is
 * still worth storing — it counts toward volume and format evidence, and
 * nclexProfile skips it for the dimension it lacks rather than inventing
 * one. Never backfill a missing dimension with a guess here.
 *
 * @param {string} uid
 * @param {Object} attempt
 * @param {string} [attempt.subject]     subject id from nclexCurriculum
 * @param {string} [attempt.area]        practice area within the subject
 * @param {string} [attempt.category]    client-needs code (PHAR, MC, …)
 * @param {string} [attempt.concept]     short concept label from the generator
 * @param {string[]} [attempt.skills]    clinical-reasoning skill ids
 * @param {string} [attempt.format]      mcq | sata | casestudy
 * @param {number} [attempt.difficulty]  1..3
 * @param {boolean} attempt.correct      fully correct only
 * @param {number} [attempt.partialScore] 0..1, for display; never counted as correct
 * @param {number} [attempt.seconds]     time to answer
 * @param {string} [attempt.confidence]  'sure' | 'unsure'
 */
export const logAttempt = async (uid, attempt) => {
  if (!uid || !attempt) return null;
  try {
    const row = {
      subject: attempt.subject ?? null,
      area: attempt.area ?? null,
      category: attempt.category ?? null,
      concept: attempt.concept ?? null,
      skills: Array.isArray(attempt.skills) ? attempt.skills : [],
      format: attempt.format ?? null,
      difficulty: Number.isFinite(Number(attempt.difficulty))
        ? Number(attempt.difficulty)
        : null,
      correct: !!attempt.correct,
      partialScore: Number.isFinite(Number(attempt.partialScore))
        ? Number(attempt.partialScore)
        : 0,
      seconds: Number.isFinite(Number(attempt.seconds)) ? Number(attempt.seconds) : null,
      confidence: attempt.confidence ?? null,
      questionId: attempt.questionId ?? null,
      // Where the row came from. Absent for the product's own generated
      // questions; 'seo-sample' for the landing-page items seeded at
      // arrival, so any later read can separate the two if it needs to.
      source: attempt.source ?? null,
      at: new Date().toISOString(),
    };
    const ref = await addDoc(attemptsRef(uid), row);
    devLog('[nclex] attempt logged', ref.id, row.format, row.correct);
    return ref.id;
  } catch (err) {
    // Losing one row must never break the session she is in the middle of.
    console.error('[nclex] logAttempt failed', err);
    return null;
  }
};

/**
 * Seed rows that were answered somewhere else — today, the landing pages.
 *
 * IDEMPOTENT ON PURPOSE. The handoff can be committed twice for one visit
 * (once when the CTA is pressed by a signed-in student, once more from the
 * post-signup hook), and `addDoc` would double every row. Each row is
 * written with a deterministic id derived from `key` + questionId, so the
 * second write is a no-op overwrite of the first.
 *
 * `at` is the moment she actually answered on the landing page, not now:
 * `trendFor` splits the log chronologically, and rows stamped at seed time
 * would sit AFTER questions she answered before signing up on a previous
 * device.
 */
export const seedAttempts = async (uid, rows, key, answeredAt) => {
  if (!uid || !Array.isArray(rows) || !rows.length || !key) return 0;
  const at = new Date(Number(answeredAt) || Date.now()).toISOString();
  let written = 0;
  await Promise.all(
    rows.map(async (r, i) => {
      if (!r?.questionId) return;
      try {
        await setDoc(doc(attemptsRef(uid), `${key}-${r.questionId}`), {
          subject: r.subject ?? null,
          area: r.area ?? null,
          category: r.category ?? null,
          concept: r.concept ?? null,
          skills: Array.isArray(r.skills) ? r.skills : [],
          format: r.format ?? null,
          difficulty: Number.isFinite(Number(r.difficulty)) ? Number(r.difficulty) : null,
          correct: !!r.correct,
          partialScore: 0,
          seconds: null,
          confidence: null,
          questionId: r.questionId,
          source: r.source || 'seo-sample',
          // Millisecond offsets keep the seeded rows in the order she
          // answered them without colliding on one timestamp.
          at: new Date(new Date(at).getTime() + i).toISOString(),
        });
        written += 1;
      } catch (err) {
        devWarn('[nclex] seedAttempts row failed', r.questionId, err);
      }
    })
  );
  devLog('[nclex] seeded', written, 'attempts from', key);
  return written;
};

/**
 * Load the attempt log, OLDEST FIRST.
 *
 * Order matters: `trendFor` splits the log in half to compare early against
 * late, and handing it newest-first would report every improvement as a
 * decline.
 */
export const loadAttempts = async (uid, max = ATTEMPT_CAP) => {
  if (!uid) return [];
  try {
    // Ordered desc + limit so the cap keeps the MOST RECENT rows, then
    // reversed for chronological reading.
    const snap = await getDocs(
      query(attemptsRef(uid), orderBy('at', 'desc'), limit(max))
    );
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return rows.reverse();
  } catch (err) {
    devWarn('[nclex] loadAttempts failed', err);
    return [];
  }
};

/**
 * Session-level metadata that is genuinely state, not derivable: her exam
 * date, and whether we have asked for it.
 *
 * Everything else about her — strengths, gaps, readiness — is derived and
 * must never be written here.
 */
export const loadMeta = async (uid) => {
  if (!uid) return null;
  try {
    const snap = await getDoc(metaRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    devWarn('[nclex] loadMeta failed', err);
    return null;
  }
};

export const saveMeta = async (uid, patch) => {
  if (!uid || !patch) return false;
  try {
    await setDoc(metaRef(uid), { ...patch, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    devWarn('[nclex] saveMeta failed', err);
    return false;
  }
};

/* ══════════════════════════════════════════════════════════════════════
   THE RESUME BUFFER — users/{uid}/nclexMeta/session

   A generated question costs an LLM call and a unit of her free quota.
   Without this, closing the tab mid-session threw both away: coming back
   regenerated a question she had already been served, and charged her for
   it a second time.

   ⚠️ THIS IS NOT A SECOND SOURCE OF TRUTH.
   `buildProfile` never reads this document. Every answer is still written
   to `nclexAttempts`, and the profile still folds only from there, so the
   no-stored-aggregates rule at the top of nclexProfile.js is intact. What
   lives here is session state that cannot be derived — which question is on
   screen, and which one is queued behind it — and it is deleted the moment
   the session ends.

   `history` is duplicated here on purpose: it is what the end-of-session
   readout needs, and reconstructing "which of her attempts belonged to THIS
   session" from the log would mean writing a session id onto every attempt
   to support one screen.
   ══════════════════════════════════════════════════════════════════════ */

const sessionRef = (uid) => doc(db, 'users', uid, 'nclexMeta', 'session');

/**
 * Save the resume point.
 *
 * @param {string} uid
 * @param {Object} state
 * @param {string} state.key      the session's query string — a saved session
 *                                is only resumed into an identical one
 * @param {number} state.total    questions in the session
 * @param {Array}  state.history  attempts made in this session
 * @param {Object|null} state.next  { index, question, spec } to show on return
 */
export const saveSession = async (uid, state) => {
  if (!uid || !state) return false;
  try {
    await setDoc(sessionRef(uid), { ...state, updatedAt: new Date().toISOString() });
    return true;
  } catch (err) {
    // Never break the session she is in the middle of over a resume buffer.
    devWarn('[nclex] saveSession failed', err);
    return false;
  }
};

export const loadSession = async (uid) => {
  if (!uid) return null;
  try {
    const snap = await getDoc(sessionRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    devWarn('[nclex] loadSession failed', err);
    return null;
  }
};

export const clearSession = async (uid) => {
  if (!uid) return false;
  try {
    await deleteDoc(sessionRef(uid));
    return true;
  } catch (err) {
    devWarn('[nclex] clearSession failed', err);
    return false;
  }
};

/**
 * Whole days from now until the exam. Null when there is no date — every
 * caller must render the no-date case, because most students will not have
 * given one yet (4.1% of the current base has any exam date at all).
 */
export const daysUntil = (isoDate) => {
  if (!isoDate) return null;
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return null;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const ms = startOfDay(then) - startOfDay(new Date());
  return Math.round(ms / 86400000);
};
