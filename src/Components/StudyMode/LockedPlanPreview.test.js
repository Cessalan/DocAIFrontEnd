import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import LockedPlanPreview from './LockedPlanPreview';

jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: {
    PLAN_PREVIEW_VIEWED: 'plan_preview_viewed',
    PAYWALL_CTA_CLICKED: 'paywall_cta_clicked',
    WEAKNESS_INSIGHT_VIEWED: 'weakness_insight_viewed',
  },
  logFunnelStep: jest.fn(),
  logFunnelStepOnce: jest.fn(),
}));
const { logFunnelStep, logFunnelStepOnce } = jest.requireMock('../../Services/FunnelService');

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

describe('LockedPlanPreview', () => {
  const base = {
    topics: ['Fluid & Electrolytes', 'Heart Failure', 'Infection Control'],
    diagnostic: { 'Fluid & Electrolytes': 20, 'Heart Failure': 55, 'Infection Control': 90 },
    daysToExam: 5,
    onUnlock: () => {},
    onClose: () => {},
  };

  test('leads with her deadline, not with our limit', () => {
    render(<LockedPlanPreview {...base} />);
    expect(screen.getByText('5 days until your exam')).toBeInTheDocument();
    // The old copy sold the quota. Nothing on this screen may mention it.
    expect(screen.queryByText(/plan limit/i)).toBeNull();
    expect(screen.queryByText(/you've already started/i)).toBeNull();
    expect(screen.queryByText(/3 study plans/i)).toBeNull();
  });

  test('shows her own diagnostic scores against each topic', () => {
    render(<LockedPlanPreview {...base} />);
    // This is what makes the ordering legible as earned rather than decorative.
    expect(screen.getByText('· you scored 20%')).toBeInTheDocument();
    expect(screen.getByText('· you scored 90%')).toBeInTheDocument();
  });

  test('orders weakest first', () => {
    render(<LockedPlanPreview {...base} />);
    const rows = screen.getAllByRole('listitem').map(li => li.textContent);
    expect(rows[0]).toContain('Fluid & Electrolytes');
    expect(rows[rows.length - 1]).toContain('Infection Control');
  });

  test('quotes a real session total', () => {
    render(<LockedPlanPreview {...base} />);
    // gap(5) + shaky(2) + solid(2) = 9, inside the focus budget of 14.
    expect(screen.getByText('9 study sessions')).toBeInTheDocument();
  });

  test('admits when the calendar squeezed topics out', () => {
    // She is about to pay against this screen. A shorter list than she
    // uploaded has to be explained here, not discovered mid-plan.
    const many = Array.from({ length: 10 }, (_, i) => `Topic ${i}`);
    render(
      <LockedPlanPreview
        {...base}
        topics={many}
        diagnostic={many.reduce((acc, t) => ({ ...acc, [t]: 10 }), {})}
        daysToExam={0}
      />
    );
    expect(screen.getByText(/left out to fit your exam date/)).toBeInTheDocument();
  });

  test('handles a student who never gave an exam date', () => {
    render(<LockedPlanPreview {...base} daysToExam={null} />);
    expect(screen.getByText('Your study plan is ready')).toBeInTheDocument();
  });

  test('the CTA continues the plan rather than announcing a limit', () => {
    const onUnlock = jest.fn();
    render(<LockedPlanPreview {...base} onUnlock={onUnlock} />);
    // Not "unlock": she is buying the plan built for her, not access to a screen.
    expect(screen.queryByText(/unlock/i)).toBeNull();
    expect(screen.queryByText(/a lot to learn/i)).toBeNull();
    fireEvent.click(screen.getByText('Get my full plan with Pro'));
    expect(onUnlock).toHaveBeenCalled();
  });

  test('leaving is free — nothing has been generated or charged', () => {
    const onClose = jest.fn();
    render(<LockedPlanPreview {...base} onClose={onClose} />);
    fireEvent.click(screen.getByText('Not now'));
    expect(onClose).toHaveBeenCalled();
  });

  describe('with a readiness check behind it', () => {
    const answers = [
      { topic: 'Heart Failure (HF)', format: 'mcq', kind: 'applied', correct: true },
      { topic: 'Fluid & Electrolytes', format: 'mcq', kind: 'applied', correct: true },
      { topic: 'Heart Failure (HF)', format: 'sata', correct: false, partial: true },
      { topic: 'Fluid & Electrolytes', format: 'sata', correct: false, partial: true },
      { topic: 'Infection Control', format: 'sata', correct: false },
      { topic: 'Heart Failure (HF)', format: 'casestudy', correct: false },
      { topic: 'Infection Control', format: 'mcq', kind: 'prioritization', correct: false },
    ];
    const withCheck = { ...base, daysToExam: 1, ctaVariant: 'fix', readiness: { answers, funnelId: 'f_1' } };

    test('leads with what could cost her marks, each weakness with its evidence and a plain label', () => {
      render(<LockedPlanPreview {...withCheck} />);
      expect(screen.getByText("Here's what could cost you marks tomorrow")).toBeInTheDocument();
      expect(screen.getByText('From your 7 answers')).toBeInTheDocument();
      expect(screen.getByText(/the question format is costing you marks/)).toBeInTheDocument();
      expect(screen.getByText('0 of 4 on select-all and case questions, 2 of 2 on standard ones')).toBeInTheDocument();
      expect(screen.getByText('Deciding what the nurse does first')).toBeInTheDocument();
      // Format gap (0 of 4) and Heart Failure (1 of 3) are firm and serious;
      // priority (1 answer) and Infection Control (2 answers) are thin.
      expect(screen.getAllByText('High concern')).toHaveLength(2);
      expect(screen.getAllByText('Early signal')).toHaveLength(2);
      // The bare "you scored 33%" rows are what did not convert.
      expect(screen.queryByText(/you scored/)).toBeNull();
      expect(screen.queryByText(/unlock/i)).toBeNull();
    });

    test('names the fix after the findings, and never quotes minutes per session', () => {
      render(<LockedPlanPreview {...withCheck} />);
      expect(screen.getByText(
        'Your plan starts with SATA + case studies + prioritization, then rechecks Infection Control until it improves.'
      )).toBeInTheDocument();
      expect(screen.getByText(/built for your exam date/)).toBeInTheDocument();
      expect(screen.queryByText(/\beach\b/)).toBeNull();
    });

    test('offers the fix under the assigned button label, and logs which one', () => {
      const onUnlock = jest.fn();
      render(<LockedPlanPreview {...withCheck} onUnlock={onUnlock} />);
      fireEvent.click(screen.getByText('Fix my weak spots'));
      expect(onUnlock).toHaveBeenCalledWith(null);
      expect(logFunnelStep).toHaveBeenCalledWith('paywall_cta_clicked', expect.objectContaining({ ctaVariant: 'fix' }));
    });

    test('keeps one button label per browser once assigned', () => {
      window.localStorage.setItem('nqVerdictCta', 'build');
      render(<LockedPlanPreview {...withCheck} ctaVariant={null} />);
      expect(screen.getByText('Build my plan')).toBeInTheDocument();
      expect(logFunnelStepOnce).toHaveBeenCalledWith('weakness_insight_viewed', expect.objectContaining({
        funnelId: 'f_1', answered: 7, ctaVariant: 'build', findingKeys: expect.stringContaining('formatGap'),
      }));
    });

    test('an all-early verdict says so once, in the header, not on every row', () => {
      const thin = [
        { topic: 'Coronary Artery Disease (CAD)', format: 'mcq', correct: false },
        { topic: 'Coronary Artery Disease (CAD)', format: 'mcq', correct: false },
        { topic: 'Bypass Grafting', format: 'mcq', correct: false },
        { topic: 'Bypass Grafting', format: 'mcq', correct: true },
        { topic: 'Acute Coronary Syndrome', format: 'mcq', correct: true },
        { topic: 'Acute Coronary Syndrome', format: 'mcq', correct: true },
      ];
      const onUnlock = jest.fn();
      render(<LockedPlanPreview {...base} daysToExam={null} ctaVariant="build"
        readiness={{ answers: thin }} onUnlock={onUnlock} />);
      expect(screen.getByText("Here's what's holding you back")).toBeInTheDocument();
      expect(screen.getByText('An early read from your 6 answers')).toBeInTheDocument();
      expect(screen.queryByText('Early signal')).toBeNull();
      expect(screen.getByText('Missed both')).toBeInTheDocument();
      expect(screen.getByText('1 of 2 right')).toBeInTheDocument();
      expect(screen.getByText('Your plan starts with CAD + Bypass Grafting, then rechecks them until they improve.'))
        .toBeInTheDocument();
      // No date, so nothing claims to be built around one.
      expect(screen.queryByText(/built for your exam date/)).toBeNull();
      // Only a clean verdict carries a strength; this screen must not grow.
      expect(screen.queryByText(/Solid already/)).toBeNull();
      fireEvent.click(screen.getByText('Build my plan'));
      expect(onUnlock).toHaveBeenCalledWith('Coronary Artery Disease (CAD)');
    });

    test('a student who did well is told so, not handed invented gaps', () => {
      const good = answers.map(a => ({ ...a, correct: true, partial: false }));
      render(<LockedPlanPreview {...base} ctaVariant="fix" readiness={{ answers: good }} />);
      expect(screen.getByText('Nothing big is holding you back on what we checked')).toBeInTheDocument();
      expect(screen.getByText('Solid already: Heart Failure (HF) (3 of 3)')).toBeInTheDocument();
      expect(screen.getByText('Check the rest with Pro')).toBeInTheDocument();
    });
  });
});
