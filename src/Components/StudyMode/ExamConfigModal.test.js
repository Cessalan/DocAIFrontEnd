import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExamConfigModal from './ExamConfigModal';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, fallback) => typeof fallback === 'string' ? fallback : key }) }));
jest.mock('../../Contexts/UsageContext/UsageContext', () => ({ useUsageLimit: () => ({ isPro: true }) }));

test('defaults to medium and sends the selected difficulty with the exam settings', () => {
  const onStart = jest.fn();
  render(<ExamConfigModal isOpen onStart={onStart} />);
  expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Hard' }));
  expect(screen.getByRole('radio', { name: 'Medium' })).not.toBeChecked();
  expect(screen.getByText('Work through more complex scenarios and closer answer choices.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start Mini-Test' }));
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ questionDifficulty: 'hard', questionCount: 10, questionTypes: ['mcq', 'sata', 'casestudy', 'matrix'] }));
  fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start Mini-Test' }));
  expect(onStart).toHaveBeenLastCalledWith(expect.objectContaining({ questionDifficulty: 'easy' }));
});
