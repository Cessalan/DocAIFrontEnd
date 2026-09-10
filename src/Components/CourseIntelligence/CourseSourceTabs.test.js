import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '../../i18n/i18n';
import CourseSourceTabs from './CourseSourceTabs';

const report = { materials: { filenames: ['Lecture.pdf'], fileCount: 1, topics: [
  { topic: 'Assessment', files: ['Lecture.pdf'] }, { topic: 'Unrelated', files: ['Other.pdf'] },
] } };
const withWeb = { ...report, resources: { resources: [{ title: 'Assessment reference', url: 'https://example.edu/guide', why: 'Clinical assessment guidance.' }] },
  course: { citations: [{ title: 'Duplicate', url: 'https://example.edu/guide' }, { title: 'Invalid', url: 'data:text/html,no' }] } };

it('shows associated file topics and hides an empty Web tab', () => {
  render(<CourseSourceTabs report={report} filenames={['Lecture.pdf']} />);
  expect(screen.getAllByRole('tab')).toHaveLength(1);
  expect(screen.getByRole('tab', { name: 'Your documents 1' })).toHaveAttribute('aria-selected', 'true');
  expect(within(screen.getByRole('tabpanel')).getByText('Assessment')).toBeInTheDocument();
  expect(screen.queryByText('Unrelated')).not.toBeInTheDocument();
});

it('adds Web results without stealing selection and supports keyboard navigation', () => {
  const { rerender } = render(<CourseSourceTabs report={report} />);
  rerender(<CourseSourceTabs report={withWeb} />);
  const docs = screen.getByRole('tab', { name: 'Your documents 1' });
  const web = screen.getByRole('tab', { name: 'Web sources 1' });
  expect(docs).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(docs, { key: 'ArrowRight' });
  expect(web).toHaveFocus();
  expect(web).toHaveAttribute('aria-selected', 'true');
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link', { name: /Assessment reference/ })).toHaveAttribute('href', 'https://example.edu/guide');
  fireEvent.keyDown(web, { key: 'Home' });
  expect(docs).toHaveFocus();
  expect(docs).toHaveAttribute('aria-selected', 'true');
});

it('limits previews to two items and restores focus after viewing the complete source list', () => {
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
  try {
    const many = { ...report, resources: { resources: [1, 2, 3, 4].map(index => ({ title: `Source ${index}`, url: `https://example.edu/${index}` })) } };
    render(<CourseSourceTabs report={many} filenames={['One.pdf', 'Two.pdf', 'Three.pdf']} />);
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /View all 4 documents/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Web sources/ }));
    expect(screen.getAllByRole('link')).toHaveLength(2);
    const opener = screen.getByRole('button', { name: /View all 4 sources/ });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Web sources' });
    expect(within(dialog).getAllByRole('link')).toHaveLength(4);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close sources' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  } finally {
    if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal);
    else delete HTMLDialogElement.prototype.showModal;
    if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close);
    else delete HTMLDialogElement.prototype.close;
  }
});
