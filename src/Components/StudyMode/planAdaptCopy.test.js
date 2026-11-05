import i18n from '../../i18n/i18n';
import { changeReason, changeSummary, reasonsById, whenLabel, CHOICE_SHOWN_MAX } from './planAdaptCopy';

jest.mock('../../Services/StudySessionService', () => ({ BREAKDOWN_MIN_SAMPLE: 5, findMatchingTopicKey: (k) => k }));

const t = i18n.t.bind(i18n);
const NOW = new Date('2026-11-10T12:00:00Z');
const opts = { t, language: 'en', now: NOW };

beforeAll(() => i18n.changeLanguage('en'));

describe('changeReason', () => {
  it('quotes her choice for a mix-up', () => {
    expect(changeReason({ kind: 'mixup', reason: { chosen: 'Restrict fluids' } }, opts)).toBe('You chose “Restrict fluids”');
    expect(changeReason({ kind: 'mixup', reason: { chosen: ['Low sodium', 'Thirst'] } }, opts)).toBe('You chose “Low sodium, Thirst”');
  });

  it('shortens a very long choice', () => {
    const line = changeReason({ kind: 'mixup', reason: { chosen: 'x'.repeat(200) } }, opts);
    expect(line).toContain('…');
    expect(line.length).toBeLessThan(CHOICE_SHOWN_MAX + 20);
  });

  it('says nothing it cannot back with data', () => {
    expect(changeReason({ kind: 'mixup', reason: { chosen: null } }, opts)).toBeNull();
    expect(changeReason({ kind: 'skip', reason: {} }, opts)).toBeNull();
    expect(changeReason({ kind: 'return', reason: { lastAt: 'not a date', total: 5 } }, opts)).toBeNull();
    expect(changeReason({ kind: 'unknown' }, opts)).toBeNull();
  });

  it('names both formats with their scores', () => {
    expect(changeReason({ kind: 'format', reason: { format: 'sata', correct: 1, total: 6, bestFormat: 'mcq', bestCorrect: 9, bestTotal: 10 } }, opts))
      .toBe('Now select-all: 1 of 6 there, 9 of 10 on single answer');
  });

  it('says where a cut came from', () => {
    expect(changeReason({ kind: 'skip', reason: { source: 'check', correct: 3, total: 3 } }, opts)).toBe('Skipped: 3 of 3 in your readiness check');
    expect(changeReason({ kind: 'skip', reason: { source: 'practice', correct: 5, total: 5 } }, opts)).toBe('Skipped: 5 of 5 in practice');
  });

  it('dates a returning topic', () => {
    expect(changeReason({ kind: 'return', reason: { lastAt: '2026-11-06T12:00:00Z', correct: 3, total: 5 } }, opts))
      .toBe('Last practised Friday: 3 of 5');
  });

  it('gives the direction of a move', () => {
    expect(changeReason({ kind: 'moved', reason: { direction: 'up', correct: 0, total: 3 } }, opts)).toBe('Moved up: 0 of 3 so far');
    expect(changeReason({ kind: 'moved', reason: { direction: 'down', correct: 3, total: 4 } }, opts)).toBe('Moved later: 3 of 4 so far');
  });

  it('is translated', async () => {
    await i18n.changeLanguage('fr');
    expect(changeReason({ kind: 'skip', reason: { source: 'check', correct: 3, total: 3 } }, opts))
      .toBe('Retiré : 3 sur 3 à ton bilan de préparation');
    await i18n.changeLanguage('en');
  });
});

describe('whenLabel', () => {
  it('uses the weekday within a week and the date beyond', () => {
    expect(whenLabel('2026-11-06T12:00:00Z', { now: NOW })).toBe('Friday');
    expect(whenLabel('2026-10-20T12:00:00Z', { now: NOW })).toBe('Oct 20');
  });
});

describe('reasonsById', () => {
  it('maps each phrasable change to its step, first one wins', () => {
    expect(reasonsById([
      { kind: 'moved', nodeId: 'a', reason: { direction: 'up', correct: 0, total: 3 } },
      { kind: 'moved', nodeId: 'a', reason: { direction: 'down', correct: 3, total: 3 } },
      { kind: 'mixup', nodeId: 'b', reason: { chosen: null } },
    ], opts)).toEqual({ a: 'Moved up: 0 of 3 so far' });
  });
});

describe('changeSummary', () => {
  it('adds up what changed in one line', () => {
    expect(changeSummary([{ kind: 'mixup' }, { kind: 'return' }, { kind: 'skip' }], t)).toBe('2 steps added from your answers, 1 removed');
    expect(changeSummary([{ kind: 'mixup' }], t)).toBe('1 step added from your answers');
    expect(changeSummary([{ kind: 'skip' }, { kind: 'skip' }], t)).toBe('2 steps removed: you already know them');
    expect(changeSummary([{ kind: 'moved' }, { kind: 'format' }], t)).toBe('2 steps changed from your answers');
  });

  it('leaves out changes to steps held in reserve', () => {
    expect(changeSummary([{ kind: 'moved', inReserve: true }], t)).toBeNull();
  });
});
