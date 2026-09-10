import { buildProfile } from './nclexProfile';
import {
  nextSpec,
  formatForIndex,
  categoryForIndex,
  topicFor,
  sessionLength,
  FORMAT_CYCLE,
  SESSION_MAX,
  SESSION_MIN,
  estimatedMinutes,
} from './nclexSpec';

const rows = (n, hits, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    category: 'PHAR',
    format: 'mcq',
    correct: i < hits,
    ...extra,
  }));

describe('formatForIndex — the hard-format quota', () => {
  it('opens on multiple choice', () => {
    expect(formatForIndex(0)).toBe('mcq');
  });

  it('reaches both hard formats inside the first cycle', () => {
    const first = FORMAT_CYCLE.map((_, i) => formatForIndex(i));
    expect(first).toContain('sata');
    expect(first).toContain('casestudy');
  });

  it('keeps hard formats at a third or more of a long session', () => {
    const served = Array.from({ length: 30 }, (_, i) => formatForIndex(i));
    const hard = served.filter((f) => f === 'sata' || f === 'casestudy').length;
    expect(hard / served.length).toBeGreaterThanOrEqual(0.33);
  });

  it('honours a forced format', () => {
    expect(formatForIndex(0, 'casestudy')).toBe('casestudy');
    expect(formatForIndex(3, 'sata')).toBe('sata');
  });
});

describe('categoryForIndex', () => {
  const empty = buildProfile([]);

  it('respects an explicit category', () => {
    expect(categoryForIndex(empty, 0, { category: 'PSYCH' })).toBe('PSYCH');
  });

  it('stays inside a subject when one is given', () => {
    const seen = new Set(
      Array.from({ length: 6 }, (_, i) =>
        categoryForIndex(empty, i, { subject: 'adult-health' })
      )
    );
    [...seen].forEach((c) => expect(['PA', 'RR']).toContain(c));
  });

  it('sweeps all eight categories over a 25-question diagnostic', () => {
    const seen = new Set(
      Array.from({ length: 25 }, (_, i) => categoryForIndex(empty, i, { mode: 'diagnostic' }))
    );
    expect(seen.size).toBe(8);
  });

  it('weights the diagnostic sweep toward heavier categories', () => {
    const served = Array.from({ length: 25 }, (_, i) =>
      categoryForIndex(empty, i, { mode: 'diagnostic' })
    );
    const count = (c) => served.filter((x) => x === c).length;
    // Management of Care (15-21%) must appear more than Psychosocial (6-12%).
    expect(count('MC')).toBeGreaterThan(count('PSYCH'));
  });

  it('targets measured weakness once there is a profile', () => {
    const spread = ['MC', 'SIC', 'HPM', 'PSYCH', 'BC', 'PHAR', 'RR', 'PA'].flatMap((c) =>
      rows(10, c === 'PHAR' ? 1 : 9, { category: c })
    );
    const p = buildProfile(spread);
    const served = Array.from({ length: 6 }, (_, i) => categoryForIndex(p, i, {}));
    expect(served).toContain('PHAR');
  });
});

describe('topicFor — concrete beats abstract', () => {
  it('prefers the area', () => {
    expect(topicFor({ area: 'Insulin onset', subject: 'pharmacology', category: 'PHAR' }))
      .toBe('Insulin onset');
  });

  it('falls back to the subject label', () => {
    expect(topicFor({ subject: 'pediatrics', category: 'HPM' })).toBe('Pediatrics');
  });

  it('falls back to a subject that scores into the category', () => {
    expect(topicFor({ category: 'PSYCH' })).toBe('Mental Health');
  });

  it('never returns empty', () => {
    expect(topicFor({}).length).toBeGreaterThan(0);
  });
});

describe('nextSpec', () => {
  it('produces everything the generator needs', () => {
    const s = nextSpec(buildProfile([]), 0, { mode: 'diagnostic' });
    expect(s.topic).toBeTruthy();
    expect(s.instructions).toBeTruthy();
    expect(s.format).toBe('mcq');
    expect(s.category).toBeTruthy();
    expect(s.difficulty).toBeGreaterThanOrEqual(1);
    expect(s.difficulty).toBeLessThanOrEqual(3);
  });

  it('eases off for a category she is drowning in', () => {
    const p = buildProfile(rows(10, 2, { category: 'PHAR' }));
    expect(nextSpec(p, 0, { category: 'PHAR' }).difficulty).toBe(1);
  });

  it('raises difficulty where she is demonstrably strong', () => {
    const p = buildProfile(rows(10, 9, { category: 'PHAR' }));
    expect(nextSpec(p, 0, { category: 'PHAR' }).difficulty).toBe(3);
  });

  it('stays at the middle without enough evidence either way', () => {
    const p = buildProfile(rows(3, 0, { category: 'PHAR' }));
    expect(nextSpec(p, 0, { category: 'PHAR' }).difficulty).toBe(2);
  });

  it('asks for the concept label, without which nothing aggregates', () => {
    const s = nextSpec(buildProfile([]), 0, {});
    expect(s.instructions.toLowerCase()).toContain('concept');
  });

  it('names the client-needs category in the instructions', () => {
    const s = nextSpec(buildProfile([]), 0, { category: 'PHAR' });
    expect(s.instructions).toContain('Pharmacological');
  });
});

describe('sessionLength — a query string cannot order 500 LLM calls', () => {
  it('defaults by mode', () => {
    expect(sessionLength(undefined, 'diagnostic')).toBe(25);
    expect(sessionLength(undefined, 'practice')).toBe(10);
  });

  it('clamps the top', () => {
    expect(sessionLength('9999', 'practice')).toBe(SESSION_MAX);
  });

  it('rejects nonsense and anything under the floor', () => {
    expect(sessionLength('abc', 'practice')).toBe(10);
    expect(sessionLength('-4', 'practice')).toBe(10);
    expect(sessionLength(String(SESSION_MIN), 'practice')).toBe(SESSION_MIN);
  });
});

describe('estimatedMinutes — honest, and derived from the rotation', () => {
  it('follows the format cycle rather than a flat per-question constant', () => {
    // 10 questions of the real rotation include two case studies at 180s, so
    // the estimate must land well above 10 * the multiple-choice cost.
    expect(estimatedMinutes(10)).toBeGreaterThan(Math.round((10 * 25) / 60));
  });

  it('is cheaper for an all-multiple-choice session', () => {
    expect(estimatedMinutes(10, 'mcq')).toBeLessThan(estimatedMinutes(10));
  });

  it('is dearer for an all-case-study session', () => {
    expect(estimatedMinutes(10, 'casestudy')).toBeGreaterThan(estimatedMinutes(10));
  });

  it('never rounds a real session down to zero', () => {
    expect(estimatedMinutes(1)).toBeGreaterThanOrEqual(1);
    expect(estimatedMinutes(0)).toBe(1);
  });
});
