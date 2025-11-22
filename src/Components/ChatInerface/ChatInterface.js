import { useState, useRef, useEffect, useCallback } from 'react';
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
  SaveQuizFeedback
} from '../../Services/FireBaseServiceChats.js';

import { loadFilesForChat } from '../../Services/FireBaseFiles.js';
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
  ask_llm_websocket,  // Replace ask_llm_stream
  warmUpWebSocket,
  closeWebSocketConnection,
  setupWebSocketKeepalive,
} from '../../Services/WebSocketManager.js';

// Styles
import './ChatInterface.css';

// translation
import { useTranslation } from 'react-i18next';
import StudyGuideGenerator from './StudyGuideGenerator.js';
import StudySheetLivePreview from './StudySheetLivePreview.js';
import StickyQuizProgress from './StickyQuizProgress';
import SuggestedPrompts from './SuggestedPrompts';



/**
 * ChatInterface Component - A messenger-like interface for AI chat
 * Features: Text messaging with AI, File uploads, Quiz/Summary/Scenario generation
 */
const ChatInterface = ({ chatId, onChatSelected, onCloseSidebar }) => {

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
  const [userInputText, setUserInputText] = useState('');
  const [uploadedFilesList, setUploadedFilesList] = useState([]);

  // UI state
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState(null);
  const [isFilesModalVisible, setIsFilesModalVisible] = useState(false);

  // Upload insights state
  const [uploadInsights, setUploadInsights] = useState([]);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [isUploadAnalyzing, setIsUploadAnalyzing] = useState(false);
  const [uploadMessageId, setUploadMessageId] = useState(null);

  const [activeStudySheet, setActiveStudySheet] = useState(null);
  const [studySheetWebSocketData, setStudySheetWebSocketData] = useState(null);


  // State for sticky quiz progress bar
  const [activeQuizProgress, setActiveQuizProgress] = useState(null);

  //Track which quiz is currently active
  const [activeQuizId, setActiveQuizId] = useState(null);

  // track sugggested prompts that is received after each message
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);

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


  // track if connection is alive
  const [wsKeepalive, setWsKeepalive] = useState(null);
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
  const isQuizGeneratingRef = useRef(false);
  // in case the user answers quiz while its being loaded and streamed
  const pendingQuizAnswersRef = useRef({});
  // Track which questions have been submitted (prevent double-submit)
  const submittedAnswersRef = useRef(new Set());
  const hasInitiallyScrolledRef = useRef(false);
  // Track upload message ID for synchronous updates
  const uploadMessageIdRef = useRef(null);
  // 🆕 Track insights accumulation to avoid race conditions
  const uploadInsightsAccumulatorRef = useRef([]);

  // Track if user is at bottom of chat
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  // manage websocket connection everytime currentChatID changes
  useEffect(() => {
    if (currentChatID) {
      // Warm up WebSocket connection
      const initWebSocket = async () => {
        setConnectionStatus('connecting');
        try {
          await warmUpWebSocket(currentChatID);
          setConnectionStatus('connected');

          // Setup keepalive
          const keepaliveInterval = setupWebSocketKeepalive(currentChatID);
          setWsKeepalive(keepaliveInterval);
        } catch (error) {
          console.error('WebSocket initialization failed:', error);
          setConnectionStatus('error');
        }
      };

      initWebSocket();

      // Cleanup on unmount or chat change
      return () => {
        if (wsKeepalive) {
          clearInterval(wsKeepalive);
        }
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

    const threshold = 100; // pixels from bottom
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Scroll to bottom using messagesEndRef (more reliable than scrollHeight)
  const scrollToBottom = useCallback((behavior = 'auto') => {
    // Try scrollIntoView first (most reliable)
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
    // Fallback to scrollTop method
    else if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // Handle scroll event to show/hide button
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isAtBottom = isNearBottom();
    setShowScrollButton(!isAtBottom);
  }, [isNearBottom]);

  // Initial scroll to bottom ONLY on first load
  useEffect(() => {
    if (chatMessages.length > 0 && !hasInitiallyScrolledRef.current) {
      const container = messagesContainerRef.current;
      if (!container) return;

      // IMMEDIATE first scroll - prevents flash of content at wrong position
      scrollToBottom('auto');

      let lastHeight = 0;
      let stableCount = 0;

      // Keep checking and re-scrolling as content loads (quizzes, images, etc.)
      const checkHeight = () => {
        const currentHeight = container.scrollHeight;

        if (currentHeight === lastHeight) {
          stableCount++;
          if (stableCount >= 3) {
            // Height stable, final scroll and we're done
            scrollToBottom('auto');
            hasInitiallyScrolledRef.current = true;
            setIsInitialLoadComplete(true); // Show content now!
            return;
          }
        } else {
          // Height changed, scroll again and reset counter
          scrollToBottom('auto');
          stableCount = 0;
        }

        lastHeight = currentHeight;

        // Keep checking until stable
        if (stableCount < 3) {
          setTimeout(checkHeight, 100);
        }
      };

      // Start checking after initial render
      setTimeout(checkHeight, 100);
    }
  }, [chatMessages.length, scrollToBottom]);

  // Auto-scroll on new messages only if already at bottom
  useEffect(() => {
    if (chatMessages.length > 0 && isNearBottom()) {
      scrollToBottom('auto');
    }
  }, [chatMessages, isNearBottom, scrollToBottom]);

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

  // Sync with parent chatId prop
  useEffect(() => {
    if (chatId && chatId !== currentChatID) {
      // Clear messages immediately to force loader to show
      setChatMessages([]);

      // Update chat ID
      setChatId(chatId);

      // Reset scroll and loading flags
      hasInitiallyScrolledRef.current = false;
      setIsInitialLoadComplete(false);

      // Clear UI states from previous chat
      setSuggestedPrompts([]);           // Clear suggested prompts (fixes reported bug)
      setActiveQuizProgress(null);       // Clear sticky quiz progress bar
      setActiveQuizId(null);             // Clear active quiz tracking
      setActiveStudySheet(null);         // Close study sheet panel
      setStudySheetWebSocketData(null);  // Clear study sheet data
      setIsAiTyping(false);              // Clear typing indicator
      setStreamingStatus(null);          // Clear streaming status

      // Get chat title
      const chatDocRef = doc(db, "chats", chatId);
      getDoc(chatDocRef).then((docSnapshot) => {
        if (docSnapshot.exists()) {
          const chatData = docSnapshot.data();
          setChatTitle(chatData.title);
        }
      });
    }
  }, [chatId, currentChatID]);

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

      // CRITICAL FIX: Preserve upload_loading messages that exist in state but not in Firebase yet
      // These are actively being updated with streaming insights
      setChatMessages(prev => {
        // Find any upload_loading messages in current state
        const activeUploadMessages = prev.filter(msg =>
          msg.type === 'upload_loading' && msg.isLoading === true
        );

        if (activeUploadMessages.length === 0) {
          // No active uploads, just use Firebase data
          return loadedMessages;
        }

        // Merge: Keep active upload messages, add Firebase messages
        // Remove any upload_loading from Firebase (they're complete)
        const firebaseWithoutUploads = loadedMessages.filter(msg =>
          msg.type !== 'upload_loading'
        );

        // Insert active upload messages in correct position (usually at end)
        // Find where they were in the previous array
        const result = [...firebaseWithoutUploads];
        activeUploadMessages.forEach(uploadMsg => {
          // Add at end if not found, or keep relative position
          result.push(uploadMsg);
        });

        console.log('🔄 Merged messages:', {
          fromFirebase: firebaseWithoutUploads.length,
          activeUploads: activeUploadMessages.length,
          total: result.length
        });

        return result;
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

  // Auto-scroll on new messages (but not during streaming)
  useEffect(() => {
    if (!isAiTyping) {
      var lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage && lastMessage.type !== "quiz") {
        scrollToBottom();
      }

    }
  }, [chatMessages.length, isAiTyping, scrollToBottom]); // scroll down only if a new message is added at the bottom and once the AI finishes typing


  const { t, i18n } = useTranslation();

  const currentLanguage = i18n.language;

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  const handleSendNewUserMessage = async (e = null, customPrompt = null) => {
    if (e) e.preventDefault();

    // clear the state of suggested prompts
    setSuggestedPrompts([]);

    const messageToSend = customPrompt ?? userInputText;
    if (messageToSend.trim() === '') return;

    // Check WebSocket connection status
    if (connectionStatus !== 'connected') {
      console.warn('WebSocket not connected, attempting to reconnect...');
      try {
        await warmUpWebSocket(currentChatID);
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Failed to establish WebSocket connection:', error);
        setConnectionStatus('error');
        return;
      }
    }

    // Add user message
    const newUserMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageToSend,
    };

    setChatMessages(prev => [...prev, newUserMessage]);
    setUserInputText('');

    // Save to Firebase
    const updatedChatId = await AppendToChat(currentChatID, newUserMessage);
    if (updatedChatId && updatedChatId !== currentChatID) {
      setChatId(updatedChatId);
    }

    // Prepare for streaming
    setIsAiTyping(true);
    setStreamingStatus(null);

    const streamingMessageId = `streaming-${Date.now()}`;
    const placeholderMessage = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, placeholderMessage]);

    let fullResponse = "";

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

          // Quiz generation progress
          if (statusUpdate.status === "quiz_generating") {
            console.log("generating quiz streaming");
            isQuizGeneratingRef.current = true;
            setChatMessages(prev => {
              const existingQuiz = prev.find(msg =>
                msg.id === streamingMessageId && msg.type === 'quiz'
              );

              if (existingQuiz) {
                return prev.map(msg =>
                  msg.id === streamingMessageId && msg.type === 'quiz'
                    ? { ...msg, content: statusUpdate.message }
                    : msg
                );
              }

              return [...prev, {
                id: streamingMessageId,
                role: 'assistant',
                type: 'quiz',
                content: statusUpdate.message,
                quizData: [],
                isStreaming: true,
                timestamp: new Date()
              }];
            });

            setStreamingStatus({
              status: 'generating_quiz',
              message: statusUpdate.message
            });
            return;
          }

          // Individual quiz question ready
          if (statusUpdate.status === "quiz_question") {
            console.log("📝 Quiz question received:", statusUpdate.total_so_far);

            setChatMessages(prev =>
              prev.map(msg => {
                if (msg.id === streamingMessageId && msg.type === 'quiz') {
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
            handleQuizComplete(statusUpdate.quiz_data, streamingMessageId, updatedChatId);
            setStreamingStatus(null);
            return;
          }

          // Prompts suggestions
          if (statusUpdate.status === "suggested_prompts" && statusUpdate.suggestions) {
            console.log("💡 Received suggestions:", statusUpdate.suggestions);
            setSuggestedPrompts(statusUpdate.suggestions);
            return;
          }

          // Study sheet generation trigger
          if (statusUpdate.status === "study_sheet_trigger") {
            console.log("Study sheet triggered:", statusUpdate);

            setActiveStudySheet(null);

            setActiveStudySheet({
              topic: statusUpdate.topic,
              chatId: currentChatID,
              key: uuidv4()
            });

            onCloseSidebar();
            return;
          }

          // All study sheet streaming updates
          if (statusUpdate.status?.startsWith("study_sheet_")) {
            console.log("📚 Study sheet update:", statusUpdate.status, statusUpdate);

            // Pass the raw WebSocket data to the component
            setStudySheetWebSocketData(statusUpdate);

            // Special handling for completion
            if (statusUpdate.status === "study_sheet_complete") {
              saveStudySheetToChat(statusUpdate.html_content, updatedChatId);
            }

            return;
          }

          // Default status update
          setStreamingStatus(statusUpdate);
        },

        // Token callback - handles regular text streaming
        (chunk) => {
          console.log('📦 Chunk received In chatInterface:', chunk);
          fullResponse = (fullResponse + chunk);

          console.log('📏 fullResponse length:', fullResponse.length);
          console.log('🆔 streamingMessageId:', streamingMessageId);

          if (fullResponse.length > 0 && streamingStatus) {
            setStreamingStatus(null);
          }

          setChatMessages(prev => {
            console.log('🔍 Total messages:', prev.length);

            const found = prev.find(m => m.id === streamingMessageId);
            console.log('✅ Found message:', !!found, 'Type:', found?.type);

            const updated = prev.map(msg => {
              if (msg.id === streamingMessageId && msg.type !== 'quiz') {
                console.log('🎨 UPDATING MESSAGE with content length:', fullResponse.length);
                return { ...msg, content: fullResponse, isStreaming: true };
              }
              return msg;
            });

            return updated;
          });
        },

        // Complete callback - handles end of stream
        async () => {
          setStreamingStatus(null);

          // Check if this was a quiz (don't save quiz as text)
          if (isQuizGeneratingRef.current) {
            console.log("⏭️ Skipping complete callback - was a quiz");
            isQuizGeneratingRef.current = false;
            setIsAiTyping(false);
            return;
          }

          // Only save text responses
          const finalMessage = {
            id: uuidv4(),
            role: "assistant",
            content: fullResponse,
            timestamp: new Date(),
            isStreaming: false
          };

          await AppendToChat(updatedChatId || currentChatID, finalMessage);

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


  const saveStudySheetToChat = async (finalHtml, chatId) => {
    try {
      const studySheetMessage = {
        id: uuidv4(),
        role: "assistant",
        content: `Study sheet created ${activeStudySheet?.topic || ':Study Guide'}`,
        html: finalHtml,
        type: "studysheet",
        timestamp: new Date(),
        isStreaming: false
      };

      await AppendToChat(chatId, studySheetMessage);
      console.log('Study sheet saved to chat');
    } catch (error) {
      console.error('Error saving study sheet:', error);
    }
  };

  // ✅ FIXED: Use ref instead of state for synchronous updates
  const handleQuizAnswerSelect = async (answerData) => {
    try {
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

      // ✅ Find the message to check if it's still streaming
      const quizMessage = chatMessages.find(msg => msg.id === answerData.messageId);
      const isStreaming = quizMessage?.isStreaming;

      console.log("  Quiz streaming?", isStreaming ? "YES ⏳" : "NO ✓");
      console.log("  Current quiz questions:", quizMessage?.quizData?.length || 0);

      // ✅ Update UI immediately (optimistic update)
      setChatMessages(prev =>
        prev.map(msg => {
          if (msg.id !== answerData.messageId || msg.type !== 'quiz') return msg;

          const updatedQuizData = (msg.quizData || []).map((q, idx) =>
            idx === answerData.quizIndex
              ? {
                ...q,
                userSelection: {
                  selectedIndex: answerData.selectedOptionIndex,
                  selectedOptionText: answerData.selectedOptionText,
                  isCorrect: answerData.isCorrect,
                  timestamp: answerData.timestamp
                }
              }
              : q
          );

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
            content: `Voici votre quiz (${quizData.length} questions)`,
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
      content: `Votre quiz (${quizData.length} questions)`,
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
        (update) => handleUploadProgress(update, fileTracker, resolvedChatId)
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

              // Create the completed version - PRESERVE ALL FIELDS
              const completedMsg = {
                ...msg,
                isLoading: false,  // Stop spinner, show checkmark
                insights: msg.insights || [],  // Explicitly preserve
                summary: msg.summary || null,  // Explicitly preserve
                fileCount: msg.fileCount || update.total_files,
                filenames: msg.filenames || [],
                timestamp: Date.now()
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

              AppendToChat(chatId, messageForFirebase)
                .then(() => console.log('✅ Saved completed insights to Firebase'))
                .catch(err => console.error('❌ Failed to save:', err));

              return completedMsg;
            }
            return msg;
          });
        });

        // Clear refs
        uploadMessageIdRef.current = null;
        uploadInsightsAccumulatorRef.current = [];  // 🆕 Clear accumulator

        break;

      case 'error':
        console.error('❌ Batch error:', update.message);
        setIsUploadAnalyzing(false);
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
        content: "Voici votre mise en situation",
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

  const handleCloseStudySheet = () => {
    setActiveStudySheet(null);
    setStudySheetWebSocketData(null);
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

  const hasMessages = chatMessages.length > 0;
  const openFileUploadDialog = () => documentFileInputRef.current?.click();

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div
        className={`chat-container ${activeStudySheet ? 'has-study-sheet' : ''}`}
      >
        {/* Header */}
        <div className="chat-header">
          <h2 className="chat-header-title" onClick={() => setIsFilesModalVisible(true)}>
            {currentChatTitle}
          </h2>
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


        {/* Empty State */}
        {!hasMessages && (
          <div className="empty-chat-upload" onClick={openFileUploadDialog}>
            <SvgFileUpload />
            <p className="empty-upload-text">{t('chat.uploadFile')}</p>
            <button className="empty-upload-btn">{t('chat.uploadDocument')} ☁️⬆️</button>
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
              // Handle upload messages - show LoadingMessageBox for both loading and completed insights
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

              // Regular messages
              if (typeof message.content === 'string' && message.content.trim()) {
                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onOptionClick={handlePostDocumentUploadOption}
                    onQuizAnswerSelect={handleQuizAnswerSelect}
                    uploadedFilesList={uploadedFilesList}
                    onQuizVisibilityChange={handleQuizVisibilityChange}
                    onQuizInteraction={handleQuizInteraction}
                    isActiveQuiz={message.id === activeQuizId}
                    onFeedbackSubmit={handleQuizFeedback}
                  />
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

          {/* AI Typing Indicator */}
          {isAiTyping && (
            <div className="message ai-message">
              <div>
                <img src="/LogoSimple.png" alt="Logo" width="30" />
              </div>
              <div className="chat-spinner">
                <div className="typing-indicator">
                  {streamingStatus?.status === 'processing' && (
                    <>
                      <GearEmoji size={20} /> {"  "}
                    </>)
                  }
                  {streamingStatus?.status === 'thinking' && (
                    <>
                      <ThinkingEmoji size={20} /> {"  "}

                    </>)
                  }
                  {streamingStatus?.status === 'retrieving' && (
                    <>
                      <ReadingEmoji size={20} /> {"  "}
                      <strong>Entrain de lire tes documents</strong>
                    </>)
                  }
                  {streamingStatus?.status === 'generating' && <PencilEmoji size={20} />}
                  {streamingStatus?.status === 'complete' && '✅'}
                  {streamingStatus?.status === 'error' && '❌ une erreur est survenue'}

                  {(streamingStatus?.status !== 'complete' && streamingStatus?.status !== 'error') && (
                    <span className="blinking-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                    // <GhostLoader/>
                  )}
                </div>
              </div>
            </div>
          )}




          <div ref={messagesEndRef} />

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
              placeholder="Message..."
              value={userInputText}
              onChange={(e) => setUserInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // submit form when user presses enter
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
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

              {/* Send button on the right */}
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
            </div>
          </div>
        </form>

        {/* Files Modal */}
        {isFilesModalVisible && (
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
        )}
      </div>
      {/* Study Guide Panel */}
      {activeStudySheet && (
        <div className="study-sheet-panel">
          <div className="study-guide-content">
            {/* <StudyGuideGenerator
                  topic={activeStudyGuide.topic}
                  chatId={activeStudyGuide.chatId}
                  numSections={activeStudyGuide.num_sections}
                />  */}

            <StudySheetLivePreview
              key={activeStudySheet.key}
              topic={activeStudySheet.topic}
              chatId={activeStudySheet.chatId}
              onClose={handleCloseStudySheet}
              websocketData={studySheetWebSocketData}
            />
          </div>
        </div>

      )}
    </div>
  );
};

export default ChatInterface;