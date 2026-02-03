import { useMemo, useState, useEffect, useCallback } from 'react';
import ReactMarkDown from "react-markdown";
import ChatQuizStream from "./ChatQuizStream";
import ChatFlashcard from "./ChatFlashcard";
import FlashcardResults from "./FlashcardResults";
import SummaryDisplay from "./ChatSummary";
import ChatScenario from "./ChatScenario";
import ChatStudySheet from "./ChatStudySheet";
import FlashcardFeedback from "./FlashcardFeedback";

import QuizLoading from "./QuizLoading";
import StreamingLogo from "./StreamingLogo";
import StaticLogo from "./StaticLogo";

import './ChatInterface.css';
import { useTranslation } from 'react-i18next';
import { devLog } from '../../Services/devLogger';

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
  viewAllChatsMode = false
}) => {
  const { i18n } = useTranslation();

  // ============================================
  // ALL HOOKS MUST BE CALLED FIRST (before any returns)
  // ============================================

  // Flashcard state management
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showFlashcardResults, setShowFlashcardResults] = useState(false);
  const [flashcardModalOpen, setFlashcardModalOpen] = useState(false);

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
        devLog("✅ Flashcard data parsed successfully:", message.flashcardData.length, "cards");
        devLog("📋 Message type:", message.type);
        devLog("📋 Message ID:", message.id);
        return message.flashcardData;
      }

      if (typeof message.flashcardData === "string") {
        const parsed = JSON.parse(message.flashcardData);
        devLog("✅ Flashcard data parsed from string:", parsed.length, "cards");
        return parsed;
      }

      return null;
    } catch (err) {
      console.error("Failed to parse flashcardData:", err);
      return null;
    }
  }, [message?.flashcardData]);

  // Quiz answer handler - forwards to parent for Firebase persistence
  const handleQuizAnswerSelect = useCallback((answerData) => {
    if (!message) return;

    if (onQuizInteraction) {
      onQuizInteraction(message.id);
    }

    if (onQuizAnswerSelect) {
      onQuizAnswerSelect({
        ...answerData,
        messageId: message.id,
        answeredAt: new Date().toISOString()
      });
    }
  }, [message?.id, onQuizInteraction, onQuizAnswerSelect]);

  // ============================================
  // FLASHCARD HANDLERS
  // ============================================

  // Initialize flashcard view
  useEffect(() => {
    if (parsedFlashcardData) {
      devLog("🔄 Initializing flashcard view, total cards:", parsedFlashcardData.length);
      const firstUnreviewed = parsedFlashcardData.findIndex(card => !card.userReview);
      devLog("🔍 First unreviewed card index:", firstUnreviewed);

      if (firstUnreviewed === -1 && parsedFlashcardData.length > 0) {
        devLog("📊 All cards reviewed, showing results");
        setShowFlashcardResults(true);
      } else {
        const targetIndex = firstUnreviewed !== -1 ? firstUnreviewed : 0;
        devLog("🎯 Setting current card index to:", targetIndex);
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
  const handleContinueLearning = useCallback(() => {
    if (!parsedFlashcardData) return;

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
  }, [parsedFlashcardData]);

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

  devLog("msg check before role:", message)
  // Support both 'role' (standard) and 'sender' (legacy game quizzes)
  const isAI = message.role === "assistant" || message.sender === "ai";
  const isUser = message.role === "user" || message.sender === "user";

  const fullFile = uploadedFilesList?.find(
    (uploadedFile) => uploadedFile.name === message.file?.name && uploadedFile.id === message.file?.id
  );

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

        {/* Quiz Display - New High-Dopamine Streaming Quiz */}
        {isAI && Array.isArray(parsedQuizData) && parsedQuizData.length > 0 && (
          <div className="message-text">
            <ChatQuizStream
              quizData={parsedQuizData}
              messageId={message.id}
              isStreaming={message.isStreaming}
              expectedTotal={10}
              onAnswerSelect={handleQuizAnswerSelect}
              onComplete={(stats) => {
                devLog('Quiz completed:', stats);
                if (onQuizInteraction) {
                  onQuizInteraction(null);
                }
              }}
              onFeedbackSubmit={onFeedbackSubmit}
              feedbackData={message.feedbackData}
            />
          </div>
        )}

        {/* Flashcard Display - Single Card Navigation */}
        {isAI && Array.isArray(parsedFlashcardData) && parsedFlashcardData.length > 0 && (() => {
          devLog("🎴 RENDERING FLASHCARDS - Total:", parsedFlashcardData.length);
          devLog("🎴 Current card index:", currentCardIndex);
          devLog("🎴 Show results:", showFlashcardResults);
          return true;
        })() && (
          <div className="message-text">
            <div className="flashcard-view-container">
              {showFlashcardResults ? (
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
        {!parsedQuizData && !parsedFlashcardData && message.type !== "studysheet" && (
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
