import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import PlanAdvance from './PlanAdvance';
import { hasUsableStudyContent } from './planAdvanceReadiness';

const nodes = [
  { id: 'a', type: 'lesson', topic: 'ABCDE', label: 'ABCDE', topicKey: 'abcde' },
  { id: 'b', type: 'quiz', topic: 'ABCDE', label: 'ABCDE - Quick Check', topicKey: 'abcde' },
  { id: 'c', type: 'lesson', topic: 'Cardiac', label: 'Cardiac', topicKey: 'cardiac' },
];

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('moves the current marker only after completion is confirmed', () => {
  const { rerender, container } = render(<PlanAdvance nodes={nodes} fromId="a" confirmed={false} />);
  expect(screen.getByText('Saving your progress…')).toBeInTheDocument();
  expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Quick Review');
  rerender(<PlanAdvance nodes={nodes} fromId="a" toId="b" confirmed />);
  act(() => { jest.advanceTimersByTime(1000); });
  expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Quick Review');
  act(() => { jest.advanceTimersByTime(100); });
  expect(screen.getByText('Review complete. Now try applying it.')).toBeInTheDocument();
  expect(screen.getByText('Completed')).toBeInTheDocument();
  expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Quiz');
  expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
  expect(screen.getByText('Check what you understood')).toBeInTheDocument();
  expect(screen.getByText('Review the key ideas')).toBeInTheDocument();
});

test('allows opening early only when the next activity is ready', () => {
  const onOpenNow = jest.fn();
  const { rerender } = render(<PlanAdvance nodes={nodes} fromId="a" toId="b" confirmed onOpenNow={onOpenNow} />);
  expect(screen.queryByRole('button', { name: 'Open now' })).not.toBeInTheDocument();
  expect(screen.getByText('Preparing: Quiz…')).toBeInTheDocument();
  rerender(<PlanAdvance nodes={nodes} fromId="a" toId="b" confirmed ready onOpenNow={onOpenNow} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open now' }));
  expect(onOpenNow).toHaveBeenCalledTimes(1);
});

test('does not treat empty streaming placeholders as ready', () => {
  expect(hasUsableStudyContent('quiz', { questions: [], _isStreaming: true })).toBe(false);
  expect(hasUsableStudyContent('lesson', { pages: [], _isStreaming: true })).toBe(false);
  expect(hasUsableStudyContent('flashcard', { cards: [], _isStreaming: true })).toBe(false);
  expect(hasUsableStudyContent('quiz', { questions: [{ question: 'First question' }], _isStreaming: true })).toBe(true);
  expect(hasUsableStudyContent('lesson', { pages: [{ title: 'First page' }], _isStreaming: true })).toBe(true);
  expect(hasUsableStudyContent('lesson', { body: 'Legacy review' })).toBe(true);
});

test('shows added practice as a detour and identifies the return to the original plan', () => {
  const detour = { id: 'extra', type: 'flashcard', label: 'Airway priority', detour: { fromNodeId: 'a', returnNodeId: 'b' } };
  const updated = [nodes[0], detour, ...nodes.slice(1)];
  const { rerender } = render(<PlanAdvance nodes={updated} fromId="a" toId="extra" confirmed detour returnId="b" />);
  expect(screen.getByText('A quick detour to practise this weak spot')).toBeInTheDocument();
  expect(screen.getByText('Then back to your plan: Quiz · ABCDE')).toBeInTheDocument();
  expect(screen.getByText('Added focused practice')).toBeInTheDocument();
  rerender(<PlanAdvance nodes={updated} fromId="extra" toId="b" confirmed />);
  expect(screen.getByText('Practice complete. Back to your plan.')).toBeInTheDocument();
});

test('distinguishes a subject change, missing local node, and session completion', () => {
  const { rerender } = render(<PlanAdvance nodes={nodes} fromId="b" toId="c" confirmed />);
  expect(screen.getByText('Moving to your next topic')).toBeInTheDocument();
  rerender(<PlanAdvance nodes={nodes} fromId="c" toId="unknown" confirmed />);
  expect(screen.queryByText('Session complete')).not.toBeInTheDocument();
  rerender(<PlanAdvance nodes={nodes} fromId="c" confirmed isComplete />);
  expect(screen.getByText('Session complete')).toBeInTheDocument();
});
