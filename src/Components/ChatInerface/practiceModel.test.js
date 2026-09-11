import { normalizePracticeQuestion, permittedTotal, appendUniqueQuestions } from './practiceModel';

test('free users cannot request more than loaded questions plus remaining allowance', () => {
  expect(permittedTotal(100, 5, 2, false)).toBe(7);
  expect(permittedTotal(100, 5, 0, false)).toBe(5);
  expect(permittedTotal(100, 5, Infinity, true)).toBe(100);
});
test('answer text beginning with A is matched by content, not mistaken for option A', () => {
  expect(normalizePracticeQuestion({ options: ['Beta', 'Assess breathing'], answer: 'Assess breathing' }).correctIndex).toBe(1);
  expect(normalizePracticeQuestion({ options: ['A) One', 'B) Two'], answer: 'B) Two' }).correctIndex).toBe(1);
});
test('replayed batches do not duplicate questions or overwrite saved selections', () => {
  const original = { question: 'What next?', userSelection: { isCorrect: true } };
  expect(appendUniqueQuestions([original], [{ question: ' WHAT NEXT? ' }, { question: 'Why?' }])).toEqual([original, { question: 'Why?' }]);
});
test('SATA and case data survive normalization', () => {
  const sata = { questionType: 'sata', correctAnswers: ['a', 'b'], options: ['a', 'b', 'c'] };
  const caseQ = { questionType: 'casestudy', caseStudy: { nursesNotes: 'Case' }, correctOrder: ['2', '1'] };
  expect(normalizePracticeQuestion(sata).correctAnswers).toEqual(['a', 'b']);
  expect(normalizePracticeQuestion(caseQ).caseStudy).toEqual(caseQ.caseStudy);
});
