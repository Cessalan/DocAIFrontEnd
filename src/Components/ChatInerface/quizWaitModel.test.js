import { scopeSubtopics, waitCopy, ROTATE_MS, SLOW_MS } from './quizWaitModel';

const groups = [
  { title: 'Examen primaire', subtopics: ['A — Voies aériennes', 'B — Respiration', 'C — Circulation'] },
  { title: 'Examen secondaire', subtopics: ['MIST', 'SAMPLE'] },
];

test('a main topic in the scope expands to its subtopics; a subtopic stays itself', () => {
  expect(scopeSubtopics('Examen primaire, Réévaluation', groups))
    .toEqual(['A — Voies aériennes', 'B — Respiration', 'C — Circulation', 'Réévaluation']);
  expect(scopeSubtopics('examen secondaire; MIST', groups)).toEqual(['MIST', 'SAMPLE']);
  expect(scopeSubtopics('', groups)).toEqual([]);
  expect(scopeSubtopics('Shock', [])).toEqual(['Shock']);
});

test('the headline follows the backend stage, never the clock', () => {
  expect(waitCopy({ stage: 'reading', elapsedMs: 60000 }).headline.key).toBe('quizWait.reading');
  expect(waitCopy({ stage: 'choosing' }).headline.key).toBe('quizWait.choosing');
  expect(waitCopy({ stage: 'writing', total: 5 }).headline).toEqual({ key: 'quizWait.writing', vars: { count: 5 } });
  expect(waitCopy({ stage: 'writing', total: 10, current: 6 }).headline).toEqual({ key: 'quizWait.writingOne', vars: { current: 6, total: 10 } });
  expect(waitCopy({ stage: 'unknown' }).headline.key).toBe('quizWait.writing');
});

test('the detail line rotates through her own subtopics', () => {
  const subtopics = ['MIST', 'SAMPLE'];
  expect(waitCopy({ stage: 'writing', subtopics, elapsedMs: 0 }).detail.vars.topic).toBe('MIST');
  expect(waitCopy({ stage: 'writing', subtopics, elapsedMs: ROTATE_MS }).detail.vars.topic).toBe('SAMPLE');
  expect(waitCopy({ stage: 'writing', subtopics, elapsedMs: ROTATE_MS * 2 }).detail.vars.topic).toBe('MIST');
});

test('with nothing true to add, there is no detail line', () => {
  expect(waitCopy({ stage: 'writing', subtopics: [] }).detail).toBeNull();
});

test('a slow stage says so instead of rotating', () => {
  expect(waitCopy({ stage: 'reading', subtopics: ['MIST'], elapsedMs: SLOW_MS.reading }).detail.key).toBe('quizWait.readingSlow');
  const writing = waitCopy({ stage: 'writing', subtopics: ['MIST'], elapsedMs: SLOW_MS.writing });
  expect(writing.detail.key).toBe('quizWait.slow');
  expect(writing.slow).toBe(true);
});
