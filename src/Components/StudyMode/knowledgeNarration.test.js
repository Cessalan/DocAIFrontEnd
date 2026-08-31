import { buildNarration, revealedAt } from './knowledgeNarration';
import { buildKnowledgeMap } from './knowledgeMapModel';

const a = (topic, concept, correct) => ({ topic, concept, correct });

// Two strong topics, one weak — so the plural strength phrasing is used.
const mixedMap = () =>
  buildKnowledgeMap(
    [
      a('Cardiac', 'preload vs afterload', true),
      a('Cardiac', 'beta blockers', true),
      a('Neuro', 'GCS scoring', true),
      a('Neuro', 'ICP signs', true),
      a('Renal', 'GFR', false),
      a('Renal', 'dialysis timing', false),
    ],
    []
  );

const keys = (beats) => beats.map((b) => b.key);

describe('buildNarration — it is a conversation, not a report', () => {
  it('opens by acknowledging what she just did', () => {
    // She answered six questions for us. Leading with findings treats that
    // as data collection rather than as effort.
    const beats = buildNarration(mixedMap(), 12);
    expect(beats[0].key).toBe('narration.ack');
  });

  it('names strengths before gaps, always', () => {
    const beats = buildNarration(mixedMap(), 12);
    const strongAt = keys(beats).indexOf('narration.strongMany');
    const workAt = keys(beats).indexOf('narration.work');
    expect(strongAt).toBeGreaterThan(-1);
    expect(workAt).toBeGreaterThan(strongAt);
  });

  it('ends on the deadline and the plan, in the shared voice', () => {
    const beats = buildNarration(mixedMap(), 12);
    expect(keys(beats)).toContain('coach.steady');
    expect(keys(beats)).toContain('coach.planSteady');
  });

  it('reacts to the calendar like the rest of the app', () => {
    expect(keys(buildNarration(mixedMap(), 1))).toContain('coach.tomorrow');
    expect(keys(buildNarration(mixedMap(), 0))).toContain('coach.examDay');
    expect(keys(buildNarration(mixedMap(), null))).toContain('coach.undated');
  });

  it('produces nothing at all without evidence', () => {
    expect(buildNarration(buildKnowledgeMap([], []), 5)).toEqual([]);
    expect(buildNarration(null, 5)).toEqual([]);
  });

  it('uses singular phrasing for a single strength', () => {
    const map = buildKnowledgeMap([a('Cardiac', 'x', true), a('Renal', 'y', false)], []);
    expect(keys(buildNarration(map, 12))).toContain('narration.strongOne');
  });
});

describe('the twist beat', () => {
  const twistMap = () =>
    buildKnowledgeMap(
      [
        a('Pharmacology', 'ACE inhibitors', true),
        a('Pharmacology', 'beta blockers', true),
        a('Fluid Balance', 'osmolarity', false),
        a('Fluid Balance', 'third spacing', false),
      ],
      ['Pharmacology']
    );

  it('gets a beat of its own when the data supports it', () => {
    const beats = buildNarration(twistMap(), 12);
    expect(keys(beats)).toContain('narration.contradiction');
  });

  it('changes the wording of the gaps beat that follows it', () => {
    // "What actually needs your time" only makes sense as a reply to the
    // twist; used cold it is a non-sequitur.
    expect(keys(buildNarration(twistMap(), 12))).toContain('narration.workAfterTwist');
    expect(keys(buildNarration(mixedMap(), 12))).toContain('narration.work');
  });

  it('stays silent when her self-report was right', () => {
    const map = buildKnowledgeMap(
      [
        a('Pharmacology', 'x', false),
        a('Pharmacology', 'y', false),
        a('Cardiac', 'z', true),
        a('Cardiac', 'w', true),
      ],
      ['Pharmacology']
    );
    expect(keys(buildNarration(map, 12))).not.toContain('narration.contradiction');
  });
});

describe('revealedAt — evidence lands with the sentence that names it', () => {
  it('shows nothing on the opening beat', () => {
    const beats = buildNarration(mixedMap(), 12);
    expect(revealedAt(beats, 0).size).toBe(0);
  });

  it('reveals strengths only once their beat has started', () => {
    const beats = buildNarration(mixedMap(), 12);
    const strongAt = keys(beats).indexOf('narration.strongMany');
    expect(revealedAt(beats, strongAt - 1).has('strong')).toBe(false);
    expect(revealedAt(beats, strongAt).has('strong')).toBe(true);
    expect(revealedAt(beats, strongAt).has('work')).toBe(false);
  });

  it('has everything visible by the last beat', () => {
    const beats = buildNarration(mixedMap(), 12);
    const all = revealedAt(beats, beats.length - 1);
    expect(all.has('strong')).toBe(true);
    expect(all.has('work')).toBe(true);
  });
});
