import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingPractice from './LandingPractice';
import catalog from './catalog.json';
import { fetchResultNote, trackSeo } from '../../Services/SeoMiniProductService';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), Link: ({ children }) => <a href="/">{children}</a> }), { virtual: true });
jest.mock('../../Services/SeoMiniProductService', () => ({
  trackSeo: jest.fn(),
  readLocal: jest.fn(),
  writeLocal: jest.fn(),
  continueSeo: jest.fn(),
  loadSavedProduct: jest.fn().mockResolvedValue(null),
  fetchResultNote: jest.fn().mockResolvedValue(null),
}));

const currentQuestion = () => {
  const stem = screen.getByRole('heading', { level: 2 }).textContent;
  return catalog.questions.find((q) => q.stem === stem);
};
const answer = () => {
  fireEvent.click(screen.getAllByRole('radio')[currentQuestion().answer[0]]);
  fireEvent.click(screen.getByRole('button', { name: /Check my answer/ }));
};

beforeEach(() => {
  trackSeo.mockClear();
  fetchResultNote.mockResolvedValue(null);
});

test('a question is ready to answer with no start button', () => {
  render(<LandingPractice />);
  expect(screen.getByRole('button', { name: /Check my answer/ })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Start practice/ })).not.toBeInTheDocument();
});

test('appearing on the homepage does not take focus or count as a start', () => {
  render(<LandingPractice />);
  expect(screen.getByRole('heading', { level: 2 })).not.toHaveFocus();
  expect(trackSeo).not.toHaveBeenCalled();
});

test('the first checked answer counts as the start, once', () => {
  render(<LandingPractice />);
  answer();
  fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
  answer();
  const starts = trackSeo.mock.calls.filter(([step]) => step === 'seo_mini_product_started');
  expect(starts).toHaveLength(1);
  expect(starts[0][2].via).toBe('embedded');
});

test('the set ends after three questions by offering the patient cases', () => {
  render(<LandingPractice />);
  answer();
  fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
  answer();
  fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
  answer();
  fireEvent.click(screen.getByRole('button', { name: /See my takeaways/ }));
  expect(screen.getByText(/3\/3 correct/)).toBeVisible();
  expect(screen.getByRole('button', { name: /Try a patient case/ })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /Keep building in NurseQuiz/ })).not.toBeInTheDocument();
});
