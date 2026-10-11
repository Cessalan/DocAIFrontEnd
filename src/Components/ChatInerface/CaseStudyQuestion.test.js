import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CaseStudyQuestion from './CaseStudyQuestion';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, fallback, values) => (typeof fallback === 'string' ? fallback : key).replace('{{number}}', values?.number) }) }));
jest.mock('../Glossary/useGlossary', () => () => ({ rationaleRef: { current: null }, rationaleHandlers: {}, popover: null }));
const quiz = { question: 'Arrange these actions.', topic: 'Patient assessment', options: ['Assess', 'Reassess'], correctOrder: ['Assess', 'Reassess'], caseStudy: { nursesNotes: '<p>Patient history.</p>', vitalSigns: '<p>Recorded observations.</p>' } };
const tap = (text) => fireEvent.click(screen.getByText(text));

// Each tap a second apart: the card ignores a second tap within 350 ms (rows
// move under the finger after a tap), and tests tap faster than any person.
let fakeNow = 0;
beforeEach(() => { jest.spyOn(Date, 'now').mockImplementation(() => (fakeNow += 1000)); });
afterEach(() => { Date.now.mockRestore?.(); });

test('switches chart tabs and lets a learner tap the actions in order and submit', () => {
  const answer = jest.fn();
  render(<CaseStudyQuestion quiz={quiz} onAnswerSelect={answer} />);
  expect(screen.getByText('Patient history.')).toBeVisible();
  expect(screen.queryByText('Recorded observations.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Vitals & labs' }));
  expect(screen.getByText('Recorded observations.')).toBeVisible();
  // Nothing to submit until every action has a place.
  expect(screen.getByRole('button', { name: '{{placed}} of {{total}} placed' })).toBeDisabled();
  tap('Assess');
  tap('Reassess');
  fireEvent.click(screen.getByRole('button', { name: 'Submit Order' }));
  expect(answer).toHaveBeenCalledWith(expect.objectContaining({ userOrder: ['Assess', 'Reassess'], isCorrect: true }));
});

test('a tapped action can be taken back before submitting', () => {
  const answer = jest.fn();
  render(<CaseStudyQuestion quiz={quiz} onAnswerSelect={answer} />);
  tap('Reassess');
  fireEvent.click(screen.getByRole('button', { name: 'Take back action 1' }));
  tap('Assess');
  tap('Reassess');
  fireEvent.click(screen.getByRole('button', { name: 'Submit Order' }));
  expect(answer).toHaveBeenCalledWith(expect.objectContaining({ userOrder: ['Assess', 'Reassess'] }));
});

test('the tapped order is what gets scored, and the marked list says where each action belonged', async () => {
  const answer = jest.fn();
  render(<CaseStudyQuestion quiz={quiz} onAnswerSelect={answer} />);
  tap('Reassess');
  tap('Assess');
  fireEvent.click(screen.getByRole('button', { name: 'Submit Order' }));
  expect(answer).toHaveBeenCalledWith(expect.objectContaining({ userOrder: ['Reassess', 'Assess'], isCorrect: false }));
  // Each misplaced action carries its expected number; no second pair of
  // "your order / correct order" lists repeats it (owner, 2026-10-11).
  await waitFor(() => expect(screen.getByText('Expected #2')).toBeInTheDocument());
  expect(screen.getByText('Expected #1')).toBeInTheDocument();
  expect(screen.queryByText('Your order')).toBeNull();
  expect(screen.queryByText('Correct Order:')).toBeNull();
});

test('a second tap in the same instant (a bounce, rows having moved) is ignored', () => {
  Date.now.mockImplementation(() => 5000);
  render(<CaseStudyQuestion quiz={quiz} onAnswerSelect={() => {}} />);
  tap('Assess');
  tap('Reassess');
  expect(screen.getByRole('button', { name: 'Take back action 1' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Take back action 2' })).toBeNull();
});
