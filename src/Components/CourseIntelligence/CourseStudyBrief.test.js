import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '../../i18n/i18n';
import CourseStudyBrief from './CourseStudyBrief';
import { normalizeReport } from './courseIntelligenceModel';
import { studioReport, studioQuestions, studioFiles } from './__fixtures__/courseStudio';
import { plan_diagnostic_quiz } from '../../Services/FastAPICalls';
import { updateStudyPerformance } from '../../Services/StudySessionService';

jest.mock('../../Services/FastAPICalls', () => ({ plan_diagnostic_quiz: jest.fn() }));
jest.mock('../../Services/StudySessionService', () => ({ updateStudyPerformance: jest.fn().mockResolvedValue({}) }));
jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: { REPORT_VIEWED: 'report_viewed', DIAGNOSTIC_STARTED: 'diagnostic_started', DIAGNOSTIC_COMPLETED: 'diagnostic_completed', REVEAL_VIEWED: 'reveal_viewed' },
  logFunnelStep: jest.fn(), logFunnelStepOnce: jest.fn(),
}));

const report = normalizeReport(studioReport);
const mount = (props = {}) => {
  const onStart = jest.fn();
  const rendered = render(<CourseStudyBrief report={report} chatId="studio-chat" filenames={studioFiles} daysToExam={14} onStart={onStart} {...props} />);
  return { ...rendered, onStart };
};
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  jest.clearAllMocks();
  plan_diagnostic_quiz.mockResolvedValue(studioQuestions);
});

it('lets the streamlined flow build without a date or a separate report', async () => {
  const { onStart } = mount({ streamlined: true, initialPhase: 'check' });
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Continue with what you know about me' }));
  expect(screen.getByRole('heading', { name: /From your notes, let’s start with/ })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /Web sources/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Build my study plan/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'I don’t know yet' }));
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ examDate: null, diagnostic: null }));
});

it('prepares questions from course priorities while the student reads the brief', async () => {
  mount();
  await flush();
  expect(screen.getByRole('heading', { name: 'Your course, made clearer.' })).toBeInTheDocument();
  expect(screen.getByText('6 questions · no grades')).toBeInTheDocument();
  expect(plan_diagnostic_quiz).toHaveBeenCalledWith('studio-chat', [], 'en', {}, expect.objectContaining({ priorityTopics: report.strategy.orderedTopics.slice(0, 3) }));
  expect(screen.queryByRole('button', { name: 'Show me my plan' })).not.toBeInTheDocument();
});

it('turns first-attempt answers into the same recommended order handed to the planner', async () => {
  const { onStart } = mount();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: /Find my starting point/ }));
  for (const [index, choice] of [0, 1, 'unsure', 'unsure', 0, 'unsure'].entries()) {
    const group = screen.getByRole('group');
    const buttons = within(group).getAllByRole('button');
    fireEvent.click(choice === 'unsure' ? within(group).getByText('I’m not sure yet') : buttons[choice]);
    expect(buttons[0]).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: index === 5 ? /See my starting point/ : /Next question/ }));
  }
  expect(screen.getByRole('heading', { name: 'Your answers changed the starting point.' })).toBeInTheDocument();
  const list = screen.getAllByRole('list').find(node => node.classList.contains('cs-route-list'));
  expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Fluid & electrolytes');
  expect(screen.getByText('Not checked yet')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Build my study plan/ }));
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(onStart.mock.calls[0][0]).toEqual(expect.objectContaining({
    diagnostic: { 'Cardiovascular medications': 100, 'Fluid & electrolytes': 0, 'Endocrine care': 50 },
    focusTopics: ['Fluid & electrolytes', 'Endocrine care'],
  }));
  await flush();
  expect(updateStudyPerformance).toHaveBeenCalledTimes(6);
});

it('retains an already revealed answer when the student skips the remaining questions', async () => {
  const { onStart } = mount();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: /Find my starting point/ }));
  fireEvent.click(screen.getByRole('button', { name: /I’m not sure yet/ }));
  fireEvent.click(screen.getByRole('button', { name: /Continue with what you know/ }));
  fireEvent.click(screen.getByRole('button', { name: /Build my study plan/ }));
  expect(onStart.mock.calls[0][0].diagnostic).toEqual({ 'Cardiovascular medications': 0 });
  expect(onStart.mock.calls[0][0].answers).toHaveLength(1);
});

it('keeps the active question and answer when the interface language changes', async () => {
  const { rerender, onStart } = mount();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: /Find my starting point/ }));
  fireEvent.click(screen.getByRole('button', { name: /I’m not sure yet/ }));
  rerender(<CourseStudyBrief report={report} chatId="studio-chat" language="fr" onStart={onStart} />);
  await flush();
  expect(plan_diagnostic_quiz).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading', { name: studioQuestions.questions[0].question })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Continue with what you know/ }));
  fireEvent.click(screen.getByRole('button', { name: /Build my study plan/ }));
  expect(onStart.mock.calls[0][0].diagnostic).toEqual({ 'Cardiovascular medications': 0 });
});

it('skipping leaves every untested topic unscored and does not write performance', async () => {
  const { onStart } = mount();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: /Build a plan without/ }));
  fireEvent.click(screen.getByRole('button', { name: /Build my study plan/ }));
  expect(onStart.mock.calls[0][0].diagnostic).toBeNull();
  expect(updateStudyPerformance).not.toHaveBeenCalled();
  expect(plan_diagnostic_quiz.mock.calls[0][4].signal.aborted).toBe(true);
});

it('a late request cannot replace the result after the student skips', async () => {
  let resolve;
  plan_diagnostic_quiz.mockReturnValue(new Promise(r => { resolve = r; }));
  mount();
  fireEvent.click(screen.getByRole('button', { name: /Build a plan without/ }));
  await act(async () => { resolve(studioQuestions); });
  expect(screen.getByRole('heading', { name: 'A clear place to begin.' })).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: studioQuestions.questions[0].question })).not.toBeInTheDocument();
});

it('times out and still offers a course-based plan', async () => {
  jest.useFakeTimers();
  try {
    plan_diagnostic_quiz.mockReturnValue(new Promise(() => {}));
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Find my starting point/ }));
    act(() => { jest.advanceTimersByTime(25001); });
    expect(screen.getByText(/quick check isn’t available/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue with what you know/ }));
    expect(screen.getByRole('button', { name: /Build my study plan/ })).toBeEnabled();
  } finally { jest.useRealTimers(); }
});

it('rejects malformed question keys and preserves the escape route', async () => {
  plan_diagnostic_quiz.mockResolvedValue({ questions: [{ ...studioQuestions.questions[0], correctIndex: -1 }] });
  mount();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: /Find my starting point/ }));
  expect(screen.getByText(/quick check isn’t available/)).toBeInTheDocument();
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
});

it('aborts on unmount and does not start a plan twice', async () => {
  const { onStart, unmount } = mount();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: /Build a plan without/ }));
  const button = screen.getByRole('button', { name: /Build my study plan/ });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(onStart).toHaveBeenCalledTimes(1);
  unmount();
  expect(plan_diagnostic_quiz.mock.calls[0][4].signal.aborted).toBe(true);
});
