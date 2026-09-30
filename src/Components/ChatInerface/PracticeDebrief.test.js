import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PracticeDebrief from './PracticeDebrief';
jest.mock('react-markdown', () => ({ __esModule:true, default:({children}) => <div>{children}</div> }));
jest.mock('react-i18next', () => ({ useTranslation:() => ({ i18n:{ language:'en' },
  t:(key, o = {}) => ({ 'practiceNext.both':`missed ${o.count} on ${o.weak}, not practised ${o.fresh}`, 'practiceNext.redo':`Redo ${o.count}`,
    'practiceNext.practise':`Practise ${o.topic}`, 'practiceNext.focusPrompt':`Create a short targeted practice on: ${o.topic}`,
    'practiceNext.fresh':`not practised ${o.fresh}`, 'practiceNext.failed':'failed' }[key] || key) }) }));
const message = { content:'A grounded review.', reviewLabel:'Review my mistake', reviewQuestion:'Which action comes first?', reviewFeedback:'Compare assessment with intervention.', practicePrompt:'Create a short targeted practice on prioritization.' };
test('reviewing the saved mistake generates no questions', () => {
  const send = jest.fn();
  render(<PracticeDebrief message={message} onSendMessage={send} />);
  fireEvent.click(screen.getByRole('button', {name:'Review my mistake'}));
  expect(screen.getByText('Which action comes first?')).toBeInTheDocument();
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name:'Practice this topic'}));
  expect(send).toHaveBeenCalledWith(null, message.practicePrompt);
});
test('failed review can retry the original quiz', () => {
  const retry = jest.fn();
  render(<PracticeDebrief message={{ ...message, debriefError:true, sourceQuizId:'quiz', questionCount:5 }} onRetry={retry} />);
  fireEvent.click(screen.getByRole('button', {name:'Retry review'}));
  expect(retry).toHaveBeenCalledWith({messageId:'quiz',questionCount:5});
});

const next = { review: { topic:'Fluid balance', missedCount:2, questions:[{ question:'Q1' }, { question:'Q2' }] }, fresh:'Wound care' };
test('the latest review names the weakest topic and the untested one, with matching counts', async () => {
  const redo = jest.fn().mockResolvedValue('quiz-id'), send = jest.fn();
  render(<PracticeDebrief message={message} onSendMessage={send} next={next} onRedoMistakes={redo} />);
  expect(screen.getByText('missed 2 on Fluid balance, not practised Wound care')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name:'Redo 2'}));
  expect(redo).toHaveBeenCalledWith(next.review);
  fireEvent.click(screen.getByRole('button', {name:'Practise Wound care'}));
  expect(send).toHaveBeenCalledWith(null, 'Create a short targeted practice on: Wound care');
  expect(screen.queryByRole('button', {name:'Practice this topic'})).toBeNull();
});
test('an older review without a suggestion is unchanged', () => {
  render(<PracticeDebrief message={message} onSendMessage={jest.fn()} />);
  expect(screen.queryByText(/missed/)).toBeNull();
  expect(screen.getByRole('button', {name:'Practice this topic'})).toBeInTheDocument();
});
test('with only an untested topic, no redo button is offered', () => {
  render(<PracticeDebrief message={message} onSendMessage={jest.fn()} next={{ review:null, fresh:'Wound care' }} onRedoMistakes={jest.fn()} />);
  expect(screen.getByText('not practised Wound care')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name:/Redo/})).toBeNull();
});
