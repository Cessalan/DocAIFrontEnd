import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import { generationUnits } from '../../Services/UsageService';
import StudyModeHeader from './StudyModeHeader';
import StudyLoadingScreen from './StudyLoadingScreen';
import StudyStepCard from './StudyStepCard';
import StudyPlanOverview from './StudyPlanOverview';
import QuizMasterySummary from './QuizMasterySummary';
import NodeTransition from './NodeTransition';
import NurseQuizMascot from '../QuizRoom/NurseQuizMascot';
import PerformanceBreakdown from '../Progress/PerformanceBreakdown';
import BrainMascot from '../QuizRoom/BrainMascot';
import BookMascot from '../QuizRoom/BookMascot';
import PillMascot from '../QuizRoom/PillMascot';
import CoffeeCupMascot from '../QuizRoom/CoffeeCupMascot';
import MatchaCupMascot from '../QuizRoom/MatchaCupMascot';
import ExamConfigModal from './ExamConfigModal';
import { getStepTopicLabel } from './planFormatting';
import { computeReadinessDelta } from './readinessDelta';
import DevPaywallPill from '../Common/DevPaywallPill';
import { markMessageEngaged } from '../../Services/FireBaseServiceChats';
import { generate_study_item_stream, generate_study_audio, generate_study_mindmap, plan_review_path, interpret_study_request, generate_exam, get_prefetched_node_content, consume_prefetched_node_content } from '../../Services/FastAPICalls';
import { devLog } from '../../Services/devLogger';
import {
  updateNodeStatus,
  completeNodeAndAdvance,
  insertNodeAfterCurrent,
  addAskedHash,
  saveNodeContent,
  getNodeContent,
  updateMindmapData,
  updateAudioData,
  saveFlashcardProgress,
  saveQuizProgress,
  saveMindmapProgress,
  updateStudyPerformance,
  getStudyPerformance,
  appendPhase2,
  extendStudyPath,
  getStudySession
} from '../../Services/StudySessionService';
import './StudyMode.css';

// Dev mode flag - only true in development builds
const isDev = process.env.NODE_ENV === 'development';

/* ──────────────────────────────────────────────────────────
   Node sizes — MUST match STUDY_QUIZ_QUESTIONS /
   STUDY_FLASHCARD_CARDS / STUDY_DIAGNOSTIC_QUESTIONS in
   NQBackEnd2/main.py. They drive `_expectedTotal`, which the
   cards use for progress bars and "waiting for next item"
   states while streaming — if they drift from the backend the
   bar stalls short of full or completes early.
   ────────────────────────────────────────────────────────── */
const QUIZ_QUESTIONS = 5;
const FLASHCARD_CARDS = 5;
const DIAGNOSTIC_QUESTIONS = 3;

/* Readiness maths lives in readinessDelta.js, tested.

   It used to be inlined here and it was wrong in a way a student could see:
   it averaged only the topics she had already TOUCHED, while the readiness
   card on the plan overview averages every CURRICULUM topic with untested
   ones at 0. Same label, two different numbers — and early in a plan the
   inline version turned one 5-of-5 quiz into "↑ 28% closer to ready", which
   overstates it by more than double. See the file header for the full
   account. */

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
  examDate = null, // Hydrated from chat doc; drives the dated plan + countdown
  examName = null, // Names the exam the plan is for ("Pharmacology Final")
  sidebarOpen = true,
  onCloseSidebar,
  onExit,
  onComplete,
  viewOnly = false, // Dev mode: view without triggering reviews or saving progress
  autoStart = false // Auto-launch the first node
}) => {
  const { t, i18n } = useTranslation();
  const language = (i18n.language || 'en').split('-')[0].toLowerCase();
  const { userProfile } = useAuth() || {};

  // Usage throttle (monetization gate): block + show upgrade modal when the
  // weekly generation bucket is empty; charge one unit per new node generated.
  const { requireQuota, consume: consumeGeneration } = useUsageLimit();

  // View state: 'node' (showing content) | 'overview' (showing plan)
  const [view, setView] = useState('overview');

  // State
  const [nodes, setNodes] = useState([]);
  // Mirror of `nodes` readable from inside async handlers without stale
  // closures — the transition screen needs the next node object immediately
  // after advancing, before React has re-rendered.
  const nodesRef = useRef([]);
  nodesRef.current = nodes;
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [currentContent, setCurrentContent] = useState(null);
  const [savedProgress, setSavedProgress] = useState(null); // Flashcard/quiz progress
  const currentMessageIdRef = useRef(null); // Ref to track messageId for saving progress
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  // True while the active node is the plan's auto-launched first quiz. Drives
  // the low-stakes calibration framing (short, unscored, "not sure" allowed).
  const [isDiagnosticNode, setIsDiagnosticNode] = useState(false);
  // Id of the first non-banner node — kept in a ref so handleStartNode can read
  // it without taking `nodes` as a dependency (it would rebuild on every save).
  const firstRealNodeIdRef = useRef(null);
  const [contentError, setContentError] = useState(null); // Error message when content generation fails
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioMessage, setAudioMessage] = useState('');
  // True when the user advanced past an audio node via the Skip button on
  // the intro screen instead of actually listening. Used by the post-node
  // transition screen to show "You skipped the audio" instead of the
  // default "You listened to…" copy. Cleared on every new node start.
  const [audioWasSkipped, setAudioWasSkipped] = useState(false);
  const [isGeneratingMindmap, setIsGeneratingMindmap] = useState(false);
  const [mindmapMessage, setMindmapMessage] = useState('');
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

  // Phase 2 state
  const [isGeneratingPhase2, setIsGeneratingPhase2] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(studyState?.currentPhase || 1);
  const [totalPhases, setTotalPhases] = useState(studyState?.totalPhases || 1);
  const [pathUpdateToast, setPathUpdateToast] = useState(null); // { count: number }
  // Tracked locally so the block-complete card updates the moment an extend
  // lands, without waiting for the parent's chat doc to round-trip.
  const [reserveRemaining, setReserveRemaining] = useState(null);

  // Quiz mastery summary (shown after every quiz instead of immediately advancing)
  const [quizSummaryData, setQuizSummaryData] = useState(null);
  // Performance snapshot captured when a scored node starts (to calculate
  // readiness delta on the post-node transition screen)
  const preNodeSnapshotRef = useRef(null);
  // handleExamStart is defined below handleStartNode, which needs to call it
  // for pre-configured drills. Held in a ref so the two don't have to be
  // reordered (and so neither ends up in the other's dependency array).
  const handleExamStartRef = useRef(null);
  // Latest quiz progress from handleAnswer (to get final score at completion)
  const latestQuizProgressRef = useRef(null);
  // Readiness delta (% closer to ready) for the transition screen.
  // Hidden when null/<=0 or when no exam date is set.
  const [readinessDelta, setReadinessDelta] = useState(null);

  // Flashcard adaptive feedback
  const [consecutiveGotIt, setConsecutiveGotIt] = useState(0);
  const [hasShownAdaptiveMode, setHasShownAdaptiveMode] = useState(false);
  const [adaptiveFeedback, setAdaptiveFeedback] = useState(null); // { type: 'speed'|'adaptive_mode', topic }

  // ── Exam config modal state ─────────────────────────────────────────
  const [showExamConfig, setShowExamConfig] = useState(false);
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);
  const [pendingExamNode, setPendingExamNode] = useState(null); // The exam node awaiting config

  // ── Node Transition state (post-node decision screen) ──────────────
  // isAdvancing drives the pending state on the primary CTA; advanceLockRef
  // blocks re-entry while the advance is in flight (see handleTransitionContinue).
  const [isAdvancing, setIsAdvancing] = useState(false);
  const advanceLockRef = useRef(false);
  const [isLoadingPractice, setIsLoadingPractice] = useState(false);
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [customEcho, setCustomEcho] = useState(null); // { message, node }
  // Snapshot of flashcard progress at completion time (for transition screen)
  const latestFlashcardProgressRef = useRef(null);
  const latestMindmapProgressRef = useRef(null);

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
      setCurrentPhase(studyState.currentPhase || 1);
      setTotalPhases(studyState.totalPhases || 1);
    }
  }, [studyState]);

  // Load insights for current chat; clear immediately when chat changes
  useEffect(() => {
    setInsightsData(null);
    if (!chatId) return;
    getStudyPerformance(chatId)
      .then(data => {
        // Only show panel if there's at least one topic with real data
        const hasData = data?.topics && Object.values(data.topics).some(
          t => t.questionsTotal > 0 || t.flashcardsTotal > 0
        );
        setInsightsData(hasData ? data : null);
      })
      .catch(() => setInsightsData(null));
  }, [chatId]);

  // Update active node when activeNodeId changes
  useEffect(() => {
    if (nodes.length > 0 && activeNodeId) {
      const node = nodes.find(n => n.id === activeNodeId);
      setActiveNode(node);
    }
  }, [nodes, activeNodeId]);

  // Calculate progress (exclude section_banner pseudo-nodes)
  const realNodes = nodes.filter(n => n.type !== 'section_banner');
  firstRealNodeIdRef.current = realNodes[0]?.id || null;
  const completedCount = realNodes.filter(n => n.status === 'done').length;
  const currentStep = completedCount + 1;
  const totalSteps = realNodes.length;

  // Topic the paywall would name if the user were blocked right now — the node
  // they're on, else the next unfinished one. Dev preview only (see DevPaywallPill).
  const paywallTopic = isDev
    ? getStepTopicLabel(
        activeNode?.label
        || realNodes.find(n => n.status !== 'done')?.label
        || realNodes[0]?.label
        || ''
      ) || null
    : null;

  // Handle starting/loading a node's content.
  //
  // Returns a marker when the start did NOT open the node view: 'exam_config'
  // (config modal opened instead) or 'blocked' (paywall opened, nothing
  // launched). Callers outside the overview MUST handle both — otherwise the
  // user is left staring at the screen they clicked from with no reaction.
  const handleStartNode = useCallback(async (node) => {
    console.log('📚 Starting node:', node);
    console.log('📬 Node messageId:', node.messageId || 'NONE - will generate new content');

    // ── Exam nodes: show config modal instead of generating immediately ──
    if (node.type === 'exam' && !node.messageId) {
      // Usage throttle: block only when the free bucket is completely empty.
      // Any remaining quota lets the exam through — the charge in
      // handleExamStart may overshoot the cap on purpose (we'd rather let her
      // finish a full mini-test than cut it short; the modal explains this).
      if (!viewOnly && !requireQuota({ topic: getStepTopicLabel(node.label) })) {
        return 'blocked';
      }
      /* A node that arrives with its own config was built by the post-node
         recommendation, which already told her what it was going to do and
         why. Stopping to ask her to choose the format would contradict the
         copy that got her here, so these launch straight into generation and
         show the node view's loading state while it runs. */
      if (node.examConfig && handleExamStartRef.current) {
        setActiveNode(node);
        setActiveNodeId(node.id);
        setCurrentContent(null);
        setContentError(null);
        setSavedProgress(null);
        setIsLoadingContent(true);
        setView('node');
        if (onCloseSidebar) onCloseSidebar();
        setPendingExamNode(node);
        handleExamStartRef.current(node.examConfig, node);
        return;
      }

      setPendingExamNode(node);
      setShowExamConfig(true);
      return 'exam_config';
    }

    // Usage throttle: only a brand-new node (no messageId) actually generates
    // and therefore costs a unit. Cached re-visits load saved content for free
    // and aren't gated. Dev viewOnly mode is exempt. Block before any loading
    // UI so a throttled start is a clean no-op (modal opens via requireQuota).
    if (!node.messageId && !viewOnly && !requireQuota({ topic: getStepTopicLabel(node.label) })) {
      return 'blocked';
    }

    // ── Diagnostic detection ──────────────────────────────────────────
    // The first real node of phase 1 auto-launches. When it's a quiz, treat it
    // as calibration rather than assessment: 3 questions, an "I'm not sure"
    // option, and no score at the end. Production data showed quiz-first plans
    // completing node 1 at 67% vs 89% for lesson-first — opening with a graded
    // 12-question test is the single most avoidable way to lose an anxious user.
    const isDiagnostic = node.type === 'quiz'
      && node.id === firstRealNodeIdRef.current
      && (node.phase || 1) === 1;
    setIsDiagnosticNode(isDiagnostic);

    // Close sidebar when user starts interacting with content
    if (onCloseSidebar) {
      onCloseSidebar();
    }

    setView('node');
    setIsLoadingContent(true);
    setContentError(null);
    setCurrentContent(null);
    setSavedProgress(null);
    currentMessageIdRef.current = null; // Reset ref
    setActiveNode(node);
    setActiveNodeId(node.id);
    // Defensive reset: if a previous audio node's generation was somehow
    // left in flight (rare, e.g. user navigated mid-fetch), this prevents
    // the new audio node from being misread as "currently generating" and
    // skipping past its Listen/Skip intro screen.
    setIsGeneratingAudio(false);
    setAudioMessage('');
    // Clear the skipped flag so a previous audio's "skipped" status doesn't
    // bleed into the new node's transition screen.
    setAudioWasSkipped(false);

    // Track if this is a review of completed content (for 5 XP instead of full XP)
    setIsReviewingNode(node.isReview === true);

    // Reset per-node adaptive state
    setConsecutiveGotIt(0);
    setHasShownAdaptiveMode(false);
    setAdaptiveFeedback(null);
    latestQuizProgressRef.current = null;

    // Snapshot current performance before any scored node (quiz/flashcard/exam)
    // so the post-node transition screen can show a readiness delta.
    if (node.type === 'quiz' || node.type === 'flashcard' || node.type === 'exam') {
      getStudyPerformance(chatId).then(data => {
        preNodeSnapshotRef.current = data;
      }).catch(() => { preNodeSnapshotRef.current = null; });
    } else {
      preNodeSnapshotRef.current = null;
    }

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
          // For mindmap nodes: merge top-level mindmapData into studyContent as fallback
          // in case the studyContent.mindmapData nested update didn't persist
          let contentToSet = savedContent.studyContent;
          if (node.type === 'mindmap' && savedContent.mindmapData && !contentToSet?.mindmapData) {
            contentToSet = { ...contentToSet, mindmapData: savedContent.mindmapData };
          }
          setCurrentContent(contentToSet);
          currentMessageIdRef.current = node.messageId;

          // Restore saved progress if available
          if (savedContent.flashcardProgress) {
            console.log('📊 Restoring flashcard progress:', savedContent.flashcardProgress);
            setSavedProgress(savedContent.flashcardProgress);
          } else if (savedContent.quizProgress) {
            console.log('📊 Restoring quiz progress:', savedContent.quizProgress);
            setSavedProgress(savedContent.quizProgress);
          } else if (savedContent.mindmapProgress) {
            console.log('📊 Restoring mindmap progress:', savedContent.mindmapProgress);
            setSavedProgress(savedContent.mindmapProgress);
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
      // PREFETCH CACHE CHECK
      // /study/start populates this cache when the user kicks off the journey,
      // so the first node's content is ready (or in flight) by the time we get
      // here. Skip the second /study/generate-item-stream round trip entirely.
      // Falls through to streaming if the prefetch was skipped or failed.
      // ========================================
      if (!viewOnly) {
        const prefetched = get_prefetched_node_content(chatId, node.id);
        if (prefetched) {
          // Consume up front so a re-render doesn't double-process the same content.
          consume_prefetched_node_content(chatId, node.id);
          try {
            const result = await prefetched;
            if (result?.content) {
              console.log(`✅ Using prefetched content for node ${node.id}`);
              setCurrentContent(result.content);

              // Persist hash + content to Firestore. Await so currentMessageIdRef
              // is guaranteed set before the user can record progress (matches
              // the streaming branch's contract).
              if (result.hash) {
                await addAskedHash(chatId, result.hash);
                setAskedHashes(prev => [...prev, result.hash]);
              }
              const messageId = await saveNodeContent(chatId, node.id, result.content, node.type);
              await updateNodeStatus(chatId, node.id, { messageId });
              setNodes(prev => prev.map(n => n.id === node.id ? { ...n, messageId } : n));
              currentMessageIdRef.current = messageId;
              consumeGeneration(generationUnits(result.content)); // charge per question/card (prefetch path)

              setMascotState({
                type: 'nurse',
                isExcited: false,
                isSurprised: false,
                lookDirection: 'down-center'
              });
              setIsLoadingContent(false);
              return;
            }
            // Resolved with null (skipped/failed) — fall through to streaming.
            console.log(`ℹ️ Prefetch for node ${node.id} returned no content; falling back to streaming.`);
          } catch (err) {
            console.warn('Prefetched content rejected; falling back to streaming:', err);
          }
        }
      }

      // ========================================
      // GENERATE NEW CONTENT WITH STREAMING
      // Show cards/questions progressively as they arrive
      // ========================================
      console.log('🔄 Generating new content for node:', node.id);

      // Quiz, flashcard AND lesson all stream progressively.
      // Lessons used to block on the full payload — measured against production
      // data that cost ~1 in 5 lesson-first sessions, because a >18s wait meant
      // staring at a frozen loading screen. The backend now emits lesson pages
      // as they finish, so page 1 lands in a couple of seconds.
      const isStreamable = node.type === 'quiz' || node.type === 'flashcard' || node.type === 'lesson';

      // Initialize empty content structure for progressive display
      if (isStreamable) {
        setIsLoadingContent(false); // Stop showing loading spinner
        if (node.type === 'quiz') {
          setCurrentContent({
            questions: [],
            _isStreaming: true,
            _expectedTotal: isDiagnostic ? DIAGNOSTIC_QUESTIONS : QUIZ_QUESTIONS
          });
        } else if (node.type === 'flashcard') {
          setCurrentContent({ cards: [], _isStreaming: true, _expectedTotal: FLASHCARD_CARDS });
        } else if (node.type === 'lesson') {
          setCurrentContent({ title: '', pages: [], _isStreaming: true, _expectedTotal: 5 });
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

        // Lesson title lands before any page — gives the card a real heading
        // instead of an empty bar while the pages are still being written.
        if (data.status === 'lesson_title' && data.title) {
          setCurrentContent(prev => ({ ...prev, title: data.title }));
        }

        // Handle individual lesson page arrival
        if (data.status === 'lesson_page_ready' && data.page) {
          setCurrentContent(prev => ({
            ...prev,
            pages: [...(prev?.pages || []), data.page]
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
        handleStreamProgress,
        { isDiagnostic, numQuestions: node.num_questions || null }
      );

      // Guard against null result (e.g. stream closed without sending 'complete')
      if (!result || !result.content) {
        console.warn('⚠️ Stream ended without a complete result — finalizing with streamed content');
        // Finalize whatever questions/cards arrived during streaming so the user
        // can still interact with them instead of seeing an infinite spinner.
        setCurrentContent(prev => {
          if (!prev) return prev;
          const { _isStreaming, _expectedTotal, ...rest } = prev;
          // Check if any usable content arrived
          const hasContent = (rest.questions?.length > 0) || (rest.cards?.length > 0)
            || (rest.pages?.length > 0) || rest.html;
          if (!hasContent) {
            // Nothing usable arrived — show error state so user can retry
            setContentError(t('study.generationFailed', 'Something went wrong while generating your content. Please try again.'));
            return null;
          }
          return rest;
        });
        setMascotState({ type: 'nurse', isExcited: false, isSurprised: false, lookDirection: 'down-center' });
        return;
      }

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
        consumeGeneration(generationUnits(result.content)); // charge per question/card (streaming path)
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

      // Clear the _isStreaming flag so the quiz/flashcard is still usable
      // with whatever items arrived before the error.  Without this the user
      // would be stuck on an infinite "Generating questions…" spinner.
      setCurrentContent(prev => {
        if (!prev) {
          // No content at all — show error state
          setContentError(t('study.generationFailed', 'Something went wrong while generating your content. Please try again.'));
          return null;
        }
        const { _isStreaming, _expectedTotal, ...rest } = prev;
        // `pages` included so a lesson that streamed some pages before the
        // stream threw keeps what arrived, instead of being thrown away for an
        // error screen the student doesn't need.
        const hasContent = (rest.questions?.length > 0) || (rest.cards?.length > 0)
          || (rest.pages?.length > 0) || rest.html;
        if (!hasContent) {
          // Nothing usable arrived — show error state
          setContentError(t('study.generationFailed', 'Something went wrong while generating your content. Please try again.'));
          return null;
        }
        return rest;
      });

      setMascotState({
        type: 'nurse',
        isExcited: false,
        isSurprised: true,
        lookDirection: 'center'
      });
    } finally {
      setIsLoadingContent(false);
    }
  }, [chatId, askedHashes, language, onCloseSidebar, viewOnly, t, requireQuota, consumeGeneration]);

  // Auto-launch the first node if requested
  const hasAutoStartedNodeRef = useRef(false);
  useEffect(() => {
    if (autoStart && view === 'overview' && activeNode && completedCount === 0 && !hasAutoStartedNodeRef.current && !viewOnly) {
      hasAutoStartedNodeRef.current = true;
      handleStartNode(activeNode);
    }
  }, [autoStart, view, activeNode, completedCount, viewOnly, handleStartNode]);

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
          const topicLabel = activeNode?.label || 'General';
          const strengthLevel = updateStudyPerformance(chatId, {
            topic: topicLabel,
            type: 'quiz',
            correct: answerData.isCorrect,
            concept: !answerData.isCorrect ? question.question : undefined,
            // Ledger key — passed whether she got it right or wrong, because a
            // record of only failures can never show a misconception being
            // fixed. Undefined on content generated before the backend began
            // emitting it; that answer is skipped rather than mis-keyed.
            conceptKey: question.concept,
            // Format drives the "which question types fail you" breakdown.
            // Older payloads only carry it under metadata; mcq is the default
            // shape when neither is present.
            format: question.questionType || question.metadata?.questionType || 'mcq'
          });

          // Show the subtle tracking animation
          strengthLevel.then((level) => {
            setInsightPulse({
              type: answerData.isCorrect ? 'strength' : 'weakness',
              topic: topicLabel
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
      // Exam format: answers is { [index]: { isCorrect, score, maxScore, ... } }
      else if (answerData.progress.answers && currentContent?.questions) {
        const totalQuestions = currentContent.questions.length;
        const examAnswers = answerData.progress.answers;
        const correctCount = Object.values(examAnswers).filter(a => a.isCorrect).length;
        const progressPercent = Math.round((correctCount / totalQuestions) * 100);

        // Update local node state with progress
        setNodes(prev => prev.map(n =>
          n.id === activeNodeId ? { ...n, nodeProgress: progressPercent } : n
        ));

        // Also persist to Firestore
        updateNodeStatus(chatId, activeNodeId, { nodeProgress: progressPercent });
      }
    }

    // Track latest quiz progress for mastery summary
    if (answerData.progress) latestQuizProgressRef.current = answerData.progress;
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
        const topicLabel = activeNode?.label || 'General';
        const strengthLevel = updateStudyPerformance(chatId, {
          topic: topicLabel,
          type: 'flashcard',
          mastered: isMastered,
          concept: !isMastered ? card.front : undefined
          // No conceptKey on purpose. Flashcard "mastery" is SELF-reported —
          // she taps "got it" — so letting it feed the ledger would mean the
          // readout tells her she fixed a misconception on the strength of her
          // own opinion. The ledger takes graded evidence only: quizzes and
          // exams. See conceptLedger.js.
        });

        // Show the subtle tracking animation
        strengthLevel.then((level) => {
          setInsightPulse({
            type: isMastered ? 'strength' : 'weakness',
            topic: topicLabel
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

    // ── Adaptive flashcard feedback ───────────────────────────────────────
    if (!viewOnly) {
      const topicLabel = activeNode?.label || 'General';

      if (reviewData.status === 'got_it' && !reviewData.progress?.isReviewRound) {
        const newStreak = consecutiveGotIt + 1;
        setConsecutiveGotIt(newStreak);
        if (newStreak >= 3) {
          setAdaptiveFeedback({ type: 'speed', topic: topicLabel });
          setTimeout(() => setAdaptiveFeedback(null), 3500);
          setConsecutiveGotIt(0);
        }
      } else if (reviewData.status === 'need_review') {
        setConsecutiveGotIt(0);
      }

      // Show "narrowing down" banner the first time review round starts
      if (reviewData.progress?.isReviewRound && !hasShownAdaptiveMode) {
        setHasShownAdaptiveMode(true);
        setAdaptiveFeedback({ type: 'adaptive_mode', topic: topicLabel });
        setTimeout(() => setAdaptiveFeedback(null), 4000);
      }
    }

    // Track latest flashcard progress for the transition screen
    if (reviewData.progress) latestFlashcardProgressRef.current = reviewData.progress;
  }, [chatId, activeNodeId, activeNode, currentContent, viewOnly, consecutiveGotIt, hasShownAdaptiveMode]);

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
            setAudioMessage(t('study.creatingAudioLesson', 'Creating your audio lesson...'));
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

        // Persist to Firebase Storage so re-visiting the node doesn't regenerate
        const messageId = currentMessageIdRef.current;
        if (messageId && !viewOnly) {
          updateAudioData(chatId, messageId, result.audioBase64, result.audioDuration)
            .catch(err => console.error('Audio persist failed (non-critical):', err));
        }
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
  }, [chatId, language, viewOnly]);

  // Handle mindmap generation trigger
  const handleGenerateMindmap = useCallback(async (mapConfig) => {
    console.log('🧠 Generating mindmap:', mapConfig);
    setIsGeneratingMindmap(true);
    setMindmapMessage(t('study.buildingConceptMap', 'Building your concept map...'));

    try {
      const result = await generate_study_mindmap(
        chatId,
        mapConfig.topic,
        mapConfig.depth || 'medium',
        language,
        (progress) => {
          if (progress.status === 'mindmap_generating') {
            setMindmapMessage(progress.message || t('study.buildingConceptMap', 'Building your concept map...'));
          }
        }
      );

      if (result && result.nodes?.length > 0) {
        setCurrentContent(prev => ({ ...prev, mindmapData: result }));

        // Persist mindmap data to Firestore so re-visiting won't regenerate
        const messageId = currentMessageIdRef.current;
        if (messageId) {
          await updateMindmapData(chatId, messageId, result);
        }

        console.log('✅ Mindmap generated successfully');
      } else {
        console.error('❌ No mindmap data received');
        setMindmapMessage(t('study.failedToGenerate', 'Failed to generate concept map'));
      }
    } catch (error) {
      console.error('❌ Mindmap generation failed:', error);
      setMindmapMessage(`Error: ${error.message}`);
    } finally {
      setIsGeneratingMindmap(false);
    }
  }, [chatId, language]);

  // Save mindmap traversal progress (which node user is on, which are visited)
  const handleSaveMindmapProgress = useCallback(async (progress) => {
    const messageId = currentMessageIdRef.current;
    if (!messageId || viewOnly) return;
    await saveMindmapProgress(chatId, messageId, progress);

    // Update node progress ring in the overview
    if (progress.totalNodes > 0) {
      const progressPercent = Math.round((progress.visitedNodeIds.length / progress.totalNodes) * 100);
      setNodes(prev => prev.map(n =>
        n.id === activeNodeId ? { ...n, nodeProgress: progressPercent } : n
      ));
      updateNodeStatus(chatId, activeNodeId, { nodeProgress: progressPercent });
    }

    // Track latest mindmap progress for the transition screen
    latestMindmapProgressRef.current = progress;
  }, [chatId, activeNodeId, viewOnly]);

  // ── Find the next planned node (for transition screen preview) ─────
  const getNextPlannedNode = useCallback(() => {
    if (!activeNodeId || nodes.length === 0) return null;
    const currentIndex = nodes.findIndex(n => n.id === activeNodeId);
    if (currentIndex === -1) return null;
    // Find next non-banner node
    for (let i = currentIndex + 1; i < nodes.length; i++) {
      if (nodes[i].type !== 'section_banner') return nodes[i];
    }
    return null;
  }, [activeNodeId, nodes]);

  // Advance to next node (extracted so quiz summary can call it after dismissal)
  const handleAdvanceNode = useCallback(async () => {
    setMascotState({ type: 'nurse', isExcited: true, isSurprised: false, lookDirection: 'center' });

    try {
      const result = await completeNodeAndAdvance(chatId, activeNodeId);

      setNodes(prev => prev.map(n => {
        // Mirror the completedAt stamp completeNodeAndAdvance just wrote, so
        // today's mission counts this node immediately instead of waiting for
        // the doc to round-trip.
        if (n.id === activeNodeId) {
          return { ...n, status: 'done', completedAt: n.completedAt || new Date().toISOString() };
        }
        if (n.id === result.nextNodeId) return { ...n, status: 'active' };
        return n;
      }));

      // Refresh insights panel with latest data when returning to overview
      getStudyPerformance(chatId).then(data => {
        const hasData = data?.topics && Object.values(data.topics).some(
          t => t.questionsTotal > 0 || t.flashcardsTotal > 0
        );
        setInsightsData(hasData ? data : null);
      }).catch(() => {});

      if (result.isComplete) {
        setIsComplete(true);
        setView('overview');
        if (currentPhase >= 2 || totalPhases >= 2) {
          if (onComplete) onComplete();
        }
      } else {
        setActiveNodeId(result.nextNodeId);
        setCurrentContent(null);
        setView('overview');
        setMascotState({ type: 'nurse', isExcited: false, isSurprised: false, lookDirection: 'center' });
      }
    } catch (error) {
      console.error('❌ Error advancing to next node:', error);
    }
  }, [chatId, activeNodeId, onComplete, currentPhase, totalPhases]);

  // Handle continue to next node — shows transition screen instead of
  // advancing immediately. The optional `info` object lets cards report
  // metadata about HOW the node was completed (e.g. audio was skipped vs
  // actually listened to) so the transition screen can adjust its copy.
  const handleContinue = useCallback(async (info) => {
    console.log('➡️ Node completed, showing transition screen', info);

    // Stash node-completion metadata so NodeTransition can reflect it.
    // For audio: { skipped: true } when the user tapped Skip on the intro.
    setAudioWasSkipped(!!(info && info.skipped));

    if (viewOnly) {
      // Dev mode: skip transition, advance directly
      await handleAdvanceNode();
      return;
    }

    // Reset transition-related state
    setIsLoadingPractice(false);
    setIsLoadingCustom(false);
    setCustomEcho(null);
    setReadinessDelta(null);
    setView('transition');

    // Compute readiness delta from pre/post snapshots so the transition
    // screen can show "↑ X% closer to ready" when an exam date is set.
    // Fire-and-forget — the screen renders immediately and the line
    // appears once the post-snapshot resolves.
    if (preNodeSnapshotRef.current && examDate) {
      getStudyPerformance(chatId).then(after => {
        // The curriculum is the denominator. Without it the number silently
        // becomes "the average of what you have touched", which is a much
        // bigger and much less true claim.
        const delta = computeReadinessDelta(
          preNodeSnapshotRef.current,
          after,
          studyState?.path?.topics || []
        );
        setReadinessDelta(delta);
      }).catch(() => setReadinessDelta(null));
    }
  }, [viewOnly, handleAdvanceNode, chatId, examDate, studyState]);

  // Lightweight analytics sink — currently logs in dev. Wire this to
  // a real provider (PostHog, Amplitude, GA) later without touching
  // NodeTransition.
  const handleTransitionAnalytics = useCallback((event, payload) => {
    devLog('📈 transition analytics', event, payload);
    // TODO: forward to real analytics when provider is added
  }, []);

  // ── Transition screen: user chose "Move on" ────────────────────────
  // Advances to next node AND immediately launches it (no overview stop)
  //
  // Every path out of here must change something on screen. Advancing costs
  // two Firestore round trips before the next node's content even starts
  // loading, so without a pending state the card sits frozen after the tap —
  // which is exactly what showed up as dead clicks on this button.
  const handleTransitionContinue = useCallback(async () => {
    // Re-entrancy guard: a second tap while the first is in flight would
    // complete the *next* node (activeNodeId has already moved on) and silently
    // skip it. The disabled button covers the UI; this covers the race.
    if (advanceLockRef.current) return;
    advanceLockRef.current = true;
    setIsAdvancing(true);

    try {
      const result = await completeNodeAndAdvance(chatId, activeNodeId);

      // Update local node statuses
      setNodes(prev => prev.map(n => {
        // Mirror the completedAt stamp completeNodeAndAdvance just wrote, so
        // today's mission counts this node immediately instead of waiting for
        // the doc to round-trip.
        if (n.id === activeNodeId) {
          return { ...n, status: 'done', completedAt: n.completedAt || new Date().toISOString() };
        }
        if (n.id === result.nextNodeId) return { ...n, status: 'active' };
        return n;
      }));

      // Refresh insights in background
      getStudyPerformance(chatId).then(data => {
        const hasData = data?.topics && Object.values(data.topics).some(
          tp => tp.questionsTotal > 0 || tp.flashcardsTotal > 0
        );
        setInsightsData(hasData ? data : null);
      }).catch(() => {});

      if (result.isComplete) {
        // Session done — go to overview for the completion state
        setIsComplete(true);
        setView('overview');
        if (currentPhase >= 2 || totalPhases >= 2) {
          if (onComplete) onComplete();
        }
      } else {
        // Find the next node object and launch it directly
        setActiveNodeId(result.nextNodeId);
        setCurrentContent(null);

        const nextNode = nodesRef.current.find(n => n.id === result.nextNodeId);

        if (!nextNode) {
          // Server advanced to a node our local plan doesn't know about yet
          // (phase 2, an inserted node, a stale tab). Land on the overview
          // rather than leaving the transition card up with nothing happening.
          setView('overview');
        } else {
          const outcome = await handleStartNode(nextNode);
          // 'exam_config' is fine — the config modal renders over this view.
          // 'blocked' opened the paywall app-side and started nothing, so the
          // transition card would otherwise stay up armed against a node the
          // user never saw.
          if (outcome === 'blocked') {
            setView('overview');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error advancing to next node:', error);
      // Fallback: go to overview
      setView('overview');
    } finally {
      advanceLockRef.current = false;
      setIsAdvancing(false);
    }
  }, [chatId, activeNodeId, onComplete, currentPhase, totalPhases, handleStartNode]);

  // ── Transition screen: user chose "Practice More" ─────────────────
  const handleTransitionPractice = useCallback(async (remediationNodeDef) => {
    console.log('📚 Practice More requested:', remediationNodeDef);
    setIsLoadingPractice(true);

    try {
      const { insertedNode, updatedNodes } = await insertNodeAfterCurrent(
        chatId,
        activeNodeId,
        remediationNodeDef
      );

      // Update local state with the mutated path
      setNodes(updatedNodes);
      setActiveNodeId(insertedNode.id);
      setActiveNode(insertedNode);
      setCurrentContent(null);
      setIsLoadingPractice(false);

      // Go directly to the new node (no overview stop)
      handleStartNode(insertedNode);
    } catch (error) {
      console.error('❌ Error inserting practice node:', error);
      setIsLoadingPractice(false);
      // Fallback: just advance normally
      await handleAdvanceNode();
    }
  }, [chatId, activeNodeId, handleAdvanceNode, handleStartNode]);

  // ── Transition screen: user submitted custom request ──────────────
  const handleTransitionCustomRequest = useCallback(async (userText, context = {}) => {
    console.log('💬 Custom request:', userText, 'context:', context);
    setIsLoadingCustom(true);
    setCustomEcho(null);

    try {
      const result = await interpret_study_request(
        chatId,
        userText,
        activeNode?.label || '',
        activeNode?.type || '',
        language,
        context.missedItems || [],
        context.scorePercent
      );

      if (!result.understood || !result.node) {
        setCustomEcho({ message: result.echo, node: null, userText });
      } else {
        setCustomEcho({ message: result.echo, node: result.node, userText });
      }
    } catch (error) {
      console.error('❌ Error interpreting custom request:', error);
      setCustomEcho({
        message: t('transition.customError', 'Something went wrong. Try again or continue to the next step.'),
        node: null
      });
    } finally {
      setIsLoadingCustom(false);
    }
  }, [chatId, activeNode, language, t]);

  // ── Transition screen: user confirmed custom echo ─────────────────
  const handleConfirmCustom = useCallback(async () => {
    if (!customEcho?.node) return;

    setIsLoadingPractice(true); // reuse loading state for the insert

    try {
      const nodeDef = {
        type: customEcho.node.type,
        label: customEcho.node.label,
        tags: [...(customEcho.node.tags || []), 'custom_request'],
        difficulty: customEcho.node.difficulty || 1,
        adaptive: true,
        reason: customEcho.userText || '',
      };

      const { insertedNode, updatedNodes } = await insertNodeAfterCurrent(
        chatId,
        activeNodeId,
        nodeDef
      );

      setNodes(updatedNodes);
      setActiveNodeId(insertedNode.id);
      setActiveNode(insertedNode);
      setCurrentContent(null);
      setCustomEcho(null);
      setIsLoadingPractice(false);

      // Go directly to the new node
      handleStartNode(insertedNode);
    } catch (error) {
      console.error('❌ Error inserting custom node:', error);
      setIsLoadingPractice(false);
      setCustomEcho(null);
      await handleAdvanceNode();
    }
  }, [chatId, activeNodeId, customEcho, handleAdvanceNode, handleStartNode]);

  // ── Transition screen: user cancelled custom echo ─────────────────
  const handleCancelCustom = useCallback(() => {
    setCustomEcho(null);
  }, []);

  // Continue after user dismisses the mastery summary (legacy — kept for backward compat)
  const handleContinueAfterSummary = useCallback(async () => {
    setQuizSummaryData(null);
    await handleAdvanceNode();
  }, [handleAdvanceNode]);

  // Handle Phase 2 generation — triggered when user clicks first placeholder node
  /**
   * Student finished their block and asked for the next one. The nodes were
   * planned in the original call and parked in reserve, so this is a Firestore
   * move — no generation, no quota charge, no waiting.
   */
  const handleExtendBlock = useCallback(async () => {
    const result = await extendStudyPath(chatId);
    if (!result?.added) return;

    // Re-read rather than reconstructing the merge locally — extendStudyPath
    // owns the node list, and duplicating its ordering rules here is how the
    // two drift apart.
    const session = await getStudySession(chatId);
    if (session?.path?.nodes) {
      setNodes(session.path.nodes);
      setActiveNodeId(session.path.activeNodeId);
      setIsComplete(false);
    }
    setReserveRemaining(result.remaining);

    setPathUpdateToast({ count: result.added });
    setTimeout(() => setPathUpdateToast(null), 3500);
  }, [chatId]);

  const handleStartPhase2 = useCallback(async () => {
    setIsGeneratingPhase2(true);

    try {
      const performance = await getStudyPerformance(chatId);

      if (!performance?.topics || Object.keys(performance.topics).length === 0) {
        // No performance data — skip phase 2, complete normally
        if (onComplete) onComplete();
        return;
      }

      const reviewPath = await plan_review_path(
        chatId,
        performance,
        studyState?.path?.topics || [],
        language,
        userProfile?.onboarding || {}
      );

      if (!reviewPath?.nodes?.length) {
        // Empty review plan — skip phase 2
        if (onComplete) onComplete();
        return;
      }

      const updated = await appendPhase2(chatId, reviewPath);

      // Update local state with new nodes and phase info
      setNodes(updated.path.nodes);
      setActiveNodeId(updated.path.activeNodeId);
      setCurrentPhase(updated.currentPhase || 2);
      setTotalPhases(updated.totalPhases || 2);
      setIsComplete(false);

      // Show path update toast
      const phase2Count = reviewPath.nodes.length;
      setPathUpdateToast({ count: phase2Count });
      setTimeout(() => setPathUpdateToast(null), 3500);

    } catch (error) {
      console.error('❌ Phase 2 generation failed:', error);
      // Fallback: complete normally
      if (onComplete) onComplete();
    } finally {
      setIsGeneratingPhase2(false);
    }
  }, [chatId, studyState, language, onComplete]);

  // ── Exam config: student configured and hit "Start Exam" ─────────
  //
  // `nodeOverride` is set when a pre-configured drill launches itself from
  // the transition screen: state set moments earlier isn't readable here yet,
  // so the node comes in as an argument rather than through pendingExamNode.
  const handleExamStart = useCallback(async (examConfig, nodeOverride) => {
    const examNode = nodeOverride || pendingExamNode;
    if (!examNode) return;

    setIsGeneratingExam(true);

    try {
      const result = await generate_exam(
        chatId,
        examNode.label,
        examConfig.questionTypes,
        examConfig.questionCount,
        examConfig.customInstructions,
        language
      );

      if (!result?.questions?.length) {
        throw new Error('No exam questions generated');
      }

      // Charge per question. May push the count past FREE_LIMIT — intended
      // grace: the gate at the exam node only blocks at zero remaining, so a
      // student with any budget left gets her full exam (see UsageService).
      consumeGeneration(generationUnits(result));

      // Merge examConfig (timer settings) into the content
      const examContent = {
        ...result,
        examConfig: {
          ...result.examConfig,
          // Coerced because this object is written straight to Firestore,
          // which rejects undefined. A self-launching drill sets no timer at
          // all, so the fields simply aren't in its config.
          timerEnabled: !!examConfig.timerEnabled,
          timerSeconds: examConfig.timerSeconds ?? null,
        }
      };

      // Save content and link to node
      const messageId = await saveNodeContent(
        chatId,
        examNode.id,
        examContent,
        'exam'
      );

      await updateNodeStatus(chatId, examNode.id, { messageId });

      // Update local state
      setNodes(prev => prev.map(n =>
        n.id === examNode.id ? { ...n, messageId } : n
      ));

      // Close modal, start the exam
      setShowExamConfig(false);
      setIsGeneratingExam(false);
      // Cleared for the direct-launch path, which put the node view into
      // loading before calling this; a no-op when the config modal ran.
      setIsLoadingContent(false);

      // Set up the node view
      const node = { ...examNode, messageId };
      setActiveNode(node);
      setActiveNodeId(node.id);
      setCurrentContent(examContent);
      currentMessageIdRef.current = messageId;
      setView('node');

      if (onCloseSidebar) onCloseSidebar();

    } catch (error) {
      console.error('❌ Error generating exam:', error);
      setIsGeneratingExam(false);
      setShowExamConfig(false);
      // A drill that launched itself has no config modal to fall back to, so
      // the failure has to land somewhere she can act — the node view's error
      // state with its retry — rather than an indefinite spinner.
      setIsLoadingContent(false);
      setContentError(t('study.generationFailed', 'Something went wrong while generating your content. Please try again.'));
    }

    setPendingExamNode(null);
  }, [chatId, pendingExamNode, language, onCloseSidebar, consumeGeneration, t]);

  // Kept current so handleStartNode (defined above) can launch a
  // pre-configured drill without the two callbacks depending on each other.
  handleExamStartRef.current = handleExamStart;

  // Handle retake exam — insert a fresh exam node after the completed one and launch it
  const handleRetakeExam = useCallback(async (examNode) => {
    try {
      const { insertedNode, updatedNodes } = await insertNodeAfterCurrent(
        chatId,
        examNode.id,
        {
          type: 'exam',
          label: examNode.label,
          tags: examNode.tags || [],
          difficulty: examNode.difficulty || 1,
          reason: 'Retake mini-test',
        }
      );

      // Update local nodes state
      setNodes(updatedNodes);

      // Launch the new exam node — no messageId so it opens the config modal
      handleStartNode(insertedNode);
    } catch (error) {
      console.error('❌ Error creating retake exam:', error);
    }
  }, [chatId, handleStartNode]);

  /**
   * Insights CTA — build a targeted practice node from what the panel just
   * diagnosed, and start it.
   *
   * The panel's whole argument is "here is the one thing costing you marks";
   * leaving the student to go find that thing herself in the plan wastes the
   * diagnosis. `focus` is the area it named (a question format or a topic),
   * so the request carries the format when that's the weakness — a student
   * weak on select-all-that-apply needs more SATA, not more of the topic.
   *
   * Reuses the adaptive-node path (`insertNodeAfterCurrent`), so this behaves
   * like every other inserted node: same shape, same quota accounting, same
   * generation flow.
   */
  const handlePracticeWeakArea = useCallback(async (focus, count = 5) => {
    if (!focus) return;
    setShowInsightsModal(false);
    try {
      const isFormat = focus.kind === 'format';
      const { insertedNode, updatedNodes } = await insertNodeAfterCurrent(
        chatId,
        activeNodeId,
        {
          type: 'quiz',
          label: isFormat
            ? t('study.practiceFormatLabel', 'Targeted practice: {{name}}', { name: focus.name })
            : focus.name,
          tags: [isFormat ? focus.key : 'topic_practice', 'weak_area'],
          // Practising a known weakness at difficulty 1 wastes the attempt.
          difficulty: 2,
          adaptive: true,
          reason: isFormat
            ? `Practice ${count} more ${focus.name} questions`
            : `Practice ${count} more questions on ${focus.name}`,
        }
      );
      setNodes(updatedNodes);
      handleStartNode(insertedNode);
    } catch (error) {
      console.error('❌ Error creating targeted practice node:', error);
    }
  }, [chatId, activeNodeId, handleStartNode, t]);

  /**
   * "Test my theory" — the experiment that turns an observation into an
   * aha moment.
   *
   * The insight claims her misses are a reasoning pattern rather than missing
   * knowledge. A claim she cannot check is just an opinion, so this hands her
   * ONE question built around that exact skill: get it right and she has
   * proved it to herself, which no amount of explanation achieves.
   *
   * Tagged `experiment:<skill>` so the transition screen recognises the node
   * on completion and shows the payoff instead of a fresh diagnosis. Tagging
   * rather than component state means it survives a reload.
   */
  const handleTestTheory = useCallback(async (skill) => {
    if (!skill) return;
    try {
      const { insertedNode, updatedNodes } = await insertNodeAfterCurrent(
        chatId,
        activeNodeId,
        {
          type: 'quiz',
          label: t('study.experimentLabel', 'Testing a theory: {{skill}}', { skill }),
          tags: [`experiment:${skill}`, 'weak_area'],
          // A test of technique has to be hard enough to actually test it.
          difficulty: 2,
          adaptive: true,
          num_questions: 1,
          reason: `One question to test the ${skill} pattern`,
        }
      );
      setNodes(updatedNodes);
      handleStartNode(insertedNode);
    } catch (error) {
      console.error('❌ Error creating theory-test node:', error);
    }
  }, [chatId, activeNodeId, handleStartNode, t]);

  /**
   * Insights CTA — reopen the node a missed question came from, so "review
   * this concept" lands on the explanation she already has rather than
   * generating something new. Falls back to targeted practice when the
   * source node can't be resolved.
   */
  const handleReviewConcept = useCallback((item, focus) => {
    const sourceNode = nodes.find(
      (n) => n.messageId && n.label && item?.topic && n.label.startsWith(item.topic)
    );
    if (sourceNode) {
      setShowInsightsModal(false);
      handleStartNode(sourceNode);
      return;
    }
    handlePracticeWeakArea(focus);
  }, [nodes, handleStartNode, handlePracticeWeakArea]);

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

  // Handle exit from overview or transition - leave study mode entirely
  const handleExitStudy = useCallback(() => {
    console.log('📚 Exiting study mode');
    // Clear view immediately so the overlay disappears
    setView('overview');
    setCurrentContent(null);
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
          {/* Summary chips — shown above the list */}
          {!insightsLoading && insightsData?.topics && Object.keys(insightsData.topics).length > 0 && (() => {
            const counts = { strong: 0, developing: 0, weak: 0 };
            Object.values(insightsData.topics).forEach(tp => {
              const lvl = tp.strengthLevel || 'developing';
              counts[lvl] = (counts[lvl] || 0) + 1;
            });
            return (
              <div className="insights-summary">
                {counts.strong > 0 && <span className="ins-chip ins-chip--strong">
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" width="9" height="9"><polyline points="1.5,5.5 3.5,7.5 8.5,2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {counts.strong} {t('study.strong', 'Strong')}
                </span>}
                {counts.developing > 0 && <span className="ins-chip ins-chip--developing">
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" width="9" height="9"><circle cx="5" cy="5" r="3.5"/><circle cx="5" cy="5" r="1.2" fill="currentColor" stroke="none"/></svg>
                  {counts.developing} {t('study.developing', 'Developing')}
                </span>}
                {counts.weak > 0 && <span className="ins-chip ins-chip--weak">
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" width="9" height="9"><line x1="2" y1="2" x2="8" y2="8" strokeLinecap="round"/><line x1="8" y1="2" x2="2" y2="8" strokeLinecap="round"/></svg>
                  {counts.weak} {t('study.weak', 'Needs Work')}
                </span>}
              </div>
            );
          })()}

          {/* The whole insights body. Replaced ~200 lines of inline topic
              rows whose only actionable content was one missed concept
              truncated to 58 characters. PerformanceBreakdown answers the
              four questions a student actually has — what will fail me,
              which question types am I worst at, what do I work on, and
              where am I already fine — and owns its own loading/empty
              states, so the modal just hosts it. */}
          <div className="insights-modal__body">
            {insightsLoading ? (
              <div className="insights-modal__loading">
                <div className="study-loading-spinner" />
                <p>{t('study.loadingInsights', 'Loading...')}</p>
              </div>
            ) : (
              <PerformanceBreakdown
                chatId={chatId}
                onPractice={handlePracticeWeakArea}
                onReviewConcept={handleReviewConcept}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  // Build studyState for overview (with updated local state)
  const currentStudyState = {
    ...studyState,
    currentPhase,
    totalPhases,
    path: {
      ...studyState?.path,
      nodes: nodes
    },
    reserve: {
      ...studyState?.reserve,
      remaining: reserveRemaining !== null
        ? reserveRemaining
        : (studyState?.reserve?.remaining || 0)
    }
  };

  // Render transition screen (post-node decision moment)
  if (view === 'transition') {
    return (
      <div className={`study-mode-container study-mode-focused ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <StudyModeHeader
          unitTitle={studyState?.path?.unitTitle || activeNode?.label || 'Study Session'}
          unitSubtitle={studyState?.path?.unitSubtitle || ''}
        />
        <NodeTransition
          chatId={chatId}
          node={activeNode}
          content={currentContent}
          quizProgress={latestQuizProgressRef.current}
          flashcardProgress={latestFlashcardProgressRef.current}
          mindmapProgress={latestMindmapProgressRef.current}
          audioSkipped={audioWasSkipped}
          nextNode={getNextPlannedNode()}
          performanceData={insightsData}
          // Performance as it stood BEFORE this node ran. The only
          // trustworthy baseline for "you're getting better at this":
          // insightsData is loaded once per session and may already
          // include the answers we'd be comparing against.
          priorPerformance={preNodeSnapshotRef.current}
          examDate={examDate}
          readinessDelta={readinessDelta}
          onContinue={handleTransitionContinue}
          onPracticeMore={handleTransitionPractice}
          onCustomRequest={handleTransitionCustomRequest}
          onExit={handleExitStudy}
          onAnalytics={handleTransitionAnalytics}
          onTestTheory={handleTestTheory}
          isAdvancing={isAdvancing}
          isLoadingPractice={isLoadingPractice}
          isLoadingCustom={isLoadingCustom}
          customEcho={customEcho}
          onConfirmCustom={handleConfirmCustom}
          onCancelCustom={handleCancelCustom}
        />
        {renderInsightsModal()}

        {/* Exam config modal — the next node can be a mini-test, and
            handleStartNode opens this instead of launching content. Without an
            instance here the tap did nothing at all: the modal only existed in
            the overview branch. Backing out drops to the overview rather than
            back onto a transition card for a node already marked done. */}
        <ExamConfigModal
          isOpen={showExamConfig}
          onClose={() => { setShowExamConfig(false); setPendingExamNode(null); setView('overview'); }}
          onStart={handleExamStart}
          topic={pendingExamNode?.label || ''}
          isLoading={isGeneratingExam}
        />
      </div>
    );
  }

  // Render quiz mastery summary (legacy fallback)
  if (view === 'quiz_summary' && quizSummaryData) {
    return (
      <div className={`study-mode-container study-mode-focused ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <StudyModeHeader
          unitTitle={studyState?.path?.unitTitle || activeNode?.label || 'Study Session'}
          unitSubtitle={studyState?.path?.unitSubtitle || ''}
        />
        <QuizMasterySummary
          data={quizSummaryData}
          onContinue={handleContinueAfterSummary}
        />
        {renderInsightsModal()}
      </div>
    );
  }

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
          examDate={examDate}
          examName={examName}
          onNodeSelect={handleNodeSelect}
          onRetakeExam={handleRetakeExam}
          onExit={handleExitStudy}
          onShowInsights={handleMascotClick}
          insightsData={insightsData}
          sidebarOpen={sidebarOpen}
          isGeneratingPhase2={isGeneratingPhase2}
          onStartPhase2={handleStartPhase2}
          onExtendBlock={handleExtendBlock}
          isDev={isDev}
        />

        {/* Dev only: force the paywall open without burning a real quota. */}
        <DevPaywallPill topic={paywallTopic} />

        {renderInsightsModal()}

        {/* Exam config modal */}
        <ExamConfigModal
          isOpen={showExamConfig}
          onClose={() => { setShowExamConfig(false); setPendingExamNode(null); }}
          onStart={handleExamStart}
          topic={pendingExamNode?.label || ''}
          isLoading={isGeneratingExam}
        />

        {/* Path update toast — shown after phase 2 is generated */}
        {pathUpdateToast && (
          <div className="path-update-toast">
            <span className="path-update-toast__icon">✦</span>
            <span>{t('study.sessionsAdded', '{{count}} sessions added to your path', { count: pathUpdateToast.count })}</span>
          </div>
        )}

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
              {/* XP badge - commented out to reduce distraction */}
              {/* <div className="review-confirm-xp">
                <span className="xp-badge">+5 XP</span>
                <span className="xp-text">{t('study.earnXpReview', 'for reviewing')}</span>
              </div> */}
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
              <StudyLoadingScreen
                nodeType={activeNode?.type || 'lesson'}
                onRetry={activeNode ? () => handleStartNode(activeNode) : undefined}
                onBack={() => {
                  setIsLoadingContent(false);
                  setContentError(null);
                  setView('overview');
                }}
              />
            ) : currentContent ? (
              <StudyStepCard
                node={activeNode}
                content={currentContent}
                savedProgress={savedProgress}
                isLoading={false}
                isReviewMode={isReviewingNode}
                isDiagnostic={isDiagnosticNode}
                viewOnly={viewOnly}
                isGeneratingAudio={isGeneratingAudio}
                audioGeneratingMessage={audioMessage}
                isGeneratingMindmap={isGeneratingMindmap}
                mindmapGeneratingMessage={mindmapMessage}
                adaptiveMessage={
                  adaptiveFeedback?.type === 'speed'
                    ? t('study.adaptiveSpeed', "You're getting these fast! Flagging as strong.")
                    : adaptiveFeedback?.type === 'adaptive_mode'
                    ? t('study.adaptiveMode', 'Adaptive Mode: Narrowing down on {{topic}}', { topic: adaptiveFeedback.topic })
                    : null
                }
                onAnswer={handleAnswer}
                onReview={handleReview}
                onGenerateAudio={handleGenerateAudio}
                onGenerateMindmap={handleGenerateMindmap}
                onSaveMindmapProgress={handleSaveMindmapProgress}
                onContinue={handleContinue}
                onExit={handleExitNode}
                onAudioFirstPlay={() => {
                  // Node status records that the student advanced past this
                  // lesson, not that they listened to it. Stamp the backing
                  // message so the two are distinguishable in analytics.
                  if (activeNode?.messageId) {
                    markMessageEngaged(chatId, activeNode.messageId, 'study_audio');
                  }
                }}
              />
            ) : contentError ? (
              <div className="study-step-card">
                <div className="study-error-state">
                  <div className="study-error-state__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="48" height="48">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <p className="study-error-state__message">{contentError}</p>
                  <div className="study-error-state__actions">
                    <button
                      className="study-error-state__retry"
                      onClick={() => {
                        setContentError(null);
                        if (activeNode) handleStartNode(activeNode);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <path d="M21 2v6h-6" />
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                      </svg>
                      {t('study.tryAgain', 'Try Again')}
                    </button>
                    <button
                      className="study-error-state__back"
                      onClick={handleExitNode}
                    >
                      {t('study.backToOverview', 'Back to Overview')}
                    </button>
                  </div>
                </div>
              </div>
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

      {/* Dev only: force the paywall open without burning a real quota. Also
          mounted here (not just the overview) because a real block happens
          mid-node, and that's the state worth reviewing. */}
      <DevPaywallPill topic={paywallTopic} />

      {renderInsightsModal()}
    </div>
  );
};

export default StudyModeContainer;
