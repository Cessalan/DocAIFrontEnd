import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import i18n from 'i18next';
import ComposerUploads from './ComposerUploads';
import ComposerSuggestions, { UPLOAD_SUGGESTIONS } from './ComposerSuggestions';
import { newComposerFile } from './composerUploadModel';

beforeEach(() => { i18n.changeLanguage('en'); });

const file = (name, status = 'uploading') => ({ ...newComposerFile({ name }, name), status });

test('each file is one chip: its name and a ring, nothing else', () => {
  const { container } = render(<ComposerUploads files={[file('Evaluation ABCDE.pdf'), file('Week 3.pptx', 'ready')]} />);
  expect(screen.getByText('Evaluation ABCDE.pdf')).toBeInTheDocument();
  expect(screen.getByLabelText('Evaluation ABCDE.pdf, uploading')).toHaveClass('is-loading', 'kind-pdf');
  expect(screen.getByLabelText('Week 3.pptx, ready')).toHaveClass('is-ready', 'kind-slides');
  expect(container.querySelectorAll('.composer-upload__fill')).toHaveLength(2);
  expect(container.textContent).not.toMatch(/%|Reading|Uploading/);
});

test('a ready file draws a full ring; a failed one is marked', () => {
  const { container } = render(<ComposerUploads files={[file('a.pdf', 'ready'), file('b.docx', 'error')]} />);
  const [ready] = container.querySelectorAll('.composer-upload__fill');
  expect(Number(ready.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  expect(screen.getByLabelText('b.docx could not be read')).toHaveClass('is-error');
});

test('no files, no strip', () => {
  const { container } = render(<ComposerUploads files={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test('suggestions put the study plan first and pass the picked action', () => {
  const pick = jest.fn();
  render(<ComposerSuggestions onPick={pick} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons.map(b => b.textContent)).toEqual(
    ['Build a study plan', 'Check my understanding', 'Quiz me', 'Study sheet', 'Create flashcards']);
  fireEvent.click(screen.getByRole('button', { name: 'Quiz me' }));
  expect(pick).toHaveBeenCalledWith('quiz');
  expect(UPLOAD_SUGGESTIONS[0]).toBe('studyjourney');
});

test('suggestions are translated', () => {
  i18n.changeLanguage('fr');
  render(<ComposerSuggestions onPick={() => {}} />);
  expect(screen.getByRole('button', { name: 'Créer un plan d’étude' })).toBeInTheDocument();
});
