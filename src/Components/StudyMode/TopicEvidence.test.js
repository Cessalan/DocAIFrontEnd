import React from 'react';
import { render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import { ReviewReason, TopicProgress } from './TopicEvidence';

test('explains the evidence without labelling a strong or untested topic as weak', () => {
  const reason = { source: 'quick_check', topic: 'ABCDE', correct: 1, answered: 4 };
  const { rerender } = render(<ReviewReason reason={reason} />);
  expect(screen.getByText(/You got 1 of 4 questions right/)).toBeInTheDocument();
  rerender(<ReviewReason reason={{ ...reason, correct: 4 }} />);
  expect(screen.queryByText(/Why this review/)).not.toBeInTheDocument();
});
test('shows a lower result honestly with visible sample sizes', () => {
  render(<TopicProgress baseline={{ topic: 'ABCDE', correct: 3, answered: 4 }} latest={{ correct: 2, answered: 5 }} />);
  expect(screen.getByText('3/4')).toBeInTheDocument();
  expect(screen.getByText('2/5')).toBeInTheDocument();
  expect(screen.getByText('35 percentage points lower on this set.')).toBeInTheDocument();
});

test('preview uses saved missed concepts and falls back without inventing a specific weakness', () => {
  const reason = { source: 'quick_check', topic: 'ABCDE', correct: 1, answered: 5 };
  const { rerender } = render(<ReviewReason reason={reason} compact />);
  expect(screen.getByText('Focus: the ideas behind the questions you missed.')).toBeInTheDocument();
  rerender(<ReviewReason reason={{ ...reason, missedConcepts: ['Airway assessment'], priorityMisses: 1 }} compact />);
  expect(screen.getByText('Focus: Airway assessment')).toBeInTheDocument();
  rerender(<ReviewReason reason={{ ...reason, priorityMisses: 2 }} compact />);
  expect(screen.getByText('Practise choosing what to do first')).toBeInTheDocument();
  expect(screen.queryByText(/You got/)).not.toBeInTheDocument();
});
