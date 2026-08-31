import { meanReadinessPct, computeReadinessDelta } from './readinessDelta';

const perf = (topics) => ({
  topics: Object.fromEntries(
    Object.entries(topics).map(([name, [correct, total]]) => [
      name,
      { questionsCorrect: correct, questionsTotal: total },
    ])
  ),
});

const CURRICULUM = ['Cardiac', 'Renal', 'Endocrine', 'Neuro', 'Respiratory'];

describe('meanReadinessPct', () => {
  it('counts untested curriculum topics as zero', () => {
    // One topic aced out of five is 20% ready, not 100% ready.
    expect(meanReadinessPct(perf({ Cardiac: [5, 5] }), CURRICULUM)).toBe(20);
  });

  it('agrees with the readiness card when everything is measured', () => {
    const p = perf({
      Cardiac: [5, 5], Renal: [5, 5], Endocrine: [5, 5],
      Neuro: [5, 5], Respiratory: [5, 5],
    });
    expect(meanReadinessPct(p, CURRICULUM)).toBe(100);
  });

  it('matches labels that drifted from the curriculum name', () => {
    const p = perf({ 'Cardiac - Quiz': [4, 4] });
    expect(meanReadinessPct(p, CURRICULUM)).toBe(20);
  });

  it('prefers the better-evidenced entry when two keys collapse onto one topic', () => {
    // A 1-question entry must not outvote a 10-question one.
    const p = perf({ 'Cardiac': [10, 10], 'Cardiac - Drill': [0, 1] });
    expect(meanReadinessPct(p, CURRICULUM)).toBe(20);
  });

  it('falls back to touched topics when no curriculum is known', () => {
    expect(meanReadinessPct(perf({ Cardiac: [5, 5] }), [])).toBe(100);
    expect(meanReadinessPct(perf({}), [])).toBeNull();
  });
});

describe('computeReadinessDelta — the bug it exists to prevent', () => {
  it('does not inflate one good node into a huge jump', () => {
    // THE REGRESSION. Before the fix this averaged over touched topics only,
    // so with two topics in the doc a single 5/5 read as "+28% closer to
    // ready". Against a five-topic curriculum it is worth 20 points at most,
    // and that is the honest number.
    const before = perf({ Cardiac: [2, 5], Renal: [1, 5] });
    const after = perf({ Cardiac: [5, 5], Renal: [1, 5] });

    const naive =
      meanReadinessPct(after, []) - meanReadinessPct(before, []);
    const honest = computeReadinessDelta(before, after, CURRICULUM);

    expect(Math.round(naive)).toBe(30);   // what she used to be shown
    expect(honest).toBe(12);              // what is actually true
  });

  it('keeps the denominator fixed when a node opens a new topic', () => {
    // Before the fix, `before` was a mean over 1 topic and `after` over 2 —
    // not comparable, and capable of going negative after a good node.
    const before = perf({ Cardiac: [5, 5] });
    const after = perf({ Cardiac: [5, 5], Renal: [3, 5] });
    expect(computeReadinessDelta(before, after, CURRICULUM)).toBe(12);
  });

  it('hides a decline rather than reporting it', () => {
    const before = perf({ Cardiac: [5, 5] });
    const after = perf({ Cardiac: [5, 10] });
    expect(computeReadinessDelta(before, after, CURRICULUM)).toBeNull();
  });

  it('hides a delta that rounds to nothing', () => {
    // "↑ 0% closer to ready" reads as a bug, not as a small win.
    const before = perf({ Cardiac: [5, 5] });
    const after = perf({ Cardiac: [5, 5] });
    expect(computeReadinessDelta(before, after, CURRICULUM)).toBeNull();
  });

  it('returns null without both snapshots', () => {
    expect(computeReadinessDelta(null, perf({}), CURRICULUM)).toBeNull();
    expect(computeReadinessDelta(perf({}), null, CURRICULUM)).toBeNull();
  });
});
