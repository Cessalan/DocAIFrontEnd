import { SENTIMENT } from '../../Services/satisfactionEnums';

/**
 * cancelSurveyModel — what a cancellation answer MEANS, kept out of the modal.
 *
 * WHY THIS EXISTS
 *
 * The first churned subscriber (2026-09-06) answered Stripe's built-in portal
 * question with "other" and no comment. Stripe's list is generic SaaS
 * ("too expensive", "missing features", "switched service") and has no slot for
 * the most likely answer in this product: the exam is over. Our Pro users pay
 * around an exam and cram in bursts, so "she passed and left" is a large share
 * of churn, and it is a SUCCESS. Counted together with "this didn't help me",
 * the churn number says nothing about product-market fit.
 *
 * So the one distinction this module exists to make is natural churn vs product
 * failure (`CHURN_KIND`). Every reason maps to exactly one kind, and the
 * dashboard reports the failure share, never raw churn.
 *
 * DESIGN NOTES
 *
 *  - Only the exam-done reason asks a follow-up (how it went). A pass rate among
 *    students who left after the exam is an outcome almost no study product can
 *    measure, and it is the clearest PMF signal available here.
 *
 *  - Sentiment is derived, not asked. Passed → +1; reasons that name a product
 *    failure → -1; everything else (price, didn't use it, other) → 0. That keeps
 *    these rows comparable with every other surface's thumbs without making the
 *    student rate us on her way out.
 *
 *  - `examDaysFromNow` is SIGNED (negative = exam already past), unlike
 *    upgradeCopy's daysUntilExam which nulls out past dates. "Exam is done" with
 *    an onboarding exam date three weeks away is worth seeing.
 */

/** Which kind of churn a reason represents. */
export const CHURN_KIND = {
  NATURAL: 'natural',     // finished what she came for
  FAILURE: 'failure',     // the product did not do its job
  CIRCUMSTANCE: 'circumstance' // price, time, life
};

/**
 * The reasons, in the order they are offered. `needsDetail` opens a text box
 * under the choice so "other" can never again arrive empty by default.
 */
export const CANCEL_REASONS = [
  { id: 'exam_done', kind: CHURN_KIND.NATURAL },
  { id: 'not_helping', kind: CHURN_KIND.FAILURE },
  { id: 'questions_mismatch', kind: CHURN_KIND.FAILURE },
  { id: 'too_expensive', kind: CHURN_KIND.CIRCUMSTANCE },
  { id: 'switched', kind: CHURN_KIND.FAILURE, needsDetail: true },
  { id: 'didnt_use', kind: CHURN_KIND.CIRCUMSTANCE },
  { id: 'other', kind: CHURN_KIND.CIRCUMSTANCE, needsDetail: true }
];

/** How the exam went. Only asked after `exam_done`. */
export const EXAM_OUTCOMES = ['passed', 'not_passed', 'waiting', 'private'];

const byId = new Map(CANCEL_REASONS.map((r) => [r.id, r]));

export const reasonFor = (id) => byId.get(id) || null;

export const churnKindFor = (reasonId) => reasonFor(reasonId)?.kind || null;

/** Does this reason get a follow-up about the exam result? */
export const asksOutcome = (reasonId) => reasonId === 'exam_done';

/** -1 / 0 / +1 from the answers. Null until a reason is picked. */
export const sentimentFor = (reasonId, outcome = null) => {
  const kind = churnKindFor(reasonId);
  if (!kind) return null;
  if (kind === CHURN_KIND.FAILURE) return SENTIMENT.NEGATIVE;
  if (reasonId === 'exam_done' && outcome === 'passed') return SENTIMENT.POSITIVE;
  return SENTIMENT.NEUTRAL;
};

/** Whole days from now to the exam; negative once it has passed. Null if unknown. */
export const examDaysFromNow = (examDate, now = Date.now()) => {
  if (!examDate) return null;
  const then = new Date(examDate).getTime();
  if (Number.isNaN(then)) return null;
  return Math.round((then - now) / 86400000);
};

/** Whole days since Pro started, from a Firestore Timestamp, Date or string. */
export const proTenureDays = (proSince, now = Date.now()) => {
  if (!proSince) return null;
  const date = typeof proSince.toDate === 'function' ? proSince.toDate() : new Date(proSince);
  const t = date.getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86400000));
};

/**
 * Everything written to the signal row, in one place so the modal cannot write
 * a half-shaped row. The outcome is dropped when the reason no longer asks for
 * it: a student who picks "exam done", taps "passed", then switches to "too
 * expensive" did not tell us she passed.
 */
export const buildCancelSignal = ({
  reasonId,
  outcome = null,
  detail = '',
  stayNote = '',
  examDate = null,
  proSince = null,
  locale = null,
  continuedToPortal = false,
  now = Date.now()
} = {}) => {
  const keptOutcome = asksOutcome(reasonId) && EXAM_OUTCOMES.includes(outcome) ? outcome : null;
  const cleanDetail = String(detail || '').trim().slice(0, 500);
  const cleanStay = String(stayNote || '').trim().slice(0, 1000);
  return {
    sentiment: sentimentFor(reasonId, keptOutcome),
    reasons: reasonId ? [reasonId] : [],
    // The "would have kept you" answer is the one meant to be read, so it is
    // the comment the dashboard lists. The reason's detail stays in context.
    comment: cleanStay || null,
    context: {
      churnKind: churnKindFor(reasonId),
      examOutcome: keptOutcome,
      reasonDetail: reasonFor(reasonId)?.needsDetail ? cleanDetail || null : null,
      examDaysFromNow: examDaysFromNow(examDate, now),
      proTenureDays: proTenureDays(proSince, now),
      locale: locale || null,
      // Answering is not cancelling: she may still back out on Stripe's page.
      // Cross-check against billing.canceledAt before treating a row as churn.
      continuedToPortal: continuedToPortal === true
    }
  };
};
