import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import LandingCaseRun from './LandingCaseRun';
import { LANDING_CASES } from './landingCases';
import { trackSeo, readLocal } from '../../Services/SeoMiniProductService';
import { fetchOrderWalkthrough, fetchQuizWalkthrough } from '../../Services/FastAPICalls';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), Link: ({ children }) => <a href="/">{children}</a> }), { virtual: true });
jest.mock('../Glossary/useGlossary', () => () => ({ rationaleRef: { current: null }, rationaleHandlers: {}, popover: null }));
jest.mock('../../Services/ClarityService', () => ({ clarityEvent: jest.fn() }));
jest.mock('../../Services/FastAPICalls', () => ({ fetchOrderWalkthrough: jest.fn(), fetchQuizWalkthrough: jest.fn() }));
jest.mock('../../Services/SeoMiniProductService', () => ({
  trackSeo: jest.fn(),
  readLocal: jest.fn(),
  writeLocal: jest.fn(),
  continueSeo: jest.fn(),
  loadSavedProduct: jest.fn(),
  fetchResultNote: jest.fn(),
}));

// The cards ignore a second tap within 350 ms, and tests tap faster than a person.
let fakeNow = 0;
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Date, 'now').mockImplementation(() => (fakeNow += 1000));
  trackSeo.mockClear();
  fetchOrderWalkthrough.mockClear();
  fetchQuizWalkthrough.mockClear();
  readLocal.mockReturnValue(null);
});
afterEach(() => {
  Date.now.mockRestore?.();
  jest.useRealTimers();
});

const settle = () => act(async () => { jest.advanceTimersByTime(600); });

const answerSata = async () => {
  LANDING_CASES[0].quiz.answer.forEach((text) => fireEvent.click(screen.getByText(text)));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit/i })); });
  await settle();
};

const placeInOrder = async (step, ids) => {
  ids.forEach((id) => {
    fireEvent.click(screen.getByText(step.quiz.options.find((o) => o.id === id).text));
  });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit Order' })); });
  await settle();
};

const keyOf = (step) => step.quiz.correctOrder.map((k) => k.id);
const next = async (name = /Next question/i) => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
  await settle();
};

test('the select-all offers its walkthrough even after a right answer', async () => {
  render(<LandingCaseRun />);
  await answerSata();
  expect(screen.getByText('Watch how to solve it')).toBeInTheDocument();
  expect(fetchQuizWalkthrough).not.toHaveBeenCalled();
});

test('a right order still offers the walkthrough, with no backend call', async () => {
  render(<LandingCaseRun />);
  await answerSata();
  await next();
  await placeInOrder(LANDING_CASES[1], keyOf(LANDING_CASES[1]));
  expect(screen.getByText('Watch how to order it')).toBeInTheDocument();
  expect(fetchOrderWalkthrough).not.toHaveBeenCalled();
});

test('the walkthrough plays on the stored case', async () => {
  render(<LandingCaseRun />);
  await answerSata();
  await next();
  await placeInOrder(LANDING_CASES[1], [...keyOf(LANDING_CASES[1])].reverse());
  await act(async () => { fireEvent.click(screen.getByText('Watch how to order it')); });
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(screen.getByText('Signs of low blood sugar are present right now.')).toBeInTheDocument();
  expect(fetchOrderWalkthrough).not.toHaveBeenCalled();
});

test('the end screen reports each step and offers the signup', async () => {
  render(<LandingCaseRun />);
  await answerSata();
  await next();
  await placeInOrder(LANDING_CASES[1], keyOf(LANDING_CASES[1]));
  await next();
  await placeInOrder(LANDING_CASES[2], [...keyOf(LANDING_CASES[2])].reverse());
  await next(/view results/i);
  expect(screen.getByText('You just practiced what the exam asks.')).toBeInTheDocument();
  expect(screen.getByText('0 of 4 in the right place')).toBeInTheDocument();
  expect(screen.getAllByText('All right')).toHaveLength(2);
  expect(screen.getByRole('button', { name: /Save my progress free/ })).toBeEnabled();
  const steps = trackSeo.mock.calls.map(([step]) => step);
  expect(steps.filter((s) => s === 'landing_case_answered')).toHaveLength(3);
  expect(steps).toContain('landing_cases_completed');
});
