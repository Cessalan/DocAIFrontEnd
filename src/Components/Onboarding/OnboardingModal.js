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
        userStage: '',
        reviewFormat: '',
        userExpectation: ''
    });

    const handleOptionSelect = async (key, value, nextStepOverwrite = null) => {
        const updatedData = { ...formData, [key]: value };
        setFormData(updatedData);

        const nextStep = nextStepOverwrite || step + 1;

        if (nextStep < 5) {
            setStep(nextStep);
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
            setStep(5); // Move to success step
        } catch (error) {
            console.error("Error saving onboarding data:", error);
            setIsLoading(false);
            // Ideally show error to user
        }
    };

    const handleStartLearning = () => {
        setIsProfileComplete(true);
        window.dispatchEvent(new CustomEvent('onQuickStartSession', { detail: formData }));
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
                    userStage: 'Skipped (Dev)',
                    reviewFormat: 'Skipped (Dev)',
                    userExpectation: ''
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
                        {step < 5 && (
                            <div className="onboarding-tracker">
                                {t('onboarding.tracker', { current: step, total: 4 })}
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
                                        onClick={() => handleOptionSelect('userStage', 'Pre-Nursing/Semester 1')}
                                    >
                                        {t('onboarding.options.stage1')}
                                    </button>
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('userStage', 'Semester 2-3')}
                                    >
                                        {t('onboarding.options.stage2')}
                                    </button>
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('userStage', 'Final Semester/NCLEX Prep')}
                                    >
                                        {t('onboarding.options.stage3')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="step-content">
                                <p className="onboarding-intro">{t('onboarding.intro')}</p>
                                <h2 className="onboarding-title">{t('onboarding.step3Title')}</h2>
                                <div className="onboarding-options">
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('reviewFormat', 'Practice Questions')}
                                    >
                                        {t('onboarding.options.formatPractice')}
                                    </button>
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('reviewFormat', 'Flashcards')}
                                    >
                                        {t('onboarding.options.formatFlashcards')}
                                    </button>
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('reviewFormat', 'Visual Concept Maps')}
                                    >
                                        {t('onboarding.options.formatConcept')}
                                    </button>
                                    <button
                                        className="onboarding-option-btn"
                                        onClick={() => handleOptionSelect('reviewFormat', 'Audio Summaries')}
                                    >
                                        {t('onboarding.options.formatAudio')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="step-content">
                                <p className="onboarding-intro">{t('onboarding.intro')}</p>
                                <h2 className="onboarding-title">{t('onboarding.step4Title')}</h2>
                                <textarea
                                    className="onboarding-textarea"
                                    placeholder={t('onboarding.expectationPlaceholder')}
                                    style={{ width: '100%', height: '100px', margin: '20px 0', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)', resize: 'none', fontFamily: 'inherit' }}
                                    value={formData.userExpectation}
                                    onChange={(e) => setFormData({...formData, userExpectation: e.target.value})}
                                ></textarea>
                                <div className="onboarding-options" style={{ flexDirection: 'row', gap: '10px' }}>
                                    <button
                                        className="onboarding-option-btn"
                                        style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)' }}
                                        onClick={() => handleOptionSelect('userExpectation', formData.userExpectation || '')}
                                    >
                                        {t('onboarding.options.skipText')}
                                    </button>
                                    <button
                                        className="onboarding-start-btn"
                                        style={{ margin: 0 }}
                                        onClick={() => handleOptionSelect('userExpectation', formData.userExpectation || '')}
                                        disabled={!formData.userExpectation}
                                    >
                                        {t('onboarding.options.submitText')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="step-content success-step">
                                <div className="success-icon">🎉</div>
                                <h2 className="onboarding-title">{t('onboarding.success.title')}</h2>

                                <div className="onboarding-recommendation">
                                    <p className="recommendation-text" dangerouslySetInnerHTML={{ __html: t('onboarding.recommendation.default', { reviewFormat: formData.reviewFormat, userStage: formData.userStage }) }} />
                                </div>

                                {/* Primary CTA: Start Magic Session */}
                                <button
                                    className="onboarding-start-btn onboarding-upload-btn"
                                    onClick={handleStartLearning}
                                >
                                    <span className="upload-icon">✨</span>
                                    {t('onboarding.successButtons.startSession')}
                                </button>
                                
                                {/* Hidden file input (kept for compatibility if needed elsewhere, though unused here mostly) */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.ppt,.pptx"
                                    multiple
                                    style={{ display: 'none' }}
                                />

                                {/* Secondary: Upload Notes directly */}
                                <button
                                    className="onboarding-skip-link"
                                    onClick={handleUploadClick}
                                >
                                    {t('onboarding.successButtons.uploadNotes')}
                                </button>
                            </div>
                        )}

                        {step < 5 && (
                            <div className="onboarding-progress">
                                <div className={`progress-dot ${step >= 1 ? 'active' : ''}`}></div>
                                <div className={`progress-dot ${step >= 2 ? 'active' : ''}`}></div>
                                <div className={`progress-dot ${step >= 3 ? 'active' : ''}`}></div>
                                <div className={`progress-dot ${step >= 4 ? 'active' : ''}`}></div>
                            </div>
                        )}

                        {isDevelopment && step < 5 && (
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
