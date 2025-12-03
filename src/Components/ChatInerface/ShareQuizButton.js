import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { shareQuiz, copyToClipboard } from '../../Services/QuizShareService';
import './ShareQuizButton.css';

function ShareQuizButton({ quizData, userResults, disabled = false, autoOpen = false }) {
  const { t } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [previousAutoOpenState, setPreviousAutoOpenState] = useState(autoOpen);
  const textareaRef = useRef(null);

  // Auto-resize textarea to fit content
  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Generate viral message based on user's score or quiz topics
  const generateViralMessage = () => {
    if (!userResults) return '';

    const percentage = userResults.percentage || 0;
    const totalQuestions = userResults.totalQuestions || 0;
    const correctAnswers = userResults.correctAnswers || 0;
    const isCompleted = correctAnswers > 0 || percentage > 0;

    // Get topics from quiz data
    const topics = [];
    if (quizData.quizzes && Array.isArray(quizData.quizzes)) {
      quizData.quizzes.forEach(quiz => {
        if (quiz.topic && !topics.includes(quiz.topic)) {
          topics.push(quiz.topic);
        }
      });
    }

    const mainTopic = quizData.topic || t('quizShare.defaultQuizName');

    // If quiz not completed, share with topics only (no score)
    if (!isCompleted) {
      if (topics.length > 0) {
        const topicList = topics.slice(0, 3).join(', ');
        return t('quizShare.viralMessageTopics', {
          topic: mainTopic,
          count: topics.length,
          topicList
        });
      } else {
        return t('quizShare.viralMessageNoTopics', {
          topic: mainTopic,
          totalQuestions
        });
      }
    }

    // If completed, show score-based messages
    if (percentage >= 90) {
      return t('quizShare.viralMessage90', { percentage, topic: mainTopic });
    } else if (percentage >= 80) {
      return t('quizShare.viralMessage80', { percentage, topic: mainTopic });
    } else if (percentage >= 70) {
      return t('quizShare.viralMessage70', { percentage, topic: mainTopic });
    } else {
      return t('quizShare.viralMessageDefault', { percentage, topic: mainTopic });
    }
  };

  const handleShare = async () => {
    if (disabled || isSharing) return;

    try {
      setIsSharing(true);
      const url = await shareQuiz(quizData, userResults);
      setShareUrl(url);

      // Set default viral message
      setCustomMessage(generateViralMessage());

      // Small delay for smoother UX
      setTimeout(() => {
        setShowModal(true);
        setIsSharing(false);
        // Auto-resize after modal opens
        setTimeout(autoResizeTextarea, 50);
      }, 300);
    } catch (error) {
      console.error('Failed to share quiz:', error);
      setIsSharing(false);
      // You could add a toast notification here
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopySuccess(true);

      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  const handleCopyMessage = async () => {
    if (!customMessage || !shareUrl) return;

    const fullMessage = `${customMessage}\n\n${shareUrl}`;
    const success = await copyToClipboard(fullMessage);

    if (success) {
      setMessageCopied(true);

      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      setTimeout(() => setMessageCopied(false), 2500);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setCopySuccess(false);
    setMessageCopied(false);
    // Clear after animation completes
    setTimeout(() => {
      setShareUrl(null);
      setCustomMessage('');
    }, 300);
  };

  // Track initial mount
  useEffect(() => {
    setIsInitialMount(false);
  }, []);

  // Auto-open share modal when autoOpen is true (e.g., after quiz completion)
  useEffect(() => {
    // Only auto-open when autoOpen changes from false to true (not on initial mount with autoOpen=true)
    const autoOpenJustBecameTrue = !previousAutoOpenState && autoOpen;

    if (!isInitialMount && autoOpenJustBecameTrue && !hasAutoOpened && !disabled) {
      // Automatically trigger share when the quiz is done
      handleShare();
      setHasAutoOpened(true);
    }

    // Update previous state
    if (previousAutoOpenState !== autoOpen) {
      setPreviousAutoOpenState(autoOpen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, isInitialMount, previousAutoOpenState]);

  const handleInstagramShare = async (e) => {
    e.preventDefault();
    const message = `${customMessage || t('quizShare.defaultMessage')}\n\n${shareUrl}`;

    // Copy to clipboard first
    await copyToClipboard(message);

    // Try to open Instagram app using deep link
    const instagramUrl = 'instagram://';
    const webUrl = 'https://www.instagram.com/';

    // Attempt to open the app
    window.location.href = instagramUrl;

    // Fallback to web if app doesn't open
    setTimeout(() => {
      const confirmed = window.confirm(
        t('quizShare.instagramMessage') ||
        'Link copied to clipboard! Instagram app will open. Paste the link in your story or post.\n\nClick OK to continue to Instagram, or Cancel to stay here.'
      );
      if (confirmed) {
        window.open(webUrl, '_blank');
      }
    }, 500);
  };

  const handleTikTokShare = async (e) => {
    e.preventDefault();
    const message = `${customMessage || t('quizShare.defaultMessage')}\n\n${shareUrl}`;

    // Copy to clipboard first
    await copyToClipboard(message);

    // Try to open TikTok app using deep link
    const tiktokUrl = 'tiktok://';
    const webUrl = 'https://www.tiktok.com/upload';

    // Attempt to open the app
    window.location.href = tiktokUrl;

    // Fallback to web if app doesn't open
    setTimeout(() => {
      const confirmed = window.confirm(
        t('quizShare.tiktokMessage') ||
        'Link copied to clipboard! TikTok app will open. Paste the link in your video description.\n\nClick OK to continue to TikTok, or Cancel to stay here.'
      );
      if (confirmed) {
        window.open(webUrl, '_blank');
      }
    }, 500);
  };

  return (
    <>
      <button
        className={`share-quiz-btn ${disabled ? 'disabled' : ''} ${isSharing ? 'loading' : ''}`}
        onClick={handleShare}
        disabled={disabled || isSharing}
      >
        <div className="btn-content">
          {isSharing ? (
            <>
              <div className="share-spinner" />
              <span>{t('quizShare.creatingLink')}</span>
            </>
          ) : (
            <>
              <ShareIcon />
              <span>{t('quizShare.buttonText')}</span>
            </>
          )}
        </div>
        <div className="btn-shine" />
      </button>

      {showModal && createPortal(
        <div className={`share-modal-overlay ${showModal ? 'active' : ''}`} onClick={closeModal}>
          <div className="share-modal-content glassmorphic" onClick={(e) => e.stopPropagation()}>
            <button className="share-modal-close" onClick={closeModal} aria-label="Close">
              <CloseIcon />
            </button>

            <div className="share-modal-header">
              <div className="header-icon">
                <ShareIconLarge />
              </div>
              <h3>{t('quizShare.modalTitle')}</h3>
            </div>

            {/* Viral Message Section */}
            <div className="viral-message-section">
              <label className="viral-message-label">
                <FireIcon />
                <span>{t('quizShare.challengeMessage')}</span>
              </label>
              <textarea
                ref={textareaRef}
                className="viral-message-input"
                value={customMessage}
                onChange={(e) => {
                  setCustomMessage(e.target.value);
                  autoResizeTextarea();
                }}
                onFocus={autoResizeTextarea}
                placeholder={t('quizShare.messagePlaceholder')}
                rows={1}
              />
            </div>

            {/* Quick Copy Actions */}
            <div className="quick-actions">
              <button
                className={`action-btn ${messageCopied ? 'success' : 'primary'}`}
                onClick={handleCopyMessage}
                disabled={!customMessage}
              >
                <span className="btn-icon">
                  {messageCopied ? <CheckIcon /> : <MessageIcon />}
                </span>
                <span className="btn-text">
                  {messageCopied ? t('quizShare.copied') : t('quizShare.copyMessage')}
                </span>
              </button>
              <button
                className={`action-btn ${copySuccess ? 'success' : 'secondary'}`}
                onClick={handleCopyLink}
              >
                <span className="btn-icon">
                  {copySuccess ? <CheckIcon /> : <LinkIcon />}
                </span>
                <span className="btn-text">
                  {copySuccess ? t('quizShare.copied') : t('quizShare.copyLink')}
                </span>
              </button>
            </div>

            <div className="share-divider">
              <span>{t('quizShare.shareVia')}</span>
            </div>

            <div className="social-share-grid">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(customMessage || t('quizShare.defaultMessage'))}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="social-btn twitter"
              >
                <TwitterIcon />
                <span>{t('quizShare.socialTwitter')}</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(customMessage || t('quizShare.defaultMessage'))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="social-btn facebook"
              >
                <FacebookIcon />
                <span>{t('quizShare.socialFacebook')}</span>
              </a>
              <a
                href="#"
                className="social-btn instagram"
                onClick={handleInstagramShare}
              >
                <InstagramIcon />
                <span>{t('quizShare.socialInstagram')}</span>
              </a>
              <a
                href="#"
                className="social-btn tiktok"
                onClick={handleTikTokShare}
              >
                <TikTokIcon />
                <span>{t('quizShare.socialTikTok')}</span>
              </a>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent((customMessage || t('quizShare.defaultMessage')) + '\n\n' + shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="social-btn whatsapp"
              >
                <WhatsAppIcon />
                <span>{t('quizShare.socialWhatsApp')}</span>
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent(quizData.topic || t('quizShare.defaultQuizName'))}&body=${encodeURIComponent((customMessage || t('quizShare.defaultMessage')) + '\n\n' + shareUrl)}`}
                className="social-btn email"
              >
                <EmailIcon />
                <span>{t('quizShare.socialEmail')}</span>
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Icon Components
function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function FireIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 23a7.5 7.5 0 0 1-5.138-12.963C8.204 8.774 11.5 6.5 11 1.5c6 4 9 8 3 14 1 0 2.5 0 5-2.47.27.773.5 1.604.5 2.47A7.5 7.5 0 0 1 12 23z" fill="url(#fire-gradient)" />
      <defs>
        <linearGradient id="fire-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#ff6b6b', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#ee5a6f', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ShareIconLarge() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

export default ShareQuizButton;
