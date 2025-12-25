import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BrainMascot from '../QuizRoom/BrainMascot';
import BookMascot from '../QuizRoom/BookMascot';
import PillMascot from '../QuizRoom/PillMascot';
import CoffeeCupMascot from '../QuizRoom/CoffeeCupMascot';
import MatchaCupMascot from '../QuizRoom/MatchaCupMascot';
import { plan_study_path } from '../../Services/FastAPICalls';
import { createStudySession } from '../../Services/StudySessionService';
import './StudyMode.css';

// Array of mascot components to randomly choose from
const MASCOTS = [
  BrainMascot,
  BookMascot,
  PillMascot,
  CoffeeCupMascot,
  MatchaCupMascot
];

/**
 * StartStudyModal - Modal for starting a new study journey
 * Shows after document upload, generates study path via AI
 *
 * @param {boolean} isOpen - Whether modal is visible
 * @param {Function} onClose - Callback to close modal
 * @param {Function} onStart - Callback when study session starts (receives studyState)
 * @param {string} chatId - Chat ID for the study session
 * @param {Array} uploadedDocs - Array of uploaded document objects
 * @param {Array} topics - Array of topics extracted from documents
 * @param {string} language - Language for content generation
 */
const StartStudyModal = ({
  isOpen,
  onClose,
  onStart,
  chatId,
  uploadedDocs = [],
  topics = [],
  language = 'en',
  autoStart = false // Skip confirmation and start immediately
}) => {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [error, setError] = useState(null);
  const [generatedPath, setGeneratedPath] = useState(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  // Random mascot selection - stored in state so it persists during modal lifecycle
  const [MascotComponent] = useState(() => MASCOTS[Math.floor(Math.random() * MASCOTS.length)]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsGenerating(false);
      setGenerationStep('');
      setError(null);
      setGeneratedPath(null);
      setHasAutoStarted(false);
    }
  }, [isOpen]);

  // Get document names for display
  const docNames = uploadedDocs.map(doc => doc.name || doc.filename || 'Document').join(', ');
  const docCount = uploadedDocs.length;

  // Handle start study journey
  const handleStartJourney = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Step 1: Analyze documents
      setGenerationStep(t('study.analyzingDocs', 'Analyzing your documents...'));
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX

      // Step 2: Generate study path via AI
      setGenerationStep(t('study.creatingPath', 'Creating your personalized study path...'));

      const uploadIds = uploadedDocs.map(doc => doc.id || doc.uploadId);
      const pathResult = await plan_study_path(chatId, uploadIds, language);

      if (!pathResult || !pathResult.nodes || pathResult.nodes.length === 0) {
        throw new Error('Failed to generate study path');
      }

      setGeneratedPath(pathResult);

      // Step 3: Save to Firestore
      setGenerationStep(t('study.savingProgress', 'Setting up your journey...'));

      const studyState = await createStudySession(chatId, pathResult, uploadIds);

      // Step 4: Complete!
      setGenerationStep(t('study.ready', 'Ready to learn!'));
      await new Promise(resolve => setTimeout(resolve, 300));

      // Start the study session
      if (onStart) {
        onStart(studyState);
      }

    } catch (err) {
      console.error('Error starting study journey:', err);
      setError(err.message || t('study.errorGenerating', 'Failed to create study path. Please try again.'));
      setIsGenerating(false);
    }
  };

  // Auto-start when modal opens if autoStart is true (skip confirmation)
  useEffect(() => {
    if (isOpen && autoStart && !hasAutoStarted && !isGenerating && uploadedDocs.length > 0) {
      setHasAutoStarted(true);
      handleStartJourney();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoStart, hasAutoStarted, isGenerating, uploadedDocs.length]);

  if (!isOpen) return null;

  return (
    <div className="study-modal-overlay" onClick={onClose}>
      <div className="study-modal" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className="study-modal-close" onClick={onClose} disabled={isGenerating}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Modal content */}
        <div className="study-modal-content">
          {/* Mascot - randomly selected */}
          <div className="study-modal-mascot">
            <MascotComponent size={80} isActive={true} />
          </div>

          {/* Title */}
          <h2 className="study-modal-title">
            {isGenerating
              ? t('study.preparingJourney', 'Preparing Your Journey')
              : t('study.startJourney', 'Start Study Journey')
            }
          </h2>

          {/* Document info */}
          {!isGenerating && (
            <div className="study-modal-docs">
              <div className="study-modal-doc-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div className="study-modal-doc-info">
                <span className="study-modal-doc-count">
                  {docCount} {docCount === 1
                    ? t('study.document', 'document')
                    : t('study.documents', 'documents')
                  }
                </span>
                <span className="study-modal-doc-names">{docNames}</span>
              </div>
            </div>
          )}

          {/* Generation progress */}
          {isGenerating && (
            <div className="study-modal-progress">
              <div className="study-modal-loader">
                <div className="study-modal-loader-dot" />
                <div className="study-modal-loader-dot" />
                <div className="study-modal-loader-dot" />
              </div>
              <p className="study-modal-step">{generationStep}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="study-modal-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Topics from documents */}
          {!isGenerating && !error && topics.length > 0 && (
            <div className="study-modal-topics">
              <p className="study-modal-topics-label">
                {t('study.topicsLabel', "Your lessons will cover:")}
              </p>
              <div className="study-modal-topics-list">
                {topics.slice(0, 6).map((topic, idx) => (
                  <span key={idx} className="study-modal-topic-tag">
                    {topic}
                  </span>
                ))}
                {topics.length > 6 && (
                  <span className="study-modal-topic-more">
                    +{topics.length - 6} {t('study.more', 'more')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {!isGenerating && !error && (
            <p className="study-modal-description">
              {t('study.journeyDescription',
                "I'll create a personalized study path based on your documents, with lessons, flashcards, quizzes, and audio to help you learn effectively."
              )}
            </p>
          )}

          {/* Features list */}
          {!isGenerating && !error && (
            <div className="study-modal-features">
              <div className="study-modal-feature">
                <span className="study-modal-feature-icon">📖</span>
                <span>{t('study.featureLessons', 'Bite-sized lessons')}</span>
              </div>
              <div className="study-modal-feature">
                <span className="study-modal-feature-icon">🎴</span>
                <span>{t('study.featureFlashcards', 'Flashcards')}</span>
              </div>
              <div className="study-modal-feature">
                <span className="study-modal-feature-icon">❓</span>
                <span>{t('study.featureQuizzes', 'Quiz questions')}</span>
              </div>
              <div className="study-modal-feature">
                <span className="study-modal-feature-icon">🎧</span>
                <span>{t('study.featureAudio', 'Audio lessons')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="study-modal-actions">
          {!isGenerating && (
            <button
              className="study-modal-cancel"
              onClick={onClose}
            >
              {t('common.cancel', 'Cancel')}
            </button>
          )}
          <button
            className="study-modal-start"
            onClick={handleStartJourney}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="study-modal-spinner" />
                {t('study.generating', 'Creating...')}
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('study.beginJourney', 'Begin Journey')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartStudyModal;
