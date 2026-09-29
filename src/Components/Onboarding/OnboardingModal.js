import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { createUserProfile } from '../../Services/UserService';
import { SCHOOL_COUNT } from '../Common/schoolWall';
import './Onboarding.css';

const LAST_QUESTION = 5;
const REFERRAL_OPTIONS = [
    ['friend', 'onboarding.options.referralFriend'],
    ['google', 'onboarding.options.referralGoogle'],
    ['chatgpt', 'onboarding.options.referralChatGPT'],
    ['social', 'onboarding.options.referralSocial'],
    ['school', 'onboarding.options.referralSchool'],
    ['other', 'onboarding.options.referralOther']
];

const brandFavicon = (domain) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

const ReferralIcon = ({ source }) => {
    if (source === 'google' || source === 'chatgpt') {
        return <span className="onboarding-referral-icon onboarding-referral-brand" aria-hidden="true">
            <img src={brandFavicon(source === 'google' ? 'google.com' : 'chatgpt.com')} alt="" />
        </span>;
    }
    if (source === 'social') {
        return <span className="onboarding-referral-icon onboarding-referral-social" aria-hidden="true">
            {['instagram.com', 'tiktok.com', 'facebook.com'].map(domain =>
                <img key={domain} src={brandFavicon(domain)} alt="" />
            )}
        </span>;
    }
    return <span className={`onboarding-referral-icon onboarding-referral-symbol${source === 'friend' ? ' onboarding-referral-friend' : ''}`} aria-hidden="true">
        {source === 'friend' ? <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="16.8" cy="8.4" r="2.6" opacity="0.55" />
            <path d="M15.4 13.2c3.5-.1 6.1 2.3 6.1 5.4v.7h-5.2v-.8c0-2-.3-3.7-.9-5.3Z" opacity="0.55" />
            <circle cx="8.7" cy="8.1" r="3.1" />
            <path d="M8.7 13c-3.5 0-6.2 2.6-6.2 6v.3h12.4V19c0-3.4-2.7-6-6.2-6Z" />
        </svg> : source === 'school' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2.5 9 9.5-4 9.5 4-9.5 4-9.5-4Z" /><path d="M6 11v5.2c3.5 2.7 8.5 2.7 12 0V11M21.5 9v6" />
        </svg> : <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
        </svg>}
    </span>;
};

const OnboardingModal = ({ preview = false, onClose }) => {
    const { t } = useTranslation();
    const { currentUser, setIsProfileComplete, setUserProfile } = useAuth();
    const [step, setStep] = useState(1);
    const [selectedChoice, setSelectedChoice] = useState(null);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const [formData, setFormData] = useState({
        studyGoal: '', userStage: '', reviewFormat: '', userExpectation: '', referralSource: ''
    });
    const transitionTimer = useRef(null);
    const headingRef = useRef(null);
    const isDevelopment = process.env.NODE_ENV === 'development';

    useEffect(() => () => window.clearTimeout(transitionTimer.current), []);
    useEffect(() => { headingRef.current?.focus(); }, [step]);

    const submitProfile = async (data) => {
        if (preview) {
            setStep(LAST_QUESTION + 1);
            return;
        }
        setIsSaving(true);
        setSaveError(false);
        try {
            const profileData = {
                onboarding: data,
                email: currentUser.email,
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || ''
            };
            await createUserProfile(currentUser.uid, profileData);
            setUserProfile(profileData);
            setStep(LAST_QUESTION + 1);
        } catch (error) {
            console.error('Error saving onboarding data:', error);
            setSaveError(true);
        } finally {
            setIsSaving(false);
        }
    };

    const moveTo = (nextStep, data = formData) => {
        if (isLeaving || isSaving) return;
        setIsLeaving(true);
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        transitionTimer.current = window.setTimeout(() => {
            setIsLeaving(false);
            setSelectedChoice(null);
            if (nextStep > LAST_QUESTION) submitProfile(data);
            else setStep(nextStep);
        }, reduceMotion ? 0 : 170);
    };

    const handleOptionSelect = (key, value) => {
        if (isLeaving || isSaving) return;
        const updatedData = { ...formData, [key]: value };
        setFormData(updatedData);
        setSelectedChoice(value);
        moveTo(step + 1, updatedData);
    };

    const handleStartLearning = () => {
        if (preview) {
            onClose?.();
            return;
        }
        setIsProfileComplete(true);
        window.dispatchEvent(new CustomEvent('onQuickStartSession', { detail: { formData } }));
    };

    const handleSkipOnboarding = async () => {
        try {
            const profileData = {
                onboarding: {
                    studyGoal: 'Skipped (Dev)', userStage: 'Skipped (Dev)',
                    reviewFormat: 'Skipped (Dev)', userExpectation: '', referralSource: ''
                },
                email: currentUser.email,
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || ''
            };
            await createUserProfile(currentUser.uid, profileData);
            setUserProfile(profileData);
            setIsProfileComplete(true);
        } catch (error) {
            console.error('Error skipping onboarding:', error);
        }
    };

    const option = (label, key, value) => (
        <button
            key={value}
            type="button"
            className={`onboarding-option-btn${selectedChoice === value ? ' is-selected' : ''}`}
            onClick={() => handleOptionSelect(key, value)}
            disabled={isLeaving || isSaving}
        >
            <span className="onboarding-option-copy">
                {key === 'referralSource' && <ReferralIcon source={value} />}
                <span>{t(label)}</span>
            </span>
            <span className="onboarding-option-indicator" aria-hidden="true">→</span>
        </button>
    );

    const studyGoalLabel = {
        'NCLEX Prep': 'onboarding.options.nclex',
        'Course Exam': 'onboarding.options.courseExam',
        'General Review': 'onboarding.options.generalReview'
    }[formData.studyGoal];
    const stageLabel = {
        'Pre-Nursing/Semester 1': 'onboarding.options.stage1',
        'Semester 2-3': 'onboarding.options.stage2',
        'Final Semester/NCLEX Prep': 'onboarding.options.stage3'
    }[formData.userStage];
    const formatLabel = {
        'Practice Questions': 'onboarding.options.formatPractice',
        Flashcards: 'onboarding.options.formatFlashcards',
        'Visual Concept Maps': 'onboarding.options.formatConcept',
        'Audio Summaries': 'onboarding.options.formatAudio'
    }[formData.reviewFormat];

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-heading">
                {preview && (
                    <div className="onboarding-preview-banner">
                        <span>DEV PREVIEW · Answers are not saved</span>
                        <button type="button" onClick={onClose} aria-label="Close onboarding preview">Close ×</button>
                    </div>
                )}
                {step <= LAST_QUESTION ? (
                    <>
                        <div className="onboarding-topline">
                            <span className="onboarding-eyebrow">{t('onboarding.eyebrow')}</span>
                            <span className="onboarding-tracker">{t('onboarding.tracker', { current: step, total: LAST_QUESTION })}</span>
                        </div>
                        <div className="onboarding-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={LAST_QUESTION} aria-label={t('onboarding.progressLabel')}>
                            <span className="onboarding-progress-fill" style={{ width: `${(step / LAST_QUESTION) * 100}%` }} />
                        </div>
                        <div key={step} className={`step-content${isLeaving ? ' is-leaving' : ''}`}>
                            <p className="onboarding-intro">{t('onboarding.intro')}</p>
                            <h2 id="onboarding-heading" ref={headingRef} tabIndex="-1" className="onboarding-title">
                                {t(`onboarding.step${step}Title`)}
                            </h2>

                            {step === 1 && <div className="onboarding-options">
                                {option('onboarding.options.nclex', 'studyGoal', 'NCLEX Prep')}
                                {option('onboarding.options.courseExam', 'studyGoal', 'Course Exam')}
                                {option('onboarding.options.generalReview', 'studyGoal', 'General Review')}
                            </div>}
                            {step === 2 && <div className="onboarding-options">
                                {option('onboarding.options.stage1', 'userStage', 'Pre-Nursing/Semester 1')}
                                {option('onboarding.options.stage2', 'userStage', 'Semester 2-3')}
                                {option('onboarding.options.stage3', 'userStage', 'Final Semester/NCLEX Prep')}
                            </div>}
                            {step === 3 && <div className="onboarding-options">
                                {option('onboarding.options.formatPractice', 'reviewFormat', 'Practice Questions')}
                                {option('onboarding.options.formatFlashcards', 'reviewFormat', 'Flashcards')}
                                {option('onboarding.options.formatConcept', 'reviewFormat', 'Visual Concept Maps')}
                                {option('onboarding.options.formatAudio', 'reviewFormat', 'Audio Summaries')}
                            </div>}
                            {step === 4 && <>
                                <label className="onboarding-field-label" htmlFor="onboarding-expectation">{t('onboarding.optional')}</label>
                                <textarea
                                    id="onboarding-expectation"
                                    className="onboarding-textarea"
                                    placeholder={t('onboarding.expectationPlaceholder')}
                                    value={formData.userExpectation}
                                    onChange={(event) => setFormData({ ...formData, userExpectation: event.target.value })}
                                />
                                <div className="onboarding-actions">
                                    <button type="button" className="onboarding-skip-link" onClick={() => handleOptionSelect('userExpectation', '')} disabled={isLeaving}>
                                        {t('onboarding.options.skipText')}
                                    </button>
                                    <button type="button" className="onboarding-start-btn" onClick={() => handleOptionSelect('userExpectation', formData.userExpectation.trim())} disabled={!formData.userExpectation.trim() || isLeaving}>
                                        {t('onboarding.options.submitText')}
                                    </button>
                                </div>
                            </>}
                            {step === 5 && <>
                                <div className="onboarding-options onboarding-referral-options">
                                    {REFERRAL_OPTIONS.map(([value, label]) => option(label, 'referralSource', value))}
                                </div>
                                <button type="button" className="onboarding-skip-link onboarding-referral-skip" onClick={() => handleOptionSelect('referralSource', '')} disabled={isLeaving || isSaving}>
                                    {t('onboarding.options.skipText')}
                                </button>
                            </>}
                        </div>
                        <div className="onboarding-footer">
                            {step > 1 ? <button type="button" className="onboarding-back" onClick={() => moveTo(step - 1)} disabled={isLeaving || isSaving}>{t('onboarding.back')}</button> : <span />}
                            <span className="onboarding-proof-mini">{t('onboarding.proof.short', { count: SCHOOL_COUNT })}</span>
                        </div>
                        {saveError && <p className="onboarding-save-error" role="alert">{t('onboarding.saveError')}</p>}
                        {isSaving && <div className="onboarding-saving" role="status"><span className="loading-spinner" />{t('onboarding.saving')}</div>}
                        {isDevelopment && !preview && <button className="onboarding-skip-btn" onClick={handleSkipOnboarding}>⏭️ Skip (Dev)</button>}
                    </>
                ) : (
                    <div key="success" className="step-content success-step">
                        <div className="success-icon" aria-hidden="true">✦</div>
                        <p className="onboarding-eyebrow">{t('onboarding.success.eyebrow')}</p>
                        <h2 id="onboarding-heading" ref={headingRef} tabIndex="-1" className="onboarding-title">{t('onboarding.success.title')}</h2>
                        <p className="onboarding-success-message">{t('onboarding.success.message')}</p>
                        <div className="onboarding-recommendation">
                            <span>{t('onboarding.success.summaryLabel')}</span>
                            <div className="onboarding-summary-chips">
                                {[studyGoalLabel, stageLabel, formatLabel].filter(Boolean).map(label => <span key={label}>{t(label)}</span>)}
                            </div>
                        </div>
                        <button className="onboarding-start-btn onboarding-upload-btn" onClick={handleStartLearning}>
                            {preview ? 'Close preview' : t('onboarding.successButtons.startSession')} <span aria-hidden="true">→</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingModal;
