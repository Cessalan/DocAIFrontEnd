import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import LockedPlanPreview from './LockedPlanPreview';

jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: { PLAN_PREVIEW_VIEWED: 'plan_preview_viewed', PAYWALL_CTA_CLICKED: 'paywall_cta_clicked' },
  logFunnelStep: jest.fn(),
  logFunnelStepOnce: jest.fn(),
}));

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
    const cta = screen.getByText('Unlock my study plan');
    fireEvent.click(cta);
    expect(onUnlock).toHaveBeenCalled();
  });

  test('leaving is free — nothing has been generated or charged', () => {
    const onClose = jest.fn();
    render(<LockedPlanPreview {...base} onClose={onClose} />);
    fireEvent.click(screen.getByText('Not now'));
    expect(onClose).toHaveBeenCalled();
  });
});
