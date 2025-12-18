import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkDown from "react-markdown";
import ChatQuiz from "./ChatQuiz";
import ChatFlashcard from "./ChatFlashcard";
import FlashcardResults from "./FlashcardResults";
import QuickWinComplete from "./QuickWinComplete";
import SingleQuestionCard from "./SingleQuestionCard";
import SummaryDisplay from "./ChatSummary";
import ChatScenario from "./ChatScenario";
import ChatStudySheet from "./ChatStudySheet";
import QuizResultsAnalytics from "./QuizResultsAnalytics";
import FlashcardFeedback from "./FlashcardFeedback";

import QuizLoading from "./QuizLoading";
import StreamingLogo from "./StreamingLogo";
import StaticLogo from "./StaticLogo";
import StreamingIndicator from "./StreamingIndicator";

import './ChatInterface.css';
import { useTranslation } from 'react-i18next';

/**
 * ChatMessage Component - With Single-Question Quiz Navigation & Skip
 * 
 * QUIZ UX CHANGES:
 * - Shows one question at a time (no scrolling through all)
 * - User can skip questions and come back later
 * - User clicks "Next →" to advance
 * - Loading state if next question not streamed yet
 * - Results screen on completion with CTA
 */
const ChatMessage = ({
  message,
  onOptionClick,
  onQuizAnswerSelect,
  uploadedFilesList,
  onQuizVisibilityChange,
  onQuizInteraction,
  isActiveQuiz = false,
  onSendMessage,
  onFeedbackSubmit,
  onDeleteMessage,
  viewAllChatsMode = false,
  onSessionComplete
}) => {
  const { t, i18n } = useTranslation();

  // ============================================
  // ALL HOOKS MUST BE CALLED FIRST (before any returns)
  // ============================================

  // Quiz state management
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [skippedQuestions, setSkippedQuestions] = useState([]);
  const prevModalOpenRef = useRef(false); // Track previous modal state
  const lastMessageIdRef = useRef(null);

  // Flashcard state management
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showFlashcardResults, setShowFlashcardResults] = useState(false);
  const [flashcardModalOpen, setFlashcardModalOpen] = useState(false);

  // Streak tracking
  const [quizStreak, setQuizStreak] = useState({
    current: 0,
    longest: 0,
    totalCorrect: 0,
    totalIncorrect: 0
  });
  const [lastAnswerWasCorrect, setLastAnswerWasCorrect] = useState(null);

  // Refs
  const progressBarRef = useRef(null);

  // Hover state for delete button (dev mode only)
  const [isHovered, setIsHovered] = useState(false);

  // Check if in development mode
  const isDevelopment = process.env.NODE_ENV === 'development' ||
                        window.location.hostname === 'localhost';

  // Parse quiz data
  const parsedQuizData = useMemo(() => {
    if (!message || !message.quizData) return null;

    try {
      if (Array.isArray(message.quizData)) {
        return message.quizData;
      }

      if (typeof message.quizData === "string") {
        return JSON.parse(message.quizData);
      }

      return null;
    } catch (err) {
      console.error("Failed to parse quizData:", err);
      return null;
    }
  }, [message?.quizData]);

  // Parse flashcard data
  const parsedFlashcardData = useMemo(() => {
    if (!message || !message.flashcardData) return null;

    try {
      if (Array.isArray(message.flashcardData)) {
        console.log("✅ Flashcard data parsed successfully:", message.flashcardData.length, "cards");
        console.log("📋 Message type:", message.type);
        console.log("📋 Message ID:", message.id);
        return message.flashcardData;
      }

      if (typeof message.flashcardData === "string") {
        const parsed = JSON.parse(message.flashcardData);
        console.log("✅ Flashcard data parsed from string:", parsed.length, "cards");
        return parsed;
      }

      return null;
    } catch (err) {
      console.error("Failed to parse flashcardData:", err);
      return null;
    }
  }, [message?.flashcardData]);

  // Calculate initial streak from historical data
  const calculateInitialStreak = useCallback((quizData) => {
    if (!quizData || quizData.length === 0) {
      return { current: 0, longest: 0, totalCorrect: 0, totalIncorrect: 0 };
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let tempStreak = 0;

    for (const question of quizData) {
      if (question.userSelection) {
        if (question.userSelection.isCorrect) {
          totalCorrect++;
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          totalIncorrect++;
          tempStreak = 0;
        }
      }
    }

    for (let i = quizData.length - 1; i >= 0; i--) {
      const question = quizData[i];
      if (!question.userSelection) continue;

      if (question.userSelection.isCorrect) {
        currentStreak++;
      } else {
        break;
      }
    }

    return { current: currentStreak, longest: longestStreak, totalCorrect, totalIncorrect };
  }, []);

  // Reset navigation when message changes
  useEffect(() => {
    if (!message) return;

    if (message.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = message.id;
      setCurrentQuestionIndex(0);
      setShowResults(false);
      setSkippedQuestions([]); // Reset skipped questions on new message
      setQuizModalOpen(false); // Reset modal state on new message
      setIsReviewing(false); // Reset review mode

      if (parsedQuizData) {
        const initialStreak = calculateInitialStreak(parsedQuizData);
        setQuizStreak(initialStreak);

        const firstUnanswered = parsedQuizData.findIndex(q => !q.userSelection);
        if (firstUnanswered === -1 && parsedQuizData.length > 0) {
          setShowResults(true);
        } else if (firstUnanswered > 0) {
          setCurrentQuestionIndex(firstUnanswered);
        }
      }
    }
  }, [message?.id, parsedQuizData, calculateInitialStreak]);

  // Review Quiz Handler
  const [isReviewing, setIsReviewing] = useState(false);

  const handleReviewQuiz = useCallback(() => {
    setShowResults(false);
    setIsReviewing(true);
    setQuizModalOpen(true);
    setCurrentQuestionIndex(0);
  }, []);

  // Restore results view when modal closes after reviewing
  useEffect(() => {
    // Check if modal was open and is now closed
    if (prevModalOpenRef.current && !quizModalOpen && isReviewing) {
      // Modal was closed, restore results view
      setShowResults(true);
      setIsReviewing(false);
    }
    // Update previous modal state
    prevModalOpenRef.current = quizModalOpen;
  }, [quizModalOpen, isReviewing]);

  // Skip question handler
  const handleSkipQuestion = useCallback(() => {
    if (!parsedQuizData || !message) return;

    // Add current question to skipped list if not already there and not answered
    const currentQuestion = parsedQuizData[currentQuestionIndex];
    if (!currentQuestion?.userSelection && !skippedQuestions.includes(currentQuestionIndex)) {
      setSkippedQuestions(prev => [...prev, currentQuestionIndex]);
    }

    // Find next unanswered question (excluding currently skipped ones)
    let nextIndex = currentQuestionIndex + 1;
    let foundNext = false;

    // First, try to find next unanswered question after current
    for (let i = nextIndex; i < parsedQuizData.length; i++) {
      if (!parsedQuizData[i].userSelection) {
        setCurrentQuestionIndex(i);
        foundNext = true;
        break;
      }
    }

    // If no unanswered questions ahead, go back to first skipped question
    if (!foundNext && skippedQuestions.length > 0) {
      const nextSkippedIndex = skippedQuestions[0];
      setSkippedQuestions(prev => prev.slice(1)); // Remove from skipped list
      setCurrentQuestionIndex(nextSkippedIndex);
      foundNext = true;
    }

    // If still no question found and we have a newly skipped one, go to it
    if (!foundNext && !currentQuestion?.userSelection) {
      const newlySkipped = currentQuestionIndex;
      setSkippedQuestions(prev => prev.filter(idx => idx !== newlySkipped));

      // Try to find any other unanswered question
      for (let i = 0; i < parsedQuizData.length; i++) {
        if (!parsedQuizData[i].userSelection && i !== currentQuestionIndex) {
          setCurrentQuestionIndex(i);
          foundNext = true;
          break;
        }
      }
    }

    // If we've gone through all questions and have no skipped ones left, show results
    if (!foundNext && skippedQuestions.length === 0) {
      const allAnswered = parsedQuizData.every(q => q.userSelection);
      if (allAnswered) {
        setShowResults(true);
      } else {
        // Find first unanswered from beginning
        const firstUnanswered = parsedQuizData.findIndex(q => !q.userSelection);
        if (firstUnanswered !== -1) {
          setCurrentQuestionIndex(firstUnanswered);
        }
      }
    }
  }, [currentQuestionIndex, parsedQuizData, skippedQuestions, message]);

  // Navigation handler
  const handleNextQuestion = useCallback(() => {
    if (!parsedQuizData || !message) return;

    // Review Mode Navigation: Simple next/prev without skipping logic
    if (isReviewing) {
      if (currentQuestionIndex < parsedQuizData.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // End of review - maybe close modal or show results?
        // For now, let's just close the modal and show results
        setQuizModalOpen(false);
        setShowResults(true);
      }
      return;
    }

    // If there are skipped questions, prioritize them
    if (skippedQuestions.length > 0) {
      const nextSkippedIndex = skippedQuestions[0];
      setSkippedQuestions(prev => prev.slice(1)); // Remove from skipped list
      setCurrentQuestionIndex(nextSkippedIndex);
      return;
    }

    // Otherwise, find next unanswered question
    let nextIndex = currentQuestionIndex + 1;
    let foundNext = false;

    for (let i = nextIndex; i < parsedQuizData.length; i++) {
      if (!parsedQuizData[i].userSelection) {
        setCurrentQuestionIndex(i);
        foundNext = true;
        break;
      }
    }

    // If no unanswered questions found ahead
    if (!foundNext) {
      if (nextIndex >= parsedQuizData.length && !message.isStreaming) {
        // All questions done and not streaming - show results
        setShowResults(true);
        if (onQuizInteraction) {
          onQuizInteraction(null);
        }
      } else if (message.isStreaming) {
        // Still streaming - wait for more questions
        setCurrentQuestionIndex(nextIndex);
      } else {
        // Check if all answered
        const allAnswered = parsedQuizData.every(q => q.userSelection);
        if (allAnswered) {
          setShowResults(true);
          if (onQuizInteraction) {
            onQuizInteraction(null);
          }
        }
      }
    }
  }, [currentQuestionIndex, parsedQuizData, skippedQuestions, message?.isStreaming, onQuizInteraction, isReviewing]);

  // Answer selection handler
  const handleQuizAnswerSelect = useCallback((answerData) => {
    if (!message) return;

    if (onQuizInteraction) {
      onQuizInteraction(message.id);
    }

    // Remove current question from skipped list if it was skipped
    setSkippedQuestions(prev => prev.filter(idx => idx !== currentQuestionIndex));

    setLastAnswerWasCorrect(answerData.isCorrect);

    setQuizStreak(prev => {
      const newCurrent = answerData.isCorrect ? prev.current + 1 : 0;
      const newLongest = Math.max(prev.longest, newCurrent);

      return {
        current: newCurrent,
        longest: newLongest,
        totalCorrect: prev.totalCorrect + (answerData.isCorrect ? 1 : 0),
        totalIncorrect: prev.totalIncorrect + (answerData.isCorrect ? 0 : 1)
      };
    });

    if (onQuizAnswerSelect) {
      onQuizAnswerSelect({
        ...answerData,
        messageId: message.id,
        answeredAt: new Date().toISOString()
      });
    }
  }, [message?.id, currentQuestionIndex, onQuizInteraction, onQuizAnswerSelect]);

  // Targeted practice handler
  const handleStartTargetedPractice = useCallback((prompt) => {
    console.log("🎯 ChatMessage: handleStartTargetedPractice called with prompt:", prompt.substring(0, 100) + "...");
    if (onSendMessage) {
      console.log("✅ ChatMessage: Calling onSendMessage with null event and custom prompt");
      // Pass null as event, prompt as customPrompt (second parameter)
      onSendMessage(null, prompt);
    } else {
      console.error("❌ ChatMessage: onSendMessage is not defined!");
    }
  }, [onSendMessage]);

  // ============================================
  // FLASHCARD HANDLERS
  // ============================================

  // Initialize flashcard view
  useEffect(() => {
    if (parsedFlashcardData) {
      console.log("🔄 Initializing flashcard view, total cards:", parsedFlashcardData.length);
      const firstUnreviewed = parsedFlashcardData.findIndex(card => !card.userReview);
      console.log("🔍 First unreviewed card index:", firstUnreviewed);

      if (firstUnreviewed === -1 && parsedFlashcardData.length > 0) {
        console.log("📊 All cards reviewed, showing results");
        setShowFlashcardResults(true);
      } else {
        const targetIndex = firstUnreviewed !== -1 ? firstUnreviewed : 0;
        console.log("🎯 Setting current card index to:", targetIndex);
        setCurrentCardIndex(targetIndex);
        setShowFlashcardResults(false);
      }
    }
  }, [message?.id, parsedFlashcardData]);

  // Flashcard review handler
  const handleCardReview = useCallback((cardIndex, reviewData) => {
    if (!message || !parsedFlashcardData) return;

    const card = parsedFlashcardData[cardIndex];

    // Update card status based on review
    let newStatus = card.status || 'new';
    let newReviewCount = (card.reviewCount || 0);

    if (reviewData.knowIt) {
      newReviewCount++;
      if (newReviewCount >= 3) {
        newStatus = 'mastered';
      } else {
        newStatus = 'learning';
      }
    } else {
      newReviewCount = 0;
      newStatus = 'new';
    }

    // Prepare update data
    const updateData = {
      messageId: message.id,
      cardIndex: cardIndex,
      userReview: reviewData,
      status: newStatus,
      reviewCount: newReviewCount,
      lastReviewed: new Date()
    };

    // Call parent handler to update Firebase
    if (onQuizAnswerSelect) {
      onQuizAnswerSelect(updateData);
    }
  }, [message?.id, parsedFlashcardData, onQuizAnswerSelect]);

  // Next card handler
  const handleNextCard = useCallback(() => {
    if (!parsedFlashcardData) return;

    const nextIndex = currentCardIndex + 1;

    if (nextIndex < parsedFlashcardData.length) {
      setCurrentCardIndex(nextIndex);
    } else {
      // Check if all reviewed
      const allReviewed = parsedFlashcardData.every(card => card.userReview);
      if (allReviewed) {
        setShowFlashcardResults(true);
      }
    }
  }, [currentCardIndex, parsedFlashcardData]);

  // Skip card handler
  const handleSkipCard = useCallback(() => {
    if (!parsedFlashcardData) return;

    const nextIndex = currentCardIndex + 1;
    if (nextIndex < parsedFlashcardData.length) {
      setCurrentCardIndex(nextIndex);
    }
  }, [currentCardIndex, parsedFlashcardData]);

  // Navigate to specific card
  const handleNavigateToCard = useCallback((index) => {
    setCurrentCardIndex(index);
    setShowFlashcardResults(false);
  }, []);

  // Review flashcards again
  const handleReviewFlashcards = useCallback(() => {
    setCurrentCardIndex(0);
    setShowFlashcardResults(false);
  }, []);

  // Continue learning (focus on non-mastered cards)
  // Also tracks session completion for momentum-based UX
  const sessionCountedRef = useRef(false);

  const handleContinueLearning = useCallback(() => {
    if (!parsedFlashcardData) return;

    // Track session completion when user clicks action button on results screen
    // Only count once per session (prevent double-counting)
    if (showFlashcardResults && !sessionCountedRef.current && onSessionComplete) {
      sessionCountedRef.current = true;
      onSessionComplete(message.id, 'flashcard');
    }

    const firstNonMastered = parsedFlashcardData.findIndex(
      card => card.status !== 'mastered'
    );

    if (firstNonMastered !== -1) {
      setCurrentCardIndex(firstNonMastered);
      setShowFlashcardResults(false);
    } else {
      setCurrentCardIndex(0);
      setShowFlashcardResults(false);
    }
  }, [parsedFlashcardData, showFlashcardResults, onSessionComplete, message.id]);

  // ============================================
  // QUICK WIN HANDLERS (Momentum-based UX)
  // ============================================

  /**
   * "Try one question" - Lightweight single question, no dashboard, no scores
   * Just: question → answer → short explanation → encouragement
   * Does NOT increment session count (still momentum phase)
   */
  const handleTryOneQuestion = useCallback(() => {
    if (!onSendMessage) return;

    // Get the topic from the flashcards for context
    const topic = parsedFlashcardData?.[0]?.topic || 'the content you just learned';

    // Generate a single, lightweight question - hidden from user, no dashboard
    const singleQuestionPrompt = `Generate exactly 1 simple multiple choice question about: ${topic}.
Keep it easy and encouraging. This is just to help apply what was just learned.
No scoring, no performance tracking - just a gentle check.`;

    console.log('🎯 Triggering single question for momentum:', topic);

    // Send hidden prompt to generate one question
    onSendMessage(null, singleQuestionPrompt, { hideUserMessage: true, isSingleQuestion: true });

    // Hide the quick win screen
    setShowFlashcardResults(false);
  }, [onSendMessage, parsedFlashcardData]);

  /**
   * "Save & continue later" - Gentle exit, preserves progress
   * Shows saving progress flow, gets supportive GPT-nano message
   * Does NOT increment session count, does NOT reset progress
   */
  const handleSaveLater = useCallback(() => {
    console.log('💾 Save & continue later - preserving progress');

    // Hide the results screen
    setShowFlashcardResults(false);

    // Trigger save & exit flow with GPT-nano supportive message
    if (onSendMessage) {
      const exitPrompt = `Role: Supportive study coach.
Task: Write ONE short reassuring sentence for a user who chose to save and continue later.
Rules:
- Max 12 words
- Calm, encouraging
- No pressure, no urgency
- Just output the sentence, nothing else`;
      onSendMessage(null, exitPrompt, {
        hideUserMessage: true,
        suppressSuggestions: true,
        isSaveExitFlow: true
      });
    }
  }, [onSendMessage]);

  // Intersection observer for sticky bar
  useEffect(() => {
    if (!parsedQuizData || !message || !onQuizVisibilityChange) {
      return;
    }

    const progressBarElement = progressBarRef.current;
    if (!progressBarElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const shouldShowSticky = !entry.isIntersecting;

          if (shouldShowSticky) {
            onQuizVisibilityChange({
              messageId: message.id,
              isVisible: true,
              answeredCount: parsedQuizData.filter(q => q.userSelection).length,
              totalQuestions: parsedQuizData.length,
              correctCount: quizStreak.totalCorrect,
              incorrectCount: quizStreak.totalIncorrect,
              currentStreak: quizStreak.current,
              longestStreak: quizStreak.longest,
              lastAnswerWasCorrect: lastAnswerWasCorrect
            });
          } else {
            onQuizVisibilityChange({
              messageId: message.id,
              isVisible: false
            });
          }
        });
      },
      { rootMargin: '-70px 0px 0px 0px', threshold: 0 }
    );

    observer.observe(progressBarElement);

    return () => {
      if (progressBarElement) {
        observer.unobserve(progressBarElement);
      }
    };
  }, [parsedQuizData, message?.type, message?.id, quizStreak, lastAnswerWasCorrect, onQuizVisibilityChange]);

  // Update sticky bar on answer changes
  useEffect(() => {
    if (parsedQuizData && message && onQuizVisibilityChange) {
      if (progressBarRef.current) {
        const rect = progressBarRef.current.getBoundingClientRect();
        const isOutOfView = rect.top < 70;

        if (isOutOfView) {
          onQuizVisibilityChange({
            messageId: message.id,
            isVisible: true,
            answeredCount: parsedQuizData.filter(q => q.userSelection).length,
            totalQuestions: parsedQuizData.length,
            correctCount: quizStreak.totalCorrect,
            incorrectCount: quizStreak.totalIncorrect,
            currentStreak: quizStreak.current,
            longestStreak: quizStreak.longest,
            lastAnswerWasCorrect: lastAnswerWasCorrect
          });
        }
      }
    }
  }, [quizStreak, lastAnswerWasCorrect, parsedQuizData, message?.id, onQuizVisibilityChange]);

  // ============================================
  // GUARD CLAUSE (after all hooks)
  // ============================================

  if (!message) {
    console.warn('ChatMessage received undefined message');
    return null;
  }

  // ============================================
  // DERIVED VALUES (safe after guard)
  // ============================================

  console.log("msg check before role:", message)
  // Support both 'role' (standard) and 'sender' (legacy game quizzes)
  const isAI = message.role === "assistant" || message.sender === "ai";
  const isUser = message.role === "user" || message.sender === "user";

  const fullFile = uploadedFilesList?.find(
    (uploadedFile) => uploadedFile.name === message.file?.name && uploadedFile.id === message.file?.id
  );

  const currentQuestion = parsedQuizData ? parsedQuizData[currentQuestionIndex] : null;
  const isWaitingForQuestion = parsedQuizData &&
    currentQuestionIndex >= parsedQuizData.length &&
    message.isStreaming;
  const isLastQuestion = parsedQuizData &&
    currentQuestionIndex === parsedQuizData.length - 1 &&
    skippedQuestions.length === 0; // Only last if no skipped questions remain

  // ============================================
  // RENDER
  // ============================================

  // Check if message contains flashcards for styling
  const hasFlashcards = isAI && Array.isArray(parsedFlashcardData) && parsedFlashcardData.length > 0;

  return (
    <div
      className={`message ${isUser ? "user-message" : "ai-message"} ${hasFlashcards ? "message-with-flashcards" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      {isAI && (
        <div className="message-avatar-container">
          {message.isStreaming ? (
            <StreamingLogo />
          ) : (
            <StaticLogo />
          )}
        </div>
      )}

      {/* Content */}
      <div className="message-content">
        {/* Delete Button (Dev Mode + View All Chats Only) */}
        {isDevelopment && viewAllChatsMode && isHovered && onDeleteMessage && !message.isStreaming && (
          <button
            className="message-delete-button"
            onClick={() => onDeleteMessage(message.id)}
            title="Delete message"
          >
            ×
          </button>
        )}

        {/* Summary Display */}
        {isAI && message.type === "summary" && message.summaryData && (
          <div className="message-text">
            <SummaryDisplay summary={message.summaryData} />
          </div>
        )}

        {/* Save & Exit Flow - Progress saved message with Resume button */}
        {isAI && message.type === "save_exit" && (
          <div className="message-text">
            <p className="save-exit-message">{message.content}</p>
            {message.saveState === 'complete' && (
              <button
                className="save-exit-resume-btn"
                onClick={() => {
                  // Minimal resume: subtle reassurance + focus input
                  // Do NOT increment session - resume ≠ effort

                  // Show subtle inline feedback
                  const btn = document.querySelector('.save-exit-resume-btn');
                  if (btn) {
                    btn.textContent = 'Picking up where you left off.';
                    btn.disabled = true;
                    btn.style.opacity = '0.7';
                  }

                  // Scroll to and focus the input
                  setTimeout(() => {
                    const input = document.querySelector('.chat-input-field, .chat-input textarea, input[type="text"]');
                    if (input) {
                      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      input.focus();
                    }
                  }, 300);
                }}
              >
                Resume learning
              </button>
            )}
          </div>
        )}

        {/* Micro-Rationale Display - Simple text feedback after quiz answer with CTA */}
        {isAI && message.type === "micro_rationale" && (
          <div className="message-text">
            <p>{message.encouragement}</p>
            <div className="micro-rationale-cta">
              <button
                className="micro-rationale-cta-primary"
                onClick={() => {
                  if (onSendMessage) {
                    const topic = message.topic || 'the material';
                    const prompt = `Generate exactly 1 simple multiple choice question about: ${topic}.
Keep it easy and encouraging. This is just to help apply what was just learned.
No scoring, no performance tracking - just a gentle check.`;
                    onSendMessage(null, prompt, { hideUserMessage: true, isSingleQuestion: true });
                  }
                }}
              >
                Try one more question (2 min)
              </button>
              <button
                className="micro-rationale-cta-secondary"
                onClick={() => {
                  // Request a supportive exit message from GPT-nano with save flow
                  if (onSendMessage) {
                    const exitPrompt = `Role: Supportive study coach.
Task: Write ONE short reassuring sentence for a user who chose to save and continue later.
Rules:
- Max 12 words
- Calm, encouraging
- No pressure, no urgency
- Just output the sentence, nothing else`;
                    onSendMessage(null, exitPrompt, {
                      hideUserMessage: true,
                      suppressSuggestions: true,
                      isSaveExitFlow: true
                    });
                  }
                }}
              >
                Save & continue later
              </button>
            </div>
          </div>
        )}

        {/* Quiz Display - Single Question Navigation */}
        {isAI && Array.isArray(parsedQuizData) && parsedQuizData.length > 0 && (
          <div className="message-text">
            {/* Debug logging */}
            {console.log('🎯 Quiz message isSingleQuestion:', message.isSingleQuestion, 'messageId:', message.id)}

            {/* Streaming Indicator - Above quiz */}
            {message.isStreaming && !showResults && (
              <StreamingIndicator type="quiz" />
            )}

            {/* Single Question Mode - Lightweight quiz for momentum phase */}
            {message.isSingleQuestion ? (
              <div className="single-question-container">
                {message.isStreaming ? (
                  <QuizLoading />
                ) : parsedQuizData[0] ? (
                  <SingleQuestionCard
                    question={parsedQuizData[0]}
                    messageId={message.id}
                    onAnswerSelect={(answerData) => {
                      console.log('🎯 Single question answered:', answerData);
                      // Pass to parent for micro-rationale in chat
                      if (onQuizAnswerSelect) {
                        onQuizAnswerSelect({
                          ...answerData,
                          messageId: message.id,
                          quizIndex: 0, // Single question is always index 0
                          isSingleQuestion: true,
                          answeredAt: new Date().toISOString()
                        });
                      }
                    }}
                  />
                ) : (
                  <QuizLoading />
                )}
              </div>
            ) : (
              /* Full Quiz Content - Conditional Rendering */
              <div className="quiz-single-view-container">
                {showResults ? (
                  /* Results Screen */
                  <QuizResultsAnalytics
                    quizData={parsedQuizData}
                    totalQuestions={parsedQuizData.length}
                    correctAnswers={quizStreak.totalCorrect}
                    incorrectAnswers={quizStreak.totalIncorrect}
                    longestStreak={quizStreak.longest}
                    onStartTargetedPractice={handleStartTargetedPractice}
                    onReview={handleReviewQuiz}
                    messageId={message.id}
                  />
                ) : isWaitingForQuestion ? (
                  /* Loading State - Waiting for next question */
                  <QuizLoading />
                ) : currentQuestion ? (
                  /* Current Question */
                  <ChatQuiz
                    quiz={currentQuestion}
                    messageId={message.id}
                    quizIndex={currentQuestionIndex}
                    onAnswerSelect={handleQuizAnswerSelect}
                    onNext={handleNextQuestion}
                    onSkip={handleSkipQuestion}
                    isLastQuestion={isLastQuestion && !message.isStreaming}
                    totalQuestions={parsedQuizData.length}
                    modalOpen={quizModalOpen}
                    onModalChange={setQuizModalOpen}
                    allQuizzes={parsedQuizData}
                    onNavigate={setCurrentQuestionIndex}
                    skippedQuestions={skippedQuestions}
                    showReview={isReviewing}
                    onFeedbackSubmit={onFeedbackSubmit}
                    feedbackData={message.feedbackData}
                  />
                ) : (
                  /* Initial loading state */
                  <QuizLoading />
                )}
              </div>
            )}
          </div>
        )}

        {/* Flashcard Display - Single Card Navigation */}
        {isAI && Array.isArray(parsedFlashcardData) && parsedFlashcardData.length > 0 && (() => {
          console.log("🎴 RENDERING FLASHCARDS - Total:", parsedFlashcardData.length);
          console.log("🎴 Current card index:", currentCardIndex);
          console.log("🎴 Show results:", showFlashcardResults);
          console.log("🎴 isQuickStartSession:", message.isQuickStartSession);
          console.log("🎴 sessionNumber:", message.sessionNumber);
          return true;
        })() && (
          <div className="message-text">
            <div className="flashcard-view-container">
              {showFlashcardResults ? (
                <>
                  {/* Quick Win Screen for momentum sessions OR Full Results for regular sessions */}
                  {/* Show QuickWin when sessionNumber is defined (meaning it's a momentum session from orientation) */}
                  {(() => {
                    // sessionNumber is set for quick-start momentum sessions (0, 1, 2, etc.)
                    // null/undefined means it's a regular flashcard request from user
                    const isQuickWin = message.isQuickStartSession ||
                      (typeof message.sessionNumber === 'number');
                    console.log("🎯 QuickWin check:", {
                      isQuickStartSession: message.isQuickStartSession,
                      sessionNumber: message.sessionNumber,
                      typeofSessionNumber: typeof message.sessionNumber,
                      isQuickWin
                    });
                    return isQuickWin;
                  })() ? (
                    <QuickWinComplete
                      onTryQuestion={handleTryOneQuestion}
                      onSaveLater={handleSaveLater}
                      topic={parsedFlashcardData[0]?.topic}
                    />
                  ) : (
                    <>
                      {/* Results Screen */}
                      <FlashcardResults
                        totalCards={parsedFlashcardData.length}
                        masteredCards={parsedFlashcardData.filter(c => c.userReview?.knowIt === true).length}
                        learningCards={parsedFlashcardData.filter(c => c.userReview?.knowIt === false).length}
                        newCards={parsedFlashcardData.filter(c => !c.userReview).length}
                        onContinue={handleContinueLearning}
                        onReview={handleReviewFlashcards}
                        topicBreakdown={(() => {
                          // Calculate topic breakdown
                          const topicMap = {};
                          parsedFlashcardData.forEach(card => {
                            const topic = card.topic || 'General';
                            if (!topicMap[topic]) {
                              topicMap[topic] = { topic, total: 0, mastered: 0, learning: 0 };
                            }
                            topicMap[topic].total++;
                            if (card.userReview?.knowIt === true) topicMap[topic].mastered++;
                            else if (card.userReview?.knowIt === false) topicMap[topic].learning++;
                          });
                          return Object.values(topicMap);
                        })()}
                      />

                      {/* Feedback (matches design under flashcard view) */}
                      <div className="flashcard-results-feedback">
                        <FlashcardFeedback
                          onFeedbackSubmit={(data) => onFeedbackSubmit && onFeedbackSubmit(message.id, data)}
                          hasSubmitted={!!message.feedbackData}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : parsedFlashcardData[currentCardIndex] ? (
                /* Current Flashcard */
                <ChatFlashcard
                  flashcard={parsedFlashcardData[currentCardIndex]}
                  messageId={message.id}
                  cardIndex={currentCardIndex}
                  onCardReview={handleCardReview}
                  onNext={handleNextCard}
                  onSkip={handleSkipCard}
                  isLastCard={currentCardIndex === parsedFlashcardData.length - 1}
                  totalCards={parsedFlashcardData.length}
                  modalOpen={flashcardModalOpen}
                  onModalChange={setFlashcardModalOpen}
                  allFlashcards={parsedFlashcardData}
                  onNavigate={handleNavigateToCard}
                  showReview={false}
                  showResults={showFlashcardResults}
                  onReviewFlashcards={handleReviewFlashcards}
                  onContinueLearning={handleContinueLearning}
                  onFeedbackSubmit={onFeedbackSubmit}
                  hasGivenFeedback={!!message.feedbackData}
                  feedbackData={message.feedbackData}
                  isStreaming={message.isStreaming}
                />
              ) : (
                /* Loading state */
                <QuizLoading />
              )}
            </div>
          </div>
        )}

        {/* Study Sheet Display */}
        {isAI && message.html && (
          <ChatStudySheet message={message} />
        )}

        {/* Scenario Display */}
        {isAI && message.type === "scenario" && message.scenarioData && (
          <div className="message-text">
            <ChatScenario
              scenario={message.scenarioData}
              askScenario={() => onOptionClick("Mise en situation", message.file.name)}
            />
          </div>
        )}

        {/* Regular Text Message */}
        {!parsedQuizData && !parsedFlashcardData && message.type !== "studysheet" && message.type !== "micro_rationale" && message.type !== "save_exit" && (
          <div className={isAI ? "message-text" : ""}>
            {isUser ? (
              <div style={{ wordWrap: 'break-word' }}>
                {message.content}
              </div>
            ) : (
              <div className={`ai-message-wrapper ${message.isStreaming ? 'streaming' : 'complete'}`}>
                <ReactMarkDown>{message.content}</ReactMarkDown>
                {message.isStreaming && (
                  <span className="streaming-cursor">▊</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* File Attachment */}
        {fullFile && (
          <>
            {fullFile.status === "uploading" && (
              <div className="spinner"></div>
            )}
            <div className="file-attachment">
              <div className="file-icon">📄</div>
              <div className="file-details">
                <div className="file-name">{fullFile.name}</div>
                <div className="file-size">{fullFile.size}</div>

                {message.file.downloadURL && (
                  <a
                    href={message.file.downloadURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-link"
                  >
                    {i18n.language === 'fr' ? 'Voir le fichier' : 'View file'}
                  </a>
                )}
              </div>
            </div>
          </>
        )}

        {/* Image Attachment */}
        {message.image && (
          <div className="image-attachment">
            <img src={message.image} alt="Uploaded by user" />
          </div>
        )}

        {/* Metadata */}
        <div className="message-timestamp"></div>
        {message.model && <div className="message-model">{message.model}</div>}
      </div>
    </div>
  );
};

export default ChatMessage;
