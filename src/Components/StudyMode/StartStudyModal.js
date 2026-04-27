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

const MASCOTS = [BrainMascot, BookMascot, PillMascot, CoffeeCupMascot, MatchaCupMascot];

/**
 * StartStudyModal — Orchestrates the full study launch flow:
 *   1. loading     → /study/plan + /study/diagnostic-quiz fire in parallel
 *   2. diagnostic  → 5 questions one-at-a-time, seeds studyPerformance
 *   3. baseline    → brief score flash (1.5s), createStudySession fires in bg
 *   4. done        → calls onStart(studyState)
 */
const StartStudyModal = ({
  isOpen,
  onClose,
  onStart,
  chatId,
  uploadedDocs = [],
  topics = [],
  language = 'en',
  autoStart = false,
  userPreferences = {}
}) => {
  const { t } = useTranslation();

  // ── Phase machine ─────────────────────────────────────────
  // 'idle' | 'loading' | 'done'
  const [phase, setPhase] = useState('idle');

  // Error
  const [error, setError] = useState(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  const [MascotComponent] = useState(() => MASCOTS[Math.floor(Math.random() * MASCOTS.length)]);

  // Rotating loading messages
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const loadingMessages = t('study.loadingMessages', { returnObjects: true });
  const messagesArray = Array.isArray(loadingMessages) ? loadingMessages : [];

  useEffect(() => {
    if (phase !== 'loading' || messagesArray.length === 0) return;
    // Start from a random index so it feels fresh each time
    setLoadingMsgIndex(Math.floor(Math.random() * messagesArray.length));
    const interval = setInterval(() => {
      setLoadingMsgIndex(prev => (prev + 1) % messagesArray.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [phase, messagesArray.length]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setPhase('idle');
      setError(null);
      setHasAutoStarted(false);
    }
  }, [isOpen]);

  // ── Main launcher ─────────────────────────────────────────
  const handleStartJourney = async () => {
    setPhase('loading');
    setError(null);

    const uploadIds = uploadedDocs.map(doc => doc.id || doc.uploadId);

    try {
      const pathResult = await plan_study_path(chatId, uploadIds, userPreferences, language);

      if (!pathResult?.nodes?.length) throw new Error('Failed to generate study path');

      // Skip diagnostic — the adaptive path handles personalization dynamically
      await finishSession(pathResult, uploadIds);
    } catch (err) {
      console.error('Error starting study journey:', err);
      setError(err.message || t('study.errorGenerating', 'Failed to create study path. Please try again.'));
      setPhase('idle');
    }
  };

  // ── Finish: create session + call onStart ─────────────────
  const finishSession = async (pathResult, uploadIds) => {
    try {
      const studyState = await createStudySession(chatId, pathResult, uploadIds);
      setPhase('done');
      if (onStart) onStart(studyState);
    } catch (err) {
      console.error('Error creating study session:', err);
      setError(err.message || t('study.errorGenerating', 'Failed to create study path. Please try again.'));
      setPhase('idle');
    }
  };

  // Auto-start
  useEffect(() => {
    if (isOpen && autoStart && !hasAutoStarted && phase === 'idle' && uploadedDocs.length > 0) {
      setHasAutoStarted(true);
      handleStartJourney();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoStart, hasAutoStarted, phase, uploadedDocs.length]);

  if (!isOpen) return null;

  // ── Derived ───────────────────────────────────────────────
  const docNames = uploadedDocs.map(d => d.name || d.filename || 'Document').join(', ');
  const docCount = uploadedDocs.length;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="study-modal-overlay" onClick={phase === 'idle' ? onClose : undefined}>
      <div className="study-modal" onClick={e => e.stopPropagation()}>

        {/* Close — only when idle */}
        {phase === 'idle' && (
          <button className="study-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* ── LOADING ── */}
        {phase === 'loading' && (
          <div className="study-modal-content">
            <div className="study-modal-mascot">
              <MascotComponent size={80} isActive={true} />
            </div>
            <h2 className="study-modal-title">{t('study.preparingJourney', 'Preparing Your Journey')}</h2>
            <div className="study-modal-progress">
              <div className="study-modal-loader">
                <div className="study-modal-loader-dot" />
                <div className="study-modal-loader-dot" />
                <div className="study-modal-loader-dot" />
              </div>
              <p className="study-modal-step" key={loadingMsgIndex}>
                {messagesArray.length > 0
                  ? messagesArray[loadingMsgIndex]
                  : t('study.analyzingDocs', 'Analyzing your documents...')}
              </p>
            </div>
          </div>
        )}

        {/* ── IDLE (initial confirm screen) ── */}
        {phase === 'idle' && (
          <>
            <div className="study-modal-content">
              <div className="study-modal-mascot">
                <MascotComponent size={80} isActive={true} />
              </div>
              <h2 className="study-modal-title">{t('study.startJourney', 'Start Study Journey')}</h2>

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
                    {docCount} {docCount === 1 ? t('study.document', 'document') : t('study.documents', 'documents')}
                  </span>
                  <span className="study-modal-doc-names">{docNames}</span>
                </div>
              </div>

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

              {topics.length > 0 && (
                <div className="study-modal-topics">
                  <p className="study-modal-topics-label">{t('study.topicsLabel', 'Your lessons will cover:')}</p>
                  <div className="study-modal-topics-list">
                    {topics.slice(0, 6).map((topic, idx) => (
                      <span key={idx} className="study-modal-topic-tag">{topic}</span>
                    ))}
                    {topics.length > 6 && (
                      <span className="study-modal-topic-more">+{topics.length - 6} {t('study.more', 'more')}</span>
                    )}
                  </div>
                </div>
              )}

              <p className="study-modal-description">
                {t('study.journeyDescription',
                  "I'll create a personalized study path based on your documents, with lessons, flashcards, quizzes, and audio to help you learn effectively."
                )}
              </p>

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
            </div>

            <div className="study-modal-actions">
              <button className="study-modal-cancel" onClick={onClose}>
                {t('common.cancel', 'Cancel')}
              </button>
              <button className="study-modal-start" onClick={handleStartJourney}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('study.beginJourney', 'Begin Journey')}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default StartStudyModal;
