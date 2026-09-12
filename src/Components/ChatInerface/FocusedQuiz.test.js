import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FocusedQuiz from './FocusedQuiz';
import { askPracticeTutor, savePractice, streamPracticeBatch, copyPracticeToOwnChat } from '../../Services/PracticeService';

const mockQuota = { remaining: 0, isPro: false, refresh: jest.fn(), openUpgrade: jest.fn() };
jest.mock('../../Contexts/UsageContext/UsageContext', () => ({ useUsageLimit: () => mockQuota }));
jest.mock('../../Services/PracticeService', () => ({ askPracticeTutor: jest.fn(), savePractice: jest.fn(), streamPracticeBatch: jest.fn(), copyPracticeToOwnChat: jest.fn() }));
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }) => <div>{children}</div> }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' }, t: (key, fallback) => typeof fallback === 'string' ? fallback : fallback?.defaultValue || key }) }));
jest.mock('../Glossary/useGlossary', () => () => ({ rationaleRef: { current: null }, rationaleHandlers: {}, popover: null }));
jest.mock('../../utils/soundEffects', () => ({ playCorrectSound: jest.fn(), playIncorrectSound: jest.fn(), playCelebrationSound: jest.fn(), playMilestoneSound: jest.fn() }));
jest.mock('../../Services/FastAPICalls', () => ({ fetchQuizRationale: jest.fn() }));
jest.mock('../StudyMode/StudyCelebration', () => () => null);
jest.mock('./SATAQuestion', () => props => <div>SATA renderer<button onClick={() => props.onAnswerSelect({ questionType: 'sata', selectedOptions: ['One', 'Two'], isCorrect: true })}>Submit SATA</button><button onClick={props.onNext}>Next SATA</button></div>);
jest.mock('./CaseStudyQuestion', () => props => <div>Case renderer<button onClick={() => props.onAnswerSelect({ questionType: 'casestudy', userOrder: ['2', '1'], isCorrect: true })}>Submit case</button></div>);

const mcq = { question: 'Where are the lungs?', options: ['Thorax', 'Abdomen'], correctIndex: 0, questionType: 'mcq' };
const message = { id: 'quiz-test', type: 'quiz', quizData: [mcq, { ...mcq, question: 'Second question?' }], expectedTotal: 2, isStreaming: false };

beforeEach(() => { jest.clearAllMocks(); savePractice.mockResolvedValue(); askPracticeTutor.mockResolvedValue({ action: 'explain', reply: 'The lungs lie above the diaphragm.', sources: [] }); });

test('closing saves progress before the fold and exits once if animation completion is interrupted', async () => {
  const onExit = jest.fn();
  render(<FocusedQuiz message={message} chatId="chat" visible onExit={onExit} />);
  fireEvent.click(screen.getByRole('button', { name: /B.*Abdomen/ }));
  fireEvent.click(screen.getByRole('button', { name: '← Back to chat' }));
  expect(onExit).not.toHaveBeenCalled();
  await waitFor(() => expect(savePractice).toHaveBeenCalled());
  expect(savePractice.mock.calls.at(-1)[2].answers[0].selectedIndex).toBe(1);
  await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
});

test('reduced motion returns to chat immediately', () => {
  const original = window.matchMedia;
  window.matchMedia = jest.fn(() => ({ matches: true }));
  try {
    const onExit = jest.fn();
    render(<FocusedQuiz message={message} chatId="chat" visible onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: '← Back to chat' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  } finally { window.matchMedia = original; }
});

test('early exit does not request a completion debrief', () => {
  const complete = jest.fn();
  render(<FocusedQuiz message={message} chatId="chat" visible onExit={jest.fn()} onSessionComplete={complete} />);
  fireEvent.click(screen.getByRole('button', { name: '← Back to chat' }));
  expect(complete).not.toHaveBeenCalled();
});

test('closing a fully answered quiz supplies a saved session for the debrief', async () => {
  const complete = jest.fn();
  render(<FocusedQuiz message={{ ...message, quizData: [mcq], expectedTotal: 1 }} chatId="chat" visible onExit={jest.fn()} onSessionComplete={complete} />);
  fireEvent.click(screen.getByRole('button', { name: /B.*Abdomen/ }));
  fireEvent.click(screen.getByRole('button', { name: '← Back to chat' }));
  expect(complete).toHaveBeenCalledTimes(1);
  await complete.mock.calls[0][0].saved;
  expect(complete.mock.calls[0][0].questionCount).toBe(1);
  expect(savePractice.mock.calls.at(-1)[2].firstAnswers[0].isCorrect).toBe(false);
});

test('the only composer lives below the conversation inside the tutor panel', () => {
  render(<FocusedQuiz message={message} chatId="chat" visible onExit={jest.fn()} />);
  const tutor = screen.getByRole('complementary', { name: 'Question tutor' });
  expect(tutor).toContainElement(screen.getByRole('textbox'));
  expect(screen.getAllByRole('textbox')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Close tutor' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this question' }));
  expect(screen.getByRole('complementary', { name: 'Question tutor' })).toContainElement(screen.getByRole('textbox'));
});

test('help uses the selected answer and never replaces or regenerates the question', async () => {
  const { rerender } = render(<FocusedQuiz message={message} chatId="chat" visible onExit={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /B.*Abdomen/ }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Why is my answer wrong?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText('The lungs lie above the diaphragm.');
  expect(screen.getByText('Where are the lungs?')).toBeInTheDocument();
  expect(askPracticeTutor.mock.calls[0][0].selection.selectedIndex).toBe(1);
  expect(streamPracticeBatch).not.toHaveBeenCalled();
  rerender(<FocusedQuiz message={message} chatId="chat" visible={false} onExit={jest.fn()} />);
  rerender(<FocusedQuiz message={message} chatId="chat" visible onExit={jest.fn()} />);
  expect(screen.getByRole('button', { name: /B.*Abdomen/ })).toBeDisabled();
  expect(screen.getByText('The lungs lie above the diaphragm.')).toBeInTheDocument();
});

test('I do not know asks for a hint without grading or revealing the unanswered question', async () => {
  askPracticeTutor.mockResolvedValue({ action: 'explain', reply: 'Which area is the question asking you to identify?' });
  render(<FocusedQuiz message={message} chatId="chat" visible onExit={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: "I don't know" }));
  await screen.findByText('Which area is the question asking you to identify?');
  expect(askPracticeTutor.mock.calls[0][0].selection.isCorrect).toBeUndefined();
  expect(screen.getByRole('button', { name: /B.*Abdomen/ })).toBeEnabled();
  expect(screen.queryByText('GOT IT')).not.toBeInTheDocument();
});

test('SATA and clinical case renderers share the practice flow and save their answer shapes', async () => {
  const quiz = { ...message, quizData: [{ question: 'Select both', questionType: 'sata', options: ['One', 'Two'], correctAnswers: ['One', 'Two'] }, { question: 'Order care', questionType: 'casestudy', options: [], caseStudy: {} }] };
  render(<FocusedQuiz message={quiz} chatId="chat" visible onExit={jest.fn()} />);
  fireEvent.click(await screen.findByText('Submit SATA'));
  fireEvent.click(screen.getByText('Next SATA'));
  expect(await screen.findByText('Case renderer')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Submit case'));
  await waitFor(() => expect(savePractice).toHaveBeenCalled(), { timeout: 1500 });
  const saved = savePractice.mock.calls[savePractice.mock.calls.length - 1][2];
  expect(saved.answers[0].selectedOptions).toEqual(['One', 'Two']);
  expect(saved.answers[1].userOrder).toEqual(['2', '1']);
});

test('requests for more questions at the free limit preserve the quiz and open upgrade', async () => {
  askPracticeTutor.mockResolvedValue({ action: 'extend', reply: 'You want more practice.', settings: { requested_total: 100 } });
  render(<FocusedQuiz message={message} chatId="chat" visible onExit={jest.fn()} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Give me 100 more questions' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(mockQuota.openUpgrade).toHaveBeenCalled());
  expect(streamPracticeBatch).not.toHaveBeenCalled();
  expect(screen.getByText('Where are the lungs?')).toBeInTheDocument();
});

test('reopening a charged pending batch recovers its original request even at zero allowance', async () => {
  const pendingBatch = { chat_id: 'chat', request_id: 'already-charged', count: 1 };
  streamPracticeBatch.mockImplementation(async (request, receive) => receive({ ...mcq, question: 'Recovered question?' }));
  render(<FocusedQuiz message={{ ...message, practice: { pendingBatch } }} chatId="chat" visible onExit={jest.fn()} />);
  await waitFor(() => expect(streamPracticeBatch).toHaveBeenCalledTimes(1));
  expect(streamPracticeBatch.mock.calls[0][0]).toEqual(pendingBatch);
  await waitFor(() => expect(screen.getByText(/3 ready/)).toBeInTheDocument());
  expect(mockQuota.openUpgrade).not.toHaveBeenCalled();
});

test('a saved snapshot restores the active question and its submitted answer after remount', async () => {
  const practice = { snapshot: { questionQueue: [0, 1], queueIndex: 1, questionStatuses: { 0: 'correct', 1: 'incorrect' }, selectedIndex: 1, showFeedback: true, isCorrect: false },
    answers: { 1: { selectedIndex: 1, isCorrect: false } } };
  render(<FocusedQuiz message={{ ...message, practice }} chatId="chat" visible onExit={jest.fn()} />);
  expect(await screen.findByText('Second question?')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /B.*Abdomen/ })).toBeDisabled();
});

test('admin preview shows the focused quiz without saving or generating for another user', async () => {
  const onPracticeChange = jest.fn();
  render(<FocusedQuiz message={{ ...message, practice: { pendingBatch: { request_id: 'other-user' } } }} chatId="other-chat" visible readOnly onPracticeChange={onPracticeChange} onExit={jest.fn()} />);
  expect(await screen.findByText('Where are the lungs?')).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(screen.getByRole('complementary', { name: 'Question tutor' })).toBeInTheDocument();
  expect(onPracticeChange).not.toHaveBeenCalled();
  expect(savePractice).not.toHaveBeenCalled();
  expect(streamPracticeBatch).not.toHaveBeenCalled();
  expect(askPracticeTutor).not.toHaveBeenCalled();
});

test('another user’s quiz offers a working personal-copy action instead of a dead composer', async () => {
  copyPracticeToOwnChat.mockResolvedValue('my-practice-chat');
  const onCopyCreated = jest.fn();
  render(<FocusedQuiz message={message} chatId="other-chat" visible readOnly onCopyCreated={onCopyCreated} onExit={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Practice in my own chat' }));
  await waitFor(() => expect(onCopyCreated).toHaveBeenCalledWith('my-practice-chat'));
  expect(savePractice).not.toHaveBeenCalled();
  expect(askPracticeTutor).not.toHaveBeenCalled();
});
