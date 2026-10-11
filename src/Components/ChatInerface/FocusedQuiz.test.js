import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FocusedQuiz from './FocusedQuiz';
jest.mock('../StudyMode/StudyReasoning', () => () => null);
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
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this question' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this question' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this question' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Give me 100 more questions' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(mockQuota.openUpgrade).toHaveBeenCalled());
  expect(streamPracticeBatch).not.toHaveBeenCalled();
  expect(screen.getByText('Where are the lungs?')).toBeInTheDocument();
});

test('a quiz opened before the stream named its size adopts the requested total', async () => {
  mockQuota.isPro = true;
  try {
    const opening = { id: 'quiz-live', type: 'quiz', quizData: [], isStreaming: true };
    const { rerender } = render(<FocusedQuiz message={opening} chatId="chat" visible onExit={jest.fn()} />);
    const five = Array.from({ length: 5 }, (_, i) => ({ ...mcq, question: `Question ${i}?` }));
    rerender(<FocusedQuiz message={{ ...opening, quizData: five, requestedTotal: 15, isStreaming: false,
      practice: { settings: { requested_total: 15, scope: 'CHF and CAD' } } }} chatId="chat" visible onExit={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /A.*Thorax/ }));
    await waitFor(() => expect(savePractice).toHaveBeenCalled());
    expect(savePractice.mock.calls.at(-1)[2].settings.requested_total).toBe(15);
  } finally { mockQuota.isPro = false; }
});

test('the live stream sequence keeps the requested total', async () => {
  mockQuota.isPro = true;
  const { act } = require('react');
  let setMessage;
  function Host() {
    const [msg, set] = React.useState({ id: 'quiz-live', role: 'assistant', type: 'quiz', content: '', quizData: [], isStreaming: true, generationStage: 'reading' });
    setMessage = set;
    return <FocusedQuiz message={msg} chatId="chat" visible onExit={jest.fn()}
      onPracticeChange={practice => set(m => ({ ...m, practice }))} />;
  }
  try {
    render(<Host />);
    const quiz_settings = { difficulty: 'medium', question_types: ['mcq', 'sata'], scope: 'Cardiac', requested_total: 15 };
    for (let current = 1; current <= 5; current++) {
      act(() => setMessage(m => ({ ...m, requestedTotal: 15, practice: { ...m.practice, settings: quiz_settings }, expectedTotal: 5, generatingCurrent: current })));
      act(() => setMessage(m => ({ ...m, quizData: [...m.quizData, { ...mcq, question: `Q${current}?` }] })));
    }
    act(() => setMessage(m => ({ ...m, requestedTotal: 15, practice: { ...m.practice, settings: quiz_settings }, isStreaming: false })));
    await waitFor(() => expect(savePractice).toHaveBeenCalled());
    expect(savePractice.mock.calls.at(-1)[2].settings.requested_total).toBe(15);
  } finally { mockQuota.isPro = false; }
});

const requestBrief = { total: 50, exam: true, items: [
  { id: 'count', kind: 'count', value: 50, assumed: true },
  { id: 'focus:medication-questions', kind: 'focus', label: 'Medication questions', said: 'with medications questions also' },
  { id: 'rule:class-not-names', kind: 'rule', label: 'Medication class, not drug names', said: 'class not names' }] };

test('while it is written, the quiz shows her own words and what she asked for', () => {
  render(<FocusedQuiz message={{ id: 'quiz-brief', type: 'quiz', quizData: [], isStreaming: true, generationStage: 'reading',
    brief: requestBrief, requestedTotal: 50 }} chatId="chat" visible onExit={jest.fn()} requestWords="i need a full exam on both these chapters" />);
  expect(screen.getByText('i need a full exam on both these chapters')).toBeInTheDocument();
  expect(screen.getByText('Medication questions')).toBeInTheDocument();
  expect(screen.getByText('Medication class, not drug names')).toBeInTheDocument();
  expect(screen.getByText('requestBrief.countAssumed')).toBeInTheDocument();
});

test('an assumed full exam can be resized, and her size sticks', async () => {
  mockQuota.isPro = true;
  try {
    render(<FocusedQuiz message={{ id: 'quiz-size', type: 'quiz', quizData: [], isStreaming: true, brief: requestBrief, requestedTotal: 50 }}
      chatId="chat" visible onExit={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'requestBrief.change' }));
    fireEvent.click(screen.getByRole('button', { name: '25' }));
    await waitFor(() => expect(savePractice).toHaveBeenCalled());
    expect(savePractice.mock.calls.at(-1)[2].settings).toMatchObject({ chosen_total: 25, requested_total: 25 });
  } finally { mockQuota.isPro = false; }
});

test('a planned request loads its next ten from the blueprint before she runs out', async () => {
  mockQuota.isPro = true;
  try {
    streamPracticeBatch.mockImplementation(async (request, receive) => receive({ ...mcq, question: 'Planned batch question?' }));
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...mcq, question: `Planned ${i}?` }));
    const settings = { requested_total: 50, request_plan: { id: 'req-abc', offset: 0 }, exam: true };
    render(<FocusedQuiz message={{ id: 'quiz-plan', type: 'quiz', quizData: ten, requestedTotal: 50, isStreaming: false,
      practice: { settings, snapshot: { queueIndex: 7, questionQueue: ten.map((_, i) => i) } } }} chatId="chat" visible onExit={jest.fn()} />);
    await waitFor(() => expect(streamPracticeBatch).toHaveBeenCalled());
    const request = streamPracticeBatch.mock.calls[0][0];
    expect(request.count).toBe(10);
    expect(request.settings.request_plan).toEqual({ id: 'req-abc', offset: 0 });
    expect(request.settings.performance).toEqual({ answered: 0, correct: 0 });
    expect(request.existing_questions).toHaveLength(10);
  } finally { mockQuota.isPro = false; }
});

test('each question names the requirement it was checked against, and where it came from', () => {
  const tagged = { ...mcq, request: { chapter: 'Medications for angina', serves: ['focus:medication-questions'],
    verified: { 'focus:medication-questions': true } } };
  render(<FocusedQuiz message={{ id: 'quiz-tag', type: 'quiz', quizData: [tagged], requestedTotal: 1, isStreaming: false, brief: requestBrief }}
    chatId="chat" visible onExit={jest.fn()} />);
  expect(screen.getByText('Medication questions · Medications for angina')).toBeInTheDocument();
});

test('under exam conditions nothing is revealed until the end, then the score and review appear', async () => {
  const { playCorrectSound, playIncorrectSound } = require('../../utils/soundEffects');
  const exam = { id: 'quiz-exam', type: 'quiz', quizData: [mcq, { ...mcq, question: 'Second question?' }], requestedTotal: 2,
    isStreaming: false, brief: { ...requestBrief, total: 2 }, practice: { settings: { exam: true, requested_total: 2 } } };
  render(<FocusedQuiz message={exam} chatId="chat" visible onExit={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Discuss this question' })).not.toBeInTheDocument();
  expect(screen.getByText(/examMode.conditionsOn/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /B.*Abdomen/ }));
  expect(screen.queryByText('GOT IT')).not.toBeInTheDocument();
  expect(playIncorrectSound).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
  expect(await screen.findByText('Second question?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /A.*Thorax/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish exam' }));
  expect(await screen.findByText('examMode.score')).toBeInTheDocument();
  expect(playCorrectSound).not.toHaveBeenCalled();
  await waitFor(() => expect(savePractice).toHaveBeenCalled());
  const saved = savePractice.mock.calls.at(-1)[2];
  expect(saved.answers[0]).toMatchObject({ isCorrect: false, selectedIndex: 1 });
  expect(saved.answers[1]).toMatchObject({ isCorrect: true, selectedIndex: 0 });
  expect(screen.getByText('Where are the lungs?')).toBeInTheDocument();
});

test('she can switch an exam to answers as she goes', async () => {
  const exam = { id: 'quiz-reveal', type: 'quiz', quizData: [mcq, { ...mcq, question: 'Second question?' }], requestedTotal: 2,
    isStreaming: false, practice: { settings: { exam: true, requested_total: 2 } } };
  render(<FocusedQuiz message={exam} chatId="chat" visible onExit={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'examMode.showAsYouGo' }));
  await waitFor(() => expect(savePractice).toHaveBeenCalled());
  expect(savePractice.mock.calls.at(-1)[2].settings.exam_reveal).toBe(true);
  expect(screen.getByRole('button', { name: 'Discuss this question' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Next question' })).not.toBeInTheDocument();
});

test('reopening a quiz whose placeholder size was saved over the request restores the request', async () => {
  mockQuota.isPro = true;
  try {
    const five = Array.from({ length: 5 }, (_, i) => ({ ...mcq, question: `Saved ${i}?` }));
    render(<FocusedQuiz message={{ id: 'quiz-saved', type: 'quiz', quizData: five, requestedTotal: 15, isStreaming: false,
      practice: { settings: { requested_total: 5, question_types: ['mcq', 'sata'], difficulty: 'hard', scope: '' } } }} chatId="chat" visible onExit={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /A.*Thorax/ }));
    await waitFor(() => expect(savePractice).toHaveBeenCalled());
    expect(savePractice.mock.calls.at(-1)[2].settings.requested_total).toBe(15);
  } finally { mockQuota.isPro = false; }
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
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this question' }));
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
