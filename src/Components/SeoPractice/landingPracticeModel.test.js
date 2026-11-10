import catalog from './catalog.json';
import { LANDING_PRACTICE_PAGE, landingPracticePool } from './landingPracticeModel';
import { pickSet } from './model';
import { buildIntent, QUESTION_TARGETS } from './seoToNclex';

describe('landingPracticePool', () => {
  const pool = landingPracticePool();

  test('holds enough questions for several visits', () => {
    expect(pool.length).toBeGreaterThanOrEqual(LANDING_PRACTICE_PAGE.sessionSize * 5);
  });

  test('serves single-answer questions only', () => {
    expect(pool.every((q) => q.type === 'mcq')).toBe(true);
  });

  test('every question can carry through signup as an attempt', () => {
    expect(pool.every((q) => QUESTION_TARGETS[q.id])).toBe(true);
  });

  test('keeps out the HESI A2 admission bank', () => {
    const admission = new Set(catalog.banks['hesi-a2-practice-test']);
    expect(pool.some((q) => admission.has(q.id))).toBe(false);
  });

  test('a set spans three different subjects', () => {
    const set = pickSet(pool, LANDING_PRACTICE_PAGE.sessionSize, []);
    expect(set).toHaveLength(3);
    expect(new Set(set.map((q) => q.section)).size).toBe(3);
  });
});

describe('handing the homepage result to the app', () => {
  const [first, second] = landingPracticePool();
  const wrong = (q) => [q.options.findIndex((_, i) => !q.answer.includes(i))];
  const value = (answers) => ({ answers, questionIds: [first.id, second.id], result: {} });

  test('the intent carries her answers and what she missed', () => {
    const intent = buildIntent(
      LANDING_PRACTICE_PAGE,
      value({ [first.id]: first.answer, [second.id]: wrong(second) })
    );
    expect(intent.sourcePage).toBe('landing-practice');
    expect(intent.attempts).toHaveLength(2);
    expect(intent.missedConcepts).toEqual([second.concept]);
    expect(intent.subject).toBe(QUESTION_TARGETS[second.id].subject);
  });

  test('a clean sweep still hands off, with no subject invented', () => {
    const intent = buildIntent(
      LANDING_PRACTICE_PAGE,
      value({ [first.id]: first.answer, [second.id]: second.answer })
    );
    expect(intent.score.percentage).toBe(100);
    expect(intent.subject).toBeNull();
  });
});
