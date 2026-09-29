import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import OnboardingModal from './OnboardingModal';
import { createUserProfile } from '../../Services/UserService';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}));
jest.mock('../../Contexts/AuthContext/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'student-1', email: 'student@example.com' },
    setIsProfileComplete: jest.fn(),
    setUserProfile: jest.fn()
  })
}));
jest.mock('../../Services/UserService', () => ({ createUserProfile: jest.fn() }));

describe('OnboardingModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    createUserProfile.mockResolvedValue();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const choose = async (label) => {
    fireEvent.click(screen.getByText(label));
    await act(async () => { jest.advanceTimersByTime(180); });
  };

  it('preserves the original answers, saves discovery source, and starts with the saved choices', async () => {
    const onStart = jest.fn();
    window.addEventListener('onQuickStartSession', onStart);
    try {
      render(<OnboardingModal />);
      expect(screen.getByText(/onboarding.proof.short/)).toBeInTheDocument();

      await choose('onboarding.options.nclex');
      await choose('onboarding.options.stage2');
      await choose('onboarding.options.formatPractice');
      await choose('onboarding.options.skipText');
      await choose('onboarding.options.referralChatGPT');

      expect(createUserProfile).toHaveBeenCalledWith('student-1', expect.objectContaining({
        onboarding: {
          studyGoal: 'NCLEX Prep',
          userStage: 'Semester 2-3',
          reviewFormat: 'Practice Questions',
          userExpectation: '',
          referralSource: 'chatgpt'
        }
      }));
      fireEvent.click(screen.getByRole('button', { name: /onboarding.successButtons.startSession/ }));
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onStart.mock.calls[0][0].detail.formData.referralSource).toBe('chatgpt');
    } finally {
      window.removeEventListener('onQuickStartSession', onStart);
    }
  });

  it('previews every question and the success screen without saving or starting a session', async () => {
    const onClose = jest.fn();
    const onStart = jest.fn();
    window.addEventListener('onQuickStartSession', onStart);
    try {
      render(<OnboardingModal preview onClose={onClose} />);
      expect(screen.getByText('DEV PREVIEW · Answers are not saved')).toBeInTheDocument();
      await choose('onboarding.options.courseExam');
      expect(screen.getByText('onboarding.step2Title')).toBeInTheDocument();
      await choose('onboarding.options.stage1');
      expect(screen.getByText('onboarding.step3Title')).toBeInTheDocument();
      await choose('onboarding.options.formatFlashcards');
      expect(screen.getByText('onboarding.step4Title')).toBeInTheDocument();
      await choose('onboarding.options.skipText');
      expect(screen.getByText('onboarding.step5Title')).toBeInTheDocument();
      await choose('onboarding.options.referralFriend');
      expect(screen.getByText('onboarding.success.title')).toBeInTheDocument();
      expect(createUserProfile).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /Close preview/ }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onStart).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('onQuickStartSession', onStart);
    }
  });
});
