import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '../../i18n/i18n';
import i18n from 'i18next';
import QuizWait from './QuizWait';
import { ROTATE_MS, SLOW_MS } from './quizWaitModel';

beforeEach(() => { jest.useFakeTimers('modern'); i18n.changeLanguage('en'); });
afterEach(() => { jest.useRealTimers(); });

test('names the real stage and a subtopic from her notes', () => {
  render(<QuizWait stage="reading" subtopics={['C — Circulation', 'MIST']} />);
  expect(screen.getByRole('status')).toHaveTextContent('Reading your notes');
  expect(screen.getByText('From your notes: C — Circulation')).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(ROTATE_MS + 1000); });
  expect(screen.getByText('From your notes: MIST')).toBeInTheDocument();
});

test('the writing stage counts the questions', () => {
  render(<QuizWait stage="writing" total={5} />);
  expect(screen.getByRole('status')).toHaveTextContent('Writing your 5 questions');
});

test('a later batch names the question she is waiting for', () => {
  render(<QuizWait stage="writing" current={6} total={10} />);
  expect(screen.getByRole('status')).toHaveTextContent('Writing question 6 of 10');
});

test('a slow stage says so, and a new stage restarts the clock', () => {
  const { rerender } = render(<QuizWait stage="choosing" subtopics={['MIST']} />);
  act(() => { jest.advanceTimersByTime(SLOW_MS.choosing + 1000); });
  expect(screen.getByText(/Still writing/)).toBeInTheDocument();
  rerender(<QuizWait stage="writing" total={5} subtopics={['MIST']} />);
  act(() => { jest.advanceTimersByTime(1000); });
  expect(screen.queryByText(/Still writing/)).toBeNull();
  expect(screen.getByText('From your notes: MIST')).toBeInTheDocument();
});

test('French copy follows the interface language', () => {
  i18n.changeLanguage('fr');
  render(<QuizWait stage="choosing" />);
  expect(screen.getByRole('status')).toHaveTextContent('Choix des notions à tester');
});
