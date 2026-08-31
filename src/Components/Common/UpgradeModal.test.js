import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import UpgradeModal from './UpgradeModal';

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

  test('annual is a swap, not a rival button', () => {
    render(<UpgradeModal {...base} />);
    expect(screen.getByText('$8.33')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save 50%'));
    expect(screen.getByText('$4.17')).toBeInTheDocument();
    expect(screen.getByText(/Billed \$50 yearly/)).toBeInTheDocument();
  });

  test('omits the context card when the topic is a placeholder title', () => {
    render(<UpgradeModal {...base} topic={null} />);
    expect(screen.queryByText('You were practicing')).toBeNull();
  });
});
