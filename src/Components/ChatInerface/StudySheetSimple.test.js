import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StudySheetSimple from './StudySheetSimple';
import { legacyStudySheet, sheetFilename } from './studySheetModel';
import { updateStudySheetMessage, savedStudySheetMessage } from '../../Services/studySheetEvents';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
const sheet = { version: 2, title: 'Kidney filtration', subtitle: 'Only the requested markers', summary: 'Compare the markers and explain their role.', language: 'english',
  sources: [{ id: 'P1', kind: 'conversation', label: 'Your study request', quote: 'My teacher emphasized filtration.' }],
  sections: [{ id: 'section-1', title: 'Your focus', blocks: [
    { kind: 'callout', tone: 'teacher', title: 'Filtration', text: 'You flagged **filtration** as important.', sourceIds: ['P1'] },
    { kind: 'table', columns: ['Marker', 'Role'], rows: [['A', 'Explanation A'], ['B', 'Explanation B']] },
    { kind: 'self_check', questions: [{ question: 'Explain the distinction.', answer: 'The distinction is this.' }] },
  ] }] };

test('structured priorities, tables, citations and concealed self-check answers render', () => {
  const { container } = render(<StudySheetSimple studySheet={sheet} />);
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.queryByText('NurseQuizAI')).toBeNull();
  expect(screen.getByRole('table')).toBeTruthy();
  expect(screen.getByText('Your priority')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Your study request' }).getAttribute('href')).toContain('P1');
  expect(container.querySelector('.sheet-sources').open).toBe(false);
  fireEvent.click(screen.getByRole('link', { name: 'Your study request' }));
  expect(container.querySelector('.sheet-sources').open).toBe(true);
  expect(container.querySelector('.sheet-check-item details').open).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /Your focus/ }));
  expect(container.querySelector('.sheet-section [hidden]')).toBeTruthy();
});

test('long legacy headings stay behind a compact contents disclosure and navigation unfolds the target', () => {
  const longSheet = { ...sheet, sections: Array.from({ length: 14 }, (_, i) => ({ id: `section-${i + 1}`,
    title: i === 1 ? 'RAPID PROGRESSIVE GLOMERULONEPHRITIS (RPGN)' : `KIDNEY FUNCTION AND FILTRATION MARKERS ${i + 1}`,
    blocks: [{ kind: 'paragraph', text: `Section ${i + 1} explanation` }] })) };
  const { container } = render(<StudySheetSimple studySheet={longSheet} />);
  const disclosure = container.querySelector('.sheet-contents');
  expect(disclosure.open).toBe(false);
  expect(screen.getByText('View sections')).toBeTruthy();
  const heading = screen.getByRole('button', { name: /Rapid progressive glomerulonephritis \(RPGN\)/ });
  fireEvent.click(heading);
  expect(heading.getAttribute('aria-expanded')).toBe('false');
  disclosure.open = true;
  fireEvent.click(screen.getByRole('link', { name: /Rapid progressive glomerulonephritis \(RPGN\)/ }));
  expect(disclosure.open).toBe(false);
  expect(heading.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText('Section 2 explanation')).toBeTruthy();
});

test('streaming and failed sheets never offer completed PDF downloads', () => {
  const { rerender } = render(<StudySheetSimple studySheet={sheet} isStreaming />);
  expect(screen.queryByRole('button', { name: 'Download PDF' })).toBeNull();
  rerender(<StudySheetSimple studySheet={sheet} error="Please retry" />);
  expect(screen.queryByText('Ready to review')).toBeNull();
  expect(screen.getByRole('alert').textContent).toBe('Please retry');
});

test('old French headings, tables and lists remain usable without executing HTML', () => {
  const content = 'ÉVALUATION RÉNALE\n\nConcepts clés:\n1. Premier\n2. Deuxième\n\n| Marqueur | Rôle |\n| --- | --- |\n| A | Filtration |\n\n<script>alert(1)</script>';
  const legacy = legacyStudySheet('Ancienne fiche', content, 'french');
  expect(legacy.sections[0].title).toBe('ÉVALUATION RÉNALE');
  expect(legacy.sections[0].blocks.find(b => b.kind === 'table').rows).toEqual([['A', 'Filtration']]);
  const { container } = render(<StudySheetSimple content={content} topic="Ancienne fiche" />);
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelectorAll('li').length).toBe(2);
});

test('retry clears partial structured and text content and completion persists the final schema', () => {
  const start = { id: 's1', content: 'partial', studySheet: sheet, isStreaming: true };
  const reset = updateStudySheetMessage(start, { status: 'study_sheet_reset' });
  expect(reset.content).toBe(''); expect(reset.studySheet).toBeNull();
  const header = updateStudySheetMessage(reset, { status: 'study_sheet_header', studySheet: { ...sheet, sections: [] } });
  const section = { status: 'study_sheet_section', section: sheet.sections[0] };
  const next = updateStudySheetMessage(updateStudySheetMessage(header, section), section);
  expect(next.studySheet.sections).toHaveLength(1);
  const complete = updateStudySheetMessage(next, { status: 'study_sheet_complete', studySheet: sheet, content: 'Final explanation' });
  expect(savedStudySheetMessage(complete).studySheet).toEqual(sheet);
  expect(savedStudySheetMessage(complete).isStreaming).toBeUndefined();
});

test('PDF names retain accents and remove unsafe filename characters', () => {
  expect(sheetFilename('Évaluation rénale / filtrations?')).toBe('Évaluation_rénale_filtrations.pdf');
  expect(sheetFilename()).toBe('Study_sheet.pdf');
});
