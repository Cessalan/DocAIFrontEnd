import {
  buildKnowledgeMap,
  findContradiction,
  buildReasonLine,
} from './knowledgeMapModel';

const a = (topic, concept, correct, unsure = false) => ({
  topic,
  concept,
  correct,
  unsure,
});

describe('buildKnowledgeMap', () => {
  it('splits topics into strong and needs-work', () => {
    const map = buildKnowledgeMap([
      a('Cardiac', 'preload vs afterload', true),
      a('Cardiac', 'beta blockers', true),
      a('Renal', 'GFR', false),
      a('Renal', 'dialysis timing', false),
    ]);
    expect(map.strong.map((t) => t.topic)).toEqual(['Cardiac']);
    expect(map.needsWork.map((t) => t.topic)).toEqual(['Renal']);
  });

  it('lists the weakest topic first — the list reads as a plan', () => {
    const map = buildKnowledgeMap([
      a('Half', 'x', true),
      a('Half', 'y', false),
      a('Zero', 'z', false),
    ]);
    expect(map.needsWork.map((t) => t.topic)).toEqual(['Zero', 'Half']);
  });

  it('collects the concepts behind each verdict, not just a score', () => {
    // The evidence line is what makes this understanding rather than grading.
    const map = buildKnowledgeMap([
      a('Cardiac', 'preload vs afterload', false),
      a('Cardiac', 'beta blockers', true),
    ]);
    const cardiac = map.topics.find((t) => t.topic === 'Cardiac');
    expect(cardiac.missed).toEqual(['preload vs afterload']);
    expect(cardiac.got).toEqual(['beta blockers']);
  });

  it('treats "not sure" as not known', () => {
    const map = buildKnowledgeMap([
      a('Renal', 'GFR', false, true),
      a('Renal', 'dialysis', false, true),
    ]);
    expect(map.needsWork.map((t) => t.topic)).toEqual(['Renal']);
  });

  it('survives answers with no concept label', () => {
    const map = buildKnowledgeMap([
      { topic: 'Cardiac', correct: true },
      { topic: 'Cardiac', correct: true },
    ]);
    expect(map.strong).toHaveLength(1);
    expect(map.topics[0].got).toEqual([]);
  });

  it('reports no evidence for an empty diagnostic', () => {
    expect(buildKnowledgeMap([]).hasEvidence).toBe(false);
  });
});

describe('findContradiction — "you said X, but it is actually Y"', () => {
  const topics = [
    { topic: 'Pharmacology', pct: 100, tier: 'solid' },
    { topic: 'Fluid Balance', pct: 0, tier: 'gap' },
  ];

  it('fires when she feared a topic she is actually solid on', () => {
    expect(findContradiction(topics, ['Pharmacology'])).toEqual({
      feared: 'Pharmacology',
      actual: 'Fluid Balance',
    });
  });

  it('stays silent when her self-report was right', () => {
    expect(findContradiction(topics, ['Fluid Balance'])).toBeNull();
  });

  it('stays silent when she named nothing', () => {
    expect(findContradiction(topics, [])).toBeNull();
  });

  it('stays silent when the gap is too small to be worth claiming', () => {
    // Being wrong here is worse than saying nothing, so the bar is high.
    const close = [
      { topic: 'Pharmacology', pct: 80, tier: 'solid' },
      { topic: 'Fluid Balance', pct: 60, tier: 'shaky' },
    ];
    expect(findContradiction(close, ['Pharmacology'])).toBeNull();
  });

  it('stays silent when there is only one topic to talk about', () => {
    expect(findContradiction([topics[0]], ['Pharmacology'])).toBeNull();
  });

  it('matches loosely, since her wording and the topic name differ', () => {
    expect(findContradiction(topics, ['pharmacology'])).toBeTruthy();
  });
});

describe('buildReasonLine', () => {
  it('counts strengths and gaps, and names what the path is built around', () => {
    const map = buildKnowledgeMap([
      a('A', 'x', true),
      a('B', 'y', true),
      a('C', 'z', false),
      a('D', 'w', false),
    ]);
    const line = buildReasonLine(map);
    expect(line.strong).toBe(2);
    expect(line.work).toBe(2);
    expect(line.focus).toHaveLength(2);
  });

  it('returns null when there is nothing worth summarising', () => {
    expect(buildReasonLine(buildKnowledgeMap([]))).toBeNull();
    expect(buildReasonLine(buildKnowledgeMap([a('Only', 'x', true)]))).toBeNull();
  });
});
