import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { Navigate } from 'react-router-dom';
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
  serverTimestamp,
  where
} from "firebase/firestore";

// Components
import ChatMessage from './ChatMessage';
import LoadingMessageBox from './LoadingMessageBox';
import PostUploadActions from './PostUploadActions';

// SVG Components
import SvgFileUpload from '../Svg/SvgFileUpload';
import SvgFileIcon from '../Svg/SvgFileIcon';
import SvgImageIcon from '../Svg/SvgImageIcon';

// Emoji Components
import ReadingEmoji from './Emojis/ReadingEmoji.jsx';
import GraduationEmoji from './Emojis/GraduationEmoji.js';
import PencilEmoji from './Emojis/PencilEmoji.js';
import CookingEmoji from './Emojis/CookingEmoji.js';
import GearEmoji from './Emojis/GearEmoji.js';
import ThinkingEmoji from './Emojis/ThinkingEmoji.js';

// Servicess
import { formatDate, formatFileSize } from '../../Services/Formatting.js';
import {
  AppendToChat,
  SaveFileMetaData,
  GetFileMetadataByName,
  UpdateQuizAnswer,
  UpdateFlashcardReview,
  SaveQuizFeedback,
  DeleteMessage
} from '../../Services/FireBaseServiceChats.js';

import { loadFilesForChat, saveAudioToStorage } from '../../Services/FireBaseFiles.js';
import {
  ask_llm_stream,
  embed_docs,
  generate_summary,
  stream_summary,
  generate_scenario,
  upload_files_with_progress
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
import StudySheetSimple from './StudySheetSimple.js';
import StickyQuizProgress from './StickyQuizProgress';
import SuggestedPrompts from './SuggestedPrompts';
import AudioConfirmCard from './AudioConfirmCard';
import ChatAudioPlayer from './ChatAudioPlayer';

// Progress Tracking
import CompactProgressWidget from '../Progress/CompactProgressWidget';
import ProgressDashboard from '../Progress/ProgressDashboard';
import { useProgress } from '../../Contexts/ProgressContext/ProgressContext';

// Exam Prep
import ExamPrepModal from './ExamPrepModal';

// Common Components
import ExamCountdown from '../Common/ExamCountdown';

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
  onPendingUploadProcessed = null  // Callback when pending upload is handled
}) => {

  // Progress tracking context
  const { addCorrectAnswer, addIncorrectAnswer } = useProgress();

  // Add this as the FIRST useEffect in ChatInterface
  useEffect(() => {
    console.log('🔍 Component mounted, checking URL...');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 Search params:', window.location.search);
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
  const [currentExamData, setCurrentExamData] = useState(null); // { examId, examName, examDate }
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

      console.log('📚 Pre-filled practice prompt from quiz share:', pendingTopic);
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

  // Set flag when pendingUploadFiles arrives
  useEffect(() => {
    if (pendingUploadFiles.length > 0 && !pendingUploadProcessedRef.current) {
      const user = auth.currentUser;
      if (user) {
        console.log(`📤 Pending upload files detected: ${pendingUploadFiles.length} file(s)`);
        setShouldProcessPendingUpload(true);
      }
    }
  }, [pendingUploadFiles]);

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
  const [isStreaming, setIsStreaming] = useState(false); // Track if actively streaming

  // Upload insights state
  const [uploadInsights, setUploadInsights] = useState([]);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [isUploadAnalyzing, setIsUploadAnalyzing] = useState(false);
  const [uploadMessageId, setUploadMessageId] = useState(null);

  // State for sticky quiz progress bar
  const [activeQuizProgress, setActiveQuizProgress] = useState(null);

  //Track which quiz is currently active
  const [activeQuizId, setActiveQuizId] = useState(null);

  // track sugggested prompts that is received after each message
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);

  // Exam prep modal state
  const [showExamPrepModal, setShowExamPrepModal] = useState(false);
  const [isCreatingExamChat, setIsCreatingExamChat] = useState(false);

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
  // 🆕 Track insights accumulation to avoid race conditions
  const uploadInsightsAccumulatorRef = useRef([]);
  // Track the latest requested chat ID to prevent stale async responses
  const latestRequestedChatIdRef = useRef(null);

  // Track if user is at bottom of chat
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // State to force minimum height for scrolling user message to top
  const [forceScrollSpace, setForceScrollSpace] = useState(false);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

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
      };
    }
  }, [currentChatID]);


  // In your ChatInterface component
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPrompt = params.get('prompt');  // ✅ Renamed to avoid conflicts

    if (urlPrompt) {
      console.log('📝 Setting prompt from URL:', urlPrompt);
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

  // Auto-scroll during streaming (smooth, continuous scrolling like ChatGPT)
  useEffect(() => {
    if (isAiTyping && hasInitiallyScrolledRef.current) {
      // Only scroll if user is near bottom (don't force scroll if they scrolled up)
      if (isNearBottom()) {
        scrollToBottom('smooth');
      }
    }
  }, [chatMessages, isAiTyping, scrollToBottom, isNearBottom]);

  // Premium textarea auto-resize - ChatGPT/Gemini style
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to 'auto' first to get the natural scrollHeight
    textarea.style.height = 'auto';

    // Calculate scroll height for content and cap at ~55% viewport height
    const maxHeight = Math.max(160, Math.floor(window.innerHeight * 0.55));
    const scrollHeight = textarea.scrollHeight;

    // Ensure we don't shrink below a minimum height (e.g. 24px or 40px depending on CSS)
    // But allow it to grow.
    const newHeight = Math.min(scrollHeight, maxHeight);

    textarea.style.maxHeight = `${maxHeight}px`;
    textarea.style.height = `${newHeight}px`;

    // Show scrollbar only if content exceeds max height
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [userInputText]);

  const setLoadingState = useCallback((key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const isSystemBusy = () => {
    return (
      isAiTyping ||
      loadingStates.quiz ||
      loadingStates.summary ||
      loadingStates.scenario ||
      loadingStates.fileUpload ||
      loadingStates.fileEmbedding
    );
  };


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

    // Clear chat type states IMMEDIATELY to prevent stale data showing
    setIsGameChat(false);
    setGameState(null);
    setCurrentExamData(null);

    // Get chat title and check if it's a game chat or exam chat
    latestRequestedChatIdRef.current = chatId; // Track the latest request
    const chatDocRef = doc(db, "chats", chatId);
    getDoc(chatDocRef).then((docSnapshot) => {
      // Guard against stale responses - if user clicked another chat, ignore this response
      if (latestRequestedChatIdRef.current !== chatId) {
        console.log('🚫 Ignoring stale chat data for:', chatId, 'current chat is:', latestRequestedChatIdRef.current);
        return;
      }
      if (docSnapshot.exists()) {
        const chatData = docSnapshot.data();
        setChatTitle(chatData.title);
        // Check if this is a game-type chat
        const isGame = chatData.type === 'game';
        console.log('🎮 Chat type check:', { chatId, type: chatData.type, isGame, gameState: chatData.gameState });
        setIsGameChat(isGame);
        setGameState(chatData.gameState || null);
        // Check if this chat is linked to an exam
        if (chatData.examId) {
          setCurrentExamData({
            examId: chatData.examId,
            examName: chatData.examName,
            examDate: chatData.examDate
          });
        } else {
          setCurrentExamData(null);
        }
      } else {
        setIsGameChat(false);
        setGameState(null);
        setCurrentExamData(null);
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

    const messagesRef = collection(db, "chats", currentChatID, "messages");
    const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const loadedMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      // Preserve local-only messages that shouldn't be overwritten by Firebase
      setChatMessages(prev => {
        // Local messages to preserve (not in Firebase)
        const localOnlyMessages = prev.filter(msg => {
          const notInFirebase = !loadedMessages.some(fbMsg => fbMsg.id === msg.id);

          // Keep: active uploads, streaming messages, pending post-upload actions, pending flashcards/quizzes
          // NOTE: post_upload_actions should only be preserved if NOT YET in Firebase
          // Once saved to Firebase, let Firebase be the source of truth for ordering
          const shouldPreserve =
            (msg.type === 'upload_loading' && msg.isLoading === true) ||
            (msg.isStreaming === true) ||
            (msg.type === 'post_upload_actions' && notInFirebase) ||
            ((msg.type === 'flashcard' || msg.type === 'quiz') && notInFirebase);

          if (shouldPreserve && (msg.type === 'flashcard' || msg.type === 'quiz')) {
            console.log(`🔄 Preserving ${msg.type} message ${msg.id} (isStreaming: ${msg.isStreaming}, notInFirebase: ${notInFirebase})`);
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

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  const handleSendNewUserMessage = async (e = null, customPrompt = null, options = {}) => {
    const { hideUserMessage = false } = options;

    // Check if e is actually an event object (has preventDefault method)
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    // clear the state of suggested prompts
    setSuggestedPrompts([]);

    const messageToSend = customPrompt ?? userInputText;
    if (messageToSend.trim() === '') return;

    // IMMEDIATELY show loading state - don't wait for connection
    setUserInputText('');
    setIsAiTyping(true);
    setStreamingStatus(null);
    setIsStreaming(true);

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

    // Save to Firebase (non-blocking for UI)
    const updatedChatId = await AppendToChat(currentChatID, newUserMessage);
    if (updatedChatId && updatedChatId !== currentChatID) {
      setChatId(updatedChatId);
    }

    let fullResponse = "";
    let empatheticMessageId = null; // Track empathetic message bubble
    let quizMessageId = null; // Track quiz bubble

    try {
      // Use WebSocket with all your current logic
      await ask_llm_websocket(
        currentLanguage,
        messageToSend,
        formatChatHistory(chatMessages),
        formatFilesForAPI(uploadedFilesList),
        updatedChatId || currentChatID,

        // Status callback - handles all your current status updates
        (statusUpdate) => {

          // Empathetic message start
          if (statusUpdate.status === "empathetic_message_start") {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log("💬 EMPATHETIC MESSAGE START");
            console.log("   - Removing generic placeholder:", streamingMessageId);
            console.log("   - Creating empathetic message bubble");

            // Create a NEW message bubble for empathetic text
            empatheticMessageId = `empathetic-${Date.now()}`;
            console.log("   - New empatheticMessageId:", empatheticMessageId);

            setChatMessages(prev => {
              console.log("   - Messages before filter:", prev.length);
              // Remove the generic placeholder if it exists
              const filtered = prev.filter(msg => msg.id !== streamingMessageId);
              console.log("   - Messages after filter:", filtered.length);

              return [...filtered, {
                id: empatheticMessageId,
                role: 'assistant',
                content: '',
                type: 'text', // Regular text message
                isStreaming: true,
                timestamp: new Date()
              }];
            });

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return;
          }

          // Empathetic message chunk (stream text)
          if (statusUpdate.status === "empathetic_message_chunk") {
            console.log("💬 Empathetic chunk:", statusUpdate.chunk);

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
            console.log("✅ Empathetic message complete");

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
            console.log("generating quiz streaming");
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
                      ? { ...msg, content: statusUpdate.message }
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
                      quizData: [],
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
            console.log("📝 Quiz question received:", statusUpdate.total_so_far);

            // Use quizMessageId if empathetic message exists, otherwise streamingMessageId
            const targetMessageId = quizMessageId || streamingMessageId;

            setChatMessages(prev =>
              prev.map(msg => {
                if (msg.id === targetMessageId && msg.type === 'quiz') {
                  const newQuizData = [...(msg.quizData || []), statusUpdate.question];
                  console.log("✅ Appended question, total:", newQuizData.length);

                  return {
                    ...msg,
                    quizData: newQuizData,
                    content: `Quiz - ${statusUpdate.total_so_far} questions générées`,
                    isStreaming: true
                  };
                }
                return msg;
              })
            );

            return;
          }

          // Quiz complete
          if (statusUpdate.status === "quiz_complete") {
            console.log("quiz completed");

            // Use quizMessageId if empathetic message exists, otherwise streamingMessageId
            const targetMessageId = quizMessageId || streamingMessageId;

            handleQuizComplete(statusUpdate.quiz_data, targetMessageId, updatedChatId);
            setStreamingStatus(null);
            return;
          }

          // Flashcard generation progress (EXACTLY like quiz)
          // Flashcard generation progress
          if (statusUpdate.status === "flashcard_generating") {
            console.log("📇 Flashcard generation streaming started");
            isQuizGeneratingRef.current = true;

            setChatMessages(prev => {
              return prev.map(msg => {
                // Convert streaming placeholder to flashcard message
                if (msg.id === streamingMessageId) {
                  return {
                    ...msg,
                    type: 'flashcard',
                    content: statusUpdate.message,
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
              message: statusUpdate.message
            });
            return;
          }

          // Individual flashcard ready (EXACTLY like quiz_question)
          if (statusUpdate.status === "flashcard_ready") {
            console.log("📇 Flashcard received:", statusUpdate.total_so_far);

            setChatMessages(prev =>
              prev.map(msg => {
                if (msg.id === streamingMessageId && msg.type === 'flashcard') {
                  const newFlashcardData = [...(msg.flashcardData || []), statusUpdate.flashcard];
                  console.log("✅ Appended flashcard, total:", newFlashcardData.length);

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
            console.log("✅ Flashcards completed");

            handleFlashcardComplete(statusUpdate.flashcard_data, streamingMessageId, updatedChatId);
            setStreamingStatus(null);
            return;
          }

          // Prompts suggestions
          if (statusUpdate.status === "suggested_prompts" && statusUpdate.suggestions) {
            console.log("💡 Received suggestions:", statusUpdate.suggestions);
            setSuggestedPrompts(statusUpdate.suggestions);
            return;
          }

          // Study sheet generation trigger - create inline message
          // Handle both "study_sheet_trigger" (from tools) and "study_sheet_start" (from generator)
          if (statusUpdate.status === "study_sheet_trigger" || statusUpdate.status === "study_sheet_start") {
            console.log("📚 Study sheet started:", statusUpdate);

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
            console.log("📚 Study sheet chunk received");
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
            console.log("📚 Study sheet complete");

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

                console.log("📚 Saving study sheet to Firebase:", messageForFirebase.id);
                AppendToChat(updatedChatId || currentChatID, messageForFirebase)
                  .then(() => console.log('✅ Study sheet saved to Firebase'))
                  .catch(err => console.error('❌ Failed to save study sheet:', err));
              } else {
                console.log("⚠️ No streaming study sheet found to save");
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
            console.log("📚 Study sheet error:", statusUpdate.message);
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
            console.log("🎙️ Audio options received:", statusUpdate);

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
            console.log("🎙️ Audio generating:", statusUpdate.message);

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
            console.log("🎙️ Audio ready:", statusUpdate.topic);

            // Save audio to Firebase Storage and then save chat message
            if (currentChatID && statusUpdate.audio_base64) {
              saveAudioToStorage(currentChatID, statusUpdate.audio_base64, {
                topic: statusUpdate.topic,
                intent: statusUpdate.intent,
                duration: statusUpdate.audio_duration
              }).then(async (result) => {
                if (result.success) {
                  console.log("🎙️ Audio saved to Firebase Storage:", result.downloadURL);

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
                    console.log("🎙️ Audio message saved to Firestore");
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
            console.log("🎙️ Audio generation complete");
            setIsAiTyping(false);
            return;
          }

          // Audio error
          if (statusUpdate.status === "audio_error") {
            console.log("🎙️ Audio error:", statusUpdate.message);
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

        // Token callback - handles regular text streaming
        (chunk) => {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📦 CHUNK RECEIVED:', chunk);
          console.log('📏 Current fullResponse length:', fullResponse.length);
          console.log('🆔 streamingMessageId:', streamingMessageId);
          console.log('🆔 empatheticMessageId:', empatheticMessageId);

          fullResponse = (fullResponse + chunk);

          console.log('📏 NEW fullResponse length:', fullResponse.length);

          if (fullResponse.length > 0 && streamingStatus) {
            setStreamingStatus(null);
          }

          setChatMessages(prev => {
            console.log('🔍 Total messages in state:', prev.length);

            const found = prev.find(m => m.id === streamingMessageId);
            console.log('✅ Found streamingMessage:', !!found);
            if (found) {
              console.log('   - ID:', found.id);
              console.log('   - Type:', found.type || 'undefined');
              console.log('   - isStreaming:', found.isStreaming);
              console.log('   - Content length:', found.content?.length || 0);
            }

            const updated = prev.map(msg => {
              if (msg.id === streamingMessageId && msg.type !== 'quiz' && msg.type !== 'flashcard') {
                console.log('🎨 UPDATING MESSAGE');
                console.log('   - Previous content length:', msg.content?.length || 0);
                console.log('   - New content length:', fullResponse.length);
                console.log('   - isStreaming: true');
                return { ...msg, content: fullResponse, isStreaming: true };
              }
              return msg;
            });

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return updated;
          });
        },

        // Complete callback - handles end of stream
        async () => {
          setStreamingStatus(null);
          setIsStreaming(false); // Streaming complete

          // Check if this was a quiz (don't save quiz as text)
          if (isQuizGeneratingRef.current) {
            console.log("⏭️ Skipping complete callback - was a quiz");
            isQuizGeneratingRef.current = false;
            setIsAiTyping(false);
            return;
          }

          // Only save text responses
          // ✅ FIX: Reuse streamingMessageId to prevent duplicates
          const finalMessage = {
            id: streamingMessageId, // Reuse the streaming placeholder ID
            role: "assistant",
            content: fullResponse,
            timestamp: new Date(),
            isStreaming: false
          };

          console.log('💾 Saving final message with ID:', streamingMessageId);
          await AppendToChat(updatedChatId || currentChatID, finalMessage);

          console.log('🔄 Updating streaming message to final (isStreaming: false)');
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
      setStreamingStatus(null);
      setIsStreaming(false); // Streaming stopped due to error

      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === streamingMessageId
            ? {
              ...msg,
              content: "Une erreur de connexion est survenue. Veuillez réessayer.",
              error: true,
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
    console.log('🛑 User requested to stop streaming');

    try {
      // Send cancel message via WebSocket
      const success = await cancelWebSocketStream(currentChatID);

      if (success) {
        console.log('✅ Stop request sent successfully');

        // Immediately update UI state
        setIsStreaming(false);
        setIsAiTyping(false);
        setStreamingStatus(null);

        // Remove or finalize streaming messages
        setChatMessages(prev =>
          prev.map(msg => {
            if (msg.isStreaming) {
              // Handle quiz messages - finalize with whatever was generated
              if (msg.type === 'quiz' && msg.quizData && msg.quizData.length > 0) {
                console.log(`🛑 Finalizing quiz with ${msg.quizData.length} questions`);
                return {
                  ...msg,
                  isStreaming: false,
                  stopped: true,
                  content: `Quiz stopped - ${msg.quizData.length} questions generated`
                };
              }

              // Handle flashcard messages - finalize with whatever was generated
              if (msg.type === 'flashcard' && msg.flashcardData && msg.flashcardData.length > 0) {
                console.log(`🛑 Finalizing flashcards with ${msg.flashcardData.length} cards`);
                return {
                  ...msg,
                  isStreaming: false,
                  stopped: true,
                  content: `Flashcards stopped - ${msg.flashcardData.length} cards generated`
                };
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
              console.log(`🛑 Removing empty streaming message: ${msg.id}`);
              return null;
            }
            return msg;
          }).filter(Boolean) // Remove null entries
        );
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
    console.log("💡 User clicked suggestion:", suggestion);

    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    // Clear suggestions immediately
    setSuggestedPrompts([]);

    // Auto-send the message
    handleSendNewUserMessage(null, suggestion);
  }, [handleSendNewUserMessage]);


  // ✅ FIXED: Use ref instead of state for synchronous updates
  const handleQuizAnswerSelect = async (answerData) => {
    try {
      // Check if this is a flashcard review instead of quiz answer
      if (answerData.cardIndex !== undefined) {
        return handleFlashcardReview(answerData);
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📝 Quiz answer received:");
      console.log("  Message ID:", answerData.messageId);
      console.log("  Question Index:", answerData.quizIndex);
      console.log("  Selected:", answerData.selectedOptionText);
      console.log("  Correct?", answerData.isCorrect ? "✓" : "✗");

      // ✅ FIX: Prevent double-submission
      const answerKey = `${answerData.messageId}-${answerData.quizIndex}`;
      if (submittedAnswersRef.current.has(answerKey)) {
        console.log("  ⚠️ Answer already submitted, ignoring duplicate");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        return;
      }
      submittedAnswersRef.current.add(answerKey);

      // ✅ Track progress: XP, serum, and topic stats
      const quizTopic = answerData.topic || null;
      if (answerData.isCorrect) {
        console.log("  🎯 Recording correct answer for progress tracking");
        addCorrectAnswer(quizTopic);
      } else {
        console.log("  📊 Recording incorrect answer for topic stats");
        addIncorrectAnswer(quizTopic);
      }

      // ✅ Find the message to check if it's still streaming
      const quizMessage = chatMessages.find(msg => msg.id === answerData.messageId);
      const isStreaming = quizMessage?.isStreaming;

      console.log("  Quiz streaming?", isStreaming ? "YES ⏳" : "NO ✓");
      console.log("  Current quiz questions:", quizMessage?.quizData?.length || 0);

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

          console.log("  ✓ Updated UI state for Q" + (answerData.quizIndex + 1));
          return { ...msg, quizData: updatedQuizData };
        })
      );

      // ✅ FIX: If still streaming, store in REF (synchronous!)
      if (isStreaming) {
        console.log("  ⏳ Storing in pendingQuizAnswersRef (will save when quiz completes)");

        // ✅ Direct ref mutation - happens IMMEDIATELY (no async delay)
        if (!pendingQuizAnswersRef.current[answerData.messageId]) {
          pendingQuizAnswersRef.current[answerData.messageId] = {};
        }
        pendingQuizAnswersRef.current[answerData.messageId][answerData.quizIndex] = answerData;

        console.log("  📦 Pending answers now:",
          Object.keys(pendingQuizAnswersRef.current[answerData.messageId]).length
        );
        console.log("  📦 Full pending object:", pendingQuizAnswersRef.current);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        return; // Don't save to Firebase yet
      }

      // ✅ If NOT streaming, save immediately to Firebase
      console.log("  💾 Quiz is finalized - saving to Firebase immediately");
      await UpdateQuizAnswer(
        currentChatID,
        answerData.messageId,
        answerData.questionText,
        answerData
      );

      console.log("  ✅ Saved to Firebase successfully");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    } catch (error) {
      console.error("❌ Failed to save quiz answer:", error);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
  };

  const handleQuizInteraction = useCallback((quizId) => {
    console.log('📝 Quiz interaction:', quizId);
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
    console.log('👁️ Quiz visibility change:', {
      messageId: quizData.messageId,
      isVisible: quizData.isVisible,
      activeQuizId: activeQuizId,
      isActive: quizData.messageId === activeQuizId
    });

    if (quizData.isVisible) {
      // Only show sticky if this is the active quiz
      if (quizData.messageId === activeQuizId) {
        console.log('✅ Showing sticky bar for active quiz');
        setActiveQuizProgress(quizData);
      } else {
        console.log('⏭️ Ignoring non-active quiz');
      }
    } else {
      setActiveQuizProgress(prev => {
        if (prev && prev.messageId === quizData.messageId) {
          console.log('✅ Hiding sticky bar (inline visible)');
          return null;
        }
        return prev;
      });
    }
  }, [activeQuizId]); // Important: Add activeQuizId to dependencies

  const handleQuizComplete = async (quizData, messageId, chatId) => {
    console.log("✅ Quiz complete, finalizing message");
    console.log("Backend sent", quizData?.length, "questions");
    setStreamingStatus(null);

    // ✅ Get pending answers from ref FIRST
    const pendingAnswers = pendingQuizAnswersRef.current[messageId] || {};
    console.log("📦 Pending answers from REF:", pendingAnswers);
    console.log("📦 Number of pending answers:", Object.keys(pendingAnswers).length);

    // ✅ NEW FIX: Build merged data BEFORE touching state
    // Trust the ref as the source of truth for streaming answers
    const mergedQuizData = quizData.map((question, idx) => {
      const pendingAnswer = pendingAnswers[idx];

      if (pendingAnswer) {
        console.log(`✓ Q${idx + 1}: Using pending answer from REF`);
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

      console.log(`- Q${idx + 1}: No answer`);
      return question;
    });

    console.log("📊 Final merge result:",
      mergedQuizData.filter(q => q.userSelection).length,
      "answered questions out of",
      mergedQuizData.length
    );

    // ✅ Update UI state with merged data
    setChatMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId && msg.type === 'quiz') {
          return {
            ...msg,
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
    console.log("💾 Saving to Firebase:",
      mergedQuizData.filter(q => q.userSelection).length,
      "answered questions"
    );

    console.log("🔍 DEBUG - mergedQuizData contents:", mergedQuizData);

    mergedQuizData.forEach((q, idx) => {
      if (q.userSelection) {
        console.log(`  Q${idx + 1}: ${q.userSelection.isCorrect ? '✓' : '✗'} - ${q.userSelection.selectedOptionText}`);
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

    console.log("🔍 DEBUG - messageToSave.quizData:", messageToSave.quizData);
    console.log("🔍 DEBUG - messageToSave.quizData length:", messageToSave.quizData.length);

    // ✅ Try to save, retry once if it fails
    try {
      await AppendToChat(chatId, messageToSave);
      console.log("✅ Firebase save successful");
    } catch (error) {
      console.error("❌ Firebase save failed, retrying once:", error);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await AppendToChat(chatId, messageToSave);
        console.log("✅ Firebase save successful on retry");
      } catch (retryError) {
        console.error("❌ Firebase save failed on retry:", retryError);
        // Don't throw - let user continue, data is in UI
      }
    }

    // ✅ Clear ref
    if (pendingQuizAnswersRef.current[messageId]) {
      delete pendingQuizAnswersRef.current[messageId];
      console.log("🧹 Cleared pending answers from ref");
    }

    // ✅ Clear submission tracking for this quiz
    submittedAnswersRef.current = new Set(
      Array.from(submittedAnswersRef.current).filter(key => !key.startsWith(messageId))
    );
    console.log("🧹 Cleared submission tracking for quiz");

    setIsAiTyping(false);
    console.log("✅ Quiz save complete!");
  };

  const handleFlashcardComplete = async (flashcardData, messageId, chatId) => {
    console.log("✅ Flashcards complete, finalizing message");
    console.log("📦 Backend sent", flashcardData?.length, "flashcards");
    setStreamingStatus(null);

    // Initialize flashcard data with status (same as quiz initializes with answers)
    const initializedFlashcards = flashcardData.map(card => ({
      ...card,
      status: 'new',
      reviewCount: 0,
      lastReviewed: null
    }));

    console.log("🎴 Initialized flashcards:", initializedFlashcards);

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
    console.log("💾 Saving to Firebase:",
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

    // ✅ Try to save, retry once if it fails (EXACTLY like quiz)
    try {
      await AppendToChat(chatId, messageToSave);
      console.log("✅ Firebase save successful");
    } catch (error) {
      console.error("❌ Firebase save failed, retrying once:", error);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await AppendToChat(chatId, messageToSave);
        console.log("✅ Firebase save successful on retry");
      } catch (retryError) {
        console.error("❌ Firebase save failed on retry:", retryError);
        // Don't throw - let user continue, data is in UI
      }
    }

    setIsAiTyping(false);
    console.log("✅ Flashcard save complete!");
  };

  const handleFlashcardReview = async (reviewData) => {
    try {
      console.log("📇 Flashcard review received:", reviewData);

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

          console.log("✅ Updated flashcard UI state for card", reviewData.cardIndex + 1);
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

      console.log("✅ Flashcard review saved to Firebase");
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

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

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
      }
    } catch (error) {
      console.error('Failed to ensure chat exists:', error);
      return;
    }

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
    console.log(`📦 Created loading message BEFORE upload: ${loadingMsgId}`);
    console.log(`   File count: ${files.length}`);

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

    e.target.value = null;
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

    console.log(`📤 Processing ${pendingUploadFiles.length} pending upload(s) from landing page`);
    pendingUploadProcessedRef.current = true;
    setShouldProcessPendingUpload(false);

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
  }, [shouldProcessPendingUpload, pendingUploadFiles, onPendingUploadProcessed]);

  // Progress handler - add this as a new function in your component
  const handleUploadProgress = (update, fileTracker, chatId) => {
    console.log('📦 Upload progress:', update.type, update);

    switch (update.type) {
      case 'batch_start':
        console.log(`🚀 Starting upload of ${update.total_files} files`);
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
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔍 INSIGHT_BATCH RECEIVED`);
        console.log(`   Filename: ${update.filename}`);
        console.log(`   Topics:`, update.topics);
        console.log(`   Concepts:`, update.concepts);

        const msgId = uploadMessageIdRef.current;
        if (!msgId) {
          console.error('⚠️ No uploadMessageId - this should never happen now!');
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          return;
        }

        console.log(`   Message ID: ${msgId}`);

        // 🆕 FIX: Accumulate in REF first (synchronous, no race!)
        const newInsight = {
          filename: update.filename,
          topics: update.topics || [],
          concepts: update.concepts || [],
          documentType: update.document_type
        };

        console.log(`   Created insight object:`, newInsight);

        // CRITICAL: Check ref BEFORE push
        console.log(`   🔍 Accumulator BEFORE push:`, uploadInsightsAccumulatorRef.current.length, 'items');
        console.log(`   🔍 Accumulator contents BEFORE:`, uploadInsightsAccumulatorRef.current.map(i => i.filename));

        uploadInsightsAccumulatorRef.current.push(newInsight);

        // CRITICAL: Check ref AFTER push
        console.log(`   ✅ Accumulator AFTER push:`, uploadInsightsAccumulatorRef.current.length, 'items');
        console.log(`   ✅ Accumulator contents AFTER:`, uploadInsightsAccumulatorRef.current.map(i => i.filename));

        // Update state with ALL accumulated insights (prevents race)
        setChatMessages(prev => {
          console.log(`   🔍 setChatMessages called`);
          console.log(`   🔍 Total messages in state:`, prev.length);

          const updated = prev.map(msg => {
            if (msg.id === msgId && msg.type === 'upload_loading') {
              console.log(`   ✅ Found upload_loading message!`);
              console.log(`   📊 Current insights in message:`, msg.insights?.length || 0);
              console.log(`   📊 New insights from ref:`, uploadInsightsAccumulatorRef.current.length);

              return {
                ...msg,
                insights: [...uploadInsightsAccumulatorRef.current]  // Use ref as source of truth
              };
            }
            return msg;
          });

          console.log(`   ✅ State update complete`);
          return updated;
        });

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        break;

      case 'upload_summary':
        console.log(`📝 Upload summary received:`, update.summary);

        setUploadSummary(update.summary);

        const summaryMsgId = uploadMessageIdRef.current;

        // Add summary to the loading message but KEEP showing all insights
        // Do NOT transition yet - wait for all_complete
        setChatMessages(prev => prev.map(msg => {
          if (msg.id === summaryMsgId && msg.type === 'upload_loading') {
            console.log('📝 Adding summary to loading message (still showing all insights)');
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
        console.log(`🔤 Embedding progress: ${update.stage}`);
        break;

      case 'embedding_complete':
        console.log(`✅ Embedded: ${update.word_count} words, ${update.chunks} chunks`);
        break;

      case 'firebase_start':
        console.log(`☁️ Starting Firebase upload...`);
        break;

      case 'firebase_complete':
        console.log(`✅ Firebase uploaded: ${update.firebase_url}`);
        break;

      case 'quiz_complete':
        console.log(`📝 Quiz generated: ${update.question_count} questions`);
        break;

      case 'file_complete':
        // Remove individual file messages - we're showing insights instead
        console.log(`✅ File complete: ${update.filename}`);
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
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎉 ALL_COMPLETE RECEIVED`);
        console.log(`   Completed: ${update.completed_files}/${update.total_files}`);

        setIsUploadAnalyzing(false);

        const completeMsgId = uploadMessageIdRef.current;
        if (!completeMsgId) {
          console.warn('⚠️ No uploadMessageId found for completion');
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          return;
        }

        console.log(`   Message ID: ${completeMsgId}`);
        console.log(`   🔍 Accumulator final count: ${uploadInsightsAccumulatorRef.current.length}`);
        console.log(`   🔍 Accumulator final files:`, uploadInsightsAccumulatorRef.current.map(i => i.filename));

        // Mark the loading message as complete AND save to Firebase
        setChatMessages(prev => {
          console.log(`   🔍 Total messages in state: ${prev.length}`);

          return prev.map(msg => {
            if (msg.id === completeMsgId && msg.type === 'upload_loading') {
              console.log(`   ✅ Found upload_loading message to complete`);
              console.log(`   📊 Message insights BEFORE completion:`, msg.insights?.length || 0, 'items');
              console.log(`   📊 Files in message:`, msg.insights?.map(i => i.filename) || []);

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

              console.log(`   📊 Completed message created:`);
              console.log(`      - Insight count: ${completedMsg.insights?.length}`);
              console.log(`      - Files:`, completedMsg.insights?.map(i => i.filename));
              console.log(`      - Has summary: ${!!completedMsg.summary}`);
              console.log(`      - File count: ${completedMsg.fileCount}`);

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

              console.log('💾 Saving to Firebase with', messageForFirebase.insights?.length, 'insights');

              // Save LoadingMessageBox to Firebase and store the promise
              // This ensures it gets a serverTimestamp BEFORE the post-upload message
              const savePromise = AppendToChat(chatId, messageForFirebase)
                .then(() => console.log('✅ Saved completed insights to Firebase'))
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

        // NOTE: PostUploadActions will be added when 'post_upload_message' event fires from backend
        break;

      case 'error':
        console.error('❌ Batch error:', update.message);
        setIsUploadAnalyzing(false);
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
        console.log('📬 Post-upload message received:', update);

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
            console.log('⚠️ Post-upload message for these files already exists, skipping duplicate');
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
          console.log('✅ Post-upload actions saved to Firebase');
        };

        savePostUpload().catch(err => console.error('❌ Failed to save post-upload actions:', err));

        console.log('✅ Post-upload message added to chat');
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
  const handlePostUploadAction = async (actionId, messageData) => {
    console.log('🎯 Post-upload action clicked:', actionId, messageData);
    console.log('🎯 Current chatId:', currentChatID);

    // Step 1: Hide action buttons on this message
    // This prevents double-clicks and shows the action was taken
    setChatMessages(prev => prev.map(msg =>
      msg.id === messageData.id
        ? { ...msg, showActions: false }
        : msg
    ));

    // Step 2: Build prompt based on action type
    // Include topics for context so AI knows what to focus on
    const topicsStr = messageData.topics?.length > 0
      ? messageData.topics.join(', ')
      : 'the uploaded material';

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
      quiz: t('postUpload.quizPrompt', { topics: topicsStr }),
      flashcards: t('postUpload.flashcardsPrompt', { topics: topicsStr }),
      studysheet: t('postUpload.studysheetPrompt')
    };

    const promptToSend = prompts[actionId];
    console.log('🎯 Prompt to send:', promptToSend);

    if (!promptToSend) {
      console.warn('Unknown action:', actionId);
      return;
    }

    // Step 3: Send as user message (uses existing chat flow)
    // This triggers the normal AI response handling
    // We pass null for the event and the prompt as customPrompt
    console.log('🎯 Calling handleSendNewUserMessage...');
    await handleSendNewUserMessage(null, promptToSend);
    console.log('🎯 handleSendNewUserMessage completed');
  };



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
  // QUIZ FEEDBACK HANDLING
  // ============================================
  const handleQuizFeedback = useCallback(async (messageId, feedbackData) => {
    try {
      console.log("📝 Saving quiz feedback:", { messageId, feedbackData });
      await SaveQuizFeedback(currentChatID, messageId, feedbackData);

      // Update local state to reflect feedback given
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, feedbackData: { ...feedbackData, submittedAt: new Date() } }
            : msg
        )
      );
    } catch (error) {
      console.error("Failed to save quiz feedback:", error);
    }
  }, [currentChatID]);

  // ============================================
  // FLASHCARD FEEDBACK HANDLING
  // ============================================
  const handleFlashcardFeedback = useCallback(async (messageId, feedbackData) => {
    try {
      console.log("📝 Saving flashcard feedback:", { messageId, feedbackData });
      await SaveQuizFeedback(currentChatID, messageId, feedbackData);

      // Update local state to reflect feedback given
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, feedbackData: { ...feedbackData, submittedAt: new Date() } }
            : msg
        )
      );
    } catch (error) {
      console.error("Failed to save flashcard feedback:", error);
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
      console.log("🗑️ Deleting message:", messageId);

      // Delete from Firebase
      await DeleteMessage(currentChatID, messageId);

      // Update local state to remove the message
      setChatMessages(prev => prev.filter(msg => msg.id !== messageId));

      console.log("✅ Message deleted successfully");
    } catch (error) {
      console.error("❌ Failed to delete message:", error);
      alert("Failed to delete message: " + error.message);
    }
  }, [currentChatID]);

  const hasMessages = chatMessages.length > 0;
  console.log('🎮 Render state:', { isGameChat, hasMessages, messageCount: chatMessages.length, gameState });
  const openFileUploadDialog = () => documentFileInputRef.current?.click();

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

      console.log('📚 Created exam prep chat:', docRef.id, 'for exam:', newExam.id);

    } catch (error) {
      console.error('Error creating exam prep chat:', error);
    } finally {
      setIsCreatingExamChat(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <ProgressDashboard />

      <div
        className="chat-container"
      >
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
            {/* Progress Widget - Next to title */}
            <CompactProgressWidget />
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


        {/* Empty State - Exam-linked chat: show upload only with exam context */}
        {!hasMessages && isChatDataLoaded && !isGameChat && currentExamData && (
          <div className="empty-chat-state exam-linked">
            <div className="exam-context-header">
              <h3 className="exam-context-title">{currentExamData.examName}</h3>
              {currentExamData.examDate && <ExamCountdown examDate={currentExamData.examDate} />}
            </div>
            <button className="exam-start-btn" onClick={openFileUploadDialog}>
              <span className="exam-start-icon">📄</span>
              <span className="exam-start-text">Drop your notes & start studying</span>
              <span className="exam-start-arrow">→</span>
            </button>
          </div>
        )}

        {/* Empty State - Regular chat: show two-card layout */}
        {!hasMessages && isChatDataLoaded && !isGameChat && !currentExamData && (
          <div className="empty-chat-state">
            <div className="empty-chat-actions">
              {/* Upload Card */}
              <div className="empty-action-card" onClick={openFileUploadDialog}>
                <SvgFileUpload />
                <div className="empty-action-content">
                  <p className="empty-action-title">{t('chat.uploadDocument', 'Upload Document')}</p>
                  <p className="empty-action-subtitle">{t('chat.uploadHint', 'PDF, images, notes')}</p>
                </div>
              </div>

              {/* Exam Prep Card */}
              <div className="empty-action-card" onClick={() => setShowExamPrepModal(true)}>
                <span className="empty-action-icon">🎯</span>
                <div className="empty-action-content">
                  <p className="empty-action-title">{t('chat.prepareExam', 'Prepare for Exam')}</p>
                  <p className="empty-action-subtitle">{t('chat.examHint', 'Track your progress')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exam Prep Modal */}
        {showExamPrepModal && (
          <ExamPrepModal
            onClose={() => setShowExamPrepModal(false)}
            onSubmit={handleExamPrepSubmit}
            isSubmitting={isCreatingExamChat}
          />
        )}

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
              onClick={() => window.location.href = '/'}
            >
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
            {chatMessages.map((message) => {
              // ============================================
              // UPLOAD LOADING BOX
              // ============================================
              // Shows progress while files are being analyzed.
              // Always visible - shows analysis stats even when complete.
              // ============================================
              if (message.type === 'upload_loading') {
                return (
                  <LoadingMessageBox
                    key={message.id}
                    isLoading={message.isLoading}
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
                        onAction={(actionId) => handlePostUploadAction(actionId, message)}
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
                      <StudySheetSimple
                        topic={message.topic}
                        content={message.content}
                        isStreaming={message.isStreaming}
                        error={message.error}
                        inline={true}
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
                      />
                    </div>
                  </div>
                );
              }

              // Regular messages - also render streaming messages with empty content (shows loading heart)
              if ((typeof message.content === 'string' && message.content.trim()) || message.isStreaming) {
                // Check if this is the last user message
                const isLastUserMessage = message.role === 'user' &&
                  chatMessages.findIndex(m => m.id === message.id) ===
                  chatMessages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i !== -1).pop();

                return (
                  <div
                    key={message.id}
                    ref={isLastUserMessage ? lastUserMessageRef : null}
                  >
                    <ChatMessage
                      message={message}
                      onOptionClick={handlePostDocumentUploadOption}
                      onQuizAnswerSelect={handleQuizAnswerSelect}
                      uploadedFilesList={uploadedFilesList}
                      onQuizVisibilityChange={handleQuizVisibilityChange}
                      onQuizInteraction={handleQuizInteraction}
                      isActiveQuiz={message.id === activeQuizId}
                      onFeedbackSubmit={handleQuizFeedback}
                      onSendMessage={handleSendNewUserMessage}
                      onDeleteMessage={handleDeleteMessage}
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

          {/*  //NEW: Suggested Prompts - Above Input  */}
          <div className='message ai-message'>
            <SuggestedPrompts
              suggestions={suggestedPrompts}
              onSuggestionClick={handleSuggestionClick}
              isLoading={isAiTyping}
            />
          </div>


          {/* Scroll to Bottom Button */}
          {showScrollButton && isInitialLoadComplete && (
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


        {/* Input Area */}
        <form className="input-area" onSubmit={handleSendNewUserMessage}>
          <input
            type="file"
            ref={documentFileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            multiple
          />

          {/* Input wrapper - vertical layout with buttons at bottom */}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // submit form when user presses enter
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              className="message-textarea"
            />

            {/* Bottom row: file buttons on left, send button on right */}
            <div className="input-actions-bottom">
              <div className="input-actions-left-group">
                <button type="button"
                  className="upload-button file-button"
                  onClick={openFileUploadDialog}
                  title={t('chat.addFile')}
                  disabled={isSystemBusy()}>
                  <SvgFileUpload />
                </button>

                <button type="button"
                  className="upload-button photo-button"
                  onClick={() => setIsFilesModalVisible(true)}
                  title={t('chat.filesInMemory')}
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

              {/* Send or Stop button on the right */}
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
                  className={`send-button-icon ${isSystemBusy() ? 'send-button-busy' : ''}`}
                  disabled={!userInputText.trim() || isSystemBusy()}
                  title={t('chat.send')}>
                  {isSystemBusy() ? (
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
                      {uploadedFilesList.map(file => (
                        <li key={file.id} className="file-item">
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
                          </div>

                          <div className="file-actions">
                            {/* <button
                            className="file-action-btn"
                            onClick={() => handlePostDocumentUploadOption("Résumé", file.name)}
                            title={t('file.summarize')}
                          >
                            📝 {t('file.summary')}
                          </button>
                          <button
                            className="file-action-btn"
                            onClick={() => handlePostDocumentUploadOption("Quiz", file.name)}
                            title={t('file.generateQuiz')}
                          >
                            🧠 Quiz
                          </button> */}
                            {/* <button
                            className="file-action-btn"
                            onClick={() => handlePostDocumentUploadOption("Mise en situation", file.name)}
                            title={t('file.createScenario')}
                          >
                            🎭 {t('file.scenario')}
                          </button> */}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )
        }
      </div >
    </div >
  );
};

export default ChatInterface;
