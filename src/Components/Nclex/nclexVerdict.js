/* ══════════════════════════════════════════════════════════════════════
   NCLEX VERDICT — the sentence the whole product is judged on.

   WHY A VERDICT AND NOT A SCORE
   ─────────────────────────────
   A percentage is the one number that lets a student keep believing the
   average. Measured across 68 students and 1,081 graded answers:

                 MCQ      SATA     case study
       Pro      81.7%     29.6%      14.8%
       Free     88.2%     43.2%      22.2%

   "You're at 69%" is almost never a knowledge level. It is a strong
   multiple-choice score being dragged down by two formats she cannot do —
   and the two she cannot do are the two her exam leans on hardest. Telling
   her the average is not a simplification, it is the specific wrong answer.

   So `buildVerdict` returns a headline that leads with the SPREAD wherever
   the evidence supports one, and falls back to coverage language where it
   does not. The number is never the first thing said.

   THE WORD "READINESS", NEVER "PASS PROBABILITY"
   ──────────────────────────────────────────────
   `readiness` here is a coverage-aware weighted estimate: every client-needs
   category counts in proportion to its share of the real exam, and
   categories she has never been tested on count as zero rather than being
   skipped. That makes it honest about ignorance — the number starts low and
   rises as she proves things, which is the correct direction for a student
   who has answered nothing.

   It is NOT calibrated against real NCLEX outcomes, and until it is, no
   string in this file may call it a probability of passing. Same discipline
   as readinessProjection's "estimated" wording and conceptLedger's rule
   against fabricating a key. A confident number we cannot back is the
   fastest way to lose an audience whose entire reason for paying is that
   they trust the diagnosis.

   EVERY CLAIM CARRIES ITS EVIDENCE
   ────────────────────────────────
   Each returned block includes what it was computed from, so the UI can show
   "based on 34 answers across 5 categories" beside the claim. A verdict that
   cannot show its working is indistinguishable from one that was guessed.
   ══════════════════════════════════════════════════════════════════════ */

import { FORMAT_LABELS } from './nclexCurriculum';
import {
  categoryRows,
  formatGap,
  priorityCategories,
  MIN_FOR_VERDICT,
} from './nclexProfile';

/**
 * Answers below which we refuse to give a readiness figure at all.
 *
 * Deliberately higher than MIN_FOR_VERDICT (which gates a single bucket): a
 * whole-exam claim spans eight categories and three formats, and a number
 * derived from six answers would be quoted back to her as if it meant
 * something.
 */
export const MIN_FOR_READINESS = 12;

/** Bands for the qualitative label. Coverage-aware, so these run low. */
export const BANDS = [
  { min: 0.75, key: 'strong',     label: 'On track' },
  { min: 0.55, key: 'building',   label: 'Building' },
  { min: 0.35, key: 'early',      label: 'Early days' },
  { min: 0,    key: 'atrisk',     label: 'At risk' },
];

export const bandFor = (readiness) =>
  BANDS.find((b) => readiness >= b.min) || BANDS[BANDS.length - 1];

/**
 * Coverage-aware readiness.
 *
 * Every category contributes its blueprint weight. A category with no
 * evidence contributes ZERO rather than being excluded from the
 * denominator — excluding it would let a student who has answered nothing
 * but twelve pharmacology questions read as 90% ready.
 *
 * @returns {{ value, measuredWeight, totalWeight, answered, categoriesSeen }}
 */
export const readinessEstimate = (profile) => {
  const rows = categoryRows(profile);
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0) || 1;

  let earned = 0;
  let measuredWeight = 0;
  let answered = 0;
  let categoriesSeen = 0;

  rows.forEach((r) => {
    answered += r.total;
    if (r.total >= MIN_FOR_VERDICT) {
      earned += r.accuracy * r.weight;
      measuredWeight += r.weight;
      categoriesSeen += 1;
    }
  });

  return {
    value: earned / totalWeight,
    measuredWeight,
    totalWeight,
    coverage: measuredWeight / totalWeight,
    answered,
    categoriesSeen,
  };
};

/**
 * The headline.
 *
 * Order of preference, and it is the product:
 *
 *   1. Not enough evidence  → say so plainly, ask for more answers.
 *   2. A real format gap    → lead with the spread. This is the finding she
 *                             cannot get anywhere else and the one that
 *                             changes what she does tomorrow.
 *   3. Thin coverage        → lead with what has not been measured, because
 *                             an unmeasured category is a risk, not a pass.
 *   4. Otherwise            → lead with the heaviest weakness.
 *
 * `kind` lets the UI style each case; `evidence` lets it show the working.
 */
export const buildVerdict = (profile) => {
  const readiness = readinessEstimate(profile);
  const gap = formatGap(profile);
  const priorities = priorityCategories(profile, 3);
  const band = bandFor(readiness.value);

  const base = { readiness, band, gap, priorities };

  if (readiness.answered < MIN_FOR_READINESS) {
    return {
      ...base,
      kind: 'insufficient',
      headline: 'Not enough answers yet to call it.',
      detail:
        `Answer ${MIN_FOR_READINESS - readiness.answered} more and you'll get a real ` +
        'breakdown by category and format — not a score.',
      evidence: `${readiness.answered} answered`,
      showReadiness: false,
    };
  }

  if (gap) {
    const pct = (n) => Math.round(n * 100);
    return {
      ...base,
      kind: 'format-gap',
      headline: `${pct(gap.easy.accuracy)}% on multiple choice. ${pct(gap.hard.accuracy)}% on ${FORMAT_LABELS[gap.hardKey].toLowerCase()}.`,
      detail:
        'Your exam leans hardest on the second one. The average you have been ' +
        'trusting is a multiple-choice score — this is the number that matters.',
      evidence: `${gap.easy.total} multiple choice · ${gap.hard.total} ${FORMAT_LABELS[gap.hardKey].toLowerCase()}`,
      showReadiness: true,
    };
  }

  if (readiness.coverage < 0.5) {
    const unseen = 8 - readiness.categoriesSeen;
    return {
      ...base,
      kind: 'coverage',
      headline: `You have been measured on ${readiness.categoriesSeen} of 8 content areas.`,
      detail:
        `The other ${unseen} are not passing — they are unknown, and they count ` +
        'as zero until you prove otherwise.',
      evidence: `${readiness.answered} answered across ${readiness.categoriesSeen} areas`,
      showReadiness: true,
    };
  }

  const worst = priorities[0];
  if (worst) {
    return {
      ...base,
      kind: 'priority',
      headline: `${worst.label} is where the most of your exam is at risk.`,
      detail: worst.measured
        ? `You are at ${Math.round(worst.accuracy * 100)}% there, and it carries ` +
          `${worst.min}–${worst.max}% of the exam.`
        : `It carries ${worst.min}–${worst.max}% of the exam and you have not been tested on it yet.`,
      evidence: `${readiness.answered} answered across ${readiness.categoriesSeen} areas`,
      showReadiness: true,
    };
  }

  return {
    ...base,
    kind: 'steady',
    headline: 'No single area is dragging you down.',
    detail: 'Keep the volume up and keep meeting the harder formats.',
    evidence: `${readiness.answered} answered`,
    showReadiness: true,
  };
};

/**
 * What to do next — one recommendation, and it must follow from the verdict.
 *
 * The rule borrowed from nodeReadout: a recommendation that claims to target
 * the pattern just described, and then serves something generic, teaches the
 * student that the observation was decoration. So each branch returns the
 * parameters that actually build the practice it promises.
 *
 * @returns {{ label, sublabel, subject, category, format, count }}
 */
export const nextAction = (profile) => {
  const verdict = buildVerdict(profile);

  if (verdict.kind === 'insufficient') {
    return {
      kind: 'diagnostic',
      label: 'Take the readiness check',
      sublabel: '25 questions across all 8 areas',
      count: 25,
    };
  }

  if (verdict.gap) {
    const fmt = verdict.gap.hardKey;
    return {
      kind: 'format',
      label: `Drill ${FORMAT_LABELS[fmt].toLowerCase()}`,
      sublabel: 'The format your exam leans on and your weakest one',
      format: fmt,
      count: 10,
    };
  }

  const worst = verdict.priorities[0];
  if (worst) {
    return {
      kind: 'category',
      label: `Practice ${worst.label}`,
      sublabel: worst.measured
        ? `You are at ${Math.round(worst.accuracy * 100)}% on ${worst.min}–${worst.max}% of the exam`
        : `${worst.min}–${worst.max}% of the exam, never tested`,
      category: worst.code,
      count: 10,
    };
  }

  return {
    kind: 'mixed',
    label: 'Mixed practice',
    sublabel: 'Blueprint-weighted across all areas',
    count: 10,
  };
};
