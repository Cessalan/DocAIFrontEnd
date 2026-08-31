import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../i18n/i18n';
import ContentRating from './ContentRating';
import { rateContent, SENTIMENT, SURFACE } from '../../Services/SatisfactionService';

jest.mock('../../Services/SatisfactionService', () => ({
  SENTIMENT: { NEGATIVE: -1, NEUTRAL: 0, POSITIVE: 1 },
  SURFACE: { CHAT_ANSWER: 'chat_answer', QUIZ: 'quiz', FLASHCARD: 'flashcard', STUDY_BLOCK: 'study_block', APP: 'app' },
  rateContent: jest.fn(() => Promise.resolve({ success: true, signalId: 'sig-1' }))
}));

const context = {
  source: 'study_node',
  correct: 3,
  total: 10,
  scorePercent: 30,
  bucket: 'tough',
  topic: 'Cardiac Medications',
  nodeType: 'quiz',
  locale: 'en'
};

const setup = (props = {}) =>
  render(<ContentRating surface={SURFACE.QUIZ} chatId="chat-1" subjectId="node-7" context={context} {...props} />);

const thumbUp = () => screen.getByRole('button', { name: 'This was useful' });
const thumbDown = () => screen.getByRole('button', { name: 'This was not useful' });
const modal = () => screen.queryByRole('dialog');

describe('ContentRating', () => {
  beforeEach(() => {
    rateContent.mockClear();
    rateContent.mockResolvedValue({ success: true, signalId: 'sig-1' });
  });

  test('a thumbs-up is one tap and asks nothing further', async () => {
    setup();
    fireEvent.click(thumbUp());

    expect(screen.getByText('Thanks — noted')).toBeInTheDocument();
    expect(modal()).toBeNull();

    await waitFor(() => expect(rateContent).toHaveBeenCalledTimes(1));
    expect(rateContent.mock.calls[0][0]).toMatchObject({
      chatId: 'chat-1',
      subjectId: 'node-7',
      sentiment: SENTIMENT.POSITIVE
    });
  });

  test('a thumbs-down records the sentiment BEFORE opening the modal', async () => {
    setup();
    fireEvent.click(thumbDown());

    // The whole point: closing the modal still leaves a counted negative.
    await waitFor(() => expect(rateContent).toHaveBeenCalledTimes(1));
    expect(rateContent.mock.calls[0][0]).toMatchObject({ sentiment: SENTIMENT.NEGATIVE });
    expect(rateContent.mock.calls[0][0].reasons).toBeUndefined();

    expect(modal()).toBeInTheDocument();
  });

  test('the score travels with every rating', async () => {
    setup();
    fireEvent.click(thumbDown());

    await waitFor(() => expect(rateContent).toHaveBeenCalledTimes(1));
    // Without this a 3/10 complaint is indistinguishable from a 9/10 one.
    expect(rateContent.mock.calls[0][0].context).toMatchObject({
      correct: 3,
      total: 10,
      scorePercent: 30,
      bucket: 'tough'
    });
  });

  test('submitting details refines the existing signal instead of adding a second', async () => {
    setup();
    fireEvent.click(thumbDown());
    await waitFor(() => expect(rateContent).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Wrong answer marked correct'));
    fireEvent.click(screen.getByText('Not from my material'));
    fireEvent.click(screen.getByRole('button', { name: /send|submit|share/i }));

    await waitFor(() => expect(rateContent).toHaveBeenCalledTimes(2));
    const refine = rateContent.mock.calls[1][0];
    expect(refine.signalId).toBe('sig-1');
    // Two complaints, both kept — a single-valued field would discard one.
    expect(refine.reasons).toEqual(['wrong_answer', 'not_in_my_material']);
  });

  test('re-tapping an active thumbs-down reopens the modal without double-counting', async () => {
    setup();
    fireEvent.click(thumbDown());
    await waitFor(() => expect(rateContent).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(modal()).toBeNull());

    fireEvent.click(thumbDown());
    expect(modal()).toBeInTheDocument();
    // Tap parity must not change what was measured.
    expect(rateContent).toHaveBeenCalledTimes(1);
  });

  test('a failed first write still lets the details through', async () => {
    rateContent.mockResolvedValueOnce({ success: false });
    setup();
    fireEvent.click(thumbDown());
    await waitFor(() => expect(rateContent).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Too hard'));
    fireEvent.click(screen.getByRole('button', { name: /send|submit|share/i }));

    await waitFor(() => expect(rateContent).toHaveBeenCalledTimes(2));
    // No id to refine, so this inserts — a duplicate row beats a lost report.
    expect(rateContent.mock.calls[1][0].signalId).toBeNull();
    expect(rateContent.mock.calls[1][0].reasons).toEqual(['too_hard']);
  });
});
