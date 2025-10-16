import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './ChatStudySheet.css';

const ChatStudySheet = ({ message }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslation();

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Keyboard navigation - ESC to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    
    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  return (
    <>
      {/* Glassmorphic Banner */}
      <div 
        className="study-sheet-banner"
        onClick={openModal}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            openModal();
          }
        }}
        aria-label={t('chat.studysheet')}
      >
        <div className="study-sheet-banner-content">
          <div className="study-sheet-banner-left">
            <div className="study-sheet-icon">
              📚
            </div>
            <div className="study-sheet-text">
              <div className="study-sheet-title">
                {t('chat.studysheet')}
              </div>
              <div className="study-sheet-subtitle">
                {t('chat.clickToView') || 'Cliquez pour voir'}
              </div>
            </div>
          </div>
          <div className="study-sheet-arrow">
            ➤
          </div>
        </div>
      </div>

      {/* Glassmorphic Modal - Rendered via Portal */}
      {isModalOpen && createPortal(
        <div 
          className="study-sheet-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-sheet-modal-title"
        >
          <div className="study-sheet-modal-content">
            {/* Header */}
            <div className="study-sheet-modal-header">
              <h3 id="study-sheet-modal-title" className="study-sheet-modal-title">
                📚 {t('chat.studysheet')}
              </h3>
              <button
                onClick={closeModal}
                className="study-sheet-close-button"
              >
                ×
              </button>
            </div>

            {/* Study Sheet Content */}
            <div className="study-sheet-iframe-container">
              <iframe
                srcDoc={message.html}
                className="study-sheet-iframe"
                title="Study Sheet"
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ChatStudySheet;