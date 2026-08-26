import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../i18n/i18n';
import { UsageProvider, useUsageLimit } from './UsageContext';

/**
 * Covers the dev-only paywall preview: clicking the simulator must produce the
 * BLOCKED FREE-USER modal — not the softer proactive pitch, and not the
 * manage-subscription branch when the dev's own account is Pro — without
 * spending or mutating real quota, and must do nothing outside a dev build.
 */

// Tier the fake account reports. Mutable so one test can be Pro.
let mockTier = 'free';

jest.mock('../AuthContext/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'dev-uid', email: 'dev@example.com' }, userProfile: {} }),
}));

// Plain functions, not jest.fn: CRA's jest config sets resetMocks, which would
// strip a jest.fn implementation before each test and return undefined.
jest.mock('../../Services/UsageService', () => ({
  ...jest.requireActual('../../Services/UsageService'),
  getQuota: async () => ({ tier: mockTier, windowStart: Date.now(), used: 12 }),
  getPlanQuota: async () => ({ windowStart: Date.now(), used: 1 }),
}));

const Harness = () => {
  const { simulateLimit, remaining, used, tier } = useUsageLimit();
  return (
    <>
      <span data-testid="tier">{tier}</span>
      <span data-testid="used">{String(used)}</span>
      <span data-testid="remaining">{String(remaining)}</span>
      <button onClick={() => simulateLimit('questions', { topic: 'Cardiac Pharmacology' })}>sim-q</button>
      <button onClick={() => simulateLimit('plans')}>sim-p</button>
    </>
  );
};

// Wait out the async quota fetch so state has settled before asserting. Keyed
// on `used` (0 → 12) rather than tier, because tier starts at 'free' and so a
// free-account wait would pass instantly and race the fetch.
const renderHarness = async () => {
  render(<UsageProvider><Harness /></UsageProvider>);
  await waitFor(() => expect(screen.getByTestId('used')).toHaveTextContent('12'));
  expect(screen.getByTestId('tier')).toHaveTextContent(mockTier);
};

describe('simulateLimit (dev paywall preview)', () => {
  // simulateLimit reads NODE_ENV at call time, and jest runs as 'test'.
  const realEnv = process.env.NODE_ENV;
  beforeEach(() => { process.env.NODE_ENV = 'development'; mockTier = 'free'; });
  afterEach(() => { process.env.NODE_ENV = realEnv; });

  test('opens the question paywall in its blocked state, with the topic', async () => {
    await renderHarness();
    expect(screen.queryByText(/Don't stop now/)).toBeNull();

    fireEvent.click(screen.getByText('sim-q'));

    expect(screen.getByText(/Don't stop now/)).toBeInTheDocument();
    expect(screen.getByText('Cardiac Pharmacology')).toBeInTheDocument();
    expect(screen.getByText('Continue studying with Pro')).toBeInTheDocument();
    expect(screen.getByText(/Continue free in/)).toBeInTheDocument();
  });

  test('opens the plan paywall with its own pitch', async () => {
    await renderHarness();
    fireEvent.click(screen.getByText('sim-p'));

    expect(screen.getByText(/more exams to prepare for/)).toBeInTheDocument();
    expect(screen.getByText('Unlock every plan with Pro')).toBeInTheDocument();
  });

  test('shows the free-user pitch even when the signed-in account is Pro', async () => {
    mockTier = 'pro';
    await renderHarness();

    fireEvent.click(screen.getByText('sim-q'));

    expect(screen.getByText(/Don't stop now/)).toBeInTheDocument();
    expect(screen.getByText('Continue studying with Pro')).toBeInTheDocument();
    // The real manage/cancel branch must not leak into the preview.
    expect(screen.queryByText(/You're on Pro/)).toBeNull();
    expect(screen.queryByText('Manage subscription')).toBeNull();
  });

  test('leaves the real quota untouched', async () => {
    await renderHarness();
    const before = screen.getByTestId('remaining').textContent;
    fireEvent.click(screen.getByText('sim-q'));
    expect(screen.getByTestId('remaining').textContent).toBe(before);
  });

  test('is inert outside development builds', async () => {
    process.env.NODE_ENV = 'production';
    await renderHarness();
    fireEvent.click(screen.getByText('sim-q'));
    expect(screen.queryByText(/Don't stop now/)).toBeNull();
  });
});
