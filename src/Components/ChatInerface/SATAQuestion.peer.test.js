import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import SATAQuestion from './SATAQuestion';

jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: { PEER_COMPARISON_VIEWED: 'peer_comparison_viewed' }, logFunnelStep: jest.fn(),
}));
jest.mock('../../Services/FastAPICalls', () => ({ fetchQuizWalkthrough: jest.fn() }));

// The real card, answered by hand. The line about other students has to show
// under the verdict every time: twice the owner answered a select-all and saw
// nothing, because a rule in the parent had quietly turned it off.
const quiz = {
  questionType: 'sata', question: 'Which actions support oxygenation? Select all that apply.',
  options: ['A) Monitor SpO2', 'B) Delay oxygen', 'C) Assist ventilation', 'D) Position flat'],
  correctAnswers: ['A) Monitor SpO2', 'C) Assist ventilation'], justification: 'A and C are correct.',
};
const LINE = 'Most students miss these. 45% get select-all right.';
const answerWrong = () => {
  fireEvent.click(screen.getAllByRole('checkbox')[1]);
  fireEvent.click(screen.getByRole('button', { name: /Submit Answer/ }));
};

it('shows nothing before she answers, then the line under a missed select-all', async () => {
  render(<SATAQuestion quiz={quiz} quizIndex={0} totalQuestions={1} inModal={false} />);
  expect(screen.queryByText(LINE)).toBeNull();
  answerWrong();
  expect(await screen.findByText(LINE)).toBeInTheDocument();
});

it('shows it again on a second try at the same question', async () => {
  const { unmount } = render(<SATAQuestion quiz={quiz} quizIndex={0} totalQuestions={1} inModal={false} />);
  answerWrong();
  expect(await screen.findByText(LINE)).toBeInTheDocument();
  unmount();
  render(<SATAQuestion quiz={quiz} quizIndex={1} totalQuestions={1} inModal={false} />);
  answerWrong();
  expect(await screen.findByText(LINE)).toBeInTheDocument();
});

it('stays off under exam conditions', async () => {
  render(<SATAQuestion quiz={quiz} quizIndex={0} totalQuestions={1} inModal={false} deferFeedback />);
  fireEvent.click(screen.getAllByRole('checkbox')[1]);
  fireEvent.click(screen.getAllByRole('button').pop());
  await new Promise(resolve => setTimeout(resolve, 400));
  expect(screen.queryByText(LINE)).toBeNull();
});
