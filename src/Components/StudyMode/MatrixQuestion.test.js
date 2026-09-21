import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MatrixQuestion, { gradeMatrix } from './MatrixQuestion';
import StudyExamCard from './StudyExamCard';
import StudyQuizCard from './StudyQuizCard';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' }, t: (key, value) => typeof value === 'string' ? value : Object.entries(value || {}).reduce((s, [k, v]) => s.replace('{{' + k + '}}', v), value?.defaultValue || key) }) }));
jest.mock('./StudyReasoning', () => () => null);
jest.mock('./StudyCelebration', () => () => null);
jest.mock('../../Services/FastAPICalls', () => ({ fetchQuizRationale: jest.fn() }));
jest.mock('../../utils/soundEffects', () => ({ playCorrectSound: jest.fn(), playIncorrectSound: jest.fn(), playCelebrationSound: jest.fn(), playMilestoneSound: jest.fn() }));
jest.mock('../Glossary/useGlossary', () => () => ({ rationaleRef: { current: null }, rationaleHandlers: {}, popover: null }));

const quiz = { questionType: 'matrix', question: 'Classify each finding.',
  columns: [{ id: 'expected', label: 'Expected' }, { id: 'unexpected', label: 'Unexpected' }],
  rows: [0, 1, 2].map(i => ({ id: 'r' + i, text: 'Finding ' + i, correctColumnId: i === 1 ? 'unexpected' : 'expected', explanation: 'Explanation ' + i })) };
const choose = (row, column) => fireEvent.click(screen.getByRole('radio', { name: 'Finding ' + row + ': ' + column }));
const answer = () => { choose(0, 'Expected'); choose(1, 'Expected'); choose(2, 'Expected'); fireEvent.click(screen.getByRole('button', { name: 'Check answers' })); };

test('requires every row, permits one choice per row and awards partial credit once', () => {
  const submit = jest.fn(); render(<MatrixQuestion quiz={quiz} onAnswerSelect={submit} />);
  expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled();
  expect(screen.queryByText('Explanation 0')).not.toBeInTheDocument();
  choose(0, 'Unexpected'); answer();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ score: 2, maxScore: 3, isCorrect: false, selectedRows: { r0: 'expected', r1: 'expected', r2: 'expected' } }));
  expect(screen.getByRole('status')).toHaveTextContent('2 of 3 rows correct');
  screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled());
});

test('restores submitted rows without grading again', () => {
  const submit = jest.fn(); const previous = gradeMatrix(quiz, { r0: 'expected', r1: 'unexpected', r2: 'expected' });
  render(<MatrixQuestion quiz={quiz} previousAnswer={previous} onAnswerSelect={submit} />);
  expect(screen.getByRole('status')).toHaveTextContent('3 of 3 rows correct');
  expect(submit).not.toHaveBeenCalled();
});

test('a resumed review distinguishes the saved choice from the correct answer in each row', () => {
  const onAnswerSelect = jest.fn();
  render(<MatrixQuestion quiz={quiz} previousAnswer={gradeMatrix(quiz, { r0: 'expected', r1: 'expected', r2: 'unexpected' })} onAnswerSelect={onAnswerSelect} />);
  const correctRow = screen.getByRole('row', { name: /Finding 0/ });
  expect(within(within(correctRow).getAllByRole('cell')[0]).getByText('Your answer · Correct')).toBeVisible();
  const wrongRow = screen.getByRole('row', { name: /Finding 1/ });
  expect(within(within(wrongRow).getAllByRole('cell')[0]).getByText('Your answer · Incorrect')).toBeVisible();
  expect(within(within(wrongRow).getAllByRole('cell')[1]).getByText('Correct answer')).toBeVisible();
  expect(onAnswerSelect).not.toHaveBeenCalled();
});

test('places explanations under their rows and expands only one at a time', () => {
  render(<MatrixQuestion quiz={quiz} />);
  expect(screen.queryByText('Explanation 0')).not.toBeInTheDocument();
  answer();
  expect(screen.getByRole('row', { name: 'Explanation 1' })).toBeInTheDocument();
  expect(screen.queryByRole('row', { name: 'Explanation 0' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Why? Finding 0' }));
  expect(screen.getByRole('row', { name: 'Explanation 0' })).toBeInTheDocument();
  expect(screen.queryByRole('row', { name: 'Explanation 1' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Why? Finding 0' })).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Why? Finding 0' }));
  expect(screen.queryByRole('row', { name: 'Explanation 0' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).not.toHaveTextContent('Explanation');
});

test('exam persists selected rows and includes matrix points in its result', () => {
  const onAnswer = jest.fn(); render(<StudyExamCard content={{ questions: [quiz] }} onAnswer={onAnswer} />);
  answer();
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ progress: { currentIndex: 0, answers: { 0: expect.objectContaining({ selectedRows: { r0: 'expected', r1: 'expected', r2: 'expected' }, score: 2, maxScore: 3 }) } } }));
});

test('study quiz saves matrix row selections alongside first-attempt progress', () => {
  const onAnswer = jest.fn(); render(<StudyQuizCard content={{ questions: [quiz] }} onAnswer={onAnswer} />);
  answer();
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ progress: expect.objectContaining({
    firstAttemptStatuses: { 0: 'incorrect' }, matrixAnswers: { 0: expect.objectContaining({ score: 2, selectedRows: { r0: 'expected', r1: 'expected', r2: 'expected' } }) },
  }) }));
});

test('view-only cannot change selections or submit', () => {
  render(<MatrixQuestion quiz={quiz} viewOnly />);
  screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled());
  expect(screen.queryByRole('button', { name: 'Check answers' })).not.toBeInTheDocument();
});

test('resuming a study quiz restores submitted matrix rows without another performance event', () => {
  const onAnswer = jest.fn();
  const savedAnswer = gradeMatrix(quiz, { r0: 'expected', r1: 'expected', r2: 'expected' });
  render(<StudyQuizCard content={{ questions: [quiz] }} onAnswer={onAnswer}
    savedProgress={{ queueIndex: 0, questionStatuses: { 0: 'incorrect' }, firstAttemptStatuses: { 0: 'incorrect' }, matrixAnswers: { 0: savedAnswer } }} />);
  expect(screen.getByRole('status')).toHaveTextContent('2 of 3 rows correct');
  expect(screen.getByRole('radio', { name: 'Finding 1: Expected' })).toBeChecked();
  expect(onAnswer).not.toHaveBeenCalled();
});
