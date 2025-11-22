import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkDown from "react-markdown";
import ChatQuiz from "./ChatQuiz";
import SummaryDisplay from "./ChatSummary";
import ChatScenario from "./ChatScenario";
import ChatStudySheet from "./ChatStudySheet";
import QuizResultsAnalytics from "./QuizResultsAnalytics";

import QuizLoading from "./QuizLoading";

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
  onFeedbackSubmit
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
  const isAI = message.role === "assistant";
  const isUser = message.role === "user";

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

  return (
    <div className={`message ${isUser ? "user-message" : "ai-message"}`}>
      {/* Avatar */}
      {isAI && (
        <div>
          <img src="/LogoSimple.png" alt="Logo" width="30" />
        </div>
      )}

      {/* Content */}
      <div className="message-content">

        {/* Summary Display */}
        {isAI && message.type === "summary" && message.summaryData && (
          <div className="message-text">
            <SummaryDisplay summary={message.summaryData} />
          </div>
        )}

        {/* Quiz Display - Single Question Navigation */}
        {isAI && Array.isArray(parsedQuizData) && parsedQuizData.length > 0 && (
          <div className="message-text">

            {/* Quiz Content - Conditional Rendering */}
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

            {/* Streaming Indicator */}
            {message.isStreaming && !showResults && (
              <div className="quiz-streaming-indicator">
                <div className="typing-indicator">
                  <span className="blinking-dots">
                    <h4>
                      <strong>
                        ✨ {i18n.language === 'fr' ? 'Génération du quiz...' : 'Generating quiz...'}
                      </strong>
                      <span></span>
                      <span></span>
                      <span></span>
                    </h4>
                  </span>
                </div>
              </div>
            )}
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
        {!parsedQuizData && message.type !== "studysheet" && (
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