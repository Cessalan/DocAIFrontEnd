import {
  buildProfile,
  classify,
  categoryRows,
  priorityCategories,
  formatGap,
  trendFor,
  areaRows,
  openConcepts,
  MIN_FOR_VERDICT,
  MIN_FOR_STRENGTH,
  learningSignals,
} from './nclexProfile';

/** n attempts in one bucket, `hits` of them correct. */
const rows = (n, hits, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({
    subject: 'pharmacology',
    category: 'PHAR',
    format: 'mcq',
    correct: i < hits,
    ...extra,
  }));

describe('classify — the strength/weakness asymmetry', () => {
  it('gives no verdict below MIN_FOR_VERDICT', () => {
    expect(classify({ correct: 4, total: 4 })).toBe('untested');
    expect(classify({ correct: 0, total: 4 })).toBe('untested');
  });

  it('calls a gap as soon as there is any evidence at all', () => {
    expect(classify({ correct: 1, total: MIN_FOR_VERDICT })).toBe('gap');
  });

  it('refuses to say "solid" on a small sample, however good', () => {
    // 5 for 5 is perfect and still not enough to stop studying something.
    expect(classify({ correct: 5, total: 5 })).toBe('provisional');
  });

  it('says solid once the sample earns it', () => {
    expect(classify({ correct: MIN_FOR_STRENGTH, total: MIN_FOR_STRENGTH })).toBe('solid');
  });

  it('puts the middle band in improving', () => {
    expect(classify({ correct: 7, total: 10 })).toBe('improving');
  });
});

describe('buildProfile', () => {
  it('never invents a row for a missing dimension', () => {
    const p = buildProfile([
      { correct: true, format: 'mcq' },              // no subject, no category
      { correct: false, subject: '', category: null },
    ]);
    expect(Object.keys(p.subjects)).toHaveLength(0);
    expect(Object.keys(p.categories)).toHaveLength(0);
    expect(p.formats.mcq.total).toBe(1);
    expect(p.totals.answered).toBe(2);
  });

  it('grades partial credit as not-correct but records it', () => {
    const p = buildProfile([
      { format: 'sata', correct: false, partialScore: 0.75 },
      { format: 'sata', correct: false, partialScore: 0 },
    ]);
    expect(p.formats.sata.correct).toBe(0);
    expect(p.formats.sata.partial).toBe(1);
  });

  it('folds a question into every skill it exercises', () => {
    const p = buildProfile([
      { correct: false, skills: ['prioritization', 'deterioration'] },
    ]);
    expect(p.skills.prioritization.total).toBe(1);
    expect(p.skills.deterioration.total).toBe(1);
  });

  it('survives junk rows', () => {
    expect(() => buildProfile([null, undefined, 'x', 7])).not.toThrow();
    expect(buildProfile(null).totals.answered).toBe(0);
  });
});

describe('categoryRows', () => {
  it('includes every category, even untouched ones', () => {
    const out = categoryRows(buildProfile(rows(10, 8)));
    expect(out).toHaveLength(8);
    expect(out.filter((r) => r.verdict === 'untested')).toHaveLength(7);
  });
});

describe('priorityCategories — ranks by exam risk, not by accuracy', () => {
  it('puts a heavier category above a slightly worse lighter one', () => {
    // PSYCH (6-12%, mid 9) at 30%  vs  PHAR (13-19%, mid 16) at 40%.
    // Accuracy alone would pick PSYCH; risk-weighting must pick PHAR.
    //
    // Asserted as a RELATIVE ordering, not as the global first: the six
    // untested categories are legitimately in this ranking too, and the
    // heaviest of them (MC, 15-21%) outranks both of these measured ones.
    // That is the intended behaviour — an unmeasured slice of that size is
    // the single largest thing at risk — so the claim under test is only
    // that PHAR beats PSYCH.
    const attempts = [
      ...rows(10, 3, { category: 'PSYCH' }),
      ...rows(10, 4, { category: 'PHAR' }),
    ];
    const out = priorityCategories(buildProfile(attempts), 8);
    const at = (code) => out.findIndex((r) => r.code === code);
    expect(at('PHAR')).toBeGreaterThanOrEqual(0);
    expect(at('PHAR')).toBeLessThan(at('PSYCH'));
  });

  it('ranks the heaviest untested category above measured mid-range gaps', () => {
    // The corollary of the rule above, stated directly so it cannot regress
    // silently: "never measured" on 15-21% of the exam outranks "40%" on
    // 13-19% of it.
    const attempts = [
      ...rows(10, 4, { category: 'PHAR' }),
      ...rows(10, 3, { category: 'PSYCH' }),
    ];
    const [first] = priorityCategories(buildProfile(attempts), 8);
    expect(first.code).toBe('MC');
    expect(first.measured).toBe(false);
  });

  it('prefers a confirmed weakness over an unmeasured one at equal risk', () => {
    const attempts = rows(10, 3, { category: 'MC' }); // measured, weak, heavy
    const out = priorityCategories(buildProfile(attempts), 8);
    const mc = out.find((r) => r.code === 'MC');
    expect(mc.measured).toBe(true);
    expect(out.indexOf(mc)).toBe(0);
  });

  it('still surfaces untested categories as risk', () => {
    const out = priorityCategories(buildProfile([]), 3);
    expect(out).toHaveLength(3);
    expect(out.every((r) => r.measured === false)).toBe(true);
    // heaviest untested first
    expect(out[0].code).toBe('MC');
  });
});

describe('formatGap', () => {
  it('returns null without evidence on both sides', () => {
    expect(formatGap(buildProfile(rows(10, 9)))).toBeNull(); // mcq only
    expect(
      formatGap(buildProfile([...rows(10, 9), ...rows(2, 0, { format: 'sata' })]))
    ).toBeNull(); // 2 sata is not evidence
  });

  it('finds the widest real gap and names the format', () => {
    const p = buildProfile([
      ...rows(20, 17, { format: 'mcq' }),
      ...rows(10, 4, { format: 'sata' }),
      ...rows(10, 2, { format: 'casestudy' }),
    ]);
    const gap = formatGap(p);
    expect(gap.hardKey).toBe('casestudy'); // the worst, not merely the first
    expect(gap.spread).toBeCloseTo(0.85 - 0.2, 5);
  });

  it('returns null when she is no worse on the hard formats', () => {
    const p = buildProfile([
      ...rows(10, 5, { format: 'mcq' }),
      ...rows(10, 8, { format: 'sata' }),
    ]);
    expect(formatGap(p)).toBeNull();
  });
});

describe('trendFor', () => {
  it('refuses to call a trend on a short log', () => {
    expect(trendFor(rows(6, 3))).toBeNull();
  });

  it('detects real improvement across halves', () => {
    const log = [...rows(5, 1), ...rows(5, 5)];
    const t = trendFor(log);
    expect(t.improving).toBe(true);
    expect(t.delta).toBeGreaterThan(0);
  });

  it('ignores movement inside the noise band', () => {
    const log = [...rows(6, 3), ...rows(6, 3)];
    expect(trendFor(log)).toBeNull();
  });
});

describe('areaRows / openConcepts', () => {
  it('lists every area of a subject, untested by default', () => {
    const out = areaRows(buildProfile([]), 'pharmacology');
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((a) => a.verdict === 'untested')).toBe(true);
  });

  it('returns nothing for an unknown subject', () => {
    expect(areaRows(buildProfile([]), 'astrology')).toEqual([]);
  });

  it('lists only concepts with at least one miss, worst first', () => {
    const p = buildProfile([
      ...rows(4, 4, { concept: 'beta blockers' }),
      ...rows(4, 1, { concept: 'insulin onset' }),
      ...rows(4, 2, { concept: 'digoxin toxicity' }),
    ]);
    const out = openConcepts(p);
    expect(out.map((c) => c.concept)).toEqual(['insulin onset', 'digoxin toxicity']);
  });
});

describe('learningSignals — the "building" screen', () => {
  const ids = (p) => learningSignals(p).map((x) => x.id);

  it('always returns the same four rows, in the same order', () => {
    expect(ids(buildProfile([]))).toEqual([
      'knowledge',
      'confidence',
      'areas',
      'formats',
    ]);
    expect(ids(buildProfile(rows(9, 5)))).toEqual(ids(buildProfile([])));
  });

  it('reports nothing as gathered rather than as a verdict', () => {
    expect(learningSignals(buildProfile([])).every((x) => x.has === false)).toBe(true);
    expect(learningSignals(buildProfile([])).every((x) => x.count === 0)).toBe(true);
  });

  it('counts confidence only where it was actually given', () => {
    const p = buildProfile([
      { correct: true, format: 'mcq', confidence: 'very_sure' },
      { correct: false, format: 'mcq' },
      { correct: false, format: 'sata', confidence: 'not_sure' },
    ]);
    const conf = learningSignals(p).find((x) => x.id === 'confidence');
    expect(conf.count).toBe(2);
    expect(conf.has).toBe(true);
  });

  it('counts DISTINCT areas and formats, not answers', () => {
    const p = buildProfile([
      ...rows(4, 2, { category: 'PHAR', format: 'mcq' }),
      ...rows(3, 1, { category: 'MC', format: 'sata' }),
    ]);
    const get = (id) => learningSignals(p).find((x) => x.id === id);
    expect(get('knowledge').count).toBe(7);
    expect(get('areas').count).toBe(2);
    expect(get('formats').count).toBe(2);
  });

  it('survives a junk profile', () => {
    expect(() => learningSignals(null)).not.toThrow();
    expect(learningSignals(undefined)).toHaveLength(4);
  });
});
