import React from 'react';
import { render, screen } from '@testing-library/react';
import PracticePlanSummary from './PracticePlanSummary';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_, options) =>
  options.defaultValue.replace('{{count}}', options.count) }) }));

test('shows planned coverage and scope uncertainty without claiming exam prediction', () => {
  render(<PracticePlanSummary plan={{ total: 50, summary: 'Practice across your four modules.',
    coverage: { 'Health models': 15, 'Nursing process': 20, Family: 8, Culture: 7 },
    uncertainties: ['The notes do not specify the actual exam distribution.'] }} />);
  expect(screen.getByText('Your 50-question test plan')).toBeInTheDocument();
  expect(screen.getByText('Nursing process')).toBeInTheDocument();
  expect(screen.getByText('20')).toBeInTheDocument();
  expect(screen.getByText('The notes do not specify the actual exam distribution.')).toBeInTheDocument();
});

test('legacy quizzes without a plan keep their existing presentation', () => {
  const { container } = render(<PracticePlanSummary />);
  expect(container).toBeEmptyDOMElement();
});
