import { resolveNodeTopic, testedSkills } from './nodeTopic';

/* Shapes taken from the two real plans that produced the loop (2026-09-13 and
   2026-09-22): plan nodes keep the subject in tags[0], inserted nodes carry
   decorated labels and either a `source:` tag or nothing but their position. */
const plan = [
  { id: 'banner_1', type: 'section_banner', label: 'Week 1' },
  { id: 'node_3', type: 'quiz', label: 'Perineal Care - Quiz', tags: ['Perineal Care'] },
  {
    id: 'adaptive-aaaa1111', type: 'quiz', adaptive: true,
    label: 'Testing a theory: select-all-that-apply',
    tags: ['experiment:select-all-that-apply', 'weak_area'],
  },
  {
    id: 'adaptive-bbbb2222', type: 'exam', adaptive: true,
    label: 'Harder: Testing a theory: select-all-that-apply',
    tags: ['adaptive', 'source:adaptive-aaaa1111', 'challenge'],
  },
  {
    id: 'adaptive-cccc3333', type: 'exam', adaptive: true,
    label: 'Harder: Harder: Testing a theory: select-all-that-apply',
    tags: ['adaptive', 'source:adaptive-bbbb2222', 'challenge'],
  },
];

describe('resolveNodeTopic', () => {
  it('prefers an explicit topic', () => {
    expect(resolveNodeTopic({ id: 'adaptive-x', adaptive: true, topic: 'Hand hygiene', label: 'Harder: whatever' }, plan))
      .toBe('Hand hygiene');
  });

  it('reads a plan node from tags[0], not its suffixed label', () => {
    expect(resolveNodeTopic(plan[1], plan)).toBe('Perineal Care');
  });

  it('ignores a tag that is the node type rather than its subject', () => {
    // Synthesized planner nodes are tagged ["quiz"] / ["lesson"]; a real plan
    // replayed through the first version resolved to the topic "quiz".
    expect(resolveNodeTopic({ id: 'synth_quiz_950', type: 'quiz', label: 'Feeding guidelines in infancy', tags: ['quiz'] }, plan))
      .toBe('Feeding guidelines in infancy');
    expect(resolveNodeTopic({ id: 'exam_1', type: 'exam', label: 'Skin breakdown in infants', tags: ['exam', 'mixed_types'] }, plan))
      .toBe('Skin breakdown in infants');
  });

  it('strips the label suffix when a plan node has no usable tag', () => {
    expect(resolveNodeTopic({ id: 'node_9', type: 'quiz', label: 'Fluid Balance - Quiz', tags: [] }, plan))
      .toBe('Fluid Balance');
  });

  it('walks an untagged experiment back to the node it was inserted after', () => {
    expect(resolveNodeTopic(plan[2], plan)).toBe('Perineal Care');
  });

  it('follows source: chains through stacked labels', () => {
    expect(resolveNodeTopic(plan[4], plan)).toBe('Perineal Care');
  });

  it('returns empty rather than a decorated label when nothing resolves', () => {
    const orphan = { id: 'adaptive-z', adaptive: true, label: 'Testing a theory: prioritization', tags: ['experiment:prioritization'] };
    expect(resolveNodeTopic(orphan, [orphan])).toBe('');
  });

  it('survives a source cycle and a missing node', () => {
    const a = { id: 'adaptive-a', adaptive: true, label: 'A', tags: ['source:adaptive-b'] };
    const b = { id: 'adaptive-b', adaptive: true, label: 'B', tags: ['source:adaptive-a'] };
    expect(resolveNodeTopic(a, [a, b])).toBe('');
    expect(resolveNodeTopic(null, plan)).toBe('');
  });
});

describe('testedSkills', () => {
  it('collects every skill that already has an experiment, done or not', () => {
    expect(testedSkills(plan)).toEqual(['select-all-that-apply']);
  });

  it('is empty for a plan with no experiments', () => {
    expect(testedSkills([plan[1]])).toEqual([]);
    expect(testedSkills(undefined)).toEqual([]);
  });
});
