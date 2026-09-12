import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SeoMiniProduct, { Diagnostic } from './SeoMiniProduct';
import catalog from './catalog.json';
import { fetchResultNote, loadSavedProduct, readLocal, writeLocal } from '../../Services/SeoMiniProductService';
jest.mock('react-router-dom', () => ({ MemoryRouter: ({ children }) => <>{children}</>, Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>, useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('../../Services/SeoMiniProductService', () => ({ trackSeo: jest.fn(), readLocal: jest.fn(), writeLocal: jest.fn(), continueSeo: jest.fn(), loadSavedProduct: jest.fn().mockResolvedValue(null), fetchResultNote: jest.fn().mockResolvedValue(null) }));
beforeEach(() => {
  loadSavedProduct.mockResolvedValue(null);
  fetchResultNote.mockReset();
  fetchResultNote.mockResolvedValue(null);
  readLocal.mockReset();
  writeLocal.mockClear();
});
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function completeSet(bank, count, root = screen) {
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    const stem = root.getByRole('heading', { level: 2 }).textContent;
    const q = bank.find(item => item.stem === stem);
    ids.push(q.id);
    fireEvent.click(root.getByLabelText(new RegExp(escapeRegExp(q.options[q.answer[0]]))));
    fireEvent.click(root.getByRole('button', { name: /Check my answer/ }));
    fireEvent.click(root.getByRole('button', { name: i === count - 1 ? /See my takeaways/ : /Next question/ }));
  }
  return ids;
}
test('a visitor generates a dated plan without authentication', () => {
  render(<MemoryRouter><SeoMiniProduct slug="nclex-study-plan" /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: '2 weeks' }));
  fireEvent.click(screen.getAllByRole('button', { name: /Build my plan/ })[1]);
  expect(screen.getByText('14 days of focused review')).toBeVisible();
  expect(screen.getByRole('button', { name: /Save my plan/ })).toBeEnabled();
});
test('rationale stays hidden until an answer is committed; completion reports evidence', () => {
  const page = catalog.pages.find(p => p.slug === 'hesi-a2-practice-test');
  const q = catalog.questions[0];
  render(<MemoryRouter><Diagnostic page={page} initialQuestions={[q]} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Start practice/ }));
  expect(screen.queryByText(q.why)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Check my answer/ })).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/1\/8/));
  fireEvent.click(screen.getByRole('button', { name: /Check my answer/ }));
  expect(screen.getByText(q.why)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /See my takeaways/ }));
  expect(screen.getByText('1/1 correct on your first pass.')).toBeVisible();
  expect(screen.queryByText('Start your review here')).not.toBeInTheDocument();
});
test('a page bank serves a sized set, remembers it, and "keep going" brings unseen questions', () => {
  const page = catalog.pages.find(p => p.slug === 'cardiac-nclex-questions');
  const bank = catalog.questions.filter(q => catalog.banks[page.slug].includes(q.id));
  render(<MemoryRouter><Diagnostic page={page} /></MemoryRouter>);
  expect(screen.getByText(/Each visit draws a fresh set of 6/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Start practice/ }));
  const firstIds = completeSet(bank, 6);
  expect(new Set(firstIds).size).toBe(6);
  expect(writeLocal).toHaveBeenCalledWith('seen:cardiac-nclex-questions', expect.objectContaining({ ids: expect.arrayContaining(firstIds), lastSet: expect.arrayContaining(firstIds) }));
  expect(screen.queryByText('Strongest signal')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Practice my weak areas|Keep building in NurseQuiz/ })).toBeVisible();
  expect(screen.getByRole('button', { name: /Next 4 questions/ })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Next 4 questions/ }));
  const secondIds = completeSet(bank, 4);
  expect(secondIds.every(id => !firstIds.includes(id))).toBe(true);
  expect(screen.getByRole('button', { name: /Shuffle and go again/ })).toBeEnabled();
});
test('a returning visit prefers questions not on the saved seen list', () => {
  const page = catalog.pages.find(p => p.slug === 'cardiac-nclex-questions');
  const bank = catalog.questions.filter(q => catalog.banks[page.slug].includes(q.id));
  const seenIds = bank.slice(0, 6).map(q => q.id);
  readLocal.mockImplementation(key => (key === 'seen:cardiac-nclex-questions' ? { ids: seenIds, lastSet: seenIds } : null));
  render(<MemoryRouter><Diagnostic page={page} /></MemoryRouter>);
  expect(screen.getByText(/4 you haven’t seen yet/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Start practice/ }));
  const ids = completeSet(bank, 6);
  expect(ids.filter(id => !seenIds.includes(id))).toHaveLength(4);
});
test('the hero CTA opens the quiz instead of scrolling to a second start button', () => {
  const page = catalog.pages.find(p => p.slug === 'cardiac-nclex-questions');
  const bank = catalog.questions.filter(q => catalog.banks[page.slug].includes(q.id));
  render(<MemoryRouter><SeoMiniProduct slug={page.slug} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Start cardiac practice/ }));
  const dialog = screen.getByRole('dialog', { name: page.title });
  expect(within(dialog).queryByRole('button', { name: /Start practice/ })).not.toBeInTheDocument();
  const stem = within(dialog).getByRole('heading', { level: 2 }).textContent;
  expect(bank.some(q => q.stem === stem)).toBe(true);
  completeSet(bank, 6, within(dialog));
  expect(within(dialog).getByRole('button', { name: /Practice my weak areas|Keep building in NurseQuiz/ })).toBeVisible();
});
test('a finished set keeps the original takeaway when the tutor note is unavailable', async () => {
  fetchResultNote.mockResolvedValue(null);
  const page = catalog.pages.find(p => p.slug === 'hesi-a2-practice-test');
  const q = catalog.questions[0];
  render(<MemoryRouter><Diagnostic page={page} initialQuestions={[q]} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Start practice/ }));
  fireEvent.click(screen.getByLabelText(/1\/8/));
  fireEvent.click(screen.getByRole('button', { name: /Check my answer/ }));
  fireEvent.click(screen.getByRole('button', { name: /See my takeaways/ }));
  expect(screen.getByText('one useful takeaway')).toBeVisible();
  expect(screen.getByText('This set held. A longer session will tell you if it was a pattern or a lucky pass.')).toBeVisible();
  expect(screen.queryByText('a note for you')).not.toBeInTheDocument();
  await waitFor(() => expect(fetchResultNote).toHaveBeenCalled());
});
test('a finished set replaces the takeaway with the tutor note', async () => {
  fetchResultNote.mockResolvedValue('You held the circulation path. Look once more at medication safety, then try another short set.');
  const page = catalog.pages.find(p => p.slug === 'hesi-a2-practice-test');
  const q = catalog.questions[0];
  render(<MemoryRouter><Diagnostic page={page} initialQuestions={[q]} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Start practice/ }));
  fireEvent.click(screen.getByLabelText(/1\/8/));
  fireEvent.click(screen.getByRole('button', { name: /Check my answer/ }));
  fireEvent.click(screen.getByRole('button', { name: /See my takeaways/ }));
  await waitFor(() => expect(screen.getByText(/You held the circulation path/)).toBeVisible());
  expect(fetchResultNote).toHaveBeenCalledWith(expect.objectContaining({
    title: page.title,
    items: [expect.objectContaining({ concept: q.concept, correct: true })]
  }));
});
test('coverage lists unique concepts, not question stems', () => {
  const page = catalog.pages.find(p => p.slug === 'pharmacology-nclex-questions');
  const bank = catalog.questions.filter(q => catalog.banks[page.slug].includes(q.id));
  render(<MemoryRouter><SeoMiniProduct slug={page.slug} /></MemoryRouter>);
  bank.forEach(q => expect(screen.queryByText(q.stem)).not.toBeInTheDocument());
  expect(screen.getAllByRole('heading', { level: 3, name: 'Anticoagulant safety' })).toHaveLength(1);
});
