import {
  buildCheckpointNarration,
  isSpeakableConcept,
  recommendationBeat,
  revealedAt,
} from './checkpointNarration';
import { createDrillState, recordAnswer, buildCheckpoint } from './drillModel';

const answerMany = (state, n, opts) => {
  let s = state;
  for (let i = 0; i < n; i += 1) s = recordAnswer(s, opts);
  return s;
};

const keys = (beats) => beats.map((b) => b.key);

describe('isSpeakableConcept', () => {
  it('accepts a short label the generator was asked for', () => {
    expect(isSpeakableConcept('preload vs afterload')).toBe(true);
    expect(isSpeakableConcept('Fall risk assessment')).toBe(true);
  });

  it('rejects the truncated sentences the generator sometimes returns', () => {
    // Real example from production: quiztools.py cuts the label at 120 chars,
    // and reading this back to a student is worse than saying nothing.
    expect(
      isSpeakableConcept(
        'The American Academy of Sleep Medicine and Sleep Research Society recommend 7-9 hours of sleep per night for healthy adu'
      )
    ).toBe(false);
  });

  it('rejects anything that reads as a sentence rather than a label', () => {
    expect(isSpeakableConcept('Nurses should always check the order first.')).toBe(false);
    expect(isSpeakableConcept('a b c d e f g h')).toBe(false);
    expect(isSpeakableConcept('')).toBe(false);
    expect(isSpeakableConcept(null)).toBe(false);
  });
});

describe('buildCheckpointNarration', () => {
  it('says nothing when nothing has been answered', () => {
    expect(buildCheckpointNarration(buildCheckpoint(createDrillState()))).toEqual([]);
    expect(buildCheckpointNarration(null)).toEqual([]);
  });

  it('opens by acknowledging the work, not by reporting', () => {
    const s = answerMany(createDrillState(['A']), 5, { topic: 'A', format: 'mcq', isCorrect: true });
    expect(keys(buildCheckpointNarration(buildCheckpoint(s)))[0]).toBe('drill.beatAck');
  });

  it('drops the hedge once there is enough evidence', () => {
    const s = answerMany(createDrillState(['A']), 12, { topic: 'A', format: 'mcq', isCorrect: true });
    expect(keys(buildCheckpointNarration(buildCheckpoint(s)))[0]).toBe('drill.beatAckMany');
  });

  it('leads with strengths before delivering the correction', () => {
    let s = answerMany(createDrillState(['A', 'B']), 2, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: true });
    s = answerMany(s, 4, { topic: 'B', format: 'casestudy', isCorrect: false });

    const k = keys(buildCheckpointNarration(buildCheckpoint(s)));
    expect(k.indexOf('drill.beatStrongOne')).toBeGreaterThan(-1);
    expect(k.indexOf('drill.beatStrongOne')).toBeLessThan(k.indexOf('drill.beatWeak'));
  });

  it('puts the format gap ahead of the weak topic', () => {
    // The gap reframes every other finding — a student told only "weak on B"
    // goes and re-reads her B notes, which will not help.
    let s = answerMany(createDrillState(['A']), 8, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 4, { topic: 'A', format: 'casestudy', isCorrect: false });
    s = answerMany(s, 3, { topic: 'B', format: 'mcq', isCorrect: false });

    const k = keys(buildCheckpointNarration(buildCheckpoint(s)));
    expect(k).toContain('drill.beatFormatGap');
    expect(k).toContain('drill.beatWeak');
    expect(k.indexOf('drill.beatFormatGap')).toBeLessThan(k.indexOf('drill.beatWeak'));
  });

  it('speaks the two percentages inside the sentence', () => {
    let s = answerMany(createDrillState(['A']), 4, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 4, { topic: 'A', format: 'casestudy', isCorrect: false });

    const beat = buildCheckpointNarration(buildCheckpoint(s))
      .find((b) => b.key === 'drill.beatFormatGap');
    expect(beat.params).toEqual({ mcq: 100, hard: 0 });
  });

  it('calls an MCQ-only run unproven when no gap is established yet', () => {
    const s = answerMany(createDrillState(['A']), 5, { topic: 'A', format: 'mcq', isCorrect: true });
    expect(keys(buildCheckpointNarration(buildCheckpoint(s)))).toContain('drill.beatProvisional');
  });

  it('will not call it a format problem when multiple choice is failing too', () => {
    // The production checkpoint: 33% MCQ, 0% on the hard formats, and the
    // tutor opened with "you know this material". It also must not fall
    // through to "nothing has fallen over yet" — she got one of five.
    let s = recordAnswer(createDrillState(['A', 'B', 'C', 'D', 'E']), { topic: 'A', format: 'mcq', isCorrect: true });
    s = recordAnswer(s, { topic: 'B', format: 'mcq', isCorrect: false });
    s = recordAnswer(s, { topic: 'C', format: 'mcq', isCorrect: false });
    s = recordAnswer(s, { topic: 'D', format: 'sata', isCorrect: false });
    s = recordAnswer(s, { topic: 'E', format: 'casestudy', isCorrect: false });

    const k = keys(buildCheckpointNarration(buildCheckpoint(s)));
    expect(k).not.toContain('drill.beatFormatGap');
    expect(k).not.toContain('drill.beatNothingYet');
    expect(k).toContain('drill.beatStruggling');
    // And the closing instruction follows from it, rather than moving her on.
    expect(k[k.length - 1]).toBe('drill.beatRecFoundations');
  });

  it('notices the first hard-format answer to land, right after naming the gap', () => {
    // 100% MCQ, one select-all in twelve: the format sentence reads "8%" out
    // loud, and without this beat the block she just spent getting there is
    // invisible.
    let s = answerMany(createDrillState(['A']), 3, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: false });
    s = { ...s, lastCheckpointAt: 5 };
    s = answerMany(s, 9, { topic: 'A', format: 'sata', isCorrect: false });
    s = recordAnswer(s, { topic: 'A', format: 'sata', isCorrect: true });

    const k = keys(buildCheckpointNarration(buildCheckpoint(s)));
    expect(k).toContain('drill.beatFirstHardWin');
    expect(k.indexOf('drill.beatFormatGap')).toBeLessThan(k.indexOf('drill.beatFirstHardWin'));
  });

  it('names a misconception only when the label is speakable', () => {
    let s = createDrillState(['A']);
    s = recordAnswer(s, { topic: 'A', format: 'mcq', isCorrect: false, conceptKey: 'preload vs afterload' });
    s = recordAnswer(s, { topic: 'A', format: 'sata', isCorrect: false, conceptKey: 'preload vs afterload' });

    const beat = buildCheckpointNarration(buildCheckpoint(s))
      .find((b) => b.key === 'drill.beatMisconception');
    expect(beat.params.concept).toBe('preload vs afterload');
  });

  it('reports the repetition without reading back an unusable label', () => {
    const junk =
      'The American Academy of Sleep Medicine and Sleep Research Society recommend 7-9 hours of sleep per night for healthy adu';
    let s = createDrillState(['A']);
    s = recordAnswer(s, { topic: 'A', format: 'mcq', isCorrect: false, conceptKey: junk });
    s = recordAnswer(s, { topic: 'A', format: 'sata', isCorrect: false, conceptKey: junk });

    const k = keys(buildCheckpointNarration(buildCheckpoint(s)));
    expect(k).toContain('drill.beatMisconceptionUnnamed');
    expect(k).not.toContain('drill.beatMisconception');
  });

  it('admits when nothing has broken instead of claiming readiness', () => {
    let s = answerMany(createDrillState(['A']), 2, { topic: 'A', format: 'mcq', isCorrect: true });
    s = recordAnswer(s, { topic: 'A', format: 'sata', isCorrect: true });
    const k = keys(buildCheckpointNarration(buildCheckpoint(s)));
    // Strong topic gets a beat, so the "nothing yet" line should not appear.
    expect(k).toContain('drill.beatStrongOne');
    expect(k).not.toContain('drill.beatNothingYet');
  });

  it('always closes on what happens next', () => {
    const s = answerMany(createDrillState(['A', 'B']), 5, { topic: 'A', format: 'mcq', isCorrect: true });
    const k = keys(buildCheckpointNarration(buildCheckpoint(s)));
    expect(k[k.length - 1]).toMatch(/^drill\.beatRec/);
  });

  it('never mentions a raw score anywhere in the narration', () => {
    let s = answerMany(createDrillState(['A']), 4, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 3, { topic: 'B', format: 'sata', isCorrect: false });
    const beats = buildCheckpointNarration(buildCheckpoint(s));
    beats.forEach((b) => {
      expect(b.fallback).not.toMatch(/\{\{correct\}\}|\{\{total\}\}|\d+\/\d+/);
    });
  });
});

describe('recommendationBeat', () => {
  it('returns nothing without a recommendation', () => {
    expect(recommendationBeat(null)).toBeNull();
  });

  it('maps each recommendation kind to its own line', () => {
    expect(recommendationBeat({ kind: 'format', format: 'sata' }).key).toBe('drill.beatRecFormat');
    expect(recommendationBeat({ kind: 'weakTopic', topic: 'A' }).key).toBe('drill.beatRecWeak');
    expect(recommendationBeat({ kind: 'proveIt', topic: 'A' }).key).toBe('drill.beatRecProveIt');
    expect(recommendationBeat({ kind: 'broaden' }).key).toBe('drill.beatRecBroaden');
  });
});

describe('revealedAt', () => {
  it('reveals evidence only once its beat has started', () => {
    const beats = [
      { key: 'a', reveals: null },
      { key: 'b', reveals: 'gap' },
      { key: 'c', reveals: 'weak' },
    ];
    expect(revealedAt(beats, 0).has('gap')).toBe(false);
    expect(revealedAt(beats, 1).has('gap')).toBe(true);
    expect(revealedAt(beats, 2).has('weak')).toBe(true);
  });
});
