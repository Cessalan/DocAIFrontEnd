import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StudyExamCard from './StudyExamCard';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, fallback) => fallback || key }) }));
jest.mock('./StudyReasoning', () => () => null);
jest.mock('./StudyCelebration', () => () => null);
jest.mock('../ChatInerface/SATAQuestion', () => () => null);
jest.mock('../ChatInerface/CaseStudyQuestion', () => () => null);
jest.mock('../../utils/soundEffects', () => ({ playCorrectSound: jest.fn(), playIncorrectSound: jest.fn(), playCelebrationSound: jest.fn() }));

const question = { questionType: 'mcq', question: 'First question', options: ['First choice', 'Second choice'], correctIndex: 0, rationale: 'An explanation.' };
const nextQuestion = { ...question, question: 'Second question', options: ['Third choice', 'Fourth choice'] };

test.each([0, 1])('restores saved MCQ choice %s with feedback and navigation without submitting again', selectedIndex => {
  const onAnswer = jest.fn();
  render(<StudyExamCard content={{ questions: [question, nextQuestion] }} onAnswer={onAnswer}
    savedProgress={{ currentIndex: 0, answers: { 0: { questionType: 'mcq', selectedIndex, isCorrect: selectedIndex === 0, score: selectedIndex === 0 ? 1 : 0, maxScore: 1 } } }} />);
  const first = screen.getByRole('button', { name: /First choice/ });
  const second = screen.getByRole('button', { name: /Second choice/ });
  expect(first).toBeDisabled();
  expect(second).toBeDisabled();
  expect(first).toHaveClass('correct');
  expect(second.classList.contains('incorrect')).toBe(selectedIndex === 1);
  fireEvent.click(second);
  expect(onAnswer).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Learn more' }));
  expect(screen.getByText('An explanation.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next Question' }));
  expect(screen.getByRole('button', { name: /Third choice/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Finish Exam' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Third choice/ }));
  expect(onAnswer).toHaveBeenCalledTimes(1);
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ questionIndex: 1, selectedIndex: 0, isCorrect: true }));
  expect(screen.getByRole('button', { name: 'Finish Exam' })).toBeInTheDocument();
});

test('a fresh MCQ submits once and remains navigable after remounting from its saved progress', () => {
  const onAnswer = jest.fn();
  const content = { questions: [question] };
  const { unmount } = render(<StudyExamCard content={content} onAnswer={onAnswer} />);
  fireEvent.click(screen.getByRole('button', { name: /Second choice/ }));
  fireEvent.click(screen.getByRole('button', { name: /First choice/ }));
  expect(onAnswer).toHaveBeenCalledTimes(1);
  const savedProgress = onAnswer.mock.calls[0][0].progress;
  unmount();
  render(<StudyExamCard content={content} savedProgress={savedProgress} onAnswer={onAnswer} />);
  expect(screen.getByRole('button', { name: /Second choice/ })).toHaveClass('incorrect');
  expect(screen.getByRole('button', { name: 'Finish Exam' })).toBeEnabled();
  expect(onAnswer).toHaveBeenCalledTimes(1);
});
