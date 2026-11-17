import { nextStep, supportLine } from './todayCardModel';

const node = (id, type, status = 'locked', extra = {}) => ({ id, type, label: 'Adrenal insufficiency', status, ...extra });

describe('nextStep', () => {
  test('is the first unfinished step of today, with its own minutes', () => {
    const step = nextStep([node('a', 'lesson', 'done'), node('b', 'flashcard', 'active'), node('c', 'quiz')], 1);
    expect(step.node.id).toBe('b');
    expect(step.minutes).toBeGreaterThan(0);
    expect(step.started).toBe(true);
  });

  test('a brand-new plan has not been started', () => {
    expect(nextStep([node('a', 'lesson', 'active')], 0).started).toBe(false);
    expect(nextStep([node('a', 'lesson', 'active', { nodeProgress: 40 })], 0).started).toBe(true);
  });

  test('nothing left today is null', () => {
    expect(nextStep([node('a', 'lesson', 'done')], 1)).toBeNull();
    expect(nextStep([], 0)).toBeNull();
  });
});

describe('supportLine', () => {
  test('a real number wins over any sentence', () => {
    const line = supportLine({ phase: 'final', projection: { hasData: true, movesToday: true, currentPct: 52, todayPct: 61, focusLevel: 'weak' } });
    expect(line).toMatchObject({ kind: 'jump', params: { from: 52, to: 61 } });
  });

  test('close to the exam, the calendar speaks before her standing on the topic', () => {
    expect(supportLine({ phase: 'examDay', projection: { focusLevel: 'weak' } }).key).toBe('study.whyExamDay');
    expect(supportLine({ phase: 'final', projection: { focusLevel: 'weak' } }).key).toBe('study.whyFinal');
  });

  test('otherwise it says where she stands on this topic', () => {
    expect(supportLine({ projection: { focusLevel: 'untested' }, missionHasGraded: true }).key).toBe('study.whyUntested');
    expect(supportLine({ projection: { focusLevel: 'developing' } }).key).toBe('study.whyDeveloping');
  });

  test('with no standing, a first score is promised only when today has graded questions', () => {
    expect(supportLine({ projection: { hasData: false }, missionHasGraded: true }).kind).toBe('first');
    expect(supportLine({ projection: { hasData: false }, missionHasGraded: false })).toBeNull();
  });

  test('a day that moves nothing points at where the plan lands, if that is further on', () => {
    expect(supportLine({ projection: { hasData: true, movesToday: false, currentPct: 50, planPct: 70 } }))
      .toMatchObject({ kind: 'groundwork', params: { pct: 70 } });
    expect(supportLine({ projection: { hasData: true, movesToday: false, currentPct: 50, planPct: 51 } })).toBeNull();
  });

  test('only ever one line', () => {
    const line = supportLine({ phase: 'none', missionHasGraded: true,
      projection: { hasData: true, movesToday: true, currentPct: 40, todayPct: 48, planPct: 80, focusLevel: 'untested' } });
    expect(line.kind).toBe('jump');
  });
});
