import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../i18n/i18n';
import MessageRating from './MessageRating';
import { rateChatAnswer, SENTIMENT } from '../../Services/SatisfactionService';

jest.mock('../../Services/SatisfactionService', () => ({
  SENTIMENT: { NEGATIVE: -1, NEUTRAL: 0, POSITIVE: 1 },
  rateChatAnswer: jest.fn(() => Promise.resolve({ success: true, signalId: 'sig-1' }))
}));

const message = { id: 'msg-1', type: 'text', content: 'Digoxin toxicity presents with...' };

const setup = (props = {}) =>
  render(<MessageRating chatId="chat-1" message={message} {...props} />);

const thumbUp = () => screen.getByRole('button', { name: 'Mark this answer helpful' });
const thumbDown = () => screen.getByRole('button', { name: 'Mark this answer not helpful' });
const modal = () => screen.queryByRole('dialog');

describe('MessageRating', () => {
  beforeEach(() => {
    rateChatAnswer.mockClear();
    rateChatAnswer.mockResolvedValue({ success: true, signalId: 'sig-1' });
  });

  test('a thumbs-up is one tap and asks nothing further', async () => {
    setup();
    fireEvent.click(thumbUp());

    expect(screen.getByText('Thanks — noted')).toBeInTheDocument();
    // Categorising happiness adds friction to the case that needed no fix.
    expect(modal()).toBeNull();

    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalledTimes(1));
    expect(rateChatAnswer.mock.calls[0][0]).toMatchObject({
      chatId: 'chat-1',
      sentiment: SENTIMENT.POSITIVE
    });
  });

  test('a thumbs-down records the sentiment BEFORE opening the modal', async () => {
    setup();
    fireEvent.click(thumbDown());

    // The whole point: closing the modal still leaves a counted negative.
    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalledTimes(1));
    expect(rateChatAnswer.mock.calls[0][0]).toMatchObject({ sentiment: SENTIMENT.NEGATIVE });
    expect(rateChatAnswer.mock.calls[0][0].reasons).toBeUndefined();

    expect(modal()).toBeInTheDocument();
  });

  test('submitting details refines the existing signal instead of adding a second', async () => {
    setup();
    fireEvent.click(thumbDown());
    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Not what I asked for'));
    fireEvent.click(screen.getByText('Too long'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'I asked for the nursing interventions, not the pathophysiology.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalledTimes(2));
    expect(rateChatAnswer.mock.calls[1][0]).toMatchObject({
      sentiment: SENTIMENT.NEGATIVE,
      reasons: ['not_what_i_asked', 'too_long'],
      comment: 'I asked for the nursing interventions, not the pathophysiology.',
      signalId: 'sig-1'
    });
    expect(modal()).toBeNull();
  });

  test('free text alone is enough — no chip required', async () => {
    setup();
    fireEvent.click(thumbDown());
    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'The rationale contradicted the answer key.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalledTimes(2));
    expect(rateChatAnswer.mock.calls[1][0]).toMatchObject({
      reasons: [],
      comment: 'The rationale contradicted the answer key.'
    });
  });

  test('closing the modal without submitting keeps the negative', async () => {
    setup();
    fireEvent.click(thumbDown());
    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(modal()).toBeNull();
    expect(rateChatAnswer).toHaveBeenCalledTimes(1);
    expect(thumbDown()).toHaveAttribute('aria-pressed', 'true');
  });

  test('re-tapping the active thumbs-down reopens the modal without double-counting', async () => {
    setup();
    fireEvent.click(thumbDown());
    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(thumbDown());

    // Someone who closed it by accident can still say what went wrong, but
    // deleting or re-inserting the signal would make the count depend on taps.
    expect(modal()).toBeInTheDocument();
    expect(rateChatAnswer).toHaveBeenCalledTimes(1);
  });

  test('re-tapping the active thumbs-up does not un-rate or double-count', async () => {
    setup();
    fireEvent.click(thumbUp());
    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalledTimes(1));

    fireEvent.click(thumbUp());

    expect(rateChatAnswer).toHaveBeenCalledTimes(1);
    expect(thumbUp()).toHaveAttribute('aria-pressed', 'true');
    expect(modal()).toBeNull();
  });

  test('a rating from an earlier session comes back filled and unasked', () => {
    setup({ message: { ...message, rating: { sentiment: -1, reasons: ['incorrect'] } } });

    expect(thumbDown()).toHaveAttribute('aria-pressed', 'true');
    expect(thumbUp()).toHaveAttribute('aria-pressed', 'false');
    // That question was already answered; reopening reads as data thrown away.
    expect(modal()).toBeNull();
  });

  test('notifies the parent so the transcript in memory stays true', async () => {
    const onRated = jest.fn();
    setup({ onRated });

    fireEvent.click(thumbDown());
    expect(onRated).toHaveBeenCalledWith('msg-1', { sentiment: -1, reasons: [] });

    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Confusing explanation'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onRated).toHaveBeenLastCalledWith('msg-1', {
      sentiment: -1,
      reasons: ['confusing']
    });
  });

  test('a failed write never breaks the answer it was attached to', async () => {
    rateChatAnswer.mockResolvedValue({ success: false });
    setup();

    fireEvent.click(thumbUp());

    await waitFor(() => expect(rateChatAnswer).toHaveBeenCalled());
    expect(thumbUp()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Thanks — noted')).toBeInTheDocument();
  });
});
