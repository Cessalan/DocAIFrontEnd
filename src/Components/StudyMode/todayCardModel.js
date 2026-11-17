/* ══════════════════════════════════════════════════════════════════════
   TODAY CARD — the one thing the plan overview says.

   WHY THIS EXISTS (2026-11-16)
   ────────────────────────────
   The overview answered "what do I do now" three times: a topics panel,
   today's mission and the full plan, each naming the topic and each with
   something to tap. Inside the mission card alone there were four supporting
   lines (focus tags, a why, a Learn/Practice/Review strip, a readiness note).
   The owner's read of it: "very overwhelming, where do I click".

   The card now says the topic, the next step and how long it takes, shows one
   button, and gives ONE reason. Which reason is decided here so the choice
   can be tested: a real number beats a sentence, and a sentence is only used
   when it is true of her.

   Pure. Returns i18n keys and params; the words live in i18n.
   ══════════════════════════════════════════════════════════════════════ */

import { estimateMinutes } from './planFormatting';

const WHY_BY_LEVEL = {
  untested: ['study.whyUntested', "You haven't been tested on this yet — today gives you a real score on it."],
  weak: ['study.whyWeak', "This is one of your weaker areas, so it's where today buys you the most."],
  developing: ['study.whyDeveloping', "You're close on this one. Today should tip it over."],
  strong: ['study.whyStrong', 'A quick pass to keep this one sharp.'],
};

/**
 * The step the button opens: the first unfinished step in today's window.
 *
 * @returns {{node, minutes: number, started: boolean}|null}
 */
export function nextStep(missionNodes = [], completedCount = 0) {
  const node = (Array.isArray(missionNodes) ? missionNodes : []).find((n) => n && n.status !== 'done') || null;
  if (!node) return null;
  return { node, minutes: estimateMinutes([node]), started: completedCount > 0 || (node.nodeProgress || 0) > 0 };
}

/**
 * The single supporting line under the next step, or null when nothing true
 * can be said. In order: the readiness jump when today moves a real number,
 * what the exam's closeness means, where she stands on this topic, then the
 * softer notes about a first score or groundwork.
 *
 * @returns {{kind, key, fallback, params}|null}
 */
export function supportLine({ phase = 'none', projection = null, missionHasGraded = false } = {}) {
  const p = projection || {};
  const hasReadiness = !!p.hasData;
  if (hasReadiness && p.movesToday && p.currentPct != null && p.todayPct != null) {
    return { kind: 'jump', key: 'study.todayJump', fallback: 'Finishing today takes you from {{from}}% to {{to}}% estimated readiness.',
      params: { from: p.currentPct, to: p.todayPct } };
  }
  if (phase === 'examDay') {
    return { kind: 'why', key: 'study.whyExamDay', fallback: "Reviewing what you're most likely to miss — nothing new today.", params: {} };
  }
  if (phase === 'final') {
    return { kind: 'why', key: 'study.whyFinal', fallback: 'Consolidating what you already half-know is what pays off now.', params: {} };
  }
  const why = WHY_BY_LEVEL[p.focusLevel];
  if (why) return { kind: 'why', key: why[0], fallback: why[1], params: {} };
  if (!hasReadiness && missionHasGraded) {
    return { kind: 'first', key: 'study.firstScore', fallback: "Today's practice gives you your first readiness score.", params: {} };
  }
  if (hasReadiness && !p.movesToday && p.planPct != null && p.currentPct != null && p.planPct > p.currentPct + 2) {
    return { kind: 'groundwork', key: 'study.groundworkToday',
      fallback: 'Groundwork today — finishing your plan puts you near {{pct}}% estimated readiness.', params: { pct: p.planPct } };
  }
  return null;
}
