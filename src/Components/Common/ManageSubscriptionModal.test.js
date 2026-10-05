import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ManageSubscriptionModal from './ManageSubscriptionModal';
import { recordSignal } from '../../Services/SatisfactionService';
import { openBillingPortal } from '../../config/billing';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => fallback || key, i18n: { language: 'en' } })
}));
jest.mock('../../config/billing', () => ({ openBillingPortal: jest.fn(() => Promise.resolve(true)) }));
jest.mock('../../Services/SatisfactionService', () => ({
  SURFACE: { CANCELLATION: 'cancellation' },
  recordSignal: jest.fn()
}));

const open = () => render(<ManageSubscriptionModal isOpen onClose={() => {}} />);
const toSurvey = () => fireEvent.click(screen.getByText('Cancel my subscription'));

beforeEach(() => {
  jest.clearAllMocks();
  recordSignal.mockImplementation(({ signalId }) =>
    Promise.resolve({ success: true, signalId: signalId || 'sig1' }));
});

test('updating a card goes straight to Stripe with no survey row', async () => {
  open();
  fireEvent.click(screen.getByText('Update card or switch plan'));
  await waitFor(() => expect(openBillingPortal).toHaveBeenCalled());
  expect(recordSignal).not.toHaveBeenCalled();
});

test('continue is disabled until a reason is picked', () => {
  open();
  toSurvey();
  expect(screen.getByText('Continue to cancel')).toBeDisabled();
  fireEvent.click(screen.getByText('cancelSurvey.reasons.too_expensive'));
  expect(screen.getByText('Continue to cancel')).not.toBeDisabled();
});

test('only exam done asks how it went', () => {
  open();
  toSurvey();
  fireEvent.click(screen.getByText('cancelSurvey.reasons.not_helping'));
  expect(screen.queryByText('How did it go?')).toBeNull();
  fireEvent.click(screen.getByText('cancelSurvey.reasons.exam_done'));
  expect(screen.getByText('How did it go?')).toBeInTheDocument();
});

test('fast taps create one row and refine it', async () => {
  open();
  toSurvey();
  fireEvent.click(screen.getByText('cancelSurvey.reasons.exam_done'));
  fireEvent.click(screen.getByText('cancelSurvey.outcomes.passed'));
  fireEvent.click(screen.getByText('cancelSurvey.reasons.too_expensive'));
  await waitFor(() => expect(recordSignal).toHaveBeenCalledTimes(3));
  const calls = recordSignal.mock.calls.map(([arg]) => arg);
  expect(calls[0].signalId).toBeUndefined();
  expect(calls[1].signalId).toBe('sig1');
  expect(calls[2].signalId).toBe('sig1');
  // Switching away from "exam done" drops the outcome she gave for it.
  expect(calls[2].reasons).toEqual(['too_expensive']);
  expect(calls[2].context.examOutcome).toBeNull();
});

test('continuing writes the final answers before going to Stripe', async () => {
  open();
  toSurvey();
  fireEvent.click(screen.getByText('cancelSurvey.reasons.not_helping'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'harder SATA' } });
  fireEvent.click(screen.getByText('Continue to cancel'));
  await waitFor(() => expect(openBillingPortal).toHaveBeenCalled());
  const last = recordSignal.mock.calls[recordSignal.mock.calls.length - 1][0];
  expect(last.comment).toBe('harder SATA');
  expect(last.sentiment).toBe(-1);
  expect(last.context.continuedToPortal).toBe(true);
});
