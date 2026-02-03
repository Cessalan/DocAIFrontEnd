import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { createUserProfile, getWowEffectConfig } from '../../Services/UserService';
import './Onboarding.css';

/**
 * OnboardingModal - Captures user intent and guides them to their first action
 *
 * @param {function} onFilesSelected - Callback when user uploads files from onboarding
 *   Called with (files: File[], actionType: string) where actionType is 'studyjourney', 'flashcards', etc.
 */
const OnboardingModal = ({ onFilesSelected }) => {
    const { t } = useTranslation();
    const { currentUser, setIsProfileComplete, setUserProfile } = useAuth();
    const [step, setStep] = useState(1);
    const fileInputRef = useRef(null);

    // Development mode detection
    const isDevelopment = process.env.NODE_ENV === 'development';
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

    // Handle file selection from the upload button
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const wowConfig = getWowEffectConfig(formData.studyGoal, formData.reviewFormat);
        const actionType = wowConfig?.actionId || 'studyjourney';

        // Pass files and action type to parent
        if (onFilesSelected) {
            onFilesSelected(files, actionType);
        }

        // Close onboarding
        setIsProfileComplete(true);
    };

    // Trigger file input click
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    // Dev mode: Skip onboarding entirely
    const handleSkipOnboarding = async () => {
        try {
            const profileData = {
                onboarding: {
                    studyGoal: 'Skipped (Dev)',
                    reviewFormat: 'Skipped (Dev)'
                },
                email: currentUser.email,
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || ''
            };

            await createUserProfile(currentUser.uid, profileData);
            setUserProfile(profileData);
            setIsProfileComplete(true);
        } catch (error) {
            console.error("Error skipping onboarding:", error);
        }
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

                                {/* Personalized recommendation based on their choices */}
                                {(() => {
                                    const wowConfig = getWowEffectConfig(formData.studyGoal, formData.reviewFormat);
                                    if (wowConfig) {
                                        return (
                                            <div className="onboarding-recommendation">
                                                <p className="recommendation-text">
                                                    {t(`onboarding.recommendation.${wowConfig.actionId}`, {
                                                        goal: formData.studyGoal,
                                                        defaultValue: t('onboarding.success.message')
                                                    })}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return <p className="onboarding-intro">{t('onboarding.success.message')}</p>;
                                })()}

                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.ppt,.pptx"
                                    multiple
                                    style={{ display: 'none' }}
                                />

                                {/* Primary CTA: Upload files */}
                                <button
                                    className="onboarding-start-btn onboarding-upload-btn"
                                    onClick={handleUploadClick}
                                >
                                    <span className="upload-icon">📄</span>
                                    {t('onboarding.success.uploadButton', 'Upload My Notes')}
                                </button>

                                {/* Secondary: Skip for now */}
                                <button
                                    className="onboarding-skip-link"
                                    onClick={handleStartLearning}
                                >
                                    {t('onboarding.success.skipLink', "I'll do this later")}
                                </button>
                            </div>
                        )}

                        {step < 3 && (
                            <div className="onboarding-progress">
                                <div className={`progress-dot ${step >= 1 ? 'active' : ''}`}></div>
                                <div className={`progress-dot ${step >= 2 ? 'active' : ''}`}></div>
                            </div>
                        )}

                        {/* Dev mode skip button */}
                        {isDevelopment && step < 3 && (
                            <button
                                className="onboarding-skip-btn"
                                onClick={handleSkipOnboarding}
                            >
                                ⏭️ Skip (Dev)
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default OnboardingModal;
