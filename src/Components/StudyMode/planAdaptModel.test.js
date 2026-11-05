import { adaptPlan, CHANGE, MAX_SKIPS, RETURN_QUESTIONS, MIXUP_PAGES } from './planAdaptModel';

jest.mock('../../Services/StudySessionService', () => ({ BREAKDOWN_MIN_SAMPLE: 5, findMatchingTopicKey: (k) => k }));

const t = (key, options) => String(options.defaultValue).replace('{{topic}}', options.topic);
const NOW = '2026-11-10T12:00:00.000Z';
const daysAgo = (n) => new Date(Date.parse(NOW) - n * 24 * 60 * 60 * 1000).toISOString();

const step = (id, type, topic, extra = {}) => ({ id, type, topic, label: topic, status: 'locked', ...extra });

// Pituitary review+quiz done, then three planned topics.
const plan = () => [
  step('l1', 'lesson', 'Pituitary', { status: 'done' }),
  step('q1', 'quiz', 'Pituitary', { status: 'active' }),
  step('l2', 'lesson', 'Thyroid'),
  step('q2', 'quiz', 'Thyroid'),
  step('l3', 'lesson', 'Adrenal'),
  step('q3', 'quiz', 'Adrenal'),
  step('l4', 'lesson', 'Diabetes'),
  step('q4', 'quiz', 'Diabetes'),
];

const miss = { index: 2, concept: 'DI vs SIADH', format: 'mcq', chosen: 'Restrict fluids' };
const run = (overrides = {}) => adaptPlan({ nodes: plan(), finishedNodeId: 'q1', now: NOW, t, ...overrides });
const ids = (result) => result.nodes.map((n) => n.id);
const kinds = (result) => result.changes.map((c) => c.kind);

describe('adaptPlan: when it does nothing', () => {
  it('proposes nothing without evidence', () => {
    expect(run()).toBeNull();
  });

  it('only acts after a quiz', () => {
    expect(run({ finishedNodeId: 'l1', misses: [miss] })).toBeNull();
  });

  it("leaves Tonight's plan alone", () => {
    expect(run({ misses: [miss], archetype: 'sprint' })).toBeNull();
    const nodes = plan().concat(step('r1', 'exam', 'Pituitary', { tags: ['tonight:fix'] }));
    expect(run({ nodes, misses: [miss] })).toBeNull();
  });
});

describe('mixup', () => {
  it('adds a mix-up lesson right after the quiz, pointing back at it', () => {
    const result = run({ misses: [miss] });
    expect(ids(result).slice(0, 3)).toEqual(['l1', 'q1', 'adaptive-mixup-q1']);
    expect(result.nodes[2]).toMatchObject({
      type: 'lesson', topic: 'Pituitary', adaptive: true, status: 'locked',
      label: 'The mix-up from this quiz: Pituitary',
      reviewReason: { source: 'node_result', fromNodeId: 'q1' },
    });
    expect(result.changes).toEqual([{ kind: CHANGE.MIXUP, nodeId: 'adaptive-mixup-q1', topic: 'Pituitary',
      reason: { chosen: 'Restrict fluids', concept: 'DI vs SIADH' } }]);
  });

  it('needs her actual choice', () => {
    expect(run({ misses: [{ ...miss, chosen: null }] })).toBeNull();
    expect(run({ misses: [{ ...miss, chosen: [] }] })).toBeNull();
  });

  it('respects the one-detour-per-topic cap shared with the readout', () => {
    const nodes = plan();
    nodes.splice(2, 0, step('adaptive-x', 'exam', 'Pituitary', { adaptive: true }));
    expect(run({ nodes, misses: [miss] })).toBeNull();
  });

  it('never adds a fix after a step that was itself added', () => {
    const nodes = plan().map((n) => (n.id === 'q1' ? { ...n, adaptive: true } : n));
    expect(run({ nodes, misses: [miss] })).toBeNull();
  });

  it(`matches the backend's ${MIXUP_PAGES}-page mix-up lesson`, () => {
    expect(MIXUP_PAGES).toBe(3);
  });
});

describe('format', () => {
  const formats = { mcq: { correct: 9, total: 10 }, sata: { correct: 1, total: 6 } };
  const sataMiss = { ...miss, format: 'sata', chosen: ['Low sodium'] };

  it('turns the next planned quiz into her weakest format', () => {
    const result = run({ formats, misses: [sataMiss], nodes: plan().map((n) => (n.id === 'q1' ? { ...n, adaptive: true } : n)) });
    const switched = result.nodes.find((n) => n.id === 'q2');
    expect(switched).toMatchObject({ type: 'exam', topic: 'Thyroid', adaptedFrom: { type: 'quiz', format: 'sata' },
      examConfig: { questionTypes: ['sata'], questionCount: 5, timerEnabled: false } });
    expect(result.changes).toEqual([{ kind: CHANGE.FORMAT, nodeId: 'q2', topic: 'Thyroid',
      reason: { format: 'sata', correct: 1, total: 6, bestFormat: 'mcq', bestCorrect: 9, bestTotal: 10 } }]);
  });

  it('needs this quiz to show the same weakness', () => {
    expect(run({ formats, misses: [{ ...miss, chosen: null }] })).toBeNull();
  });

  it('needs enough answers in both formats and a real gap', () => {
    expect(run({ formats: { mcq: { correct: 9, total: 10 }, sata: { correct: 1, total: 3 } }, misses: [{ ...sataMiss, chosen: null }] })).toBeNull();
    expect(run({ formats: { mcq: { correct: 8, total: 10 }, sata: { correct: 4, total: 6 } }, misses: [{ ...sataMiss, chosen: null }] })).toBeNull();
  });

  it('never "switches" to multiple choice, the default', () => {
    expect(run({ formats: { sata: { correct: 9, total: 10 }, mcq: { correct: 1, total: 6 } }, misses: [{ ...miss, chosen: null }] })).toBeNull();
  });

  it('does not switch again while a switched step is still ahead', () => {
    const nodes = plan().map((n) => (n.id === 'q3' ? { ...n, type: 'exam', examConfig: { questionTypes: ['sata'] } } : n));
    expect(run({ nodes, formats, misses: [{ ...sataMiss, chosen: null }] })).toBeNull();
  });
});

describe('skip', () => {
  const checkAllRight = { baseline: { thyroid: { correct: 3, answered: 3 } }, latest: {} };

  it('cuts the review of a topic she aced in the readiness check, keeping its quiz', () => {
    const result = run({ topicProgress: checkAllRight });
    expect(result.nodes.find((n) => n.id === 'l2')).toMatchObject({ status: 'skipped',
      skippedReason: { source: 'check', correct: 3, total: 3 } });
    expect(result.nodes.find((n) => n.id === 'q2').status).toBe('locked');
    expect(ids(result)).toEqual(plan().map((n) => n.id));
  });

  it('does not cut on a short or imperfect check, or one she has since missed', () => {
    expect(run({ topicProgress: { baseline: { thyroid: { correct: 2, answered: 2 } } } })).toBeNull();
    expect(run({ topicProgress: { baseline: { thyroid: { correct: 3, answered: 4 } } } })).toBeNull();
    expect(run({ topicProgress: { baseline: { thyroid: { correct: 3, answered: 3 } },
      latest: { thyroid: { correct: 1, answered: 2 } } } })).toBeNull();
  });

  it('cuts on strong practice too', () => {
    const result = run({ topicProgress: { baseline: {}, latest: { thyroid: { correct: 5, answered: 5 } } } });
    expect(result.changes[0]).toMatchObject({ kind: CHANGE.SKIP, reason: { source: 'practice', correct: 5, total: 5 } });
  });

  it('never cuts a review whose quiz is not still ahead', () => {
    const nodes = plan().filter((n) => n.id !== 'q2');
    expect(run({ nodes, topicProgress: checkAllRight })).toBeNull();
  });

  it(`cuts at most ${MAX_SKIPS}`, () => {
    const all = { correct: 3, answered: 3 };
    const result = run({ topicProgress: { baseline: { thyroid: all, adrenal: all, diabetes: all } } });
    expect(result.changes.filter((c) => c.kind === CHANGE.SKIP)).toHaveLength(MAX_SKIPS);
  });
});

describe('return', () => {
  const history = [
    { topic: 'Cardiac', at: daysAgo(5), correct: 3, total: 5, pct: 60 },
    { topic: 'Renal', at: daysAgo(4), correct: 5, total: 5, pct: 100 },
  ];

  it('brings back an earlier topic that still needs work, after 3 days', () => {
    const result = run({ history });
    const back = result.nodes[result.nodes.length - 1];
    expect(back).toMatchObject({ type: 'quiz', topic: 'Cardiac', num_questions: RETURN_QUESTIONS,
      tags: ['return_check'], label: 'Quick check: Cardiac', adaptive: true });
    expect(result.changes).toEqual([{ kind: CHANGE.RETURN, nodeId: back.id, topic: 'Cardiac',
      reason: { lastAt: history[0].at, correct: 3, total: 5 } }]);
  });

  it('not before 3 days, not for topics she nailed, not if it is already planned', () => {
    expect(run({ history: [{ ...history[0], at: daysAgo(2) }] })).toBeNull();
    expect(run({ history: [history[1]] })).toBeNull();
    expect(run({ history: [{ ...history[0], topic: 'Adrenal' }] })).toBeNull();
  });

  it('uses the latest result for a topic', () => {
    expect(run({ history: [history[0], { ...history[0], at: daysAgo(4), correct: 5, pct: 100 }] })).toBeNull();
  });

  it('does not bring the same topic back twice', () => {
    const nodes = plan().concat(step('adaptive-return-cardiac', 'quiz', 'Cardiac', { tags: ['return_check'], adaptive: true }));
    expect(run({ nodes, history })).toBeNull();
  });
});

describe('budget', () => {
  const history = [{ topic: 'Cardiac', at: daysAgo(5), correct: 3, total: 5, pct: 60 }];

  it('grows the plan by at most one step: the fix wins over the return', () => {
    const result = run({ misses: [miss], history });
    expect(kinds(result)).toEqual([CHANGE.MIXUP]);
  });

  it('a cut review pays for both', () => {
    const result = run({ misses: [miss], history, topicProgress: { baseline: { thyroid: { correct: 3, answered: 3 } } } });
    expect(kinds(result)).toEqual(expect.arrayContaining([CHANGE.MIXUP, CHANGE.SKIP, CHANGE.RETURN]));
  });
});

describe('moved', () => {
  const scores = { baseline: { thyroid: { correct: 3, answered: 3 }, diabetes: { correct: 0, answered: 3 } }, latest: {} };

  it('moves the weakest tested topic up, keeping each review with its quiz', () => {
    const progress = { baseline: { thyroid: { correct: 3, answered: 4 }, adrenal: { correct: 2, answered: 3 },
      diabetes: { correct: 0, answered: 3 } } };
    const result = run({ topicProgress: progress });
    expect(ids(result)).toEqual(['l1', 'q1', 'l4', 'q4', 'l3', 'q3', 'l2', 'q2']);
    expect(result.changes).toEqual([
      { kind: CHANGE.MOVED, nodeId: 'l4', topic: 'Diabetes', inReserve: false, reason: { direction: 'up', correct: 0, total: 3 } },
      { kind: CHANGE.MOVED, nodeId: 'l2', topic: 'Thyroid', inReserve: false, reason: { direction: 'down', correct: 3, total: 4 } },
    ]);
  });

  it('leaves untested topics in their planned place', () => {
    const progress = { baseline: { thyroid: { correct: 3, answered: 4 }, diabetes: { correct: 0, answered: 3 } } };
    const result = run({ topicProgress: progress });
    // Thyroid (mostly right) and Diabetes (missed) swap; Adrenal (untested) stays in the middle.
    expect(ids(result)).toEqual(['l1', 'q1', 'l4', 'q4', 'l3', 'q3', 'l2', 'q2']);
  });

  it('a cut review moves with its topic', () => {
    const result = run({ topicProgress: scores });
    expect(ids(result)).toEqual(['l1', 'q1', 'l4', 'q4', 'l3', 'q3', 'l2', 'q2']);
    expect(result.nodes[6]).toMatchObject({ id: 'l2', status: 'skipped' });
  });

  it('never crosses a section header', () => {
    const nodes = plan();
    nodes.splice(6, 0, { id: 'b1', type: 'section_banner', label: 'Week 2' });
    const result = run({ nodes, topicProgress: scores });
    expect(ids(result).slice(6)).toEqual(['b1', 'l4', 'q4']);
  });

  it('re-ranks the reserve the same way', () => {
    const reserve = [step('l5', 'lesson', 'Renal'), step('q5', 'quiz', 'Renal'), step('l6', 'lesson', 'Cardiac'), step('q6', 'quiz', 'Cardiac'),
      step('l7', 'lesson', 'Neuro'), step('q7', 'quiz', 'Neuro')];
    const progress = { baseline: { renal: { correct: 3, answered: 3 }, neuro: { correct: 0, answered: 3 } } };
    const result = run({ reserve, topicProgress: progress });
    expect(result.reserve.map((n) => n.id)).toEqual(['l7', 'q7', 'l6', 'q6', 'l5', 'q5']);
    expect(result.changes.every((c) => c.inReserve)).toBe(true);
  });

  it('does not explain a one-place nudge, and proposes nothing for it alone', () => {
    const progress = { baseline: { thyroid: { correct: 2, answered: 3 }, adrenal: { correct: 0, answered: 3 } } };
    expect(run({ nodes: plan().slice(0, 6), topicProgress: progress })).toBeNull();
  });
});

describe('what it never touches', () => {
  it('keeps finished steps and the finished quiz exactly as they were', () => {
    const nodes = plan();
    const result = run({ nodes, misses: [miss], topicProgress: { baseline: { thyroid: { correct: 3, answered: 3 } } } });
    expect(result.nodes[0]).toBe(nodes[0]);
    expect(result.nodes[1]).toBe(nodes[1]);
  });

  it('keeps a step already done further down the plan in its place', () => {
    const nodes = plan().map((n) => (n.id === 'l3' ? { ...n, status: 'done' } : n));
    const progress = { baseline: { thyroid: { correct: 3, answered: 4 }, diabetes: { correct: 0, answered: 3 } } };
    const result = run({ nodes, topicProgress: progress });
    expect(result.nodes[4].id).toBe('l3');
  });
});
