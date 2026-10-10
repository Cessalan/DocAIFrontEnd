import { isRightCall, planWalkthrough, stageAt, STAGE, toIndices, shouldAutoOpen, recordAutoOpen, AUTO_OPEN_TIMES } from './walkthroughModel';

describe('planWalkthrough', () => {
  // Digoxin: key A, B, D. She picked A, D, E (missed B, wrongly picked E).
  const plan = planWalkthrough(5, [0, 1, 3], [0, 3, 4]);

  it('walks the options top to bottom, the way the method is used on the exam', () => {
    expect(plan.order).toEqual([0, 1, 2, 3, 4]);
  });

  it('names her mistakes so the tutor can call them out as she reaches them', () => {
    expect(plan.missed).toEqual([1, 4]);
  });

  it('starts at A even when A was one of her mistakes', () => {
    const p = planWalkthrough(4, [0], [1, 2, 3]);
    expect(p.order[0]).toBe(0);
    expect(p.missed).toEqual([0, 1, 2, 3]);
  });

  it('survives an empty question', () => {
    expect(planWalkthrough(0, [], []).order).toEqual([]);
  });
});

it('maps positions to the three stages', () => {
  expect([0, 1, 2, 4].map(stageAt)).toEqual([STAGE.WATCH, STAGE.TOGETHER, STAGE.YOURS, STAGE.YOURS]);
});

it('marks her taps against the answer key only', () => {
  expect(isRightCall(1, true, [0, 1, 3])).toBe(true);
  expect(isRightCall(4, true, [0, 1, 3])).toBe(false);
  expect(isRightCall(2, false, [0, 1, 3])).toBe(true);
});

it('turns stored option texts into indices', () => {
  expect(toIndices(['a', 'b', 'c'], ['c', 'a', 'zzz'])).toEqual([2, 0]);
  expect(toIndices(['a', 'b'], 'b')).toEqual([1]);
  expect(toIndices(['A) Check pulse', 'B) Hold dose'], ['Hold dose'])).toEqual([1]);
});

describe('first-time auto-open', () => {
  const store = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

  it('opens on its own for the first misses, then waits for the button', () => {
    const s = store();
    for (let i = 0; i < AUTO_OPEN_TIMES; i += 1) {
      expect(shouldAutoOpen(s)).toBe(true);
      recordAutoOpen(s);
    }
    expect(shouldAutoOpen(s)).toBe(false);
  });

  it('never auto-opens when storage is unavailable', () => {
    expect(shouldAutoOpen(null)).toBe(false);
    expect(shouldAutoOpen({ getItem: () => { throw new Error('blocked'); } })).toBe(false);
  });
});
