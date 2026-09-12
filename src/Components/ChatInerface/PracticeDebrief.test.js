import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PracticeDebrief from './PracticeDebrief';
jest.mock('react-markdown', () => ({ __esModule:true, default:({children}) => <div>{children}</div> }));
jest.mock('react-i18next', () => ({ useTranslation:() => ({ i18n:{ language:'en' } }) }));
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
