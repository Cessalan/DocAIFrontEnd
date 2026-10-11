import { briefLines, isDone, questionTag, requestText, verification } from './requestBriefModel';

// Shaped like the live quiz_brief / quiz_plan events of 2026-10-11.
const brief = {
  total: 50, exam: true,
  items: [
    { id: 'count', kind: 'count', value: 50, assumed: true },
    { id: 'scope:both-chapters', kind: 'scope', label: 'Both chapters', said: 'on both these chapter', files: ['chf.pdf', 'cad.pdf'] },
    { id: 'focus:medication-questions', kind: 'focus', label: 'Medication questions', said: 'with medications questions also', share: 0.3 },
    { id: 'style:clinical', kind: 'style', label: 'Clinical reasoning, NCLEX style', said: 'nclex styple' },
    { id: 'difficulty', kind: 'difficulty', value: 'hard' },
    { id: 'formats', kind: 'format', value: ['mcq', 'sata'], excluded: [] },
    { id: 'rule:medication-class-not-drug-names', kind: 'rule', label: 'Medication class, not drug names', said: 'medication class not medications name' },
    { id: 'conditions', kind: 'conditions', value: 'exam' },
  ],
};
const plan = { id: 'req-x', total: 50, files: { 'congestive heart failure .pdf': 18, 'coronary artery disease.pdf': 32 },
  focus: { 'focus:medication-questions': 15 }, chapters: 48, gaps: [] };

const byKind = lines => Object.fromEntries(lines.map(l => [l.kind, l]));

test('before the plan, every line is only heard', () => {
  const lines = briefLines({ brief });
  expect(lines.map(l => l.kind)).toEqual(['count', 'scope', 'focus', 'style', 'difficulty', 'format', 'rule', 'conditions']);
  expect(lines.every(l => l.status === 'heard')).toBe(true);
  expect(byKind(lines).count.detail).toEqual({ key: 'requestBrief.countAssumed' });
});

test('the plan ticks what it allocated, with real numbers', () => {
  const lines = byKind(briefLines({ brief, plan }));
  expect(lines.scope.status).toBe('planned');
  expect(lines.scope.detail.vars.list).toBe('congestive heart failure 18 · coronary artery disease 32');
  expect(lines.focus.detail).toEqual({ key: 'requestBrief.focusPlanned', vars: { count: 15 } });
  expect(lines.rule.detail).toEqual({ key: 'requestBrief.willCheck' });
  expect(isDone(lines.rule.status)).toBe(true);
});

test('a checked rule reports exactly how many questions met it', () => {
  const questions = [
    { request: { serves: ['focus:medication-questions'], verified: { 'rule:medication-class-not-drug-names': true, 'focus:medication-questions': true } } },
    { request: { serves: [], verified: { 'rule:medication-class-not-drug-names': false } } },
    { request: { serves: [], verified: { 'rule:medication-class-not-drug-names': null } } },
    {},
  ];
  const lines = byKind(briefLines({ brief, plan, questions }));
  expect(lines.rule.detail).toEqual({ key: 'requestBrief.checkedOf', vars: { met: 1, count: 2 } });
  expect(lines.focus.detail).toEqual({ key: 'requestBrief.focusChecked', vars: { count: 15, met: 1, checked: 1 } });
  expect(verification(questions, 'rule:medication-class-not-drug-names')).toEqual({ checked: 2, met: 1 });
});

test('hard is ticked only from questions checked against the standard', () => {
  const planned = byKind(briefLines({ brief, plan }));
  expect(planned.difficulty.status).toBe('heard');
  expect(planned.difficulty.detail).toEqual({ key: 'requestBrief.willCheckHard' });
  const questions = [{ request: { verified: { difficulty: true } } }, { request: { verified: { difficulty: false } } }];
  const checked = byKind(briefLines({ brief, plan, questions }));
  expect(checked.difficulty.status).toBe('checked');
  expect(checked.difficulty.detail).toEqual({ key: 'requestBrief.hardChecked', vars: { met: 1, count: 2 } });
});

test('a gap is said plainly and never ticked', () => {
  const lines = byKind(briefLines({ brief, plan: { ...plan, gaps: [{ id: 'focus:medication-questions', kind: 'none' }] } }));
  expect(lines.focus.status).toBe('gap');
  expect(isDone(lines.focus.status)).toBe(false);
  const fileGap = byKind(briefLines({ brief, plan: { ...plan, gaps: [{ id: 'focus:medication-questions', kind: 'file', file: 'chf.pdf' }] } }));
  expect(fileGap.focus.detail).toEqual({ key: 'requestBrief.gapFile', vars: { file: 'chf', count: 15 } });
});

test('image slides that could not be read are named once, on the scope line', () => {
  const lines = byKind(briefLines({ brief, plan: { ...plan, partialFiles: ['congestive heart failure .pdf'] } }));
  expect(lines.scope.status).toBe('planned');
  expect(lines.scope.note).toEqual({ key: 'requestBrief.partialFiles', vars: { files: 'congestive heart failure' } });
  expect(byKind(briefLines({ brief, plan })).scope.note).toBeNull();
});

test('a free plan that covers fewer questions says so on the count', () => {
  const lines = byKind(briefLines({ brief, plan, allowance: { requested: 50, allowed: 20, pro: false } }));
  expect(lines.count.status).toBe('limited');
  expect(lines.count.detail).toEqual({ key: 'requestBrief.countLimited', vars: { count: 20 } });
});

test('the question tag names a focus only when this question was verified for it', () => {
  const q = { request: { chapter: 'Medications for angina', serves: ['focus:medication-questions'], verified: { 'focus:medication-questions': true } } };
  expect(questionTag(q, brief)).toBe('Medication questions · Medications for angina');
  const unverified = { request: { ...q.request, verified: { 'focus:medication-questions': false } } };
  expect(questionTag(unverified, brief)).toBe('Medications for angina');
  expect(questionTag({}, brief)).toBeNull();
});

test('her own words are the user message the quiz answers', () => {
  const messages = [{ id: 'a', role: 'user', content: 'older' }, { id: 'b', role: 'user', content: ' i need a full exam ' },
    { id: 'q', role: 'assistant', type: 'quiz' }, { id: 'c', role: 'user', content: 'later' }];
  expect(requestText(messages, 'q')).toBe('i need a full exam');
});
