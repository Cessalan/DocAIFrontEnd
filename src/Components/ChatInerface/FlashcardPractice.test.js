import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FlashcardPractice from './FlashcardPractice';
import { saveFlashcardReview, askFlashcardTutor } from '../../Services/FlashcardPracticeService';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }) => <div>{children}</div> }));
jest.mock('../../Services/FlashcardPracticeService', () => ({ saveFlashcardReview: jest.fn().mockResolvedValue(), askFlashcardTutor: jest.fn().mockResolvedValue({ reply: 'What kind of information do you need to recall?' }) }));
const cards = [{ front: 'What is active recall?', back: 'Retrieving information from memory.', topic: 'Memory' }];
const message = { id: 'deck', type: 'flashcard', flashcardData: cards };

beforeEach(() => {
  jest.clearAllMocks();
  saveFlashcardReview.mockResolvedValue();
  askFlashcardTutor.mockResolvedValue({ reply: 'What kind of information do you need to recall?' });
});

test('starts from a compact deck, hides the answer, offers ratings after reveal, and saves progress', async () => {
  render(<FlashcardPractice message={message} cards={cards} chatId="chat" />);
  expect(screen.queryByText(cards[0].back)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Start review/ }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Got it/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Reveal answer/ }));
  expect(screen.getByText(cards[0].back)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Got it/ }));
  expect(screen.getByRole('heading', { name: 'That’s your review.' })).toBeInTheDocument();
  await waitFor(() => expect(saveFlashcardReview).toHaveBeenCalledWith('chat', 'deck', expect.objectContaining({ ratings: expect.objectContaining({ 0: expect.objectContaining({ rating: 'got', nextReviewAt: expect.any(String) }) }) })));
});

test('again gives a fresh attempt without revealing the back or claiming first-pass success', () => {
  render(<FlashcardPractice message={message} cards={cards} chatId="chat" />);
  fireEvent.click(screen.getByRole('button', { name: /Start review/ }));
  fireEvent.click(screen.getByRole('button', { name: /Reveal answer/ }));
  fireEvent.click(screen.getByRole('button', { name: /Again/ }));
  expect(screen.getByText('One more try')).toBeInTheDocument();
  expect(screen.queryByText(cards[0].back)).not.toBeInTheDocument();
});

test('tutor receives the saved card identity and reveal state, never the client answer', async () => {
  render(<FlashcardPractice message={message} cards={cards} chatId="chat" />);
  fireEvent.click(screen.getByRole('button', { name: /Start review/ }));
  fireEvent.click(screen.getByRole('button', { name: 'A little hint?' }));
  await screen.findByText('What kind of information do you need to recall?');
  const body = askFlashcardTutor.mock.calls[0][0];
  expect(body).toMatchObject({ message_id: 'deck', card_index: 0, revealed: false });
  expect(body).not.toHaveProperty('answer');
});

test('another person’s deck can be previewed without writes or tutor requests', async () => {
  render(<FlashcardPractice message={message} cards={cards} chatId="chat" readOnly />);
  fireEvent.click(screen.getByRole('button', { name: /Start review/ }));
  expect(screen.getByRole('button', { name: 'A little hint?' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Reveal answer/ }));
  fireEvent.click(screen.getByRole('button', { name: /Got it/ }));
  expect(saveFlashcardReview).not.toHaveBeenCalled();
});

test('closing and reopening resumes the card and restores access to the main chat', async () => {
  const deck = [...cards, { front: 'Next idea?', back: 'Another answer' }];
  render(<FlashcardPractice message={message} cards={deck} chatId="chat" />);
  fireEvent.click(screen.getByRole('button', { name: /Start review/ }));
  fireEvent.click(screen.getByRole('button', { name: /Reveal answer/ }));
  fireEvent.click(screen.getByRole('button', { name: /Got it/ }));
  expect(screen.getByRole('heading', { name: 'Next idea?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Back to chat/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const resume = screen.getByRole('button', { name: /Resume review/ });
  expect(resume.closest('[inert]')).toBeNull();
  fireEvent.click(resume);
  expect(screen.getByRole('heading', { name: 'Next idea?' })).toBeInTheDocument();
  expect(screen.queryByText('Another answer')).not.toBeInTheDocument();
});
