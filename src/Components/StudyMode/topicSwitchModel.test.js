import { planTopicSwitch, sectionSwitchTargets, switchOptions } from './topicSwitchModel';
import { topicKey } from './topicJourneyModel';

const step = (id, topic, status = 'locked', extra = {}) =>
  ({ id, type: 'quiz', label: `${topic} - Quiz`, tags: [topic], topic, status, ...extra });
const ids = (list) => list.map((n) => n.id);
const statuses = (list) => Object.fromEntries(list.map((n) => [n.id, n.status]));

/* The plan that lost a Pro student (2026-11-16): every live step on one
   topic, the other topics held in reserve. */
const live = [
  step('d1', 'Dermatitis', 'done'),
  step('d2', 'Dermatitis', 'done'),
  step('d3', 'Dermatitis', 'active'),
  step('d4', 'Dermatitis'),
];
const reserve = [
  step('n1', 'Nervous system'),
  step('n2', 'Nervous system'),
  step('c1', 'Cardiovascular medications'),
];

describe('switchOptions', () => {
  test('lists every other topic with a step left, in plan order', () => {
    const options = switchOptions({ nodes: live, reserve, activeNodeId: 'd3' });
    expect(options.map((o) => o.topic)).toEqual(['Nervous system', 'Cardiovascular medications']);
    expect(options[0]).toMatchObject({ key: 'nervous system', stepsLeft: 2, stepsDone: 0 });
    // The steps themselves, so every screen can draw the topic the same way.
    expect(options[0].steps.map((n) => n.id)).toEqual(['n1', 'n2']);
  });

  test('between steps, the topic she just worked on is offered again only if it has steps left', () => {
    const lastOne = live.slice(0, 3);
    expect(switchOptions({ nodes: lastOne, reserve, activeNodeId: 'd3', finishedNodeId: 'd3' }).map((o) => o.key))
      .toEqual(['nervous system', 'cardiovascular medications']);
    expect(switchOptions({ nodes: live, reserve, activeNodeId: 'd3', finishedNodeId: 'd3' }).map((o) => o.key))
      .toEqual(['dermatitis', 'nervous system', 'cardiovascular medications']);
  });

  test('a finished topic and a skipped step are not offered', () => {
    const nodes = [step('a1', 'Acne', 'done'), step('r1', 'Rosacea', 'skipped'), step('p1', 'Pain', 'active')];
    expect(switchOptions({ nodes, activeNodeId: 'p1' })).toEqual([]);
  });

  test("Tonight's plan has rounds, not topics", () => {
    const nodes = [step('t1', 'Client education', 'active', { tags: ['tonight', 'tonight:round:1'] }), step('e1', 'Evidence')];
    expect(switchOptions({ nodes, activeNodeId: 't1' })).toEqual([]);
    expect(planTopicSwitch({ nodes, activeNodeId: 't1', targetKey: 'evidence' })).toBeNull();
  });
});

describe('sectionSwitchTargets', () => {
  const nodes = [step('a1', 'Acne', 'done'), step('a2', 'Acne', 'active'), step('r1', 'Rosacea'), step('r2', 'Rosacea'),
    step('a3', 'Acne'), step('p1', 'Pain')];
  const held = [step('n1', 'Nervous system')];
  const sections = [
    { id: 's0', status: 'active', steps: [nodes[0], nodes[1]] },
    { id: 's1', status: 'locked', steps: [nodes[2], nodes[3]] },
    { id: 's2', status: 'locked', steps: [nodes[4]] },
    { id: 's3', status: 'locked', steps: [nodes[5]] },
  ];
  const options = switchOptions({ nodes, reserve: held, activeNodeId: 'a2' });

  test('each topic on the plan carries its switch on its own section, and held-back topics come after', () => {
    const targets = sectionSwitchTargets(sections, options, nodes.concat(held));
    expect(Object.keys(targets.bySection)).toEqual(['s1', 's3']);
    expect(targets.bySection.s1.key).toBe('rosacea');
    expect(targets.later.map((o) => o.key)).toEqual(['nervous system']);
  });

  test('the rest of the topic she is on is not a switch target', () => {
    expect(sectionSwitchTargets(sections, options, nodes.concat(held)).bySection.s2).toBeUndefined();
  });

  test('no options, no targets', () => {
    expect(sectionSwitchTargets(sections, [], nodes)).toEqual({ bySection: {}, later: [] });
  });
});

describe('planTopicSwitch', () => {
  test('on an unfinished step: the picked topic comes out of reserve and goes before the step she left', () => {
    const plan = planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', targetKey: topicKey('Nervous system') });
    expect(ids(plan.nodes)).toEqual(['d1', 'd2', 'n1', 'n2', 'd3', 'd4']);
    expect(statuses(plan.nodes)).toEqual({ d1: 'done', d2: 'done', n1: 'active', n2: 'locked', d3: 'locked', d4: 'locked' });
    expect(ids(plan.reserve)).toEqual(['c1']);
    expect(plan).toMatchObject({ activeNodeId: 'n1', topic: 'Nervous system', movedCount: 2, fromReserveCount: 2, closedNodeId: null });
  });

  test('between steps: the finished step is closed and the picked topic comes next', () => {
    const plan = planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', finishedNodeId: 'd3',
      targetKey: 'cardiovascular medications', now: '2026-11-16T10:00:00.000Z' });
    expect(ids(plan.nodes)).toEqual(['d1', 'd2', 'd3', 'c1', 'd4']);
    expect(plan.nodes[2]).toMatchObject({ status: 'done', completedAt: '2026-11-16T10:00:00.000Z' });
    expect(plan.nodes[3].status).toBe('active');
    expect(plan.closedNodeId).toBe('d3');
    expect(ids(plan.reserve)).toEqual(['n1', 'n2']);
  });

  test('a topic already on the live plan is moved up, not duplicated', () => {
    const nodes = [step('a1', 'Acne', 'active'), step('a2', 'Acne'), step('r1', 'Rosacea'), step('p1', 'Pain'), step('r2', 'Rosacea')];
    const plan = planTopicSwitch({ nodes, activeNodeId: 'a1', targetKey: 'rosacea' });
    expect(ids(plan.nodes)).toEqual(['r1', 'r2', 'a1', 'a2', 'p1']);
    expect(plan.nodes).toHaveLength(nodes.length);
    expect(plan.fromReserveCount).toBe(0);
  });

  test('only the unfinished steps of a half-done topic move', () => {
    const nodes = [step('r1', 'Rosacea', 'done'), step('a1', 'Acne', 'active'), step('r2', 'Rosacea')];
    const plan = planTopicSwitch({ nodes, activeNodeId: 'a1', targetKey: 'rosacea' });
    expect(ids(plan.nodes)).toEqual(['r1', 'r2', 'a1']);
    expect(plan.nodes[0].status).toBe('done');
  });

  test('a finished plan: the picked topic is appended and becomes the active step', () => {
    const nodes = [step('d1', 'Dermatitis', 'done'), step('d2', 'Dermatitis', 'done')];
    const plan = planTopicSwitch({ nodes, reserve, activeNodeId: null, targetKey: 'nervous system' });
    expect(ids(plan.nodes)).toEqual(['d1', 'd2', 'n1', 'n2']);
    expect(plan.activeNodeId).toBe('n1');
  });

  test('a review phase does not hide the topics held in reserve', () => {
    const nodes = [step('d1', 'Dermatitis', 'done', { phase: 1 }),
      { id: 'section_banner_2', type: 'section_banner', label: 'Review', phase: 2, status: 'banner' },
      step('review_1', 'Dermatitis', 'active', { phase: 2 })];
    const plan = planTopicSwitch({ nodes, reserve, activeNodeId: 'review_1', targetKey: 'nervous system' });
    expect(ids(plan.nodes)).toEqual(['d1', 'section_banner_2', 'n1', 'n2', 'review_1']);
    expect(plan.nodes.filter((n) => n.status === 'active')).toHaveLength(1);
  });

  test('never more than one active step, and nothing is lost', () => {
    const plan = planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', targetKey: 'nervous system' });
    expect(plan.nodes.filter((n) => n.status === 'active')).toHaveLength(1);
    expect(ids(plan.nodes.concat(plan.reserve)).sort()).toEqual(ids(live.concat(reserve)).sort());
  });

  test('an extra step keeps its topic after the step before it moves away', () => {
    const drill = { id: 'adaptive-1', type: 'exam', label: 'Focused drill', adaptive: true, status: 'locked' };
    const nodes = [step('a1', 'Acne', 'active'), step('r1', 'Rosacea'), drill];
    const plan = planTopicSwitch({ nodes, activeNodeId: 'a1', targetKey: 'rosacea' });
    expect(ids(plan.nodes)).toEqual(['r1', 'adaptive-1', 'a1']);
    expect(plan.nodes[1].topic).toBe('Rosacea');
  });

  test('nothing to switch to: unknown topic, finished topic, or the topic she is already on', () => {
    expect(planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', targetKey: 'renal' })).toBeNull();
    expect(planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', targetKey: 'dermatitis' })).toBeNull();
    expect(planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', targetKey: '' })).toBeNull();
    const done = [step('a1', 'Acne', 'done'), step('p1', 'Pain', 'active')];
    expect(planTopicSwitch({ nodes: done, activeNodeId: 'p1', targetKey: 'acne' })).toBeNull();
  });

  test('one step can be picked instead of a whole topic: it comes next, the rest keeps its order', () => {
    const nodes = [step('a1', 'Acne', 'active', { type: 'lesson' }), step('a2', 'Acne'), step('a3', 'Acne', 'locked', { type: 'exam' }),
      step('r1', 'Rosacea')];
    const plan = planTopicSwitch({ nodes, reserve, activeNodeId: 'a1', targetNodeId: 'a3' });
    expect(ids(plan.nodes)).toEqual(['a3', 'a1', 'a2', 'r1']);
    expect(statuses(plan.nodes)).toEqual({ a3: 'active', a1: 'locked', a2: 'locked', r1: 'locked' });
    expect(plan.movedCount).toBe(1);
  });

  test('a single step can come out of reserve, and between steps the finished one is closed', () => {
    const plan = planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', finishedNodeId: 'd3', targetNodeId: 'n2' });
    expect(ids(plan.nodes)).toEqual(['d1', 'd2', 'd3', 'n2', 'd4']);
    expect(ids(plan.reserve)).toEqual(['n1', 'c1']);
    expect(plan.closedNodeId).toBe('d3');
  });

  test('picking the step she is on, a finished step or an unknown step changes nothing', () => {
    expect(planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', targetNodeId: 'd3' })).toBeNull();
    expect(planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', targetNodeId: 'd1' })).toBeNull();
    expect(planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', targetNodeId: 'nope' })).toBeNull();
  });

  test('the inputs are not mutated', () => {
    const before = JSON.stringify([live, reserve]);
    planTopicSwitch({ nodes: live, reserve, activeNodeId: 'd3', finishedNodeId: 'd3', targetKey: 'nervous system' });
    expect(JSON.stringify([live, reserve])).toBe(before);
  });
});
