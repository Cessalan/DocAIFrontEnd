import React from 'react';
import { render, screen } from '@testing-library/react';
import PracticeLaunchCard from './PracticeLaunchCard';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, o) => {
  const text = typeof o === 'string' ? o : o?.defaultValue || key;
  return text.replace(/{{(\w+)}}/g, (_, name) => o?.[name]);
} }) }));
const mockUsage = { remaining: Infinity, isPro: true };
jest.mock('../../Contexts/UsageContext/UsageContext', () => ({ useUsageLimit: () => mockUsage }));

const questions = Array.from({ length: 10 }, (_, i) => ({ question: `Q${i}?`, topic: 'Trauma' }));
const answers = Object.fromEntries([0, 1, 2, 3].map(i => [i, { isCorrect: true }]));
const fiftyRequested = { id: 'm', quizTopic: 'Trauma Patient Initial Evaluation', requestedTotal: 50,
  practice: { settings: { requested_total: 50 }, answers } };

test('a 50-question practice shows 50 in the chat, like the quiz does', () => {
  render(<PracticeLaunchCard message={fiftyRequested} questions={questions} onOpen={() => {}} />);
  expect(screen.getByText('a 50-question practice on…')).toBeInTheDocument();
  expect(screen.getByText('10 of 50 ready · more load as you go')).toBeInTheDocument();
  expect(screen.getByText('4/50')).toBeInTheDocument();
  expect(screen.queryByText('4/10')).toBeNull();
});

test('a free student out of allowance sees the size she can actually get', () => {
  mockUsage.isPro = false; mockUsage.remaining = 0;
  render(<PracticeLaunchCard message={fiftyRequested} questions={questions} onOpen={() => {}} />);
  expect(screen.getByText('4/10')).toBeInTheDocument();
  expect(screen.getByText('a little practice on…')).toBeInTheDocument();
  mockUsage.isPro = true; mockUsage.remaining = Infinity;
});

test('a practice is not "complete" while more questions are still due', () => {
  const allAnswered = { ...fiftyRequested, practice: { ...fiftyRequested.practice,
    answers: Object.fromEntries(questions.map((_, i) => [i, { isCorrect: true }])) } };
  render(<PracticeLaunchCard message={allAnswered} questions={questions} onOpen={() => {}} />);
  expect(screen.getByRole('button', { name: /Resume practice/ })).toBeInTheDocument();
});

test('a small quiz keeps its original wording', () => {
  render(<PracticeLaunchCard message={{ id: 'm', quizTopic: 'Fluids', requestedTotal: 5 }} questions={questions.slice(0, 5)} onOpen={() => {}} />);
  expect(screen.getByText('a little practice on…')).toBeInTheDocument();
  expect(screen.getByText('5 questions ready')).toBeInTheDocument();
});
