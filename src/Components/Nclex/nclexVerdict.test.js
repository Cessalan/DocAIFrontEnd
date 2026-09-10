import { buildProfile } from './nclexProfile';
import {
  buildVerdict,
  nextAction,
  readinessEstimate,
  bandFor,
  MIN_FOR_READINESS,
} from './nclexVerdict';

const rows = (n, hits, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    category: 'PHAR',
    format: 'mcq',
    correct: i < hits,
    ...extra,
  }));

describe('readinessEstimate — coverage-aware, so ignorance costs', () => {
  it('is zero with no answers', () => {
    expect(readinessEstimate(buildProfile([])).value).toBe(0);
  });

  it('does NOT let one perfect category read as whole-exam readiness', () => {
    // 20/20 in Pharmacology only. Pharm is ~16 of ~99 weight points, so a
    // perfect score there must land near 0.16 — not near 1.0.
    const r = readinessEstimate(buildProfile(rows(20, 20)));
    expect(r.value).toBeGreaterThan(0.1);
    expect(r.value).toBeLessThan(0.25);
    expect(r.categoriesSeen).toBe(1);
  });

  it('counts an under-sampled category as unmeasured rather than as evidence', () => {
    const r = readinessEstimate(buildProfile(rows(3, 3)));
    expect(r.categoriesSeen).toBe(0);
    expect(r.value).toBe(0);
    expect(r.answered).toBe(3);
  });

  it('rises as coverage widens', () => {
    const narrow = readinessEstimate(buildProfile(rows(10, 8)));
    const wide = readinessEstimate(
      buildProfile([
        ...rows(10, 8, { category: 'PHAR' }),
        ...rows(10, 8, { category: 'MC' }),
        ...rows(10, 8, { category: 'PA' }),
      ])
    );
    expect(wide.value).toBeGreaterThan(narrow.value);
    expect(wide.coverage).toBeGreaterThan(narrow.coverage);
  });
});

describe('bandFor', () => {
  it('bands low scores as at risk and high ones as on track', () => {
    expect(bandFor(0.1).key).toBe('atrisk');
    expect(bandFor(0.45).key).toBe('early');
    expect(bandFor(0.6).key).toBe('building');
    expect(bandFor(0.9).key).toBe('strong');
  });
});

describe('buildVerdict — what it leads with', () => {
  it('refuses a readiness figure on a thin log', () => {
    const v = buildVerdict(buildProfile(rows(5, 3)));
    expect(v.kind).toBe('insufficient');
    expect(v.showReadiness).toBe(false);
    expect(v.headline).toMatch(/not enough/i);
  });

  it('leads with the format gap whenever one is real', () => {
    const v = buildVerdict(
      buildProfile([
        ...rows(20, 17, { format: 'mcq' }),
        ...rows(10, 3, { format: 'sata' }),
      ])
    );
    expect(v.kind).toBe('format-gap');
    expect(v.headline).toContain('85%');
    expect(v.headline).toContain('30%');
    expect(v.evidence).toMatch(/20 multiple choice/);
  });

  it('leads with coverage when she has only seen a corner of the exam', () => {
    // Wide enough log to clear MIN_FOR_READINESS, one format only so no gap.
    const v = buildVerdict(buildProfile(rows(20, 14, { format: 'mcq' })));
    expect(v.kind).toBe('coverage');
    expect(v.headline).toMatch(/1 of 8/);
  });

  it('leads with the heaviest weakness once coverage is broad', () => {
    const spread = ['MC', 'SIC', 'HPM', 'PSYCH', 'BC', 'PHAR', 'RR', 'PA'].flatMap((c) =>
      rows(10, c === 'MC' ? 3 : 9, { category: c })
    );
    const v = buildVerdict(buildProfile(spread));
    expect(v.kind).toBe('priority');
    expect(v.headline).toContain('Management of Care');
  });

  it('always carries its evidence', () => {
    const v = buildVerdict(buildProfile(rows(20, 14)));
    expect(typeof v.evidence).toBe('string');
    expect(v.evidence.length).toBeGreaterThan(0);
  });

  it('never uses the words "pass" or "probability"', () => {
    const cases = [
      buildProfile([]),
      buildProfile(rows(20, 17)),
      buildProfile([...rows(20, 17), ...rows(10, 2, { format: 'sata' })]),
    ];
    cases.forEach((p) => {
      const v = buildVerdict(p);
      const text = `${v.headline} ${v.detail}`.toLowerCase();
      expect(text).not.toMatch(/probability/);
      expect(text).not.toMatch(/\bpass\b/);
    });
  });
});

describe('nextAction — must follow from the verdict', () => {
  it('sends a cold user to the diagnostic', () => {
    expect(nextAction(buildProfile([])).kind).toBe('diagnostic');
  });

  it('targets the exact format named by the gap', () => {
    const a = nextAction(
      buildProfile([
        ...rows(20, 17, { format: 'mcq' }),
        ...rows(10, 4, { format: 'sata' }),
        ...rows(10, 1, { format: 'casestudy' }),
      ])
    );
    expect(a.kind).toBe('format');
    expect(a.format).toBe('casestudy');
  });

  it('targets the exact category named as the priority', () => {
    const spread = ['MC', 'SIC', 'HPM', 'PSYCH', 'BC', 'PHAR', 'RR', 'PA'].flatMap((c) =>
      rows(10, c === 'PHAR' ? 2 : 9, { category: c })
    );
    const a = nextAction(buildProfile(spread));
    expect(a.kind).toBe('category');
    expect(a.category).toBe('PHAR');
  });

  it('always has something to do', () => {
    expect(nextAction(buildProfile([])).label).toBeTruthy();
    expect(nextAction(buildProfile(rows(MIN_FOR_READINESS, 6))).label).toBeTruthy();
  });
});
