/* ══════════════════════════════════════════════════════════════════════
   STUDY HISTORY — "you struggled with this, and now you don't."

   Running totals can say how she is doing. Only a timeline can say whether
   she is getting BETTER, because an average absorbs the change: 2/5 then
   5/5 and 4/5 twice both read as 70%, and only one of those is a story
   worth telling her.

   This module turns the stored history plus the concept ledger into ONE
   line of feedback, and it is allowed to return null. That matters more
   than anything else here — a tutor who produces an encouraging sentence
   after every single node is not observing her, they are decorating the
   screen, and students work that out fast. Silence when there is nothing
   to say is what makes the sentence mean something when it comes.

   PRIORITY, most specific first:
     1. a named misconception she has since fixed        (concept ledger)
     2. a measurable climb on this topic across sessions (history)
     3. a concept that keeps catching her                (concept ledger)
     4. null

   Point 3 is deliberately in the list. The brief asks for feedback based
   on history, not praise based on history — and "this one has caught you
   three times, let's slow down" is more use to her, and more obviously
   true, than another compliment.
   ══════════════════════════════════════════════════════════════════════ */

import { selectResolvedConcepts, selectActiveStruggles } from '../../Services/conceptLedger';

/** Sessions on a topic before a trend is a trend and not two data points. */
export const TREND_MIN_SESSIONS = 2;
/** Questions in a session before it can anchor one. */
export const TREND_MIN_ITEMS = 3;
/** Percentage points of climb worth mentioning. Matches nodeReadout's bar. */
export const TREND_MIN_JUMP = 20;
/** Times a concept must catch her before we name it as a pattern. */
export const STRUGGLE_MIN_MISSES = 2;

const sameTopic = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * Her scored sessions on one topic, oldest first.
 */
export const sessionsFor = (history = [], topic) =>
  (history || [])
    .filter((h) => h && h.total >= TREND_MIN_ITEMS && sameTopic(h.topic, topic))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));

/**
 * Did she measurably climb on this topic over time?
 *
 * Compares her FIRST qualifying session to her LATEST, not to a rolling
 * average — the first attempt is the thing she remembers being bad at, so
 * it is the comparison that lands.
 *
 * Returns null when there is no climb. Never reports a decline: a true but
 * demoralising number is a useless nudge, and the same rule already governs
 * the readiness projection.
 */
export const buildTopicTrend = (history = [], topic) => {
  const runs = sessionsFor(history, topic);
  if (runs.length < TREND_MIN_SESSIONS) return null;

  const first = runs[0];
  const latest = runs[runs.length - 1];
  const delta = latest.pct - first.pct;
  if (delta < TREND_MIN_JUMP) return null;

  return {
    topic,
    firstPct: first.pct,
    latestPct: latest.pct,
    firstCorrect: first.correct,
    firstTotal: first.total,
    latestCorrect: latest.correct,
    latestTotal: latest.total,
    delta,
    sessions: runs.length,
  };
};

/**
 * Has she seen this exact observation already?
 *
 * Stored conclusions exist so we do not deliver the same insight twice as
 * though it were new. Nothing erodes "it's paying attention" faster than
 * being told the same thing about yourself on three consecutive screens.
 */
export const alreadySaid = (history = [], conclusionKey) =>
  !!conclusionKey &&
  (history || []).some((h) => h && h.conclusion === conclusionKey);

/**
 * The one line of history-aware feedback, or null.
 *
 * @param {Array}  history   stored session rows
 * @param {Object} concepts  the concept ledger
 * @param {string} topic     topic of the node just finished
 * @param {string} [since]   ISO — scope "fixed it" claims to this session
 * @returns {{key, fallback, params, conclusionKey}|null}
 */
export const buildHistoryFeedback = ({
  history = [],
  concepts = {},
  topic = null,
  since = null,
} = {}) => {
  /* 1. A named misconception she has since fixed. The most specific thing
        we can possibly say, and the only one that names the actual idea
        rather than a topic heading. */
  const resolved = selectResolvedConcepts(concepts, since);
  const fixed = resolved.find(
    (c) => !alreadySaid(history, `fixed:${c.key}`)
  );
  if (fixed) {
    return {
      key: 'history.fixedConcept',
      fallback:
        'You were getting {{concept}} wrong earlier. You have had it right {{count}} times since.',
      params: { concept: fixed.label, count: fixed.correctAfterMiss || 2 },
      conclusionKey: `fixed:${fixed.key}`,
    };
  }

  /* 2. A measurable climb on this topic. */
  const trend = buildTopicTrend(history, topic);
  if (trend && !alreadySaid(history, `trend:${topic}:${trend.latestPct}`)) {
    return {
      key: 'history.topicClimb',
      fallback:
        'First time on {{topic}} you got {{firstCorrect}} of {{firstTotal}}. This time, {{latestCorrect}} of {{latestTotal}}.',
      params: {
        topic: trend.topic,
        firstCorrect: trend.firstCorrect,
        firstTotal: trend.firstTotal,
        latestCorrect: trend.latestCorrect,
        latestTotal: trend.latestTotal,
      },
      conclusionKey: `trend:${topic}:${trend.latestPct}`,
    };
  }

  /* 3. Something that keeps catching her. Named plainly, framed as
        something we are going to deal with rather than as a failing. */
  const stuck = selectActiveStruggles(concepts).find(
    (c) => (c.seen || 0) - (c.correct || 0) >= STRUGGLE_MIN_MISSES
  );
  if (stuck) {
    return {
      key: 'history.persistentConcept',
      fallback:
        '{{concept}} has caught you {{count}} times now. That is the one worth slowing down on.',
      params: {
        concept: stuck.label,
        count: (stuck.seen || 0) - (stuck.correct || 0),
      },
      conclusionKey: `stuck:${stuck.key}`,
    };
  }

  return null;
};
