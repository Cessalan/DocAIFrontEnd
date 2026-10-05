import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudyPlanInspector from './StudyPlanInspector';
import StudyInspectorLink from './StudyInspectorLink';
import { adminRequest } from '../../Services/AdminService';

jest.mock('react-router-dom', () => ({ useParams: () => ({ chatId: 'old-plan' }), Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock('react-markdown', () => ({ children }) => <div>{children}</div>);
jest.mock('../../Services/AdminService', () => ({ adminRequest: jest.fn() }));

beforeEach(() => {
  adminRequest.mockReset();
  adminRequest.mockImplementation(url => {
    if (url.endsWith('/old-plan')) return Promise.resolve({ chat: { title: 'Existing cardiac plan', study: { path: { nodes: [
      { id: 'n1', label: 'Prioritization', status: 'done', messageId: 'm1', reason: 'Practise first actions' },
      { id: 'n2', label: 'Untouched step', status: 'locked' },
    ] } } }, owner: { email: 'student@example.com' }, performance: {} });
    if (url.endsWith('/messages')) return Promise.resolve({ items: [{ id: 'm1', nodeId: 'n1', type: 'study_exam', timestamp: '2026-09-20T12:00:00Z' }], cursor: 'm1' });
    if (url.includes('?cursor=')) return Promise.resolve({ items: [{ id: 'm2', role: 'user', preview: 'Can you explain?', timestamp: '2026-09-20T12:10:00Z' }], cursor: null });
    if (url.endsWith('/messages/m1')) return Promise.resolve({ message: { id: 'm1', type: 'study_exam', timestamp: '2026-09-20T12:00:00Z',
      studyContent: { questions: [{ question: 'What should the nurse do first?', options: ['Assess', 'Act'], correctIndex: 0, rationale: 'Assess before acting.' }] },
      quizProgress: { firstAttemptAnswers: { 0: { correct: false, recordedAt: '2026-09-19T12:00:00Z' } } } },
      discussions: [{ id: '0', history: [{ role: 'user', content: 'I thought acting was first.' }, { role: 'assistant', content: 'Look for the missing assessment.' }] }], summaries: [] });
    return Promise.reject(new Error('Unexpected request: ' + url));
  });
});

test('reads an existing plan, all history pages, questions and saved AI discussions without mutations', async () => {
  render(<StudyPlanInspector />);
  expect(await screen.findByText('What happened in this plan?')).toBeInTheDocument();
  await waitFor(() => expect(adminRequest.mock.calls.some(([url]) => url.includes('?cursor=m1'))).toBe(true));
  expect(adminRequest.mock.calls.some(([url]) => url.endsWith('/messages/m1'))).toBe(false);
  fireEvent.click(screen.getAllByRole('button', { name: /Prioritization/ })[0]);
  expect(await screen.findByText('What this practice shows')).toBeInTheDocument();
  expect(screen.getByText('Look for the missing assessment.')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Missed (0)' }));
  expect(screen.getByText('No questions match this filter.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Discussed (1)' }));
  fireEvent.click(screen.getByText(/Inspect question, answers and help/));
  expect(screen.getByText('Look for the missing assessment.')).toBeVisible();
  expect(screen.getByText(/first-answer record predates/)).toBeInTheDocument();
  expect(screen.getByText('Practise first actions')).toBeInTheDocument();
  await waitFor(() => expect(adminRequest.mock.calls.some(([url]) => url.includes('?cursor=m1'))).toBe(true));
  expect(adminRequest.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /Untouched step/ }));
  expect(screen.getByText('No content saved for this step')).toBeInTheDocument();
  expect(adminRequest.mock.calls.some(([url]) => /generate|study\/start/.test(url))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Activity timeline' }));
  expect(screen.getByText('Student message saved')).toBeInTheDocument();
});

test('explains history read failures and offers a retry', async () => {
  adminRequest.mockRejectedValue(new Error('Admin access is required.'));
  render(<StudyPlanInspector />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Admin access is required.');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

test('opens the inspector in a separate admin window', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  render(<StudyInspectorLink chatId="old-plan" />);
  fireEvent.click(screen.getByRole('link'));
  expect(open).toHaveBeenCalledWith('/admin/study-plans/old-plan', '_blank', expect.stringContaining('noopener'));
  open.mockRestore();
});
