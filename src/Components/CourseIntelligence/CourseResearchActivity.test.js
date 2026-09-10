import React from 'react';
import { render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import CourseResearchActivity from './CourseResearchActivity';
import { initialTimeline, reduceTimeline } from './courseIntelligenceModel';

const event = (state, detail = {}) => ({ status: 'course_intelligence_progress', step: 'academic_resources_research', state, detail });

it('only shows research after a real search starts and replaces progress with its result', () => {
  let timeline = initialTimeline();
  const { rerender } = render(<CourseResearchActivity timeline={timeline} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  timeline = reduceTimeline(timeline, event('empty'));
  rerender(<CourseResearchActivity timeline={timeline} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  timeline = reduceTimeline(timeline, event('running'));
  rerender(<CourseResearchActivity timeline={timeline} />);
  expect(screen.getByRole('status')).toHaveTextContent('Finding sources for more accurate preparation');
  expect(screen.getByRole('status')).toHaveTextContent('Clinical references');
  timeline = reduceTimeline(timeline, event('done', { resource_count: 3 }));
  rerender(<CourseResearchActivity timeline={timeline} />);
  expect(screen.getByRole('status')).toHaveTextContent('Sources for more accurate preparation');
  expect(screen.getByRole('status')).toHaveTextContent('3 resources found');
});

it('does not turn an interrupted stream into completed research', () => {
  let timeline = reduceTimeline(initialTimeline(), event('running'));
  timeline = reduceTimeline(timeline, { status: 'error' });
  render(<CourseResearchActivity timeline={timeline} />);
  expect(screen.getByRole('status')).toHaveTextContent('Search interrupted');
  expect(screen.queryByText('Research complete')).not.toBeInTheDocument();
});

it('renders returned source links and excludes unsafe URLs and duplicates', () => {
  let timeline = reduceTimeline(initialTimeline(), event('running'));
  timeline = reduceTimeline(timeline, event('done', { resource_count: 2, sources: [
    { title: 'Assessment guide', url: 'https://example.edu/assessment' },
    { title: 'Duplicate', url: 'https://example.edu/assessment' },
    { title: 'Unsafe', url: 'javascript:alert(1)' },
  ] }));
  render(<CourseResearchActivity timeline={timeline} />);
  expect(screen.getByRole('link', { name: /Assessment guide/ })).toHaveAttribute('href', 'https://example.edu/assessment');
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.queryByText('Unsafe')).not.toBeInTheDocument();
});
