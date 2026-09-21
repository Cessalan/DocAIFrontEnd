import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import StudyReasoning from './StudyReasoning';
import { loadReasoning, saveReasoning, discussReasoning } from '../../Services/StudyReasoningService';

jest.mock('../../Services/StudyReasoningService', () => ({ loadReasoning: jest.fn(), saveReasoning: jest.fn(), discussReasoning: jest.fn() }));
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }) => <div>{children}</div> }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' }, t: (key, fallback) => fallback }) }));

const props = { chatId: 'chat', nodeId: 'node', questionIndex: 0,
  question: { question: 'Which cue matters?', options: ['One', 'Two'], correctIndex: 0 },
  revealed: false, selection: { selectedIndex: 1, isCorrect: false } };
beforeEach(() => { jest.clearAllMocks(); loadReasoning.mockResolvedValue([]); saveReasoning.mockResolvedValue(); discussReasoning.mockResolvedValue({ reply: 'What supports that connection?', sources: [] }); });
async function submit() {
  const input = screen.getByLabelText(/Talk me through your thinking/);
  await waitFor(() => expect(input).toBeEnabled());
  fireEvent.change(input, { target: { value: 'I noticed the respiratory rate.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Discuss my reasoning' }));
}
test('pre-answer reasoning opens the shared panel and saves only its own question discussion', async () => {
  render(<StudyReasoning {...props} />); await submit();
  expect(await screen.findByText('What supports that connection?')).toBeInTheDocument();
  expect(discussReasoning.mock.calls[0][0].selection).toEqual({});
  await waitFor(() => expect(saveReasoning).toHaveBeenCalledWith('chat', 'node', 0, expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'I noticed the respiratory rate.' })])));
});
test('submitted answer context and prior discussion reach the reasoning endpoint without source bulk', async () => {
  loadReasoning.mockResolvedValue([{ role: 'assistant', content: 'Earlier feedback', sources: [{ text: 'long excerpt' }] }]);
  render(<StudyReasoning {...props} revealed />); await submit();
  await waitFor(() => expect(discussReasoning).toHaveBeenCalled());
  expect(discussReasoning.mock.calls[0][0]).toMatchObject({ selection: props.selection, history: [{ role: 'assistant', content: 'Earlier feedback' }] });
});
test('network failure preserves the draft and allows retry', async () => {
  discussReasoning.mockRejectedValueOnce(new Error('Temporarily unavailable'));
  render(<StudyReasoning {...props} />); await submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Temporarily unavailable');
  expect(screen.getByLabelText('Question 1')).toHaveValue('I noticed the respiratory rate.');
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('What supports that connection?')).toBeInTheDocument();
});
test('a late reply from the previous question cannot appear or save under the next question', async () => {
  let resolve; discussReasoning.mockReturnValue(new Promise(done => { resolve = done; }));
  const { rerender } = render(<StudyReasoning key="first" {...props} />); await submit();
  const signal = discussReasoning.mock.calls[0][1];
  rerender(<StudyReasoning key="second" {...props} questionIndex={1} />);
  await act(async () => resolve({ reply: 'Old reply', sources: [] }));
  expect(signal.aborted).toBe(true); expect(screen.queryByText('Old reply')).not.toBeInTheDocument();
  expect(saveReasoning).not.toHaveBeenCalled();
});
test('failed saving can retry without another model request', async () => {
  saveReasoning.mockRejectedValueOnce(new Error('Offline'));
  render(<StudyReasoning {...props} />); await submit();
  fireEvent.click(await screen.findByRole('button', { name: 'Retry saving discussion' }));
  await waitFor(() => expect(saveReasoning).toHaveBeenCalledTimes(2));
  expect(discussReasoning).toHaveBeenCalledTimes(1);
});

test('closing keeps the panel mounted for its exit animation, then returns focus to the draft', async () => {
  render(<StudyReasoning {...props} />); await submit();
  await screen.findByText('What supports that connection?');
  fireEvent.click(screen.getByRole('button', { name: 'Close tutor' }));
  expect(document.querySelector('.study-reasoning-side')).toHaveClass('is-closing');
  await waitFor(() => expect(document.querySelector('.study-reasoning-side')).toBeNull());
  expect(screen.getByLabelText(/Talk me through your thinking/)).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: /Continue discussion/ }));
  expect(document.querySelector('.study-reasoning-side')).toHaveClass('is-entering');
});

test('reduced motion closes immediately without waiting for an animation', async () => {
  const original = window.matchMedia;
  window.matchMedia = jest.fn(() => ({ matches: true }));
  try {
    render(<StudyReasoning {...props} />); await submit();
    await screen.findByText('What supports that connection?');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('.study-reasoning-side')).toBeNull();
    expect(screen.getByLabelText(/Talk me through your thinking/)).toHaveFocus();
  } finally { window.matchMedia = original; }
});

test('shows the sent message immediately, then replaces typing with one reply without duplicating it', async () => {
  let resolve; discussReasoning.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<StudyReasoning {...props} />); await submit();
  expect(screen.getByText('I noticed the respiratory rate.')).toBeInTheDocument();
  expect(screen.getByLabelText('Question 1')).toHaveValue('');
  expect(screen.getByText('Thinking it through')).toBeInTheDocument();
  expect(document.querySelector('.paper-skeleton')).toBeNull();
  await act(async () => resolve({ reply: 'Start with the most relevant cue.', sources: [] }));
  expect(screen.queryByText('Thinking it through')).not.toBeInTheDocument();
  expect(screen.getAllByText('I noticed the respiratory rate.')).toHaveLength(1);
  expect(screen.getByText('Start with the most relevant cue.')).toBeInTheDocument();
});

test('resize notifications defer layout writes, coalesce frames and clean up on unmount', async () => {
  const originalObserver = global.ResizeObserver;
  const originalFrame = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  let notify, frame;
  const disconnect = jest.fn();
  global.ResizeObserver = jest.fn(callback => { notify = callback; return { observe: jest.fn(), disconnect }; });
  window.requestAnimationFrame = jest.fn(callback => { frame = callback; return 123; });
  window.cancelAnimationFrame = jest.fn();
  try {
    const { unmount } = render(<StudyReasoning {...props} />); await submit();
    await screen.findByText('What supports that connection?');
    const pane = document.querySelector('.practice-discussion');
    Object.defineProperty(pane, 'clientHeight', { configurable: true, value: 500 });
    const write = jest.spyOn(pane.style, 'setProperty');
    act(() => { notify(); notify(); });
    expect(write).not.toHaveBeenCalled();
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    act(() => frame());
    expect(write).toHaveBeenCalledTimes(1);
    act(() => { notify(); frame(); });
    expect(write).toHaveBeenCalledTimes(1);
    act(() => notify());
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(123);
    act(() => frame());
    expect(write).toHaveBeenCalledTimes(1);
  } finally {
    global.ResizeObserver = originalObserver;
    window.requestAnimationFrame = originalFrame;
    window.cancelAnimationFrame = originalCancel;
  }
});
