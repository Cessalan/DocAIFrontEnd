import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import FirstLessonPane from './FirstLessonPane';
import { generate_study_item_stream } from '../../Services/FastAPICalls';

jest.mock('../../Services/FastAPICalls', () => ({ generate_study_item_stream: jest.fn() }));
jest.mock('../../Contexts/UsageContext/UsageContext', () => ({ useUsageLimit: () => ({ consume: jest.fn() }) }));
jest.mock('../../Services/FunnelService', () => ({ FUNNEL: {}, logFunnelStep: jest.fn(), logFunnelStepOnce: jest.fn() }));
jest.mock('../StudyMode/StudyLessonCard', () => props => <div>
  <p>{props.content.pages?.[0]?.content}</p>
  <button onClick={props.onContinue}>Finish lesson</button>
</div>);
jest.mock('../StudyMode/StudyQuizCard', () => () => <p>Legacy quiz</p>);

beforeEach(() => jest.clearAllMocks());

it('completes the explanation in StrictMode without generating a second quiz', async () => {
  generate_study_item_stream.mockResolvedValue({ content: { pages: [{ content: 'Your course explanation.' }] } });
  const onDone = jest.fn();
  render(<React.StrictMode><FirstLessonPane chatId="chat" topic="Cardiac" lessonOnly onDone={onDone} /></React.StrictMode>);
  expect(await screen.findByText('Your course explanation.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Finish lesson' }));
  expect(onDone).toHaveBeenCalledWith({ topic: 'Cardiac', explained: true });
  expect(generate_study_item_stream).toHaveBeenCalledTimes(1);
  expect(generate_study_item_stream.mock.calls[0][1]).toBe('lesson');
  expect(screen.queryByText('Legacy quiz')).toBeNull();
});

it('offers a return to the same practice when the explanation cannot load', async () => {
  generate_study_item_stream.mockRejectedValue(new Error('unavailable'));
  const onDone = jest.fn();
  render(<FirstLessonPane chatId="chat" topic="Cardiac" lessonOnly onDone={onDone} />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByRole('button', { name: 'Return to practice' }));
  expect(onDone).toHaveBeenCalledWith({ skipped: true, reason: 'lesson' });
});
