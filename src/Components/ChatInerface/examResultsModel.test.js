import { correctAnswer, examComplete, examResults, verdict, yourAnswer } from './examResultsModel';

const brief = { items: [{ id: 'focus:meds', kind: 'focus', label: 'Medication questions' }] };
const mcq = (chapter, serves = []) => ({ question: '<b>Which</b> first?', options: ['A) Assess airway', 'B) Call provider'], correctIndex: 0,
  correctBlurb: 'Airway comes first.', request: { chapter, serves } });
const sata = { questionType: 'sata', question: 'Select all', options: ['A) One', 'B) Two', 'C) Three'], answer: ['A) One', 'C) Three'],
  request: { chapter: 'Medications for angina', serves: ['focus:meds'] } };

test('right, partial and missed are told apart', () => {
  expect(verdict({ isCorrect: true })).toBe('right');
  expect(verdict({ isCorrect: false, scoreResult: { score: 1 } })).toBe('partial');
  expect(verdict({ isCorrect: false, scoreResult: { score: 0 } })).toBe('missed');
  expect(verdict({ isCorrect: false })).toBe('missed');
  expect(verdict(undefined)).toBeNull();
});

test('answers read back as text in every format', () => {
  expect(yourAnswer(mcq('x'), { selectedIndex: 1 })).toEqual(['Call provider']);
  expect(correctAnswer(mcq('x'))).toEqual(['Assess airway']);
  expect(yourAnswer(sata, { selectedOptions: ['A) One', 'B) Two'] })).toEqual(['One', 'Two']);
  expect(correctAnswer(sata)).toEqual(['One', 'Three']);
  const order = { questionType: 'casestudy', options: [{ id: 'a', text: 'Oxygen' }, { id: 'b', text: 'IV access' }],
    correctOrder: [{ id: 'a', text: 'Oxygen' }, { id: 'b', text: 'IV access' }] };
  expect(yourAnswer(order, { userOrder: ['b', 'a'] })).toEqual(['IV access', 'Oxygen']);
  expect(correctAnswer(order)).toEqual(['Oxygen', 'IV access']);
  const matrix = { questionType: 'matrix', columns: [{ id: 'c1', label: 'Expected' }, { id: 'c2', label: 'Report' }],
    rows: [{ id: 'r1', text: 'Crackles', correctColumnId: 'c2' }] };
  expect(yourAnswer(matrix, { selectedRows: { r1: 'c1' } })).toEqual(['Crackles: Expected']);
  expect(correctAnswer(matrix)).toEqual(['Crackles: Report']);
});

test('results break down by section and by her own requirement, weakest first', () => {
  const questions = [mcq('Angina'), mcq('Angina'), mcq('Heart failure'), sata];
  const answers = { 0: { isCorrect: true, selectedIndex: 0 }, 1: { isCorrect: false, selectedIndex: 1 },
    2: { isCorrect: true, selectedIndex: 0 }, 3: { isCorrect: false, selectedOptions: ['A) One'], scoreResult: { score: 1 } } };
  const result = examResults(questions, answers, brief);
  expect(result).toMatchObject({ answered: 4, right: 2, partial: 1, percent: 50 });
  expect(result.byChapter.map(c => `${c.name} ${c.right}/${c.total}`)).toEqual(['Medications for angina 0/1', 'Angina 1/2', 'Heart failure 1/1']);
  expect(result.byFocus).toEqual([{ id: 'focus:meds', name: 'Medication questions', right: 0, total: 1, marks: ['partial'] }]);
  expect(result.missed.map(m => [m.index, m.verdict])).toEqual([[1, 'missed'], [3, 'partial']]);
  expect(result.missed[0]).toMatchObject({ question: 'Which first?', yours: ['Call provider'], correct: ['Assess airway'], why: 'Airway comes first.' });
});

test('the exam is complete when every question she asked for has an answer', () => {
  const questions = [mcq('a'), mcq('b')];
  expect(examComplete(questions, { 0: { isCorrect: true } }, 2)).toBe(false);
  expect(examComplete(questions, { 0: { isCorrect: true }, 1: { isCorrect: false } }, 2)).toBe(true);
  expect(examComplete(questions, {}, 0)).toBe(false);
});
