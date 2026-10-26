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

it('plays the whole method by itself, like a video, then offers a replay', () => {
  const onClose = jest.fn();
  // She picked 0 and 2: right on 0, wrong on 1 (missed) and 2 (picked).
  render(<MethodWalkthrough question={QUESTION} options={OPTIONS} correctIndices={KEY}
    selectedIndices={[0, 2]} walkthrough={DATA} onClose={onClose} />);

  // It starts on its own: no play button, nothing to answer.
  expect(clarityEvent).toHaveBeenCalledWith('walkthrough_opened');
  expect(screen.getByText('Reading the question…')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
  expect(screen.getByText('digoxin 0.25 mg daily').tagName).toBe('MARK');

  // Staged: each part in turn, then the test question.
  act(() => { jest.advanceTimersByTime(1000 + 1800 * 2); });
  expect(screen.getByText('That gives one question to ask every option.')).toBeInTheDocument();
  expect(screen.getByText('digoxin slows the heart')).toBeInTheDocument();
  expect(screen.getByText('So ask each option')).toBeInTheDocument();
  expect([...document.querySelectorAll('mark.mw-fact.is-lit')].map((m) => m.textContent))
    .toEqual(['1digoxin 0.25 mg daily', '2Which actions should the nurse take']);

  // Option A is worked through slowly, thinking out loud first.
  act(() => { jest.advanceTimersByTime(1600 + 1000); });
  expect(screen.getByText('Let me think this through…')).toBeInTheDocument();
  for (let i = 0; i < 6; i += 1) flush();

  // Every option played through, then the end.
  expect(screen.getByText('Real rate')).toBeInTheDocument();
  expect(screen.getByText('Already slow')).toBeInTheDocument();
  expect(screen.getByText('Meal timing')).toBeInTheDocument();
  expect(screen.getByText('Every option, judged one at a time with the same question.')).toBeInTheDocument();
  expect(screen.getByText('One fact, one question, every option.')).toBeInTheDocument();
  expect(clarityEvent).toHaveBeenCalledWith('walkthrough_completed');

  // Watch again starts it over.
  fireEvent.click(screen.getByRole('button', { name: 'Watch again' }));
  expect(screen.getByText('Reading the question…')).toBeInTheDocument();
  expect(screen.queryByText('Meal timing')).toBeNull();

  fireEvent.click(screen.getByLabelText('Close the replay'));
  expect(onClose).toHaveBeenCalled();
});

it('names an option she got wrong while it plays', () => {
  render(<MethodWalkthrough question={QUESTION} options={OPTIONS} correctIndices={KEY}
    selectedIndices={[0, 2]} walkthrough={DATA} onClose={() => {}} />);
  const seen = new Set();
  for (let ms = 0; ms < 40000; ms += 100) {
    act(() => { jest.advanceTimersByTime(100); });
    seen.add(document.querySelector('.mw-coach').textContent);
  }
  expect(seen.has('Option B is one you got wrong. Same question.')).toBe(true);
  expect(seen.has('Option C is one you got wrong. Same question.')).toBe(true);
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
