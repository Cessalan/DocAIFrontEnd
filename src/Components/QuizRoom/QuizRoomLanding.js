import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import NurseQuizMascot from './NurseQuizMascot';
import './QuizRoomLanding.css';

/**
 * QuizRoomLanding - Premium, welcoming landing page
 * Shows immediate value with micro-interactions
 */
const QuizRoomLanding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [pressedCard, setPressedCard] = useState(null);

  // Handle card press for haptic-like feedback
  const handleCardPress = (cardId) => {
    setPressedCard(cardId);
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleCardRelease = () => {
    setPressedCard(null);
  };

  // Navigate to app (if logged in) or signup (if not)
  const navigateWithAction = (action) => {
    sessionStorage.setItem('landingAction', action);
    if (currentUser) {
      navigate('/');
    } else {
      navigate('/signup');
    }
  };

  // Navigation handlers
  const handleStudyNCLEX = () => navigateWithAction('quiz');
  const handleUploadNotes = () => navigateWithAction('upload');
  const handleTalkToTutor = () => navigateWithAction('tutor');
  const handleDailyChallenge = () => navigateWithAction('daily');

  return (
    <div className="quiz-landing-page">
      {/* Ambient background glow */}
      <div className="landing-ambient-glow" />

      {/* Top navigation bar */}
      <nav className="landing-nav">
        <div className="landing-brand">
          <span className="brand-name">NurseQuizAI</span>
        </div>
        <div className="landing-auth-header">
          <button
            className="auth-header-btn login-btn"
            onClick={() => navigate('/login')}
          >
            {t('landing.login', 'Log in')}
          </button>
          <button
            className="auth-header-btn signup-btn"
            onClick={() => navigate('/signup')}
          >
            {t('landing.signup', 'Sign up')}
          </button>
        </div>
      </nav>

      <div className="quiz-landing-wrapper">
        <div className="quiz-landing-content">
          {/* Mascot */}
          <div className="landing-mascot">
            <NurseQuizMascot size={120} />
          </div>

          {/* Welcome Header */}
          <header className="landing-header">
            <p className="landing-slogan">
              {t('landing.sloganLine1', 'Too much to study. Not enough time.')}
              <br />
              <span className="slogan-highlight">{t('landing.sloganLine2', 'We fix that.')}</span>
            </p>
            <h2 className="landing-subtitle">
              {t('landing.subtitle', 'Spend less time studying, more time understanding.')}
            </h2>
          </header>

          {/* Main Action Cards Grid */}
          <div className="landing-actions-grid">
            {/* Primary CTA - Upload Notes */}
            <button
              className={`landing-action-card primary-card ${pressedCard === 'upload' ? 'pressed' : ''}`}
              onClick={handleUploadNotes}
              onMouseDown={() => handleCardPress('upload')}
              onMouseUp={handleCardRelease}
              onMouseLeave={handleCardRelease}
              onTouchStart={() => handleCardPress('upload')}
              onTouchEnd={handleCardRelease}
              aria-label={t('landing.uploadNotes', 'Upload Your Notes')}
            >
              <div className="action-icon-wrapper">
                <div className="icon-glow" />
                {/* Premium Upload Icon - Document with sparkle */}
                <svg className="action-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="uploadPrimaryGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.6"/>
                      <stop offset="100%" stopColor="currentColor" stopOpacity="1"/>
                    </linearGradient>
                  </defs>
                  {/* Document base */}
                  <path d="M14 2H6C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2Z" stroke="url(#uploadPrimaryGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2V7H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Upload arrow */}
                  <path d="M12 18V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M9 14L12 11L15 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Sparkle accent */}
                  <path d="M20 3L20.5 4.5L22 5L20.5 5.5L20 7L19.5 5.5L18 5L19.5 4.5L20 3Z" fill="currentColor" fillOpacity="0.8"/>
                </svg>
              </div>
              <div className="card-text-content">
                <span className="action-title">{t('landing.uploadNotesTitle', 'Turn My Notes into a Quiz')}</span>
              </div>
              <div className="card-shine" />
            </button>

            {/* Secondary Actions Row */}
            <div className="landing-secondary-actions">
              {/* Study for NCLEX */}
              <button
                className={`landing-action-card secondary-card nclex-card ${pressedCard === 'nclex' ? 'pressed' : ''}`}
                onClick={handleStudyNCLEX}
                onMouseDown={() => handleCardPress('nclex')}
                onMouseUp={handleCardRelease}
                onMouseLeave={handleCardRelease}
                onTouchStart={() => handleCardPress('nclex')}
                onTouchEnd={handleCardRelease}
                aria-label={t('landing.studyNCLEX', 'Study for NCLEX')}
              >
                <div className="action-icon-wrapper">
                  <div className="icon-glow" />
                  {/* NCLEX Quiz Icon - Clipboard with checkmark */}
                  <svg className="action-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    <path d="M9 4V3C9 2.44772 9.44772 2 10 2H14C14.5523 2 15 2.44772 15 3V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M8 10L10.5 12.5L16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 15H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5"/>
                    <path d="M8 18H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.3"/>
                  </svg>
                </div>
                <span className="action-title">{t('landing.studyNCLEX', 'NCLEX Prep')}</span>
                <span className="action-description">{t('landing.studyNCLEXDesc', 'AI-powered questions')}</span>
                <div className="card-shine" />
              </button>

              {/* Talk to Tutor */}
              <button
                className={`landing-action-card secondary-card tutor-card ${pressedCard === 'tutor' ? 'pressed' : ''}`}
              onClick={handleTalkToTutor}
              onMouseDown={() => handleCardPress('tutor')}
              onMouseUp={handleCardRelease}
              onMouseLeave={handleCardRelease}
              onTouchStart={() => handleCardPress('tutor')}
              onTouchEnd={handleCardRelease}
              aria-label={t('landing.talkToTutor', 'Talk to Tutor')}
            >
              <div className="action-icon-wrapper">
                <div className="icon-glow" />
                {/* Premium AI Tutor Icon - Chat bubble with AI brain/sparkles */}
                <svg className="action-icon tutor-icon-svg" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="tutorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="1"/>
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.7"/>
                    </linearGradient>
                  </defs>
                  {/* Main chat bubble */}
                  <path d="M21 12C21 16.4183 16.9706 20 12 20C10.5607 20 9.19627 19.7003 8 19.1679L3 21L4.5 16.5C3.55039 15.2226 3 13.6646 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z" stroke="url(#tutorGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* AI brain/sparkle pattern inside */}
                  <circle cx="8.5" cy="12" r="1" fill="currentColor" fillOpacity="0.8"/>
                  <circle cx="12" cy="12" r="1" fill="currentColor"/>
                  <circle cx="15.5" cy="12" r="1" fill="currentColor" fillOpacity="0.8"/>
                  {/* Sparkle accent - AI indicator */}
                  <path d="M18 5L18.4 6.2L19.6 6.6L18.4 7L18 8.2L17.6 7L16.4 6.6L17.6 6.2L18 5Z" fill="currentColor"/>
                  <path d="M20 8L20.25 8.75L21 9L20.25 9.25L20 10L19.75 9.25L19 9L19.75 8.75L20 8Z" fill="currentColor" fillOpacity="0.6"/>
                </svg>
              </div>
              <span className="action-title">{t('landing.talkToTutor', 'Talk to Tutor')}</span>
              <span className="action-description">{t('landing.talkToTutorDesc', 'Get instant help from your AI tutor')}</span>
              <div className="card-shine" />
            </button>

              {/* Take Today's Challenge */}
              <button
                className={`landing-action-card secondary-card challenge-card ${pressedCard === 'challenge' ? 'pressed' : ''}`}
              onClick={handleDailyChallenge}
              onMouseDown={() => handleCardPress('challenge')}
              onMouseUp={handleCardRelease}
              onMouseLeave={handleCardRelease}
              onTouchStart={() => handleCardPress('challenge')}
              onTouchEnd={handleCardRelease}
              aria-label={t('landing.dailyChallenge', "Take Today's Challenge")}
            >
              <div className="action-icon-wrapper">
                <div className="icon-glow challenge-glow" />
                {/* Premium Fire/Challenge Icon - Dynamic flame with inner glow */}
                <svg className="action-icon flame-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="flameGrad" x1="50%" y1="100%" x2="50%" y2="0%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.6"/>
                      <stop offset="50%" stopColor="currentColor" stopOpacity="0.9"/>
                      <stop offset="100%" stopColor="currentColor" stopOpacity="1"/>
                    </linearGradient>
                    <linearGradient id="flameInner" x1="50%" y1="100%" x2="50%" y2="0%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.6"/>
                    </linearGradient>
                  </defs>
                  {/* Outer flame */}
                  <path d="M12 2C12 2 9 5.5 9 9C9 11 10 13 10 13C10 13 8.5 12 7.5 13.5C6.5 15 6 17 7 19C8 21 10 22 12 22C14 22 16 21 17 19C18 17 17.5 15 16.5 13.5C15.5 12 14 13 14 13C14 13 15 11 15 9C15 5.5 12 2 12 2Z" stroke="url(#flameGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Inner flame core */}
                  <path d="M12 8C12 8 10.5 10 10.5 12C10.5 14 11 15.5 12 16C13 15.5 13.5 14 13.5 12C13.5 10 12 8 12 8Z" fill="url(#flameInner)"/>
                  {/* Spark accents */}
                  <circle cx="9" cy="6" r="0.5" fill="currentColor" fillOpacity="0.5"/>
                  <circle cx="15" cy="5" r="0.4" fill="currentColor" fillOpacity="0.4"/>
                  <circle cx="7" cy="9" r="0.3" fill="currentColor" fillOpacity="0.3"/>
                </svg>
              </div>
              <span className="action-title">{t('landing.dailyChallenge', "Take Today's Challenge")}</span>
              <span className="action-description">{t('landing.dailyChallengeDesc', 'Quick daily practice to stay sharp')}</span>
              <div className="card-shine challenge-shine" />
              </button>
            </div>
          </div>

          {/* Social Proof Badges */}
          <div className="landing-social-proof">
            <div className="social-proof-badge">
              <div className="badge-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M23 21V19C23 17.1362 21.7252 15.5701 20 15.126" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16 3.12598C17.7252 3.56983 19 5.13616 19 6.99998C19 8.8638 17.7252 10.4301 16 10.874" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="badge-text">{t('landing.badge1', 'Made with nurses')}</span>
            </div>
            <div className="social-proof-divider" />
            <div className="social-proof-badge">
              <div className="badge-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="badge-text">{t('landing.badge2', 'Trusted across North America')}</span>
            </div>
          </div>

          {/* Bottom motivational text */}
          <div className="landing-footer">
            <p className="footer-text">
              {t('landing.footerText', 'Built for Nursing exams and NCLEX')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizRoomLanding;
