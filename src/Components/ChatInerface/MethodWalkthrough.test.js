import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import MethodWalkthrough from './MethodWalkthrough';

jest.mock('../../Services/ClarityService', () => ({ clarityEvent: jest.fn() }));
const { clarityEvent } = require('../../Services/ClarityService');

const QUESTION = 'A client is prescribed digoxin 0.25 mg daily. Which actions should the nurse take?';
const OPTIONS = ['Check the apical pulse', 'Hold if pulse below 60', 'Give with a high-fiber meal'];
const KEY = [0, 1];
const DATA = {
  breakdown: [
    { role: 'problem', quote: 'digoxin 0.25 mg daily', meaning: 'digoxin slows the heart' },
    { role: 'task', quote: 'Which actions should the nurse take', meaning: 'pick every safe action' },
  ],
  key_fact: 'digoxin 0.25 mg daily',
  fact_meaning: 'digoxin slows the heart',
  test_question: 'Does this protect a slowed heart?',
  method_line: 'One fact, one question, every option.',
  options: [
    { index: 0, verdict: true, part: 0, chain: ['Real rate', 'needed first'], hint: 'What do you need first?' },
    { index: 1, verdict: true, chain: ['Already slow', 'do not slow more'], hint: 'The heart is already slow.' },
    { index: 2, verdict: false, chain: ['Meal timing', 'not protective'], hint: 'Does a meal protect the heart?' },
  ],
};

const flush = () => act(() => { jest.runAllTimers(); });

beforeEach(() => {
  jest.useFakeTimers();
  clarityEvent.mockClear();
});
afterEach(() => jest.useRealTimers());

it('walks watch, together and your turn on her own miss', () => {
  const onClose = jest.fn();
  // She picked 0 and 2: right on 0, wrong on 1 (missed) and 2 (picked).
  render(<MethodWalkthrough question={QUESTION} options={OPTIONS} correctIndices={KEY}
    selectedIndices={[0, 2]} walkthrough={DATA} onClose={onClose} />);

  expect(clarityEvent).toHaveBeenCalledWith('walkthrough_opened');
  expect(screen.getByText('Before the options, break the question down.')).toBeInTheDocument();
  expect(screen.getByText('digoxin 0.25 mg daily').tagName).toBe('MARK');

  fireEvent.click(screen.getByText('Break down the question'));
  // Staged: it reads first, then each part in turn, then the test question.
  expect(screen.getByText('Reading the question…')).toBeInTheDocument();
  expect(screen.queryByText('Watch me evaluate option A')).toBeNull();
  flush();
  expect(screen.getByText('That gives one question to ask every option.')).toBeInTheDocument();
  expect(screen.getByText('The problem')).toBeInTheDocument();
  expect(screen.getByText('digoxin slows the heart')).toBeInTheDocument();
  expect(screen.getByText("What you're asked")).toBeInTheDocument();
  expect(screen.getByText('So ask each option')).toBeInTheDocument();
  // Both parts are highlighted and numbered in the question itself.
  expect([...document.querySelectorAll('mark.mw-fact.is-lit')].map((m) => m.textContent))
    .toEqual(['1digoxin 0.25 mg daily', '2Which actions should the nurse take']);
  expect(screen.getByText('Does this protect a slowed heart?')).toBeInTheDocument();

  // Watch: the tutor demonstrates on the option she got right (0).
  fireEvent.click(screen.getByText('Watch me evaluate option A'));
  // The demonstration thinks out loud before each step.
  expect(screen.getByText('Let me think this through…')).toBeInTheDocument();
  flush();
  expect(screen.getByText('So the answer is Yes.')).toBeInTheDocument();
  expect(screen.getByText('Real rate')).toBeInTheDocument();
  expect(screen.getByText('needed first')).toBeInTheDocument();
  // No part badge on the option's reasoning: the words already say why.
  expect(document.querySelector('.mw-uses')).toBeNull();

  // Together: her miss (1) comes next, with a hint on a wrong tap.
  fireEvent.click(screen.getByText('Now you try option B'));
  expect(screen.getByText('You got this one wrong. Ask the question.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'No' }));
  expect(screen.getByText('Not quite. The heart is already slow.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
  for (let i = 0; i < 6; i += 1) flush();
  expect(screen.getByText('Already slow')).toBeInTheDocument();

  // Your turn: the last option. It was a wrong pick, so the tutor names it.
  expect(screen.getByText('You got this one wrong. Ask the question.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'No' }));
  for (let i = 0; i < 6; i += 1) flush();

  // 1 of 2: option 1 needed a second try, option 2 did not.
  expect(screen.getByText('1 of 2 right on the first try. Use the same question on your next select-all.')).toBeInTheDocument();
  expect(screen.getByText('One fact, one question, every option.')).toBeInTheDocument();
  expect(clarityEvent).toHaveBeenCalledWith('walkthrough_completed');
  fireEvent.click(screen.getByText('Back to the question'));
  expect(onClose).toHaveBeenCalled();
});

it('never highlights a part that is not in the question', () => {
  render(<MethodWalkthrough question={QUESTION} options={OPTIONS} correctIndices={KEY}
    selectedIndices={[0]} walkthrough={{ ...DATA, breakdown: [{ role: 'problem', quote: 'not in the stem', meaning: 'x' }] }}
    onClose={() => {}} />);
  expect(document.querySelector('mark')).toBeNull();
});

it('still works with an older single-fact response', () => {
  const { breakdown, ...older } = DATA;
  render(<MethodWalkthrough question={QUESTION} options={OPTIONS} correctIndices={KEY}
    selectedIndices={[0]} walkthrough={older} onClose={() => {}} />);
  expect(document.querySelectorAll('mark').length).toBe(1);
});
