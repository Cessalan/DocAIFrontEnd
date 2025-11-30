import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './FeedbackButton.css';

const FeedbackButton = ({ userId, userEmail, activeChatId, onFeedbackSubmit }) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState('general'); // general, bug, feature, other
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setFeedbackText('');
    setFeedbackType('general');
    setShowSuccess(false);
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!feedbackText.trim()) return;

    setIsSubmitting(true);

    try {
      const feedbackData = {
        userId,
        userEmail: userEmail || null,
        chatId: activeChatId || null,
        feedbackText: feedbackText.trim(),
        feedbackType,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        language: navigator.language
      };

      await onFeedbackSubmit(feedbackData);

      // Show success animation
      setShowSuccess(true);

      // Close modal after success animation
      setTimeout(() => {
        setIsModalOpen(false);
        setFeedbackText('');
        setShowSuccess(false);
      }, 2000);

    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert(t('feedback.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackTypes = [
    { value: 'general', emoji: '💬', label: t('feedback.typeGeneral') },
    { value: 'bug', emoji: '🐛', label: t('feedback.typeBug') },
    { value: 'feature', emoji: '✨', label: t('feedback.typeFeature') },
    { value: 'other', emoji: '📝', label: t('feedback.typeOther') }
  ];

  return (
    <>
      {/* Feedback Button in Sidebar */}
      <div className="feedback-button-wrapper nav-item feedback-cta" onClick={handleOpenModal}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span className="feedback-text">{t('feedback.buttonText', 'Got Ideas? Tell Us!')}</span>
      </div>

      {/* Feedback Modal */}
      {isModalOpen && (
        <div className="feedback-modal-overlay" onClick={handleCloseModal}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            {!showSuccess ? (
              <>
                <div className="feedback-modal-header">
                  <h3 className="feedback-modal-title">
                    {t('feedback.modalTitle')}
                  </h3>
                  <button
                    className="feedback-modal-close"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="feedback-form">
                  {/* Feedback Type Selector */}
                  <div className="feedback-type-selector">
                    <label className="feedback-label">
                      {t('feedback.typeLabel')}
                    </label>
                    <div className="feedback-types">
                      {feedbackTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          className={`feedback-type-option ${feedbackType === type.value ? 'active' : ''}`}
                          onClick={() => setFeedbackType(type.value)}
                          disabled={isSubmitting}
                        >
                          <span className="type-emoji">{type.emoji}</span>
                          <span className="type-label">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback Text Area */}
                  <div className="feedback-textarea-wrapper">
                    <label className="feedback-label">
                      {t('feedback.messageLabel')}
                    </label>
                    <textarea
                      className="feedback-textarea"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={t('feedback.placeholder')}
                      disabled={isSubmitting}
                      autoFocus
                      maxLength={1000}
                    />
                    <div className="feedback-char-count">
                      {feedbackText.length} / 1000
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="feedback-submit-btn"
                    disabled={isSubmitting || !feedbackText.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="feedback-spinner"></span>
                        {t('feedback.submitting')}
                      </>
                    ) : (
                      <>
                        <span>📤</span>
                        {t('feedback.submit')}
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="feedback-success">
                <div className="success-icon">✓</div>
                <h3>{t('feedback.successTitle')}</h3>
                <p>{t('feedback.successMessage')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
