import { STATUS, topicHandoff, topicJourney } from './topicJourneyModel';

// Shaped like real planner steps: the subject in tags[0] and at the start of the label.
const step = (id, topic, status = 'pending', extra = {}) => ({ id, type: 'quiz', label: `${topic} - Quick Check`,
  tags: [topic], status, ...extra });
const nodes = [
  { id: 'b1', type: 'section_banner', label: 'Week 1' },
  step('n1', 'Heart failure', 'done'),
  step('n2', 'Heart failure', 'done'),
  { id: 'd1', type: 'exam', topic: 'Heart failure', adaptive: true, status: 'done', tags: ['adaptive', 'source:n2'] },
  step('n3', 'Coronary artery disease', 'active'),
  step('n4', 'Coronary artery disease'),
];
const reserveNodes = [step('r1', 'Angina'), step('r2', 'Acute coronary syndrome'), step('r3', 'Coronary artery disease')];
const topicProgress = {
  baseline: { 'heart failure': { correct: 1, answered: 3 }, angina: { correct: 0, answered: 1 } },
  latest: { 'heart failure': { correct: 4, answered: 5 } },
};

describe('topicJourney', () => {
  const journey = topicJourney({ nodes, reserveNodes, topicProgress, activeNodeId: 'n3' });

  it('counts every topic of the whole plan, reserve included, and no extra steps', () => {
    expect(journey.topics.map((t) => t.topic)).toEqual(['Heart failure', 'Coronary artery disease', 'Angina', 'Acute coronary syndrome']);
    expect(journey.total).toBe(4);
  });

  it('marks done, current and upcoming', () => {
    expect(journey.topics.map((t) => t.status)).toEqual([STATUS.DONE, STATUS.CURRENT, STATUS.UPCOMING, STATUS.UPCOMING]);
    expect(journey.done).toBe(1);
    expect(journey.currentIndex).toBe(1);
  });

  it('a topic with steps still in reserve is not done', () => {
    const cad = topicJourney({ nodes: nodes.map((n) => (n.id === 'n3' || n.id === 'n4' ? { ...n, status: 'done' } : n)), reserveNodes });
    expect(cad.topics[1].status).not.toBe(STATUS.DONE);
  });

  it('claims earlier -> now only with enough answers on both sides', () => {
    expect(journey.topics[0]).toMatchObject({ before: { correct: 1, total: 3 }, after: { correct: 4, total: 5 }, comparable: true });
    expect(journey.topics[2]).toMatchObject({ before: { correct: 0, total: 1 }, after: null, comparable: false });
  });

  it('never borrows a score from another topic', () => {
    expect(journey.topics[3].before).toBeNull();
  });

  it('with no active step, the first unfinished topic is current', () => {
    const between = topicJourney({ nodes, reserveNodes });
    expect(between.topics[1].status).toBe(STATUS.CURRENT);
  });
});

describe('topicHandoff', () => {
  const all = nodes.concat(reserveNodes);

  it('speaks when the next step starts a new topic and the last one is finished', () => {
    const lastHf = nodes.map((n) => (n.id === 'n2' ? { ...n, status: 'active' } : n));
    const journey = topicJourney({ nodes: lastHf, reserveNodes, topicProgress, activeNodeId: 'n2', finishedNodeId: 'n2' });
    const handoff = topicHandoff(journey, 'Heart failure', nodes[4], all);
    expect(handoff).toMatchObject({ nextNumber: 2, total: 4 });
    expect(handoff.done.topic).toBe('Heart failure');
    expect(handoff.next.topic).toBe('Coronary artery disease');
  });

  it('is silent inside a topic', () => {
    const journey = topicJourney({ nodes, reserveNodes, activeNodeId: 'n3', finishedNodeId: 'n3' });
    expect(topicHandoff(journey, 'Coronary artery disease', nodes[5], all)).toBeNull();
  });

  it('is silent when the topic is not actually finished', () => {
    const journey = topicJourney({ nodes, reserveNodes, activeNodeId: 'n3' });
    expect(topicHandoff(journey, 'Coronary artery disease', reserveNodes[0], all)).toBeNull();
  });
});
