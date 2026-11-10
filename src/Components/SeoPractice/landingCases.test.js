import catalog from './catalog.json';
import { caseOutcome, LANDING_CASES } from './landingCases';
import { chartText, isUsable } from '../ChatInerface/orderWalkthroughModel';

const cases = LANDING_CASES.filter((c) => c.kind === 'casestudy');
const sata = LANDING_CASES.filter((c) => c.kind === 'sata');

describe('the stored case-study walkthroughs', () => {
  test.each(cases.map((c) => [c.id, c]))('%s renders in full', (_, c) => {
    expect(isUsable(c.walkthrough, c.quiz.options.length)).toBe(true);
  });

  test.each(cases.map((c) => [c.id, c]))('%s quotes only what the chart says', (_, c) => {
    const chart = `${chartText(c.quiz.caseStudy.nursesNotes)} ${c.quiz.question}`.toLowerCase();
    c.walkthrough.breakdown.forEach((part) => {
      expect(chart).toContain(part.quote.toLowerCase());
    });
  });

  test.each(cases.map((c) => [c.id, c]))('%s has a key covering every action once', (_, c) => {
    const key = c.quiz.correctOrder.map((k) => k.id).sort();
    expect(key).toEqual(c.quiz.options.map((o) => o.id).sort());
  });

  test.each(cases.map((c) => [c.id, c]))('%s does not show the actions in the right order', (_, c) => {
    expect(c.quiz.options.map((o) => o.id)).not.toEqual(c.quiz.correctOrder.map((k) => k.id));
  });
});

describe('the stored select-all walkthrough', () => {
  test.each(sata.map((c) => [c.id, c]))('%s never contradicts the answer key', (_, c) => {
    const { options, answer } = c.quiz;
    expect(c.walkthrough.options).toHaveLength(options.length);
    c.walkthrough.options.forEach((o) => {
      expect(o.verdict).toBe(answer.includes(options[o.index]));
    });
  });

  test('matches the catalog question it came from', () => {
    const source = catalog.questions.find((q) => q.id === 'p-2');
    const { quiz } = sata[0];
    expect(quiz.question).toBe(source.stem);
    expect(quiz.options).toEqual(source.options);
    expect(quiz.answer).toEqual(source.answer.map((i) => source.options[i]));
  });
});

describe('caseOutcome', () => {
  test('a right answer', () => {
    expect(caseOutcome({ isCorrect: true }).line).toBe('All right');
  });
  test('an order counts the places she got right', () => {
    const line = caseOutcome({ isCorrect: false, scoreResult: { correctPositions: 2, totalItems: 4 } }).line;
    expect(line).toBe('2 of 4 in the right place');
  });
  test('a partial select-all has no places to count', () => {
    expect(caseOutcome({ isCorrect: false, scoreResult: {} }).line).toBe('Partly right');
  });
  test('a step she never answered is not invented', () => {
    expect(caseOutcome(undefined).done).toBe(false);
  });
});
