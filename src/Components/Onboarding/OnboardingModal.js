import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { createUserProfile } from '../../Services/UserService';
import './Onboarding.css';

const OnboardingModal = () => {
    const { t } = useTranslation();
    const { currentUser, setIsProfileComplete, setUserProfile } = useAuth();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('onboarding.processing.analyzing');
    const [formData, setFormData] = useState({
        studyGoal: '',
        reviewFormat: ''
    });

    const handleOptionSelect = async (key, value) => {
        const updatedData = { ...formData, [key]: value };
        setFormData(updatedData);

        if (step === 1) {
            setStep(2);
        } else {
            // Start fake loading process
            setIsLoading(true);

            // Simulate processing steps
            setTimeout(() => {
                setLoadingMessage('onboarding.processing.personalizing');
            }, 1500);

            // Finish loading and save data
            setTimeout(async () => {
                await submitProfile(updatedData);
            }, 3000);
        }
    };

    const submitProfile = async (data) => {
        try {
            const profileData = {
                onboarding: data,
                email: currentUser.email,
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || ''
            };

            await createUserProfile(currentUser.uid, profileData);

            // Update context but don't close modal yet
            setUserProfile(profileData);
            setIsLoading(false);
            setStep(3); // Move to success step
        } catch (error) {
            console.error("Error saving onboarding data:", error);
            setIsLoading(false);
            // Ideally show error to user
        }
    };

    const handleStartLearning = () => {
        setIsProfileComplete(true);
    };

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-modal">
                {isLoading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p className="loading-text">{t(loadingMessage)}</p>
                    </div>
                ) : (
                    <>
                        {step < 3 && (
                            <div className="onboarding-tracker">
                                {t('onboarding.tracker', { current: step, total: 2 })}
                            </div>
                        )}

                        {step === 1 && (
                            <div className="step-content">
                                <p className="onboarding-intro">{t('onboarding.intro')}</p>
                                <h2 className="onboarding-title">{t('onboarding.step1Title')}</h2>
                                <div className="onboarding-options">
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('studyGoal', 'NCLEX Prep')}
                                    >
                                        {t('onboarding.options.nclex')}
                                    </button>
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('studyGoal', 'Course Exam')}
                                    >
                                        {t('onboarding.options.courseExam')}
                                    </button>
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('studyGoal', 'General Review')}
                                    >
                                        {t('onboarding.options.generalReview')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="step-content">
                                <p className="onboarding-intro">{t('onboarding.intro')}</p>
                                <h2 className="onboarding-title">{t('onboarding.step2Title')}</h2>
                                <div className="onboarding-options">
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('reviewFormat', 'Transfer to flashcard apps')}
                                    >
                                        {t('onboarding.options.flashcards')}
                                    </button>
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('reviewFormat', 'Save scores and track progress')}
                                    >
                                        {t('onboarding.options.trackProgress')}
                                    </button>
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('reviewFormat', 'Print or copy content manually')}
                                    >
                                        {t('onboarding.options.manual')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="step-content success-step">
                                <div className="success-icon">🎉</div>
                                <h2 className="onboarding-title">{t('onboarding.success.title')}</h2>
                                <p className="onboarding-intro">{t('onboarding.success.message')}</p>
                                <button
                                    className="onboarding-start-btn"
                                    onClick={handleStartLearning}
                                >
                                    {t('onboarding.success.button')}
                                </button>
                            </div>
                        )}

                        {step < 3 && (
                            <div className="onboarding-progress">
                                <div className={`progress-dot ${step >= 1 ? 'active' : ''}`}></div>
                                <div className={`progress-dot ${step >= 2 ? 'active' : ''}`}></div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default OnboardingModal;
