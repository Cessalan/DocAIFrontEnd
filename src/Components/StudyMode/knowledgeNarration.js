/* ══════════════════════════════════════════════════════════════════════
   KNOWLEDGE NARRATION — the map as someone talking, not a report.

   WHY THIS REPLACED THE OLD LAYOUT
   ────────────────────────────────
   The first map was three labelled sections — "You're strong in",
   "You need to work on", "Your path" — stacked, all appearing at once,
   with a single human sentence at the very bottom. It read as robotic
   for three structural reasons that no amount of rewording would fix:

     1. It was a REPORT. Two bulleted lists with headings is the shape of
        a dashboard. A tutor who had just watched you answer six
        questions would never hand you a document.
     2. The human voice was a FOOTNOTE. The one warm sentence sat
        underneath the data, so the data was the point and the warmth was
        decoration.
     3. Everything arrived SIMULTANEOUSLY. A reveal is a sequence. If the
        whole finding is on screen in one frame, nothing is revealed —
        it was simply already there, which means it was prepared in
        advance, which means it is not about her.

   So the map is now ONE narration. The tutor speaks, and the evidence
   appears as she mentions it — strengths land while she is saying "these
   are already yours", gaps land while she is naming them. Same
   information, in the order a person would deliver it.

   THE ORDERING RULE SURVIVES: strengths first, always. Opening on what
   she got wrong repeats the emotional mistake the diagnostic spent six
   questions avoiding.

   Beats are {key, fallback, params, reveals} and the component types
   them in order, switching on `reveals` to bring sections in. Returning
   i18n keys rather than finished strings keeps the copy with the rest of
   the copy — and in French.
   ══════════════════════════════════════════════════════════════════════ */

import { buildCoachMessage, joinTopics } from './coachMessageModel';

/**
 * @param {Object} map        from buildKnowledgeMap
 * @param {number|null} daysToExam
 * @param {string} [examName]
 * @returns {Array<{key, fallback, params, reveals}>}
 */
export const buildNarration = (map, daysToExam = null, examName = null) => {
  if (!map || !map.hasEvidence) return [];

  const { strong = [], needsWork = [], contradiction = null } = map;
  const beats = [];

  /* Beat 1 — acknowledge that she just did something.
     She answered six questions for us; opening straight into findings
     treats that as data collection rather than as effort. */
  beats.push({
    key: 'narration.ack',
    fallback: 'Okay — that tells me a lot.',
    params: {},
    reveals: null,
  });

  /* Beat 2 — strengths, revealed as they are named. */
  if (strong.length > 0) {
    beats.push({
      key: strong.length === 1 ? 'narration.strongOne' : 'narration.strongMany',
      fallback:
        strong.length === 1
          ? 'You are in better shape than you might think. This one is already yours:'
          : 'You are in better shape than you might think. These are already yours:',
      params: { count: strong.length },
      reveals: 'strong',
    });
  }

  /* Beat 3 — the correction. Its own beat because it is the single most
     valuable thing this screen can say, and burying it inside another
     sentence would waste it. Two short lines: the surprise, then what it
     actually means, because that is how a person delivers a surprise. */
  if (contradiction) {
    beats.push({
      key: 'narration.contradiction',
      fallback:
        'And here is the thing — you told me {{feared}} was your hardest. It is not. You have got that one.',
      params: { feared: contradiction.feared, actual: contradiction.actual },
      reveals: null,
    });
  }

  /* Beat 4 — the gaps. Worded as "where it gets shaky", never as a list
     of failures, and never with a score attached. */
  if (needsWork.length > 0) {
    beats.push({
      key: contradiction ? 'narration.workAfterTwist' : 'narration.work',
      fallback: contradiction
        ? 'What actually needs your time is this:'
        : 'Where it gets shaky is here:',
      params: {
        topics: joinTopics(needsWork.slice(0, 2).map((t) => t.topic)),
      },
      reveals: 'work',
    });
  }

  /* Beats 5+ — the deadline and the plan. Same voice, same message model
     the dashboard nudge shares, so the tutor does not change personality
     between the map and the plan she lands on next. */
  const coach = buildCoachMessage({
    daysToExam,
    needsWork,
    strong,
    examName,
  });
  coach.beats.forEach((b) => beats.push({ ...b, reveals: null }));

  return beats;
};

/** Which sections should be visible once `stage` beats have started. */
export const revealedAt = (beats, stage) => {
  const shown = new Set();
  beats.slice(0, stage + 1).forEach((b) => {
    if (b.reveals) shown.add(b.reveals);
  });
  return shown;
};
