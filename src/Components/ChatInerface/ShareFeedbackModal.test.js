import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import ShareFeedbackModal from './ShareFeedbackModal';

const reasons = [
  { id: 'incorrect', key: 'chat.ratingReasonIncorrect', fallback: 'Incorrect or incomplete' },
  { id: 'too_long', key: 'chat.ratingReasonTooLong', fallback: 'Too long' },
  { id: 'other', key: 'chat.ratingReasonOther', fallback: 'Other' }
];

const setup = (props = {}) => {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <ShareFeedbackModal
      isOpen
      onClose={onClose}
      onSubmit={onSubmit}
      reasons={reasons}
      {...props}
    />
  );
  return { onSubmit, onClose, ...utils };
};

const submitBtn = () => screen.getByRole('button', { name: 'Submit' });

describe('ShareFeedbackModal', () => {
  test('renders nothing when closed', () => {
    render(<ShareFeedbackModal isOpen={false} onClose={() => {}} onSubmit={() => {}} reasons={reasons} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('submit stays locked until there is something to say', () => {
    setup();
    expect(submitBtn()).toBeDisabled();

    fireEvent.click(screen.getByText('Too long'));
    expect(submitBtn()).toBeEnabled();
  });

  test('whitespace alone does not count as feedback', () => {
    setup();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '    ' } });
    expect(submitBtn()).toBeDisabled();
  });

  test('reasons are multi-select and toggle off again', () => {
    const { onSubmit } = setup();

    fireEvent.click(screen.getByText('Incorrect or incomplete'));
    fireEvent.click(screen.getByText('Too long'));
    expect(screen.getByText('Too long')).toHaveAttribute('aria-pressed', 'true');

    // A complaint the student changed their mind about must not be reported.
    fireEvent.click(screen.getByText('Too long'));
    expect(screen.getByText('Too long')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledWith({ reasons: ['incorrect'], comment: '' });
  });

  test('trims the comment and closes on submit', () => {
    const { onSubmit, onClose } = setup();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  it skipped the nursing priority  ' }
    });
    fireEvent.click(submitBtn());

    expect(onSubmit).toHaveBeenCalledWith({
      reasons: [],
      comment: 'it skipped the nursing priority'
    });
    expect(onClose).toHaveBeenCalled();
  });

  test('escape and the overlay both close without reporting anything', () => {
    const { onSubmit, onClose } = setup();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('opening again starts blank so one answer is not blamed for another', () => {
    const { rerender } = setup();

    fireEvent.click(screen.getByText('Too long'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'rambling' } });

    rerender(
      <ShareFeedbackModal isOpen={false} onClose={() => {}} onSubmit={() => {}} reasons={reasons} />
    );
    rerender(
      <ShareFeedbackModal isOpen onClose={() => {}} onSubmit={() => {}} reasons={reasons} />
    );

    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('Too long')).toHaveAttribute('aria-pressed', 'false');
    expect(submitBtn()).toBeDisabled();
  });

  test('tells the student their conversation goes with it', () => {
    setup();
    expect(
      screen.getByText(/conversation will be sent with your feedback/i)
    ).toBeInTheDocument();
  });
});
