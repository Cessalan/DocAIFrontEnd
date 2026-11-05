import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import StudyQuizCard from './StudyQuizCard';
jest.mock('./StudyReasoning', () => () => null);

jest.mock('../../Services/FastAPICalls', () => ({ fetchQuizRationale: jest.fn() }));
jest.mock('../../utils/soundEffects', () => ({ playCorrectSound: jest.fn(), playIncorrectSound: jest.fn(), playCelebrationSound: jest.fn(), playMilestoneSound: jest.fn() }));
jest.mock('../Glossary/useGlossary', () => () => ({ rationaleRef: { current: null }, rationaleHandlers: {}, popover: null }));

test('extends the original first pass after resuming a partly completed quiz', () => {
  const onAnswer = jest.fn();
  render(<StudyQuizCard content={{ questions: [
    { question: 'Earlier question', options: ['One', 'Two'], correctIndex: 0 },
    { question: 'Resumed question', options: ['Answer A', 'Answer B'], correctIndex: 0 },
  ] }} savedProgress={{ questionStatuses: { 0: 'incorrect' }, firstAttemptStatuses: { 0: 'incorrect' }, queueIndex: 1, isReviewRound: false }} onAnswer={onAnswer} />);
  fireEvent.click(screen.getByText('Answer A'));
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ progress: expect.objectContaining({
    firstAttemptStatuses: { 0: 'incorrect', 1: 'correct' },
  }) }));
});

test('saves her first-attempt choice alongside the status, keeping choices from before a resume', () => {
  const onAnswer = jest.fn();
  render(<StudyQuizCard content={{ questions: [
    { question: 'Earlier question', options: ['One', 'Two'], correctIndex: 0 },
    { question: 'Resumed question', options: ['Answer A', 'Answer B'], correctIndex: 0 },
  ] }} savedProgress={{ questionStatuses: { 0: 'incorrect' }, firstAttemptStatuses: { 0: 'incorrect' },
    firstAttemptChoices: { 0: 1 }, queueIndex: 1, isReviewRound: false }} onAnswer={onAnswer} />);
  fireEvent.click(screen.getByText('Answer B'));
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ selectedIndex: 1, progress: expect.objectContaining({
    firstAttemptChoices: { 0: 1, 1: 1 },
  }) }));
});
