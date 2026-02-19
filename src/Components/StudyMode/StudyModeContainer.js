import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import StudyModeHeader from './StudyModeHeader';
import StudyStepCard from './StudyStepCard';
import StudyPlanOverview from './StudyPlanOverview';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import BrainMascot from '../QuizRoom/BrainMascot';
import BookMascot from '../QuizRoom/BookMascot';
import PillMascot from '../QuizRoom/PillMascot';
import CoffeeCupMascot from '../QuizRoom/CoffeeCupMascot';
import MatchaCupMascot from '../QuizRoom/MatchaCupMascot';
import { generate_study_item_stream, generate_study_audio } from '../../Services/FastAPICalls';
import {
  updateNodeStatus,
  completeNodeAndAdvance,
  addAskedHash,
  saveNodeContent,
  getNodeContent,
  saveFlashcardProgress,
  saveQuizProgress,
  updateStudyPerformance,
  getStudyPerformance
} from '../../Services/StudySessionService';
import './StudyMode.css';

// Dev mode flag - only true in development builds
const isDev = process.env.NODE_ENV === 'development';

// Mascots that can be randomly selected (excluding NurseQuiz and Brain which have special states)
const SIDE_MASCOTS = [
  { Component: NurseQuizMascot, hasEmotions: true },
  { Component: BookMascot, hasEmotions: false },
  { Component: PillMascot, hasEmotions: false },
  { Component: CoffeeCupMascot, hasEmotions: false },
  { Component: MatchaCupMascot, hasEmotions: false }
];

/**
 * StudyModeContainer - Main orchestrator for study mode
 * Manages state, handles node transitions, and coordinates components
 *
 * Flow:
 * 1. When entering study mode, show the current node content
 * 2. When user exits a node (X button), show StudyPlanOverview
 * 3. When user clicks Continue, advance to next node
 * 4. When user clicks a node in overview, show that node's content
 *
 * @param {string} chatId - Study session chat ID
 * @param {Object} studyState - Study state from Firestore { path, status, askedHashes, ... }
 * @param {Function} onExit - Callback to exit study mode entirely (navigate away)
 * @param {Function} onComplete - Callback when study session is completed
 * @param {Function} onCloseSidebar - Callback to close the sidebar when user interacts with content
 * @param {string} language - Language for content generation
 */
const StudyModeContainer = ({
  chatId,
  studyState,
  sidebarOpen = true,
  onCloseSidebar,
  onExit,
  onComplete,
  viewOnly = false // Dev mode: view without triggering reviews or saving progress
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || 'en';

  // View state: 'node' (showing content) | 'overview' (showing plan)
  const [view, setView] = useState('overview');

  // State
  const [nodes, setNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [currentContent, setCurrentContent] = useState(null);
  const [savedProgress, setSavedProgress] = useState(null); // Flashcard/quiz progress
  const currentMessageIdRef = useRef(null); // Ref to track messageId for saving progress
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioMessage, setAudioMessage] = useState('');
  const [askedHashes, setAskedHashes] = useState([]);
  const [isComplete, setIsComplete] = useState(false);

  // Review confirmation modal state for completed nodes
  const [showReviewConfirm, setShowReviewConfirm] = useState(false);
  const [nodeToReview, setNodeToReview] = useState(null);

  // Track if current node is being reviewed (gives only 5 XP)
  const [isReviewingNode, setIsReviewingNode] = useState(false);

  // Performance tracking animation state
  const [insightPulse, setInsightPulse] = useState(null); // { type: 'strength'|'weakness'|'noted', topic }

  // Insights modal state
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [insightsData, setInsightsData] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [mascotState, setMascotState] = useState({
    type: 'nurse', // 'nurse' | 'brain'
    isExcited: false,
    isSurprised: false,
    lookDirection: 'center'
  });

  // Random mascot selection for the side mascot - persists during session
  const [sideMascot] = useState(() => SIDE_MASCOTS[Math.floor(Math.random() * SIDE_MASCOTS.length)]);

  // Initialize from studyState
  useEffect(() => {
    if (studyState?.path) {
      setNodes(studyState.path.nodes || []);
      setActiveNodeId(studyState.path.activeNodeId);
      setAskedHashes(studyState.askedHashes || []);
      setIsComplete(studyState.status === 'completed');
    }
  }, [studyState]);

  // Update active node when activeNodeId changes
  useEffect(() => {
    if (nodes.length > 0 && activeNodeId) {
      const node = nodes.find(n => n.id === activeNodeId);
      setActiveNode(node);
    }
  }, [nodes, activeNodeId]);

  // Calculate progress
  const completedCount = nodes.filter(n => n.status === 'done').length;
  const currentStep = completedCount + 1;
  const totalSteps = nodes.length;

  // Handle starting/loading a node's content
  const handleStartNode = useCallback(async (node) => {
    console.log('📚 Starting node:', node);
    console.log('📬 Node messageId:', node.messageId || 'NONE - will generate new content');

    // Close sidebar when user starts interacting with content
    if (onCloseSidebar) {
      onCloseSidebar();
    }

    setView('node');
    setIsLoadingContent(true);
    setCurrentContent(null);
    setSavedProgress(null);
    currentMessageIdRef.current = null; // Reset ref
    setActiveNode(node);
    setActiveNodeId(node.id);

    // Track if this is a review of completed content (for 5 XP instead of full XP)
    setIsReviewingNode(node.isReview === true);

    // Set mascot to thinking
    setMascotState({
      type: 'brain',
      isExcited: false,
      isSurprised: false,
      lookDirection: 'center'
    });

    try {
      // ========================================
      // CHECK FOR SAVED CONTENT FIRST
      // If node has messageId, retrieve saved content instead of regenerating
      // ========================================
      if (node.messageId) {
        console.log('📬 Node has messageId, checking for saved content:', node.messageId);
        const savedContent = await getNodeContent(chatId, node.messageId);

        if (savedContent?.studyContent) {
          console.log('✅ Retrieved saved content, skipping generation');
          setCurrentContent(savedContent.studyContent);
          currentMessageIdRef.current = node.messageId;

          // Restore saved progress if available
          if (savedContent.flashcardProgress) {
            console.log('📊 Restoring flashcard progress:', savedContent.flashcardProgress);
            setSavedProgress(savedContent.flashcardProgress);
          } else if (savedContent.quizProgress) {
            console.log('📊 Restoring quiz progress:', savedContent.quizProgress);
            setSavedProgress(savedContent.quizProgress);
          }

          // Set mascot back to nurse
          setMascotState({
            type: 'nurse',
            isExcited: false,
            isSurprised: false,
            lookDirection: 'down-center'
          });

          setIsLoadingContent(false);
          return; // Exit early - no need to generate
        } else {
          console.log('⚠️ messageId exists but content not found, will regenerate');
        }
      }

      // ========================================
      // GENERATE NEW CONTENT WITH STREAMING
      // Show cards/questions progressively as they arrive
      // ========================================
      console.log('🔄 Generating new content for node:', node.id);

      // For quiz and flashcard, we stream and show progressively
      // For lesson, we just wait for the complete content
      const isStreamable = node.type === 'quiz' || node.type === 'flashcard';

      // Initialize empty content structure for progressive display
      if (isStreamable) {
        setIsLoadingContent(false); // Stop showing loading spinner
        if (node.type === 'quiz') {
          setCurrentContent({ questions: [], _isStreaming: true, _expectedTotal: 12 });
        } else if (node.type === 'flashcard') {
          setCurrentContent({ cards: [], _isStreaming: true, _expectedTotal: 12 });
        }
      }

      // Progress callback for streaming updates
      const handleStreamProgress = (data) => {
        console.log('📥 Stream progress:', data.status);

        // Handle individual question arrival
        if (data.status === 'question_ready' && data.question) {
          const question = data.question;
          const answer = question.answer || 'A)';
          const answerLetter = answer[0] || 'A';
          const correctIndex = answerLetter.charCodeAt(0) - 'A'.charCodeAt(0);

          const formattedQuestion = {
            question: question.question || '',
            options: question.options || [],
            correctIndex: correctIndex,
            rationale: question.justification || '',
            topic: question.topic || node.label
          };

          setCurrentContent(prev => ({
            ...prev,
            questions: [...(prev?.questions || []), formattedQuestion]
          }));
        }

        // Handle individual flashcard arrival
        if (data.status === 'flashcard_ready' && data.flashcard) {
          setCurrentContent(prev => ({
            ...prev,
            cards: [...(prev?.cards || []), data.flashcard]
          }));
        }
      };

      const result = await generate_study_item_stream(
        chatId,
        node.type,
        node.label,
        node.tags || [],
        askedHashes,
        language,
        handleStreamProgress
      );

      // Skip saving in viewOnly mode
      if (!viewOnly) {
        // Save the content hash for anti-repeat
        if (result.hash) {
          await addAskedHash(chatId, result.hash);
          setAskedHashes(prev => [...prev, result.hash]);
        }

        // Save content as a message and link to node
        const messageId = await saveNodeContent(
          chatId,
          node.id,
          result.content,
          node.type
        );

        // Update node with messageId
        await updateNodeStatus(chatId, node.id, { messageId });

        // Update local state
        setNodes(prev => prev.map(n =>
          n.id === node.id ? { ...n, messageId } : n
        ));

        currentMessageIdRef.current = messageId;
      } else {
        console.log('👁️ Dev viewOnly mode - skipping save operations');
      }

      // Set final content (removes _isStreaming flag)
      setCurrentContent(result.content);

      // Set mascot back to nurse
      setMascotState({
        type: 'nurse',
        isExcited: false,
        isSurprised: false,
        lookDirection: 'down-center'
      });

    } catch (error) {
      console.error('❌ Error generating content:', error);
      // Show error state
      setMascotState({
        type: 'nurse',
        isExcited: false,
        isSurprised: true,
        lookDirection: 'center'
      });
    } finally {
      setIsLoadingContent(false);
    }
  }, [chatId, askedHashes, language, onCloseSidebar, viewOnly]);

  // Handle quiz answer
  const handleAnswer = useCallback((answerData) => {
    console.log('📝 Answer submitted:', answerData);

    // Only update mascot for actual answers (not navigation)
    if (answerData.isCorrect !== null) {
      // Update mascot based on correctness
      setMascotState({
        type: 'nurse',
        isExcited: answerData.isCorrect,
        isSurprised: !answerData.isCorrect,
        lookDirection: 'center'
      });

      // Reset surprised state after a moment
      if (!answerData.isCorrect) {
        setTimeout(() => {
          setMascotState(prev => ({
            ...prev,
            isSurprised: false
          }));
        }, 1500);
      }

      // Track performance on first attempt only (not review round)
      if (!viewOnly && !answerData.progress?.isReviewRound && answerData.questionIndex != null && currentContent?.questions) {
        const question = currentContent.questions[answerData.questionIndex];
        if (question) {
          const strengthLevel = updateStudyPerformance(chatId, {
            topic: question.topic || activeNode?.label || 'General',
            type: 'quiz',
            correct: answerData.isCorrect,
            concept: !answerData.isCorrect ? question.question : undefined
          });

          // Show the subtle tracking animation
          strengthLevel.then((level) => {
            setInsightPulse({
              type: answerData.isCorrect ? 'strength' : 'weakness',
              topic: question.topic || activeNode?.label || 'General'
            });
            // Auto-dismiss after animation
            setTimeout(() => setInsightPulse(null), 2400);
          });
        }
      }
    }

    // Save quiz progress if we have a messageId (use ref for latest value)
    // Skip saving in viewOnly mode
    const messageId = currentMessageIdRef.current;
    if (messageId && answerData.progress && !viewOnly) {
      saveQuizProgress(chatId, messageId, answerData.progress);

      // Calculate and update node progress percentage for the overview ring
      // New format uses questionStatuses object instead of answeredQuestions array
      if (answerData.progress.questionStatuses && currentContent?.questions) {
        const totalQuestions = currentContent.questions.length;
        const correctCount = Object.values(answerData.progress.questionStatuses)
          .filter(status => status === 'correct').length;
        const progressPercent = Math.round((correctCount / totalQuestions) * 100);

        // Update local node state with progress
        setNodes(prev => prev.map(n =>
          n.id === activeNodeId ? { ...n, nodeProgress: progressPercent } : n
        ));

        // Also persist to Firestore
        updateNodeStatus(chatId, activeNodeId, { nodeProgress: progressPercent });
      }
    }
  }, [chatId, activeNodeId, activeNode, currentContent, viewOnly]);

  // Handle flashcard review
  const handleReview = useCallback((reviewData) => {
    console.log('📖 Flashcard reviewed:', reviewData);
    console.log('📖 currentMessageIdRef.current at review time:', currentMessageIdRef.current);
    console.log('📖 reviewData.progress:', reviewData.progress);

    // Set excited if they got it
    if (reviewData.status === 'got_it') {
      setMascotState({
        type: 'nurse',
        isExcited: true,
        isSurprised: false,
        lookDirection: 'center'
      });
    }

    // Track performance on first attempt only (not review round)
    if (!viewOnly && !reviewData.progress?.isReviewRound && reviewData.cardIndex != null && currentContent?.cards) {
      const isMastered = reviewData.status === 'got_it';
      const card = currentContent.cards[reviewData.cardIndex];
      if (card) {
        const strengthLevel = updateStudyPerformance(chatId, {
          topic: card.topic || activeNode?.label || 'General',
          type: 'flashcard',
          mastered: isMastered,
          concept: !isMastered ? card.front : undefined
        });

        // Show the subtle tracking animation
        strengthLevel.then((level) => {
          setInsightPulse({
            type: isMastered ? 'strength' : 'weakness',
            topic: card.topic || activeNode?.label || 'General'
          });
          setTimeout(() => setInsightPulse(null), 2400);
        });
      }
    }

    // Save flashcard progress if we have a messageId (use ref for latest value)
    // Skip saving in viewOnly mode
    const messageId = currentMessageIdRef.current;
    if (messageId && reviewData.progress && !viewOnly) {
      console.log('💾 Calling saveFlashcardProgress with messageId:', messageId);
      saveFlashcardProgress(chatId, messageId, reviewData.progress);

      // Calculate and update node progress percentage for the overview ring
      if (reviewData.progress.cardStatuses && currentContent?.cards) {
        const totalCards = currentContent.cards.length;
        const reviewedCards = Object.keys(reviewData.progress.cardStatuses).length;
        const progressPercent = Math.round((reviewedCards / totalCards) * 100);

        // Update local node state with progress
        setNodes(prev => prev.map(n =>
          n.id === activeNodeId ? { ...n, nodeProgress: progressPercent } : n
        ));

        // Also persist to Firestore
        updateNodeStatus(chatId, activeNodeId, { nodeProgress: progressPercent });
      }
    } else if (!viewOnly) {
      console.log('⚠️ NOT saving progress - messageId:', messageId, 'progress:', !!reviewData.progress);
    }
  }, [chatId, activeNodeId, activeNode, currentContent, viewOnly]);

  // Handle audio generation trigger
  const handleGenerateAudio = useCallback(async (audioConfig) => {
    console.log('🎵 Generating audio:', audioConfig);
    setIsGeneratingAudio(true);
    setAudioMessage(t('study.creatingAudioLesson', 'Creating your audio lesson...'));

    try {
      // Call the backend to generate audio
      const result = await generate_study_audio(
        chatId,
        audioConfig.topic,
        audioConfig.intent || 'teach',
        audioConfig.duration || 2,
        language,
        // Progress callback
        (progress) => {
          if (progress.status === 'audio_generating') {
            setAudioMessage(progress.message || t('audio.generatingAudio', 'Generating audio...'));
          } else if (progress.status === 'audio_script_ready') {
            setAudioMessage(t('study.convertingToSpeech', 'Converting to speech...'));
          } else if (progress.status === 'audio_tts_progress') {
            setAudioMessage(t('study.generatingAudioProgress', { progress: progress.progress || 50, defaultValue: `Generating audio... ${progress.progress || 50}%` }));
          }
        }
      );

      if (result && result.audioBase64) {
        // Update the current content with the audio data
        setCurrentContent(prev => ({
          ...prev,
          audioBase64: result.audioBase64,
          audioDuration: result.audioDuration,
          script: result.script
        }));

        console.log('✅ Audio generated successfully');
      } else {
        console.error('❌ No audio data received');
        setAudioMessage(t('study.failedToGenerate', 'Failed to generate audio'));
      }
    } catch (error) {
      console.error('❌ Audio generation failed:', error);
      setAudioMessage(`Error: ${error.message}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [chatId, language]);

  // Handle continue to next node
  const handleContinue = useCallback(async () => {
    console.log('➡️ Continuing to next node');

    // Set mascot excited
    setMascotState({
      type: 'nurse',
      isExcited: true,
      isSurprised: false,
      lookDirection: 'center'
    });

    try {
      // Complete current node and advance
      const result = await completeNodeAndAdvance(chatId, activeNodeId);

      // Update local state
      setNodes(prev => prev.map(n => {
        if (n.id === activeNodeId) {
          return { ...n, status: 'done' };
        }
        if (n.id === result.nextNodeId) {
          return { ...n, status: 'active' };
        }
        return n;
      }));

      if (result.isComplete) {
        // Study session complete!
        setIsComplete(true);
        setView('overview'); // Show overview with all nodes completed
        if (onComplete) {
          onComplete();
        }
      } else {
        // Go back to overview to show progress, user can click next node
        setActiveNodeId(result.nextNodeId);
        setCurrentContent(null);
        setView('overview');

        // Reset mascot
        setMascotState({
          type: 'nurse',
          isExcited: false,
          isSurprised: false,
          lookDirection: 'center'
        });
      }
    } catch (error) {
      console.error('❌ Error advancing to next node:', error);
    }
  }, [chatId, activeNodeId, onComplete]);

  // Handle exit from node view - go back to overview
  const handleExitNode = useCallback(() => {
    console.log('📚 Exiting node, returning to overview');
    setCurrentContent(null);
    setView('overview');
    setMascotState({
      type: 'nurse',
      isExcited: false,
      isSurprised: false,
      lookDirection: 'center'
    });
  }, []);

  // Handle exit from overview - leave study mode entirely
  const handleExitStudy = useCallback(() => {
    console.log('📚 Exiting study mode');
    if (onExit) {
      onExit();
    }
  }, [onExit]);

  // Handle node selection from overview
  // Shows confirmation dialog for completed nodes (unless in viewOnly mode)
  const handleNodeSelect = useCallback((node) => {
    console.log('📚 Node selected from overview:', node);

    // In viewOnly mode (dev), skip confirmation and don't track as review
    if (viewOnly) {
      console.log('👁️ Dev viewOnly mode - viewing node without triggering review');
      handleStartNode({ ...node, isReview: false, _viewOnly: true });
      return;
    }

    // If node is already done, show confirmation dialog
    if (node.status === 'done') {
      setNodeToReview(node);
      setShowReviewConfirm(true);
      return;
    }

    // Otherwise, start the node directly
    handleStartNode(node);
  }, [handleStartNode, viewOnly]);

  // Handle confirming review of completed node
  const handleConfirmReview = useCallback(() => {
    if (nodeToReview) {
      // Pass isReview flag so cards know to give only 5 XP
      handleStartNode({ ...nodeToReview, isReview: true });
    }
    setShowReviewConfirm(false);
    setNodeToReview(null);
  }, [nodeToReview, handleStartNode]);

  // Handle canceling review
  const handleCancelReview = useCallback(() => {
    setShowReviewConfirm(false);
    setNodeToReview(null);
  }, []);

  // Handle mascot click — open insights modal
  const handleMascotClick = useCallback(async () => {
    setShowInsightsModal(true);
    setInsightsLoading(true);
    try {
      const data = await getStudyPerformance(chatId);
      setInsightsData(data);
    } catch (error) {
      console.error('Failed to load insights:', error);
      setInsightsData(null);
    } finally {
      setInsightsLoading(false);
    }
  }, [chatId]);

  // Insights modal — shared between overview and node view
  const renderInsightsModal = () => {
    if (!showInsightsModal) return null;
    return (
      <div className="insights-overlay" onClick={() => setShowInsightsModal(false)}>
        <div className="insights-modal" onClick={(e) => e.stopPropagation()}>
          <div className="insights-modal__header">
            <div className="insights-modal__title-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3>{t('study.yourInsights', 'Your Insights')}</h3>
            </div>
            <button className="insights-modal__close" onClick={() => setShowInsightsModal(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="insights-modal__body">
            {insightsLoading ? (
              <div className="insights-modal__loading">
                <div className="study-loading-spinner" />
                <p>{t('study.loadingInsights', 'Loading...')}</p>
              </div>
            ) : !insightsData || !insightsData.topics || Object.keys(insightsData.topics).length === 0 ? (
              <div className="insights-modal__empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p>{t('study.noInsightsYet', 'No data yet — complete a quiz or flashcard set to see your insights.')}</p>
              </div>
            ) : (
              <>
                {Object.entries(insightsData.topics)
                  .sort(([, a], [, b]) => {
                    const order = { weak: 0, developing: 1, strong: 2 };
                    return (order[a.strengthLevel] || 1) - (order[b.strengthLevel] || 1);
                  })
                  .map(([topicName, topic]) => {
                    const quizAcc = topic.questionsTotal > 0
                      ? Math.round((topic.questionsCorrect / topic.questionsTotal) * 100)
                      : null;
                    const flashAcc = topic.flashcardsTotal > 0
                      ? Math.round((topic.flashcardsMastered / topic.flashcardsTotal) * 100)
                      : null;

                    return (
                      <div key={topicName} className={`insights-topic insights-topic--${topic.strengthLevel || 'developing'}`}>
                        <div className="insights-topic__header">
                          <span className={`insights-topic__badge insights-topic__badge--${topic.strengthLevel || 'developing'}`}>
                            {topic.strengthLevel === 'strong' ? t('study.strong', 'Strong')
                              : topic.strengthLevel === 'weak' ? t('study.weak', 'Needs work')
                              : t('study.developing', 'Developing')}
                          </span>
                          <h4 className="insights-topic__name">{topicName}</h4>
                        </div>

                        <div className="insights-topic__stats">
                          {quizAcc !== null && (
                            <div className="insights-stat">
                              <div className="insights-stat__bar-track">
                                <div
                                  className={`insights-stat__bar-fill insights-stat__bar-fill--${quizAcc >= 85 ? 'strong' : quizAcc >= 60 ? 'developing' : 'weak'}`}
                                  style={{ width: `${quizAcc}%` }}
                                />
                              </div>
                              <span className="insights-stat__label">
                                {t('study.quizAccuracy', 'Quiz')} {quizAcc}%
                                <span className="insights-stat__detail"> ({topic.questionsCorrect}/{topic.questionsTotal})</span>
                              </span>
                            </div>
                          )}
                          {flashAcc !== null && (
                            <div className="insights-stat">
                              <div className="insights-stat__bar-track">
                                <div
                                  className={`insights-stat__bar-fill insights-stat__bar-fill--${flashAcc >= 85 ? 'strong' : flashAcc >= 60 ? 'developing' : 'weak'}`}
                                  style={{ width: `${flashAcc}%` }}
                                />
                              </div>
                              <span className="insights-stat__label">
                                {t('study.flashcardAccuracy', 'Flashcards')} {flashAcc}%
                                <span className="insights-stat__detail"> ({topic.flashcardsMastered}/{topic.flashcardsTotal})</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {topic.missedConcepts && topic.missedConcepts.length > 0 && (
                          <div className="insights-topic__missed">
                            <span className="insights-topic__missed-label">{t('study.toReview', 'To review:')}</span>
                            <ul className="insights-topic__missed-list">
                              {topic.missedConcepts.slice(-3).map((concept, i) => (
                                <li key={i}>{concept.length > 80 ? concept.substring(0, 80) + '...' : concept}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Build studyState for overview (with updated nodes)
  const currentStudyState = {
    ...studyState,
    path: {
      ...studyState?.path,
      nodes: nodes
    }
  };

  // Render overview (Duolingo-style path)
  if (view === 'overview') {
    return (
      <>
        {/* Dev mode indicator */}
        {viewOnly && isDev && (
          <div style={{
            position: 'fixed',
            top: 10,
            right: 10,
            background: '#ff9800',
            color: '#000',
            padding: '6px 12px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            👁️ VIEW ONLY MODE
          </div>
        )}
        <StudyPlanOverview
          studyState={currentStudyState}
          onNodeSelect={handleNodeSelect}
          onExit={handleExitStudy}
          onShowInsights={handleMascotClick}
          sidebarOpen={sidebarOpen}
        />

        {renderInsightsModal()}

        {/* Review Confirmation Modal */}
        {showReviewConfirm && nodeToReview && (
          <div className="review-confirm-overlay" onClick={handleCancelReview}>
            <div className="review-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="review-confirm-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                  <path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.76 16.26C19.54 15.03 20 13.57 20 12C20 7.58 16.42 4 12 4ZM12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.24 7.74C4.46 8.97 4 10.43 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" />
                </svg>
              </div>
              <h3 className="review-confirm-title">
                {t('study.reviewNode', 'Review this lesson?')}
              </h3>
              <p className="review-confirm-description">
                {t('study.reviewNodeDescription', "You've already completed this lesson. Would you like to review it again?")}
              </p>
              <div className="review-confirm-xp">
                <span className="xp-badge">+5 XP</span>
                <span className="xp-text">{t('study.earnXpReview', 'for reviewing')}</span>
              </div>
              <div className="review-confirm-buttons">
                <button className="review-confirm-cancel" onClick={handleCancelReview}>
                  {t('common.cancel', 'Cancel')}
                </button>
                <button className="review-confirm-button" onClick={handleConfirmReview}>
                  {t('study.reviewNow', 'Review Now')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Render node content view
  return (
    <div className={`study-mode-container study-mode-focused ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <StudyModeHeader
        unitTitle={studyState?.path?.unitTitle || activeNode?.label || 'Study Session'}
        unitSubtitle={studyState?.path?.unitSubtitle || ''}
      />

      <div className="study-main-content">
        {/* Centered content - no path view, just the current step */}
        <div className="study-focused-layout">
          <div className="study-content-centered">
            {isLoadingContent ? (
              <div className="study-step-card">
                <div className="study-loading">
                  <div className="study-loading-spinner" />
                  <p className="study-loading-text">
                    {t('study.preparing', { type: t(`study.nodeType.${activeNode?.type}`, activeNode?.type || 'lesson').toLowerCase(), defaultValue: `Preparing your ${activeNode?.type || 'lesson'}...` })}
                  </p>
                </div>
              </div>
            ) : currentContent ? (
              <StudyStepCard
                node={activeNode}
                content={currentContent}
                savedProgress={savedProgress}
                isLoading={false}
                isReviewMode={isReviewingNode}
                viewOnly={viewOnly}
                isGeneratingAudio={isGeneratingAudio}
                audioGeneratingMessage={audioMessage}
                onAnswer={handleAnswer}
                onReview={handleReview}
                onGenerateAudio={handleGenerateAudio}
                onContinue={handleContinue}
                onExit={handleExitNode}
              />
            ) : (
              <div className="study-step-card">
                <div className="study-loading">
                  <div className="study-loading-spinner" />
                  <p className="study-loading-text">
                    {t('study.startingSession', 'Starting your study session...')}
                  </p>
                </div>
              </div>
            )}

            {/* Mascot - positioned to the side, clickable to show insights */}
            <div
              className={`study-mascot-side ${mascotState.isExcited ? 'mascot-celebrate' : ''}`}
              onClick={handleMascotClick}
              role="button"
              tabIndex={0}
              title={t('study.viewInsights', 'View your progress insights')}
              style={{ cursor: 'pointer' }}
            >
              {/* Insight pulse — floats above mascot */}
              {insightPulse && (
                <div className={`insight-pulse insight-pulse--${insightPulse.type}`} key={Date.now()}>
                  <div className="insight-pulse__icon">
                    {insightPulse.type === 'strength' ? (
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    )}
                  </div>
                  <span className="insight-pulse__text">
                    {insightPulse.type === 'strength' ? t('study.notedStrength', 'Noted as strength') : t('study.notedReview', 'Noted for review')}
                  </span>
                </div>
              )}
              {mascotState.type === 'brain' ? (
                <BrainMascot size={90} />
              ) : sideMascot.hasEmotions ? (
                <sideMascot.Component
                  size={90}
                  isExcited={mascotState.isExcited}
                  isSurprised={mascotState.isSurprised}
                  lookDirection={mascotState.lookDirection}
                />
              ) : (
                <sideMascot.Component
                  size={90}
                  isActive={true}
                  isExcited={mascotState.isExcited}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {renderInsightsModal()}
    </div>
  );
};

export default StudyModeContainer;
