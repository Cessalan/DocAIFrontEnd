import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '../../i18n/i18n';
import StartStudyModal from './StartStudyModal';
import { start_study_journey, plan_study_path } from '../../Services/FastAPICalls';
import { waitForQuickCheckSave, createStudySession } from '../../Services/StudySessionService';

jest.mock('../../Services/FastAPICalls', () => ({
  plan_study_path: jest.fn(),
  start_study_journey: jest.fn(),
  clear_in_flight_study_journey: jest.fn(),
  get_prefetched_node_content: jest.fn(),
  subscribe_study_thinking: jest.fn(() => () => {}),
}));
jest.mock('../../Services/StudySessionService', () => ({ createStudySession: jest.fn(), waitForQuickCheckSave: jest.fn() }));
jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: { PLAN_PREVIEW_VIEWED: 'plan_preview_viewed', PAYWALL_CTA_CLICKED: 'paywall_cta_clicked',
    WEAKNESS_INSIGHT_VIEWED: 'weakness_insight_viewed', PLAN_STARTED: 'plan_started' },
  logFunnelStep: jest.fn(),
  logFunnelStepOnce: jest.fn(),
  logPaywall: jest.fn(),
}));
jest.mock('../QuizRoom/BrainMascot', () => () => null);
jest.mock('../QuizRoom/BookMascot', () => () => null);
jest.mock('../QuizRoom/PillMascot', () => () => null);
jest.mock('../QuizRoom/CoffeeCupMascot', () => () => null);
jest.mock('../QuizRoom/MatchaCupMascot', () => () => null);

let mockUsage;
jest.mock('../../Contexts/UsageContext/UsageContext', () => ({
  useUsageLimit: () => mockUsage,
}));

const props = {
  isOpen: true,
  autoStart: true,
  onClose: () => {},
  onStart: () => {},
  chatId: 'c1',
  uploadedDocs: [{ id: 'd1' }],
  topics: ['Cardiac'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUsage = {
    canCreatePlan: true,
    requirePlanQuota: jest.fn(() => true),
    consumePlan: jest.fn(),
    openUpgrade: jest.fn(),
    refresh: jest.fn(),
  };
});

describe('an accepted quick-check plan opens the first activity', () => {
  const path = { nodes: [{ id: 'lesson-1', type: 'lesson', label: 'Cardiac', status: 'todo' }], archetype: 'focus' };
  const state = { path, activeNodeId: 'lesson-1' };

  test('commits once and hands off immediately without another confirmation', async () => {
    const onStart = jest.fn();
    start_study_journey.mockReturnValue({ planPromise: Promise.resolve(path) });
    createStudySession.mockResolvedValue(state);
    render(<StartStudyModal {...props} startImmediately onStart={onStart} />);
    await act(async () => { await Promise.resolve(); });
    expect(createStudySession).toHaveBeenCalledTimes(1);
    expect(createStudySession).toHaveBeenCalledWith('c1', path, ['d1']);
    expect(mockUsage.requirePlanQuota).toHaveBeenCalledTimes(1);
    expect(mockUsage.consumePlan).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(state);
    expect(screen.queryByText('Start my first activity')).toBeNull();
  });

  test('also starts immediately when generation uses the fallback', async () => {
    start_study_journey.mockReturnValue({ planPromise: Promise.reject(new Error('stream interrupted')) });
    plan_study_path.mockResolvedValue(path);
    createStudySession.mockResolvedValue(state);
    const onStart = jest.fn();
    render(<StartStudyModal {...props} startImmediately onStart={onStart} />);
    await act(async () => { await Promise.resolve(); });
    expect(onStart).toHaveBeenCalledWith(state);
    expect(createStudySession).toHaveBeenCalledTimes(1);
  });

  test('does not create a session if the student closes while generation is running', async () => {
    let finish;
    start_study_journey.mockReturnValue({ planPromise: new Promise(resolve => { finish = resolve; }) });
    const onStart = jest.fn();
    render(<StartStudyModal {...props} startImmediately onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await act(async () => { finish(path); });
    expect(createStudySession).not.toHaveBeenCalled();
    expect(mockUsage.consumePlan).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });

  test('rechecks the plan allowance before committing an accepted plan', async () => {
    start_study_journey.mockReturnValue({ planPromise: Promise.resolve(path) });
    mockUsage.requirePlanQuota.mockReturnValue(false);
    render(<StartStudyModal {...props} startImmediately />);
    await act(async () => { await Promise.resolve(); });
    expect(createStudySession).not.toHaveBeenCalled();
    expect(mockUsage.consumePlan).not.toHaveBeenCalled();
    expect(await screen.findByText('Get my full plan with Pro')).toBeInTheDocument();
  });
});

describe('StartStudyModal — the locked verdict button', () => {
  test('waits for the saved check before requesting a plan with its reference', async () => {
    let finishSave;
    waitForQuickCheckSave.mockReturnValue(new Promise(resolve => { finishSave = resolve; }));
    start_study_journey.mockReturnValue({ planPromise: new Promise(() => {}) });
    render(<StartStudyModal {...props} readiness={{ answers: [{ checkId: 'check-1' }] }} />);
    expect(waitForQuickCheckSave).toHaveBeenCalledWith('check-1');
    expect(start_study_journey).not.toHaveBeenCalled();
    await act(async () => { finishSave(); });
    expect(start_study_journey).toHaveBeenCalledWith('c1', ['d1'], {}, 'en', null,
      expect.objectContaining({ quickCheckId: 'check-1' }));
  });
  test('after the server refuses the plan, the button offers the upgrade instead of silently retrying', async () => {
    // The tab thinks she can plan (a plan was started on another device, or —
    // in dev — this is someone else's chat); the server knows she cannot.
    const refused = Object.assign(new Error('quota'), { code: 'plan_quota_exceeded' });
    start_study_journey.mockImplementation(() => ({ planPromise: Promise.reject(refused) }));

    render(<StartStudyModal {...props} />);
    const cta = await screen.findByText('Get my full plan with Pro');
    expect(mockUsage.refresh).toHaveBeenCalled();

    fireEvent.click(cta);
    expect(start_study_journey).toHaveBeenCalledTimes(1);
    expect(mockUsage.openUpgrade).toHaveBeenCalledWith('plan_ready', expect.objectContaining({ trigger: 'plan_ready' }));
  });

  test('a student blocked on this device is offered the upgrade, and nothing is generated', async () => {
    mockUsage.canCreatePlan = false;
    render(<StartStudyModal {...props} />);
    fireEvent.click(await screen.findByText('Get my full plan with Pro'));
    expect(start_study_journey).not.toHaveBeenCalled();
    expect(mockUsage.openUpgrade).toHaveBeenCalledWith('plan_ready', expect.anything());
  });

  test('upgrading while the verdict is open goes straight on to the plan', async () => {
    mockUsage.canCreatePlan = false;
    start_study_journey.mockImplementation(() => ({ planPromise: new Promise(() => {}) }));
    const { rerender } = render(<StartStudyModal {...props} />);
    await screen.findByText('Get my full plan with Pro');
    expect(start_study_journey).not.toHaveBeenCalled();

    // The focus refresh after Stripe flips her tier.
    mockUsage = { ...mockUsage, canCreatePlan: true };
    await act(async () => { rerender(<StartStudyModal {...props} />); });
    expect(start_study_journey).toHaveBeenCalledTimes(1);
  });
});
