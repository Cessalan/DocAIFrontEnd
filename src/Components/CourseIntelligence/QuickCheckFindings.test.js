import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import QuickCheckFindings from './QuickCheckFindings';

jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: { WEAKNESS_INSIGHT_VIEWED: 'weakness_insight_viewed' }, logFunnelStep: jest.fn(),
}));

const answers = [
  ...[0, 1, 2].map(() => ({ topic: 'Topic A', format: 'sata', correct: false, partial: true })),
  { topic: 'Topic A', format: 'mcq', kind: 'prioritization', correct: false },
  { topic: 'Topic B', format: 'mcq', kind: 'prioritization', correct: true },
  { topic: 'Topic B', format: 'mcq', correct: true },
  { topic: 'Topic B', format: 'mcq', correct: false },
  { topic: 'Topic B', format: 'mcq', correct: false },
];

it('uses actual partial-answer evidence and hides secondary findings until expanded', () => {
  render(<QuickCheckFindings answers={answers} lead={{ topic: 'Topic A', revisit: ['Concept A'] }} />);
  expect(screen.getByRole('heading', { name: 'You’re getting parts of the select-all questions right.' })).toBeInTheDocument();
  expect(screen.getByText('0 of 3 fully right, partly right on 3')).toBeInTheDocument();
  const summary = screen.getByText('See all findings · 2 more');
  expect(screen.getByText('Missed all 4')).not.toBeVisible();
  fireEvent.click(summary);
  expect(screen.getByText('Missed all 4')).toBeVisible();
  expect(screen.getByText('2 of 8 answers correct on your first try.')).toBeInTheDocument();
});

it('does not imply partial knowledge when select-all answers had no correct selections', () => {
  render(<QuickCheckFindings answers={answers.map(a => ({ ...a, partial: false }))} lead={{ topic: 'Topic A' }} />);
  expect(screen.queryByText('You’re getting parts of the select-all questions right.')).toBeNull();
});

describe('the weak-areas offer line', () => {
  const usage = require('../../Contexts/UsageContext/UsageContext');
  const gapAnswers = [
    ...[0, 1, 2, 3].map(() => ({ topic: 'A', format: 'mcq', correct: true })),
    { topic: 'A', format: 'sata', correct: false },
    { topic: 'A', format: 'sata', correct: false },
    { topic: 'B', format: 'casestudy', correct: true },
    { topic: 'B', format: 'casestudy', correct: false },
  ];
  afterEach(() => jest.restoreAllMocks());

  it('names her gap and opens the offer with it', () => {
    const openUpgrade = jest.fn();
    jest.spyOn(usage, 'useUsageLimit').mockReturnValue({ isPro: false, openUpgrade });
    render(<QuickCheckFindings answers={gapAnswers} lead={{ topic: 'A' }} />);
    expect(screen.getByText('That 1 of 4 is the gap Pro drills without limits, from your own notes.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Practise unlimited select-all and prioritization'));
    expect(openUpgrade).toHaveBeenCalledWith('gap', expect.objectContaining({
      trigger: 'weakness_insight',
      gap: { source: 'check', standard: { correct: 4, total: 4 }, hard: { correct: 1, total: 4 } },
    }));
  });

  it('is absent for Pro accounts', () => {
    jest.spyOn(usage, 'useUsageLimit').mockReturnValue({ isPro: true, openUpgrade: jest.fn() });
    render(<QuickCheckFindings answers={gapAnswers} lead={{ topic: 'A' }} />);
    expect(screen.queryByText(/the gap Pro drills/)).toBeNull();
  });

  it('is absent when there is no format gap', () => {
    jest.spyOn(usage, 'useUsageLimit').mockReturnValue({ isPro: false, openUpgrade: jest.fn() });
    render(<QuickCheckFindings answers={gapAnswers.map(a => ({ ...a, correct: true }))} lead={{ topic: 'A' }} />);
    expect(screen.queryByText(/the gap Pro drills/)).toBeNull();
  });
});
