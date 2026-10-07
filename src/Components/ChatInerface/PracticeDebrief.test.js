import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PracticeDebrief from './PracticeDebrief';
jest.mock('react-markdown', () => ({ __esModule:true, default:({children}) => <div>{children}</div> }));
jest.mock('react-i18next', () => ({ useTranslation:() => ({ i18n:{ language:'en' },
  t:(key, o = {}) => ({ 'practiceNext.redoThese':`Redo those ${o.count} questions`, 'practiceNext.seeAnswers':'See all my answers',
    'practiceNext.practise':`Practise ${o.topic}`, 'practiceNext.focusPrompt':`Create a short targeted practice on: ${o.topic}`,
    'practiceNext.thisPractice':'this practice', 'practiceNext.preparing':'Preparing…', 'practiceNext.failed':'failed' }[key] || key) }) }));

const message = { sourceQuizId:'quiz-1', questionCount:5,
  content:'You have the cardiac arrest call down.\n\nThe one to work on is the order of the primary survey.',
  reviewLabel:'Review my mistake', reviewQuestion:'Which action comes first?', reviewFeedback:'Compare assessment with intervention.',
  practicePrompt:'Create a short targeted practice on prioritization.' };
const mistakes = [{ question:'Q1', topic:'C — Circulation' }, { question:'Q2', topic:'C — Circulation' }];

test('the note leads, with no grade and no second sentence from another author', () => {
  render(<PracticeDebrief message={message} onSendMessage={jest.fn()} next={{ review:{ topic:'X', missedCount:9, questions:[] }, fresh:'Examen secondaire' }} />);
  expect(screen.getByText(/cardiac arrest call down/)).toBeInTheDocument();
  expect(screen.queryByText(/correct on your first try/)).toBeNull();
  expect(screen.queryByText(/missed 9/)).toBeNull();
});

test('one primary action redoes the misses from THIS quiz, with the count on the button', async () => {
  const redo = jest.fn().mockResolvedValue('review-quiz');
  render(<PracticeDebrief message={message} onSendMessage={jest.fn()} mistakes={mistakes} onRedoMistakes={redo}
    next={{ review:{ topic:'Other topic', missedCount:7, questions:[] }, fresh:'Examen secondaire' }} onOpenPractice={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name:'Redo those 2 questions' }));
  expect(redo).toHaveBeenCalledWith({ topic:'C — Circulation', missedCount:2, questions:mistakes });
  // The chat-wide suggestion does not compete with it.
  expect(screen.queryByRole('button', { name:/Practise/ })).toBeNull();
  expect(screen.queryByRole('button', { name:/Redo.*7/ })).toBeNull();
  expect(await screen.findByRole('button', { name:'Redo those 2 questions' })).toBeEnabled();
});

test('the quiet link opens the quiz to see every answer', () => {
  const open = jest.fn();
  render(<PracticeDebrief message={message} onSendMessage={jest.fn()} mistakes={mistakes} onRedoMistakes={jest.fn()} onOpenPractice={open} />);
  fireEvent.click(screen.getByRole('button', { name:'See all my answers' }));
  expect(open).toHaveBeenCalledWith('quiz-1');
  expect(screen.getAllByRole('button')).toHaveLength(2);
});

test('with no misses, the primary action moves on to untouched material', () => {
  const send = jest.fn();
  render(<PracticeDebrief message={message} onSendMessage={send} mistakes={[]} onRedoMistakes={jest.fn()} next={{ review:null, fresh:'Examen secondaire' }} />);
  fireEvent.click(screen.getByRole('button', { name:'Practise Examen secondaire' }));
  expect(send).toHaveBeenCalledWith(null, 'Create a short targeted practice on: Examen secondaire');
  expect(screen.queryByRole('button', { name:/Redo/ })).toBeNull();
});

test('with nothing else to suggest, it offers a short practice on this topic', () => {
  const send = jest.fn();
  render(<PracticeDebrief message={message} onSendMessage={send} />);
  fireEvent.click(screen.getByRole('button', { name:'Practice this topic' }));
  expect(send).toHaveBeenCalledWith(null, message.practicePrompt);
});

test('without a way to open the quiz, the saved question is shown inline instead', () => {
  const send = jest.fn();
  render(<PracticeDebrief message={message} onSendMessage={send} />);
  fireEvent.click(screen.getByRole('button', { name:'Review my mistake' }));
  expect(screen.getByText('Which action comes first?')).toBeInTheDocument();
  expect(send).not.toHaveBeenCalled();
});

test('a failed review can retry the original quiz', () => {
  const retry = jest.fn();
  render(<PracticeDebrief message={{ ...message, debriefError:true }} onRetry={retry} />);
  fireEvent.click(screen.getByRole('button', {name:'Retry review'}));
  expect(retry).toHaveBeenCalledWith({messageId:'quiz-1',questionCount:5});
});
