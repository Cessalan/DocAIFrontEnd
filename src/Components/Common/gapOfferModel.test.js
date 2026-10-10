import { gapFromPractice, gapFromVerdict, MIN_PER_SIDE } from './gapOfferModel';
import { buildVerdict } from '../StudyMode/readinessVerdict';

describe('gapFromPractice', () => {
  // The 2026-10-09 payer, across her two plans.
  const kayla = [
    { matrix: { total: 7, correct: 0 }, casestudy: { total: 17, correct: 6 }, sata: { total: 7, correct: 2 }, mcq: { total: 39, correct: 33 } },
    { matrix: { total: 1, correct: 0 }, casestudy: { total: 5, correct: 1 }, sata: { total: 1, correct: 0 }, mcq: { total: 20, correct: 19 } },
  ];

  it('adds up every chat and names the gap', () => {
    const gap = gapFromPractice(kayla);
    expect(gap.source).toBe('practice');
    expect(gap.standard).toEqual({ correct: 52, total: 59 });
    expect(gap.hard).toEqual({ correct: 9, total: 38 });
    expect(gap.rows.map(r => [r.format, r.pct])).toEqual([['mcq', 88], ['sata', 25], ['casestudy', 32], ['matrix', 0]]);
    expect(gap.weakest).toBe('matrix');
  });

  it('stays quiet without enough answers on each side', () => {
    expect(gapFromPractice([{ mcq: { total: 20, correct: 19 }, sata: { total: MIN_PER_SIDE - 1, correct: 0 } }])).toBeNull();
    expect(gapFromPractice([{ mcq: { total: MIN_PER_SIDE - 1, correct: 4 }, sata: { total: 20, correct: 2 } }])).toBeNull();
  });

  it('stays quiet when there is no real gap', () => {
    expect(gapFromPractice([{ mcq: { total: 20, correct: 17 }, sata: { total: 10, correct: 8 } }])).toBeNull();
  });

  it('stays quiet when multiple choice is weak too: that is not a format gap', () => {
    expect(gapFromPractice([{ mcq: { total: 20, correct: 10 }, sata: { total: 10, correct: 0 } }])).toBeNull();
  });

  it('only gives a format its own bar with enough answers', () => {
    const gap = gapFromPractice([{ mcq: { total: 20, correct: 19 }, sata: { total: 6, correct: 1 }, matrix: { total: 2, correct: 0 } }]);
    expect(gap.rows.map(r => r.format)).toEqual(['mcq', 'sata']);
    expect(gap.weakest).toBe('sata');
  });

  it('names no weakest format when none has enough answers on its own', () => {
    const gap = gapFromPractice([{ mcq: { total: 20, correct: 19 }, sata: { total: 2, correct: 0 }, casestudy: { total: 2, correct: 0 }, matrix: { total: 2, correct: 0 } }]);
    expect(gap.rows.map(r => r.format)).toEqual(['mcq']);
    expect(gap.weakest).toBeNull();
  });

  it('survives junk', () => {
    expect(gapFromPractice(null)).toBeNull();
    expect(gapFromPractice([null, { mcq: { total: 'x' } }])).toBeNull();
    expect(gapFromPractice([{ mcq: { total: 10, correct: 50 }, sata: { total: 10, correct: 0 } }]).standard).toEqual({ correct: 10, total: 10 });
  });
});

describe('gapFromVerdict', () => {
  const answers = [
    ...[0, 1, 2, 3].map(() => ({ topic: 'A', format: 'mcq', correct: true })),
    { topic: 'A', format: 'sata', correct: false },
    { topic: 'A', format: 'sata', correct: false },
    { topic: 'B', format: 'casestudy', correct: true },
    { topic: 'B', format: 'casestudy', correct: false },
  ];

  it('reuses the verdict finding, so the offer and the finding agree', () => {
    expect(gapFromVerdict(buildVerdict(answers))).toEqual({
      source: 'check', standard: { correct: 4, total: 4 }, hard: { correct: 1, total: 4 },
    });
  });

  it('is null when the verdict found no format gap', () => {
    expect(gapFromVerdict(buildVerdict(answers.map(a => ({ ...a, correct: true }))))).toBeNull();
    expect(gapFromVerdict(null)).toBeNull();
  });
});
