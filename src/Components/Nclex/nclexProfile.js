/* ══════════════════════════════════════════════════════════════════════
   NCLEX PROFILE — what she knows, derived from what she answered.

   WHY THIS IS DERIVED AND NEVER STORED
   ────────────────────────────────────
   The obvious design is a competency document that each answer updates in
   place. We have that design elsewhere and it has already failed twice:
   `conceptLedger` labels truncate, so one concept became five near-duplicate
   keys holding CONFLICTING mastery states, and study-node `status` sticks at
   'active' on nodes that were demonstrably finished. Both are the same bug —
   an aggregate written incrementally drifts from the events beneath it, and
   nothing ever notices because there is nothing left to compare against.

   So the attempt log is the only truth. Everything on this page is folded
   out of it per render, exactly as `studySchedule` and the readiness numbers
   already are. A profile that disagrees with the answers is then impossible
   rather than merely unlikely.

   THE ASYMMETRY THAT RUNS THROUGH EVERY THRESHOLD
   ──────────────────────────────────────────────
   Weakness needs less evidence than strength.

   Over-drilling a topic she actually knows costs her a few minutes. Telling
   her she is solid on something she is not costs her the exam — she stops
   studying it. So `MIN_FOR_VERDICT` gates any verdict at all, and
   `MIN_FOR_STRENGTH` gates the good news specifically, and the gap between
   them is the whole point. A topic that looks strong on four answers is
   reported as `provisional`, never `solid`.

   This mirrors the two-correct-answers rule in drillModel and
   DIAGNOSTIC_QUESTION_COUNT in the backend, for the same reason: one
   question on four options is a coin flip.

   NEVER INVENT A ROW
   ──────────────────
   An attempt that arrives without the dimension being folded (no subject, no
   category, no format) is SKIPPED, not bucketed into "other" or attributed
   to the last known value. Same rule as conceptLedger's missing key: an
   absent row is a silence, a wrong row is a lie told warmly.
   ══════════════════════════════════════════════════════════════════════ */

import {
  CLIENT_NEEDS,
  SUBJECTS,
  FORMATS,
  HARD_FORMATS,
  categoryWeight,
  findSubject,
} from './nclexCurriculum';

/* ── Thresholds ───────────────────────────────────────────────────────── */

/** Answers needed before any verdict is given. Below this: `untested`. */
export const MIN_FOR_VERDICT = 5;

/** Answers needed before a STRENGTH claim. See the asymmetry note above. */
export const MIN_FOR_STRENGTH = 8;

/** At or above this accuracy she is solid — given enough evidence. */
export const STRONG_ACCURACY = 0.8;

/** Below this accuracy it is a gap. */
export const WEAK_ACCURACY = 0.6;

/**
 * Answers in each half before an improvement claim is allowed.
 *
 * "You're getting better at this" is the most motivating sentence available
 * and the easiest to fake off noise. Four-and-four is the floor at which the
 * comparison means anything at all.
 */
export const MIN_FOR_TREND = 4;

/** Accuracy points of improvement before the trend is called. */
export const TREND_DELTA = 0.15;

/* ── Verdicts ─────────────────────────────────────────────────────────── */

/**
 * The five states. Four of them already have a colour in the app
 * (LockedPlanPreview's is-gap / is-shaky / is-untested / is-solid);
 * `provisional` is the fifth and is the one most products omit.
 */
export const VERDICTS = ['solid', 'provisional', 'improving', 'gap', 'untested'];

/**
 * Classify one bucket.
 *
 * `provisional` is not a hedge for its own sake. It is the honest answer to
 * "she is 4 for 4" — which is genuinely good news that has not yet earned
 * the word "solid".
 */
export const classify = ({ correct = 0, total = 0 } = {}) => {
  if (total < MIN_FOR_VERDICT) return 'untested';
  const accuracy = correct / total;
  if (accuracy < WEAK_ACCURACY) return 'gap';
  if (accuracy < STRONG_ACCURACY) return 'improving';
  return total >= MIN_FOR_STRENGTH ? 'solid' : 'provisional';
};

/** Is this verdict one we are willing to call good news? */
export const isStrength = (verdict) => verdict === 'solid';

/** Does this bucket have enough behind it to rank or to quote? */
export const hasEvidence = (bucket) => (bucket?.total || 0) >= MIN_FOR_VERDICT;

/* ── Folding ──────────────────────────────────────────────────────────── */

const emptyBucket = () => ({ correct: 0, total: 0, partial: 0, seconds: 0 });

const fold = (map, key, attempt) => {
  if (key === null || key === undefined || key === '') return; // never invent a row
  const k = String(key);
  if (!map[k]) map[k] = emptyBucket();
  map[k].total += 1;
  if (attempt.correct) map[k].correct += 1;
  // Partial credit is recorded for display and graded as NOT correct — same
  // rule as drillModel. A model that counts near-misses as knowledge
  // reproduces precisely the false confidence the format gap exposes.
  else if (Number(attempt.partialScore) > 0) map[k].partial += 1;
  if (Number.isFinite(Number(attempt.seconds))) map[k].seconds += Number(attempt.seconds);
};

const withAccuracy = (bucket) => ({
  ...bucket,
  accuracy: bucket.total ? bucket.correct / bucket.total : 0,
  verdict: classify(bucket),
});

/**
 * Fold an attempt log into every dimension at once.
 *
 * One pass, because these are read together on every surface and walking the
 * log five times to answer five questions about the same rows is how a
 * dashboard gets slow on the students who use it most.
 *
 * @param {Array} attempts rows from the NCLEX attempt log
 * @returns {{ subjects, categories, formats, skills, concepts, areas, totals }}
 */
export const buildProfile = (attempts = []) => {
  const subjects = {};
  const categories = {};
  const formats = {};
  const skills = {};
  const concepts = {};
  const areas = {};

  let total = 0;
  let correct = 0;
  let seconds = 0;
  let withConfidence = 0;

  (Array.isArray(attempts) ? attempts : []).forEach((a) => {
    if (!a || typeof a !== 'object') return;
    total += 1;
    if (a.correct) correct += 1;
    if (Number.isFinite(Number(a.seconds))) seconds += Number(a.seconds);
    if (a.confidence) withConfidence += 1;

    fold(subjects, a.subject, a);
    fold(categories, a.category, a);
    fold(formats, a.format, a);
    fold(concepts, a.concept, a);
    fold(areas, a.area, a);

    // Skills are a list per question, not a single value — a prioritization
    // question about an unstable patient exercises two.
    (Array.isArray(a.skills) ? a.skills : []).forEach((s) => fold(skills, s, a));
  });

  const decorate = (map) =>
    Object.keys(map).reduce((out, k) => {
      out[k] = withAccuracy(map[k]);
      return out;
    }, {});

  return {
    subjects: decorate(subjects),
    categories: decorate(categories),
    formats: decorate(formats),
    skills: decorate(skills),
    concepts: decorate(concepts),
    areas: decorate(areas),
    totals: {
      answered: total,
      correct,
      accuracy: total ? correct / total : 0,
      seconds,
      withConfidence,
      medianSecondsKnown: seconds > 0,
    },
  };
};

/* ── Reading the profile ──────────────────────────────────────────────── */

/**
 * Every client-needs category as a display row, in blueprint order, whether
 * or not she has answered anything in it.
 *
 * Categories with no evidence are INCLUDED and marked `untested` rather than
 * hidden. A readiness page that silently omits the six categories she has
 * never touched shows her a picture of a exam she is not sitting.
 */
export const categoryRows = (profile) =>
  CLIENT_NEEDS.map((c) => {
    const bucket = profile?.categories?.[c.code] || emptyBucket();
    return {
      ...c,
      ...withAccuracy(bucket),
      weight: categoryWeight(c.code),
    };
  });

/** Every subject as a display row, heaviest blueprint share first. */
export const subjectRows = (profile) =>
  SUBJECTS.map((s) => {
    const bucket = profile?.subjects?.[s.id] || emptyBucket();
    return { ...s, ...withAccuracy(bucket) };
  });

/**
 * What to fix first.
 *
 * Ranked by how much of the exam is at risk — accuracy shortfall multiplied
 * by the category's blueprint weight — not by accuracy alone. Being at 40%
 * in Pharmacological Therapies (16% of the exam) outranks being at 35% in
 * Psychosocial Integrity (9%), and a list sorted on accuracy would send her
 * to the wrong one.
 *
 * Untested categories carry real risk and are included with an assumed
 * shortfall, because "we have never measured this" is not the same as "this
 * is fine" — but they sort below measured gaps of equal weight, since a
 * confirmed weakness beats a suspected one.
 */
export const priorityCategories = (profile, limit = 3) => {
  const UNTESTED_ASSUMED_SHORTFALL = 0.5;

  return categoryRows(profile)
    .map((row) => {
      const measured = row.total >= MIN_FOR_VERDICT;
      const shortfall = measured
        ? Math.max(0, STRONG_ACCURACY - row.accuracy)
        : UNTESTED_ASSUMED_SHORTFALL;
      return { ...row, measured, risk: shortfall * row.weight };
    })
    .filter((row) => row.risk > 0)
    .sort((a, b) => {
      if (b.risk !== a.risk) return b.risk - a.risk;
      // A confirmed weakness outranks a suspected one at equal risk.
      if (a.measured !== b.measured) return a.measured ? -1 : 1;
      return b.weight - a.weight;
    })
    .slice(0, limit);
};

/**
 * The format gap — the single most differentiated thing this product
 * measures, and the reason a headline percentage is a lie.
 *
 * Returns null unless there is real evidence on BOTH sides. A gap claimed
 * from two select-all questions is exactly the authoritative-sounding
 * falsehood this file exists to prevent.
 *
 * @returns {{ easy, hard, spread, easyLabel, hardLabel }|null}
 */
export const formatGap = (profile) => {
  const f = profile?.formats || {};
  const mcq = f.mcq;
  if (!hasEvidence(mcq)) return null;

  const hard = HARD_FORMATS.map((k) => ({ key: k, bucket: f[k] }))
    .filter((x) => hasEvidence(x.bucket))
    .sort((a, b) => a.bucket.accuracy - b.bucket.accuracy)[0];

  if (!hard) return null;

  const spread = mcq.accuracy - hard.bucket.accuracy;
  if (spread <= 0) return null;

  return {
    easy: mcq,
    hard: hard.bucket,
    hardKey: hard.key,
    spread,
  };
};

/**
 * Has she measurably improved on a dimension?
 *
 * Compares the first half of her attempts against the second, and refuses to
 * answer unless both halves clear MIN_FOR_TREND. Splitting six answers into
 * two threes and calling the result a trend is how a product gets caught
 * inventing progress, which costs more than never mentioning it.
 *
 * @param {Array} attempts the full log, oldest first
 * @param {(a: Object) => boolean} match which rows count
 */
export const trendFor = (attempts = [], match = () => true) => {
  const rows = (Array.isArray(attempts) ? attempts : []).filter(match);
  if (rows.length < MIN_FOR_TREND * 2) return null;

  const mid = Math.floor(rows.length / 2);
  const acc = (list) =>
    list.length ? list.filter((r) => r.correct).length / list.length : 0;

  const before = acc(rows.slice(0, mid));
  const after = acc(rows.slice(mid));
  const delta = after - before;

  if (Math.abs(delta) < TREND_DELTA) return null;
  return { before, after, delta, improving: delta > 0, sample: rows.length };
};

/**
 * Subject-level readout for a subject page: its areas, each with a verdict.
 * Areas she has never met are `untested`, which is the honest starting
 * state and the one the plan's "Not assessed" column was reaching for.
 */
export const areaRows = (profile, subjectId) => {
  const subject = findSubject(subjectId);
  if (!subject) return [];
  return subject.areas.map((area) => {
    const bucket = profile?.areas?.[area] || emptyBucket();
    return { area, ...withAccuracy(bucket) };
  });
};

/**
 * Concepts she got wrong and has not since fixed, worst first.
 *
 * Deliberately excludes anything with no misses — this list is a to-do, and
 * padding it with things she already knows makes it useless at a glance.
 */
export const openConcepts = (profile, limit = 6) =>
  Object.entries(profile?.concepts || {})
    .map(([concept, b]) => ({ concept, ...b }))
    .filter((c) => c.total - c.correct > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, limit);

/** Formats as display rows, in a fixed order so the row never moves. */
export const formatRows = (profile) =>
  FORMATS.map((key) => {
    const bucket = profile?.formats?.[key] || emptyBucket();
    return { key, ...withAccuracy(bucket) };
  });

/** Clinical-reasoning skills that have evidence, weakest first. */
export const skillRows = (profile) =>
  Object.entries(profile?.skills || {})
    .map(([id, b]) => ({ id, ...b }))
    .filter((s) => hasEvidence(s))
    .sort((a, b) => a.accuracy - b.accuracy);

/**
 * What the engine has picked up so far, for the "building your profile"
 * screen.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Between her first answer and her twelfth, the home page had nothing to say
 * and said it eight times — a blueprint grid reading "Not measured" down
 * every row. That screen is accurate and demoralising: it reports what the
 * product does not know instead of what it is doing.
 *
 * These four rows report the same state as WORK IN PROGRESS. Nothing here is
 * invented — each count is a real fold over her attempts — but a count of
 * zero renders as "gathering data" rather than as a verdict of nothing,
 * because at answer three that is the honest description.
 *
 * `has` is what the UI fills its dot with; `count` is what it can quote.
 */
export const learningSignals = (profile) => {
  const t = profile?.totals || {};
  const areas = Object.keys(profile?.categories || {}).length;
  const formats = Object.keys(profile?.formats || {}).length;
  return [
    { id: 'knowledge', count: t.answered || 0, has: (t.answered || 0) > 0 },
    { id: 'confidence', count: t.withConfidence || 0, has: (t.withConfidence || 0) > 0 },
    { id: 'areas', count: areas, has: areas > 0 },
    { id: 'formats', count: formats, has: formats > 0 },
  ];
};
