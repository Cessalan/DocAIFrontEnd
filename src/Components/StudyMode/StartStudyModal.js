import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import BrainMascot from '../QuizRoom/BrainMascot';
import BookMascot from '../QuizRoom/BookMascot';
import PillMascot from '../QuizRoom/PillMascot';
import CoffeeCupMascot from '../QuizRoom/CoffeeCupMascot';
import MatchaCupMascot from '../QuizRoom/MatchaCupMascot';
import { plan_study_path, start_study_journey, clear_in_flight_study_journey } from '../../Services/FastAPICalls';
import { createStudySession } from '../../Services/StudySessionService';
import { formatNodeType, getStepTopicLabel } from './planFormatting';
import { getStudyNodeIcon } from './planNodeIcon';
import './StudyMode.css';

const MASCOTS = [BrainMascot, BookMascot, PillMascot, CoffeeCupMascot, MatchaCupMascot];

/**
 * StartStudyModal — Orchestrates the full study launch flow:
 *   1. loading       → /study/start streams; planPromise resolves on plan_ready
 *   2. plan_preview  → user sees their actual path while createStudySession runs in bg
 *   3. starting      → awaits createStudySession if user beats it
 *   4. done          → calls onStart(studyState)
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
  // 'idle' | 'loading' | 'plan_preview' | 'starting' | 'done'
  const [phase, setPhase] = useState('idle');

  // Plan revealed to user while session save is in flight
  const [pathResult, setPathResult] = useState(null);

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
      setPathResult(null);
    }
  }, [isOpen]);

  // ── Main launcher ─────────────────────────────────────────
  // /study/start emits plan_ready ~3-8s in. As soon as that lands we flip to
  // 'plan_preview' so the user can SEE their path instead of staring at a
  // spinner. The first node keeps streaming into the prefetch cache that
  // StudyModeContainer reads when auto-starting node 1.
  //
  // NOTE: createStudySession is NOT called here. It's deferred to
  // handleStartFromPreview ("Let's go") because the Firestore write sets
  // isStudySession:true on the chat, which auto-traps the user into study
  // mode on next visit (see ChatInterface.js:713). If the user closes the
  // modal during plan_preview, no Firestore mutation should have happened.
  const handleStartJourney = async () => {
    setPhase('loading');
    setError(null);
    setPathResult(null);

    const uploadIds = uploadedDocs.map(doc => doc.id || doc.uploadId);

    try {
      const { planPromise } = start_study_journey(chatId, uploadIds, userPreferences, language);
      const path = await planPromise;

      if (!path?.nodes?.length) throw new Error('Failed to generate study path');

      setPathResult(path);
      setPhase('plan_preview');
    } catch (err) {
      console.error('Error starting study journey via /study/start:', err);
      // Fallback to legacy two-call flow if the streaming endpoint fails for any reason.
      try {
        const path = await plan_study_path(chatId, uploadIds, userPreferences, language);
        if (!path?.nodes?.length) throw new Error('Failed to generate study path');
        setPathResult(path);
        setPhase('plan_preview');
      } catch (fallbackErr) {
        console.error('Error starting study journey (fallback):', fallbackErr);
        setError(fallbackErr.message || t('study.errorGenerating', 'Failed to create study path. Please try again.'));
        setPhase('idle');
      }
    }
  };

  // ── User confirms after seeing the plan ───────────────────
  // This is the commit point. createStudySession runs here — first time the
  // chat is mutated to a study session. Adds ~200-500ms to "Let's go" but
  // keeps the preview phase side-effect-free so a close is always recoverable.
  const handleStartFromPreview = async () => {
    if (!pathResult) return;
    setPhase('starting');
    try {
      const uploadIds = uploadedDocs.map(doc => doc.id || doc.uploadId);
      const studyState = await createStudySession(chatId, pathResult, uploadIds);
      setPhase('done');
      if (onStart) onStart(studyState);
    } catch (err) {
      console.error('Error creating study session:', err);
      setError(err.message || t('study.errorGenerating', 'Failed to create study path. Please try again.'));
      setPhase('plan_preview');
    }
  };

  // ── Safe close ────────────────────────────────────────────
  // Tears down any in-flight /study/start SSE stream so the backend doesn't
  // keep generating + sending events after the user has bailed. Safe to call
  // at any phase: clear_in_flight_study_journey is a no-op when there's no
  // active stream. No Firestore cleanup needed here because createStudySession
  // is deferred to "Let's go" — see handleStartJourney comment above.
  const safeClose = () => {
    if (chatId) clear_in_flight_study_journey(chatId);
    if (onClose) onClose();
  };

  // Escape key dismisses in dismissable phases. Skipped for 'starting'/'done'
  // (commit point passed) and the brief 'idle' window before autoStart fires.
  useEffect(() => {
    if (!isOpen) return;
    if (phase === 'starting' || phase === 'done') return;
    const onKey = (e) => {
      if (e.key === 'Escape') safeClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, phase]);

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
    <div className="study-modal-overlay" onClick={phase === 'idle' ? safeClose : undefined}>
      <div className="study-modal" onClick={e => e.stopPropagation()}>

        {/* Close — available while idle, generating, or previewing the plan.
            Hidden during 'starting'/'done' since createStudySession is mid-flight
            and a close there would be ambiguous (commit or abandon?). */}
        {(phase === 'idle' || phase === 'loading' || phase === 'plan_preview') && (
          <button
            className="study-modal-close"
            onClick={safeClose}
            aria-label={t('study.closeAria', 'Close')}
          >
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

        {/* ── PLAN PREVIEW ── shown the moment plan_ready arrives so the user
             sees their actual path while createStudySession finishes saving */}
        {phase === 'plan_preview' && pathResult && (
          <PlanPreviewPane
            pathResult={pathResult}
            onStart={handleStartFromPreview}
            t={t}
          />
        )}

        {/* ── STARTING ── user tapped "Let's go" but session save hadn't
             finished yet. Brief hand-off state. */}
        {phase === 'starting' && (
          <div className="study-modal-content">
            <div className="study-modal-mascot">
              <MascotComponent size={80} isActive={true} />
            </div>
            <h2 className="study-modal-title">{t('study.savingJourney', 'Saving your journey…')}</h2>
            <div className="study-modal-progress">
              <div className="study-modal-loader">
                <div className="study-modal-loader-dot" />
                <div className="study-modal-loader-dot" />
                <div className="study-modal-loader-dot" />
              </div>
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

// ──────────────────────────────────────────────────────────────────────────
// Plan preview — shown the moment /study/start emits plan_ready so the user
// can read their actual path instead of staring at a spinner.
//
// Splits the path into "section_banner" pseudo-nodes (used as headers) and the
// real learning nodes. Highlights the first real node and pitches it as the
// next step ("We'll start with a quick quiz on X").
// ──────────────────────────────────────────────────────────────────────────
// EN action verbs are bare ("quiz on") because the EN planPitch supplies "a
// quick" before them. FR action verbs include the gendered article ("un quiz
// sur" / "une leçon sur") because the FR planPitch drops the article — French
// nouns are gendered and "un petit leçon" would be ungrammatical.
const NODE_TYPE_META = {
  quiz:      { icon: '❓', actionEn: 'quiz on',          actionFr: 'un quiz sur' },
  flashcard: { icon: '🎴', actionEn: 'flashcard set on', actionFr: 'un jeu de cartes sur' },
  lesson:    { icon: '📖', actionEn: 'lesson on',        actionFr: 'une leçon sur' },
  audio:     { icon: '🎧', actionEn: 'audio lesson on',  actionFr: 'une leçon audio sur' },
  mindmap:   { icon: '🗺️', actionEn: 'mindmap of',       actionFr: 'une carte mentale de' },
  exam:      { icon: '📝', actionEn: 'practice exam on', actionFr: 'un examen blanc sur' }
};

const PlanPreviewPane = ({ pathResult, onStart, t }) => {
  const realNodes = (pathResult.nodes || []).filter(n => n.type !== 'section_banner');
  const firstNode = realNodes[0];
  const meta = (firstNode && NODE_TYPE_META[firstNode.type]) || NODE_TYPE_META.lesson;
  const lang = (t('locale.code', 'en') || 'en').toLowerCase();
  const action = lang.startsWith('fr') ? meta.actionFr : meta.actionEn;

  const totalSteps = realNodes.length;
  const minutes = pathResult.estimated_time_minutes;

  return (
    <div className="study-modal-content study-modal-plan-preview">
      <h2 className="study-modal-title">
        {t('study.planReadyTitle', 'Your path is ready')}
      </h2>

      {firstNode && (
        <p className="study-modal-plan-pitch">
          {t('study.planPitch', "We'll start with a quick {{action}} {{label}} — just to see where you're at.", {
            action,
            label: getStepTopicLabel(firstNode.label)
          })}
        </p>
      )}

      <ul className="study-modal-plan-list">
        {realNodes.slice(0, 6).map((node, idx) => {
          const isFirst = idx === 0;
          // Render the same way the destination StudyPlanOverview does — same
          // SVG icon, type tag on top in coral, clean topic label below — so
          // the user sees the same rows here that will appear on the study
          // page after Let's go.
          return (
            <li
              key={node.id || idx}
              className={`study-modal-plan-item ${isFirst ? 'is-first' : ''}`}
              data-type={node.type}
              style={{ animationDelay: `${idx * 70}ms` }}
            >
              <span className="study-modal-plan-icon" aria-hidden="true">
                {getStudyNodeIcon(node.type)}
              </span>
              <span className="study-modal-plan-content">
                <span className="study-modal-plan-type">
                  {formatNodeType(node.type, t)}
                </span>
                <span className="study-modal-plan-label">
                  {getStepTopicLabel(node.label) || node.type}
                </span>
              </span>
              {isFirst && (
                <span className="study-modal-plan-badge">
                  {t('study.planFirstBadge', 'Start here')}
                </span>
              )}
            </li>
          );
        })}
        {realNodes.length > 6 && (
          <li className="study-modal-plan-more">
            +{realNodes.length - 6} {t('study.planMore', 'more steps')}
          </li>
        )}
      </ul>

      {minutes ? (
        <p className="study-modal-plan-meta">
          {t('study.planEstimate', '{{steps}} steps · about {{mins}} min total', {
            steps: totalSteps,
            mins: minutes
          })}
        </p>
      ) : null}

      <button className="study-modal-start" onClick={onStart}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {t('study.letsGo', "Let's go")}
      </button>
    </div>
  );
};

export default StartStudyModal;
