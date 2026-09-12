import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NclexArrival from './NclexArrival';
import { todaysPlanRow } from './NclexHome';
import { readIntent, commitIntent } from '../../Services/NclexHandoffService';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('from=pharmacology-nclex-questions')],
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, a, b) => {
      const opts = typeof a === 'object' ? a : b || {};
      let s = typeof a === 'string' ? a : opts.defaultValue || key;
      Object.entries(opts).forEach(([k, v]) => { s = s.replace(`{{${k}}}`, v); });
      return s;
    },
    i18n: { language: 'en' },
  }),
}));
jest.mock('../../Contexts/AuthContext/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'u1' }, isLoading: false }),
}));
jest.mock('../../Services/NclexService', () => ({
  loadMeta: jest.fn().mockResolvedValue(null),
  saveMeta: jest.fn(),
  daysUntil: () => null,
}));
jest.mock('../../Services/SeoMiniProductService', () => ({ trackSeo: jest.fn() }));
jest.mock('../../Services/NclexHandoffService', () => ({
  readIntent: jest.fn(),
  commitIntent: jest.fn(),
  sessionParamsFor: (intent, count) =>
    `subject=${intent.subject}&area=${encodeURIComponent(intent.area)}&count=${count}&from=seo`,
  INTENT_TTL_MS: 14 * 86400000,
}));
jest.mock('../Common/DatePicker', () => () => null, { virtual: true });
jest.mock('../../assets/favicon.svg', () => ({ ReactComponent: () => <svg /> }), { virtual: true });

const intent = {
  at: Date.now(),
  kind: 'diagnostic',
  sourcePage: 'pharmacology-nclex-questions',
  examTrack: 'RN',
  subject: 'pharmacology',
  area: 'Adverse effects & interactions',
  category: 'PHAR',
  missedConcepts: ['Diuretic adverse effects', 'Medication interactions'],
  score: { correct: 2, total: 4, percentage: 50 },
  attempts: [],
};

beforeEach(() => {
  mockNavigate.mockClear();
  readIntent.mockReturnValue(intent);
  commitIntent.mockImplementation(async () => readIntent());
});

test('shows her landing-page result back to her and proposes the focused session', async () => {
  render(<NclexArrival />);
  expect(await screen.findByText('You got 2 of 4 on pharmacology.')).toBeVisible();
  expect(screen.getByText('50%')).toBeVisible();
  expect(screen.getByText('Diuretic adverse effects')).toBeVisible();
  expect(screen.getByText('Pharmacology · Adverse effects & interactions')).toBeVisible();
  expect(commitIntent).toHaveBeenCalledWith('u1');

  fireEvent.click(screen.getByRole('button', { name: /Start my adverse effects/ }));
  expect(mockNavigate).toHaveBeenCalledWith(
    '/nclex/practice?subject=pharmacology&area=Adverse%20effects%20%26%20interactions&count=10&from=seo'
  );
});

test('with nothing to show it forwards to the home page instead of greeting an empty result', async () => {
  readIntent.mockReturnValue(null);
  render(<NclexArrival />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/nclex', { replace: true }));
});

test('a planner handoff leads with the plan and starts today', async () => {
  readIntent.mockReturnValue({
    ...intent,
    kind: 'planner',
    subject: 'pediatrics',
    area: null,
    missedConcepts: [],
    score: null,
    plan: { days: 28, minutes: 60, priorities: ['Pediatrics', 'Pharmacology'], examDate: null },
  });
  render(<NclexArrival />);
  expect(await screen.findByText('Your 28-day NCLEX-RN plan lives here now.')).toBeVisible();
  expect(screen.getByRole('button', { name: /Start today's practice/ })).toBeVisible();
});

describe('todaysPlanRow', () => {
  const rows = [
    { date: '2026-09-10', title: 'Day 1' },
    { date: '2026-09-11', title: 'Day 2' },
    { date: '2026-09-12', title: 'Day 3' },
  ];
  it('picks today', () => {
    expect(todaysPlanRow({ plan: { rows } }, new Date(2026, 8, 11)).title).toBe('Day 2');
  });
  it('shows the first day before the plan starts and nothing after it ends', () => {
    expect(todaysPlanRow({ plan: { rows } }, new Date(2026, 8, 1)).title).toBe('Day 1');
    expect(todaysPlanRow({ plan: { rows } }, new Date(2026, 8, 20))).toBeNull();
  });
  it('is null without a plan', () => {
    expect(todaysPlanRow(null)).toBeNull();
  });
});
