import { adaptedKind, adaptedStepProps, firstAttemptScore, mixupFollowUp, proposalProps } from './planAdaptTelemetry';

const quiz = { id: 'q1', type: 'quiz', topic: 'ABCDE', status: 'done' };
const mixup = { id: 'adaptive-mixup-q1', type: 'lesson', topic: 'ABCDE', status: 'done',
  reviewReason: { source: 'node_result', fromNodeId: 'q1' } };
const audio = { id: 'a1', type: 'audio', topic: 'ABCDE', status: 'done' };
const check = { id: 'q2', type: 'quiz', topic: 'ABCDE', status: 'active' };

describe('firstAttemptScore', () => {
  it('scores first attempts and ignores anything unanswered', () => {
    expect(firstAttemptScore({ 0: 'correct', 1: 'incorrect', 2: 'incorrect', 3: 'pending' }))
      .toEqual({ correct: 1, total: 3, pct: 33 });
    expect(firstAttemptScore({})).toEqual({ correct: null, total: null, pct: null });
  });
});

describe('proposalProps', () => {
  it('counts kinds and keeps the source score, never her chosen text', () => {
    const proposal = { changes: [
      { kind: 'mixup', reason: { chosen: 'Apply pelvic immobilization device' } },
      { kind: 'skip' }, { kind: 'skip' }, { kind: 'moved', inReserve: true }] };
    const props = proposalProps({ chatId: 'c', fromNodeId: 'q1', proposal, score: { correct: 2, total: 5, pct: 40 } });
    expect(props).toEqual({ chatId: 'c', fromNodeId: 'q1', changeCount: 4,
      kinds: { mixup: 1, skip: 2, moved: 1 }, kindList: 'mixup,moved,skip', reserveChanges: 1,
      fromCorrect: 2, fromTotal: 5, fromPct: 40 });
    expect(JSON.stringify(props)).not.toContain('pelvic');
  });
});

describe('adaptedKind', () => {
  it('reads the durable markers before the stamp a later change clears', () => {
    expect(adaptedKind(mixup)).toBe('mixup');
    expect(adaptedKind({ id: 'adaptive-return-abcde' })).toBe('return');
    expect(adaptedKind({ id: 'n5', adaptedFrom: { type: 'quiz' } })).toBe('format');
    expect(adaptedKind({ id: 'n6', skippedReason: { source: 'check' } })).toBe('skip');
    expect(adaptedKind({ id: 'n7', adaptChange: { kind: 'moved' } })).toBe('moved');
    expect(adaptedKind(quiz)).toBeNull();
  });
});

describe('adaptedStepProps', () => {
  it('names the step and the quiz it came from', () => {
    expect(adaptedStepProps({ chatId: 'c', node: mixup }))
      .toEqual({ chatId: 'c', nodeId: 'adaptive-mixup-q1', adaptKind: 'mixup', nodeType: 'lesson', fromNodeId: 'q1' });
    expect(adaptedStepProps({ chatId: 'c', node: quiz })).toBeNull();
  });
});

describe('mixupFollowUp', () => {
  it('finds the first scored step after a mix-up on the same topic', () => {
    expect(mixupFollowUp([quiz, mixup, audio, check], 'q2'))
      .toEqual({ mixupNodeId: 'adaptive-mixup-q1', fromNodeId: 'q1', followUpNodeId: 'q2', followUpType: 'quiz' });
  });

  it('only counts the first follow-up', () => {
    const later = { id: 'q3', type: 'quiz', topic: 'ABCDE' };
    expect(mixupFollowUp([quiz, mixup, { ...check, status: 'done' }, later], 'q3')).toBeNull();
  });

  it('ignores another topic, unscored steps, and steps with no mix-up before them', () => {
    expect(mixupFollowUp([quiz, mixup, { ...check, topic: 'Cardiac' }], 'q2')).toBeNull();
    expect(mixupFollowUp([quiz, mixup, audio], 'a1')).toBeNull();
    expect(mixupFollowUp([quiz, check], 'q2')).toBeNull();
  });
});
