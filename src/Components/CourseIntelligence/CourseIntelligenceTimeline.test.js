import React from 'react';
import { render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import CourseIntelligenceTimeline from './CourseIntelligenceTimeline';
import { initialTimeline, reduceTimeline } from './courseIntelligenceModel';

it('only highlights a passage after the source event arrives', () => {
  const initial = initialTimeline();
  const { rerender } = render(<CourseIntelligenceTimeline timeline={initial} filenames={['lecture.pdf']} />);
  expect(screen.queryByRole('mark')).not.toBeInTheDocument();
  const source = { filename: 'lecture.pdf', excerpt: 'A passage retrieved from the uploaded lecture.' };
  const updated = reduceTimeline(initial, { status: 'course_material_excerpt', source, topics: ['Topic'] });
  rerender(<CourseIntelligenceTimeline timeline={updated} filenames={['lecture.pdf']} />);
  expect(screen.getByText(source.excerpt)).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Building your quiz from your notes');
  expect(updated.transformation.source).toBe(source);
});

it('does not describe unavailable questions as still being generated', () => {
  const timeline = reduceTimeline(initialTimeline(), { status: 'course_question_unavailable' });
  render(<CourseIntelligenceTimeline timeline={timeline} />);
  expect(screen.getByRole('status')).toHaveTextContent('Continuing with your course materials.');
});
