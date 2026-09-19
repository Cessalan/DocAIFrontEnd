import { buildVerdict, MAX_FINDINGS } from './readinessVerdict';

const a = (topic, format, correct, extra = {}) => ({ topic, format, correct, partial: false, kind: null, ...extra });

describe('buildVerdict', () => {
  it('is null for a skipped check, so the plain preview is used', () => {
    expect(buildVerdict([])).toBeNull();
    expect(buildVerdict(null)).toBeNull();
    expect(buildVerdict([{ correct: true }])).toBeNull();
  });

  it('names a format gap once, folding the select-all and case evidence into it', () => {
    const v = buildVerdict([
      a('Heart failure', 'mcq', true, { kind: 'applied' }),
      a('Electrolytes', 'mcq', true, { kind: 'applied' }),
      a('Heart failure', 'sata', false, { partial: true }),
      a('Electrolytes', 'sata', false, { partial: true }),
      a('Falls', 'sata', false),
      a('Heart failure', 'casestudy', false),
    ]);
    const gap = v.findings[0];
    expect(gap.key).toBe('formatGap');
    expect(gap.standard).toEqual({ total: 2, correct: 2, partial: 0 });
    expect(gap.hard).toEqual({ total: 4, correct: 0, partial: 2 });
    expect(gap).toMatchObject({ confidence: 'clear', severity: 'high' });
    expect(v.findings.some(f => f.key === 'sata' || f.key === 'casestudy')).toBe(false);
  });

  it('reports select-all and case studies separately when the content itself is shaky', () => {
    const v = buildVerdict([
      a('Heart failure', 'mcq', false),
      a('Electrolytes', 'mcq', false),
      a('Heart failure', 'sata', false, { partial: true }),
      a('Electrolytes', 'sata', true),
      a('Falls', 'sata', false),
      a('Falls', 'casestudy', false),
    ]);
    const keys = v.findings.map(f => f.key);
    expect(keys).not.toContain('formatGap');
    expect(v.findings.find(f => f.key === 'sata')).toMatchObject({ total: 3, correct: 1, partial: 1, confidence: 'clear' });
    expect(v.findings.find(f => f.key === 'casestudy')).toMatchObject({ total: 1, confidence: 'early', severity: 'early' });
  });

  it('flags missed priority questions, as an early signal on little evidence', () => {
    const v = buildVerdict([
      a('Falls', 'mcq', false, { kind: 'prioritization' }),
      a('Heart failure', 'mcq', true, { kind: 'prioritization' }),
      a('Heart failure', 'mcq', true, { kind: 'applied' }),
    ]);
    expect(v.findings.find(f => f.key === 'priority')).toMatchObject({ total: 2, correct: 1, confidence: 'early' });
  });

  it('labels severity: early on thin evidence, high at a third or less, otherwise needs work', () => {
    const v = buildVerdict([
      a('A', 'mcq', false), a('A', 'mcq', false), a('A', 'mcq', true),
      a('B', 'mcq', false), a('B', 'mcq', true), a('B', 'mcq', false), a('B', 'mcq', true),
      a('C', 'mcq', false), a('C', 'mcq', false),
    ]);
    expect(Object.fromEntries(v.findings.map(f => [f.topic, f.severity])))
      .toEqual({ A: 'high', B: 'needsWork', C: 'early' });
  });

  it('flags a verdict made only of early signals, so the label is said once', () => {
    const thin = buildVerdict([a('A', 'mcq', false), a('A', 'mcq', false), a('B', 'mcq', true), a('B', 'mcq', false)]);
    expect(thin.allEarly).toBe(true);
    const firm = buildVerdict([a('A', 'mcq', false), a('A', 'mcq', false), a('A', 'mcq', false)]);
    expect(firm.allEarly).toBe(false);
    expect(buildVerdict([a('A', 'mcq', true)]).allEarly).toBe(false);
  });

  it('does not call a topic weak on a single answer', () => {
    const v = buildVerdict([a('Falls', 'mcq', false), a('Heart failure', 'mcq', true), a('Heart failure', 'mcq', true)]);
    expect(v.findings.filter(f => f.key === 'topic')).toEqual([]);
  });

  it('lists weak topics weakest first', () => {
    const v = buildVerdict([
      a('Heart failure', 'mcq', true), a('Heart failure', 'mcq', false),
      a('Electrolytes', 'mcq', false), a('Electrolytes', 'mcq', false), a('Electrolytes', 'mcq', false),
    ]);
    expect(v.findings.filter(f => f.key === 'topic').map(f => f.topic)).toEqual(['Electrolytes', 'Heart failure']);
    expect(v.findings.find(f => f.topic === 'Electrolytes').confidence).toBe('clear');
  });

  it('never shows more than the cap', () => {
    const rows = [
      a('A', 'mcq', false), a('A', 'mcq', false),
      a('B', 'sata', false), a('B', 'sata', false),
      a('C', 'casestudy', false), a('C', 'mcq', false, { kind: 'prioritization' }),
      a('D', 'mcq', false), a('D', 'mcq', false),
    ];
    expect(buildVerdict(rows).findings).toHaveLength(MAX_FINDINGS);
  });

  it('says so when nothing is holding the student back, and names a strength', () => {
    const v = buildVerdict([
      a('Heart failure', 'mcq', true), a('Heart failure', 'sata', true),
      a('Falls', 'casestudy', true), a('Falls', 'mcq', true, { kind: 'prioritization' }),
    ]);
    expect(v.findings).toEqual([]);
    expect(v.strength).toMatchObject({ total: 2, correct: 2 });
    expect(v).toMatchObject({ answered: 4, correct: 4 });
  });
});
