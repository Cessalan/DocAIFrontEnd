import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import CaseStudyQuestion from './CaseStudyQuestion';

jest.mock('../Glossary/useGlossary', () => () => ({ rationaleRef: { current: null }, rationaleHandlers: {}, popover: null }));
jest.mock('../../Services/ClarityService', () => ({ clarityEvent: jest.fn() }));
jest.mock('../../Services/FastAPICalls', () => ({ fetchOrderWalkthrough: jest.fn() }));
const { fetchOrderWalkthrough } = require('../../Services/FastAPICalls');

const quiz = {
  question: 'Place the actions in order of priority.',
  options: [{ id: 'c', text: 'Notify the provider' }, { id: 'a', text: 'Assess vital signs' }, { id: 'b', text: 'Give oxygen as ordered' }],
  correctOrder: [{ id: 'a', text: 'Assess vital signs' }, { id: 'b', text: 'Give oxygen as ordered' }, { id: 'c', text: 'Notify the provider' }],
  caseStudy: { nursesNotes: '<p>New <strong>dizziness</strong> and an irregular pulse.</p>' },
  justification: 'Assess, then act, then report.',
};
const WALK = {
  ladder: 'process',
  breakdown: [{ role: 'problem', quote: 'New dizziness', meaning: 'Something changed.' }],
  first_thinking: ['Is the patient stable?', 'So assess first.'],
  items: [
    { position: 1, rung: 0, rule: 'assess_first', label: 'Is it stable?', why_here: 'Assess first.', nudge: '' },
    { position: 2, rung: 1, rule: 'sequence', label: 'Helps now', why_here: 'Act before you call.', nudge: 'Can you help first?' },
    { position: 3, rung: 2, rule: 'sequence', label: 'Gets orders', why_here: 'Call with findings.', nudge: 'What will you report?' },
  ],
  method_line: null,
};

const submitWrong = async () => {
  render(<CaseStudyQuestion quiz={quiz} onAnswerSelect={() => {}} onNext={() => {}} />);
  // Tap to order, deliberately wrong: notify before assessing.
  ['Notify the provider', 'Assess vital signs', 'Give oxygen as ordered'].forEach((text) => fireEvent.click(screen.getByText(text)));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit Order' })); });
  await act(async () => { jest.advanceTimersByTime(400); });
};

beforeEach(() => {
  jest.useFakeTimers();
  fetchOrderWalkthrough.mockReset();
});
afterEach(() => jest.useRealTimers());

// Each tap a second apart: the card ignores a second tap within 350 ms (rows
// move under the finger after a tap), and tests tap faster than any person.
let fakeNow = 0;
beforeEach(() => { jest.spyOn(Date, 'now').mockImplementation(() => (fakeNow += 1000)); });
afterEach(() => { Date.now.mockRestore?.(); });

it('sends the key in order and the chart as plain text', async () => {
  fetchOrderWalkthrough.mockResolvedValue(WALK);
  await submitWrong();
  expect(fetchOrderWalkthrough).toHaveBeenCalledWith(expect.objectContaining({
    question: 'Place the actions in order of priority.',
    chart: 'New dizziness and an irregular pulse.',
    items: ['Assess vital signs', 'Give oxygen as ordered', 'Notify the provider'],
  }));
});

it('never offers a walkthrough the backend declined', async () => {
  fetchOrderWalkthrough.mockResolvedValue(null);
  await submitWrong();
  expect(screen.queryByText('Watch how to order it')).toBeNull();
  // The explanation is still there.
  expect(screen.getByText('Assess, then act, then report.')).toBeInTheDocument();
});

it('opens on the whole card and gives the card back when closed', async () => {
  fetchOrderWalkthrough.mockResolvedValue(WALK);
  await submitWrong();
  await act(async () => { fireEvent.click(screen.getByText('Watch how to order it')); });
  expect(screen.getByText('Reading the chart…')).toBeInTheDocument();
  // Moving on doesn't wait for the walkthrough to finish.
  expect(screen.getByRole('button', { name: /Next question/i })).toBeInTheDocument();
  expect(screen.queryByText('Assess, then act, then report.')).toBeNull();
  fireEvent.click(screen.getByLabelText('Close the walkthrough'));
  expect(screen.getByText('Assess, then act, then report.')).toBeInTheDocument();
  expect(screen.getByText('Watch how to order it')).toBeInTheDocument();
});

it('ends on Next question, so finishing the walkthrough moves her on', async () => {
  fetchOrderWalkthrough.mockResolvedValue(WALK);
  const next = jest.fn();
  render(<CaseStudyQuestion quiz={quiz} onAnswerSelect={() => {}} onNext={next} />);
  ['Notify the provider', 'Assess vital signs', 'Give oxygen as ordered'].forEach((text) => fireEvent.click(screen.getByText(text)));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit Order' })); });
  await act(async () => { jest.advanceTimersByTime(400); });
  await act(async () => { fireEvent.click(screen.getByText('Watch how to order it')); });
  // It plays to the end by itself.
  for (let i = 0; i < 8; i += 1) await act(async () => { jest.advanceTimersByTime(20000); });
  fireEvent.click(screen.getByRole('button', { name: /Next Question/i }));
  expect(next).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Back to the question' })).toBeInTheDocument();
});

it('shows the rule for her first slip on the card, without opening anything', async () => {
  fetchOrderWalkthrough.mockResolvedValue(WALK);
  await submitWrong();
  // She put "Notify the provider" first; assessing belongs there.
  expect(screen.getByText('Rule: assess before you act')).toBeInTheDocument();
  expect(screen.getByText('Assess first.')).toBeInTheDocument();
  expect(screen.queryByText('Reading the chart…')).toBeNull();
});

it('no longer opens the replay on its own after a miss', async () => {
  fetchOrderWalkthrough.mockResolvedValue(WALK);
  await submitWrong();
  expect(screen.queryByText('Building your walkthrough')).toBeNull();
  expect(screen.getByText('Watch how to order it')).toBeInTheDocument();
});
