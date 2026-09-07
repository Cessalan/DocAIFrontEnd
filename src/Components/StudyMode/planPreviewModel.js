/* ══════════════════════════════════════════════════════════════════════
   PLAN PREVIEW MODEL — the plan she is about to be asked to pay for,
   computed without generating it.

   WHY THIS EXISTS
   ───────────────
   The plan gate used to fire BEFORE generation. A student at 3/3 plans
   answered the questionnaire, sat the diagnostic, and was then shown an
   upgrade modal that said, in effect, "you have used your three plans".
   That sells a quota. It names the thing she has run out of and says
   nothing about the thing she wanted.

   The change this file exists for is to show her the plan FIRST and ask
   afterwards. But we cannot generate a real plan for someone who is not
   allowed to have one — that is an LLM call spent on a request the server
   will refuse, and the server-side gate refuses it anyway.

   So the preview is derived instead of generated. Everything it needs is
   already on the client by this point: the topics from her upload, the
   percentages from her diagnostic, and her exam date. The planner's
   shaping rule is pure arithmetic on exactly those three inputs, so it
   can be mirrored here and produce the same shape the backend would.

   ⚠️ CROSS-REPO CONTRACT
   ──────────────────────
   The constants below MIRROR NQBackEnd2/main.py:

       SPRINT_MAX_DAYS / FOCUS_MAX_DAYS  → _plan_archetype()
       PLAN_BUDGETS                      → _apply_budget()
       TIER_UNITS / TIER_ORDER           → _weight_path_by_diagnostic()
       GAP_MAX_PCT / SOLID_MIN_PCT       → _tier_for_score()

   Drift here does not throw, it lies: the student is shown "14 study
   sessions", pays, and receives 8. Change both sides together — this is
   the same class of contract as QUIZ_QUESTIONS in StudyModeContainer,
   and it is listed in CLAUDE.md for the same reason.

   WHAT IT DELIBERATELY DOES NOT DO
   ────────────────────────────────
   It does not invent node titles. The preview shows topics, their tier
   and an honest session count — never a list of lessons that a real
   generation might not produce. A preview that promises "Lesson: Preload
   vs Afterload" and then delivers something else has taken money for a
   specific thing and handed over a different one.

   The count is exact rather than approximate because the trimming rule is
   exact. If that ever stops being true, round it and say "about" — do not
   keep a precise-looking number that is only nearly right.
   ══════════════════════════════════════════════════════════════════════ */

// ⚠️ Mirrors NQBackEnd2/main.py — see the contract note above.
export const SPRINT_MAX_DAYS = 2;
export const FOCUS_MAX_DAYS = 9;
export const PLAN_BUDGETS = { sprint: 8, focus: 14, master: 20 };
export const GAP_MAX_PCT = 40;
export const SOLID_MIN_PCT = 80;
export const TIER_UNITS = {
  gap: ['lesson', 'quiz', 'audio', 'flashcard', 'quiz'],
  shaky: ['lesson', 'quiz'],
  untested: ['lesson', 'quiz'],
  solid: ['flashcard', 'quiz'],
};
export const TIER_ORDER = { gap: 0, shaky: 1, untested: 2, solid: 3 };

/** Time-to-exam decides the plan's shape before anything else does. */
export const planArchetype = (daysToExam) => {
  if (daysToExam === null || daysToExam === undefined) return 'master';
  if (daysToExam <= SPRINT_MAX_DAYS) return 'sprint';
  if (daysToExam <= FOCUS_MAX_DAYS) return 'focus';
  return 'master';
};

/** Bucket a diagnostic percentage. null means we never asked about it. */
export const tierForScore = (pct) => {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return 'untested';
  const n = Number(pct);
  if (n < GAP_MAX_PCT) return 'gap';
  if (n >= SOLID_MIN_PCT) return 'solid';
  return 'shaky';
};

/**
 * Loose topic match between the diagnostic's labels and the upload's.
 *
 * Both are model-generated in the same session so they usually agree, but
 * "usually" is not "always" — and an unmatched topic silently becomes
 * `untested`, which changes its unit size and therefore the session count
 * on the card. Mirrors the backend's _match_topic intent.
 */
const matchTopic = (name, candidates) => {
  if (!name) return null;
  const target = String(name).toLowerCase().trim();
  const exact = candidates.find(c => String(c).toLowerCase().trim() === target);
  if (exact) return exact;
  return candidates.find((c) => {
    const other = String(c).toLowerCase().trim();
    return other.includes(target) || target.includes(other);
  }) || null;
};

/**
 * Build the preview.
 *
 * @param {object}   input
 * @param {object[]} input.topics      - ranked topics from rankUploadTopics (or plain strings)
 * @param {object}   input.diagnostic  - {topicLabel: percent} from the diagnostic, or null
 * @param {number}   input.daysToExam  - whole days until the exam, or null
 * @returns {{
 *   archetype: string, budget: number, daysToExam: number|null,
 *   sessionCount: number, estimatedMinutes: number,
 *   rows: Array<{topic, tier, percent, nodeCount}>,
 *   counts: {gap:number, shaky:number, untested:number, solid:number},
 *   trimmed: number
 * }}
 */
export const buildPlanPreview = ({
  topics = [],
  diagnostic = null,
  daysToExam = null,
} = {}) => {
  const labels = (topics || [])
    .map(t => (typeof t === 'string' ? t : t?.topic))
    .map(t => String(t || '').trim())
    .filter(Boolean);

  const uniqueLabels = [...new Set(labels)];

  const archetype = planArchetype(daysToExam);
  const budget = PLAN_BUDGETS[archetype];

  if (uniqueLabels.length === 0) {
    return {
      archetype, budget, daysToExam,
      sessionCount: 0, estimatedMinutes: 0,
      rows: [], counts: { gap: 0, shaky: 0, untested: 0, solid: 0 }, trimmed: 0,
    };
  }

  const diagKeys = diagnostic ? Object.keys(diagnostic) : [];

  // ── Score and tier every topic ─────────────────────────────────────
  let units = uniqueLabels.map((topic) => {
    const key = matchTopic(topic, diagKeys);
    const raw = key ? diagnostic[key] : null;
    const percent = raw === null || raw === undefined ? null : Number(raw);
    const tier = tierForScore(percent);
    return {
      topic,
      tier,
      percent: Number.isNaN(percent) ? null : percent,
      nodeCount: TIER_UNITS[tier].length,
    };
  });

  // ── Worst first, solid last; ties break on score ───────────────────
  units.sort((a, b) => {
    if (TIER_ORDER[a.tier] !== TIER_ORDER[b.tier]) return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    const as = a.percent === null ? 999 : a.percent;
    const bs = b.percent === null ? 999 : b.percent;
    return as - bs;
  });

  const before = units.length;

  // ── Fit to the calendar ────────────────────────────────────────────
  // Sprint collapses every solid topic into one review node, because five
  // separate refresh units two days before an exam is a list, not a plan.
  if (archetype === 'sprint') {
    const solid = units.filter(u => u.tier === 'solid');
    units = units.filter(u => u.tier !== 'solid');
    if (solid.length > 0) {
      units.push({
        topic: solid.map(u => u.topic).join(', ').slice(0, 120) || 'Review',
        tier: 'solid',
        percent: null,
        nodeCount: 1,
        isCollapsedReview: true,
      });
    }
  }

  const total = () => units.reduce((sum, u) => sum + u.nodeCount, 0);

  // Trim order mirrors the backend exactly: tail first, then shaky/untested,
  // then whole gap units. A gap unit is dropped entire, never truncated —
  // half a unit loses the closing quiz, which is the node that carries
  // momentum into the next topic.
  const dropLast = (pred) => {
    let idx = -1;
    units.forEach((u, i) => { if (pred(u)) idx = i; });
    if (idx >= 0) units.splice(idx, 1);
    return idx >= 0;
  };

  while (total() > budget && units.some(u => u.tier === 'solid')) {
    if (!dropLast(u => u.tier === 'solid')) break;
  }
  while (total() > budget && units.some(u => u.tier === 'shaky' || u.tier === 'untested')) {
    if (!dropLast(u => u.tier === 'shaky' || u.tier === 'untested')) break;
  }
  while (total() > budget && units.length > 1) {
    units.pop();
  }

  const sessionCount = total();
  const counts = units.reduce(
    (acc, u) => ({ ...acc, [u.tier]: acc[u.tier] + 1 }),
    { gap: 0, shaky: 0, untested: 0, solid: 0 }
  );

  return {
    archetype,
    budget,
    daysToExam,
    sessionCount,
    // ~3 min per node, the same figure the backend reports as
    // estimated_time_minutes. Kept in sync for the same reason as the rest.
    estimatedMinutes: sessionCount * 3,
    rows: units,
    counts,
    // How many topics the calendar squeezed out. The card uses this to be
    // honest about a sprint plan that cannot cover everything, rather than
    // silently showing a shorter list than she uploaded.
    trimmed: Math.max(0, before - units.length),
  };
};

export default buildPlanPreview;
