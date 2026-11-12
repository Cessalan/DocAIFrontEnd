import React from 'react';
import { render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import StudySheetProgress from './StudySheetProgress';
import StudySheetSimple from './StudySheetSimple';
import { updateStudySheetMessage } from '../../Services/studySheetEvents';
import { getSelectableAncestor } from '../Selection/selectionScope';

const play = events => events.reduce(updateStudySheetMessage, { id: 's1', content: '', isStreaming: true });
const step = (id, state, facts = {}) => ({ status: 'study_sheet_step', step: id, state, ...facts });
const header = { status: 'study_sheet_header', studySheet: { title: 'Kidneys', sections: [] } };
const section = (id, title) => ({ status: 'study_sheet_section', section: { id, title, blocks: [] } });

test('the checklist says what was really done, in her words and numbers', () => {
  render(<StudySheetProgress message={play([
    step('materials', 'done', { files: 3, notes: true }),
    step('plan', 'done', { topics: ['Filtration', 'Reabsorption'], priorities: 1, quizzes: 2 }),
    step('write', 'active', { attempt: 1 }), header, section('section-1', 'How the nephron filters'),
  ])} />);
  expect(screen.getByText(/relevant pages from your 3 files/)).toBeTruthy();
  expect(screen.getByText('Plus the notes you pasted')).toBeTruthy();
  expect(screen.getByText('Filtration, Reabsorption')).toBeTruthy();
  expect(screen.getByText(/your answers on 2 recent quizzes/)).toBeTruthy();
  expect(screen.getByText('How the nephron filters')).toBeTruthy();
  expect(screen.getByText(/Writing your sheet/)).toBeTruthy();
});

test('with nothing reported yet it claims nothing', () => {
  const { container } = render(<StudySheetProgress message={{ isStreaming: true }} />);
  expect(screen.getByText(/Reading your material/)).toBeTruthy();
  expect(container.querySelectorAll('.ssp-box-done')).toHaveLength(0);
  expect(container.querySelectorAll('.ssp-step-detail')).toHaveLength(0);
  expect(container.textContent).not.toMatch(/\d/);
});

test('a failed sheet shows where it stopped and why, not a partial sheet', () => {
  const { container } = render(<StudySheetProgress message={play([
    step('materials', 'done', { files: 1, notes: false }), step('plan', 'active'),
    { status: 'study_sheet_error', message: 'Your study request could not be prepared. Please try again.' },
  ])} />);
  expect(screen.getByRole('alert').textContent).toMatch(/could not be prepared/);
  expect(container.querySelectorAll('.ssp-box-failed')).toHaveLength(1);
  expect(container.querySelectorAll('.ssp-box-active')).toHaveLength(0);
});

test('a finished sheet can be highlighted, but not its buttons or her sources', () => {
  const sheet = { version: 2, language: 'english', title: 'Kidneys', subtitle: 'Scope', summary: 'Overview text',
    sources: [{ id: 'D1', kind: 'document', label: 'notes.pdf' }],
    sections: [{ id: 'section-1', title: 'Filtration', blocks: [
      { kind: 'paragraph', text: 'The glomerulus filters plasma.', sourceIds: ['D1'] },
      { kind: 'self_check', questions: [{ question: 'What filters plasma?', answer: 'The glomerulus.' }], sourceIds: [] }] }] };
  const { container } = render(<StudySheetSimple studySheet={sheet} />);
  const text = node => node.firstChild;
  expect(getSelectableAncestor(text(screen.getByText('The glomerulus filters plasma.')))).not.toBeNull();
  expect(getSelectableAncestor(text(screen.getByText('Overview text')))).not.toBeNull();
  // the section heading is a collapse button, the answer toggle a <summary>
  expect(getSelectableAncestor(screen.getByRole('button', { name: /Filtration/ }))).toBeNull();
  expect(getSelectableAncestor(text(screen.getByText('Show answer and reasoning')))).toBeNull();
  expect(getSelectableAncestor(screen.getByRole('button', { name: 'Download PDF' }))).toBeNull();
  expect(getSelectableAncestor(container.querySelector('.sheet-sources summary'))).toBeNull();
  expect(getSelectableAncestor(container.querySelector('.sheet-sources li strong'))).toBeNull();
});
