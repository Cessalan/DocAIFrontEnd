import React from 'react';
import { useTranslation } from 'react-i18next';
import './FirstUploadWowCard.css';

/**
 * FirstUploadWowCard - Personalized "wow effect" card for first-time uploads
 *
 * PURPOSE:
 * After a user completes onboarding and uploads their first file, we show
 * a personalized message that reflects their choices, with a single CTA button.
 * This creates an "aha moment" - proving we understand their needs.
 *
 * UX PSYCHOLOGY:
 * 1. Personalization - Message reflects their exact onboarding choices
 * 2. User agency - They click to confirm, feeling in control
 * 3. Quick win - One obvious action, not 6 buttons to choose from
 * 4. Value-first - We show we "get them" before asking them to act
 *
 * PROPS:
 * @param {string} studyGoal - User's study goal from onboarding
 * @param {string} actionId - The recommended action ('flashcards', 'studyjourney', 'studysheet')
 * @param {string[]} topics - Topics extracted from uploaded files
 * @param {function} onAction - Callback when user clicks the CTA button
 * @param {boolean} disabled - Whether the button is disabled (during processing)
 */
const FirstUploadWowCard = ({
  studyGoal = '',
  actionId = 'studyjourney',
  topics = [],
  disabled = false,
  onAction
}) => {
  const { t } = useTranslation();

  // Format topics for display
  const topicsDisplay = topics.length > 0
    ? topics.slice(0, 2).join(' & ') + (topics.length > 2 ? ` +${topics.length - 2} more` : '')
    : t('wowEffect.defaultTopics', 'your material');

  // Get the personalized message based on action
  const getMessage = () => {
    const goalDisplay = studyGoal || t('wowEffect.defaultGoal', 'your studies');

    switch (actionId) {
      case 'flashcards':
        return t('wowEffect.flashcards', {
          goal: goalDisplay,
          topics: topicsDisplay,
          defaultValue: `I see you're preparing for ${goalDisplay} and want to use flashcard apps. Let me create flashcards from ${topicsDisplay} that you can export!`
        });
      case 'studyjourney':
        return t('wowEffect.studyjourney', {
          goal: goalDisplay,
          topics: topicsDisplay,
          defaultValue: `I see you're preparing for ${goalDisplay} and want to track your progress. Let's begin your personalized study journey through ${topicsDisplay}!`
        });
      case 'studysheet':
        return t('wowEffect.studysheet', {
          goal: goalDisplay,
          topics: topicsDisplay,
          defaultValue: `I see you're preparing for ${goalDisplay} and want printable content. Let me create a study sheet from ${topicsDisplay}!`
        });
      default:
        return t('wowEffect.default', {
          topics: topicsDisplay,
          defaultValue: `Great! I've analyzed ${topicsDisplay}. Let's get started!`
        });
    }
  };

  // Get the CTA button label based on action
  const getCtaLabel = () => {
    switch (actionId) {
      case 'flashcards':
        return t('wowEffect.cta.flashcards', 'Create My Flashcards');
      case 'studyjourney':
        return t('wowEffect.cta.studyjourney', 'Begin My Study Journey');
      case 'studysheet':
        return t('wowEffect.cta.studysheet', 'Create My Study Sheet');
      default:
        return t('wowEffect.cta.default', 'Get Started');
    }
  };

  // Get the appropriate icon for the action
  const getActionIcon = () => {
    switch (actionId) {
      case 'flashcards':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="6" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
      case 'studyjourney':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L12 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
            <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="12" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M14.5 5L18 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M6 12L9.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M14.5 19L18 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'studysheet':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M14 2v6h6M8 13h8M8 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
    }
  };

  const handleClick = () => {
    if (!disabled && onAction) {
      onAction(actionId);
    }
  };

  return (
    <div className="first-upload-wow-card">
      {/* Personalized message */}
      <p className="wow-message">{getMessage()}</p>

      {/* Single prominent CTA button */}
      <button
        className={`wow-cta-btn action-${actionId} ${disabled ? 'btn-disabled' : ''}`}
        onClick={handleClick}
        disabled={disabled}
        type="button"
      >
        <span className="wow-icon-circle">
          {getActionIcon()}
        </span>
        <span className="wow-cta-label">{getCtaLabel()}</span>
        <span className="wow-arrow">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
    </div>
  );
};

export default FirstUploadWowCard;
