import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HospitalHallway from './HospitalHallway';
import SerumTube from './SerumTube';
import NurseQuizMascot from './NurseQuizMascot';
import ThemeToggle, { useDarkMode } from '../Common/ThemeToggle';
import SATAQuestion from '../ChatInerface/SATAQuestion';
import { getQuestionType } from '../../utils/quizScoring';
import './DedicatedQuizPage.css';

// Auth imports
import { useAuth } from '../../Contexts/AuthContext/AuthContext';

// Progress context for existing topics
import { useProgress } from '../../Contexts/ProgressContext/ProgressContext';

// Firebase imports for saving quiz results
import { db } from '../../Firebase/config';
import { doc, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

// WebSocket imports for game mode
import {
  sendGameQuizRequest,
  sendGameDeliver,
  sendGameRetry,
  setupGameMessageListener,
  warmUpWebSocket,
  closeWebSocketConnection
} from '../../Services/WebSocketManager';

// Constants
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Demo quiz data for testing
const DEMO_QUIZ_DATA = [
  {
    question: "A 60-year-old male patient with Parkinson's disease is experiencing difficulty with mobility and coordination. As part of the nursing process, what should the nurse prioritize to promote patient-centered outcomes?",
    options: [
      "Schedule frequent rest periods to prevent fatigue.",
      "Collaborate with physical therapy to develop a tailored exercise program.",
      "Encourage the patient to independently perform daily activities.",
      "Implement a high-protein diet to improve muscle strength."
    ],
    answer: "Collaborate with physical therapy to develop a tailored exercise program.",
    topic: "Mobility Enhancement",
    justification: "Collaborating with physical therapy ensures a comprehensive, patient-centered approach that addresses the specific mobility challenges of Parkinson's disease while promoting safety and independence."
  },
  {
    question: "A nurse is caring for a patient who has been diagnosed with type 2 diabetes. Which intervention should the nurse prioritize when developing the patient's plan of care?",
    options: [
      "Administer insulin as ordered before meals.",
      "Teach the patient about blood glucose monitoring.",
      "Restrict the patient's fluid intake.",
      "Encourage the patient to exercise only when blood sugar is high."
    ],
    answer: "Teach the patient about blood glucose monitoring.",
    topic: "Diabetes Management",
    justification: "Patient education about blood glucose monitoring is essential for self-management of diabetes and helps the patient understand how lifestyle choices affect their condition."
  },
  {
    question: "A patient with heart failure is prescribed furosemide (Lasix). Which assessment finding would require the nurse to hold the medication and notify the provider?",
    options: [
      "Blood pressure of 118/76 mmHg",
      "Serum potassium level of 2.8 mEq/L",
      "Heart rate of 78 beats per minute",
      "Weight gain of 0.5 kg over 24 hours"
    ],
    answer: "Serum potassium level of 2.8 mEq/L",
    topic: "Cardiovascular Pharmacology",
    justification: "A potassium level of 2.8 mEq/L indicates hypokalemia, which is a serious side effect of loop diuretics like furosemide. This must be addressed before continuing the medication."
  },
  {
    question: "During a home health visit, the nurse observes that an elderly patient has multiple throw rugs throughout the house. What is the most appropriate nursing intervention?",
    options: [
      "Document the observation in the patient's chart.",
      "Recommend removing or securing the throw rugs to prevent falls.",
      "Suggest the patient wear non-slip socks at all times.",
      "Install grab bars in every room of the house."
    ],
    answer: "Recommend removing or securing the throw rugs to prevent falls.",
    topic: "Fall Prevention",
    justification: "Throw rugs are a significant fall hazard for elderly patients. Removing or securing them directly addresses the identified risk and promotes home safety."
  },
  {
    question: "A nurse is preparing to administer a blood transfusion to a patient. Which action is most important before starting the transfusion?",
    options: [
      "Verify the blood type with another nurse at the bedside.",
      "Administer diphenhydramine prophylactically.",
      "Warm the blood to body temperature.",
      "Start an IV with dextrose solution."
    ],
    answer: "Verify the blood type with another nurse at the bedside.",
    topic: "Blood Transfusion Safety",
    justification: "Verifying blood type with two nurses at the bedside is a critical safety check that prevents potentially fatal transfusion reactions due to blood type incompatibility."
  }
];

// Icon Components
function CheckmarkIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XMarkIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}


function DevCopyJsonButton({ quizData }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(quizData, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className={`dev-btn${copied ? ' reset' : ''}`} onClick={handleCopy}>
      {copied ? '✓ Copied!' : '📋 Copy Quiz JSON'}
    </button>
  );
}

/**
 * DedicatedQuizPage - A cinematic quiz experience
 *
 * As the user answers correctly, they walk down a hospital hallway
 * toward Room 217, where a child patient awaits their help.
 *
 * Supports two modes:
 * 1. Static mode: Quiz data passed via location.state.quizzes
 * 2. Game mode: Questions streamed via WebSocket (location.state.isGameMode = true)
 */
function DedicatedQuizPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDarkMode] = useDarkMode();
  const { currentUser } = useAuth();
  const { topicStats } = useProgress();

  // Login prompt state - shown when anonymous user tries to answer
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pendingAnswerIndex, setPendingAnswerIndex] = useState(null);

  // ------------------------------------------
  // Extract props from navigation state
  // ------------------------------------------
  const isGameMode = location.state?.isGameMode || false;
  const chatId = location.state?.chatId || null;
  const quizTitle = location.state?.title || 'Room 217';
  const fromUpload = location.state?.fromUpload || false;

  // For static mode, use passed data or demo
  const staticQuizData = location.state?.quizzes || DEMO_QUIZ_DATA;

  // Check if user is returning from login (flag set by Login/SignUp page)
  const returningFromLogin = location.state?.returningFromLogin || false;

  // ------------------------------------------
  // REFRESH PROTECTION: Prevent re-sending requests on page refresh
  // When a user refreshes, location.state persists but we shouldn't
  // start a new quiz session - redirect them back to start
  // EXCEPTION: If user is returning from login, allow them to continue
  // ------------------------------------------
  useEffect(() => {
    // Only applies to game mode with fromUpload flag
    if (!isGameMode || !fromUpload || !chatId) return;

    // If returning from login, don't treat this as a refresh
    if (returningFromLogin) {
      console.log('🔓 Returning from login - allowing session to continue');
      return;
    }

    // Check if this session was already started
    const sessionKey = `quiz_session_${chatId}`;
    const existingSession = sessionStorage.getItem(sessionKey);

    if (existingSession) {
      // This is a page refresh - session already exists but state is lost
      // Redirect back to start page instead of sending new request
      console.log('🔄 Page refresh detected - redirecting to start');
      navigate('/start', { replace: true });
      return;
    }

    // Mark this session as started
    sessionStorage.setItem(sessionKey, 'started');

    // Clean up session marker when user leaves the quiz
    return () => {
      // Don't remove immediately - only remove when navigating away properly
      // The session key will persist until browser tab is closed
    };
  }, [isGameMode, fromUpload, chatId, navigate, returningFromLogin]);

  // ------------------------------------------
  // Game mode state (streaming questions)
  // ------------------------------------------
  const [streamedQuestions, setStreamedQuestions] = useState([]);
  const [expectedQuestionCount, setExpectedQuestionCount] = useState(5); // Default, updated from server
  const [isLoading, setIsLoading] = useState(isGameMode); // Loading until first question arrives
  const [loadingMessage, setLoadingMessage] = useState('Connecting...');
  const [gameError, setGameError] = useState(null);

  // Serum tracking for game mode
  const [serumCollected, setSerumCollected] = useState(0);
  const [serumRequired, setSerumRequired] = useState(100);

  // ------------------------------------------
  // Quiz state (shared between modes)
  // ------------------------------------------
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizComplete, setQuizComplete] = useState(false);

  // Cinematic state
  const [showPatientMessage, setShowPatientMessage] = useState(false);
  const [messagePhase, setMessagePhase] = useState(0);
  const [cinematicPhase, setCinematicPhase] = useState(0);

  // Serum tube animation state
  const [isAnimating, setIsAnimating] = useState(false);

  // DEV MODE: For testing animations without going through quiz
  const [devMode, setDevMode] = useState(false);
  const [devCorrectCount, setDevCorrectCount] = useState(3); // Simulated correct answers

  // ------------------------------------------
  // Determine quiz data source
  // ------------------------------------------
  const quizData = isGameMode ? streamedQuestions : staticQuizData;
  const currentQuestion = quizData[currentQuestionIndex];
  // Use expectedQuestionCount for stable UI during streaming
  // Only switch to actual length after all questions are received
  const totalQuestions = isGameMode
    ? expectedQuestionCount
    : staticQuizData.length;

  // Calculate correct answers (handles both MCQ and SATA with partial credit)
  // In dev mode, use devCorrectCount instead
  const correctCount = useMemo(() => {
    if (devMode) return devCorrectCount;
    return userAnswers.reduce((total, answer) => {
      if (answer.questionType === 'sata') {
        // For SATA, add the partial score (score/maxScore gives 0-1 range)
        // We count it as "correct" if they got >= 50% of the options right
        return total + (answer.percentage >= 50 ? 1 : 0);
      }
      // For MCQ, it's binary (correct or not)
      return total + (answer.isCorrect ? 1 : 0);
    }, 0);
  }, [userAnswers, devMode, devCorrectCount]);

  // Calculate hallway progress based on questions ANSWERED (not correct)
  // This way you always walk toward the room regardless of answers
  const hallwayProgress = useMemo(() => {
    return Math.round((userAnswers.length / totalQuestions) * 100);
  }, [userAnswers.length, totalQuestions]);

  // Calculate serum percentage (correct answers)
  const serumPercentage = useMemo(() => {
    return Math.round((correctCount / totalQuestions) * 100);
  }, [correctCount, totalQuestions]);

  // Calculate correct index for current question
  const correctIndex = useMemo(() => {
    if (!currentQuestion) return -1;
    return currentQuestion.options.findIndex(opt => opt === currentQuestion.answer);
  }, [currentQuestion]);

  // ------------------------------------------
  // GAME MODE: WebSocket connection and streaming
  // ------------------------------------------
  useEffect(() => {
    // Only run in game mode with a valid chatId
    if (!isGameMode || !chatId) return;

    let isMounted = true;

    const startGameQuiz = async () => {
      try {
        console.log('🎮 Starting game mode for chat:', chatId);
        setLoadingMessage('Connecting to server...');

        // Step 1: Connect to WebSocket
        await warmUpWebSocket(chatId);

        if (!isMounted) return;
        setLoadingMessage('Generating questions from your notes...');

        // Step 2: Set up message handlers
        setupGameMessageListener(chatId, {
          // Called when game state is initialized
          onInitialized: ({ serumCollected: initialSerum, serumRequired: required }) => {
            if (!isMounted) return;
            console.log(`🧪 Game initialized: ${initialSerum}/${required}mL`);
            setSerumCollected(initialSerum);
            setSerumRequired(required);
          },

          // Called while questions are being generated (or loading documents)
          onGenerating: ({ current, total, message }) => {
            if (!isMounted) return;
            // Use custom message if provided (e.g., "Loading your documents...")
            if (message) {
              setLoadingMessage(message);
            } else if (current && total) {
              setLoadingMessage(`Generating question ${current} of ${total}...`);
              // Update expected count from server (prevents layout shift)
              if (total > 0) {
                setExpectedQuestionCount(total);
              }
            }
          },

          // Called when a question is ready
          onQuestionReady: ({ question, isFirst }) => {
            if (!isMounted) return;
            console.log(`✅ Received question ${question.index + 1}:`, question.question.substring(0, 50) + '...');

            // Add question to our list
            setStreamedQuestions(prev => [...prev, question]);

            // Hide loading when first question arrives
            if (isFirst) {
              setIsLoading(false);
            }
          },

          // Called when all questions are generated
          onQuizComplete: ({ totalQuestions: finalCount }) => {
            if (!isMounted) return;
            console.log(`🎮 Quiz complete! ${finalCount} questions received`);
            // Finalize the expected count to match actual received
            if (finalCount > 0) {
              setExpectedQuestionCount(finalCount);
            }
          },

          // Called if child is saved (enough serum)
          onChildSaved: ({ serumDelivered, attempts, message }) => {
            if (!isMounted) return;
            console.log(`🎉 Child saved! ${serumDelivered}mL delivered in ${attempts} attempts`);
            // The cinematic ending will handle this
          },

          // Called if more serum is needed
          onNeedMoreSerum: ({ serumCollected: total, serumNeeded, message }) => {
            if (!isMounted) return;
            console.log(`⚠️ Need ${serumNeeded}mL more serum`);
            setSerumCollected(total);
            // TODO: Show retry UI
          },

          // Called on errors
          onError: (errorMessage) => {
            if (!isMounted) return;
            console.error('❌ Game error:', errorMessage);
            setGameError(errorMessage);
            setIsLoading(false);
          }
        });

        // Step 3: Request quiz questions
        // Pass existing topics so backend can match questions to user's established topics
        const existingTopics = topicStats ? Object.keys(topicStats) : [];
        console.log('📚 Sending existing topics to backend:', existingTopics);
        const success = await sendGameQuizRequest(chatId, 5, 'medium', null, existingTopics);

        if (!success && isMounted) {
          setGameError('Failed to start quiz. Please try again.');
          setIsLoading(false);
        }

      } catch (error) {
        console.error('❌ Failed to start game:', error);
        if (isMounted) {
          setGameError('Failed to connect. Please try again.');
          setIsLoading(false);
        }
      }
    };

    startGameQuiz();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (chatId) {
        closeWebSocketConnection(chatId);
      }
    };
  }, [isGameMode, chatId, fromUpload]);

  // ------------------------------------------
  // GAME MODE: Handle quiz completion and serum delivery
  // ------------------------------------------
  const handleGameComplete = useCallback(async () => {
    if (!isGameMode || !chatId) return;

    // Calculate serum from correct answers in this session
    const sessionSerum = correctCount * 20; // 20mL per correct answer

    console.log(`🧪 Quiz finished! Earned ${sessionSerum}mL this session`);

    // Send delivery request to server
    await sendGameDeliver(chatId, sessionSerum);

    // ------------------------------------------
    // Save quiz data to Firebase so it can be viewed in ChatInterface
    // ------------------------------------------
    try {
      // Build quiz data with user's answers
      const quizDataWithAnswers = streamedQuestions.map((question, idx) => ({
        ...question,
        userSelection: userAnswers[idx] !== undefined ? {
          selectedOption: question.options[userAnswers[idx]],
          isCorrect: question.options[userAnswers[idx]] === question.answer
        } : null
      }));

      // Save as a message in the chat's messages collection
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        type: 'quiz',
        role: 'assistant',
        content: `Quiz completed - ${correctCount}/${streamedQuestions.length} correct`,
        quizData: quizDataWithAnswers,
        timestamp: serverTimestamp(),
        isComplete: true,
        gameMode: true,
        results: {
          correctCount,
          totalQuestions: streamedQuestions.length,
          serumEarned: sessionSerum,
          accuracy: Math.round((correctCount / streamedQuestions.length) * 100)
        }
      });

      // Update the chat document with final game state
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        updatedAt: serverTimestamp(),
        'gameState.status': 'completed',
        'gameState.serumCollected': sessionSerum,
        'gameState.completedAt': serverTimestamp()
      });

      console.log('✅ Quiz data saved to Firebase');
    } catch (error) {
      console.error('❌ Failed to save quiz data:', error);
    }
  }, [isGameMode, chatId, correctCount, streamedQuestions, userAnswers]);

  // ------------------------------------------
  // LOGIN PROMPT: Handle navigation to login/signup
  // Stores quiz state so user can return after authenticating
  // ------------------------------------------
  const handleLoginRedirect = useCallback(() => {
    // Store the current quiz state so we can resume after login
    const quizState = {
      chatId,
      title: quizTitle,
      isGameMode,
      fromUpload,
      // Store current progress
      currentQuestionIndex,
      userAnswers,
      streamedQuestions,
      pendingAnswerIndex,
      // Timestamp to expire old sessions
      timestamp: Date.now()
    };
    sessionStorage.setItem('pendingQuizState', JSON.stringify(quizState));

    // Navigate to login with return URL
    navigate('/login', {
      state: {
        returnTo: '/quiz/play',
        message: 'Sign in to save your progress and continue the quiz'
      }
    });
  }, [chatId, quizTitle, isGameMode, fromUpload, currentQuestionIndex, userAnswers, streamedQuestions, pendingAnswerIndex, navigate]);

  const handleSignupRedirect = useCallback(() => {
    // Store the current quiz state so we can resume after signup
    const quizState = {
      chatId,
      title: quizTitle,
      isGameMode,
      fromUpload,
      currentQuestionIndex,
      userAnswers,
      streamedQuestions,
      pendingAnswerIndex,
      timestamp: Date.now()
    };
    sessionStorage.setItem('pendingQuizState', JSON.stringify(quizState));

    navigate('/signup', {
      state: {
        returnTo: '/quiz/play',
        message: 'Create an account to save your progress'
      }
    });
  }, [chatId, quizTitle, isGameMode, fromUpload, currentQuestionIndex, userAnswers, streamedQuestions, pendingAnswerIndex, navigate]);

  // Close the login prompt modal
  const handleCloseLoginPrompt = useCallback(() => {
    setShowLoginPrompt(false);
    setPendingAnswerIndex(null);
  }, []);

  // Process the answer after user is authenticated (MCQ)
  const processAnswer = useCallback((index) => {
    setSelectedIndex(index);
    setRevealed(true);

    const isCorrect = index === correctIndex;

    // Trigger tube animation on correct
    if (isCorrect) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1200);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }

    // Record answer
    const answerData = {
      questionIndex: currentQuestionIndex,
      questionType: 'mcq',
      selectedIndex: index,
      selectedText: currentQuestion.options[index],
      correctIndex: correctIndex,
      correctText: currentQuestion.answer,
      isCorrect: isCorrect,
      timestamp: new Date()
    };

    setUserAnswers(prev => [...prev, answerData]);

    // Show feedback after short delay
    setTimeout(() => {
      setShowFeedback(true);
    }, 300);
  }, [correctIndex, currentQuestionIndex, currentQuestion]);

  // Process SATA answer (called from SATAQuestion component)
  const processSATAAnswer = useCallback((answerData) => {
    setRevealed(true);

    // Trigger tube animation based on score percentage
    if (answerData.percentage >= 50) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1200);
      if (answerData.percentage >= 80 && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }

    // Record answer with SATA-specific data
    const satAnswerData = {
      questionIndex: currentQuestionIndex,
      questionType: 'sata',
      selectedOptions: answerData.selectedOptions,
      correctOptions: answerData.correctOptions,
      scoreResult: answerData.scoreResult,
      isCorrect: answerData.isCorrect,
      score: answerData.score,
      maxScore: answerData.maxScore,
      percentage: answerData.percentage,
      timestamp: answerData.timestamp
    };

    setUserAnswers(prev => [...prev, satAnswerData]);

    // Show feedback after short delay
    setTimeout(() => {
      setShowFeedback(true);
    }, 300);
  }, [currentQuestionIndex]);

  // Handle answer selection - checks auth first
  const handleSelect = useCallback((index) => {
    if (revealed) return;

    // If user is not logged in, show login prompt
    if (!currentUser) {
      setPendingAnswerIndex(index);
      setShowLoginPrompt(true);
      return;
    }

    // User is authenticated, process the answer
    processAnswer(index);
  }, [revealed, currentUser, processAnswer]);

  // ------------------------------------------
  // Handle next question
  // ------------------------------------------
  const handleNext = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      // Move to next question - reset selection state
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedIndex(null);
      setRevealed(false);
      setShowFeedback(false);
    } else {
      // ------------------------------------------
      // Quiz complete - trigger ending sequence
      // ------------------------------------------

      // In game mode, first tell the server we're done and delivering serum
      if (isGameMode) {
        handleGameComplete();
      }

      // Start cinematic ending sequence
      setQuizComplete(true);

      // Cinematic sequence timeline:
      // Phase 1: Serum moves in front of door 217
      setTimeout(() => setCinematicPhase(1), 1500);

      // Phase 2: Door opens (serum waits in front)
      setTimeout(() => setCinematicPhase(2), 3500);

      // Phase 3: Door fully open - serum enters through doorway
      setTimeout(() => setCinematicPhase(3), 6000);

      // Phase 4: Fade to black (cinematic transition)
      setTimeout(() => setCinematicPhase(4), 8500);

      // Phase 5: Final message appears
      setTimeout(() => {
        setCinematicPhase(5);
        setShowPatientMessage(true);
        // Progress through message phases
        setTimeout(() => setMessagePhase(1), 1500);
        setTimeout(() => setMessagePhase(2), 3000);
        setTimeout(() => setMessagePhase(3), 4500);
      }, 10500);
    }
  }, [currentQuestionIndex, totalQuestions, isGameMode, handleGameComplete]);

  // Handle restart
  const handleRestart = useCallback(() => {
    setCurrentQuestionIndex(0);
    setSelectedIndex(null);
    setRevealed(false);
    setShowFeedback(false);
    setUserAnswers([]);
    setQuizComplete(false);
    setShowPatientMessage(false);
    setMessagePhase(0);
    setCinematicPhase(0);
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Clear session marker so user can start a fresh quiz next time
    if (chatId) {
      sessionStorage.removeItem(`quiz_session_${chatId}`);
    }
    navigate(-1);
  }, [navigate, chatId]);

  // ------------------------------------------
  // Handle game mode retry (when not enough serum)
  // ------------------------------------------
  const handleRetry = useCallback(async () => {
    if (!isGameMode || !chatId) return;

    // Reset quiz state for a new round
    setCurrentQuestionIndex(0);
    setSelectedIndex(null);
    setRevealed(false);
    setShowFeedback(false);
    setUserAnswers([]);
    setQuizComplete(false);
    setShowPatientMessage(false);
    setMessagePhase(0);
    setCinematicPhase(0);
    setStreamedQuestions([]);
    setIsLoading(true);
    setLoadingMessage('Preparing new questions...');
    setGameError(null);

    // Request new quiz questions (serum persists on server)
    try {
      const success = await sendGameRetry(chatId, 5, 'medium');
      if (!success) {
        setGameError('Failed to start retry. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Retry failed:', error);
      setGameError('Failed to connect. Please try again.');
      setIsLoading(false);
    }
  }, [isGameMode, chatId]);

  // ------------------------------------------
  // DEV MODE: Functions to test animations
  // ------------------------------------------
  const devStartCinematic = useCallback(() => {
    setDevMode(true);
    setQuizComplete(true);
    setCinematicPhase(0);
    setShowPatientMessage(false);
    setMessagePhase(0);

    // Run the cinematic sequence
    // Phase 1: Serum moves in front of door
    setTimeout(() => setCinematicPhase(1), 1500);
    // Phase 2: Door opens (serum waits)
    setTimeout(() => setCinematicPhase(2), 3500);
    // Phase 3: Serum enters through open door
    setTimeout(() => setCinematicPhase(3), 6000);
    // Phase 4: Fade to black
    setTimeout(() => setCinematicPhase(4), 8500);
    // Phase 5: Messages appear
    setTimeout(() => {
      setCinematicPhase(5);
      setShowPatientMessage(true);
      setTimeout(() => setMessagePhase(1), 1500);
      setTimeout(() => setMessagePhase(2), 3000);
      setTimeout(() => setMessagePhase(3), 4500);
    }, 10500);
  }, []);

  const devSetPhase = useCallback((phase) => {
    setDevMode(true);
    setQuizComplete(true);
    setCinematicPhase(phase);
    if (phase >= 5) {
      setShowPatientMessage(true);
      setMessagePhase(3);
    } else {
      setShowPatientMessage(false);
      setMessagePhase(0);
    }
  }, []);

  const devReset = useCallback(() => {
    setDevMode(false);
    setQuizComplete(false);
    setCinematicPhase(0);
    setShowPatientMessage(false);
    setMessagePhase(0);
  }, []);

  // ------------------------------------------
  // RENDER: Loading screen (game mode only)
  // Shows while waiting for first question to stream in
  // ------------------------------------------
  if (isLoading && isGameMode) {
    return (
      <div className={`dedicated-quiz-page loading-page ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
        {/* Hospital hallway background - start at 0% */}
        <HospitalHallway progress={0} />

        {/* Floating controls */}
        <div className="quiz-floating-controls">
          <button className="quiz-back-button" onClick={handleBack} aria-label="Go back">
            <BackArrowIcon />
          </button>
          <ThemeToggle />
        </div>

        {/* Loading content - Premium design with mascot */}
        <div className="loading-overlay">
          <div className="loading-content-premium">
            {/* Mascot with floating animation */}
            <div className="loading-mascot">
              <NurseQuizMascot size={140} isExcited={true} />
            </div>

            {/* Loading text section */}
            <div className="loading-text-section">
              <h2 className="loading-title-premium">Preparing Your Quiz</h2>
              <p className="loading-status">{loadingMessage}</p>

              {/* Premium progress indicator */}
              <div className="loading-progress-bar">
                <div className="loading-progress-glow"></div>
              </div>
            </div>

            {/* Mission briefing */}
            <div className="loading-mission">
              <div className="mission-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <p className="mission-text">
                A child in Room 217 needs your help. Answer correctly to collect serum and save them.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------
  // RENDER: Error screen (game mode only)
  // Shows when connection fails or quiz generation fails
  // ------------------------------------------
  if (gameError && isGameMode) {
    return (
      <div className={`dedicated-quiz-page error-page ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
        {/* Hospital hallway background */}
        <HospitalHallway progress={0} />

        {/* Floating controls */}
        <div className="quiz-floating-controls">
          <button className="quiz-back-button" onClick={handleBack} aria-label="Go back">
            <BackArrowIcon />
          </button>
          <ThemeToggle />
        </div>

        {/* Error content */}
        <div className="error-overlay">
          <div className="error-content glassmorphic">
            {/* Error icon */}
            <div className="error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>

            {/* Error message */}
            <h2 className="error-title">Connection Lost</h2>
            <p className="error-message">{gameError}</p>

            {/* Actions */}
            <div className="error-actions">
              <button className="retry-btn" onClick={handleRetry}>
                Try Again
              </button>
              <button className="back-btn" onClick={handleBack}>
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------
  // RENDER: Cinematic results screen
  // Shows after quiz is complete
  // ------------------------------------------
  if (quizComplete) {
    return (
      <div className={`dedicated-quiz-page results-page cinematic phase-${cinematicPhase} ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
        {/* Hospital hallway background at final stage - door opens when serum arrives (phase 2+) */}
        <HospitalHallway progress={100} isComplete={cinematicPhase >= 3} doorOpen={cinematicPhase >= 2} />

        {/* Floating controls - hidden during early cinematic phases */}
        {cinematicPhase >= 5 && (
          <div className="quiz-floating-controls">
            <button className="quiz-back-button" onClick={handleBack} aria-label="Go back">
              <BackArrowIcon />
            </button>
            <ThemeToggle />
          </div>
        )}

        {/* Black overlay for fade to black effect */}
        <div className={`cinematic-black-overlay ${cinematicPhase >= 4 ? 'visible' : ''}`} />

        {/* Light spill effect from door */}
        <div className={`door-light-spill ${cinematicPhase >= 3 ? 'visible' : ''}`} />

        {/* Cinematic overlay content */}
        <div className="cinematic-results">
          {/* Serum delivery animation - glides toward door */}
          <div className={`serum-delivery phase-${cinematicPhase} ${cinematicPhase >= 2 ? 'delivered' : ''}`}>
            <div className="serum-tube-wrapper">
              <SerumTube
                correctCount={correctCount}
                totalQuestions={totalQuestions}
                size={cinematicPhase >= 1 ? 120 : 160}
              />
            </div>
            {cinematicPhase < 2 && (
              <div className="delivery-label">
                {correctCount > 0 ? `${correctCount} doses ready` : 'No serum collected'}
              </div>
            )}
          </div>

          {/* Patient message sequence - only after fade to black */}
          {cinematicPhase >= 5 && showPatientMessage && (
            <div className="patient-message-container">
              <div className="cinematic-header">
                <span className="serum-delivered-text">Serum delivered.</span>
                <span className="kept-alive-text">You kept him alive today.</span>
              </div>

              <div className={`patient-message ${messagePhase >= 1 ? 'visible' : ''}`}>
                <p className="message-text">His eyes flutter open...</p>
              </div>

              <div className={`patient-message ${messagePhase >= 2 ? 'visible' : ''}`}>
                <p className="message-text breathing">His breathing steadies.</p>
              </div>

              <div className={`patient-message whisper ${messagePhase >= 3 ? 'visible' : ''}`}>
                <p className="message-quote">"You came back..."</p>
              </div>
            </div>
          )}

          {/* Final stats and actions */}
          <div className={`results-final ${messagePhase >= 3 ? 'visible' : ''}`}>
            <div className="final-message">
              {serumPercentage >= 80
                ? "You saved him today."
                : serumPercentage >= 50
                  ? "He's stabilizing. Keep learning."
                  : "He needs you to keep trying."}
            </div>

            <div className="results-stats">
              <span className="stat-value">{serumPercentage}%</span>
              <span className="stat-label">{correctCount} of {totalQuestions} correct</span>
            </div>

            <div className="results-actions">
              <button className="retry-btn" onClick={handleRestart}>
                Save Eli again tomorrow
              </button>
              <button className="back-btn" onClick={handleBack}>
                Review answers
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`dedicated-quiz-page cinematic ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* Hospital hallway background - progress based on questions answered */}
      <HospitalHallway progress={hallwayProgress} />

      {/* Floating controls */}
      <div className="quiz-floating-controls">
        <button className="quiz-back-button" onClick={handleBack} aria-label="Go back">
          <BackArrowIcon />
        </button>
        <ThemeToggle />
      </div>

      {/* DEV MODE CONTROLS - Only visible in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dev-controls">
          <div className="dev-controls-header">
            <span>🛠 Dev Controls</span>
          </div>
          <div className="dev-controls-body">
            <div className="dev-control-group">
              <label>Correct Answers:</label>
              <input
                type="range"
                min="0"
                max="5"
                value={devCorrectCount}
                onChange={(e) => setDevCorrectCount(Number(e.target.value))}
              />
              <span>{devCorrectCount}/5</span>
            </div>
            <button className="dev-btn" onClick={devStartCinematic}>
              ▶ Play Cinematic
            </button>
            <div className="dev-phase-buttons">
              <span>Jump to Phase:</span>
              {[0, 1, 2, 3, 4, 5].map((phase) => (
                <button
                  key={phase}
                  className={`dev-phase-btn ${cinematicPhase === phase && quizComplete ? 'active' : ''}`}
                  onClick={() => devSetPhase(phase)}
                >
                  {phase}
                </button>
              ))}
            </div>
            <button className="dev-btn reset" onClick={devReset}>
              ↺ Reset
            </button>
            <DevCopyJsonButton quizData={quizData} />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="quiz-page-main cinematic-layout">
        {/* Left sidebar - Serum Tube */}
        <aside className="quiz-sidebar-left">
          <div className="tube-container">
            <SerumTube
              correctCount={correctCount}
              totalQuestions={totalQuestions}
              isAnimating={isAnimating}
              size={280}
            />
            <div className="progress-hint">
              {hallwayProgress < 20 && "The hallway is dark..."}
              {hallwayProgress >= 20 && hallwayProgress < 40 && "Lights flicker on ahead"}
              {hallwayProgress >= 40 && hallwayProgress < 60 && "You're getting closer"}
              {hallwayProgress >= 60 && hallwayProgress < 80 && "Room 217 is near"}
              {hallwayProgress >= 80 && "The door begins to open..."}
            </div>
          </div>
        </aside>

        {/* Center - Quiz content */}
        <div className="quiz-content-area">
          {/* Detect question type and render appropriate component */}
          {currentQuestion && getQuestionType(currentQuestion) === 'sata' ? (
            /* SATA Question - Select All That Apply */
            <div className="quiz-card glassmorphic sata-wrapper">
              <SATAQuestion
                quiz={currentQuestion}
                quizIndex={currentQuestionIndex}
                totalQuestions={totalQuestions}
                onAnswerSelect={processSATAAnswer}
                onNext={handleNext}
                isLastQuestion={currentQuestionIndex >= totalQuestions - 1}
                inModal={false}
                reviewMode={false}
                previousAnswer={userAnswers.find(a => a.questionIndex === currentQuestionIndex)}
              />
            </div>
          ) : (
            /* MCQ Question - Multiple Choice (Default) */
            <div className="quiz-card glassmorphic">
              {/* Compact header inside card */}
              <div className="quiz-card-header">
                <div className="header-left-section">
                  <span className="question-counter">
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                  </span>
                  {currentQuestion?.topic && (
                    <div className="topic-badge">
                      <span className="topic-dot"></span>
                      <span className="topic-text">{currentQuestion.topic}</span>
                    </div>
                  )}
                </div>
                <span className="quiz-title">Room 217</span>
              </div>

              {/* Question */}
              <div className="question-text">
                {currentQuestion?.question}
              </div>

              {/* Options */}
              <div className="options-container">
                {currentQuestion?.options?.map((option, index) => {
                  const isSelected = index === selectedIndex;
                  const isAnswer = index === correctIndex;

                  let optionClass = 'quiz-option';
                  if (revealed) {
                    if (isAnswer) {
                      optionClass += ' correct';
                    } else if (isSelected) {
                      optionClass += ' incorrect';
                    } else {
                      optionClass += ' disabled';
                    }
                  }
                  if (isSelected) {
                    optionClass += ' selected';
                  }

                  return (
                    <div
                      key={index}
                      className={optionClass}
                      onClick={() => handleSelect(index)}
                      role="button"
                      tabIndex={revealed ? -1 : 0}
                      onKeyDown={(e) => {
                        if (!revealed && (e.key === 'Enter' || e.key === ' ')) {
                          handleSelect(index);
                        }
                      }}
                    >
                      <span className={`option-letter ${isSelected ? 'selected' : ''} ${revealed && isAnswer ? 'correct' : ''}`}>
                        {OPTION_LETTERS[index]}
                      </span>
                      <span className="option-text">{option}</span>

                      {revealed && isAnswer && (
                        <span className="option-icon checkmark">
                          <CheckmarkIcon />
                        </span>
                      )}
                      {revealed && !isAnswer && isSelected && (
                        <span className="option-icon x-mark">
                          <XMarkIcon />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Feedback */}
              {showFeedback && (
                <div className={`quiz-feedback ${selectedIndex === correctIndex ? 'correct' : 'incorrect'}`}>
                  <div className="feedback-icon-wrapper">
                    {selectedIndex === correctIndex ? (
                      <div className="feedback-icon correct">
                        <CheckmarkIcon />
                      </div>
                    ) : (
                      <div className="feedback-icon incorrect">
                        <XMarkIcon />
                      </div>
                    )}
                  </div>
                  <div className="feedback-content">
                    <span className={`feedback-status ${selectedIndex === correctIndex ? 'correct' : 'incorrect'}`}>
                      {selectedIndex === correctIndex ? 'Correct' : 'Incorrect'}
                    </span>
                    {currentQuestion?.justification && (
                      <div
                        className="feedback-explanation"
                        dangerouslySetInnerHTML={{ __html: currentQuestion.justification }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Next button */}
              {showFeedback && (
                <button className="next-button" onClick={handleNext}>
                  {currentQuestionIndex < totalQuestions - 1 ? 'Continue →' : 'Enter Room 217 →'}
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Login Prompt Modal - shown when anonymous user tries to answer */}
      {showLoginPrompt && (
        <div className="login-prompt-overlay" onClick={handleCloseLoginPrompt}>
          <div className="login-prompt-modal glassmorphic" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button className="login-prompt-close" onClick={handleCloseLoginPrompt} aria-label="Close">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Mascot */}
            <div className="login-prompt-mascot">
              <NurseQuizMascot size={100} isExcited={true} />
            </div>

            {/* Content */}
            <h2 className="login-prompt-title">Sign in to Continue</h2>
            <p className="login-prompt-message">
              Create a free account to save your progress and track your learning journey.
            </p>

            {/* Benefits list */}
            <ul className="login-prompt-benefits">
              <li>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Save your quiz progress
              </li>
              <li>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Track your learning stats
              </li>
              <li>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Access your uploaded notes anytime
              </li>
            </ul>

            {/* Action buttons */}
            <div className="login-prompt-actions">
              <button className="login-prompt-btn primary" onClick={handleSignupRedirect}>
                Create Free Account
              </button>
              <button className="login-prompt-btn secondary" onClick={handleLoginRedirect}>
                I already have an account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DedicatedQuizPage;
