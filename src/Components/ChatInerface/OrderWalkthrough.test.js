import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '../../i18n/i18n';
import OrderWalkthrough from './OrderWalkthrough';

jest.mock('../../Services/ClarityService', () => ({ clarityEvent: jest.fn() }));
const { clarityEvent } = require('../../Services/ClarityService');

// A real production miss (2026-10-10, anonymous), with the walkthrough the
// backend wrote for it in the live check. She scored 60%: the interpreter
// went in before the quiet room.
const CHART = 'I am caring for Mr. Lee, a 76-year-old male recently admitted for pneumonia. He is hard of hearing, '
  + 'wears hearing aids, and speaks English as a second language. The unit is noisy and busy.';
const QUESTION = 'Place the following nursing actions in order of priority to overcome communication barriers with this patient.';
const ITEMS = [
  { id: 'item4', text: 'Provide written instructions in both English and Mandarin' },
  { id: 'item2', text: 'Move Mr. Lee to a quieter area and reduce background noise' },
  { id: 'item1', text: "Ensure Mr. Lee's hearing aids are in place and working" },
  { id: 'item5', text: 'Use teach-back technique to confirm understanding' },
  { id: 'item3', text: 'Arrange for a certified medical interpreter' },
];
const KEY = ['item1', 'item2', 'item3', 'item4', 'item5'];
const HERS = ['item1', 'item3', 'item2', 'item4', 'item5'];
const DATA = {
  ladder: 'barriers',
  breakdown: [
    { role: 'problem', quote: 'He is hard of hearing', meaning: 'Nothing reaches him until he can hear.' },
    { role: 'risk', quote: 'The unit is noisy and busy', meaning: 'Noise can drown out even working hearing aids.' },
  ],
  first_thinking: ['Can Mr. Lee hear you right now, before any teaching?', 'So check his hearing aids first.'],
  items: [
    { position: 1, rung: 0, rule: 'barrier_first', label: 'Can he hear you?', why_here: 'Hearing aids come first: without sound, nothing else reaches him.', nudge: '' },
    { position: 2, rung: 1, rule: 'barrier_first', label: 'Is the room quiet?', why_here: 'A quieter room cuts the noise that blocks his hearing.', nudge: 'Before you move him, can he hear you at all?' },
    { position: 3, rung: 2, rule: 'sequence', label: 'Who can translate?', why_here: 'An interpreter helps with words once he can hear.', nudge: 'An interpreter helps with words. Can he hear them over the announcements?' },
    { position: 4, rung: 3, rule: 'teach_last', label: 'Written copy', why_here: 'Written teaching backs up the spoken words.', nudge: 'Has any teaching happened yet?' },
    { position: 5, rung: 4, rule: 'sequence', label: 'Did he understand?', why_here: 'Teach-back comes last: it checks what you taught.', nudge: 'Check only after you teach.' },
  ],
  method_line: 'Climb the ladder: remove barriers, teach, then check.',
};

const flush = () => act(() => { jest.runAllTimers(); });
const row = (text) => screen.getByText(text).closest('.ow-item');

beforeEach(() => {
  jest.useFakeTimers();
  clarityEvent.mockClear();
});
afterEach(() => jest.useRealTimers());

const renderIt = (onClose = jest.fn()) => render(
  <OrderWalkthrough question={QUESTION} chart={CHART} items={ITEMS} keyIds={KEY} herOrder={HERS}
    walkthrough={DATA} onClose={onClose} />
);

it('breaks the chart down, labels the actions, then climbs the ladder with her', () => {
  const onClose = jest.fn();
  renderIt(onClose);
  expect(clarityEvent).toHaveBeenCalledWith('order_walkthrough_opened');
  expect(screen.getByText(/Ordering questions are hard/)).toBeInTheDocument();

  // 1. The chart: each deciding detail lit and explained, in turn.
  fireEvent.click(screen.getByText('Start with the chart'));
  expect(screen.getByText('Reading the chart…')).toBeInTheDocument();
  expect(screen.queryByText('Look at the actions')).toBeNull();
  flush();
  expect([...document.querySelectorAll('mark.ow-fact.is-lit')].map((m) => m.textContent))
    .toEqual(['1He is hard of hearing', '2The unit is noisy and busy']);
  expect(screen.getByText('Nothing reaches him until he can hear.')).toBeInTheDocument();

  // 2. What each action does, then the ladder.
  fireEvent.click(screen.getByText('Look at the actions'));
  flush();
  expect(screen.getByText('Is the room quiet?')).toBeInTheDocument();
  expect(screen.getByText('What blocks the message, first to last')).toBeInTheDocument();
  expect(screen.getByText('Hear')).toBeInTheDocument();

  // 3. Watch: the tutor thinks out loud and places number 1.
  fireEvent.click(screen.getByText('Watch me find number 1'));
  expect(screen.queryByText('Rule: remove what blocks the message first')).toBeNull();
  flush();
  expect(within(row("Ensure Mr. Lee's hearing aids are in place and working")).getByText('1')).toBeInTheDocument();
  expect(screen.getByText('Hearing aids come first: without sound, nothing else reaches him.')).toBeInTheDocument();
  expect(screen.getByText('Now you, with me. What comes next?')).toBeInTheDocument();

  // 4. Together: her real mistake, the interpreter too early, gets a nudge, not a red mark.
  fireEvent.click(row('Arrange for a certified medical interpreter'));
  expect(screen.getByText('Not yet. Take another look.')).toBeInTheDocument();
  expect(screen.getByText('An interpreter helps with words. Can he hear them over the announcements?')).toBeInTheDocument();
  expect(within(row('Arrange for a certified medical interpreter')).queryByText('2')).toBeNull();
  fireEvent.click(row('Move Mr. Lee to a quieter area and reduce background noise'));
  expect(screen.getByText('A quieter room cuts the noise that blocks his hearing.')).toBeInTheDocument();
  flush();

  // 5. Your turn: the rest in order; the last one places itself.
  fireEvent.click(row('Arrange for a certified medical interpreter'));
  flush();
  fireEvent.click(row('Provide written instructions in both English and Mandarin'));
  flush();
  expect(within(row('Use teach-back technique to confirm understanding')).getByText('5')).toBeInTheDocument();
  expect(clarityEvent).toHaveBeenCalledWith('order_walkthrough_completed');

  // 6. The end names what she did earlier and why, once.
  expect(screen.getByText('2 of 3 on the first try. The ladder gets quicker every time you use it.')).toBeInTheDocument();
  expect(screen.getByText(/You had “Arrange for a certified medical interpreter” at number 2\./)).toBeInTheDocument();
  expect(screen.getByText(/A quieter room cuts the noise/, { selector: '.ow-then' })).toBeInTheDocument();
  expect(screen.getByText('Climb the ladder: remove barriers, teach, then check.')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Back to the question'));
  expect(onClose).toHaveBeenCalled();
});

it('can be closed at any point', () => {
  const onClose = jest.fn();
  renderIt(onClose);
  fireEvent.click(screen.getByLabelText('Close the walkthrough'));
  expect(onClose).toHaveBeenCalled();
});

it('does not take taps while the tutor is placing number 1', () => {
  renderIt();
  fireEvent.click(screen.getByText('Start with the chart')); flush();
  fireEvent.click(screen.getByText('Look at the actions')); flush();
  fireEvent.click(screen.getByText('Watch me find number 1'));
  // Rows are not buttons during the demonstration.
  expect(row('Move Mr. Lee to a quieter area and reduce background noise').tagName).toBe('DIV');
});
