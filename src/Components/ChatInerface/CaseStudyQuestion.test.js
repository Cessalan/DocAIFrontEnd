import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CaseStudyQuestion from './CaseStudyQuestion';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, fallback, values) => (fallback || key).replace('{{number}}', values?.number) }) }));
jest.mock('../Glossary/useGlossary', () => () => ({ rationaleRef: { current: null }, rationaleHandlers: {}, popover: null }));
const quiz = { question: 'Arrange these actions.', topic: 'Patient assessment', options: ['Assess', 'Reassess'], correctOrder: ['Assess', 'Reassess'], caseStudy: { nursesNotes: '<p>Patient history.</p>', vitalSigns: '<p>Recorded observations.</p>' } };
test('switches chart tabs and lets a learner submit an unchanged order', () => {
  const answer = jest.fn();
  render(<CaseStudyQuestion quiz={quiz} onAnswerSelect={answer} />);
  expect(screen.getByText('Patient history.')).toBeVisible();
  expect(screen.queryByText('Recorded observations.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Vitals & labs' }));
  expect(screen.getByText('Recorded observations.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Submit Order' }));
  expect(answer).toHaveBeenCalledWith(expect.objectContaining({ userOrder: ['Assess', 'Reassess'], isCorrect: true }));
});
test('arrow controls change the submitted order and text-based answers appear in feedback', async () => {
  const answer = jest.fn();
  render(<CaseStudyQuestion quiz={quiz} onAnswerSelect={answer} />);
  fireEvent.click(screen.getByRole('button', { name: 'Move action 1 down' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit Order' }));
  expect(answer).toHaveBeenCalledWith(expect.objectContaining({ userOrder: ['Reassess', 'Assess'], isCorrect: false }));
  await waitFor(() => expect(screen.getByText('Your order')).toBeVisible());
  const lists = screen.getAllByRole('list');
  expect(lists[1].children[0]).toHaveTextContent('Assess');
  expect(lists[1].children[1]).toHaveTextContent('Reassess');
});
