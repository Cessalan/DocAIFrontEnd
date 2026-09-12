import { buildProfile, MIN_FOR_VERDICT } from './nclexProfile';
import { handoffContext, contextInstructions, CONTEXT_TTL_MS } from './nclexHandoff';
import { nextSpec } from './nclexSpec';

const seo = (over = {}) => ({
  at: 1_000_000,
  sourcePage: 'pharmacology-nclex-questions',
  examTrack: 'RN',
  missedConcepts: ['Diuretic adverse effects', 'Medication interactions'],
  ...over,
});

describe('handoffContext — what survives into the generator', () => {
  it('names the missed concepts and the track while they are fresh', () => {
    const ctx = handoffContext(seo(), buildProfile([]), 1_000_000 + 60_000);
    expect(ctx.missedConcepts).toEqual(['Diuretic adverse effects', 'Medication interactions']);
    expect(ctx.examTrack).toBe('RN');
  });

  it('drops the whole context after the TTL', () => {
    expect(handoffContext(seo(), buildProfile([]), 1_000_000 + CONTEXT_TTL_MS + 1)).toBeNull();
  });

  it('drops a concept once the log has enough real evidence on it', () => {
    const rows = Array.from({ length: MIN_FOR_VERDICT }, () => ({
      concept: 'Diuretic adverse effects',
      correct: true,
      category: 'PHAR',
      format: 'mcq',
    }));
    const ctx = handoffContext(seo(), buildProfile(rows), 1_000_000 + 1);
    expect(ctx.missedConcepts).toEqual(['Medication interactions']);
  });

  it('returns null when there is nothing left to say', () => {
    expect(
      handoffContext(seo({ missedConcepts: [], examTrack: null }), buildProfile([]), 1_000_001)
    ).toBeNull();
  });

  it('caps the list so the model is not handed a syllabus', () => {
    const ctx = handoffContext(
      seo({ missedConcepts: ['a', 'b', 'c', 'd', 'e'] }),
      buildProfile([]),
      1_000_001
    );
    expect(ctx.missedConcepts).toHaveLength(3);
  });
});

describe('contextInstructions', () => {
  it('asks for new scenarios rather than repeats', () => {
    const lines = contextInstructions({
      missedConcepts: ['Diuretic adverse effects'],
      examTrack: 'PN',
      daysLeft: 12,
    });
    expect(lines.join(' ')).toMatch(/NCLEX-PN/);
    expect(lines.join(' ')).toMatch(/12 days/);
    expect(lines.join(' ')).toMatch(/Diuretic adverse effects/);
    expect(lines.join(' ')).toMatch(/Do not reuse/);
  });

  it('is empty for a null context', () => {
    expect(contextInstructions(null)).toEqual([]);
  });
});

describe('nextSpec carries the context into the instructions', () => {
  it('appends the context and leaves the spec fields untouched', () => {
    const plain = nextSpec(buildProfile([]), 0, { subject: 'pharmacology' });
    const withCtx = nextSpec(
      buildProfile([]),
      0,
      { subject: 'pharmacology' },
      { missedConcepts: ['Diuretic adverse effects'], examTrack: 'RN', daysLeft: null }
    );
    expect(withCtx.category).toBe(plain.category);
    expect(withCtx.format).toBe(plain.format);
    expect(withCtx.topic).toBe(plain.topic);
    expect(withCtx.instructions).toContain(plain.instructions);
    expect(withCtx.instructions).toMatch(/Diuretic adverse effects/);
  });
});
