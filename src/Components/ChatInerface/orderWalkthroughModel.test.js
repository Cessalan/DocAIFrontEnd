import {
  STAGE, LADDER_RUNGS, RULES, stageAt, chartText, isUsable, firstSlip, isRightPick, ladderState,
  shouldAutoOpen, recordAutoOpen, AUTO_OPEN_TIMES,
} from './orderWalkthroughModel';

// A real production miss (2026-10-10, anonymous): the key and her order.
const KEY = ['hearing', 'quiet', 'interpreter', 'written', 'teachback'];
const HERS = ['hearing', 'interpreter', 'quiet', 'written', 'teachback'];

const item = (rung, rule = 'sequence') => ({ rung, rule, label: 'x', why_here: 'y', nudge: 'z' });
const DATA = {
  ladder: 'barriers',
  first_thinking: ['Can he hear you?', 'So hearing aids first.'],
  items: [item(0, 'barrier_first'), item(1, 'barrier_first'), item(2), item(3, 'teach_last'), item(4)],
};

describe('stages', () => {
  it('watch the first, do the second together, the rest are hers', () => {
    expect([0, 1, 2, 3].map(stageAt)).toEqual([STAGE.WATCH, STAGE.TOGETHER, STAGE.YOURS, STAGE.YOURS]);
  });
});

describe('chartText', () => {
  it('keeps paragraph breaks as spaces and decodes entities', () => {
    expect(chartText('<p><strong>0815:</strong> Dizzy.</p><p>Cap refill &lt;2 seconds&nbsp;and &#39;anxious&#39;</p>'))
      .toBe("0815: Dizzy. Cap refill <2 seconds and 'anxious'");
  });
  it('is empty for nothing', () => {
    expect(chartText(undefined)).toBe('');
  });
});

describe('isUsable', () => {
  it('accepts a full response', () => {
    expect(isUsable(DATA, 5)).toBe(true);
  });
  it('refuses a ladder this side cannot name', () => {
    expect(isUsable({ ...DATA, ladder: 'new_ladder' }, 5)).toBe(false);
  });
  it('refuses a rung off the ladder or an unknown rule', () => {
    expect(isUsable({ ...DATA, items: [...DATA.items.slice(0, 4), item(9)] }, 5)).toBe(false);
    expect(isUsable({ ...DATA, items: [...DATA.items.slice(0, 4), item(4, 'vibes')] }, 5)).toBe(false);
  });
  it('refuses a count that does not match the card', () => {
    expect(isUsable(DATA, 4)).toBe(false);
    expect(isUsable(null, 5)).toBe(false);
  });
});

describe('firstSlip', () => {
  it('names the first slot she got wrong, what she put there and what belonged', () => {
    expect(firstSlip(KEY, HERS)).toEqual({ position: 1, hers: 'interpreter', right: 'quiet' });
  });
  it('is null when she had it right or nothing was recorded', () => {
    expect(firstSlip(KEY, KEY)).toBeNull();
    expect(firstSlip(KEY, [])).toBeNull();
    expect(firstSlip(KEY, ['hearing'])).toBeNull();
  });
});

describe('isRightPick', () => {
  it('marks against the stored order only', () => {
    expect(isRightPick(KEY, 1, 'quiet')).toBe(true);
    expect(isRightPick(KEY, 1, 'interpreter')).toBe(false);
  });
});

describe('ladderState', () => {
  it('lights the rung of the slot being placed and remembers the climbed ones', () => {
    const s = ladderState(DATA.items, 2);
    expect(s.current).toBe(2);
    expect([...s.climbed]).toEqual([0, 1]);
    expect(ladderState(DATA.items, 5).current).toBeNull();
  });
});

describe('contract with order_walkthrough.py', () => {
  it('has the same ladders, rung counts and rules', () => {
    expect(Object.fromEntries(Object.entries(LADDER_RUNGS).map(([k, v]) => [k, v.length])))
      .toEqual({ abc: 6, process: 5, barriers: 5, procedure: 5, maslow: 5 });
    expect(RULES).toHaveLength(11);
  });
});

describe('first-time auto-open', () => {
  const memory = () => {
    const m = {};
    return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } };
  };
  it('opens on its own for the first misses on a device, then waits', () => {
    const s = memory();
    for (let n = 0; n < AUTO_OPEN_TIMES; n += 1) {
      expect(shouldAutoOpen(s)).toBe(true);
      recordAutoOpen(s);
    }
    expect(shouldAutoOpen(s)).toBe(false);
  });
  it('never auto-opens without storage', () => {
    expect(shouldAutoOpen(null)).toBe(false);
    expect(shouldAutoOpen({ getItem: () => { throw new Error('blocked'); } })).toBe(false);
  });
});
