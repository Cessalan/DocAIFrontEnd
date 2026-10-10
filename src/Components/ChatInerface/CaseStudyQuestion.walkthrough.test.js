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
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit Order' })); });
  await act(async () => { jest.advanceTimersByTime(400); });
};

beforeEach(() => {
  jest.useFakeTimers();
  fetchOrderWalkthrough.mockReset();
  // Auto-open already used on this "device", so the button is the way in.
  window.localStorage.setItem('nqOrderWalkthroughAutoOpened', '2');
});
afterEach(() => {
  jest.useRealTimers();
  window.localStorage.clear();
});

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
  expect(screen.queryByText('Show me how to order it')).toBeNull();
  // The explanation is still there.
  expect(screen.getByText('Assess, then act, then report.')).toBeInTheDocument();
});

it('opens on the whole card and gives the card back when closed', async () => {
  fetchOrderWalkthrough.mockResolvedValue(WALK);
  await submitWrong();
  await act(async () => { fireEvent.click(screen.getByText('Show me how to order it')); });
  expect(screen.getByText(/Ordering questions are hard/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Next question/i })).toBeNull();
  expect(screen.queryByText('Assess, then act, then report.')).toBeNull();
  fireEvent.click(screen.getByLabelText('Close the walkthrough'));
  expect(screen.getByText('Assess, then act, then report.')).toBeInTheDocument();
  expect(screen.getByText('Show me how to order it')).toBeInTheDocument();
});

it('auto-opens on a first miss, and closes quietly if the backend declines', async () => {
  window.localStorage.clear();
  let resolve;
  fetchOrderWalkthrough.mockReturnValue(new Promise((r) => { resolve = r; }));
  await submitWrong();
  expect(screen.getByText('Reading the chart…')).toBeInTheDocument();
  await act(async () => { resolve(null); });
  expect(screen.queryByText('Reading the chart…')).toBeNull();
  expect(screen.queryByText(/There's no walkthrough/)).toBeNull();
  expect(screen.queryByText('Show me how to order it')).toBeNull();
});
