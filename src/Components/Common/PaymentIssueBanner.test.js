import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentIssueBanner from './PaymentIssueBanner';
import { openBillingPortal } from '../../config/billing';
import { logFunnelStep } from '../../Services/FunnelService';

jest.mock('../../config/billing', () => ({ openBillingPortal: jest.fn(() => Promise.resolve(true)) }));
jest.mock('../../Services/FunnelService', () => ({
  logFunnelStep: jest.fn(), logFunnelStepOnce: jest.fn(),
  FUNNEL: { PAYMENT_ISSUE_SHOWN: 'payment_issue_shown', PAYMENT_ISSUE_CLICKED: 'payment_issue_clicked' },
}));

const issue = (over = {}) => ({ invoiceUrl: 'https://invoice.stripe.com/i/abc', nextAttemptAt: null, key: 'sub_1:1', ...over });

beforeEach(() => { sessionStorage.clear(); jest.clearAllMocks(); });

it('opens the hosted invoice in a new tab', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  render(<PaymentIssueBanner issue={issue()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Update card' }));
  expect(open).toHaveBeenCalledWith('https://invoice.stripe.com/i/abc', '_blank', 'noopener,noreferrer');
  expect(openBillingPortal).not.toHaveBeenCalled();
  expect(logFunnelStep).toHaveBeenCalledWith('payment_issue_clicked', { target: 'invoice' });
  open.mockRestore();
});

it('falls back to the billing portal without a safe invoice link', async () => {
  render(<PaymentIssueBanner issue={issue({ invoiceUrl: null })} />);
  fireEvent.click(screen.getByRole('button', { name: 'Update card' }));
  await waitFor(() => expect(openBillingPortal).toHaveBeenCalled());
});

it('names the next retry when there is one', () => {
  render(<PaymentIssueBanner issue={issue({ nextAttemptAt: Date.now() + 86400000 })} />);
  expect(screen.getByText(/Stripe tries again on/)).toBeInTheDocument();
});

it('"Later" hides it for this session and for this failure only', () => {
  const { unmount } = render(<PaymentIssueBanner issue={issue()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Later' }));
  expect(screen.queryByRole('status')).toBeNull();
  unmount();
  render(<PaymentIssueBanner issue={issue()} />);
  expect(screen.queryByRole('status')).toBeNull();
  render(<PaymentIssueBanner issue={issue({ key: 'sub_1:2' })} />);
  expect(screen.getByRole('status')).toBeInTheDocument();
});
