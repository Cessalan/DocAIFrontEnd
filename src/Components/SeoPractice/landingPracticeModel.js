/**
 * The real questions on the homepage.
 *
 * WHY THIS EXISTS
 *
 * In the first week of PostHog (2026-11-01 to 11-08), 15 of 171 visitors who
 * landed on `/` signed in, against 23 of 66 on `/signup`. The homepage's "Live
 * Demo" was an animation: recordings show a student pressing it twice, finding
 * nothing to do, and leaving. Answering a question costs a visitor nothing and
 * shows the product working, so the demo card is now the real thing.
 *
 * WHY THE POOL IS FILTERED THIS WAY
 *
 * - Only ids in QUESTION_TARGETS: her answers survive signup as attempts, and an
 *   id with no target produces no attempt. This also keeps out the HESI A2 bank
 *   (fractions, vocabulary), which is admission prep, not nursing school.
 * - Only single-answer questions: this is a stranger's first impression, and
 *   select-all's all-or-nothing grading reads as unfair before she trusts us.
 *
 * WHY THREE
 *
 * pickSet balances by section, so three questions show three subjects and the
 * set ends while she still wants more, which is when the signup offer appears.
 */
import catalog from './catalog.json';
import { QUESTION_TARGETS } from './seoToNclex';

/** A catalog-shaped page. Its slug must stay in PAGE_TARGETS for the handoff. */
export const LANDING_PRACTICE_PAGE = {
  slug: 'landing-practice',
  kind: 'diagnostic',
  cluster: 'NCLEX',
  title: 'Nursing practice questions',
  icon: 'heart',
  conversion: 'Save my progress free',
  sessionSize: 3,
};

export const landingPracticePool = (questions = catalog.questions) =>
  questions.filter((q) => q.type === 'mcq' && QUESTION_TARGETS[q.id]);
