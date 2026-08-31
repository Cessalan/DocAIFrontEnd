/* ══════════════════════════════════════════════════════════════════════
   KNOWLEDGE MAP MODEL — turning six answers into "it actually understands me".

   Pure. No React, no network. The claims the map screen makes are the most
   load-bearing in the product — it is where a student decides whether we
   are a quiz generator or something that pays attention — so the rules
   behind them are assertable in a test rather than assembled inline in a
   component.

   (Named `knowledgeMapModel` rather than `knowledgeMap` on purpose: the
   component next door is `KnowledgeMap.js`, and on a case-insensitive
   filesystem a name differing only in case is the SAME FILE. One of the two
   silently eats the other.)

   THE ORDERING RULE: strengths first, always.
   A map that opens on red repeats the exact emotional mistake the
   diagnostic is already at risk of making, at the moment we are trying to
   undo it. It is also the zero-state error the old journey block made,
   where a new student's biggest number was a structurally-0% readiness
   score.

   THE EVIDENCE RULE: name the concept, not the percentage.
   "Cardiac Pharmacology — 40%" is a grade. "You're mixing up preload and
   afterload" is being understood. Only the second one earns the screen.
   ══════════════════════════════════════════════════════════════════════ */

const SOLID_MIN = 80;
const GAP_MAX = 40;

const tierFor = (pct) => {
  if (pct >= SOLID_MIN) return 'solid';
  if (pct < GAP_MAX) return 'gap';
  return 'shaky';
};

/** Short display label for an answered item, falling back sensibly. */
const conceptOf = (a) => (a.concept || '').trim();

/**
 * Fold the diagnostic answers into per-topic buckets with evidence.
 *
 * @param {Array} answers        [{topic, concept, correct, unsure}]
 * @param {Array} hardestTopics  what she said was hardest, in onboarding
 * @returns {Object} map
 */
export const buildKnowledgeMap = (answers = [], hardestTopics = []) => {
  const byTopic = new Map();

  answers.forEach((a) => {
    const topic = (a.topic || 'General').trim();
    if (!byTopic.has(topic)) {
      byTopic.set(topic, { topic, correct: 0, total: 0, got: [], missed: [] });
    }
    const b = byTopic.get(topic);
    b.total += 1;
    const label = conceptOf(a);
    if (a.correct) {
      b.correct += 1;
      if (label) b.got.push(label);
    } else if (label) {
      b.missed.push(label);
    }
  });

  const topics = [...byTopic.values()].map((b) => {
    const pct = b.total ? Math.round((b.correct / b.total) * 100) : 0;
    return { ...b, pct, tier: tierFor(pct) };
  });

  const strong = topics
    .filter((t) => t.tier === 'solid')
    .sort((a, b) => b.pct - a.pct);

  // Weakest first: this list is read top-down as "here is what we'll do".
  const needsWork = topics
    .filter((t) => t.tier !== 'solid')
    .sort((a, b) => a.pct - b.pct);

  return {
    topics,
    strong,
    needsWork,
    contradiction: findContradiction(topics, hardestTopics),
    hasEvidence: answers.length > 0,
  };
};

/**
 * Per-topic percentages in the shape the backend weighting expects.
 * `{topic: percent}` — see _weight_path_by_diagnostic.
 */
export const scoresForPlan = (map) => {
  const out = {};
  (map?.topics || []).forEach((t) => {
    out[t.topic] = t.pct;
  });
  return out;
};

/**
 * The single most valuable thing this screen can say.
 *
 * When she told us a topic was hardest and the diagnostic disagrees, saying
 * so out loud is what separates "it read my file" from "it paid attention".
 * A self-report confirmed is worth little; a self-report CORRECTED is the
 * moment the product stops feeling like a quiz generator.
 *
 * Guarded hard, because being wrong here is worse than staying quiet:
 *   · she must actually be solid on the topic she feared, and
 *   · there must be a genuinely weaker topic to point at instead, and
 *   · that topic must be meaningfully weaker, not one point down.
 *
 * Returns null whenever any of that fails, and the component then simply
 * does not render the line.
 */
export const findContradiction = (topics, hardestTopics = []) => {
  if (!hardestTopics.length || topics.length < 2) return null;

  const norm = (s) => String(s || '').trim().toLowerCase();
  const feared = topics.find(
    (t) =>
      hardestTopics.some(
        (h) =>
          norm(h) === norm(t.topic) ||
          (norm(h) && norm(t.topic).includes(norm(h)))
      ) && t.tier === 'solid'
  );
  if (!feared) return null;

  const weakest = [...topics].sort((a, b) => a.pct - b.pct)[0];
  if (!weakest || weakest.topic === feared.topic) return null;
  if (feared.pct - weakest.pct < 30) return null;

  return { feared: feared.topic, actual: weakest.topic };
};

/**
 * The plan-preview reason line: "3 topics you've got, 2 that need work."
 *
 * Returns null when there is nothing worth saying — a map with a single
 * topic in it does not need summarising, and the sentence would read as
 * padding.
 */
export const buildReasonLine = (map) => {
  if (!map || !map.hasEvidence) return null;
  const strong = map.strong.length;
  const work = map.needsWork.length;
  if (strong + work < 2) return null;
  return { strong, work, focus: map.needsWork.slice(0, 2).map((t) => t.topic) };
};

export const KNOWLEDGE_TIERS = { SOLID_MIN, GAP_MAX };
