import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../i18n/i18n';
import { UsageProvider, useUsageLimit } from './UsageContext';

/**
 * Paywall view counter.
 *
 * The product could see that ~14 people ever reached Stripe, but not how many
 * were ever ASKED — and those two numbers imply opposite fixes. These tests
 * pin the properties that make the resulting count worth acting on:
 *
 *   - every route to the modal is counted (the point of instrumenting the
 *     chokepoint rather than each call site)
 *   - a WALL and a voluntary BROWSE are distinguishable
 *   - the same open is not counted twice
 *   - a Pro user's billing screen is not counted as a paywall at all
 */

let mockTier = 'free';
let mockUsed = 12;
let mockPlansUsed = 1;

jest.mock('../AuthContext/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'u1', email: 'u@example.com' },
    userProfile: { onboarding: { studyGoal: 'NCLEX Prep' } },
  }),
}));

jest.mock('../../Services/UsageService', () => ({
  ...jest.requireActual('../../Services/UsageService'),
  getQuota: async () => ({ tier: mockTier, windowStart: Date.now(), used: mockUsed }),
  getPlanQuota: async () => ({ windowStart: Date.now(), used: mockPlansUsed }),
}));

const rows = [];
jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: { PAYWALL_VIEWED: 'paywall_viewed', PAYWALL_DISMISSED: 'paywall_dismissed' },
  logPaywall: (reason, reachedStep, props) =>
    rows.push({ step: 'paywall_viewed', reason, reachedStep, ...props }),
  logFunnelStep: (step, props) => rows.push({ step, ...props }),
}));

const Harness = () => {
  const { requireQuota, requirePlanQuota, openUpgrade, remaining, plansRemaining, tier } = useUsageLimit();
  return (
    <>
      {/* The gates read live quota, which arrives from an async fetch. Tests
          must wait for it or they exercise the pre-fetch default state. */}
      <span data-testid="ready">{`${tier}:${remaining}:${plansRemaining}`}</span>
      <button onClick={() => requireQuota({ topic: 'Cardiac Pharmacology' })}>gen</button>
      <button onClick={() => requirePlanQuota()}>plan</button>
      <button onClick={() => openUpgrade(null, { trigger: 'upload_gate', topic: 'Deck 2' })}>upload</button>
      <button onClick={() => openUpgrade(null, { trigger: 'account_menu' })}>menu</button>
    </>
  );
};

/** Render and block until the mocked quota has actually landed in context. */
const setup = async (expected) => {
  rows.length = 0;
  render(<UsageProvider><Harness /></UsageProvider>);
  await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent(expected));
};

const views = () => rows.filter(r => r.step === 'paywall_viewed');

describe('paywall view counter', () => {
  beforeEach(() => { mockTier = 'free'; mockUsed = 12; mockPlansUsed = 1; });

  it('records a view when the question throttle blocks', async () => {
    mockUsed = 9999; // out of budget
    await setup('free:0:2');
    fireEvent.click(screen.getByText('gen'));
    await waitFor(() => expect(views()).toHaveLength(1));
    expect(views()[0]).toMatchObject({ trigger: 'question_throttle', reason: 'questions' });
  });

  it('records a view when the plan quota blocks', async () => {
    mockPlansUsed = 99;
    await setup('free:58:0');
    fireEvent.click(screen.getByText('plan'));
    await waitFor(() => expect(views()).toHaveLength(1));
    expect(views()[0]).toMatchObject({ trigger: 'plan_quota', reason: 'plans' });
  });

  describe('a wall and a browse must not look the same', () => {
    it('separates the upload gate from a voluntary open', async () => {
      // Both call openUpgrade(null, …). Before `trigger` existed these were
      // indistinguishable, so any conversion rate mixed a hard block with
      // someone volunteering to buy.
      await setup('free:58:2');
      fireEvent.click(screen.getByText('upload'));
      await waitFor(() => expect(views()).toHaveLength(1));
      expect(views()[0].trigger).toBe('upload_gate');
    });

    it('marks a voluntary open as not blocked', async () => {
      mockUsed = 12; // plenty of budget left
      await setup('free:58:2');
      fireEvent.click(screen.getByText('menu'));
      await waitFor(() => expect(views()).toHaveLength(1));
      expect(views()[0].trigger).toBe('account_menu');
      expect(views()[0].blocked).toBe(false);
    });

    it('marks a real wall as blocked', async () => {
      mockUsed = 9999;
      await setup('free:0:2');
      fireEvent.click(screen.getByText('gen'));
      await waitFor(() => expect(views()).toHaveLength(1));
      expect(views()[0].blocked).toBe(true);
    });
  });

  it('captures the context needed to act on a row', async () => {
    mockUsed = 9999;
    await setup('free:0:2');
    fireEvent.click(screen.getByText('gen'));
    await waitFor(() => expect(views()).toHaveLength(1));
    const row = views()[0];
    // who / what state / what they were doing
    expect(row).toHaveProperty('tier', 'free');
    expect(row).toHaveProperty('questionsRemaining');
    expect(row).toHaveProperty('plansRemaining');
    expect(row).toHaveProperty('studyGoal', 'NCLEX Prep');
    expect(row).toHaveProperty('topic', 'Cardiac Pharmacology');
    expect(row).toHaveProperty('path');
  });

  it('counts one view per open, not one per blocked attempt', async () => {
    // Two generate attempts against an already-open paywall is one ask.
    mockUsed = 9999;
    await setup('free:0:2');
    fireEvent.click(screen.getByText('gen'));
    fireEvent.click(screen.getByText('gen'));
    await waitFor(() => expect(views()).toHaveLength(1));
  });

  it('does not count a Pro user opening the billing screen', async () => {
    // Pro sees manage-subscription. Counting it would pollute every rate
    // computed from this collection.
    mockTier = 'pro';
    await setup('pro:Infinity:Infinity');
    fireEvent.click(screen.getByText('menu'));
    await new Promise(r => setTimeout(r, 0));
    expect(views()).toHaveLength(0);
  });
});
