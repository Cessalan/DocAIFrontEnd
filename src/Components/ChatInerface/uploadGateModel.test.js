import {
  hasFinishedStep,
  rememberStepFinished,
  resetUploadGateSession,
  uploadGateDecision,
} from './uploadGateModel';

beforeEach(() => resetUploadGateSession());

describe('uploadGateDecision', () => {
  it('lets a free student add files before she has finished a step', () => {
    expect(uploadGateDecision({ isPro: false, filesInChat: 1, finishedStep: false })).toBe('defer');
  });

  it('gates the second upload once she has finished a step', () => {
    expect(uploadGateDecision({ isPro: false, filesInChat: 1, finishedStep: true })).toBe('gate');
  });

  it('never gates the first upload in a chat', () => {
    expect(uploadGateDecision({ isPro: false, filesInChat: 0, finishedStep: true })).toBe('allow');
  });

  it('never gates Pro', () => {
    expect(uploadGateDecision({ isPro: true, filesInChat: 3, finishedStep: true })).toBe('allow');
  });
});

describe('hasFinishedStep', () => {
  it('is false for a new student', () => {
    expect(hasFinishedStep({ uid: 'u1', profile: {}, chatNodes: [{ status: 'active' }] })).toBe(false);
  });

  it('reads the stamp on her account', () => {
    expect(hasFinishedStep({ uid: 'u1', profile: { activation: { lastStepAt: 'ts' } } })).toBe(true);
  });

  it('reads a finished step in the open chat, for students who finished one before the stamp existed', () => {
    expect(hasFinishedStep({ uid: 'u1', chatNodes: [{ status: 'done' }, { status: 'locked' }] })).toBe(true);
  });

  it('a skipped review is not a finished step', () => {
    expect(hasFinishedStep({ uid: 'u1', chatNodes: [{ status: 'skipped' }] })).toBe(false);
  });

  it('remembers a step finished in this tab, which the sign-in profile cannot see', () => {
    rememberStepFinished('u1');
    expect(hasFinishedStep({ uid: 'u1', profile: {} })).toBe(true);
    expect(hasFinishedStep({ uid: 'u2', profile: {} })).toBe(false);
  });

  it('tolerates missing inputs', () => {
    expect(hasFinishedStep()).toBe(false);
    expect(hasFinishedStep({ chatNodes: [null] })).toBe(false);
  });
});
