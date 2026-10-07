import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import i18n from '../../i18n/i18n';
import MemberWelcomeModal from './MemberWelcomeModal';

beforeEach(async () => { await i18n.changeLanguage('en'); });

test('shows all member benefits before revealing the faster course quiz surprise', () => {
  const onClose = jest.fn();
  render(<MemberWelcomeModal onClose={onClose} />);
  expect(screen.getByRole('dialog', { name: 'Welcome to Pro.' })).toBeInTheDocument();
  for (const title of ['Practise as much as you need', 'Make a plan for every exam', 'Bring your whole course together']) {
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  }
  expect(screen.queryByText('Your course quizzes, faster.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /One more thing/ }));
  expect(screen.getByRole('dialog', { name: 'Your course quizzes, faster.' })).toBeInTheDocument();
  expect(screen.getByText(/priority generation for quizzes from your notes/)).toBeInTheDocument();
  expect(screen.getByText('Already included. Nothing to switch on.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Your benefits' }));
  expect(screen.getByRole('heading', { name: 'Welcome to Pro.' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: /One more thing/ }));
  fireEvent.click(screen.getByRole('button', { name: /Let’s study/ }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledWith({ seenAnnouncementIds: ['faster-course-quizzes-v1'] });
});

test('traps keyboard focus, allows Escape, and restores focus and scrolling on exit', () => {
  const launcher = document.createElement('button');
  document.body.appendChild(launcher); launcher.focus();
  document.body.style.overflow = 'auto';
  const onClose = jest.fn();
  const { unmount } = render(<MemberWelcomeModal onClose={onClose} />);
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: /One more thing/ })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'Close welcome' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledWith({ seenAnnouncementIds: [] });
  unmount();
  expect(launcher).toHaveFocus();
  expect(document.body.style.overflow).toBe('auto');
  launcher.remove(); document.body.style.overflow = '';
});

test('translates both steps into French', async () => {
  await act(async () => { await i18n.changeLanguage('fr'); });
  render(<MemberWelcomeModal onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Bienvenue dans Pro.' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Et une dernière chose/ }));
  expect(screen.getByRole('heading', { name: 'Tes quiz de cours, plus vite.' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Allons réviser/ })).toBeInTheDocument();
});
