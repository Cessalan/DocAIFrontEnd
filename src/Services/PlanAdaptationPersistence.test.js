import { adaptPathAfterNode, declineAdaptation, completeNodeAndAdvance, restoreSkippedStep } from './StudySessionService';
import { updateDoc, getDoc } from 'firebase/firestore';

jest.mock('../Firebase/config', () => ({ db: {}, auth: { currentUser: { uid: 'student' } }, storage: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(() => 'target'), getDoc: jest.fn(), runTransaction: jest.fn(), updateDoc: jest.fn(), serverTimestamp: jest.fn(() => 'now') }));
jest.mock('./ClarityService', () => ({ clarityEvent: jest.fn(), clarityTag: jest.fn() }));

const saved = () => [
  { id: 'q1', type: 'quiz', status: 'active' },
  { id: 'l2', type: 'lesson', status: 'locked' },
  { id: 'q2', type: 'quiz', status: 'locked' },
];
const reserve = [{ id: 'l3', type: 'lesson', status: 'locked' }];
const stored = (nodes = saved(), held = reserve) => getDoc.mockResolvedValue({ exists: () => true,
  data: () => ({ study: { path: { nodes }, reserve: { nodes: held, remaining: held.length } } }) });

const proposal = {
  nodes: [
    { id: 'q1', type: 'quiz', status: 'active' },
    { id: 'adaptive-mixup-q1', type: 'lesson', status: 'locked', reviewReason: { source: 'node_result', fromNodeId: 'q1' } },
    { id: 'l2', type: 'lesson', status: 'skipped', skippedReason: { source: 'check', correct: 3, total: 3 } },
    { id: 'q2', type: 'quiz', status: 'locked' },
  ],
  reserve,
  changes: [{ kind: 'mixup', nodeId: 'adaptive-mixup-q1', reason: { chosen: 'Restrict fluids', concept: undefined } }],
};

beforeEach(() => jest.clearAllMocks());

test('writes the proposed path, closes the quiz and opens the new step in one write', async () => {
  stored();
  const result = await adaptPathAfterNode('chat', 'q1', proposal);
  expect(result.nextNodeId).toBe('adaptive-mixup-q1');
  expect(result.nodes[0]).toMatchObject({ id: 'q1', status: 'done', completedAt: expect.any(String) });
  expect(result.nodes[1].status).toBe('active');
  expect(updateDoc).toHaveBeenCalledTimes(1);
  const write = updateDoc.mock.calls[0][1];
  expect(write['study.path.activeNodeId']).toBe('adaptive-mixup-q1');
  // Skipped reviews are not counted as steps.
  expect(write['study.path.totalNodes']).toBe(3);
  expect(write['study.reserve.remaining']).toBe(1);
  expect(write['study.lastAdaptation']).toMatchObject({ fromNodeId: 'q1', accepted: true,
    changes: [{ kind: 'mixup', nodeId: 'adaptive-mixup-q1', reason: { chosen: 'Restrict fluids' } }] });
  // Firestore rejects undefined; the record is stripped of it.
  expect('concept' in write['study.lastAdaptation'].changes[0].reason).toBe(false);
});

test('opens the first step that is not cut', async () => {
  stored();
  const noMixup = { ...proposal, nodes: proposal.nodes.filter(n => n.id !== 'adaptive-mixup-q1') };
  const result = await adaptPathAfterNode('chat', 'q1', noMixup);
  expect(result.nextNodeId).toBe('q2');
});

test('refuses a proposal built on a plan that has since changed', async () => {
  stored([...saved(), { id: 'extra', type: 'quiz', status: 'locked' }]);
  await expect(adaptPathAfterNode('chat', 'q1', proposal)).rejects.toThrow('stale_adaptation');
  stored(saved(), []);
  await expect(adaptPathAfterNode('chat', 'q1', proposal)).rejects.toThrow('stale_adaptation');
  stored(saved().map(n => (n.id === 'q1' ? { ...n, status: 'done' } : n)));
  await expect(adaptPathAfterNode('chat', 'q1', proposal)).rejects.toThrow('stale_adaptation');
  expect(updateDoc).not.toHaveBeenCalled();
});

test('a kept plan is recorded so it is not proposed again', async () => {
  await declineAdaptation('chat', 'q1', proposal.changes);
  expect(updateDoc.mock.calls[0][1]['study.lastAdaptation']).toMatchObject({ fromNodeId: 'q1', accepted: false });
});

test('ordinary advancing steps over a cut review', async () => {
  stored([{ id: 'q1', type: 'quiz', status: 'active' }, { id: 'l2', type: 'lesson', status: 'skipped' }, { id: 'q2', type: 'quiz', status: 'locked' }]);
  const result = await completeNodeAndAdvance('chat', 'q1');
  expect(result.nextNodeId).toBe('q2');
});

describe('Do it anyway', () => {
  test('a cut review ahead of her goes back in the plan where it was', async () => {
    stored([{ id: 'q1', type: 'quiz', status: 'active' }, { id: 'l2', type: 'lesson', status: 'skipped', skippedReason: { source: 'check' } }, { id: 'q2', type: 'quiz', status: 'locked' }]);
    const { nodes, activeNodeId } = await restoreSkippedStep('chat', 'l2');
    expect(nodes.map(n => n.id)).toEqual(['q1', 'l2', 'q2']);
    expect(nodes[1]).toMatchObject({ status: 'locked', restoredFrom: 'skipped' });
    expect('skippedReason' in nodes[1]).toBe(false);
    expect(activeNodeId).toBeNull();
    expect(updateDoc.mock.calls[0][1]['study.path.totalNodes']).toBe(3);
  });

  test('a cut review behind her becomes her next step, or it would never be reached', async () => {
    stored([{ id: 'l1', type: 'lesson', status: 'skipped' }, { id: 'q1', type: 'quiz', status: 'done' }, { id: 'q2', type: 'quiz', status: 'active' }, { id: 'q3', type: 'quiz', status: 'locked' }]);
    const { nodes } = await restoreSkippedStep('chat', 'l1');
    expect(nodes.map(n => n.id)).toEqual(['q1', 'q2', 'l1', 'q3']);
  });

  test('on a finished plan it opens straight away', async () => {
    stored([{ id: 'q1', type: 'quiz', status: 'done' }, { id: 'l2', type: 'lesson', status: 'skipped' }]);
    const { activeNodeId } = await restoreSkippedStep('chat', 'l2');
    expect(activeNodeId).toBe('l2');
    expect(updateDoc.mock.calls[0][1]).toMatchObject({ 'study.path.activeNodeId': 'l2', 'study.status': 'active' });
  });

  test('only a cut step can be restored', async () => {
    stored();
    await expect(restoreSkippedStep('chat', 'l2')).rejects.toThrow('not skipped');
  });
});

test('each changed step keeps its reason, and an old reason is cleared', async () => {
  stored(saved().map(n => (n.id === 'q2' ? { ...n, adaptChange: { kind: 'moved', reason: { direction: 'up' } } } : n)));
  const result = await adaptPathAfterNode('chat', 'q1', proposal);
  expect(result.nodes.find(n => n.id === 'adaptive-mixup-q1').adaptChange).toMatchObject({ kind: 'mixup', reason: { chosen: 'Restrict fluids' } });
  expect('adaptChange' in result.nodes.find(n => n.id === 'q2')).toBe(false);
});
