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
  expect(screen.getByText(/some correct answers on 3 select-all questions/)).toBeInTheDocument();
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
