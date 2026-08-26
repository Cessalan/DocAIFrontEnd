/**
 * studySchedule — turns a flat study path into a DATED plan.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The plan already knows what to study; it never knew *when*. A 16-node list
 * with no dates is an open-ended commitment, and open-ended is what people
 * postpone — which is exactly the shape of the measured funnel (6.4% of plans
 * completed, 32.5% completing zero nodes).
 *
 * Attaching the exam date turns the same nodes into "Day 3 of 9 · ~18 min",
 * which is a decision the student can actually make this morning.
 *
 * DESIGN RULE: DERIVE, DON'T PERSIST
 * ──────────────────────────────────
 * The schedule is recomputed from data we already store — node order, node
 * status, node `completedAt`, and `examDate`. Nothing here is written back to
 * Firestore. That matters because a baked-in calendar ("node 7 is due
 * Thursday") is wrong the moment a student misses a day, and then every
 * subsequent screen is nagging them about a past they can't change.
 *
 * Recomputing instead means the plan SELF-HEALS: fall behind and the daily
 * dose grows to fit the days that are left; race ahead and tomorrow is
 * lighter. The student is never behind on today's mission, because today's
 * mission is defined as "the right fraction of what's actually left."
 *
 * The one cost is that we can't show a full week-by-week calendar (day 4's
 * contents genuinely aren't decided until day 4). That's an acceptable trade:
 * students act on today, and a calendar of unmet future obligations is the
 * thing we're trying to get rid of.
 */

import { estimateMinutes, getNodeEstimate } from './planFormatting';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest single mission we'll ever ask for. */
const MAX_MISSION_MINUTES = 45;
/** Shortest mission worth calling a mission (keeps 1-node days from feeling empty). */
const MIN_MISSION_MINUTES = 8;
/** Mission size when there's no exam date to pace against. */
const DEFAULT_SESSION_NODES = 3;

/**
 * Accept every date shape this codebase stores: Firestore Timestamp, Date,
 * ISO string, epoch millis. Returns null for anything unparseable so callers
 * can treat "no exam" and "broken exam date" identically.
 */
export const coerceDate = (raw) => {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') {
    try {
      const d = raw.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number' || typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  // Firestore REST / plain-object timestamps
  if (typeof raw === 'object' && typeof raw.seconds === 'number') {
    const d = new Date(raw.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Whole calendar days between two dates, ignoring clock time.
 * Uses local midnight on both sides so "tomorrow at 8am" is 1 day away
 * whether it's currently 9am or 11pm.
 */
export const calendarDaysBetween = (from, to) =>
  Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

/** True when `raw` (node.completedAt) falls on the same local day as `now`. */
const isSameLocalDay = (raw, now) => {
  const d = coerceDate(raw);
  if (!d) return false;
  return startOfDay(d).getTime() === startOfDay(now).getTime();
};

/**
 * Countdown phase. Drives tone everywhere: copy, accent colour, and whether
 * the mission is framed as learning or as review.
 *
 *   steady  (8+ days)  — build knowledge, no urgency
 *   focus   (3–7 days) — prioritise gaps
 *   final   (1–2 days) — consolidate, stop starting new material
 *   examDay (today)    — review only
 *   past               — exam has been and gone
 */
export const getExamPhase = (daysRemaining) => {
  if (daysRemaining == null) return 'none';
  if (daysRemaining < 0) return 'past';
  if (daysRemaining === 0) return 'examDay';
  if (daysRemaining <= 2) return 'final';
  if (daysRemaining <= 7) return 'focus';
  return 'steady';
};

/**
 * Build today's mission plus the surrounding calendar context.
 *
 * @param {Array}  nodes      Real (non-banner) plan nodes in order. Each is
 *                            `{ id, type, status, completedAt? }`.
 * @param {*}      examDate   Any supported date shape, or null.
 * @param {*}      startDate  When the plan began. Falls back to the earliest
 *                            node completion, then to today.
 * @param {Date}   now        Injectable clock (tests / stable renders).
 * @param {number} sessionSize Mission size when there's no exam to pace to.
 */
export const buildStudySchedule = ({
  nodes = [],
  examDate = null,
  startDate = null,
  now = new Date(),
  sessionSize = DEFAULT_SESSION_NODES,
} = {}) => {
  const exam = coerceDate(examDate);
  const daysRemaining = exam ? calendarDaysBetween(now, exam) : null;
  const phase = getExamPhase(daysRemaining);
  const hasExam = !!exam && phase !== 'past';

  const totalNodes = nodes.length;
  const completedCount = nodes.filter((n) => n.status === 'done').length;
  const allDone = totalNodes > 0 && completedCount === totalNodes;

  // ── Anchor ────────────────────────────────────────────────────────────
  // The mission window starts at the first node touched TODAY, not at the
  // first unfinished node. Anchoring to "what's left" can never show progress
  // — finish a node and the window just slides forward, leaving the bar at
  // zero all day. Anchoring to the day's first node is what makes each
  // completion visibly fill part of the bar (goal gradient).
  const firstTodayIdx = nodes.findIndex(
    (n) => n.status === 'done' && isSameLocalDay(n.completedAt, now)
  );
  const firstUnfinishedIdx = nodes.findIndex((n) => n.status !== 'done');
  const anchor =
    firstTodayIdx !== -1
      ? firstTodayIdx
      : firstUnfinishedIdx === -1
        ? totalNodes
        : firstUnfinishedIdx;

  // Everything from the anchor on = the work as it stood at the start of
  // today. Pacing off this (rather than off what's left right now) keeps the
  // day's target STABLE: finishing a node shrinks the remaining work, and a
  // target recomputed mid-day would shrink with it, so the mission would
  // retreat as the student advanced and could never be completed.
  const workNodes = nodes.slice(anchor);
  const workMinutes = estimateMinutes(workNodes);

  // ── Daily dose ────────────────────────────────────────────────────────
  // Spread the remaining work across the days that are left. Exam today (or
  // no exam date at all) collapses to a single day.
  const daysToSpread = hasExam ? Math.max(1, daysRemaining) : null;

  let missionNodes;
  if (!hasExam) {
    // No exam to pace against — keep the fixed-size session that shipped
    // before dating existed.
    missionNodes = workNodes.slice(0, sessionSize);
  } else {
    const rawTarget = workMinutes / daysToSpread;
    const targetMinutes = Math.min(
      MAX_MISSION_MINUTES,
      Math.max(MIN_MISSION_MINUTES, rawTarget)
    );

    // Walk forward until we've met the target. Stop BEFORE a node that would
    // overshoot by more than half its own length, so a 15-min mini-test never
    // gets bolted onto an already-full day.
    const picked = [];
    let acc = 0;
    for (const node of workNodes) {
      const cost = getNodeEstimate(node.type);
      if (picked.length > 0 && acc + cost / 2 > targetMinutes) break;
      picked.push(node);
      acc += cost;
      if (acc >= targetMinutes) break;
    }
    missionNodes = picked.length > 0 ? picked : workNodes.slice(0, 1);
  }

  const doneToday = missionNodes.filter(
    (n) => n.status === 'done' && isSameLocalDay(n.completedAt, now)
  ).length;
  const missionSize = missionNodes.length;
  const missionComplete =
    missionSize > 0 && missionNodes.every((n) => n.status === 'done');

  // Minutes still to spend today (what's left of the mission, not its full size).
  const remainingMissionMinutes = estimateMinutes(
    missionNodes.filter((n) => n.status !== 'done')
  );
  const missionMinutes = estimateMinutes(missionNodes);

  // ── Day X of Y ────────────────────────────────────────────────────────
  const start = coerceDate(startDate) || deriveStartDate(nodes, now);
  let totalDays = null;
  let dayIndex = null;
  if (hasExam) {
    // Inclusive of both the start day and exam day: a plan begun the day
    // before the exam is "Day 1 of 2".
    totalDays = Math.max(1, calendarDaysBetween(start, exam) + 1);
    const elapsed = Math.max(0, calendarDaysBetween(start, now));
    dayIndex = Math.min(totalDays, elapsed + 1);
  }

  // ── On track? ─────────────────────────────────────────────────────────
  // Expected progress by the START of today, so a student who hasn't opened
  // the app yet this morning isn't immediately told they're behind.
  let onTrack = true;
  let expectedDone = null;
  if (hasExam && totalNodes > 0 && totalDays) {
    expectedDone = Math.round((totalNodes * (dayIndex - 1)) / totalDays);
    onTrack = completedCount >= expectedDone;
  }

  return {
    hasExam,
    examAt: exam,
    daysRemaining,
    phase,

    dayIndex,
    totalDays,

    missionNodes,
    missionSize,
    missionMinutes,
    remainingMissionMinutes,
    doneToday,
    missionComplete,
    anchor,

    totalNodes,
    completedCount,
    remainingNodes: totalNodes - completedCount,
    allDone,

    onTrack,
    expectedDone,

    /** Nodes queued for the day after this one — powers "tomorrow we'll…". */
    nextUpNodes: nodes.slice(anchor + missionSize, anchor + missionSize + 3),
  };
};

/**
 * Best-effort plan start when nothing was recorded (plans created before
 * `study.startedAt` existed). The earliest node completion is the closest
 * honest proxy; a plan with no completions at all starts today.
 */
const deriveStartDate = (nodes, now) => {
  let earliest = null;
  for (const n of nodes) {
    const d = coerceDate(n.completedAt);
    if (d && (!earliest || d < earliest)) earliest = d;
  }
  return earliest || now;
};

export default buildStudySchedule;
