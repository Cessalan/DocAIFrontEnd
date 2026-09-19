import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import UpgradeModal from './UpgradeModal';

describe('UpgradeModal (already Pro)', () => {
  test('speaks to the fix in progress, puts the journey first, keeps account management', () => {
    const onClose = jest.fn();
    render(<UpgradeModal isOpen isPro onClose={onClose} />);
    expect(screen.getByText('Your plan is fully unlocked')).toBeInTheDocument();
    expect(screen.getByText(/Keep working through your weak spots/)).toBeInTheDocument();
    // Not a list of unlimited things.
    expect(screen.queryByText(/Unlimited practice/)).toBeNull();
    expect(screen.getByText('Manage subscription')).toBeInTheDocument();
    expect(screen.getByText('Change plan, update card, or cancel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Keep going'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('UpgradeModal (blocked, question gate)', () => {
  const base = {
    isOpen: true, onClose: () => {}, limit: 30, used: 17, remaining: 0,
    msUntilReset: 53557000, topic: 'Cardiac Pharmacology',
  };

  test('names what they were practicing and sells outcomes', () => {
    render(<UpgradeModal {...base} />);
    expect(screen.getByText('You were practicing')).toBeInTheDocument();
    expect(screen.getByText('Cardiac Pharmacology')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('Study to excel, not just to pass.')).toBeInTheDocument();
    expect(screen.queryByText(/Everything you need to pass/i)).toBeNull();
    expect(screen.getByText('Turn weak spots into strengths')).toBeInTheDocument();
    expect(screen.getByText('Know what to study next')).toBeInTheDocument();
  });

  test('has exactly one primary CTA and a demoted free path', () => {
    render(<UpgradeModal {...base} />);
    expect(screen.getByText('Continue studying with Pro')).toBeInTheDocument();
    expect(screen.getByText(/Continue free in 14:52:37/)).toBeInTheDocument();
  });

  test('keeps the CTA out of the scrolling region so it can never be buried', () => {
    const { container } = render(<UpgradeModal {...base} />);
    const scroll = container.querySelector('.upgrade-scroll');
    const cta = container.querySelector('.upgrade-cta');

    expect(scroll).toBeTruthy();
    expect(cta).toBeTruthy();
    expect(scroll.contains(cta)).toBe(false);
    expect(container.querySelector('.upgrade-footer').contains(cta)).toBe(true);
    // The offer must be inside the scroller, or nothing scrolls and we're back
    // to a modal taller than the viewport.
    expect(scroll.contains(container.querySelector('.upgrade-pro'))).toBe(true);
  });

  test('every plan is on screen, priced, with its per-month equivalent', () => {
    // No disclosure. "Show more plans" gave her no reason to tap it, so the
    // cheaper-per-month options were invisible to everyone not already
    // shopping — including the pass this tier exists to sell.
    const { container } = render(<UpgradeModal {...base} />);

    // Lead plan, stated as the charge she will actually see on her card.
    expect(container.querySelector('.upgrade-pick-lead')).toHaveTextContent('Monthly');
    expect(screen.getByText('$13.34')).toBeInTheDocument();
    expect(screen.getByText('USD / month')).toBeInTheDocument();

    // ...and both alternatives, visible without a tap.
    expect(screen.getByText('Semester Pass')).toBeInTheDocument();
    expect(screen.getByText('$40.17')).toBeInTheDocument();
    expect(screen.getByText('USD / 4 months')).toBeInTheDocument();
    expect(screen.getByText('Annual')).toBeInTheDocument();
    expect(screen.getByText('$83.07')).toBeInTheDocument();

    // Three prices in three different cadences are not comparable until
    // something states them in one unit, so each row carries the per-month
    // figure and what it saves.
    expect(screen.getByText('$10.04/mo · Save 25%')).toBeInTheDocument();
    expect(screen.getByText('$6.92/mo · Save 48%')).toBeInTheDocument();

    // Still exactly one primary CTA, however many plans are on screen.
    expect(container.querySelectorAll('.upgrade-cta')).toHaveLength(1);
  });

  test('choosing another plan promotes it, with the real charge and cadence', () => {
    const { container } = render(<UpgradeModal {...base} />);
    fireEvent.click(screen.getByText('Semester Pass'));

    const lead = container.querySelector('.upgrade-pick-lead');
    expect(lead).toHaveTextContent('Semester Pass');
    expect(lead).toHaveTextContent('$40.17');
    expect(lead).toHaveTextContent('USD / 4 months');
    // The per-month equivalent may only appear inside the billing sentence,
    // never as the headline number — that is how a page quotes $10.04 and the
    // checkout screen then asks for $40.17.
    expect(lead).toHaveTextContent(/about \$10\.04 a month/);
    expect(container.querySelector('.upgrade-pick-amount').textContent).toBe('$40.17');
  });

  test('the leading plan follows the gate that opened the modal', () => {
    // ⚠️ Guards the interval trap: the semester pass is a 4-month RECURRING
    // price, so it shares `interval: 'month'` with the monthly plan. Anything
    // that looks plans up by interval rather than id silently leads with the
    // wrong one — and charges it.
    const { container: throttle } = render(<UpgradeModal {...base} />);
    expect(throttle.querySelector('.upgrade-pick-lead')).toHaveTextContent('Monthly');
    expect(throttle.querySelector('.upgrade-pick-amount').textContent).toBe('$13.34');

    const { container: planWall } = render(
      <UpgradeModal {...base} reason="plan_ready" plansRemaining={0} />
    );
    expect(planWall.querySelector('.upgrade-pick-lead')).toHaveTextContent('Semester Pass');
  });

  test('re-seeds the plan on each open instead of keeping the first one', () => {
    // The provider mounts this once and it returns null while closed, so a
    // useState initializer only ever ran for the first student to see it.
    const { container, rerender } = render(<UpgradeModal {...base} />);
    expect(container.querySelector('.upgrade-pick-lead')).toHaveTextContent('Monthly');

    rerender(<UpgradeModal {...base} isOpen={false} />);
    rerender(<UpgradeModal {...base} reason="plan_ready" plansRemaining={0} />);

    expect(container.querySelector('.upgrade-pick-lead')).toHaveTextContent('Semester Pass');
  });

  test('the upload gate can finally say its own name', () => {
    // It used to arrive as reason=null and render the aspirational pitch at
    // someone who had just been stopped from attaching a file.
    render(<UpgradeModal {...base} reason="upload" remaining={40} />);
    expect(screen.getByText('Bring all your notes.')).toBeInTheDocument();
    expect(screen.getByText(/one upload per chat/i)).toBeInTheDocument();
    expect(screen.getByText('Add all your notes with Pro')).toBeInTheDocument();
    expect(screen.queryByText('Study without limits')).toBeNull();
  });

  test('omits the context card when the topic is a placeholder title', () => {
    render(<UpgradeModal {...base} topic={null} />);
    expect(screen.queryByText('You were practicing')).toBeNull();
  });
});
