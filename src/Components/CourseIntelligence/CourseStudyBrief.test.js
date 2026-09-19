import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '../../i18n/i18n';
import CourseStudyBrief from './CourseStudyBrief';
import { normalizeReport } from './courseIntelligenceModel';
import { studioReport, studioQuestions, studioFiles } from './__fixtures__/courseStudio';
import { plan_diagnostic_quiz } from '../../Services/FastAPICalls';
import { updateStudyPerformance, saveQuickCheckRecord } from '../../Services/StudySessionService';

jest.mock('../../Services/FastAPICalls', () => ({ plan_diagnostic_quiz: jest.fn() }));
jest.mock('../../Services/StudySessionService', () => ({ updateStudyPerformance: jest.fn().mockResolvedValue({}), saveQuickCheckRecord: jest.fn().mockResolvedValue('check') }));
jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: {
    REPORT_VIEWED: 'report_viewed', DIAGNOSTIC_STARTED: 'diagnostic_started', DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
    WEAKNESS_INSIGHT_VIEWED: 'weakness_insight_viewed', REVEAL_VIEWED: 'reveal_viewed', READINESS_CHECK_STARTED: 'readiness_check_started',
  },
  logFunnelStep: jest.fn(), logFunnelStepOnce: jest.fn(),
}));
const { logFunnelStep } = jest.requireMock('../../Services/FunnelService');

const report = normalizeReport(studioReport);
const mount = (props = {}) => {
  const onStart = jest.fn();
  const rendered = render(<CourseStudyBrief report={report} chatId="studio-chat" filenames={studioFiles} daysToExam={14} onStart={onStart} {...props} />);
  return { ...rendered, onStart };
};
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  jest.clearAllMocks();
  saveQuickCheckRecord.mockResolvedValue('check');
  plan_diagnostic_quiz.mockResolvedValue(studioQuestions);
});

it('persists the committed quick-check answer and retries the same baseline on save failure', async () => {
  saveQuickCheckRecord.mockRejectedValueOnce(new Error('Temporary failure'));
  mount({ streamlined: true, initialPhase: 'check' });
  await flush();
  fireEvent.click(screen.getByRole('button', { name: /I’m not sure yet/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue with what you know about me' }));
  await flush();
  expect(saveQuickCheckRecord).toHaveBeenCalledTimes(2);
  const record = saveQuickCheckRecord.mock.calls[0][0];
  expect(saveQuickCheckRecord.mock.calls[1][0]).toBe(record);
  expect(record.toJSON()).toMatchObject({ chatId: 'studio-chat', answered: 1, completion: 'ended_early', answers: [expect.objectContaining({ selection: 'unsure', unsure: true, correct: false, source: 'quick_check', attempt: 1 })] });
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

it('runs select-all and case-study questions, grading select-all as all-or-nothing', async () => {
  const [first, second, third] = studioQuestions.questions;
  const mixed = { questions: [
    first,
    { ...second, question: 'Which findings need follow-up? Select all that apply.', format: 'sata', kind: 'sata',
      options: ['Finding A', 'Finding B', 'Finding C', 'Finding D', 'Finding E'], correctIndices: [0, 2], correctIndex: undefined },
    { ...third, question: 'What should the nurse do next?', format: 'casestudy', kind: 'casestudy',
      scenario: 'A patient on the unit reports new symptoms after a medication change this morning.' },
  ] };
  mount({ initialQuiz: mixed, initialPhase: 'check', funnelId: 'f_upload' });
  await flush();
  expect(logFunnelStep).toHaveBeenCalledWith('readiness_check_started', expect.objectContaining({
    funnelId: 'f_upload', questionCount: 3, mcqCount: 1, sataCount: 1, casestudyCount: 1,
  }));
  expect(screen.getByText(/harder than recall on purpose/)).toBeInTheDocument();

  // 1 — single answer, right.
  fireEvent.click(within(screen.getByRole('group')).getAllByRole('button')[first.correctIndex]);
  fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
  expect(screen.queryByText(/harder than recall on purpose/)).toBeNull();

  // 2 — select-all: nothing is revealed until she checks, and one right plus
  // one wrong is wrong, but remembered as partial.
  expect(screen.getByText('Select all')).toBeInTheDocument();
  const check = screen.getByRole('button', { name: 'Check my answer' });
  expect(check).toBeDisabled();
  const group = screen.getByRole('group');
  fireEvent.click(within(group).getByText('Finding A'));
  fireEvent.click(within(group).getByText('Finding B'));
  expect(screen.queryByText('Correct answers')).toBeNull();
  fireEvent.click(check);
  expect(screen.getByText('Correct answers')).toBeInTheDocument();
  expect(screen.getByText(/You had part of this/)).toBeInTheDocument();
  expect(within(screen.getByRole('status')).getByText('Finding C')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Next question/ }));

  // 3 — the case study carries its scenario above the question.
  expect(screen.getByText(/new symptoms after a medication change/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('I’m not sure yet'));
  fireEvent.click(screen.getByRole('button', { name: /See my starting point/ }));
  await flush();
  await flush();

  expect(updateStudyPerformance.mock.calls.map(call => call[1].format)).toEqual(['mcq', 'sata', 'casestudy']);
  expect(updateStudyPerformance.mock.calls.map(call => call[1].correct)).toEqual([true, false, false]);
  expect(logFunnelStep).toHaveBeenCalledWith('diagnostic_completed', expect.objectContaining({
    funnelId: 'f_upload', answered: 3, mcqCorrect: 1, sataAnswered: 1, sataCorrect: 0, sataPartial: 1, casestudyAnswered: 1,
  }));
});

it('grades a fully right select-all answer as correct', async () => {
  const [first] = studioQuestions.questions;
  const sata = { ...first, question: 'Pick every sign. Select all that apply.', format: 'sata', kind: 'sata',
    options: ['Sign A', 'Sign B', 'Sign C', 'Sign D', 'Sign E'], correctIndices: [1, 3], correctIndex: undefined };
  const { onStart } = mount({ initialQuiz: { questions: [sata] }, initialPhase: 'check' });
  await flush();
  const group = screen.getByRole('group');
  fireEvent.click(within(group).getByText('Sign D'));
  fireEvent.click(within(group).getByText('Sign B'));
  fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }));
  expect(screen.queryByText(/You had part of this/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /See my starting point/ }));
  fireEvent.click(screen.getByRole('button', { name: /Build my study plan/ }));
  expect(onStart.mock.calls[0][0].answers[0]).toEqual(expect.objectContaining({ correct: true, partial: false, format: 'sata' }));
});

it.each(['free', 'pro', 'exhausted'])('shows findings before dates and plan creation for %s users', async (tier) => {
  const usage = require('../../Contexts/UsageContext/UsageContext');
  const spy = jest.spyOn(usage, 'useUsageLimit').mockReturnValue({
    consume: jest.fn().mockResolvedValue({}), isPro: tier === 'pro',
    canCreatePlan: tier !== 'exhausted', remaining: tier === 'exhausted' ? 0 : 40,
  });
  try {
    const questions = studioQuestions.questions.slice(0, 2);
    const { onStart } = mount({ streamlined: true, initialPhase: 'check', initialQuiz: { questions }, funnelId: 'free-findings' });
    await flush();
    fireEvent.click(within(screen.getByRole('group')).getAllByRole('button')[questions[0].correctIndex]);
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
    fireEvent.click(screen.getByText('I’m not sure yet'));
    fireEvent.click(screen.getByRole('button', { name: /See my starting point/ }));
    expect(screen.getByRole('heading', { name: 'What your quick check showed' })).toHaveFocus();
    expect(screen.getByText('1 of 2 answers correct on your first try.')).toBeInTheDocument();
    expect(screen.getByText('cardiac output')).toBeInTheDocument();
    expect(screen.getByText('Early signal')).toBeInTheDocument();
    expect(screen.queryByText('When is your exam?')).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
    expect(logFunnelStep).toHaveBeenCalledWith('weakness_insight_viewed', expect.objectContaining({ via: 'quick_check', funnelId: 'free-findings', answered: 2 }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to my plan/ }));
    expect(screen.getByText('When is your exam?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I don’t know yet' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      examDate: null, diagnostic: { 'Cardiovascular medications': 50 },
      answers: expect.arrayContaining([expect.objectContaining({ correct: false, unsure: true })]),
    }));
    expect(logFunnelStep.mock.calls.filter(([event]) => event === 'weakness_insight_viewed')).toHaveLength(1);
  } finally { spy.mockRestore(); }
});

it('shows a single answered question as early evidence when the rest is skipped', async () => {
  mount({ streamlined: true, initialPhase: 'check', initialQuiz: studioQuestions });
  fireEvent.click(screen.getByText('I’m not sure yet'));
  fireEvent.click(screen.getByRole('button', { name: /Continue with what you know/ }));
  expect(screen.getByText('0 of 1 answers correct on your first try.')).toBeInTheDocument();
  expect(screen.getByText(/Start by revisiting: cardiac output/)).toBeInTheDocument();
  expect(screen.queryByText('What you answered well')).toBeNull();
});

it('does not invent weaknesses or claim mastery when every answer is correct', async () => {
  const questions = studioQuestions.questions.slice(0, 2);
  mount({ streamlined: true, initialPhase: 'check', initialQuiz: { questions } });
  for (const [index, q] of questions.entries()) {
    fireEvent.click(within(screen.getByRole('group')).getAllByRole('button')[q.correctIndex]);
    fireEvent.click(screen.getByRole('button', { name: index ? /See my starting point/ : /Next question/ }));
  }
  expect(screen.getByText('A good start on these questions')).toBeInTheDocument();
  expect(screen.queryByText('What to practise')).toBeNull();
  expect(screen.getByText(/A starting signal, not a mastery score/)).toBeInTheDocument();
});
