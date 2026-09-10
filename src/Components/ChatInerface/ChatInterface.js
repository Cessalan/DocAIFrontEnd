import { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo, Suspense, lazy } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// Firebase imports
import { createStorageRef, db, auth } from '../../Firebase/config';
import { uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  collection,
  getDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  where
} from "firebase/firestore";

// Components
import ChatMessage from './ChatMessage';
import GhostLoader from './GhostLoader';
import LoadingMessageBox from './LoadingMessageBox';
import PostUploadActions from './PostUploadActions';
import FirstUploadWowCard from './FirstUploadWowCard';
// FileViewerModal is lazy-loaded — see the code-splitting block below the imports.
import PlanOnboarding from './PlanOnboarding';
import QuizModeSelector from './QuizModeSelector';

// SVG Components
import SvgFileUpload from '../Svg/SvgFileUpload';
import SvgFileIcon from '../Svg/SvgFileIcon';
import SvgImageIcon from '../Svg/SvgImageIcon';

// Utils
import htmlToMarkdown from './htmlToMarkdown';

// Emoji Components
import ReadingEmoji from './Emojis/ReadingEmoji.jsx';
import GraduationEmoji from './Emojis/GraduationEmoji.js';
import PencilEmoji from './Emojis/PencilEmoji.js';
import CookingEmoji from './Emojis/CookingEmoji.js';
import GearEmoji from './Emojis/GearEmoji.js';
import ThinkingEmoji from './Emojis/ThinkingEmoji.js';

// Contexts
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';

// Services
import { formatDate, formatFileSize } from '../../Services/Formatting.js';
import {
  AppendToChat,
  SaveFileMetaData,
  GetFileMetadataByName,
  UpdateQuizAnswer,
  UpdateFlashcardReview,
  AppendQuizQuestions,
  DeleteMessage,
  SaveOrUpdateMessage,
  UpdateMessageContent,
  markMessageEngaged,
  SavePostUploadSelection
} from '../../Services/FireBaseServiceChats.js';

import { loadFilesForChat, saveAudioToStorage } from '../../Services/FireBaseFiles.js';
import {
  ask_llm_stream,
  embed_docs,
  generate_summary,
  stream_summary,
  generate_scenario,
  upload_files_with_progress,
  speech_to_text
} from '../../Services/FastAPICalls.js';


// Updated imports for ChatInterface.js
import {
  ask_llm_websocket,
  closeWebSocketConnection,
  cancelWebSocketStream,
} from '../../Services/WebSocketManager.js';

// Styles
import './ChatInterface.css';

// translation
import { useTranslation } from 'react-i18next';
import StudyGuideGenerator from './StudyGuideGenerator.js';
import StudySheetLivePreview from './StudySheetLivePreview.js';
// StudySheetSimple is lazy-loaded — see the code-splitting block below the imports.
import StickyQuizProgress from './StickyQuizProgress';
// DISABLED: Suggested prompts feature - see comment where component was rendered
// import SuggestedPrompts from './SuggestedPrompts';
import AudioConfirmCard from './AudioConfirmCard';
import ChatAudioPlayer from './ChatAudioPlayer';
import CheckUnderstandingCard from './CheckUnderstandingCard';

// Progress Tracking
import CompactProgressWidget from '../Progress/CompactProgressWidget';
import ProgressDashboard from '../Progress/ProgressDashboard';
import { useProgress } from '../../Contexts/ProgressContext/ProgressContext';

// Exam Prep
import ExamPrepModal from './ExamPrepModal';

// Common Components
import ExamCountdown from '../Common/ExamCountdown';

// Welcome-back toast (tab-return acknowledgement)
import WelcomeBackToast from './WelcomeBackToast';

// Mindmap — ChatMindmap is lazy-loaded, see the code-splitting block below the imports.

// Web sources panel (rendered when a quiz is grounded in web-search results)
import WebSourcesPanel from './WebSourcesPanel';

// Study Mode
import StartStudyModal from '../StudyMode/StartStudyModal';
import { coerceDate, calendarDaysBetween } from '../StudyMode/studySchedule';
// StudyModeContainer is lazy-loaded — see the code-splitting block below the imports.

import { getActiveStudySession, getStudySession } from '../../Services/StudySessionService';
import { FUNNEL, startFunnel, logFunnelStep } from '../../Services/FunnelService';
import { markFirstUploadComplete, getWowEffectConfig, updateUserProfile } from '../../Services/UserService';
import { devLog } from '../../Services/devLogger';
import DrillExamDate from '../ExamDrill/DrillExamDate';
import DrillTargetIcon from '../ExamDrill/DrillTargetIcon';
import { saveExamDate, noteExamDateAsked } from '../../Services/ExamDrillService';

// ============================================
// CODE SPLITTING
// ============================================
// These four surfaces carry the app's heaviest dependencies and none of them
// are on the path a user takes to read or send a message. Loading them on
// demand keeps pdfjs, reactflow, html2pdf and the study-mode stylesheet out
// of the chunk that has to arrive before the chat is usable.
// ============================================

// react-pdf + pdfjs-dist — the single largest dependency. Opens on file preview.
const FileViewerModal = lazy(() => import('./FileViewerModal'));
// html2pdf.js, for study-sheet export. Only for 'studysheet' messages.
const StudySheetSimple = lazy(() => import('./StudySheetSimple.js'));
// reactflow + its stylesheet. Only for 'mindmap' messages.
const ChatMindmap = lazy(() => import('./ChatMindmap'));
// Full-screen study surface: its own large stylesheet, plus reactflow via
// StudyMindmapCard. Entered deliberately, so a chunk fetch costs nothing here.
const StudyModeContainer = lazy(() => import('../StudyMode/StudyModeContainer'));

/**
 * Full-screen placeholder shown while the study-mode chunk downloads.
 * Self-contained styles: StudyMode.css lives in that same chunk, so it isn't
 * available yet at the moment this renders.
 */
const StudyModeFallback = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary, #fdfaf7)'
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '3px solid var(--primary-peach, #f8c8c4)',
        borderTopColor: 'var(--primary-coral, #e88d7d)',
        animation: 'nq-route-spin 0.7s linear infinite'
      }}
    />
    <style>{'@keyframes nq-route-spin{to{transform:rotate(360deg)}}'}</style>
  </div>
);

/**
 * ChatInterface Component - A messenger-like interface for AI chat
 * Features: Text messaging with AI, File uploads, Quiz/Summary/Scenario generation
 */
const ChatInterface = ({
  chatId,
  onChatSelected,
  onCloseSidebar,
  viewAllChatsMode = false,
  pendingUploadFiles = [],         // Files to upload after returning from login
  onPendingUploadProcessed = null, // Callback when pending upload is handled
  sidebarOpen = true,              // Sidebar state for study mode centering
  goToStudyMode = false,           // Flag to auto-trigger study mode after upload from landing page
  onStudyModeTriggered = null      // Callback when study mode flag has been consumed
}) => {

  // Auth context - need reactive auth state for pending upload processing
  const { isUserLoggedIn, userProfile, currentUser, setUserProfile } = useAuth() || {};

  // Router. Used by the Exam Drill entry point, which leaves the chat surface
  // entirely for the full-screen drill at /drill/:chatId.
  const navigate = useNavigate();

  // Progress tracking context
  const { addCorrectAnswer, addIncorrectAnswer } = useProgress();

  // Usage throttle (monetization gate). requireQuota() blocks + opens the
  // upgrade modal when the weekly bucket is empty; consume() charges one unit
  // when a generation actually completes. isPro / openUpgrade also gate the
  // free "one upload per chat" limit.
  // `plansRemaining` / `remaining` are read only to stamp the funnel row: how
  // much budget she had at the moment she uploaded is what turns "she saw a
  // paywall" into "she hit the plan gate at 3/3 with 40 questions left".
  const { requireQuota, consume: consumeGeneration, isPro, openUpgrade, plansRemaining, remaining } = useUsageLimit();

  // Add this as the FIRST useEffect in ChatInterface
  useEffect(() => {
    devLog('🔍 Component mounted, checking URL...');
    devLog('🔍 Current URL:', window.location.href);
    devLog('🔍 Search params:', window.location.search);
  }, []);

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  // Core chat state
  const [currentChatID, setChatId] = useState(chatId);
  const [currentChatTitle, setChatTitle] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isGameChat, setIsGameChat] = useState(false);
  const [gameState, setGameState] = useState(null);

  // Exam Drill in progress on this chat, or null. Drives the resume bar that
  // stands in for the composer — see the input area below.
  const [drillSummary, setDrillSummary] = useState(null);

  // Chat whose drill is waiting on an exam-date answer before we hand over to
  // the examiner. Null the rest of the time.
  const [pendingDrillDateChatId, setPendingDrillDateChatId] = useState(null);
  const [currentExamData, setCurrentExamData] = useState(null); // { examId, examName, examDate, hardestTopics }
  const [isChatDataLoaded, setIsChatDataLoaded] = useState(!chatId); // True if no chatId (new chat) or after chat doc is fetched
  const [userInputText, setUserInputText] = useState('');
  const [uploadedFilesList, setUploadedFilesList] = useState([]);

  // Check for pending quiz prompt from signup flow
  useEffect(() => {
    const pendingPrompt = sessionStorage.getItem('pendingQuizPrompt');
    const pendingTopic = sessionStorage.getItem('pendingQuizTopic');

    if (pendingPrompt && !chatId) {
      // Pre-fill the input with the practice prompt
      setUserInputText(pendingPrompt);

      // Clear from sessionStorage
      sessionStorage.removeItem('pendingQuizPrompt');
      sessionStorage.removeItem('pendingQuizTopic');

      devLog('📚 Pre-filled practice prompt from quiz share:', pendingTopic);
    }
  }, [chatId]);

  // ============================================
  // PENDING FILE UPLOAD STATE
  // ============================================
  // Track whether we need to process pending files from the landing page
  // The actual processing happens later (after handleFileSelect is defined)
  // ============================================
  const pendingUploadProcessedRef = useRef(false);
  const [shouldProcessPendingUpload, setShouldProcessPendingUpload] = useState(false);

  // Set flag when pendingUploadFiles arrives AND user is logged in
  // Uses isUserLoggedIn from AuthContext for reactive auth state
  useEffect(() => {
    if (pendingUploadFiles.length > 0 && !pendingUploadProcessedRef.current && isUserLoggedIn) {
      devLog(`📤 Pending upload files detected: ${pendingUploadFiles.length} file(s), user logged in`);
      setShouldProcessPendingUpload(true);
    }
  }, [pendingUploadFiles, isUserLoggedIn]);

  // Reset the processed flag when pendingUploadFiles becomes empty
  useEffect(() => {
    if (pendingUploadFiles.length === 0) {
      pendingUploadProcessedRef.current = false;
      setShouldProcessPendingUpload(false);
    }
  }, [pendingUploadFiles]);

  // UI state
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState(null);
  const [isFilesModalVisible, setIsFilesModalVisible] = useState(false);
  // Empty-state exam-prep card: collapsed by default (single CTA), expands
  // to reveal the side-by-side Upload/Paste choice when the user taps it.
  const [examPrepExpanded, setExamPrepExpanded] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false); // Track if actively streaming

  // Upload insights state
  const [uploadInsights, setUploadInsights] = useState([]);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [isUploadAnalyzing, setIsUploadAnalyzing] = useState(false);
  const [uploadMessageId, setUploadMessageId] = useState(null);

  // File error toast state
  const [fileErrorToast, setFileErrorToast] = useState(null);

  // Welcome-back toast (shown when user returns after 30+ seconds away).
  // Inlined here (rather than a separate hook file) so it's bundled with
  // ChatInterface — no new top-level directory for the dev-server watcher
  // to miss. Uses both visibilitychange (tab switches, mobile background)
  // and blur/focus (Alt+Tab to another app).
  // `welcomeBack` — null when no toast, or `{ message, accent }` while the
  // toast is open. `accent` is the substring (the topic) the toast styles
  // as a coral/lavender highlight inside the warm sentence.
  const [welcomeBack, setWelcomeBack] = useState(null);
  const tabHiddenAtRef = useRef(null);
  const WELCOME_BACK_THRESHOLD_MS = 30000;

  useEffect(() => {
    const markAway = () => {
      if (tabHiddenAtRef.current != null) return;
      tabHiddenAtRef.current = Date.now();
    };

    const markBack = () => {
      if (tabHiddenAtRef.current == null) return;
      const elapsed = Date.now() - tabHiddenAtRef.current;
      tabHiddenAtRef.current = null;
      if (elapsed < WELCOME_BACK_THRESHOLD_MS) return;

      // Warm, topic-anchored, no numbers — frames effort instead of score.
      // The `accent` substring is what the toast styles in coral/lavender.
      const studySubject = isStudyModeRef.current && studyStateRef.current?.path
        ? ((studyStateRef.current.path.topics && studyStateRef.current.path.topics[0])
            || (currentChatTitleRef.current && currentChatTitleRef.current.trim())
            || null)
        : null;
      const examSubject = currentExamDataRef.current?.examName || null;
      const chatSubject = (currentChatTitleRef.current && currentChatTitleRef.current.trim()) || null;

      let message;
      let accent = null;
      if (studySubject) {
        message = `Welcome back — you were working through ${studySubject}, you're doing great.`;
        accent = studySubject;
      } else if (examSubject) {
        message = `Welcome back — you were prepping for ${examSubject}, you've got this.`;
        accent = examSubject;
      } else if (chatSubject) {
        message = `Welcome back — picking up where you left off on ${chatSubject}, you're doing great.`;
        accent = chatSubject;
      } else {
        message = "Welcome back — glad to see you again.";
      }

      setWelcomeBack({ message, accent });
    };

    const onVisibility = () => {
      if (document.hidden) markAway();
      else markBack();
    };
    const onBlur = () => markAway();
    const onFocus = () => markBack();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- refs read inside handlers stay fresh

  // Auto-dismiss file error toast after 5 seconds
  useEffect(() => {
    if (fileErrorToast) {
      const timer = setTimeout(() => {
        setFileErrorToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [fileErrorToast]);

  // State for sticky quiz progress bar
  const [activeQuizProgress, setActiveQuizProgress] = useState(null);

  //Track which quiz is currently active
  const [activeQuizId, setActiveQuizId] = useState(null);

  // track sugggested prompts that is received after each message
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);

  // Exam prep modal state
  const [showExamPrepModal, setShowExamPrepModal] = useState(false);
  const [isCreatingExamChat, setIsCreatingExamChat] = useState(false);

  // Paste notes modal state
  const [showPasteNotesModal, setShowPasteNotesModal] = useState(false);
  const [pastedNotesText, setPastedNotesText] = useState('');

  // Quiz mode selector state (NCLEX vs Knowledge)
  const [showQuizModeSelector, setShowQuizModeSelector] = useState(false);
  const [pendingQuizMessageData, setPendingQuizMessageData] = useState(null);

  // Study mode state
  const [showStartStudyModal, setShowStartStudyModal] = useState(false);
  // {topic: pct} handed to the plan generator so it can tier topics into
  // gap/shaky/solid. Null means "we know nothing", which is the planner's
  // documented uniform-plan path.
  //
  // CourseStudyBrief supplies first-attempt answers from its optional check.
  // The fallback onboarding can still derive a baseline from existing scores.
  const [studyDiagnostic, setStudyDiagnostic] = useState(null);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [studyState, setStudyState] = useState(null);
  const [studyAutoStart, setStudyAutoStart] = useState(false);
  const [pendingStudyDocs, setPendingStudyDocs] = useState([]);
  const [pendingStudyTopics, setPendingStudyTopics] = useState([]);
  // Topics ranked by uploadPriority, carried from PlanOnboarding so the LOCKED
  // plan preview can list them in the same order the insights card showed her.
  // A student with plan quota left never uses these — she sees the real path.
  const [pendingRankedTopics, setPendingRankedTopics] = useState([]);
  // Set when PlanOnboarding confirms — its answers augment the base
  // userProfile.onboarding so /study/start fires with examDate / hardestTopics
  // baked in. Falls back to userProfile.onboarding when null.
  const [pendingStudyUserPreferences, setPendingStudyUserPreferences] = useState(null);
  // What she told us about her class, and what the investigation found.
  // Both ride through to /study/start: the report gives the planner its topic
  // ORDER, which is the thing that stops a plan following her slide deck.
  const [pendingCourseIntelligence, setPendingCourseIntelligence] = useState(null);
  const [pendingCourseContext, setPendingCourseContext] = useState(null);

  // Pre-upload action selection (when user picks action before uploading)
  const [pendingStudyAction, setPendingStudyAction] = useState(null);



  // Is the post-upload coach flow on screen? A `plan_onboarding` message
  // exists from the moment she commits to a study plan until she confirms,
  // at which point swapPlanOnboardingForActions replaces it — so its presence
  // is exactly the span of the flow.
  //
  // While it runs, every step carries its own control (a CTA, a lesson button,
  // an answer, a chip). A message box underneath invites her to type into a
  // flow that is not listening to typing, so it is hidden until the flow
  // hands back.
  const isCoachFlowActive = useMemo(
    () => chatMessages.some(m => m.type === 'plan_onboarding'),
    [chatMessages]
  );

  /**
 * activeQuizProgress structure:
 * {
 *   messageId: string,
 *   isVisible: boolean,
 *   answeredCount: number,
 *   totalQuestions: number,
 *   correctCount: number,
 *   incorrectCount: number,
 *   currentStreak: number,
 *   longestStreak: number,
 *   lastAnswerWasCorrect: boolean
 * }
 */


  // Loading states
  const [loadingStates, setLoadingStates] = useState({
    quiz: false,
    summary: false,
    scenario: false,
    fileUpload: false,
    fileEmbedding: false
  });


  // 'connecting', 'connected', 'disconnected', 'error'
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const [studySheetData, setStudySheetData] = useState({
    htmlContent: '',
    sections: [],
    steps: [],
    progress: 0,
    currentSection: null,
    isComplete: false,
    hasContent: false
  });


  // ============================================
  // REFS
  // ============================================
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const documentFileInputRef = useRef(null);
  const textareaRef = useRef(null); // Premium textarea ref for auto-resize
  const isQuizGeneratingRef = useRef(false);
  // in case the user answers quiz while its being loaded and streamed
  const pendingQuizAnswersRef = useRef({});
  // Track which questions have been submitted (prevent double-submit)
  const submittedAnswersRef = useRef(new Set());
  const hasInitiallyScrolledRef = useRef(false);
  const lastUserMessageRef = useRef(null); // Track last user message for scrolling
  // Track upload message ID for synchronous updates
  const uploadMessageIdRef = useRef(null);
  // Id of the coach card created at upload start, so `post_upload_message` can
  // fill it in rather than appending a second one. Cleared once used.
  const planOnboardingIdRef = useRef(null);
  // 🆕 Track insights accumulation to avoid race conditions
  const uploadInsightsAccumulatorRef = useRef([]);
  // Track the latest requested chat ID to prevent stale async responses
  const latestRequestedChatIdRef = useRef(null);
  // Track pre-selected study action (ref for async callback access)
  const pendingStudyActionRef = useRef(null);
  // Track messages deleted locally (after edit) so the snapshot listener
  // doesn't re-introduce them before Firestore propagates the deletion
  const recentlyDeletedIdsRef = useRef(new Set());

  // Track if user is at bottom of chat
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // State to force minimum height for scrolling user message to top
  const [forceScrollSpace, setForceScrollSpace] = useState(false);

  // Voice input states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Streaming throttle refs - prevents excessive re-renders during token streaming
  const streamingThrottleRef = useRef(null);
  const streamingContentRef = useRef('');
  const streamingMessageIdRef = useRef(null);

  // Stable-callback refs: forwarding pattern for React.memo children
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;
  const currentChatIDRef = useRef(currentChatID);
  currentChatIDRef.current = currentChatID;
  const userInputTextRef = useRef(userInputText);
  userInputTextRef.current = userInputText;
  const uploadedFilesListRef = useRef(uploadedFilesList);
  uploadedFilesListRef.current = uploadedFilesList;
  const currentLanguageRef = useRef(null);

  // Ref-forwarding for callbacks passed to memoized children.
  // Refs are initialized here (before the functions are defined),
  // then .current is updated after each function definition.
  const handleSendNewUserMessageRef = useRef(null);
  const handleQuizAnswerSelectRef = useRef(null);
  const handlePostDocumentUploadOptionRef = useRef(null);
  const handleEditMessageRef = useRef(null);

  // Keep refs in sync with the latest values the visibility handler reads.
  // Using refs avoids re-binding the document-level listeners on every state
  // change while still letting the handler see current values at trigger time.
  const isStudyModeRef = useRef(isStudyMode);
  const studyStateRef = useRef(studyState);
  const currentExamDataRef = useRef(currentExamData);
  const currentChatTitleRef = useRef(currentChatTitle);
  isStudyModeRef.current = isStudyMode;
  studyStateRef.current = studyState;
  currentExamDataRef.current = currentExamData;
  currentChatTitleRef.current = currentChatTitle;

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Flushes the current streaming content to the UI.
   * Called on a throttled interval during streaming and once at the end.
   */
  const flushStreamingContent = useCallback(() => {
    const content = streamingContentRef.current;
    const messageId = streamingMessageIdRef.current;

    if (!messageId) return;

    setChatMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId && msg.type !== 'quiz' && msg.type !== 'flashcard') {
          return { ...msg, content, isStreaming: true };
        }
        return msg;
      })
    );
  }, []);

  /**
   * Schedules a throttled UI update for streaming content.
   * Batches rapid token arrivals into ~14 updates/second for smooth performance.
   */
  const scheduleStreamingUpdate = useCallback(() => {
    // If no pending update, schedule one
    if (!streamingThrottleRef.current) {
      streamingThrottleRef.current = setTimeout(() => {
        flushStreamingContent();
        streamingThrottleRef.current = null;
      }, 70); // ~14 updates/second - visually smooth, much less CPU
    }
  }, [flushStreamingContent]);

  /**
   * Cleanup streaming throttle state. Call when streaming ends or on error.
   */
  const cleanupStreamingThrottle = useCallback(() => {
    if (streamingThrottleRef.current) {
      clearTimeout(streamingThrottleRef.current);
      streamingThrottleRef.current = null;
    }
    // Flush any remaining content
    flushStreamingContent();
    // Reset refs
    streamingContentRef.current = '';
    streamingMessageIdRef.current = null;
  }, [flushStreamingContent]);

  // COST OPTIMIZATION: Don't pre-warm WebSocket connection
  // Connect on-demand when user sends a message (handled by ask_llm_websocket)
  // This saves Cloud Run costs by not opening connections until needed
  useEffect(() => {
    if (currentChatID) {
      // Mark as ready - connection will happen when user sends message
      setConnectionStatus('connected');

      // Cleanup on unmount or chat change
      return () => {
        closeWebSocketConnection(currentChatID);
        setConnectionStatus('disconnected');
        // Clean up any pending streaming throttle
        if (streamingThrottleRef.current) {
          clearTimeout(streamingThrottleRef.current);
          streamingThrottleRef.current = null;
        }
      };
    }
  }, [currentChatID]);


  // In your ChatInterface component
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPrompt = params.get('prompt');  // ✅ Renamed to avoid conflicts

    if (urlPrompt) {
      devLog('📝 Setting prompt from URL:', urlPrompt);
      setUserInputText(urlPrompt);  // Already decoded by URLSearchParams

      // Clear URL params after reading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  // Check if user is near bottom of messages
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const threshold = 150; // pixels from bottom
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Scroll to bottom - simple and reliable
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: behavior
        });
      }
    });
  }, []);

  // Handle scroll event to show/hide scroll button
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isAtBottom = isNearBottom();
    setShowScrollButton(!isAtBottom);
  }, [isNearBottom]);

  // Initial scroll to bottom on first load
  useEffect(() => {
    if (chatMessages.length > 0 && !hasInitiallyScrolledRef.current) {
      const container = messagesContainerRef.current;
      if (!container) return;

      // Scroll immediately
      scrollToBottom('auto');

      // Mark as complete after a short delay
      setTimeout(() => {
        hasInitiallyScrolledRef.current = true;
        setIsInitialLoadComplete(true);
      }, 300);
    }
  }, [chatMessages.length, scrollToBottom]);

  // Auto-scroll when new messages arrive (ChatGPT/Claude premium feel)
  useEffect(() => {
    if (chatMessages.length > 0 && hasInitiallyScrolledRef.current) {
      if (!isAiTyping) {
        // User just sent a message - scroll to absolute top with plenty of space below
        if (lastUserMessageRef.current) {
          // Enable forced scroll space to ensure we can scroll the message to top
          setForceScrollSpace(true);

          requestAnimationFrame(() => {
            const container = messagesContainerRef.current;
            const messageElement = lastUserMessageRef.current;

            if (container && messageElement) {
              // Wait a tiny bit for the DOM to update with the spacer
              setTimeout(() => {
                // Calculate the exact scroll position to place message at the very top
                const containerTop = container.getBoundingClientRect().top;
                const messageTop = messageElement.getBoundingClientRect().top;
                const currentScroll = container.scrollTop;

                // Scroll so message appears RIGHT at the top (just 10px breathing room)
                const targetScroll = currentScroll + (messageTop - containerTop) - 10;

                container.scrollTo({
                  top: targetScroll,
                  behavior: 'smooth'
                });
              }, 50);
            }
          });
        }
      } else {
        // AI is typing - remove the forced space as content will naturally fill it
        setForceScrollSpace(false);
      }
    }
  }, [chatMessages.length, isAiTyping]);

  // Auto-scroll during streaming disabled - let user read at their own pace
  // The scroll-to-bottom button is available if they want to jump to latest content

  // Cache textarea max height — only recalculate on window resize, not every keystroke
  const textareaMaxHeightRef = useRef(Math.max(160, Math.floor(window.innerHeight * 0.55)));
  useEffect(() => {
    const onResize = () => {
      textareaMaxHeightRef.current = Math.max(160, Math.floor(window.innerHeight * 0.55));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Premium textarea auto-resize - ChatGPT/Gemini style
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';

    const maxHeight = textareaMaxHeightRef.current;
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(scrollHeight, maxHeight);

    textarea.style.maxHeight = `${maxHeight}px`;
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [userInputText]);

  const setLoadingState = useCallback((key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const isSystemBusy = useMemo(() => (
    isAiTyping ||
    isStreaming ||
    isQuizGeneratingRef.current ||
    loadingStates.quiz ||
    loadingStates.summary ||
    loadingStates.scenario ||
    loadingStates.fileUpload ||
    loadingStates.fileEmbedding
  ), [isAiTyping, isStreaming, loadingStates]);


  const formatChatHistory = useCallback((messages) => {
    return messages
      .filter(msg => msg.role && msg.content && typeof msg.content === 'string' && msg.content.trim())
      .map(msg => {
        if (msg.quizData) {
          let quizText = "Quiz:\n";
          msg.quizData.forEach((q, index) => {
            quizText += `Question ${index + 1}: ${q.question}\n`;
            quizText += `Options: ${q.options.join(', ')}\n`;
            quizText += `Answer: ${q.answer}\n`;
            quizText += `Justification: ${q.justification}\n\n`;
          });
          return { role: msg.role, content: quizText };
        }

        if (msg.summaryData) {
          let summaryText = `DOCUMENT SUMMARY:\n`;
          summaryText += `Summmary Title: ${msg.summaryData.title}\n`;
          summaryText += `Reading Time: ${msg.summaryData.reading_time}\n`;
          summaryText += `Type: ${msg.summaryData.document_analysis?.type || 'N/A'}\n`;
          summaryText += `Purpose: ${msg.summaryData.document_analysis?.purpose || 'N/A'}\n\n`;
          summaryText += `filename: ${msg.summaryData.document_analysis?.filename || 'N/A'}\n\n`;

          msg.summaryData.sections?.forEach((section, index) => {
            summaryText += `${section.heading}:\n`;
            section.bullets?.forEach(bullet => {
              summaryText += `• ${bullet}\n`;
            });
            summaryText += '\n';
          });
          return { role: msg.role, content: summaryText };
        }


        if (msg.scenarioData) {
          const scenarioText = `
            SCENARIO: ${msg.scenarioData.scenario}
            QUESTION: ${msg.scenarioData.question}
            OPTIONS: ${msg.scenarioData.options.join('\n')}
            CORRECT ANSWER: ${msg.scenarioData.options[msg.scenarioData.correctAnswer]}
            JUSTIFICATION: ${msg.scenarioData.explanation}
          `;
          return { role: msg.role, content: scenarioText };
        }

        return { role: msg.role, content: msg.content };
      }
      );
  }, []);

  const formatFilesForAPI = useCallback((files) => {
    return files.map(file => ({
      filename: file.name,
      source: file.downloadURL
    }));
  }, []);

  // ============================================
  // EFFECTS
  // ============================================

  // Sync with parent chatId prop - runs when chatId changes OR on initial mount with a chatId
  useEffect(() => {
    if (!chatId) return;

    // Skip if we already loaded this exact chat (prevents duplicate loads)
    if (latestRequestedChatIdRef.current === chatId) return;

    const isSwitchingChats = currentChatID && chatId !== currentChatID;

    // Clear messages if switching chats (not on initial load)
    if (isSwitchingChats) {
      setChatMessages([]);
    }

    // Update chat ID
    setChatId(chatId);

    // Reset scroll and loading flags
    hasInitiallyScrolledRef.current = false;
    setIsInitialLoadComplete(false);

    // Reset chat data loaded flag - prevents wrong empty state from showing
    setIsChatDataLoaded(false);

    // Clear UI states from previous chat
    setSuggestedPrompts([]);           // Clear suggested prompts (fixes reported bug)
    setActiveQuizProgress(null);       // Clear sticky quiz progress bar
    setActiveQuizId(null);             // Clear active quiz tracking
    setIsAiTyping(false);              // Clear typing indicator
    setStreamingStatus(null);          // Clear streaming status

    // Clear chat type states IMMEDIATELY to prevent stale data showing.
    // Study mode is cleared here too so the brief window before getDoc resolves
    // can't render StudyModeContainer with the previous chat's studyState — that
    // race fired /study/generate-item-stream on every chat switch.
    setIsGameChat(false);
    setGameState(null);
    setCurrentExamData(null);
    setIsStudyMode(false);
    setStudyState(null);
    setStudyAutoStart(false);
    // Same reasoning as the states above: without this, switching chats
    // flashes the previous chat's drill bar over the new chat's composer
    // until getDoc resolves.
    setDrillSummary(null);

    // Get chat title and check if it's a game chat or exam chat
    latestRequestedChatIdRef.current = chatId; // Track the latest request
    const chatDocRef = doc(db, "chats", chatId);
    getDoc(chatDocRef).then(async (docSnapshot) => {
      // Guard against stale responses - if user clicked another chat, ignore this response
      if (latestRequestedChatIdRef.current !== chatId) {
        devLog('🚫 Ignoring stale chat data for:', chatId, 'current chat is:', latestRequestedChatIdRef.current);
        return;
      }
      if (docSnapshot.exists()) {
        const chatData = docSnapshot.data();
        setChatTitle(chatData.title);
        // Check if this is a game-type chat
        const isGame = chatData.type === 'game';
        devLog('🎮 Chat type check:', { chatId, type: chatData.type, isGame, gameState: chatData.gameState });
        setIsGameChat(isGame);
        setGameState(chatData.gameState || null);
        // Hydrate exam metadata. Two paths feed into this:
        //   - ExamPrepModal (file-upload) writes examId + examName + examDate
        //   - PlanOnboarding writes examDate + hardestTopics (no examId)
        // We surface either so the readiness-card countdown lights up in
        // both flows. The chat-landing exam-context card is gated on
        // examName separately (so the PlanOnboarding case doesn't render
        // an empty header). hardestTopics is included so a chat reload
        // can re-prefill the focus prompt without re-asking.
        // What she told us about her class on a previous visit. Restoring it
        // is the difference between a reload and being asked the same four
        // questions again.
        setPendingCourseContext(chatData.courseContext || null);

        const hydratedHardestTopics = Array.isArray(chatData.hardestTopics)
          ? chatData.hardestTopics.filter(Boolean)
          : [];
        if (chatData.examId || chatData.examDate || hydratedHardestTopics.length > 0) {
          setCurrentExamData({
            examId: chatData.examId || null,
            examName: chatData.examName || null,
            examDate: chatData.examDate || null,
            hardestTopics: hydratedHardestTopics
          });

          // Lift the exam date onto the user profile so the (globally rendered)
          // upgrade modal can show exam-countdown urgency. Best-effort, write
          // only when it actually changed to avoid redundant updates.
          //
          // ⚠️ Stored as an ISO STRING, deliberately. `chatData.examDate` is a
          // Firestore Timestamp, and the consumer — daysUntilExam() in
          // upgradeCopy.js — does `new Date(examDate)`. new Date(Timestamp) is
          // Invalid Date, so writing the raw Timestamp here made the helper
          // return null and every exam-urgency string in UpgradeModal fall
          // through to the generic copy. The field was populated and useless.
          const loadedExamIso = (() => {
            const d = coerceDate(chatData.examDate);
            return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
          })();
          if (loadedExamIso && currentUser?.uid &&
              userProfile?.onboarding?.examDate !== loadedExamIso) {
            updateUserProfile(currentUser.uid, { 'onboarding.examDate': loadedExamIso })
              .then(() => setUserProfile?.(prev => prev
                ? { ...prev, onboarding: { ...(prev.onboarding || {}), examDate: loadedExamIso } }
                : prev))
              .catch(() => { /* non-critical */ });
          }
        } else {
          setCurrentExamData(null);
        }

        // Exam Drill. A chat that has been drilled carries a `drill` map (see
        // ExamDrillService). The resume card needs the headline figure plus
        // what has actually been covered — the full student model stays where
        // the drill reads it.
        //
        // Topics are ordered most-drilled first and carry NO scores. This card
        // is a way back in, not a report; the checkpoint is where findings get
        // delivered, and repeating "0/2" here would undo that.
        // `drill` exists from the moment the examiner opens, not from the
        // first answer — a student who left on question one still has a drill
        // waiting, and before this she was shown the post-upload analysis card
        // with no way back to it.
        if (chatData.drill) {
          const topicMap = chatData.drill.topics || {};
          const covered = Object.keys(topicMap)
            .map((topic) => ({
              topic,
              seen: Object.values(topicMap[topic] || {})
                .reduce((n, b) => n + (b?.total || 0), 0),
            }))
            .sort((a, b) => b.seen - a.seen)
            .map((t) => t.topic);

          setDrillSummary({ answered: chatData.drill.answered || 0, topics: covered });
        } else {
          setDrillSummary(null);
        }

        // Check if this is a study session - if so, auto-enter study mode
        if (chatData.isStudySession) {
          devLog('📚 This chat is a study session, entering study mode');
          try {
            const studySessionData = await getStudySession(chatId);
            if (studySessionData) {
              setStudyAutoStart(false);
              setStudyState(studySessionData);
              setIsStudyMode(true);
            }
          } catch (error) {
            console.error('❌ Error loading study session:', error);
          }
        } else {
          // Not a study session, make sure we're not in study mode
          setIsStudyMode(false);
          setStudyState(null);
        }
      } else {
        setIsGameChat(false);
        setGameState(null);
        setCurrentExamData(null);
        setIsStudyMode(false);
        setStudyState(null);
        setDrillSummary(null);
      }
      // Mark chat data as loaded - now safe to render empty states
      setIsChatDataLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Load messages from Firebase
  useEffect(() => {
    if (!currentChatID) {
      console.warn("No chat ID available");
      return;
    }

    // Reset the locally-deleted set when switching chats — its purpose
    // is to hide pending-deletion messages from the snapshot listener
    // until Firestore propagates the delete, scoped per chat.
    recentlyDeletedIdsRef.current = new Set();

    const messagesRef = collection(db, "chats", currentChatID, "messages");
    const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      // AppendToChat uses addDoc, so Firestore auto-generates the document id
      // and the message's logical id is stored as a `id` field that overrides
      // doc.id via spread. If the same logical message gets saved twice (any
      // retry, any double-call) we'd end up with two docs sharing the same
      // logical id → two cards rendered. Collapse them by keeping the first.
      const seen = new Set();
      const loadedMessages = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((msg) => {
          if (seen.has(msg.id)) return false;
          // Skip messages that the user just edited-out — Firestore may
          // not have propagated the deletion yet, but the UI is committed.
          if (recentlyDeletedIdsRef.current.has(msg.id)) return false;
          seen.add(msg.id);
          return true;
        });

      // Preserve local-only messages that shouldn't be overwritten by Firebase
      setChatMessages(prev => {
        // Local messages to preserve (not in Firebase)
        const localOnlyMessages = prev.filter(msg => {
          const notInFirebase = !loadedMessages.some(fbMsg => fbMsg.id === msg.id);

          // Keep: active uploads, streaming messages, pending post-upload actions, pending flashcards/quizzes/mindmaps
          // NOTE: post_upload_actions should only be preserved if NOT YET in Firebase
          // Once saved to Firebase, let Firebase be the source of truth for ordering
          const shouldPreserve =
            (msg.type === 'upload_loading' && msg.isLoading === true) ||
            (msg.isStreaming === true) ||
            (msg.type === 'post_upload_actions' && notInFirebase) ||
            (msg.type === 'plan_onboarding' && notInFirebase) ||
            ((msg.type === 'flashcard' || msg.type === 'quiz' || msg.type === 'mindmap') && notInFirebase);

          if (shouldPreserve && (msg.type === 'flashcard' || msg.type === 'quiz' || msg.type === 'mindmap')) {
            devLog(`🔄 Preserving ${msg.type} message ${msg.id} (isStreaming: ${msg.isStreaming}, notInFirebase: ${notInFirebase})`);
          }

          return shouldPreserve;
        });

        if (localOnlyMessages.length === 0) {
          return loadedMessages;
        }

        // Filter Firebase messages to avoid duplicates
        const firebaseFiltered = loadedMessages.filter(msg =>
          !localOnlyMessages.some(local => local.id === msg.id) &&
          msg.type !== 'upload_loading' // Use local version for upload_loading
        );

        // Combine and sort by timestamp
        const getTimestamp = (msg) => {
          if (!msg.timestamp) return 0;
          if (typeof msg.timestamp.toMillis === 'function') return msg.timestamp.toMillis();
          if (typeof msg.timestamp.seconds === 'number') return msg.timestamp.seconds * 1000;
          return new Date(msg.timestamp).getTime();
        };

        // Find the latest timestamp from valid Firebase messages
        // This is crucial for fixing the "flashcard before prompt" bug
        // The server timestamp might be ahead of client time, so we need to force
        // local streaming messages to be "after" the latest server message.
        let maxFirebaseTimestamp = 0;
        if (firebaseFiltered.length > 0) {
          maxFirebaseTimestamp = Math.max(...firebaseFiltered.map(getTimestamp));
        }

        // Adjust local messages to strictly follow the latest server message
        const adjustedLocalMessages = localOnlyMessages.map(msg => {
          const originalTs = getTimestamp(msg);

          // Only force-move active streaming/loading content to the bottom
          // "isStreaming" covers: text stream, quiz stream, flashcard stream
          // "isLoading" covers: upload loading
          // "isGenerating" covers: audio generation
          // NOTE: post_upload_actions that are LOCAL ONLY (not yet in Firebase) should
          // be pushed to bottom, but once saved to Firebase they should keep their timestamp
          const isActiveContent =
            msg.isStreaming === true ||
            msg.isLoading === true ||
            msg.isGenerating === true;
          // Removed: (msg.type === 'post_upload_actions') - these now use their real timestamp

          if (isActiveContent && maxFirebaseTimestamp > 0) {
            // If the server thinks it's "tomorrow" relative to us, we must be "tomorrow + 1ms"
            // This ensures the streaming bubble stays BELOW the user prompt that triggered it
            if (originalTs <= maxFirebaseTimestamp) {
              // We don't mutate the original message object to avoid render loops,
              // but we wrap it for the sort, OR we just assume it's "Infinity" for sorting purposes.
              // Actually, let's just cheat the timestamp for the sort function below.
              return { ...msg, _sortTimestamp: maxFirebaseTimestamp + 10 };
            }
          }
          return { ...msg, _sortTimestamp: originalTs };
        });

        const allMessages = [
          ...firebaseFiltered.map(m => ({ ...m, _sortTimestamp: getTimestamp(m) })),
          ...adjustedLocalMessages
        ];

        return allMessages
          .sort((a, b) => a._sortTimestamp - b._sortTimestamp)
          .map(({ _sortTimestamp, ...msg }) => msg); // Remove the temp property
      });
    });

    return () => unsubscribe();
  }, [currentChatID]);

  // Load files for chat
  useEffect(() => {
    if (!currentChatID) return;

    const fetchFiles = async () => {
      const filesFromFireStore = await loadFilesForChat(currentChatID);
      setUploadedFilesList(filesFromFireStore);
    };

    fetchFiles();
  }, [currentChatID]);

  const { t, i18n } = useTranslation();

  const currentLanguage = i18n.language || 'en'; // Fallback to 'en' if language is not yet initialized
  currentLanguageRef.current = currentLanguage;

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  const handleSendNewUserMessage = async (e = null, customPrompt = null, options = {}) => {
    const { hideUserMessage = false, historyOverride = null, skipFirebaseSave = false } = options;

    // Check if e is actually an event object (has preventDefault method)
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    // clear the state of suggested prompts
    setSuggestedPrompts([]);

    const messageToSend = customPrompt ?? userInputText;
    if (messageToSend.trim() === '') return;

    // Usage throttle: block + show upgrade modal when the hourly generation
    // bucket is empty. Checked before any UI/loading state changes so a blocked
    // send is a clean no-op. (Charged on generation-complete events below.)
    if (!requireQuota({ topic: currentChatTitleRef.current })) return;

    // IMMEDIATELY show loading state - don't wait for connection
    setUserInputText('');
    setIsAiTyping(true);
    setStreamingStatus(null);
    setIsStreaming(true);
    // Fresh send = fresh completion state. If a previous stream errored (or a
    // quiz/audio flow set this), a stale true would skip saving THIS response.
    isQuizGeneratingRef.current = false;

    // Add user message (unless hidden for automated prompts)
    const newUserMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageToSend,
      hidden: hideUserMessage, // Mark as hidden for rendering
    };

    const streamingMessageId = `streaming-${Date.now()}`;
    const placeholderMessage = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: new Date()
    };

    // Add user message AND streaming placeholder immediately (optimistic UI)
    // If hideUserMessage is true, only add the placeholder
    setChatMessages(prev => hideUserMessage
      ? [...prev, placeholderMessage]
      : [...prev, newUserMessage, placeholderMessage]
    );

    // Scroll user message to top of viewport (ChatGPT style)
    setTimeout(() => {
      if (lastUserMessageRef.current) {
        lastUserMessageRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }
    }, 100);

    // Save to Firebase (non-blocking for UI) — skipped when re-generating after an edit
    let updatedChatId = null;
    if (!skipFirebaseSave) {
      updatedChatId = await AppendToChat(currentChatID, newUserMessage, currentLanguage);
      if (updatedChatId && updatedChatId !== currentChatID) {
        setChatId(updatedChatId);
      }
    }

    // No chat id means chat creation failed outright. There is nowhere to
    // stream to: ask_llm_websocket would open a socket to `/ws/undefined` and
    // the student would sit on the typing indicator forever with nothing saved.
    // Fail loudly with a retry instead — this is the first message of a brand
    // new conversation, so silence here reads as "the product is broken".
    const targetChatId = updatedChatId || currentChatID;
    if (!targetChatId) {
      console.error("❌ No chat id after AppendToChat — aborting send");
      setIsStreaming(false);
      setIsAiTyping(false);
      setStreamingStatus(null);
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === streamingMessageId
            ? {
                ...msg,
                content: '',
                error: true,
                errorKey: 'chat.streamError',
                retryText: messageToSend,
                isStreaming: false
              }
            : msg
        )
      );
      return;
    }

    let fullResponse = "";
    let empatheticMessageId = null; // Track empathetic message bubble
    let quizMessageId = null; // Track quiz bubble
    let webSourcesMessageId = null; // Track web-sources panel bubble (school-specific exam research)

    try {
      // Use WebSocket with all your current logic
      await ask_llm_websocket(
        currentLanguage,
        messageToSend,
        formatChatHistory(historyOverride || chatMessages),
        formatFilesForAPI(uploadedFilesList),
        targetChatId,

        // Status callback - handles all your current status updates
        (statusUpdate) => {

          // ═══════════════════════════════════════════════════════════
          // STREAM ERROR — finalize instead of hanging.
          // Before this handler existed, a backend error left the typing
          // indicator on forever and the placeholder was later saved as an
          // EMPTY assistant message ("why are you not responding?").
          // Now: stop the stream state, turn the placeholder into an error
          // bubble with a Retry button, and never persist it to Firebase.
          // ═══════════════════════════════════════════════════════════
          if (statusUpdate.status === "error") {
            console.error("❌ Stream error from backend:", statusUpdate.message);
            cleanupStreamingThrottle();
            isQuizGeneratingRef.current = true; // stream_complete may still follow — skip empty-save path
            setStreamingStatus(null);
            setIsStreaming(false);
            setIsAiTyping(false);

            // Server-side quota rejection (usage_guard in NQBackEnd2): the
            // paywall is the answer, not a retry — retrying would just be
            // rejected again. Drop the placeholder and open the upgrade modal.
            if (statusUpdate.code === "quota_exceeded") {
              setChatMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
              openUpgrade('questions', { topic: currentChatTitleRef.current, trigger: 'question_throttle_server' });
              return;
            }

            setChatMessages(prev =>
              prev.map(msg =>
                msg.id === streamingMessageId
                  ? {
                      ...msg,
                      content: streamingContentRef.current || '',
                      error: true,
                      // A watchdog timeout reads differently from a crash:
                      // nothing went wrong that we saw, the answer just never
                      // came. Say that rather than blaming a generic error.
                      errorKey: statusUpdate.code === 'timeout'
                        ? 'chat.timeoutError'
                        : 'chat.streamError',
                      retryText: messageToSend,
                      isStreaming: false
                    }
                  : msg
              )
            );
            return;
          }

          // ═══════════════════════════════════════════════════════════
          // WEB RESEARCH PHASE (school-specific exam grounding)
          // ───────────────────────────────────────────────────────────
          // Three events from the backend, in order:
          //   web_research_started -> show searching skeleton
          //   web_sources_found    -> populate with exam_summary + citations
          //   web_research_failed  -> show honest fallback message
          // We use one bubble for the whole lifecycle, identified by
          // webSourcesMessageId, so it animates in place from skeleton
          // -> filled panel without a layout jump.
          // ═══════════════════════════════════════════════════════════
          if (statusUpdate.status === "web_research_started") {
            devLog("🌐 web_research_started", statusUpdate);
            webSourcesMessageId = `web-sources-${Date.now()}`;
            setChatMessages(prev => {
              // Drop the generic placeholder if present so the panel
              // shows up immediately as the next bubble.
              const filtered = prev.filter(msg => msg.id !== streamingMessageId);
              return [...filtered, {
                id: webSourcesMessageId,
                role: 'assistant',
                type: 'web_sources',
                webSourcesStatus: 'searching',
                webSourcesSchool: statusUpdate.school || null,
                webSourcesExamBoard: statusUpdate.exam_board || null,
                webSourcesCitations: [],
                isStreaming: true,
                timestamp: new Date(),
              }];
            });
            return;
          }

          if (statusUpdate.status === "web_sources_found") {
            devLog("🌐 web_sources_found", statusUpdate);
            setChatMessages(prev => {
              const existing = prev.find(msg => msg.id === webSourcesMessageId);
              const filled = {
                id: webSourcesMessageId || `web-sources-${Date.now()}`,
                role: 'assistant',
                type: 'web_sources',
                webSourcesStatus: 'found',
                webSourcesSchool: statusUpdate.school || null,
                webSourcesExamBoard: statusUpdate.exam_board || null,
                webSourcesSummary: statusUpdate.exam_summary || '',
                webSourcesCitations: statusUpdate.citations || [],
                webSourcesFoundRealPapers: !!statusUpdate.found_real_papers,
                webSourcesHonestyNote: statusUpdate.honesty_note || null,
                webSourcesCached: !!statusUpdate.cached,
                isStreaming: false,
                timestamp: new Date(),
              };
              if (existing) {
                return prev.map(msg => (msg.id === webSourcesMessageId ? filled : msg));
              }
              // Edge case: web_sources_found arrived without a prior
              // web_research_started (e.g. cache hit emitted both in
              // quick succession and the started event was dropped).
              if (!webSourcesMessageId) webSourcesMessageId = filled.id;
              return [...prev, filled];
            });

            // Persist the filled panel to Firebase so it's there on reload.
            const persistMsg = {
              id: webSourcesMessageId,
              role: 'assistant',
              type: 'web_sources',
              webSourcesStatus: 'found',
              webSourcesSchool: statusUpdate.school || null,
              webSourcesExamBoard: statusUpdate.exam_board || null,
              webSourcesSummary: statusUpdate.exam_summary || '',
              webSourcesCitations: statusUpdate.citations || [],
              webSourcesFoundRealPapers: !!statusUpdate.found_real_papers,
              webSourcesHonestyNote: statusUpdate.honesty_note || null,
              webSourcesCached: !!statusUpdate.cached,
              timestamp: new Date(),
              isStreaming: false,
            };
            try { AppendToChat(updatedChatId || currentChatID, persistMsg); } catch (e) { devLog("persist web_sources failed", e); }
            return;
          }

          if (statusUpdate.status === "web_research_failed") {
            devLog("🌐 web_research_failed", statusUpdate);
            const fallback = {
              id: webSourcesMessageId || `web-sources-${Date.now()}`,
              role: 'assistant',
              type: 'web_sources',
              webSourcesStatus: 'no_results',
              webSourcesSchool: statusUpdate.school || null,
              webSourcesExamBoard: statusUpdate.exam_board || null,
              webSourcesFallbackMessage: statusUpdate.message || null,
              isStreaming: false,
              timestamp: new Date(),
            };
            setChatMessages(prev => {
              const existing = prev.find(msg => msg.id === webSourcesMessageId);
              if (existing) {
                return prev.map(msg => (msg.id === webSourcesMessageId ? fallback : msg));
              }
              if (!webSourcesMessageId) webSourcesMessageId = fallback.id;
              return [...prev, fallback];
            });
            return;
          }

          // Empathetic message start
          if (statusUpdate.status === "empathetic_message_start") {
            devLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            devLog("💬 EMPATHETIC MESSAGE START");
            devLog("   - Removing generic placeholder:", streamingMessageId);
            devLog("   - Creating empathetic message bubble");

            // Create a NEW message bubble for empathetic text
            empatheticMessageId = `empathetic-${Date.now()}`;
            devLog("   - New empatheticMessageId:", empatheticMessageId);

            setChatMessages(prev => {
              devLog("   - Messages before filter:", prev.length);
              // Remove the generic placeholder if it exists
              const filtered = prev.filter(msg => msg.id !== streamingMessageId);
              devLog("   - Messages after filter:", filtered.length);

              return [...filtered, {
                id: empatheticMessageId,
                role: 'assistant',
                content: '',
                type: 'text', // Regular text message
                isStreaming: true,
                timestamp: new Date()
              }];
            });

            devLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return;
          }

          // Empathetic message chunk (stream text)
          if (statusUpdate.status === "empathetic_message_chunk") {
            devLog("💬 Empathetic chunk:", statusUpdate.chunk);

            setChatMessages(prev =>
              prev.map(msg =>
                msg.id === empatheticMessageId
                  ? { ...msg, content: statusUpdate.chunk, isStreaming: true }
                  : msg
              )
            );

            return;
          }

          // Empathetic message complete
          if (statusUpdate.status === "empathetic_message_complete") {
            devLog("✅ Empathetic message complete");

            // Mark empathetic message as complete and save to Firebase
            setChatMessages(prev =>
              prev.map(msg =>
                msg.id === empatheticMessageId
                  ? { ...msg, content: statusUpdate.full_message, isStreaming: false }
                  : msg
              )
            );

            // Save empathetic message to Firebase
            const empatheticMsg = {
              id: uuidv4(),
              role: 'assistant',
              content: statusUpdate.full_message,
              timestamp: new Date(),
              isStreaming: false
            };

            AppendToChat(updatedChatId || currentChatID, empatheticMsg);

            return;
          }

          // Quiz generation progress
          if (statusUpdate.status === "quiz_generating") {
            devLog("generating quiz streaming");
            isQuizGeneratingRef.current = true;

            // If empathetic message exists, create a SECOND bubble for quiz
            if (empatheticMessageId) {
              // Only set quizMessageId ONCE (first time)
              if (!quizMessageId) {
                quizMessageId = `quiz-${Date.now()}`;
              }

              setChatMessages(prev => {
                // Check if quiz bubble already exists
                const existingQuiz = prev.find(msg => msg.id === quizMessageId);

                if (existingQuiz) {
                  return prev.map(msg =>
                    msg.id === quizMessageId
                      ? {
                        ...msg,
                        content: statusUpdate.message,
                        expectedTotal: statusUpdate.total || msg.expectedTotal || 4,
                        generatingCurrent: statusUpdate.current || msg.generatingCurrent || 0
                      }
                      : msg
                  );
                }

                // Create NEW quiz bubble (second bubble after empathetic message)
                return [...prev, {
                  id: quizMessageId,
                  role: 'assistant',
                  type: 'quiz',
                  content: statusUpdate.message,
                  quizData: [],
                  expectedTotal: statusUpdate.total || 4,
                  generatingCurrent: statusUpdate.current || 0,
                  isStreaming: true,
                  timestamp: new Date()
                }];
              });
            } else {
              // No empathetic message - transform the existing placeholder into quiz message
              setChatMessages(prev => {
                return prev.map(msg =>
                  msg.id === streamingMessageId
                    ? {
                      ...msg,
                      type: 'quiz',
                      content: statusUpdate.message,
                      // IMPORTANT: Preserve existing quizData if questions already arrived
                      // (handles race condition where quiz_question arrives before quiz_generating)
                      quizData: msg.quizData || [],
                      expectedTotal: statusUpdate.total || 4,
                      generatingCurrent: statusUpdate.current || 0,
                      isStreaming: true
                    }
                    : msg
                );
              });
            }

            setStreamingStatus({
              status: 'generating_quiz',
              message: statusUpdate.message
            });
            return;
          }

          // Individual quiz question ready
          if (statusUpdate.status === "quiz_question") {
            devLog("📝 Quiz question received:", statusUpdate.total_so_far);

            // Use quizMessageId if empathetic message exists, otherwise streamingMessageId
            const targetMessageId = quizMessageId || streamingMessageId;

            setChatMessages(prev =>
              prev.map(msg => {
                // Only update messages that are quiz type OR placeholder (no type/empty content)
                // This prevents accidentally converting other message types to quiz
                const isQuizMessage = msg.type === 'quiz';
                const isPlaceholder = !msg.type && (!msg.content || msg.content === '');
                const hasQuizData = msg.quizData && msg.quizData.length > 0;

                if (msg.id === targetMessageId && (isQuizMessage || isPlaceholder || hasQuizData)) {
                  const newQuizData = [...(msg.quizData || []), statusUpdate.question];
                  devLog("✅ Appended question, total:", newQuizData.length);

                  return {
                    ...msg,
                    type: 'quiz',
                    quizData: newQuizData,
                    content: `Quiz - ${statusUpdate.total_so_far} questions générées`,
                    isStreaming: true,
                    expectedTotal: msg.expectedTotal || statusUpdate.total_so_far + 5,
                    generatingCurrent: msg.generatingCurrent || statusUpdate.total_so_far
                  };
                }
                return msg;
              })
            );

            return;
          }

          // Quiz complete
          if (statusUpdate.status === "quiz_complete") {
            devLog("quiz completed");

            // Use quizMessageId if empathetic message exists, otherwise streamingMessageId
            const targetMessageId = quizMessageId || streamingMessageId;

            handleQuizComplete(statusUpdate.quiz_data, targetMessageId, updatedChatId);
            setStreamingStatus(null);
            // Charge per question: a 3-question quiz costs 3, a 20-question quiz costs 20.
            consumeGeneration(statusUpdate.quiz_data?.length || 1);
            return;
          }

          // Flashcard generation progress (EXACTLY like quiz)
          // Flashcard generation progress
          if (statusUpdate.status === "flashcard_generating") {
            devLog("📇 Flashcard generation streaming started");
            isQuizGeneratingRef.current = true;

            const localizedFlashcardMsg = t('loading.generatingFlashcards', 'Generating flashcards...');

            setChatMessages(prev => {
              return prev.map(msg => {
                // Convert streaming placeholder to flashcard message
                if (msg.id === streamingMessageId) {
                  return {
                    ...msg,
                    type: 'flashcard',
                    content: localizedFlashcardMsg,
                    flashcardData: [],
                    isStreaming: true,
                    timestamp: msg.timestamp || new Date()
                  };
                }
                return msg;
              });
            });

            setStreamingStatus({
              status: 'generating_flashcards',
              message: localizedFlashcardMsg
            });
            return;
          }

          // Individual flashcard ready (EXACTLY like quiz_question)
          if (statusUpdate.status === "flashcard_ready") {
            devLog("📇 Flashcard received:", statusUpdate.total_so_far);

            setChatMessages(prev =>
              prev.map(msg => {
                if (msg.id === streamingMessageId && msg.type === 'flashcard') {
                  const newFlashcardData = [...(msg.flashcardData || []), statusUpdate.flashcard];
                  devLog("✅ Appended flashcard, total:", newFlashcardData.length);

                  return {
                    ...msg,
                    flashcardData: newFlashcardData,
                    content: `Flashcards - ${statusUpdate.total_so_far} cards generated`,
                    isStreaming: true
                  };
                }
                return msg;
              })
            );
            return;
          }

          // Flashcards complete (EXACTLY like quiz_complete)
          if (statusUpdate.status === "flashcard_complete") {
            devLog("✅ Flashcards completed");

            handleFlashcardComplete(statusUpdate.flashcard_data, streamingMessageId, updatedChatId);
            setStreamingStatus(null);
            // Charge per card generated.
            consumeGeneration(statusUpdate.flashcard_data?.length || 1);
            return;
          }

          // Prompts suggestions
          if (statusUpdate.status === "suggested_prompts" && statusUpdate.suggestions) {
            devLog("💡 Received suggestions:", statusUpdate.suggestions);
            setSuggestedPrompts(statusUpdate.suggestions);
            return;
          }

          // Mindmap generation started
          if (statusUpdate.status === "mindmap_generating") {
            devLog("🧠 Mindmap generation started");
            isQuizGeneratingRef.current = true;

            setChatMessages(prev => {
              return prev.map(msg => {
                if (msg.id === streamingMessageId) {
                  return {
                    ...msg,
                    type: 'mindmap',
                    content: statusUpdate.message || 'Generating mindmap...',
                    mindmapData: null,
                    isStreaming: true,
                    timestamp: msg.timestamp || new Date()
                  };
                }
                return msg;
              });
            });

            setStreamingStatus({
              status: 'generating_mindmap',
              message: statusUpdate.message
            });
            return;
          }

          // Mindmap complete - let handleMindmapComplete handle both state update and Firebase save
          // (similar to handleFlashcardComplete pattern to avoid race conditions)
          if (statusUpdate.status === "mindmap_complete") {
            devLog("✅ Mindmap completed with", statusUpdate.mindmap_data?.nodes?.length, "nodes");

            // Single state update + Firebase save in handler (avoid duplicate setChatMessages calls)
            handleMindmapComplete(statusUpdate.mindmap_data, streamingMessageId, updatedChatId);
            setStreamingStatus(null);
            consumeGeneration(1); // mindmap charges a flat 1 (not question-based)
            return;
          }

          // Study sheet generation trigger - create inline message
          // Handle both "study_sheet_trigger" (from tools) and "study_sheet_start" (from generator)
          if (statusUpdate.status === "study_sheet_trigger" || statusUpdate.status === "study_sheet_start") {
            devLog("📚 Study sheet started:", statusUpdate);

            // Check if we already have a streaming studysheet to avoid duplicates
            setChatMessages(prev => {
              const hasStreamingStudySheet = prev.some(msg => msg.type === 'studysheet' && msg.isStreaming);
              if (hasStreamingStudySheet) {
                return prev; // Don't create duplicate
              }
              return [...prev, {
                id: `studysheet-${Date.now()}`,
                role: 'assistant',
                type: 'studysheet',
                topic: statusUpdate.topic || 'Study Guide',
                content: '',
                isStreaming: true,
                timestamp: new Date()
              }];
            });

            onCloseSidebar();
            return;
          }

          // Study sheet chunk - append content
          if (statusUpdate.status === "study_sheet_chunk") {
            devLog("📚 Study sheet chunk received");
            setChatMessages(prev =>
              prev.map(msg =>
                msg.type === 'studysheet' && msg.isStreaming
                  ? { ...msg, content: msg.content + (statusUpdate.content || '') }
                  : msg
              )
            );
            return;
          }

          // Study sheet complete
          if (statusUpdate.status === "study_sheet_complete") {
            devLog("📚 Study sheet complete");

            // First, find the streaming study sheet BEFORE updating state
            setChatMessages(prev => {
              // Find the streaming study sheet we're about to complete
              const streamingStudySheet = prev.find(
                msg => msg.type === 'studysheet' && msg.isStreaming
              );

              if (streamingStudySheet && streamingStudySheet.content) {
                // Save to Firebase
                const messageForFirebase = {
                  id: streamingStudySheet.id,
                  role: 'assistant',
                  type: 'studysheet',
                  topic: streamingStudySheet.topic,
                  content: streamingStudySheet.content,
                  timestamp: streamingStudySheet.timestamp || new Date()
                };

                devLog("📚 Saving study sheet to Firebase:", messageForFirebase.id);
                AppendToChat(updatedChatId || currentChatID, messageForFirebase)
                  .then(() => devLog('✅ Study sheet saved to Firebase'))
                  .catch(err => console.error('❌ Failed to save study sheet:', err));
              } else {
                devLog("⚠️ No streaming study sheet found to save");
              }

              // Update state to mark as complete
              return prev.map(msg =>
                msg.type === 'studysheet' && msg.isStreaming
                  ? { ...msg, isStreaming: false }
                  : msg
              );
            });
            return;
          }

          // Study sheet error
          if (statusUpdate.status === "study_sheet_error") {
            devLog("📚 Study sheet error:", statusUpdate.message);
            setChatMessages(prev =>
              prev.map(msg =>
                msg.type === 'studysheet' && msg.isStreaming
                  ? { ...msg, isStreaming: false, error: statusUpdate.message }
                  : msg
              )
            );
            return;
          }

          // ============ AUDIO HANDLERS ============

          // Audio options - show confirmation card for user to select duration
          if (statusUpdate.status === "audio_options") {
            devLog("🎙️ Audio options received:", statusUpdate);

            // IMPORTANT: Set flag to skip onStreamEnd callback
            // This prevents the empty finalMessage from being saved/displayed
            isQuizGeneratingRef.current = true;

            const audioOptionsId = uuidv4();
            setChatMessages(prev => {
              // Remove any streaming placeholder message first
              const filtered = prev.filter(msg => !msg.isStreaming || msg.content);
              return [
                ...filtered,
                {
                  id: audioOptionsId,
                  role: 'assistant',
                  type: 'audio_options',
                  topic: statusUpdate.topic,
                  intent: statusUpdate.intent,
                  styleName: statusUpdate.style_name,
                  styleDescription: statusUpdate.style_description,
                  durations: statusUpdate.durations,
                  defaultDuration: statusUpdate.default_duration,
                  timestamp: new Date()
                }
              ];
            });
            setIsAiTyping(false);
            setIsStreaming(false);
            return;
          }

          // Audio generating - show generating state
          if (statusUpdate.status === "audio_generating" || statusUpdate.status === "audio_script_ready" || statusUpdate.status === "audio_tts_progress") {
            devLog("🎙️ Audio generating:", statusUpdate.message);

            // Map backend status to translation key for bilingual support
            const getAudioStatusKey = (status) => {
              switch (status) {
                case 'audio_generating': return 'audio.creatingScript';
                case 'audio_script_ready': return 'audio.scriptReady';
                case 'audio_tts_progress': return 'audio.generatingAudio';
                default: return 'audio.generating';
              }
            };
            const statusKey = getAudioStatusKey(statusUpdate.status);

            setChatMessages(prev => {
              // Check if we already have an audio player message generating
              const hasAudioPlayer = prev.some(msg => msg.type === 'audio_player' && msg.isGenerating);
              if (hasAudioPlayer) {
                // Update the existing generating message
                return prev.map(msg =>
                  msg.type === 'audio_player' && msg.isGenerating
                    ? { ...msg, generatingMessageKey: statusKey }
                    : msg
                );
              }
              // Create new audio player in generating state
              return [
                ...prev,
                {
                  id: uuidv4(),
                  role: 'assistant',
                  type: 'audio_player',
                  isGenerating: true,
                  generatingMessageKey: statusKey,
                  topic: statusUpdate.topic || 'Audio',
                  timestamp: new Date()
                }
              ];
            });
            return;
          }

          // Audio ready - show the player with audio and save to Firebase
          if (statusUpdate.status === "audio_ready") {
            devLog("🎙️ Audio ready:", statusUpdate.topic);

            // Save audio to Firebase Storage and then save chat message
            if (currentChatID && statusUpdate.audio_base64) {
              saveAudioToStorage(currentChatID, statusUpdate.audio_base64, {
                topic: statusUpdate.topic,
                intent: statusUpdate.intent,
                duration: statusUpdate.audio_duration
              }).then(async (result) => {
                if (result.success) {
                  devLog("🎙️ Audio saved to Firebase Storage:", result.downloadURL);

                  // Update the message in UI with Firebase URL
                  setChatMessages(prev =>
                    prev.map(msg =>
                      msg.type === 'audio_player' && msg.topic === statusUpdate.topic
                        ? { ...msg, firebaseUrl: result.downloadURL, firebasePath: result.path }
                        : msg
                    )
                  );

                  // Save to Firestore as a chat message
                  const audioMessageForFirebase = {
                    id: `audio-${Date.now()}`,
                    role: 'assistant',
                    type: 'audio',
                    topic: statusUpdate.topic,
                    intent: statusUpdate.intent,
                    duration: statusUpdate.audio_duration,
                    script: statusUpdate.script,
                    firebaseUrl: result.downloadURL,
                    firebasePath: result.path,
                    timestamp: new Date()
                  };

                  try {
                    await AppendToChat(currentChatID, audioMessageForFirebase);
                    devLog("🎙️ Audio message saved to Firestore");
                  } catch (err) {
                    console.error("🎙️ Failed to save audio message to Firestore:", err);
                  }
                } else {
                  console.error("🎙️ Failed to save audio to Firebase Storage:", result.error);
                }
              });
            }

            setChatMessages(prev =>
              prev.map(msg =>
                msg.type === 'audio_player' && msg.isGenerating
                  ? {
                    ...msg,
                    isGenerating: false,
                    audioBase64: statusUpdate.audio_base64,
                    audioDuration: statusUpdate.audio_duration,
                    topic: statusUpdate.topic,
                    intent: statusUpdate.intent,
                    script: statusUpdate.script
                  }
                  : msg
              )
            );
            return;
          }

          // Audio complete
          if (statusUpdate.status === "audio_complete") {
            devLog("🎙️ Audio generation complete");
            setIsAiTyping(false);
            return;
          }

          // Audio error
          if (statusUpdate.status === "audio_error") {
            devLog("🎙️ Audio error:", statusUpdate.message);
            setChatMessages(prev =>
              prev.map(msg =>
                msg.type === 'audio_player' && msg.isGenerating
                  ? { ...msg, isGenerating: false, error: statusUpdate.message }
                  : msg
              )
            );
            setIsAiTyping(false);
            return;
          }

          // ============ END AUDIO HANDLERS ============

          // Default status update
          setStreamingStatus(statusUpdate);
        },

        // Token callback - handles regular text streaming (THROTTLED for performance)
        (chunk) => {
          // Accumulate content in ref (no re-render)
          fullResponse = fullResponse + chunk;
          streamingContentRef.current = fullResponse;
          streamingMessageIdRef.current = streamingMessageId;

          // Clear streaming status on first content
          if (fullResponse.length > 0 && streamingStatus) {
            setStreamingStatus(null);
          }

          // Schedule throttled UI update (~14/sec instead of 100+/sec)
          scheduleStreamingUpdate();
        },

        // Complete callback - handles end of stream
        async () => {
          // Clean up throttle and flush any remaining content
          cleanupStreamingThrottle();

          setStreamingStatus(null);
          setIsStreaming(false);

          // Check if this was a quiz (don't save quiz as text)
          if (isQuizGeneratingRef.current) {
            isQuizGeneratingRef.current = false;
            setIsAiTyping(false);
            return;
          }

          // Empty response = the stream died silently. Never persist an
          // empty assistant message (they used to litter chats and poison
          // context); show an error bubble with Retry instead.
          if (!fullResponse || fullResponse.trim() === '') {
            console.error("❌ Stream completed with empty content — showing retry instead of saving");
            setChatMessages(prev =>
              prev.map(msg =>
                msg.id === streamingMessageId
                  ? { ...msg, content: '', error: true, retryText: messageToSend, isStreaming: false }
                  : msg
              )
            );
            setIsAiTyping(false);
            return;
          }

          // Build final message with complete content
          const finalMessage = {
            id: streamingMessageId,
            role: "assistant",
            content: fullResponse,
            timestamp: new Date(),
            isStreaming: false
          };

          // Save to Firebase
          await AppendToChat(updatedChatId || currentChatID, finalMessage);

          // Final UI update - mark streaming complete
          setChatMessages(prev =>
            prev.map(msg =>
              msg.id === streamingMessageId ? finalMessage : msg
            )
          );

          setIsAiTyping(false);
        }
      );
    } catch (error) {
      console.error("WebSocket streaming error:", error);

      // Clean up throttle on error
      cleanupStreamingThrottle();

      setStreamingStatus(null);
      setIsStreaming(false);

      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === streamingMessageId
            ? {
              ...msg,
              content: '',
              error: true,
              retryText: messageToSend,
              isStreaming: false
            }
            : msg
        )
      );

      setIsAiTyping(false);
      setConnectionStatus('error');
    }
  };

  // ============================================
  // STOP STREAMING HANDLER
  // ============================================

  const handleStopStreaming = async () => {
    // Clean up streaming throttle immediately
    cleanupStreamingThrottle();

    try {
      // Send cancel message via WebSocket
      const success = await cancelWebSocketStream(currentChatID);

      if (success) {
        // Update UI state
        setIsStreaming(false);
        setIsAiTyping(false);
        setStreamingStatus(null);

        // Collect messages to save to Firebase BEFORE updating state
        const messagesToSave = [];

        // Remove or finalize streaming messages
        setChatMessages(prev => {
          const updatedMessages = prev.map(msg => {
            if (msg.isStreaming) {
              // Handle quiz messages - finalize with whatever was generated
              if (msg.type === 'quiz' && msg.quizData && msg.quizData.length > 0) {
                devLog(`🛑 Finalizing quiz with ${msg.quizData.length} questions`);
                const finalizedMsg = {
                  ...msg,
                  isStreaming: false,
                  stopped: true,
                  content: `Quiz stopped - ${msg.quizData.length} questions generated`
                };
                // Queue for Firebase save
                messagesToSave.push({
                  type: 'quiz',
                  id: msg.id,
                  data: finalizedMsg
                });
                return finalizedMsg;
              }

              // Handle flashcard messages - finalize with whatever was generated
              if (msg.type === 'flashcard' && msg.flashcardData && msg.flashcardData.length > 0) {
                devLog(`🛑 Finalizing flashcards with ${msg.flashcardData.length} cards`);
                const finalizedMsg = {
                  ...msg,
                  isStreaming: false,
                  stopped: true,
                  content: `Flashcards stopped - ${msg.flashcardData.length} cards generated`
                };
                // Queue for Firebase save
                messagesToSave.push({
                  type: 'flashcard',
                  id: msg.id,
                  data: finalizedMsg
                });
                return finalizedMsg;
              }

              // Handle mindmap messages - remove if stopped mid-generation (no partial mindmaps)
              if (msg.type === 'mindmap') {
                if (msg.mindmapData && msg.mindmapData.nodes && msg.mindmapData.nodes.length > 0) {
                  devLog(`🛑 Finalizing mindmap with ${msg.mindmapData.nodes.length} nodes`);
                  return {
                    ...msg,
                    isStreaming: false,
                    stopped: true
                  };
                }
                // No data yet - remove the placeholder
                devLog(`🛑 Removing incomplete mindmap message: ${msg.id}`);
                return null;
              }

              // Handle regular text messages - keep if has content
              if (msg.content && msg.content.trim()) {
                return {
                  ...msg,
                  isStreaming: false,
                  stopped: true
                };
              }

              // Empty messages with no data - remove them
              devLog(`🛑 Removing empty streaming message: ${msg.id}`);
              return null;
            }
            return msg;
          }).filter(Boolean); // Remove null entries

          return updatedMessages;
        });

        // Save stopped quiz/flashcard messages to Firebase
        for (const msgToSave of messagesToSave) {
          try {
            devLog(`💾 Saving stopped ${msgToSave.type} to Firebase:`, msgToSave.id);
            const messageForFirebase = {
              id: msgToSave.data.id,
              role: 'assistant',
              type: msgToSave.type,
              content: msgToSave.data.content,
              isStreaming: false,
              stopped: true,
              timestamp: new Date()
            };

            if (msgToSave.type === 'quiz') {
              messageForFirebase.quizData = msgToSave.data.quizData;
            } else if (msgToSave.type === 'flashcard') {
              messageForFirebase.flashcardData = msgToSave.data.flashcardData;
            }

            await AppendToChat(currentChatID, messageForFirebase);
            devLog(`✅ Stopped ${msgToSave.type} saved to Firebase`);
          } catch (saveError) {
            console.error(`❌ Failed to save stopped ${msgToSave.type} to Firebase:`, saveError);
          }
        }
      } else {
        console.error('❌ Failed to send stop request');
      }
    } catch (error) {
      console.error('❌ Error stopping stream:', error);
      // Still update UI even if backend call fails
      setIsStreaming(false);
      setIsAiTyping(false);
      setStreamingStatus(null);
    }
  };

  /**
    * Handle suggestion click - auto-send the suggested prompt
    */
  const handleSuggestionClick = useCallback((suggestion) => {
    devLog("💡 User clicked suggestion:", suggestion);

    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    // Clear suggestions immediately
    setSuggestedPrompts([]);

    // Auto-send the message (use ref to avoid dep on handleSendNewUserMessage)
    handleSendNewUserMessageRef.current(null, suggestion);
  }, []);


  // ✅ FIXED: Use ref instead of state for synchronous updates
  const handleQuizAnswerSelect = async (answerData) => {
    try {
      // Check if this is a flashcard review instead of quiz answer
      if (answerData.cardIndex !== undefined) {
        return handleFlashcardReview(answerData);
      }

      devLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      devLog("📝 Quiz answer received:");
      devLog("  Message ID:", answerData.messageId);
      devLog("  Question Index:", answerData.quizIndex);
      devLog("  Selected:", answerData.selectedOptionText);
      devLog("  Correct?", answerData.isCorrect ? "✓" : "✗");

      // ✅ FIX: Prevent double-submission (but allow review attempts to override)
      const answerKey = `${answerData.messageId}-${answerData.quizIndex}`;
      if (submittedAnswersRef.current.has(answerKey) && !answerData.isReviewAttempt) {
        devLog("  ⚠️ Answer already submitted, ignoring duplicate");
        devLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        return;
      }
      submittedAnswersRef.current.add(answerKey);

      if (answerData.isReviewAttempt) {
        devLog("  🔄 Review attempt - updating previous answer");
      }

      // ✅ Track progress: XP, serum, and topic stats
      const quizTopic = answerData.topic || null;
      if (answerData.isCorrect) {
        devLog("  🎯 Recording correct answer for progress tracking");
        addCorrectAnswer(quizTopic);
      } else {
        devLog("  📊 Recording incorrect answer for topic stats");
        addIncorrectAnswer(quizTopic);
      }

      // ✅ Find the message to check if it's still streaming
      const quizMessage = chatMessages.find(msg => msg.id === answerData.messageId);
      const isStreaming = quizMessage?.isStreaming;

      devLog("  Quiz streaming?", isStreaming ? "YES ⏳" : "NO ✓");
      devLog("  Current quiz questions:", quizMessage?.quizData?.length || 0);

      // ✅ Update UI immediately (optimistic update)
      setChatMessages(prev =>
        prev.map(msg => {
          if (msg.id !== answerData.messageId || msg.type !== 'quiz') return msg;

          const updatedQuizData = (msg.quizData || []).map((q, idx) => {
            if (idx !== answerData.quizIndex) return q;

            // Handle both MCQ and SATA question types
            const questionType = answerData.questionType || q.questionType || 'mcq';

            if (questionType === 'sata') {
              // SATA question: multiple selections with scoring
              return {
                ...q,
                userSelection: {
                  questionType: 'sata',
                  selectedOptions: answerData.selectedOptions || [],
                  correctOptions: answerData.correctOptions || [],
                  isCorrect: answerData.isCorrect,
                  score: answerData.score || 0,
                  maxScore: answerData.maxScore || 0,
                  percentage: answerData.percentage || 0,
                  scoreResult: answerData.scoreResult || null,
                  timestamp: answerData.timestamp
                }
              };
            } else {
              // MCQ question: single selection
              return {
                ...q,
                userSelection: {
                  questionType: 'mcq',
                  selectedIndex: answerData.selectedOptionIndex,
                  selectedOptionText: answerData.selectedOptionText,
                  isCorrect: answerData.isCorrect,
                  timestamp: answerData.timestamp
                }
              };
            }
          });

          devLog("  ✓ Updated UI state for Q" + (answerData.quizIndex + 1));
          return { ...msg, quizData: updatedQuizData };
        })
      );

      // ✅ If still streaming, also store in REF (for handleQuizComplete to merge later)
      if (isStreaming) {
        devLog("  ⏳ Quiz still streaming - storing in pendingQuizAnswersRef");
        if (!pendingQuizAnswersRef.current[answerData.messageId]) {
          pendingQuizAnswersRef.current[answerData.messageId] = {};
        }
        pendingQuizAnswersRef.current[answerData.messageId][answerData.quizIndex] = answerData;
        devLog("  📦 Pending answers count:", Object.keys(pendingQuizAnswersRef.current[answerData.messageId]).length);
      }

      // ✅ ALWAYS try to save to Firebase immediately (save as you go)
      devLog("  💾 Saving answer to Firebase...");
      try {
        await UpdateQuizAnswer(
          currentChatID,
          answerData.messageId,
          answerData.questionText,
          answerData
        );
        devLog("  ✅ Saved to Firebase successfully");
      } catch (updateError) {
        // UpdateQuizAnswer failed - this is expected during streaming (message not in Firebase yet)
        // DON'T use AppendToChat as fallback - it creates duplicates!
        // Instead, rely on pendingQuizAnswersRef which handleQuizComplete will merge
        devLog("  ⚠️ UpdateQuizAnswer failed (expected during streaming):", updateError.message);
        devLog("  📦 Answer stored in pendingQuizAnswersRef - will be saved when quiz completes");
      }
      devLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    } catch (error) {
      console.error("❌ Failed to save quiz answer:", error);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
  };

  const handleQuizInteraction = useCallback((quizId) => {
    devLog('📝 Quiz interaction:', quizId);
    if (quizId === null) {
      setActiveQuizId(null);
      setActiveQuizProgress(null);
    } else {
      setActiveQuizId(quizId);
    }
  }, []);

  /**
   * Handle quiz visibility changes from ChatMessage
   * Called when quiz progress bar scrolls in/out of view
   * 
   * @param {Object} quizData - Quiz progress data from ChatMessage
   */
  const handleQuizVisibilityChange = useCallback((quizData) => {
    devLog('👁️ Quiz visibility change:', {
      messageId: quizData.messageId,
      isVisible: quizData.isVisible,
      activeQuizId: activeQuizId,
      isActive: quizData.messageId === activeQuizId
    });

    if (quizData.isVisible) {
      // Only show sticky if this is the active quiz
      if (quizData.messageId === activeQuizId) {
        devLog('✅ Showing sticky bar for active quiz');
        setActiveQuizProgress(quizData);
      } else {
        devLog('⏭️ Ignoring non-active quiz');
      }
    } else {
      setActiveQuizProgress(prev => {
        if (prev && prev.messageId === quizData.messageId) {
          devLog('✅ Hiding sticky bar (inline visible)');
          return null;
        }
        return prev;
      });
    }
  }, [activeQuizId]); // Important: Add activeQuizId to dependencies

  const handleQuizComplete = async (quizData, messageId, chatId) => {
    devLog("✅ Quiz complete, finalizing message");
    devLog("Backend sent", quizData?.length, "questions");
    setStreamingStatus(null);

    // ✅ Get pending answers from ref FIRST
    const pendingAnswers = pendingQuizAnswersRef.current[messageId] || {};
    devLog("📦 Pending answers from REF:", pendingAnswers);
    devLog("📦 Number of pending answers:", Object.keys(pendingAnswers).length);

    // ✅ NEW FIX: Build merged data BEFORE touching state
    // Trust the ref as the source of truth for streaming answers
    const mergedQuizData = quizData.map((question, idx) => {
      const pendingAnswer = pendingAnswers[idx];

      if (pendingAnswer) {
        devLog(`✓ Q${idx + 1}: Using pending answer from REF`);
        return {
          ...question,
          userSelection: {
            selectedIndex: pendingAnswer.selectedOptionIndex,
            selectedOptionText: pendingAnswer.selectedOptionText,
            isCorrect: pendingAnswer.isCorrect,
            timestamp: pendingAnswer.timestamp
          }
        };
      }

      devLog(`- Q${idx + 1}: No answer`);
      return question;
    });

    devLog("📊 Final merge result:",
      mergedQuizData.filter(q => q.userSelection).length,
      "answered questions out of",
      mergedQuizData.length
    );

    // ✅ Update UI state with merged data
    // Only update quiz messages or placeholders - don't convert other message types
    setChatMessages(prev =>
      prev.map(msg => {
        const isQuizMessage = msg.type === 'quiz';
        const isPlaceholder = !msg.type && (!msg.content || msg.content === '');
        const hasQuizData = msg.quizData && msg.quizData.length > 0;

        if (msg.id === messageId && (isQuizMessage || isPlaceholder || hasQuizData)) {
          return {
            ...msg,
            type: 'quiz',
            quizData: mergedQuizData,
            content: currentLanguage === 'fr' ? `Voici votre quiz (${quizData.length} questions)` : `Here's your quiz (${quizData.length} questions)`,
            isStreaming: false,
            timestamp: new Date()
          };
        }
        return msg;
      })
    );

    // ✅ Save to Firebase with merged data (with retry)
    devLog("💾 Saving to Firebase:",
      mergedQuizData.filter(q => q.userSelection).length,
      "answered questions"
    );

    devLog("🔍 DEBUG - mergedQuizData contents:", mergedQuizData);

    mergedQuizData.forEach((q, idx) => {
      if (q.userSelection) {
        devLog(`  Q${idx + 1}: ${q.userSelection.isCorrect ? '✓' : '✗'} - ${q.userSelection.selectedOptionText}`);
      }
    });

    const messageToSave = {
      id: messageId,
      role: 'assistant',
      type: 'quiz',
      quizData: mergedQuizData,
      content: currentLanguage === 'fr' ? `Votre quiz (${quizData.length} questions)` : `Your quiz (${quizData.length} questions)`,
      isStreaming: false,
      timestamp: new Date()
    };

    devLog("🔍 DEBUG - messageToSave.quizData:", messageToSave.quizData);
    devLog("🔍 DEBUG - messageToSave.quizData length:", messageToSave.quizData.length);

    // ✅ Save using upsert (creates or updates, no duplicates)
    try {
      await SaveOrUpdateMessage(chatId, messageToSave);
      devLog("✅ Firebase save successful");
    } catch (error) {
      console.error("❌ Firebase save failed, retrying once:", error);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await SaveOrUpdateMessage(chatId, messageToSave);
        devLog("✅ Firebase save successful on retry");
      } catch (retryError) {
        console.error("❌ Firebase save failed on retry:", retryError);
        // Don't throw - let user continue, data is in UI
      }
    }

    // ✅ Clear ref
    if (pendingQuizAnswersRef.current[messageId]) {
      delete pendingQuizAnswersRef.current[messageId];
      devLog("🧹 Cleared pending answers from ref");
    }

    // ✅ Clear submission tracking for this quiz
    submittedAnswersRef.current = new Set(
      Array.from(submittedAnswersRef.current).filter(key => !key.startsWith(messageId))
    );
    devLog("🧹 Cleared submission tracking for quiz");

    setIsAiTyping(false);
    devLog("✅ Quiz save complete!");
  };

  const handleFlashcardComplete = async (flashcardData, messageId, chatId) => {
    devLog("✅ Flashcards complete, finalizing message");
    devLog("📦 Backend sent", flashcardData?.length, "flashcards");
    setStreamingStatus(null);

    // Initialize flashcard data with status (same as quiz initializes with answers)
    const initializedFlashcards = flashcardData.map(card => ({
      ...card,
      status: 'new',
      reviewCount: 0,
      lastReviewed: null
    }));

    devLog("🎴 Initialized flashcards:", initializedFlashcards);

    // ✅ Update UI state (EXACTLY like handleQuizComplete)
    setChatMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId && msg.type === 'flashcard') {
          return {
            ...msg,
            flashcardData: initializedFlashcards,
            content: `Flashcards - ${flashcardData.length} cards`,
            isStreaming: false,
            timestamp: new Date()
          };
        }
        return msg;
      })
    );

    // ✅ Save to Firebase with retry (EXACTLY like handleQuizComplete)
    devLog("💾 Saving to Firebase:",
      flashcardData.length,
      "flashcards"
    );

    const messageToSave = {
      id: messageId,
      role: 'assistant',
      type: 'flashcard',
      flashcardData: initializedFlashcards,
      content: `Flashcards - ${flashcardData.length} cards`,
      isStreaming: false,
      timestamp: new Date()
    };

    // ✅ Save using upsert (creates or updates, no duplicates)
    try {
      await SaveOrUpdateMessage(chatId, messageToSave);
      devLog("✅ Firebase save successful");
    } catch (error) {
      console.error("❌ Firebase save failed, retrying once:", error);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await SaveOrUpdateMessage(chatId, messageToSave);
        devLog("✅ Firebase save successful on retry");
      } catch (retryError) {
        console.error("❌ Firebase save failed on retry:", retryError);
        // Don't throw - let user continue, data is in UI
      }
    }

    setIsAiTyping(false);
    devLog("✅ Flashcard save complete!");
  };

  const handleMindmapComplete = async (mindmapData, messageId, chatId) => {
    devLog("✅ Mindmap complete, finalizing message");
    devLog("📦 Backend sent mindmap with", mindmapData?.nodes?.length, "nodes");
    devLog("🆔 Target messageId:", messageId);
    setStreamingStatus(null);

    // ✅ Update UI state - this is the ONLY place state is updated for mindmap_complete
    setChatMessages(prev => {
      devLog("🔍 Looking for message to update...");
      const targetMsg = prev.find(msg => msg.id === messageId);
      devLog("📍 Found target message:", targetMsg ? `type=${targetMsg.type}, isStreaming=${targetMsg.isStreaming}` : "NOT FOUND");

      return prev.map(msg => {
        if (msg.id === messageId && msg.type === 'mindmap') {
          devLog("✅ Updating mindmap message with data");
          return {
            ...msg,
            mindmapData: mindmapData,
            content: mindmapData?.central_topic || 'Mindmap',
            isStreaming: false,
            timestamp: new Date()
          };
        }
        return msg;
      });
    });

    // ✅ Save to Firebase
    devLog("💾 Saving mindmap to Firebase");

    const messageToSave = {
      id: messageId,
      role: 'assistant',
      type: 'mindmap',
      mindmapData: mindmapData,
      content: mindmapData?.central_topic || 'Mindmap',
      isStreaming: false,
      timestamp: new Date()
    };

    // ✅ Save using upsert (creates or updates, no duplicates)
    try {
      await SaveOrUpdateMessage(chatId, messageToSave);
      devLog("✅ Mindmap Firebase save successful");
    } catch (error) {
      console.error("❌ Mindmap Firebase save failed, retrying once:", error);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await SaveOrUpdateMessage(chatId, messageToSave);
        devLog("✅ Mindmap Firebase save successful on retry");
      } catch (retryError) {
        console.error("❌ Mindmap Firebase save failed on retry:", retryError);
      }
    }

    setIsAiTyping(false);
    devLog("✅ Mindmap save complete!");
  };

  const handleFlashcardReview = async (reviewData) => {
    try {
      devLog("📇 Flashcard review received:", reviewData);

      // Update UI immediately (optimistic update)
      setChatMessages(prev =>
        prev.map(msg => {
          if (msg.id !== reviewData.messageId || msg.type !== 'flashcard') return msg;

          const updatedFlashcardData = (msg.flashcardData || []).map((card, idx) =>
            idx === reviewData.cardIndex
              ? {
                ...card,
                userReview: reviewData.userReview,
                status: reviewData.status,
                reviewCount: reviewData.reviewCount,
                lastReviewed: reviewData.lastReviewed
              }
              : card
          );

          devLog("✅ Updated flashcard UI state for card", reviewData.cardIndex + 1);
          return { ...msg, flashcardData: updatedFlashcardData };
        })
      );

      // Save to Firebase
      await UpdateFlashcardReview(
        currentChatID,
        reviewData.messageId,
        reviewData.cardIndex,
        reviewData
      );

      devLog("✅ Flashcard review saved to Firebase");
    } catch (error) {
      console.error("❌ Error saving flashcard review:", error);
    }
  };

  // ============================================
  // FILE HANDLING
  // ============================================
  const ensureChatExists = async (chatId, user) => {
    if (chatId) {
      const chatRef = doc(db, "chats", chatId);
      const chatSnapshot = await getDoc(chatRef);
      if (chatSnapshot.exists()) {
        return chatId;
      }
    }

    const newChat = {
      userId: user.uid,
      title: "Nouveau Chat",
      description: "Nouvelle conversation",
      updatedAt: serverTimestamp()
    };

    const newChatRef = await addDoc(collection(db, "chats"), newChat);
    return newChatRef.id;
  };

  // Supported file types for upload
  const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/markdown',
    // Images — backend extracts text via OCR (OCRImageLoader in main.py)
    'image/jpeg',
    'image/png',
    'image/bmp',
    'image/tiff',
    'image/webp',
    'image/heic'
  ];
  const SUPPORTED_EXTENSIONS = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|md|jpg|jpeg|png|bmp|tiff|webp|heic)$/i;

  const isFileTypeSupported = (file) => {
    // Check MIME type first (works on most desktop browsers)
    if (file.type && SUPPORTED_MIME_TYPES.includes(file.type)) return true;

    // Fallback to extension check (critical for iOS/iCloud where file.type is often empty)
    if (SUPPORTED_EXTENSIONS.test(file.name)) return true;

    // iOS Safari / iCloud: files can arrive with empty type AND no extension.
    // Allow these through — the backend will reject truly unsupported files.
    // This is safer than silently blocking valid documents.
    if (!file.type && !file.name.includes('.')) return true;

    return false;
  };

  const handleFileSelect = async (e) => {
    const allFiles = Array.from(e.target.files);
    if (allFiles.length === 0) return;

    // Validate file types
    const supportedFiles = allFiles.filter(isFileTypeSupported);
    const unsupportedFiles = allFiles.filter(file => !isFileTypeSupported(file));

    // Handle unsupported files
    if (unsupportedFiles.length > 0) {
      const unsupportedNames = unsupportedFiles.map(f => f.name).join(', ');

      if (supportedFiles.length === 0) {
        // All files are unsupported
        setFileErrorToast(t('landing.unsupportedFileType', { files: unsupportedNames }));
        if (e.target) e.target.value = '';
        return;
      } else {
        // Some files are unsupported, continue with the rest
        setFileErrorToast(t('landing.unsupportedFileTypePartial', { files: unsupportedNames }));
      }
    }

    // Continue with only supported files
    const files = supportedFiles;

    // Free plan: one upload per chat. If this chat already has a file, block
    // the second upload and pitch Pro instead.
    if (!isPro && uploadedFilesListRef.current.length > 0) {
      // trigger is what separates this HARD BLOCK from a voluntary badge
      // tap in the funnel data — both used to arrive as openUpgrade(null).
      openUpgrade(null, { topic: currentChatTitleRef.current, trigger: 'upload_gate' });
      if (e.target) e.target.value = '';
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user');
      return;
    }

    // Ensure chat exists
    let resolvedChatId = currentChatID;
    try {
      resolvedChatId = await ensureChatExists(currentChatID, user);
      if (resolvedChatId !== currentChatID) {
        setChatId(resolvedChatId);
        // Keep sidebar/URL state in sync (important when coming from landing)
        if (onChatSelected) {
          onChatSelected(resolvedChatId);
        }
      }
    } catch (error) {
      console.error('Failed to ensure chat exists:', error);
      return;
    }

    // One funnel per upload attempt — not per session and not per user. A
    // student who uploads three decks walks three funnels, and averaging them
    // into one is how a 3-of-3 completion reads as 1-of-1. The context stamped
    // here rides every subsequent row, so a single-row query can segment by
    // entry point and by how much budget she had left when she started.
    startFunnel({
      entryPoint: window._pendingDrill ? 'drill'
        : window._pendingStudyJourney ? 'study_journey'
        : pendingStudyActionRef.current ? 'preselected_action'
        : 'attach',
      isFirstUpload: !userProfile?.hasCompletedFirstUpload,
      fileCount: files.length,
      plansRemaining: plansRemaining ?? null,
      questionsRemaining: remaining ?? null,
    });
    logFunnelStep(FUNNEL.UPLOAD_STARTED);

    // Track files by name for UI updates
    const fileTracker = new Map();

    files.forEach(file => {
      const tempId = uuidv4();
      fileTracker.set(file.name, {
        tempId: tempId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
        stage: 'uploading'
      });
    });

    // ========================================
    // 🆕 CREATE LOADING MESSAGE IMMEDIATELY (BEFORE API CALL)
    // ========================================
    const loadingMsgId = uuidv4();
    uploadMessageIdRef.current = loadingMsgId;  // Set ref FIRST!
    uploadInsightsAccumulatorRef.current = [];  // 🆕 Reset accumulator

    const loadingMessage = {
      id: loadingMsgId,
      role: 'assistant',
      type: 'upload_loading',
      content: 'upload_analyzing',
      timestamp: Date.now(),
      isLoading: true,
      insights: [],
      summary: null,
      fileCount: files.length,  // Set count immediately
      filenames: files.map(f => f.name),
      language: currentLanguage
    };

    setChatMessages(prev => [...prev, loadingMessage]);
    devLog(`📦 Created loading message BEFORE upload: ${loadingMsgId}`);
    devLog(`   File count: ${files.length}`);

    // ========================================
    // DOCUMENT-TO-QUESTION — visible DURING the upload
    // ========================================
    // A study-plan upload opens the transformation immediately, with optional
    // course details while parsing runs. The card is filled in later, in
    // place, when `post_upload_message` arrives with the topics.
    //
    // Only for the study-journey entry point. A drill or a plain attach has no
    // plan to build and must not be asked anything.
    if (window._pendingStudyJourney) {
      const earlyOnboardId = `plan-onboarding-${Date.now()}`;
      planOnboardingIdRef.current = earlyOnboardId;
      setChatMessages(prev => ([
        ...prev,
        {
          id: earlyOnboardId,
          uploadMessageId: loadingMsgId,
          role: 'assistant',
          type: 'plan_onboarding',
          content: '',
          topics: [],
          insights: [],
          filenames: files.map(f => f.name),
          fileCount: files.length,
          actions: [],
          // The timeline's "reading your materials" step stays running until
          // this flips, and the intelligence run is held until then too.
          materialsReady: false,
          timestamp: Date.now()
        }
      ]));
    }

    setLoadingState('fileUpload', true);

    try {
      // Upload files with progress tracking
      const results = await upload_files_with_progress(
        files,
        resolvedChatId,
        (update) => handleUploadProgress(update, fileTracker, resolvedChatId),
        currentLanguage
      );

      // All files completed
      setLoadingState('fileUpload', false);
      setLoadingState('fileEmbedding', false);

      // Update uploaded files list
      const completedFiles = Array.from(results.files.values()).map(fileData => {
        const trackedFile = Array.from(fileTracker.values()).find(
          f => f.fileId === fileData.file_id
        );

        return {
          id: fileData.file_id,
          name: fileData.filename,
          size: trackedFile?.size || 0,
          type: trackedFile?.type || '',
          status: 'completed',
          downloadURL: fileData.firebase_url,
          uploadedAt: Date.now(),
          wordCount: fileData.word_count
        };
      });

      setUploadedFilesList(prev => [...prev, ...completedFiles]);

      // Save metadata to Firestore for each file
      for (const file of completedFiles) {
        try {
          await SaveFileMetaData(
            resolvedChatId,
            file,
            file.downloadURL,
            file.wordCount
          );
        } catch (metaError) {
          console.error('Failed to save file metadata:', metaError);
        }
      }

      // Insights and summary are now shown in LoadingMessageBox via handleUploadProgress

    } catch (error) {
      console.error('Upload error:', error);
      setLoadingState('fileUpload', false);
      setLoadingState('fileEmbedding', false);
      setIsUploadAnalyzing(false);

      // Flip the upload loading box into a visible error state so a failed,
      // timed-out, or dropped upload can never leave the spinner running forever.
      const failedMsgId = uploadMessageIdRef.current;
      if (failedMsgId) {
        setChatMessages(prev => prev.map(msg =>
          msg.id === failedMsgId && msg.type === 'upload_loading'
            ? { ...msg, isLoading: false, error: true, errorCode: error.code }
            : msg
        ));
      }
      // Tell the coach card too. Without this it waits forever for materials
      // that are never coming, showing a timeline that cannot finish.
      const strandedOnboardId = planOnboardingIdRef.current;
      if (strandedOnboardId) {
        setChatMessages(prev => prev.map(msg =>
          msg.id === strandedOnboardId && msg.type === 'plan_onboarding'
            ? { ...msg, uploadFailed: true, materialsReady: true }
            : msg
        ));
        planOnboardingIdRef.current = null;
      }
      uploadMessageIdRef.current = null;
      uploadInsightsAccumulatorRef.current = [];

      // Mark all uploading files as error
      setChatMessages(prev => prev.map(msg =>
        msg.type === 'file' && msg.file?.status === 'uploading'
          ? {
            ...msg,
            content: `${t("upload.failed")}: ${msg.file.name}`,
            file: { ...msg.file, status: 'error', errorMessage: error.message }
          }
          : msg
      ));
    }

    // Reset the input so the same file can be re-selected.
    // iOS Safari requires '' (null is a no-op on WebKit).
    if (e.target) e.target.value = '';
  };

  // ============================================
  // PROCESS PENDING FILE UPLOAD (from landing page)
  // ============================================
  // This effect runs after handleFileSelect is defined and when
  // shouldProcessPendingUpload is true. It triggers the upload
  // for files that were selected before the user logged in.
  // ============================================
  useEffect(() => {
    if (!shouldProcessPendingUpload || pendingUploadFiles.length === 0) return;
    if (pendingUploadProcessedRef.current) return;

    devLog(`📤 Processing ${pendingUploadFiles.length} pending upload(s) from landing page`);
    pendingUploadProcessedRef.current = true;
    setShouldProcessPendingUpload(false);

    // If coming from landing page with study mode flag, set the global flag
    // so that post_upload_message handler will go directly to study mode
    if (goToStudyMode) {
      devLog('📚 Landing page upload with study mode - setting _pendingStudyJourney flag');
      window._pendingStudyJourney = true;
      if (onStudyModeTriggered) {
        onStudyModeTriggered();
      }
    }

    // Create a fake event object to trigger the existing handleFileSelect
    const fakeEvent = {
      target: {
        files: pendingUploadFiles,
        value: null
      }
    };

    // Trigger the file upload
    handleFileSelect(fakeEvent);

    // Notify parent that we've processed the pending upload
    if (onPendingUploadProcessed) {
      onPendingUploadProcessed();
    }
  }, [shouldProcessPendingUpload, pendingUploadFiles, onPendingUploadProcessed, goToStudyMode, onStudyModeTriggered]);

  // Progress handler - add this as a new function in your component
  const handleUploadProgress = (update, fileTracker, chatId) => {
    devLog('📦 Upload progress:', update.type, update);

    switch (update.type) {
      case 'batch_start':
        devLog(`🚀 Starting upload of ${update.total_files} files`);
        // Loading message already created in handleFileSelect!
        // Just update fileCount and filenames if needed
        const batchMsgId = uploadMessageIdRef.current;
        if (batchMsgId) {
          setChatMessages(prev => prev.map(msg =>
            msg.id === batchMsgId && msg.type === 'upload_loading'
              ? { ...msg, fileCount: update.total_files, filenames: update.filenames }
              : msg
          ));
        }

        setIsUploadAnalyzing(true);
        setUploadInsights([]);
        setUploadSummary(null);
        break;

      case 'file_start':
        if (fileTracker.has(update.filename)) {
          const tracked = fileTracker.get(update.filename);
          tracked.stage = 'processing';
          tracked.fileId = update.file_id;
        }
        break;

      case 'insight_batch':
        devLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        devLog(`🔍 INSIGHT_BATCH RECEIVED`);
        devLog(`   Filename: ${update.filename}`);
        devLog(`   Topics:`, update.topics);
        devLog(`   Concepts:`, update.concepts);

        const msgId = uploadMessageIdRef.current;
        if (!msgId) {
          console.error('⚠️ No uploadMessageId - this should never happen now!');
          devLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          return;
        }

        devLog(`   Message ID: ${msgId}`);

        // 🆕 FIX: Accumulate in REF first (synchronous, no race!)
        const newInsight = {
          filename: update.filename,
          topics: update.topics || [],
          concepts: update.concepts || [],
          documentType: update.document_type,
          // Classification skills the document actually teaches (nursing process,
          // Maslow, ABCDE...). Detected server-side from the full text against a
          // closed set; [] means this document teaches none, which is the common
          // case. Persisted so the planner can build practice on them later.
          frameworks: update.frameworks || []
        };

        devLog(`   Created insight object:`, newInsight);

        // CRITICAL: Check ref BEFORE push
        devLog(`   🔍 Accumulator BEFORE push:`, uploadInsightsAccumulatorRef.current.length, 'items');
        devLog(`   🔍 Accumulator contents BEFORE:`, uploadInsightsAccumulatorRef.current.map(i => i.filename));

        uploadInsightsAccumulatorRef.current.push(newInsight);

        // CRITICAL: Check ref AFTER push
        devLog(`   ✅ Accumulator AFTER push:`, uploadInsightsAccumulatorRef.current.length, 'items');
        devLog(`   ✅ Accumulator contents AFTER:`, uploadInsightsAccumulatorRef.current.map(i => i.filename));

        // Update state with ALL accumulated insights (prevents race)
        setChatMessages(prev => {
          devLog(`   🔍 setChatMessages called`);
          devLog(`   🔍 Total messages in state:`, prev.length);

          const updated = prev.map(msg => {
            if (msg.id === msgId && msg.type === 'upload_loading') {
              devLog(`   ✅ Found upload_loading message!`);
              devLog(`   📊 Current insights in message:`, msg.insights?.length || 0);
              devLog(`   📊 New insights from ref:`, uploadInsightsAccumulatorRef.current.length);

              return {
                ...msg,
                insights: [...uploadInsightsAccumulatorRef.current]  // Use ref as source of truth
              };
            }
            return msg;
          });

          devLog(`   ✅ State update complete`);
          return updated;
        });

        devLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        break;

      case 'upload_summary':
        devLog(`📝 Upload summary received:`, update.summary);

        setUploadSummary(update.summary);

        const summaryMsgId = uploadMessageIdRef.current;

        // Add summary to the loading message but KEEP showing all insights
        // Do NOT transition yet - wait for all_complete
        setChatMessages(prev => prev.map(msg => {
          if (msg.id === summaryMsgId && msg.type === 'upload_loading') {
            devLog('📝 Adding summary to loading message (still showing all insights)');
            return {
              ...msg,
              summary: update.summary,
              fileCount: update.file_count,
              filenames: update.filenames,
              // Keep isLoading: true to continue showing full progress
            };
          }
          return msg;
        }));

        break;

      case 'embedding_start':
        setLoadingState('fileEmbedding', true);
        // Find file by file_id and update stage
        for (const [name, data] of fileTracker.entries()) {
          if (data.fileId === update.file_id) {
            data.stage = 'embedding';
            break;
          }
        }
        break;

      case 'embedding_progress':
        devLog(`🔤 Embedding progress: ${update.stage}`);
        break;

      case 'embedding_complete':
        devLog(`✅ Embedded: ${update.word_count} words, ${update.chunks} chunks`);
        break;

      case 'firebase_start':
        devLog(`☁️ Starting Firebase upload...`);
        break;

      case 'firebase_complete':
        devLog(`✅ Firebase uploaded: ${update.firebase_url}`);
        break;

      case 'quiz_complete':
        devLog(`📝 Quiz generated: ${update.question_count} questions`);
        break;

      case 'file_complete':
        // Remove individual file messages - we're showing insights instead
        devLog(`✅ File complete: ${update.filename}`);
        break;

      case 'file_error':
        console.error(`❌ File error: ${update.filename}`, update.message);
        setChatMessages(prev => prev.map(msg =>
          msg.file?.name === update.filename
            ? {
              ...msg,
              content: `${t("upload.failed")}: ${update.filename}`,
              file: {
                ...msg.file,
                status: 'error',
                errorMessage: update.message
              }
            }
            : msg
        ));
        break;

      case 'all_complete':
        devLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        devLog(`🎉 ALL_COMPLETE RECEIVED`);
        devLog(`   Completed: ${update.completed_files}/${update.total_files}`);

        setIsUploadAnalyzing(false);

        const completeMsgId = uploadMessageIdRef.current;
        if (!completeMsgId) {
          console.warn('⚠️ No uploadMessageId found for completion');
          devLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          return;
        }

        devLog(`   Message ID: ${completeMsgId}`);
        devLog(`   🔍 Accumulator final count: ${uploadInsightsAccumulatorRef.current.length}`);
        devLog(`   🔍 Accumulator final files:`, uploadInsightsAccumulatorRef.current.map(i => i.filename));

        // Mark the loading message as complete AND save to Firebase
        setChatMessages(prev => {
          devLog(`   🔍 Total messages in state: ${prev.length}`);

          return prev.map(msg => {
            if (msg.id === completeMsgId && msg.type === 'upload_loading') {
              devLog(`   ✅ Found upload_loading message to complete`);
              devLog(`   📊 Message insights BEFORE completion:`, msg.insights?.length || 0, 'items');
              devLog(`   📊 Files in message:`, msg.insights?.map(i => i.filename) || []);

              // Create the completed version - PRESERVE ALL FIELDS including original timestamp
              // We keep the original timestamp so LoadingMessageBox stays in correct position
              const completedMsg = {
                ...msg,
                isLoading: false,  // Stop spinner, show checkmark
                insights: msg.insights || [],  // Explicitly preserve
                summary: msg.summary || null,  // Explicitly preserve
                fileCount: msg.fileCount || update.total_files,
                filenames: msg.filenames || []
                // NOTE: Don't update timestamp - preserve original creation time for correct ordering
              };

              devLog(`   📊 Completed message created:`);
              devLog(`      - Insight count: ${completedMsg.insights?.length}`);
              devLog(`      - Files:`, completedMsg.insights?.map(i => i.filename));
              devLog(`      - Has summary: ${!!completedMsg.summary}`);
              devLog(`      - File count: ${completedMsg.fileCount}`);

              // Save to Firebase immediately
              const messageForFirebase = {
                id: completedMsg.id,
                role: completedMsg.role || 'assistant',
                type: 'upload_loading',
                content: 'upload_insights_complete',
                isLoading: false,
                insights: completedMsg.insights || [],
                summary: completedMsg.summary || null,
                fileCount: completedMsg.fileCount || 0,
                filenames: completedMsg.filenames || [],
                language: completedMsg.language || currentLanguage
              };

              devLog('💾 Saving to Firebase with', messageForFirebase.insights?.length, 'insights');

              // Save LoadingMessageBox to Firebase and store the promise
              // This ensures it gets a serverTimestamp BEFORE the post-upload message
              const savePromise = AppendToChat(chatId, messageForFirebase)
                .then(() => devLog('✅ Saved completed insights to Firebase'))
                .catch(err => console.error('❌ Failed to save:', err));

              // Store the promise so post-upload can wait for it
              window._loadingMessageSavePromise = savePromise;

              return completedMsg;
            }
            return msg;
          });
        });

        // Clear refs
        uploadMessageIdRef.current = null;
        uploadInsightsAccumulatorRef.current = [];

        // PlanOnboarding (Q3 prep select) is the source of truth for firing
        // /study/start: it has the user's exam date, hardest topics, and prep
        // status. Pre-firing here would only build a plan from generic prefs
        // that PlanOnboarding immediately aborts and replaces.

        // NOTE: PostUploadActions will be added when 'post_upload_message' event fires from backend
        break;

      case 'error':
        console.error('❌ Batch error:', update.message);
        setIsUploadAnalyzing(false);

        // Show the failure in the loading box instead of leaving it spinning.
        // (upload_files_with_progress also throws after this, but flipping here
        // keeps the UI correct even if the throw is swallowed upstream.)
        const errorMsgId = uploadMessageIdRef.current;
        if (errorMsgId) {
          setChatMessages(prev => prev.map(msg =>
            msg.id === errorMsgId && msg.type === 'upload_loading'
              ? { ...msg, isLoading: false, error: true, errorCode: update.code }
              : msg
          ));
        }
        break;

      // ============================================
      // POST-UPLOAD: FRIENDLY MESSAGE + ACTIONS
      // ============================================
      // This creates a conversational AI message after upload completes.
      // Instead of just showing stats, it guides the user on what to do next.
      //
      // The message includes:
      // - Friendly text acknowledging the upload
      // - Topics found in the documents
      // - Action buttons (Quiz, Flashcards, Study Sheet)
      // ============================================
      case 'post_upload_message':
        devLog('📬 Post-upload message received:', update);

        // Exam Drill entry. Checked BEFORE the study-journey branch because
        // the drill is a different destination entirely: no plan, no
        // onboarding card, straight into being examined on what was just
        // uploaded. First upload is still marked, so the funnel stays intact.
        if (window._pendingDrill) {
          devLog('🎯 Drill mode — routing straight to the examiner');
          window._pendingDrill = false;

          if (currentUser?.uid && !userProfile?.hasCompletedFirstUpload) {
            markFirstUploadComplete(currentUser.uid)
              .then(() => setUserProfile(prev => ({ ...prev, hasCompletedFirstUpload: true })))
              .catch(err => console.error('❌ Failed to mark first upload:', err));
          }

          // Ask for the exam date here, on the upload that created the drill,
          // and hold the redirect until she answers. Holding it is what makes
          // this safe: the navigation is ours to delay, so the question is not
          // racing a redirect she did not trigger.
          //
          // Only when nothing in the app already knows the date — a student who
          // set one on her plan is never asked twice. ExamDrillPage asks the
          // same question as a fallback for drills this path cannot reach.
          const knownExamDate = currentExamData?.examDate || userProfile?.onboarding?.examDate;
          if (!knownExamDate) {
            setPendingDrillDateChatId(chatId);
            break;
          }

          navigate(`/drill/${chatId}`);
          break;
        }

        // Check if user clicked "Study Journey" card - skip post-upload actions and go directly to study mode
        if (window._pendingStudyJourney) {
          devLog('📚 Study Journey mode - skipping post-upload actions, going directly to study mode');
          window._pendingStudyJourney = false;

          // ============================================
          // PLAN ONBOARDING — gates EVERY study-plan upload.
          // Renders the 3-question card BEFORE the study plan generates.
          // Confirm → opens StartStudyModal with merged userPreferences.
          // Skip    → swaps to the standard PostUploadActions menu.
          // ============================================
          devLog('🎯 Study Plan upload — showing PlanOnboarding');

          if (currentUser?.uid && !userProfile?.hasCompletedFirstUpload) {
            markFirstUploadComplete(currentUser.uid)
              .then(() => {
                setUserProfile(prev => ({ ...prev, hasCompletedFirstUpload: true }));
                devLog('✅ First upload marked complete');
              })
              .catch(err => console.error('❌ Failed to mark first upload:', err));
          }

          // Reuse the card created at upload start when there is one: she may
          // be mid-sentence in the exam-description box, and replacing the
          // message would throw that away and restart the flow underneath her.
          const planOnboardMsgId = planOnboardingIdRef.current || `plan-onboarding-${Date.now()}`;
          const planOnboardMsg = {
            id: planOnboardMsgId,
            role: 'assistant',
            type: 'plan_onboarding',
            content: update.message,
            topics: update.topics || [],
            // The extractor's per-topic teaching points. The backend has always
            // sent these on this event; nothing read them until the insights
            // card needed something truthful to say about each topic.
            insights: update.insights || [],
            filenames: update.filenames || [],
            fileCount: update.file_count || (update.filenames || []).length || 0,
            actions: update.actions || [],
            // Her documents are in the session now, so the investigation can
            // read them. This is the flag the intelligence run waits on.
            materialsReady: true,
            timestamp: Date.now()
          };
          planOnboardingIdRef.current = null;

          logFunnelStep(FUNNEL.UPLOAD_COMPLETED, {
            topicsFound: (update.topics || []).length,
            fileCount: update.file_count || (update.filenames || []).length || 0,
          });

          // Idempotent add: if the Firestore listener already inserted this id
          // (race: addDoc cache-write fires onSnapshot before our setState commits),
          // skip the local append so we don't end up with two cards.
          setChatMessages(prev => {
            // Upsert. The early card carries the student's half-typed course
            // context in its own state, so this merges the upload's topics in
            // rather than swapping the element and remounting the form.
            if (prev.some(m => m.id === planOnboardMsgId)) {
              return prev.map(m => (m.id === planOnboardMsgId ? { ...m, ...planOnboardMsg } : m));
            }
            return [...prev, planOnboardMsg];
          });
          AppendToChat(chatId, planOnboardMsg)
            .catch(err => console.error('❌ Failed to save plan onboarding message:', err));

          break;
        }

        // Check if user pre-selected a study action before uploading
        if (pendingStudyActionRef.current) {
          devLog('🎯 Pre-selected action detected:', pendingStudyActionRef.current);
          const actionToTrigger = pendingStudyActionRef.current;
          pendingStudyActionRef.current = null; // Clear ref immediately
          setPendingStudyAction(null); // Clear state too

          // Create the post-upload message with showActions: false (since we're auto-triggering)
          const autoTriggerMsgId = `post-upload-${Date.now()}`;
          const autoTriggerMsg = {
            id: autoTriggerMsgId,
            role: 'assistant',
            type: 'post_upload_actions',
            content: update.message,
            topics: update.topics || [],
            filenames: update.filenames || [],
            actions: update.actions || [],
            showActions: false, // Don't show buttons since we're auto-triggering
            timestamp: Date.now()
          };

          // Add message to chat first
          setChatMessages(prev => [...prev, autoTriggerMsg]);

          // Save to Firebase
          AppendToChat(chatId, {
            ...autoTriggerMsg,
            showActions: false
          }).catch(err => console.error('❌ Failed to save auto-trigger post-upload:', err));

          // Trigger the pre-selected action after a short delay
          setTimeout(() => {
            handlePreSelectedAction(actionToTrigger, autoTriggerMsg);
          }, 200);

          break; // Skip the normal post-upload flow
        }

        // ============================================
        // FIRST UPLOAD "WOW EFFECT"
        // If this is the user's first upload, show a personalized message
        // based on their onboarding choices instead of the 6-button grid.
        // ============================================
        devLog('🔍 Checking for first upload wow effect:', {
          hasUserProfile: !!userProfile,
          hasCompletedFirstUpload: userProfile?.hasCompletedFirstUpload,
          onboarding: userProfile?.onboarding
        });

        if (userProfile && !userProfile.hasCompletedFirstUpload) {
          const { studyGoal, reviewFormat } = userProfile.onboarding || {};
          devLog('🔍 Onboarding values:', { studyGoal, reviewFormat });

          const wowConfig = getWowEffectConfig(studyGoal, reviewFormat);
          devLog('🔍 Wow config result:', wowConfig);

          if (wowConfig) {
            devLog('✨ First upload detected! Showing personalized wow card:', wowConfig);

            // Mark first upload complete in Firebase (fire and forget)
            if (currentUser?.uid) {
              markFirstUploadComplete(currentUser.uid)
                .then(() => {
                  // Update local userProfile to prevent re-triggering on next upload
                  setUserProfile(prev => ({ ...prev, hasCompletedFirstUpload: true }));
                  devLog('✅ First upload marked complete');
                })
                .catch(err => console.error('❌ Failed to mark first upload:', err));
            }

            // Create the wow message with special type
            const wowMsgId = `first-upload-wow-${Date.now()}`;
            const wowMsg = {
              id: wowMsgId,
              role: 'assistant',
              type: 'first_upload_wow', // Special type for wow card
              content: update.message,
              topics: update.topics || [],
              filenames: update.filenames || [],
              studyGoal: studyGoal,
              actionId: wowConfig.actionId,
              timestamp: Date.now()
            };

            setChatMessages(prev => [...prev, wowMsg]);

            // Save to Firebase
            AppendToChat(chatId, wowMsg)
              .catch(err => console.error('❌ Failed to save wow message:', err));

            break; // Skip normal post-upload flow
          }
        }

        // Create a new assistant message with the friendly text + actions
        const postUploadMsgId = `post-upload-${Date.now()}`;
        const postUploadMsg = {
          id: postUploadMsgId,
          role: 'assistant',
          type: 'post_upload_actions',
          content: update.message,
          topics: update.topics || [],
          filenames: update.filenames || [],
          actions: update.actions || [],
          showActions: true,
          timestamp: Date.now()
        };

        // Add to chat messages - prevent duplicates by checking if one with same files already exists
        setChatMessages(prev => {
          // Check if a post_upload_actions message with the SAME filenames already exists
          // This prevents duplicate messages for the same upload batch, but allows
          // multiple uploads to each have their own post-upload message
          const filenamesKey = (update.filenames || []).sort().join('|');
          const alreadyExists = prev.some(msg => {
            if (msg.type !== 'post_upload_actions') return false;
            const msgFilenamesKey = (msg.filenames || []).sort().join('|');
            return msgFilenamesKey === filenamesKey;
          });
          if (alreadyExists) {
            devLog('⚠️ Post-upload message for these files already exists, skipping duplicate');
            return prev;
          }
          return [...prev, postUploadMsg];
        });

        // Save to Firebase AFTER LoadingMessageBox has been saved
        // This ensures correct ordering via serverTimestamp
        const postUploadForFirebase = {
          id: postUploadMsgId,
          role: 'assistant',
          type: 'post_upload_actions',
          content: update.message,
          topics: update.topics || [],
          filenames: update.filenames || [],
          actions: update.actions || [],
          showActions: true
        };

        // Wait for LoadingMessageBox to be saved first, then save post-upload
        const savePostUpload = async () => {
          // Wait for LoadingMessageBox save to complete (if exists)
          if (window._loadingMessageSavePromise) {
            await window._loadingMessageSavePromise;
            window._loadingMessageSavePromise = null;
          }
          // Small delay to ensure serverTimestamp ordering
          await new Promise(resolve => setTimeout(resolve, 100));
          await AppendToChat(chatId, postUploadForFirebase);
          devLog('✅ Post-upload actions saved to Firebase');
        };

        savePostUpload().catch(err => console.error('❌ Failed to save post-upload actions:', err));

        devLog('✅ Post-upload message added to chat');
        break;
    }
  };

  // AI response for batch upload - add this as a new function in your component
  const simulateAiBatchFileResponse = async (files, chatId, totalWords) => {
    if (!files || files.length === 0) return;

    setIsAiTyping(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 800)); // Small delay for realism

      const fileNames = files.map(f => f.name).join(', ');
      const fileCount = files.length;

      let message;
      if (fileCount === 1) {
        message = t('chat.fileReceived');
      } else {
        message = t('chat.filesReceived');
      }

      const aiMessage = {
        role: 'assistant',
        type: 'text',
        timestamp: Date.now(),
        content: message
      };

      setChatMessages(prev => [...prev, aiMessage]);
      await AppendToChat(chatId, aiMessage);

    } catch (error) {
      console.error('Error in AI file response:', error);
    } finally {
      setIsAiTyping(false);
    }
  };
  // ============================================
  // DOCUMENT OPTIONS HANDLING
  // ============================================
  const handlePostDocumentUploadOption = async (option, fileName) => {
    setIsFilesModalVisible(false);
    scrollToBottom();

    const optionHandlers = {
      // "Résumé": handleSummaryStream,
      // "Quiz": handleQuiz,
      // "Mise en situation": handleScenario
    };

    const handler = optionHandlers[option];
    if (handler) {
      await handler(fileName);
    }
  };

  // Update stable-callback refs (declared earlier near other refs)
  handleSendNewUserMessageRef.current = handleSendNewUserMessage;
  handleQuizAnswerSelectRef.current = handleQuizAnswerSelect;
  handlePostDocumentUploadOptionRef.current = handlePostDocumentUploadOption;

  // Stable wrappers — identity never changes, always calls latest implementation
  const stableHandleSendMessage = useCallback((...args) => handleSendNewUserMessageRef.current(...args), []);

  // Retry a failed assistant response: drop the error bubble and re-send the
  // original prompt. hideUserMessage + skipFirebaseSave because the user's
  // message is already in the UI and in Firestore.
  const handleRetryMessage = useCallback((message) => {
    if (!message?.retryText) return;
    setChatMessages(prev => prev.filter(m => m.id !== message.id));
    handleSendNewUserMessageRef.current(null, message.retryText, {
      hideUserMessage: true,
      skipFirebaseSave: true
    });
  }, []);
  const stableHandleQuizAnswerSelect = useCallback((...args) => handleQuizAnswerSelectRef.current(...args), []);
  const stableHandlePostDocumentUploadOption = useCallback((...args) => handlePostDocumentUploadOptionRef.current(...args), []);
  const stableHandleEditMessage = useCallback((...args) => handleEditMessageRef.current(...args), []);

  // ============================================
  // POST-UPLOAD ACTION HANDLER
  // ============================================
  // Called when user clicks an action button after file upload.
  // This sends a message to the AI based on the selected action.
  //
  // ACTIONS:
  // - quiz: Generate a quiz on the uploaded topics
  // - flashcards: Create flashcards for studying
  // - studysheet: Generate a study sheet/summary
  //
  // HOW IT WORKS:
  // 1. Hide the action buttons (so user can't click again)
  // 2. Build a prompt based on the action and topics
  // 3. Send as a user message (triggers normal chat flow)
  // ============================================
  // Record the chosen post-upload chip locally and in Firestore. Replaces the
  // old `showActions: false`, which hid the whole menu and left the student
  // with no record of what they'd clicked.
  const markPostUploadChoice = (messageId, actionId) => {
    setChatMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, selectedAction: actionId } : msg
    ));
    SavePostUploadSelection(currentChatID, messageId, actionId);
  };

  const handlePostUploadAction = async (actionId, messageData) => {
    devLog('🎯 Post-upload action clicked:', actionId, messageData);
    devLog('🎯 Current chatId:', currentChatID);

    // Block action if system is busy (prevents triggering multiple actions simultaneously)
    if (isSystemBusy) {
      devLog('⚠️ System is busy, ignoring post-upload action');
      return;
    }

    // Step 2: Build prompt based on action type
    // Include topics for context so AI knows what to focus on
    const topicsStr = messageData.topics?.length > 0
      ? messageData.topics.join(', ')
      : 'the uploaded material';

    // Quiz action - directly generate knowledge quiz using the document (no modal)
    if (actionId === 'quiz') {
      devLog('🎯 Generating knowledge quiz directly from document');

      // Mark which chip was chosen. The menu stays visible with the rest
      // greyed out, so the history shows what the student picked.
      markPostUploadChoice(messageData.id, actionId);

      // Generate knowledge quiz prompt - backend will use document content by default
      const quizPrompt = t('postUpload.knowledgeQuizPrompt', {
        topics: topicsStr,
        defaultValue: `Quiz me on ${topicsStr} using the content from my document.`
      });

      await handleSendNewUserMessage(null, quizPrompt);
      return;
    }

    // Special handling for study journey - show start study modal
    if (actionId === 'studyjourney') {
      devLog('📚 Opening study journey modal');
      // Get uploaded docs info from the message data
      const docsForStudy = (messageData.filenames || []).map((filename, idx) => ({
        id: `doc-${idx}`,
        name: filename,
        filename: filename
      }));
      setPendingStudyDocs(docsForStudy);
      setShowStartStudyModal(true);
      return;
    }

    // Step 1: Mark the chosen chip. This prevents double-clicks and leaves a
    // visible record of the choice instead of an empty gap.
    markPostUploadChoice(messageData.id, actionId);

    // Special handling for audio - show the AudioConfirmCard
    if (actionId === 'audio') {
      const audioOptionsId = `audio-options-${Date.now()}`;
      setChatMessages(prev => [
        ...prev,
        {
          id: audioOptionsId,
          role: 'assistant',
          type: 'audio_options',
          topic: topicsStr,
          intent: 'teach',
          styleName: 'Full Lesson',
          styleDescription: 'Structured lesson with examples and clinical context',
          durations: ['2min', '5min', '10min'],
          defaultDuration: '5min',
          timestamp: new Date()
        }
      ]);
      return;
    }

    const prompts = {
      checkme: t('postUpload.checkmePrompt', { topics: topicsStr }),
      flashcards: t('postUpload.flashcardsPrompt', { topics: topicsStr }),
      studysheet: t('postUpload.studysheetPrompt'),
      mindmap: t('postUpload.mindmapPrompt', { topics: topicsStr })
    };

    const promptToSend = prompts[actionId];
    devLog('🎯 Prompt to send:', promptToSend);

    if (!promptToSend) {
      console.warn('Unknown action:', actionId);
      return;
    }

    // "Check my understanding" posts a session card instead of the raw
    // instruction. Showing the literal prompt we send the model is the single
    // biggest tell that this is a chatbot being puppeted, so it goes out
    // hidden and the card stands in for it.
    if (actionId === 'checkme') {
      const topicList = messageData.topics || [];
      const cardId = `checkme-${Date.now()}`;
      const card = {
        id: cardId,
        role: 'assistant',
        type: 'checkme_card',
        topics: topicList,
        total: topicList.length,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, card]);
      SaveOrUpdateMessage(currentChatID, card).catch(() => {
        /* card is cosmetic — a failed save must not block the session */
      });
      await handleSendNewUserMessage(null, promptToSend, { hideUserMessage: true });
      return;
    }

    // Step 3: Send as user message (uses existing chat flow)
    // This triggers the normal AI response handling
    // We pass null for the event and the prompt as customPrompt
    devLog('🎯 Calling handleSendNewUserMessage...');
    await handleSendNewUserMessage(null, promptToSend);
    devLog('🎯 handleSendNewUserMessage completed');
  };

  // Handle quiz mode selection from the modal
  const handleQuizModeSelect = async (quizMode) => {
    devLog('🎯 Quiz mode selected:', quizMode);

    if (!pendingQuizMessageData) {
      console.warn('No pending quiz message data');
      return;
    }

    const messageData = pendingQuizMessageData;
    const topicsStr = messageData.topics?.length > 0
      ? messageData.topics.join(', ')
      : 'the uploaded material';

    // Mark the quiz chip as the one that was chosen on the original message
    markPostUploadChoice(messageData.id, 'quiz');

    // Build quiz prompt with mode
    // The backend will parse the quiz mode from the prompt
    let quizPrompt;
    if (quizMode === 'knowledge') {
      quizPrompt = t('postUpload.knowledgeQuizPrompt', {
        topics: topicsStr,
        defaultValue: `Generate a knowledge test quiz about ${topicsStr}. Use direct factual questions, not clinical scenarios.`
      });
    } else {
      quizPrompt = t('postUpload.nclexQuizPrompt', {
        topics: topicsStr,
        defaultValue: `Generate an NCLEX-style quiz about ${topicsStr}. Use clinical scenarios testing judgment.`
      });
    }

    devLog('🎯 Quiz prompt with mode:', quizPrompt);

    // Clear pending data
    setPendingQuizMessageData(null);
    setShowQuizModeSelector(false);

    // Send the quiz prompt
    await handleSendNewUserMessage(null, quizPrompt);
  };

  // ============================================
  // HANDLE PRE-SELECTED ACTION
  // When user picks an action BEFORE uploading, this triggers it automatically
  // Key difference: Quiz skips the mode selector and uses default (nclex)
  // ============================================
  const handlePreSelectedAction = async (actionId, messageData) => {
    devLog('🎯 Executing pre-selected action:', actionId);

    const topicsStr = messageData.topics?.length > 0
      ? messageData.topics.join(', ')
      : 'the uploaded material';

    // For quiz: auto-generate with default NCLEX mode (skip modal)
    if (actionId === 'quiz') {
      const quizPrompt = t('postUpload.nclexQuizPrompt', {
        topics: topicsStr,
        defaultValue: `Generate an NCLEX-style quiz about ${topicsStr}. Use clinical scenarios testing judgment.`
      });
      devLog('🎯 Auto-triggering quiz with NCLEX mode');
      await handleSendNewUserMessage(null, quizPrompt);
      return;
    }

    // For audio: show the AudioConfirmCard (user still picks duration)
    if (actionId === 'audio') {
      const audioOptionsId = `audio-options-${Date.now()}`;
      setChatMessages(prev => [
        ...prev,
        {
          id: audioOptionsId,
          role: 'assistant',
          type: 'audio_options',
          topic: topicsStr,
          intent: 'teach',
          styleName: 'Full Lesson',
          styleDescription: 'Structured lesson with examples and clinical context',
          durations: ['2min', '5min', '10min'],
          defaultDuration: '5min',
          timestamp: new Date()
        }
      ]);
      return;
    }

    // For study journey: open the study modal
    if (actionId === 'studyjourney') {
      const docsForStudy = (messageData.filenames || []).map((filename, idx) => ({
        id: `doc-${idx}`,
        name: filename,
        filename: filename
      }));
      setPendingStudyDocs(docsForStudy);
      setShowStartStudyModal(true);
      return;
    }

    // For checkme, flashcards, studysheet, mindmap: send the prompt directly
    const prompts = {
      checkme: t('postUpload.checkmePrompt', { topics: topicsStr }),
      flashcards: t('postUpload.flashcardsPrompt', { topics: topicsStr }),
      studysheet: t('postUpload.studysheetPrompt'),
      mindmap: t('postUpload.mindmapPrompt', { topics: topicsStr })
    };

    const promptToSend = prompts[actionId];
    if (promptToSend) {
      devLog('🎯 Auto-triggering action:', actionId, 'with prompt:', promptToSend);
      await handleSendNewUserMessage(null, promptToSend);
    }
  };

  // Stable ref for handlePreSelectedAction (avoids re-registering event listener every render)
  const handlePreSelectedActionRef = useRef(handlePreSelectedAction);
  handlePreSelectedActionRef.current = handlePreSelectedAction;

  // ============================================
  // PLAN ONBOARDING — confirm handler
  // ============================================
  // Swaps the `plan_onboarding` chat message in-place to a `post_upload_actions`
  // message and opens StartStudyModal with the merged userPreferences. Keeping
  // the chat history coherent matters: when the user comes back later they see
  // the action menu rather than a stale onboarding card.
  //
  // The in-flight /study/start cache is intentionally kept here (pre-fired on
  // Q3) so StartStudyModal can consume the resolved promise on autoStart.

  const swapPlanOnboardingForActions = (planOnboardingMsg) => {
    const actionsMsg = {
      id: planOnboardingMsg.id, // reuse id so we update in place rather than appending
      role: 'assistant',
      type: 'post_upload_actions',
      content: planOnboardingMsg.content,
      topics: planOnboardingMsg.topics || [],
      filenames: planOnboardingMsg.filenames || [],
      actions: planOnboardingMsg.actions || [],
      showActions: true,
      timestamp: planOnboardingMsg.timestamp || Date.now()
    };
    setChatMessages(prev => prev.map(m => (m.id === planOnboardingMsg.id ? actionsMsg : m)));
    // Persist the new shape so the next session reload sees the menu, not the
    // stale onboarding card. AppendToChat upserts on id, matching how
    // post_upload_actions are saved elsewhere.
    AppendToChat(currentChatID, actionsMsg)
      .catch(err => console.error('❌ Failed to persist post-upload actions after plan onboarding:', err));
  };

  /**
   * Persist the course context the moment she submits it, not at confirm.
   *
   * The investigation that follows takes tens of seconds and she may close the
   * tab during it. Saving now means a reload resumes with her answers instead
   * of asking again, and it is also the only copy: the card that holds them
   * lives in local state until the upload completes.
   */
  const handleCourseContext = useCallback((context) => {
    setPendingCourseContext(context || null);
    if (!currentChatID || !context) return;
    updateDoc(doc(db, "chats", currentChatID), {
      courseContext: context,
      updatedAt: serverTimestamp(),
    }).catch(err => console.error('Failed to persist course context:', err));
  }, [currentChatID]);

  const handlePlanOnboardingConfirm = (planOnboardingMsg, userPreferences, diagnostic, rankedTopics = [], extras = {}) => {
    if (!planOnboardingMsg) return;
    devLog('✅ PlanOnboarding confirm — straight to the plan', diagnostic);

    // Carried so a quota-blocked student's locked preview lists her topics in
    // the order the insights card already showed her, rather than re-deriving
    // a second (possibly different) ranking downstream.
    setPendingRankedTopics(rankedTopics || []);

    // Persist the user's exam-prep answers (test date + hardest topics)
    // onto the chat document so downstream UI — readiness countdown,
    // chat-landing exam context, future restorations — can pick them up
    // without re-asking. Without this, these answers only flowed to the
    // plan-generation API call and were lost as soon as the user
    // refreshed.
    const examDateRaw = userPreferences?.examDate;
    const examDateValue = examDateRaw
      ? (examDateRaw instanceof Date ? examDateRaw : new Date(examDateRaw))
      : null;
    const hardestTopics = Array.isArray(userPreferences?.hardestTopics)
      ? userPreferences.hardestTopics.filter(Boolean)
      : [];

    if (currentChatID) {
      const chatUpdates = { updatedAt: serverTimestamp() };
      if (examDateValue && !Number.isNaN(examDateValue.getTime())) {
        chatUpdates.examDate = examDateValue;
      }
      if (hardestTopics.length > 0) {
        chatUpdates.hardestTopics = hardestTopics;
      }
      // Skip the write if there's nothing new to save (only updatedAt).
      if (Object.keys(chatUpdates).length > 1) {
        updateDoc(doc(db, "chats", currentChatID), chatUpdates).catch((err) => {
          console.error('Failed to persist exam-prep prefs to chat doc:', err);
        });
      }
    }

    // ── Also onto the USER document ──────────────────────────────────────
    // The chat doc is the right home for a plan's own countdown, but it is
    // the wrong scope for the paywall: UpgradeModal reads the exam date from
    // `userProfile.onboarding.examDate` (see UsageContext.js:56), and until
    // now NOTHING ever wrote that field from this flow.
    //
    // The consequence was that every exam-urgency string in the product —
    // upgrade.bodyExam ("Your exam is {{when}} — don't let a question limit
    // slow your final push"), bodyBlockedExam, bodyPlanReadyExam — was
    // written, translated, and unreachable. The modal always fell through to
    // the generic copy, for every student, however close her exam was.
    //
    // One write makes all of them live. Fire-and-forget: a failed analytics-
    // grade write must never interrupt the plan she is waiting for.
    if (currentUser?.uid && examDateValue && !Number.isNaN(examDateValue.getTime())) {
      const examIso = examDateValue.toISOString();
      updateUserProfile(currentUser.uid, { 'onboarding.examDate': examIso })
        .then(() => {
          // Mirror locally so the countdown is right on THIS session too.
          // userProfile is only refetched on load, and the paywall she may see
          // within the next five minutes reads from this object — which is the
          // entire point: the plan gate can fire moments from here.
          setUserProfile(prev => (prev
            ? { ...prev, onboarding: { ...(prev.onboarding || {}), examDate: examIso } }
            : prev));
        })
        .catch(err => console.error('Failed to persist exam date to user doc:', err));
    }

    // Surface the exam date + hardest topics to the rest of the UI
    // immediately so the readiness countdown and downstream consumers
    // (e.g. the focused-review CTA) light up without waiting for a
    // chat reload.
    const hasFreshExamData =
      (examDateValue && !Number.isNaN(examDateValue.getTime())) ||
      hardestTopics.length > 0;
    if (hasFreshExamData) {
      setCurrentExamData(prev => ({
        examId: prev?.examId || null,
        examName: prev?.examName || null,
        examDate:
          examDateValue && !Number.isNaN(examDateValue.getTime())
            ? examDateValue
            : prev?.examDate || null,
        hardestTopics:
          hardestTopics.length > 0 ? hardestTopics : prev?.hardestTopics || [],
      }));
    }

    // Swap the card to the action menu first so the chat history stays coherent
    // even if the user backs out of the modal.
    swapPlanOnboardingForActions(planOnboardingMsg);

    // Open StartStudyModal in autoStart mode; it calls start_study_journey.
    const docsForStudy = (planOnboardingMsg.filenames || []).map((filename, idx) => ({
      id: `doc-${idx}`,
      name: filename,
      filename: filename
    }));
    setPendingStudyDocs(docsForStudy);
    setPendingStudyTopics(planOnboardingMsg.topics || []);
    setPendingStudyUserPreferences(userPreferences || userProfile?.onboarding || {});

    // The course brief or fallback check has already collected first-attempt
    // answers. Null means skipped: the planner retains the course order.
    setStudyDiagnostic(diagnostic || null);

    // The investigation's own payload, handed to /study/start. It is what
    // orders the plan: without it the backend falls back to the arbitrary
    // set() ordering of her upload's topics, which is the order of her slide
    // deck. Null is a supported input and reproduces the old behaviour.
    setPendingCourseIntelligence(extras.courseIntelligence || null);
    if (extras.courseContext) setPendingCourseContext(extras.courseContext);

    // Persist the report beside the chat so a returning student's plan surface
    // can explain itself without re-running three web searches.
    if (currentChatID && extras.courseIntelligence) {
      updateDoc(doc(db, "chats", currentChatID), {
        courseIntelligence: extras.courseIntelligence,
        courseContext: extras.courseContext || pendingCourseContext || null,
        studyDiagnostic: diagnostic || null,
        focusSource: userPreferences?.focusSource || 'course',
        updatedAt: serverTimestamp(),
      }).catch(err => console.error('Failed to persist course intelligence:', err));
    }

    setShowStartStudyModal(true);
  };

  // ============================================
  // QUICK START (ONBOARDING PIPELINE)
  // Listen for the custom event from OnboardingModal and trigger the appropriate Study Session
  // ============================================
  useEffect(() => {
    const handleQuickStart = (e) => {
      const { formData } = e.detail || {};
      if (!formData) return;

      const { reviewFormat, userStage, studyGoal } = formData;
      devLog('Quick Start Session triggered with format:', reviewFormat, 'Goal:', studyGoal);

      const wowConfig = getWowEffectConfig(studyGoal, reviewFormat);
      if (wowConfig) {
        devLog('Triggering Quick Start action:', wowConfig.actionId);

        const topic = userStage === 'NCLEX Prep'
          ? 'NCLEX Preparation'
          : 'Nursing fundamentals';

        const dummyMessage = {
          id: `quickstart-${Date.now()}`,
          topics: [topic],
          filenames: []
        };

        setTimeout(() => {
          handlePreSelectedActionRef.current(wowConfig.actionId, dummyMessage);
        }, 500);
      }
    };

    window.addEventListener('onQuickStartSession', handleQuickStart);
    return () => window.removeEventListener('onQuickStartSession', handleQuickStart);
  }, []);


  // --- Updated handleSummary function using streaming logic ---
  const handleSummaryStream = async (fileName) => {
    // Set loading state for the specific summary action
    setLoadingState('summary', true);

    // 1. Prepare for streaming
    const streamingMessageId = `summary-${Date.now()}`;
    let fullResponse = "";

    const placeholderMessage = {
      id: streamingMessageId,
      role: 'assistant',
      // Show an initial message before content starts streaming
      content: `Génération d'un résumé pour ${fileName}...`,
      isStreaming: true,
      timestamp: new Date()
    };

    // Add placeholder message to chat to start the stream display
    setChatMessages(prev => [...prev, placeholderMessage]);

    try {
      // 2. Call the new streaming function
      await stream_summary(
        currentChatID,
        fileName,
        currentLanguage,

        // onTokenReceived (Chunk callback)
        (chunk, accumulatedText) => {
          // Update the state with the accumulating streaming content
          fullResponse = accumulatedText;
          setChatMessages(prev =>
            prev.map(msg =>
              msg.id === streamingMessageId
                ? { ...msg, content: fullResponse, isStreaming: true }
                : msg
            )
          );
        },

        // onStreamEnd (Complete callback)
        async (finalContent) => {
          if (finalContent.startsWith("Error:")) {
            // Handle API errors or connection issues by displaying the error message
            const errorMessage = {
              id: streamingMessageId,
              role: "assistant",
              content: finalContent,
              error: true,
              isStreaming: false,
              timestamp: new Date()
            };

            setChatMessages(prev =>
              prev.map(msg => msg.id === streamingMessageId ? errorMessage : msg)
            );
          } else {
            // Create the final message object with the complete streamed text
            const finalMessage = {
              id: uuidv4(),
              role: "assistant",
              // The entire formatted summary is now in the content field
              content: finalContent,
              // It is no longer a structured summary object (summaryData, type)
              timestamp: new Date(),
              isStreaming: false
            };

            // Update the placeholder with the final message and save it to Firebase
            setChatMessages(prev =>
              prev.map(msg => msg.id === streamingMessageId ? finalMessage : msg)
            );
            await AppendToChat(currentChatID, finalMessage);
          }
          // Stop loading state regardless of success/failure
          setLoadingState('summary', false);
        }
      );

    } catch (error) {
      console.error("Summary streaming error:", error);

      // Handle critical error that occurred outside the stream reader
      const errorMessage = {
        id: streamingMessageId,
        role: "assistant",
        content: "Une erreur critique est survenue lors du lancement de la génération du résumé.",
        error: true,
        isStreaming: false,
        timestamp: new Date()
      };

      setChatMessages(prev =>
        prev.map(msg => msg.id === streamingMessageId ? errorMessage : msg)
      );

      setLoadingState('summary', false);
    }
  };

  const handleScenario = async (fileName) => {

    setLoadingState('scenario', true);

    try {
      const scenarioResult = await generate_scenario(currentChatID, fileName);

      const newMessage = {
        id: uuidv4(),
        role: "assistant",
        type: "scenario",
        content: currentLanguage === 'fr' ? "Voici votre mise en situation" : "Here's your scenario",
        scenarioData: scenarioResult.scenario,
        file: { name: fileName },
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, newMessage]);

      const updatedChatId = await AppendToChat(currentChatID, newMessage);
      if (updatedChatId) {
        setChatId(updatedChatId);
      }
    } catch (error) {
      console.error("Error generating scenario:", error);
    } finally {
      setLoadingState('scenario', false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  // ============================================
  // ANSWER RATING (thumbs on AI messages)
  // ============================================
  // MessageRating already persisted the signal and the message mirror; this
  // only keeps the in-memory transcript honest, so a re-render doesn't show an
  // unrated answer the student just rated.
  const handleMessageRated = useCallback((messageId, rating) => {
    setChatMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, rating: { ...rating, ratedAt: new Date() } }
          : msg
      )
    );
  }, []);

  // ============================================
  // QUIZ AUTO-EXTENSION
  // ============================================
  // Quizzes are generated as one parallel burst, so asking for 15 up front pays
  // for 15 immediately — and most students never reach the end of them. They
  // now arrive short and grow here as the student advances.
  const handleQuizExtended = useCallback(async (messageId, newQuestions) => {
    if (!messageId || !Array.isArray(newQuestions) || newQuestions.length === 0) return;

    let merged = null;
    setChatMessages(prev =>
      prev.map(msg => {
        if (msg.id !== messageId) return msg;
        const existing = Array.isArray(msg.quizData) ? msg.quizData : [];
        merged = [...existing, ...newQuestions];
        return { ...msg, quizData: merged, expectedTotal: merged.length };
      })
    );

    if (!merged) return;
    try {
      // Persist so a reload doesn't drop the questions back to the first batch
      // and re-generate them.
      await AppendQuizQuestions(currentChatID, messageId, merged);
    } catch (error) {
      // The student already has the questions on screen; losing the write
      // costs a re-fetch later, not their place in the quiz.
      devLog("Failed to persist extended quiz (non-fatal):", error?.message);
    }
  }, [currentChatID]);

  // ============================================
  // MESSAGE DELETION HANDLING (DEV MODE)
  // ============================================
  const handleDeleteMessage = useCallback(async (messageId) => {
    // Check if in development mode
    const isDevelopment = process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost';

    if (!isDevelopment) {
      console.warn("Delete message is only available in development mode");
      return;
    }

    // Confirm deletion
    if (!window.confirm("Delete this message? This action cannot be undone.")) {
      return;
    }

    try {
      devLog("🗑️ Deleting message:", messageId);

      // Delete from Firebase
      await DeleteMessage(currentChatID, messageId);

      // Update local state to remove the message
      setChatMessages(prev => prev.filter(msg => msg.id !== messageId));

      devLog("✅ Message deleted successfully");
    } catch (error) {
      console.error("❌ Failed to delete message:", error);
      alert("Failed to delete message: " + error.message);
    }
  }, [currentChatID]);

  // ============================================
  // MESSAGE EDIT HANDLING
  // Trims history to the edited message, deletes subsequent messages from
  // Firebase, updates the edited message, then re-runs the AI response.
  // ============================================
  const handleEditMessage = async (messageId, newContent) => {
    if (isStreaming || isAiTyping) return;

    const msgIndex = chatMessages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const editedMessage = { ...chatMessages[msgIndex], content: newContent };
    const trimmedMessages = [
      ...chatMessages.slice(0, msgIndex),
      editedMessage
    ];

    // Optimistic UI: show trimmed history with updated content immediately
    setChatMessages(trimmedMessages);

    // Delete all messages that came after the edited one from Firebase.
    // We also stage their IDs in recentlyDeletedIdsRef so that the Firestore
    // snapshot listener won't re-introduce them before the delete propagates.
    const messagesAfter = chatMessages.slice(msgIndex + 1);
    messagesAfter.forEach(m => {
      if (!m.id) return;
      // Always block these IDs from coming back via the snapshot listener
      recentlyDeletedIdsRef.current.add(m.id);
      // Only persisted messages need a Firestore delete call
      const isLocalOnly = m.isStreaming ||
        m.id.startsWith('streaming-') ||
        m.id.startsWith('empathetic-') ||
        m.id.startsWith('quiz-');
      if (!isLocalOnly) {
        DeleteMessage(currentChatID, m.id).catch(err =>
          devLog('Failed to delete message after edit:', err)
        );
      }
    });

    // Persist the updated content — preserves the original timestamp so the
    // message stays at its original position in chat history
    UpdateMessageContent(currentChatID, messageId, newContent)
      .catch(err => devLog('Failed to persist edited message:', err));

    // Re-generate the AI response using the trimmed history
    await handleSendNewUserMessage(null, newContent, {
      hideUserMessage: true,
      skipFirebaseSave: true,
      historyOverride: trimmedMessages
    });
  };

  // Keep ref in sync — must be after the function definition (const TDZ)
  handleEditMessageRef.current = handleEditMessage;

  const hasMessages = chatMessages.length > 0;
  devLog('🎮 Render state:', { isGameChat, hasMessages, messageCount: chatMessages.length, gameState });
  const openFileUploadDialog = () => {
    // Free plan: one upload per chat — pitch Pro instead of opening the picker.
    if (!isPro && uploadedFilesListRef.current.length > 0) {
      // trigger is what separates this HARD BLOCK from a voluntary badge
      // tap in the funnel data — both used to arrive as openUpgrade(null).
      openUpgrade(null, { topic: currentChatTitleRef.current, trigger: 'upload_gate' });
      return;
    }
    documentFileInputRef.current?.click();
  };

  // Handle pasted notes submission - converts text to a file and triggers the upload flow
  const handlePasteNotesSubmit = () => {
    const text = pastedNotesText.trim();
    if (!text) return;

    // Create a text file from the pasted content
    const blob = new Blob([text], { type: 'text/plain' });
    const file = new File([blob], 'pasted-notes.txt', { type: 'text/plain' });

    // Call handleFileSelect directly with a synthetic event.
    // Avoids DataTransfer constructor which is unsupported on iOS Safari.
    window._pendingStudyJourney = true;
    handleFileSelect({
      target: { files: [file], value: '' }
    });

    // Close modal and reset
    setShowPasteNotesModal(false);
    setPastedNotesText('');
  };

  // ============================================
  // VOICE INPUT HANDLERS
  // ============================================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Try webm first, fallback to mp4 for Safari
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        try {
          const result = await speech_to_text(audioBlob);
          if (result.success && result.text) {
            setUserInputText(prev => prev ? `${prev} ${result.text}` : result.text);
          }
        } catch (error) {
          console.error('Transcription failed:', error);
        }

        setIsTranscribing(false);
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access denied:', error);
      alert('Microphone access is required for voice input');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Handle exam prep submission - creates exam and linked chat
  const handleExamPrepSubmit = async ({ examName, examDate }) => {
    if (!auth.currentUser) return;

    setIsCreatingExamChat(true);

    try {
      // 1. Create the exam in user's exams subcollection
      const { createExam } = await import('../../Services/ExamService');
      const newExam = await createExam(auth.currentUser.uid, {
        name: examName,
        date: examDate,
        subject: examName
      });

      // 2. Create a chat linked to this exam
      const chatTitle = `${examName} Prep`;
      const newChat = {
        userId: auth.currentUser.uid,
        title: chatTitle,
        description: `Exam prep for ${examName}`,
        examId: newExam.id,
        examName: examName,
        examDate: examDate,
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "chats"), newChat);

      // 3. Set exam data immediately (no async fetch needed)
      setCurrentExamData({
        examId: newExam.id,
        examName: examName,
        examDate: examDate
      });

      // 4. Close modal and navigate to the new chat
      setShowExamPrepModal(false);

      // 5. Select the new chat
      if (onChatSelected) {
        onChatSelected(docRef.id);
      }

      devLog('📚 Created exam prep chat:', docRef.id, 'for exam:', newExam.id);

    } catch (error) {
      console.error('Error creating exam prep chat:', error);
    } finally {
      setIsCreatingExamChat(false);
    }
  };

  // Dev-only: export the current conversation as JSON so it can be
  // pasted into Claude later for analysis.
  const handleExportConversation = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'NurseQuizAI',
      env: process.env.NODE_ENV,
      userId: auth.currentUser?.uid || null,
      userEmail: auth.currentUser?.email || null,
      chat: {
        id: currentChatID,
        title: currentChatTitle,
        examData: currentExamData || null,
      },
      messageCount: chatMessages.length,
      messages: chatMessages,
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeTitle = (currentChatTitle || 'conversation')
      .replace(/[^a-z0-9-_]+/gi, '_')
      .slice(0, 60);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `convo_${safeTitle}_${currentChatID || 'nochat'}_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================
  // PRE-UPLOAD ACTION HELPERS
  // Icons and labels for the pre-upload study option buttons
  // ============================================
  const getPreUploadIcon = (actionId) => {
    switch (actionId) {
      case 'quiz':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 10L10 12L16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'flashcards':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="6" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
      case 'audio':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4V20M8 8V16M4 11V13M16 6V18M20 9V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'studysheet':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M14 2v6h6M8 13h8M8 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'mindmap':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="9" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="18" y="2" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="18" y="16" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6 12H12" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 5V19" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 5H18" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 19H18" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const getPreUploadLabel = (actionId) => {
    const labels = {
      quiz: t('postUpload.quizLabel', 'Quiz me'),
      flashcards: t('postUpload.flashcardsLabel', 'Create flashcards'),
      studysheet: t('postUpload.studysheetLabel', 'Study sheet'),
      audio: t('postUpload.audioLabel', 'Audio summary'),
      mindmap: t('postUpload.mindmapLabel', 'Concept map')
    };
    return labels[actionId] || actionId;
  };

  // Pre-compute last user message ID (avoids O(n^2) in render loop)
  const lastUserMessageId = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].role === 'user') return chatMessages[i].id;
    }
    return null;
  }, [chatMessages]);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <ProgressDashboard />

      {/* Welcome-back Toast — shows when user returns after 30s+ away.
          Rendered at top level so it's visible in both regular chat and study mode. */}
      {welcomeBack && (
        <WelcomeBackToast
          message={welcomeBack.message}
          accent={welcomeBack.accent}
          belowStudyHeader={isStudyMode}
          onDismiss={() => setWelcomeBack(null)}
        />
      )}

      {/* Study Mode - Full screen overlay when active.
          studyState.chatId match ensures we never mount with a mismatched chat
          (e.g. mid-switch, when studyState belongs to the previous chat). */}
      {isStudyMode && studyState && studyState.chatId === currentChatID && (
        <Suspense fallback={<StudyModeFallback />}>
        <StudyModeContainer
          key={currentChatID}
          chatId={currentChatID}
          studyState={studyState}
          examDate={currentExamData?.examDate || null}
          examName={currentExamData?.examName || null}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={onCloseSidebar}
          viewOnly={viewAllChatsMode} // Dev mode: view without triggering reviews
          autoStart={studyAutoStart}
          onExit={() => {
            setStudyAutoStart(false);
            // Study sessions should always stay as study sessions
            // Exit means navigate away from this chat entirely
            devLog('📚 Exiting study session - navigating to dashboard');
            if (onChatSelected) {
              onChatSelected(null); // Clear selection, will navigate to /c or dashboard
            }
          }}
          onComplete={() => {
            // Study session completed - navigate away
            devLog('📚 Study session completed - navigating to dashboard');
            if (onChatSelected) {
              onChatSelected(null);
            }
          }}
          language={i18n?.language || 'en'}
        />
        </Suspense>
      )}

      {/* Regular Chat Interface - Hidden when in study mode */}
      <div
        className="chat-container"
        style={{ display: isStudyMode ? 'none' : undefined }}
      >
        {/* File Error Toast */}
        {fileErrorToast && (
          <div className="file-error-toast">
            <div className="file-error-toast-content">
              <span className="file-error-toast-icon">⚠️</span>
              <span className="file-error-toast-message">{fileErrorToast}</span>
              <button
                className="file-error-toast-close"
                onClick={() => setFileErrorToast(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Nursing Background Icons */}
        <div className="nursing-icon">💊</div>
        <div className="nursing-icon">🩺</div>
        <div className="nursing-icon">💉</div>
        <div className="nursing-icon">💗</div>
        <div className="nursing-icon">🏥</div>
        <div className="nursing-icon">⚕️</div>
        <div className="nursing-icon">🩹</div>
        <div className="nursing-icon">💝</div>
        <div className="nursing-icon">🌡️</div>
        <div className="nursing-icon">💕</div>
        <div className="nursing-icon">🧬</div>
        <div className="nursing-icon">💜</div>

        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-row">
            <h2 className="chat-header-title" onClick={() => setIsFilesModalVisible(true)}>
              {currentChatTitle}
            </h2>
            {process.env.NODE_ENV === 'development' && currentChatID && (
              <button
                type="button"
                className="chat-export-btn"
                title="DEV: Export conversation as JSON"
                onClick={handleExportConversation}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export JSON</span>
              </button>
            )}
            {/* Progress Widget - Next to title */}
            {/* <CompactProgressWidget /> */}
          </div>
        </div>

        {/* 🎯 STICKY QUIZ PROGRESS BAR - ADD THIS */}
        {activeQuizProgress && activeQuizProgress.isVisible && (
          <StickyQuizProgress
            answeredCount={activeQuizProgress.answeredCount}
            totalQuestions={activeQuizProgress.totalQuestions}
            correctCount={activeQuizProgress.correctCount}
            incorrectCount={activeQuizProgress.incorrectCount}
            currentStreak={activeQuizProgress.currentStreak}
            longestStreak={activeQuizProgress.longestStreak}
            isVisible={activeQuizProgress.isVisible}
            lastAnswerWasCorrect={activeQuizProgress.lastAnswerWasCorrect}
          />
        )}


        {/* Empty State - Exam-linked chat: show upload only with exam context.
            Gated on examName so chats that captured only an examDate via
            PlanOnboarding (no exam entity) don't render an empty title. */}
        {!hasMessages && isChatDataLoaded && !isGameChat && currentExamData?.examName && (
          <div className="empty-chat-state exam-linked">
            <div className="exam-context-header">
              <h3 className="exam-context-title">{currentExamData.examName}</h3>
              {currentExamData.examDate && <ExamCountdown examDate={currentExamData.examDate} />}
            </div>
            <div className="exam-upload-card">
              <p className="exam-upload-subtitle">
                {t('chat.examPrepLead', "Dépose tes notes, on prépare ton plan d'étude pour l'examen.")}
              </p>
              <div className="exam-upload-buttons">
                <button className="exam-start-btn" onClick={openFileUploadDialog}>
                  <span className="exam-start-icon">📤</span>
                  <span className="exam-start-text">
                    {t('chat.examUploadCta', 'Importer tes fichiers')}
                  </span>
                  <span className="exam-start-arrow">→</span>
                </button>
                <button className="exam-start-btn exam-paste-btn" onClick={() => setShowPasteNotesModal(true)}>
                  <span className="exam-start-icon">📋</span>
                  <span className="exam-start-text">
                    {t('chat.examPasteCta', 'Coller tes notes')}
                  </span>
                  <span className="exam-start-arrow">→</span>
                </button>
              </div>
              <p className="exam-upload-hint">
                {t('chat.examUploadHint', 'PDF, images, notes — nous générons quiz, fiches et flashcards.')}
              </p>
            </div>
          </div>
        )}

        {/* Empty State - Regular chat: single focused CTA.
            Treats "examDate only" chats (PlanOnboarding-style) as regular
            chats here — they don't have an exam entity to feature in the
            landing card. The countdown still surfaces inside StudyMode. */}
        {!hasMessages && isChatDataLoaded && !isGameChat && !currentExamData?.examName && (
          <div className="empty-chat-state empty-chat-state--paths">
            {/* ── Two doors, shown as peers ──────────────────────────────
                The plan is for a student who wants to be TAUGHT; the drill
                is for one who wants to be TESTED. They used to be stacked —
                a card for the plan, then a tagline and a quiet outlined
                button underneath — which reads as a primary action with an
                afterthought below it. In the production data the tested path
                is what every paying user actually did (7x the exams, almost
                none of the lessons), so it is not an afterthought and should
                not be drawn as one.

                Both doors still go through an upload: neither is worth
                anything until the questions come from HER material. */}
            {!examPrepExpanded ? (
              <div className="path-choice">
                <h2 className="path-choice__title">
                  {t('chat.pathTitle', 'What do you want to focus on today?')}
                </h2>
                <p className="path-choice__sub">
                  {t('chat.pathSub', "Choose your path. We'll meet you where you are.")}
                </p>

                <div className="path-choice__cards">
                  <article className="path-card path-card--plan">
                    <div className="path-card__icon">
                      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M32 12L6 26L32 40L58 26L32 12Z" fill="currentColor" opacity="0.85" />
                        <path d="M16 32V46C16 46 24 52 32 52C40 52 48 46 48 46V32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M52 28V44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="52" cy="47" r="3" fill="currentColor" />
                      </svg>
                    </div>
                    <h3 className="path-card__title">
                      {t('chat.planCardTitle', 'Follow your study plan')}
                    </h3>
                    <p className="path-card__desc">
                      {t('chat.planCardDesc', 'A personalized, step-by-step plan built from your notes to help you master the material.')}
                    </p>
                    <button
                      className="path-card__cta"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExamPrepExpanded(true);
                      }}
                    >
                      {t('chat.prepareForExam', 'Study for exam')}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                    </button>
                    <p className="path-card__note">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                           strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                        <path d="M4 5a2 2 0 0 1 2-2h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z" />
                        <line x1="8" y1="7" x2="15" y2="7" />
                        <line x1="8" y1="11" x2="15" y2="11" />
                      </svg>
                      {t('chat.planCardNote', 'Best for building knowledge and long-term retention')}
                    </p>
                  </article>

                  <article className="path-card path-card--drill">
                    <div className="path-card__icon">
                      <DrillTargetIcon aria-hidden="true" />
                    </div>
                    <h3 className="path-card__title">
                      {t('chat.drillCardTitle', 'Find my weak spots')}
                      <span className="path-card__new">{t('chat.newBadge', 'New')}</span>
                    </h3>
                    <p className="path-card__desc">
                      {t('chat.drillCardDesc', 'Get challenged with difficult questions from your notes and see what you need to work on.')}
                    </p>
                    <button
                      className="path-card__cta"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window._pendingDrill = true;
                        documentFileInputRef.current?.click();
                      }}
                    >
                      {t('chat.drillCardCta', 'Test my exam readiness')}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                    </button>
                    <p className="path-card__note">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                           strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                        <polygon points="13 2 4 14 11 14 10 22 19 10 12 10 13 2" />
                      </svg>
                      {t('chat.drillCardNote', 'Best for quick assessment and exam readiness')}
                    </p>
                  </article>
                </div>
              </div>
            ) : (
              /* Expanded: the plan door asks HOW the notes arrive. Unchanged
                 behaviour — only its place in the tree moved. */
              <div className="empty-chat-single-cta">
                <div className="empty-cta-card">
                  <p className="empty-cta-prompt">
                    {t('chat.howToAddNotes', 'How would you like to add your notes?')}
                  </p>
                  <div className="empty-cta-buttons-row empty-cta-buttons-row--compact">
                    <button className="empty-cta-button empty-cta-button--compact" onClick={(e) => {
                      e.stopPropagation();
                      documentFileInputRef.current?.click();
                      window._pendingStudyJourney = true;
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      {t('chat.uploadNotes', 'Upload notes')}
                    </button>
                    <button className="empty-cta-button empty-cta-button--compact paste-notes-btn" onClick={(e) => {
                      e.stopPropagation();
                      setShowPasteNotesModal(true);
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      </svg>
                      {t('chat.pasteNotes', 'Paste notes')}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="empty-cta-back"
                    onClick={(e) => { e.stopPropagation(); setExamPrepExpanded(false); }}
                  >
                    ← {t('chat.back', 'Back')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Exam Prep Modal */}
        {/* ── The exam date, asked on a drill upload ─────────────────────
            Rendered over the chat rather than as a step inside it: the
            student pressed "Drill me on my notes" and is on her way to the
            examiner, so this is the last thing between her and it, not a new
            place to be. Answering or skipping completes the handover. */}
        {pendingDrillDateChatId && (
          <div className="drill-date-overlay">
            <DrillExamDate
              language={i18n.language}
              onSubmit={(key, customDate) => {
                const chosen = saveExamDate({
                  chatId: pendingDrillDateChatId,
                  uid: currentUser?.uid,
                  key,
                  customDate,
                });
                // Light the countdown up now rather than after a reload — the
                // resume card reads this the moment she comes back out.
                if (chosen) {
                  setCurrentExamData(prev => ({
                    examId: prev?.examId || null,
                    examName: prev?.examName || null,
                    examDate: chosen,
                    hardestTopics: prev?.hardestTopics || [],
                  }));
                }
                const target = pendingDrillDateChatId;
                setPendingDrillDateChatId(null);
                navigate(`/drill/${target}`);
              }}
              onSkip={() => {
                noteExamDateAsked(pendingDrillDateChatId);
                const target = pendingDrillDateChatId;
                setPendingDrillDateChatId(null);
                navigate(`/drill/${target}`);
              }}
            />
          </div>
        )}

        {showExamPrepModal && (
          <ExamPrepModal
            onClose={() => setShowExamPrepModal(false)}
            onSubmit={handleExamPrepSubmit}
            isSubmitting={isCreatingExamChat}
          />
        )}

        {/* Paste Notes Modal */}
        {showPasteNotesModal && (
          <div className="paste-notes-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPasteNotesModal(false);
              setPastedNotesText('');
            }
          }}>
            <div className="paste-notes-modal">
              <div className="paste-notes-header">
                <h2 className="paste-notes-title">
                  {t('chat.pasteNotesTitle', 'Paste your notes')}
                </h2>
                <p className="paste-notes-subtitle">
                  {t('chat.pasteNotesSubtitle', 'Copy and paste your study material below')}
                </p>
              </div>
              <div className="paste-notes-body">
                <textarea
                  className="paste-notes-textarea"
                  value={pastedNotesText}
                  onChange={(e) => setPastedNotesText(e.target.value)}
                  placeholder={t('chat.pasteNotesPlaceholder', 'Paste or type your notes here...')}
                  autoFocus
                />
                <div className="paste-notes-charcount">
                  {pastedNotesText.length > 0 && (
                    <span>{pastedNotesText.length.toLocaleString()} {t('chat.characters', 'characters')}</span>
                  )}
                </div>
              </div>
              <div className="paste-notes-actions">
                <button
                  className="paste-notes-cancel"
                  onClick={() => {
                    setShowPasteNotesModal(false);
                    setPastedNotesText('');
                  }}
                >
                  {t('examPrep.cancel', 'Cancel')}
                </button>
                <button
                  className="paste-notes-submit"
                  onClick={handlePasteNotesSubmit}
                  disabled={!pastedNotesText.trim()}
                >
                  {t('chat.startStudying', 'Start studying')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz Mode Selector Modal */}
        <QuizModeSelector
          isOpen={showQuizModeSelector}
          onClose={() => {
            setShowQuizModeSelector(false);
            setPendingQuizMessageData(null);
          }}
          onSelectMode={handleQuizModeSelect}
          topics={pendingQuizMessageData?.topics || []}
        />

        {/* Start Study Journey Modal */}
        <StartStudyModal
          isOpen={showStartStudyModal}
          onClose={() => {
            setShowStartStudyModal(false);
            setPendingStudyDocs([]);
            setPendingStudyTopics([]);
            setPendingRankedTopics([]);
            setPendingStudyUserPreferences(null);
          }}
          onStart={(newStudyState) => {
            devLog('📚 Study session started:', newStudyState);
            setStudyAutoStart(true);
            setStudyState(newStudyState);
            setIsStudyMode(true);
            setShowStartStudyModal(false);
            setPendingStudyDocs([]);
            setPendingStudyTopics([]);
            setPendingRankedTopics([]);
            setPendingStudyUserPreferences(null);
          }}
          chatId={currentChatID}
          uploadedDocs={pendingStudyDocs}
          topics={pendingStudyTopics}
          rankedTopics={pendingRankedTopics}
          language={i18n?.language || 'en'}
          autoStart={true}
          userPreferences={pendingStudyUserPreferences || userProfile?.onboarding || {}}
          diagnostic={studyDiagnostic}
          courseContext={pendingCourseContext}
          courseIntelligence={pendingCourseIntelligence}
        />

        {/* Game Chat Empty State - Quiz data wasn't saved */}
        {!hasMessages && isChatDataLoaded && isGameChat && (
          <div className="game-chat-empty-state">
            <div className="game-empty-icon">🎮</div>
            <h3 className="game-empty-title">Quiz Game Session</h3>
            <p className="game-empty-description">
              This was a quiz game played from the home page.
              {gameState?.status === 'completed'
                ? ` The game was completed with ${gameState?.serumCollected || 0}mL serum collected.`
                : ' The quiz data from this session was not saved.'}
            </p>
            <p className="game-empty-hint">
              Future games will automatically save quiz content here.
            </p>
            <button
              className="game-replay-btn"
              onClick={() => window.location.href = '/'}>
              🏠 Go to Home to Play Again
            </button>
          </div>
        )}

        {/* Messages */}
        <div
          className="messages-container"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {/* Loading Skeleton - shown while positioning content */}
          {!isInitialLoadComplete && chatMessages.length > 0 && (
            <div className="nurse-loader">
              <div className="loader-core">

                {/* Spinning 3D Heart */}
                <div className="loader-heart">
                  <svg
                    viewBox="0 0 200 200"
                    className="heart-svg"
                  >
                    <defs>
                      <linearGradient id="metallicPurple" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#e6c7ff" />
                        <stop offset="25%" stop-color="#c89aff" />
                        <stop offset="60%" stop-color="#9a57ff" />
                        <stop offset="100%" stop-color="#5b1bcc" />
                      </linearGradient>
                    </defs>

                    <path
                      fill="url(#metallicPurple)"
                      d="
                        M100 150
                        C72 125 45 95 53 67
                        C58 48 75 38 90 42
                        C99 45 106 53 108 62
                        C112 53 119 45 128 42
                        C143 38 160 48 165 67
                        C173 95 146 125 118 150
                        Z
                      "
                    />
                  </svg>
                </div>

                {/* Sparkles */}
                <div className="sparkle sparkle-1"></div>
                <div className="sparkle sparkle-2"></div>
                <div className="sparkle sparkle-3"></div>
              </div>

              <p className="loader-text">{t("loading.justAmoment")}</p>
            </div>

          )}

          {/* Actual Messages - hidden until positioned */}
          <div style={{ opacity: isInitialLoadComplete ? 1 : 0, transition: 'opacity 0.3s ease' }}>
            {chatMessages.map((message, messageIndex) => {
              // Once the drill is running, the upload analysis card has done
              // its job. It reports on a step the student has already moved
              // past, and leaving it up puts a finished green "Analysis
              // complete" panel above the only live thing on the page.
              if (drillSummary && message.type === 'upload_loading') return null;

              // ============================================
              // UPLOAD LOADING BOX
              // ============================================
              // Shows progress while files are being analyzed.
              // Hidden once complete AND post_upload_actions exists (to avoid redundancy)
              // ============================================
              if (message.type === 'upload_loading') {
                // The linked onboarding card owns progress for this upload.
                // Keep upload failures visible and other uploads unaffected.
                if (!message.error && chatMessages.some(msg =>
                  msg.type === 'plan_onboarding' && msg.uploadMessageId === message.id && !msg.uploadFailed
                )) return null;
                // Hide completed LoadingMessageBox if PostUploadActions or FirstUploadWowCard exists
                // This avoids showing redundant info after the friendly action message appears
                // (never hide an errored box — the user must see the failure)
                if (!message.isLoading && !message.error) {
                  const hasPostUploadMessage = chatMessages.some(
                    msg => msg.type === 'post_upload_actions' || msg.type === 'first_upload_wow' || msg.type === 'plan_onboarding'
                  );
                  if (hasPostUploadMessage) {
                    return null; // Hide the completed loading box
                  }
                }
                return (
                  <LoadingMessageBox
                    key={message.id}
                    isLoading={message.isLoading}
                    error={message.error}
                    errorCode={message.errorCode}
                    insights={message.insights || []}
                    summary={message.summary}
                    fileCount={message.fileCount}
                    filenames={message.filenames}
                    language={message.language || currentLanguage}
                  />
                );
              }

              // Handle separate upload completion message (shows "Document uploaded" summary)
              if (message.type === 'upload_complete') {
                return (
                  <div key={message.id} className="upload-complete-message">
                    <div className="upload-complete-icon">📄</div>
                    <div className="upload-complete-content">
                      <div className="upload-complete-title">
                        {message.fileCount === 1
                          ? (currentLanguage === 'fr' ? 'Document téléversé' : 'Document uploaded')
                          : (currentLanguage === 'fr'
                            ? `${message.fileCount} documents téléversés`
                            : `${message.fileCount} documents uploaded`)
                        }
                      </div>
                      {message.summary && (
                        <div className="upload-complete-summary">{message.summary}</div>
                      )}
                    </div>
                  </div>
                );
              }

              // ============================================
              // POST-UPLOAD ACTIONS MESSAGE
              // ============================================
              // Friendly AI message with action buttons after file upload.
              // Rendered as an AI message (same structure as ChatMessage)
              // so it appears centered and styled consistently.
              // ============================================
              if (message.type === 'post_upload_actions') {
                return (
                  <div key={message.id} className="message ai-message">
                    <div className="message-content">
                      <PostUploadActions
                        message={message.content}
                        topics={message.topics}
                        filenames={message.filenames}
                        actions={message.actions}
                        showActions={message.showActions}
                        disabled={isSystemBusy}
                        selectedActionId={message.selectedAction}
                        onAction={(actionId) => handlePostUploadAction(actionId, message)}
                      />
                    </div>
                  </div>
                );
              }

              // ============================================
              // FIRST UPLOAD WOW CARD
              // Personalized "aha moment" for first-time uploaders.
              // Shows a single CTA based on their onboarding choices.
              // ============================================
              if (message.type === 'first_upload_wow') {
                return (
                  <div key={message.id} className="message ai-message">
                    <div className="message-content">
                      <FirstUploadWowCard
                        studyGoal={message.studyGoal}
                        actionId={message.actionId}
                        topics={message.topics}
                        disabled={isSystemBusy}
                        onAction={(actionId) => {
                          devLog('🎯 Wow card CTA clicked:', actionId);
                          handlePreSelectedAction(actionId, message);
                        }}
                      />
                    </div>
                  </div>
                );
              }

              // ============================================
              // PLAN ONBOARDING (exam-prep first uploads only)
              // 3-question gate: exam date, hardest topics, prep status.
              // Confirm  -> opens StartStudyModal with merged userPreferences
              //             and replaces this card with a PostUploadActions
              //             menu so it remains in the chat history.
              // Skip     -> swaps this card in-place to a PostUploadActions
              //             menu — same final state as a Skipped non-exam user.
              // ============================================
              if (message.type === 'plan_onboarding') {
                return (
                  <div key={message.id} className="message ai-message">
                    <div className="message-content">
                      <PlanOnboarding
                        autoInvestigate
                        topics={message.topics || []}
                        insights={message.insights || []}
                        filenames={message.filenames || []}
                        fileCount={message.fileCount || (message.filenames || []).length || 0}
                        language={(i18n?.language || 'en').split('-')[0]}
                        chatId={currentChatID}
                        userOnboarding={userProfile?.onboarding || {}}
                        disabled={isAiTyping || isStreaming || isQuizGeneratingRef.current || loadingStates.quiz || loadingStates.summary || loadingStates.scenario}
                        // A card restored from Firestore predates this field
                        // and is, by definition, past its upload — so absent
                        // means ready. Only the card created at upload start
                        // sets it false.
                        materialsReady={message.materialsReady !== false}
                        uploadFailed={Boolean(message.uploadFailed)}
                        savedCourseContext={pendingCourseContext}
                        onCourseContext={handleCourseContext}
                        onConfirm={({ userPreferences, diagnostic, rankedTopics, courseContext, courseIntelligence }) =>
                          handlePlanOnboardingConfirm(message, userPreferences, diagnostic, rankedTopics, {
                            courseContext,
                            courseIntelligence,
                          })
                        }
                      />
                    </div>
                  </div>
                );
              }

              // ============================================
              // STUDY SHEET MESSAGE (inline in chat)
              // ============================================
              if (message.type === 'studysheet') {
                return (
                  <div key={message.id} className="message ai-message study-sheet-message">
                    <div className="message-content">
                      <Suspense fallback={<GhostLoader type="studysheet" />}>
                        <StudySheetSimple
                          topic={message.topic}
                          content={message.content}
                          isStreaming={message.isStreaming}
                          error={message.error}
                          inline={true}
                        />
                      </Suspense>
                    </div>
                  </div>
                );
              }

              // ============================================
              // CHECK MY UNDERSTANDING — session card
              // ============================================
              if (message.type === 'checkme_card') {
                // Progress is derived, not stored: count the replies the
                // student has sent since this card. Nothing to keep in sync,
                // and it rebuilds correctly after a reload.
                const repliesSince = chatMessages
                  .slice(messageIndex + 1)
                  .filter(m => m.role === 'user' && !m.hidden).length;

                return (
                  <div key={message.id} className="message ai-message">
                    <div className="message-content">
                      <CheckUnderstandingCard
                        topics={message.topics || []}
                        total={message.total || (message.topics || []).length}
                        current={repliesSince + 1}
                      />
                    </div>
                  </div>
                );
              }

              // ============================================
              // AUDIO OPTIONS MESSAGE (confirmation card)
              // ============================================
              if (message.type === 'audio_options') {
                return (
                  <div key={message.id} className="message ai-message audio-options-message">
                    <div className="message-content">
                      <AudioConfirmCard
                        topic={message.topic}
                        intent={message.intent}
                        styleName={message.styleName}
                        styleDescription={message.styleDescription}
                        durations={message.durations}
                        defaultDuration={message.defaultDuration}
                        onGenerate={(duration) => {
                          // Remove the options card
                          setChatMessages(prev => prev.filter(msg => msg.id !== message.id));
                          // Send message to generate audio with selected duration and language
                          // Use i18n.language directly to get current language (avoid stale closure)
                          const currentLang = i18n.language || 'en';
                          const langCode = currentLang.split('-')[0]; // Extract base language code
                          const langMap = { 'fr': 'french', 'en': 'english' };
                          const audioLang = langMap[langCode] || 'english';
                          const audioRequest = `Generate audio: topic="${message.topic}" intent="${message.intent}" duration="${duration}" language="${audioLang}"`;
                          handleSendNewUserMessage(null, audioRequest, { hideUserMessage: true });
                        }}
                        onCancel={() => {
                          // Remove the options card
                          setChatMessages(prev => prev.filter(msg => msg.id !== message.id));
                        }}
                      />
                    </div>
                  </div>
                );
              }

              // ============================================
              // AUDIO PLAYER MESSAGE (live session)
              // ============================================
              if (message.type === 'audio_player') {
                return (
                  <div key={message.id} className="message ai-message audio-player-message">
                    <div className="message-content">
                      <ChatAudioPlayer
                        audioBase64={message.audioBase64}
                        firebaseUrl={message.firebaseUrl}
                        topic={message.topic}
                        intent={message.intent}
                        duration={message.audioDuration ? `${Math.round(message.audioDuration / 60)} min` : ''}
                        script={message.script}
                        isGenerating={message.isGenerating}
                        generatingMessage={message.generatingMessageKey ? t(message.generatingMessageKey) : message.generatingMessage}
                        onFirstPlay={() => markMessageEngaged(currentChatID, message.id, 'audio')}
                      />
                      {message.error && (
                        <div className="audio-error-message">
                          {t('audio.audioError', message.error)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // ============================================
              // AUDIO MESSAGE (persisted from Firebase)
              // ============================================
              if (message.type === 'audio') {
                return (
                  <div key={message.id} className="message ai-message audio-player-message">
                    <div className="message-content">
                      <ChatAudioPlayer
                        firebaseUrl={message.firebaseUrl}
                        topic={message.topic}
                        intent={message.intent}
                        duration={message.duration || ''}
                        script={message.script}
                        isGenerating={false}
                        onFirstPlay={() => markMessageEngaged(currentChatID, message.id, 'audio')}
                      />
                    </div>
                  </div>
                );
              }

              // ============================================
              // MINDMAP MESSAGE
              // ============================================
              if (message.type === 'mindmap') {
                return (
                  <div key={message.id} className="message ai-message mindmap-message">
                    <div className="message-content">
                      <Suspense fallback={<GhostLoader type="message" />}>
                        <ChatMindmap
                          mindmapData={message.mindmapData}
                          isLoading={message.isStreaming}
                          topic={message.content}
                        />
                      </Suspense>
                    </div>
                  </div>
                );
              }

              // ============================================
              // WEB SOURCES PANEL (school-specific exam research)
              // ============================================
              if (message.type === 'web_sources') {
                return (
                  <div key={message.id} className="message ai-message web-sources-message">
                    <div className="message-content">
                      <WebSourcesPanel
                        status={message.webSourcesStatus || 'found'}
                        school={message.webSourcesSchool}
                        examBoard={message.webSourcesExamBoard}
                        examSummary={message.webSourcesSummary}
                        citations={message.webSourcesCitations || []}
                        foundRealPapers={message.webSourcesFoundRealPapers}
                        honestyNote={message.webSourcesHonestyNote}
                        cached={message.webSourcesCached}
                        fallbackMessage={message.webSourcesFallbackMessage}
                      />
                    </div>
                  </div>
                );
              }

              // Regular messages - also render streaming messages with empty content (shows loading heart)
              if ((typeof message.content === 'string' && message.content.trim()) || message.isStreaming) {
                const isLastUserMessage = message.role === 'user' && message.id === lastUserMessageId;

                return (
                  <div
                    key={message.id}
                    ref={isLastUserMessage ? lastUserMessageRef : null}
                  >
                    <ChatMessage
                      message={message}
                      chatId={currentChatID}
                      onOptionClick={stableHandlePostDocumentUploadOption}
                      onQuizAnswerSelect={stableHandleQuizAnswerSelect}
                      uploadedFilesList={uploadedFilesList}
                      onQuizVisibilityChange={handleQuizVisibilityChange}
                      onQuizInteraction={handleQuizInteraction}
                      isActiveQuiz={message.id === activeQuizId}
                      onMessageRated={handleMessageRated}
                      onQuizExtended={handleQuizExtended}
                      onSendMessage={stableHandleSendMessage}
                      onRetryMessage={handleRetryMessage}
                      onDeleteMessage={handleDeleteMessage}
                      onEditMessage={stableHandleEditMessage}
                      viewAllChatsMode={viewAllChatsMode}
                    />
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Loading Spinners */}
          {loadingStates.quiz && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                <span className="blinking-dots">
                  <h4>
                    <strong>
                      <GraduationEmoji /> {t("loading.generatingQuiz")}
                    </strong>

                  </h4>
                </span>
              </div>
            </div>
          )}

          {/* {loadingStates.fileUpload && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                  <span className="blinking-dots">
                    <h4>
                        <strong>
                          📁 {t("loading.savingFile")}
                        </strong>
                      
                    </h4>                
                  </span>
              </div>
            </div>
          )} */}

          {/* {loadingStates.fileEmbedding && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                  <span className="blinking-dots">
                    <h4>                      
                        <ReadingEmoji size={40} />
                        <strong>{t("loading.analyzingContent")}</strong>
                        <span></span>
                    <span></span>
                    <span></span>
                    </h4>                
                  </span>
              </div>
            </div>
          )} */}

          {loadingStates.summary && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                <span className="blinking-dots">
                  <h4>
                    <PencilEmoji size={40} />
                    <strong>{t("loading.writingSummary")}</strong>
                    <span></span>
                    <span></span>
                    <span></span>
                  </h4>
                </span>
              </div>
            </div>
          )}

          {loadingStates.scenario && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                <span className="blinking-dots">
                  <h4>
                    <CookingEmoji size={40} />
                    {"  "}
                    <strong>Entrain de te concocter une mise en situation</strong>
                    <span></span>
                    <span></span>
                    <span></span>
                  </h4>
                </span>
              </div>
            </div>
          )}

          {/* AI Typing Indicator - Now handled by message avatars with isStreaming flag */}




          <div ref={messagesEndRef} />

          {/* Spacer to force user message to scroll to top when needed */}
          {forceScrollSpace && (
            <div style={{
              height: '70vh',
              width: '100%',
              pointerEvents: 'none',
              userSelect: 'none'
            }} />
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              DISABLED: Suggested Prompts - Above Input
              ═══════════════════════════════════════════════════════════════════
              Commenting out to save tokens - analytics showed low usage.
              Backend no longer sends suggested_prompts, so this would be empty anyway.
              Can be re-enabled by uncommenting the code below.
              ═══════════════════════════════════════════════════════════════════ */}
          {/* <div className='message ai-message'>
            <SuggestedPrompts
              suggestions={suggestedPrompts}
              onSuggestionClick={handleSuggestionClick}
              isLoading={isAiTyping}
            />
          </div> */}


          {/* Scroll to Bottom Button */}
          {showScrollButton && isInitialLoadComplete && !isStudyMode && !showStartStudyModal && !chatMessages.some(message => message.type === 'plan_onboarding') && (
            <button
              className="scroll-to-bottom-btn"
              onClick={() => scrollToBottom('smooth')}
              aria-label="Scroll to bottom"
              title="Aller au dernier message"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}
        </div>


        {/* Pre-upload study options removed - single CTA card handles upload */}

        {/* Input Area.
            Hidden — not unmounted — while the post-upload coach flow runs. The
            form owns `documentFileInputRef`, which other paths still click
            programmatically, and a display:none input clicks fine; unmounting
            it would break uploads elsewhere. */}
        <form
          className={`input-area${drillSummary ? ' input-area--drill' : ''}${isCoachFlowActive ? ' input-area--hidden' : ''}`}
          onSubmit={handleSendNewUserMessage}
        >
          <input
            type="file"
            ref={documentFileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.jpg,.jpeg,.png,.bmp,.tiff,.webp,.heic,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,image/*"
          />

          {/* ── Drill in progress: the composer stands down ───────────────
              Once a chat is being drilled it is a drill surface, not a
              conversation, so the resume control takes the composer's place
              rather than sitting somewhere else on the page. Putting it here
              means the answer to "how do I get back in?" is exactly where the
              student's hands already are.

              The hidden file input above stays mounted either way — the
              empty-state CTA still needs it. */}
          {drillSummary ? (
            <div className="drill-resume">
              <div className="drill-resume__head">
                <span className="drill-resume__eyebrow">
                  {drillSummary.answered > 0
                    ? t('drill.inProgress', 'Drill in progress')
                    : t('drill.readyEyebrow', 'Drill ready')}
                </span>
                <span className="drill-resume__meta">
                  {drillSummary.answered > 0
                    ? t('drill.answeredSoFar', '{{count}} questions answered so far', {
                        count: drillSummary.answered,
                      })
                    : t('drill.notStartedYet', 'Nothing answered yet')}
                </span>
              </div>

              {/* What has been covered, written onto the ruled lines and
                  ticked off. Names only, no scores — this sheet is a way back
                  in, not a report; the checkpoint delivers findings.

                  A list rather than chips because these labels are generated
                  and run long ("Impact of Sleep Timing on Hormonal Health"),
                  and because a tick means "done" where a sticky note would
                  mean "still to do". */}
              {drillSummary.topics.length > 0 && (
                <div className="drill-resume__topics">
                  <span className="drill-resume__topics-label">
                    {t('drill.coveredSoFar', 'Covered so far')}
                  </span>
                  <ul className="drill-resume__list">
                    {drillSummary.topics.slice(0, 6).map((topic) => (
                      <li className="drill-resume__line" key={topic}>
                        <svg
                          className="drill-resume__tick"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4 13.5 L9.5 19 L20 5" />
                        </svg>
                        <span className="drill-resume__subject">{topic}</span>
                      </li>
                    ))}
                    {drillSummary.topics.length > 6 && (
                      <li className="drill-resume__line drill-resume__line--more">
                        {t('drill.moreTopics', '+{{count}} more', {
                          count: drillSummary.topics.length - 6,
                        })}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* The CTA and its countdown move together, so the deadline
                  reads as the reason to press the button rather than as a
                  separate fact somewhere else on the page. */}
              <div className="drill-resume__action">
                <button
                  type="button"
                  className="drill-resume__button"
                  onClick={() => navigate(`/drill/${chatId}`)}
                >
                  <span className="drill-resume__play" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  {drillSummary.answered > 0
                    ? t('drill.keepDrilling', 'Keep drilling')
                    : t('drill.startDrilling', 'Start the drill')}
                </button>

                {(() => {
                  // Same date helpers the plan and the diagnostic use — a
                  // second definition of "how many days is that" would drift
                  // on timezones and midnight, and she would see one
                  // countdown here and a different one on her plan.
                  const raw = currentExamData?.examDate || userProfile?.onboarding?.examDate;
                  const when = coerceDate(raw);
                  if (!when) return null;
                  const days = calendarDaysBetween(new Date(), when);
                  // An exam that has been and gone is not a countdown.
                  if (days === null || days < 0) return null;

                  return (
                    <p className="drill-resume__countdown">
                      {days === 0
                        ? t('drill.examToday', 'Your exam is today')
                        : days === 1
                          ? t('drill.examTomorrow', 'Your exam is tomorrow')
                          : t('drill.examInDays', '{{count}} days until your exam', { count: days })}
                    </p>
                  );
                })()}
              </div>
            </div>
          ) : (
          <div className="input-wrapper-container">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Message..."
              value={userInputText}
              onChange={(e) => {
                setUserInputText(e.target.value);
              }}
              onPaste={(e) => {
                // Pasted images (screenshots, copied pictures) go through the
                // regular file-upload pipeline, same as the paperclip button.
                const items = Array.from(e.clipboardData?.items || []);
                const imageFiles = items
                  .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
                  .map(item => item.getAsFile())
                  .filter(Boolean)
                  .map((file, idx) => {
                    // Clipboard files are often all named "image.png" — give
                    // each a unique, readable name for the uploads list.
                    const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
                    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    return new File([file], `pasted-image-${stamp}${idx > 0 ? `-${idx + 1}` : ''}.${ext}`, { type: file.type });
                  });
                if (imageFiles.length > 0) {
                  e.preventDefault();
                  // Same synthetic-event pattern as handlePasteNotesSubmit
                  // (avoids DataTransfer, unsupported on iOS Safari).
                  handleFileSelect({ target: { files: imageFiles, value: '' } });
                  return;
                }

                const html = e.clipboardData?.getData('text/html');
                if (!html) return; // Let browser handle plain-text paste.
                const markdown = htmlToMarkdown(html);
                if (!markdown) return;
                e.preventDefault();
                const ta = e.currentTarget;
                const start = ta.selectionStart ?? userInputText.length;
                const end = ta.selectionEnd ?? userInputText.length;
                const next = userInputText.slice(0, start) + markdown + userInputText.slice(end);
                setUserInputText(next);
                // Restore caret to end of inserted text after React updates.
                const caret = start + markdown.length;
                requestAnimationFrame(() => {
                  if (textareaRef.current) {
                    textareaRef.current.selectionStart = caret;
                    textareaRef.current.selectionEnd = caret;
                  }
                });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // submit form when user presses enter
                  if (!isSystemBusy) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }
              }}
              disabled={isSystemBusy}
              className={`message-textarea ${isSystemBusy ? 'textarea-disabled' : ''}`}
            />

            {/* Bottom row: file buttons on left, send button on right */}
            <div className="input-actions-bottom">
              <div className="input-actions-left-group">
                <button type="button"
                  className="upload-button file-button"
                  onClick={openFileUploadDialog}
                  data-tooltip={t('chat.tooltipAttachFile')}
                  disabled={isSystemBusy}>
                  <SvgFileUpload />
                </button>

                <button type="button"
                  className="upload-button photo-button"
                  onClick={() => setIsFilesModalVisible(true)}
                  data-tooltip={uploadedFilesList.length === 0
                    ? t('chat.tooltipFilesEmpty')
                    : t('chat.tooltipFilesCount', { count: uploadedFilesList.length })}
                  style={{ position: 'relative' }}>
                  📁
                  {uploadedFilesList.length > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: uploadedFilesList.length >= 10 ? '-10px' : '-8px',
                      right: uploadedFilesList.length >= 10 ? '-10px' : '-8px',
                      backgroundColor: '#a5d567',
                      color: 'white',
                      borderRadius: '50%',
                      minWidth: uploadedFilesList.length >= 10 ? '24px' : '20px',
                      height: uploadedFilesList.length >= 10 ? '24px' : '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: uploadedFilesList.length >= 10 ? '11px' : '12px',
                      fontWeight: '600',
                      border: '2px solid white',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      lineHeight: '1'
                    }}>
                      {uploadedFilesList.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Right side: Voice input + Send/Stop button */}
              <div className="input-actions-right-group">
                {/* Voice input button */}
                <button
                  type="button"
                  className={`voice-input-button ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
                  onClick={toggleRecording}
                  disabled={isSystemBusy || isTranscribing}
                  data-tooltip={isRecording ? t('chat.tooltipVoiceStop') : isTranscribing ? t('chat.tooltipVoiceTranscribing') : t('chat.tooltipVoiceDictate')}
                >
                  {isTranscribing ? (
                    <div className="voice-transcribing">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  ) : isRecording ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                  )}
                </button>

                {/* Send or Stop button */}
                {isStreaming ? (
                  // Stop button when streaming
                  <button
                    type="button"
                    className="stop-button-icon"
                    onClick={handleStopStreaming}
                    title={t('chat.stopStreaming', 'Stop streaming')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </button>
                ) : (
                  // Send button when not streaming
                  <button type="submit"
                    className={`send-button-icon ${isSystemBusy ? 'send-button-busy' : ''}`}
                    disabled={!userInputText.trim() || isSystemBusy}
                    title={t('chat.send')}>
                    {isSystemBusy ? (
                      <div className="pulsing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          )}
        </form>

        {/* Files Modal */}
        {
          isFilesModalVisible && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3>{t('chat.files')} 📁</h3>
                  <button
                    className="close-button"
                    onClick={() => setIsFilesModalVisible(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="modal-body">
                  {uploadedFilesList.length === 0 ? (
                    <p className="no-files">{t('chat.noFiles')}</p>
                  ) : (
                    <ul className="files-list">
                      {uploadedFilesList.map(file => {
                        const openable = !!file.downloadURL;
                        const handleOpen = () => {
                          if (openable) {
                            setViewerFile(file);
                            setIsFilesModalVisible(false);
                          }
                        };
                        return (
                          <li
                            key={file.id || file.path || file.name}
                            className={`file-item ${openable ? 'file-item-openable' : ''}`}
                            onClick={handleOpen}
                            onKeyDown={(e) => {
                              if (openable && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                handleOpen();
                              }
                            }}
                            role={openable ? 'button' : undefined}
                            tabIndex={openable ? 0 : undefined}
                            title={openable ? t('chat.openFile', 'Open file') : undefined}
                          >
                            <div className="file-info">
                              <div className="file-icon">
                                {file.isImage ? <SvgImageIcon /> : <SvgFileIcon />}
                              </div>
                              <div className="file-details">
                                <div className="file-name">{file.name}</div>
                                <div className="file-meta">
                                  <span className="file-size">{file.size}</span>
                                  <span className="file-date">{formatDate(file.uploadedAt)}</span>
                                </div>
                              </div>
                              {openable && (
                                <div className="file-open-icon" aria-hidden="true">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )
        }

        {viewerFile && (
          <Suspense fallback={null}>
            <FileViewerModal
              file={viewerFile}
              onClose={() => setViewerFile(null)}
            />
          </Suspense>
        )}
      </div >
    </div >
  );
};

export default ChatInterface;
