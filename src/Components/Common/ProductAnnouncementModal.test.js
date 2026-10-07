import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import i18n from '../../i18n/i18n';
import ProductAnnouncementModal from './ProductAnnouncementModal';
import { PRODUCT_ANNOUNCEMENTS } from '../../config/productAnnouncements';

beforeEach(async () => { await i18n.changeLanguage('en'); });

test('announces priority generation to existing members and returns to study without generating a quiz', () => {
  const onClose = jest.fn();
  render(<ProductAnnouncementModal announcement={PRODUCT_ANNOUNCEMENTS[0]} onClose={onClose} />);
  expect(screen.getByRole('dialog', { name: 'Your course quizzes just got faster.' })).toBeInTheDocument();
  expect(screen.getByRole('heading')).toHaveFocus();
  expect(screen.getByText(/As a Pro member, you now get priority generation/)).toBeInTheDocument();
  expect(screen.getByText(/It’s already part of your membership/)).toBeInTheDocument();
  expect(screen.queryByText('Welcome to Pro.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Got it. Let’s study/ }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('supports French and keyboard dismissal', async () => {
  await act(async () => { await i18n.changeLanguage('fr'); });
  const onClose = jest.fn();
  render(<ProductAnnouncementModal announcement={PRODUCT_ANNOUNCEMENTS[0]} onClose={onClose} />);
  expect(screen.getByRole('dialog', { name: 'Tes quiz de cours sont maintenant plus rapides.' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});
