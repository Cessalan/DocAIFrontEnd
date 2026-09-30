import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PrintQuizButton from './PrintQuizButton';

const questions = [{ question: 'Which finding needs action first?', options: ['A) Pulse 88', 'B) SpO2 86%'], answer: 'B) SpO2 86%', topic: 'Priorities' }];

it('previews the exact document before printing', () => {
  render(<PrintQuizButton questions={questions} topic="Respiratory" />);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'quizPrint.buttonTitle' }));
  const frame = screen.getByTitle('quizPrint.previewTitle');
  expect(frame.getAttribute('srcdoc')).toContain('Which finding needs action first?');
  expect(frame.getAttribute('srcdoc')).toContain('NurseQuiz<b>AI</b>');
  expect(frame.getAttribute('sandbox')).toBe('allow-same-origin allow-modals');
  expect(screen.getByRole('button', { name: /quizPrint.print/ })).toBeTruthy();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('renders nothing when there is no question yet', () => {
  const { container } = render(<PrintQuizButton questions={[]} />);
  expect(container.innerHTML).toBe('');
});
