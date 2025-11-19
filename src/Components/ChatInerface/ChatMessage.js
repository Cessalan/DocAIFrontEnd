import { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkDown from "react-markdown";
import ChatQuiz from "./ChatQuiz";
import SummaryDisplay from "./ChatSummary";
import ChatScenario from "./ChatScenario";
import ChatStudySheet from "./ChatStudySheet";
import QuizSummary from "./QuizSummary";
import QuizProgressBar from "./QuizProgressBar";

import './ChatInterface.css';
import { useTranslation } from 'react-i18next';

/**
 * ChatMessage Component - UPDATED WITH ACTIVE QUIZ TRACKING
 * 
 * NEW FEATURES:
 * 1. Reports when user interacts with quiz (answers question)
 * 2. Only triggers sticky bar for active quiz
 * 3. Clears active status on quiz completion
 * 4. Visual indicator for active quiz
 * 
 * NEW PROPS:
 * - onQuizInteraction: Callback when user answers (makes quiz active)
 * - isActiveQuiz: Boolean indicating if this is the active quiz
 */
const ChatMessage = ({ 
  message, 
  onOptionClick, 
  onQuizAnswerSelect, 
  uploadedFilesList,
  onQuizVisibilityChange,
  onQuizInteraction,  // NEW: Callback to report interaction
  isActiveQuiz = false // NEW: Is this the currently active quiz?
}) => {

  const isAI = message.role === "assistant";
  const isUser = message.role === "user";

  // Get file included in message
  const fullFile = uploadedFilesList?.find(
    (uploadedFile) => uploadedFile.name === message.file?.name && uploadedFile.id === message.file?.id
  );

  // ============================================
  // QUIZ DATA PARSING
  // ============================================
  
  const parsedQuizData = useMemo(() => {
    if (message.type !== "quiz" || !message.quizData) return null;
    
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
  }, [message.type, message.quizData]);

  // ============================================
  // HELPER: CALCULATE INITIAL STREAK FROM HISTORICAL DATA
  // ============================================
  
  const calculateInitialStreak = (quizData) => {
    if (!quizData || quizData.length === 0) {
      return { current: 0, longest: 0, totalCorrect: 0, totalIncorrect: 0 };
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let tempStreak = 0;

    // PASS 1: Count totals and find longest streak
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

    // PASS 2: Calculate CURRENT streak (consecutive correct from end)
    for (let i = quizData.length - 1; i >= 0; i--) {
      const question = quizData[i];
      
      if (!question.userSelection) {
        continue;
      }
      
      if (question.userSelection.isCorrect) {
        currentStreak++;
      } else {
        break;
      }
    }

    console.log('📊 Calculated initial streak:', {
      messageId: message.id,
      current: currentStreak,
      longest: longestStreak,
      totalCorrect,
      totalIncorrect
    });

    return {
      current: currentStreak,
      longest: longestStreak,
      totalCorrect,
      totalIncorrect
    };
  };

  // ============================================
  // STAGGERED QUESTION DISPLAY
  // ============================================
  
  const [displayedQuestions, setDisplayedQuestions] = useState([]);
  const timerRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  useEffect(() => {
    if (!parsedQuizData || message.type !== "quiz") {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const isNewQuiz = lastMessageIdRef.current !== message.id;
    
    if (isNewQuiz) {
      lastMessageIdRef.current = message.id;
      setDisplayedQuestions([]);
      
      const initialStreak = calculateInitialStreak(parsedQuizData);
      setQuizStreak(initialStreak);
    }

    if (parsedQuizData.length > displayedQuestions.length) {
      const nextIndex = displayedQuestions.length;
      const delay = nextIndex === 0 ? 0 : 80;

      timerRef.current = setTimeout(() => {
        setDisplayedQuestions(prev => [
          ...prev,
          parsedQuizData[nextIndex]
        ]);
      }, delay);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [parsedQuizData, displayedQuestions.length, message.type, message.id]);

  // ============================================
  // STREAK TRACKING
  // ============================================
  
  const [quizStreak, setQuizStreak] = useState({
    current: 0,
    longest: 0,
    totalCorrect: 0,
    totalIncorrect: 0
  });

  const [showStreakToast, setShowStreakToast] = useState(false);
  const [lastAnswerWasCorrect, setLastAnswerWasCorrect] = useState(null);

  // Calculate if quiz is complete
  const isQuizComplete = useMemo(() => {
    if (!parsedQuizData || message.isStreaming) return false;
    
    const answeredCount = parsedQuizData.filter(q => q.userSelection).length;
    return answeredCount === parsedQuizData.length && parsedQuizData.length > 0;
  }, [parsedQuizData, message.isStreaming]);

  // ============================================
  // NEW: CLEAR ACTIVE QUIZ ON COMPLETION
  // ============================================
  
  useEffect(() => {
    if (isQuizComplete && onQuizInteraction) {
      console.log('✅ Quiz completed, clearing active status:', message.id);
      // Clear this quiz as active (will hide sticky bar)
      onQuizInteraction(null);
    }
  }, [isQuizComplete, onQuizInteraction, message.id]);

  // ============================================
  // HANDLE QUIZ ANSWER SELECTION
  // ============================================
  
  const handleQuizAnswerSelect = (answerData) => {
    console.log('📝 User answered question:', {
      messageId: message.id,
      questionIndex: answerData.quizIndex,
      isCorrect: answerData.isCorrect
    });
    
    // NEW: Mark this quiz as active when user answers
    if (onQuizInteraction) {
      onQuizInteraction(message.id);
      console.log('🎯 Quiz marked as active:', message.id);
    }
    
    // Track last answer for animation triggers
    setLastAnswerWasCorrect(answerData.isCorrect);
    
    // Update streak with new answer
    setQuizStreak(prev => {
      const newCurrent = answerData.isCorrect ? prev.current + 1 : 0;
      const newLongest = Math.max(prev.longest, newCurrent);
      
      const newState = {
        current: newCurrent,
        longest: newLongest,
        totalCorrect: prev.totalCorrect + (answerData.isCorrect ? 1 : 0),
        totalIncorrect: prev.totalIncorrect + (answerData.isCorrect ? 0 : 1)
      };
      
      console.log('📊 Streak Update:', newState);
      
      // Show "On fire!" toast at 3 streak
      if (newCurrent === 3) {
        setShowStreakToast(true);
        setTimeout(() => setShowStreakToast(false), 3000);
      }
      
      return newState;
    });

    // Pass to parent with timestamp
    if (onQuizAnswerSelect) {
      onQuizAnswerSelect({
        ...answerData,
        messageId: message.id,
        answeredAt: new Date().toISOString()
      });
    }
  };

  // ============================================
  // INTERSECTION OBSERVER FOR STICKY BAR
  // ============================================
  
  const progressBarRef = useRef(null);
  
  useEffect(() => {
    if (!parsedQuizData || message.type !== "quiz" || !onQuizVisibilityChange) {
      return;
    }

    const progressBarElement = progressBarRef.current;
    if (!progressBarElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const shouldShowSticky = !entry.isIntersecting;
          
          if (shouldShowSticky) {
            // Progress bar scrolled out of view - notify parent
            // Parent will decide if sticky should show (based on active quiz)
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
            // Progress bar visible - hide sticky
            onQuizVisibilityChange({
              messageId: message.id,
              isVisible: false
            });
          }
        });
      },
      {
        rootMargin: '-70px 0px 0px 0px',
        threshold: 0
      }
    );

    observer.observe(progressBarElement);

    return () => {
      if (progressBarElement) {
        observer.unobserve(progressBarElement);
      }
    };
  }, [parsedQuizData, message.type, message.id, quizStreak, lastAnswerWasCorrect, onQuizVisibilityChange]);

  // ============================================
  // UPDATE STICKY BAR ON ANSWER CHANGES
  // ============================================
  
  useEffect(() => {
    if (parsedQuizData && message.type === "quiz" && onQuizVisibilityChange) {
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
  }, [quizStreak, lastAnswerWasCorrect, parsedQuizData, message.type, message.id, onQuizVisibilityChange]);

  // ============================================
  // OTHER HANDLERS
  // ============================================
  
  const askScenario = () => {
    onOptionClick("Mise en situation", message.file.name);
  }

  const { t, i18n } = useTranslation();

  // ============================================
  // RENDER
  // ============================================
  
  return (
    <div className={`message ${isUser ? "user-message" : "ai-message"}`}>
      {/* Avatar */}
      {isAI && <div>
        <img src="/LogoSimple.png" alt="Logo" width="30" />
      </div>}

      {/* Content */}
      <div className="message-content">

        {/* Summary Display */}
        {isAI && message.type === "summary" && message.summaryData && (
          <div className="message-text">
            <SummaryDisplay summary={message.summaryData} />
          </div>
        )}

        {/* Quiz Display - WITH ACTIVE TRACKING */}
        {isAI && message.type === "quiz" && Array.isArray(parsedQuizData) && (
          <div className="message-text">
            {/* Progress Bar with Active Indicator */}
            {!message.isStreaming && parsedQuizData.length > 0 && (
              <div ref={progressBarRef}>
                <QuizProgressBar
                  answeredCount={parsedQuizData.filter(q => q.userSelection).length}
                  totalQuestions={parsedQuizData.length}
                  correctCount={quizStreak.totalCorrect}
                  incorrectCount={quizStreak.totalIncorrect}
                  isActiveQuiz={isActiveQuiz} // NEW: Pass active status
                />
              </div>
            )}

          
            <div className="quiz-questions-container">
              {displayedQuestions.map((quiz, i) => (
                <ChatQuiz 
                  key={`${message.id}-q${i}`}
                  quiz={quiz}
                  messageId={message.id}
                  quizIndex={i}
                  onAnswerSelect={handleQuizAnswerSelect} 
                />
              ))}
            </div>
            
            {/* Streaming Indicator */}
            {message.isStreaming && (
              <div className="quiz-streaming-indicator">
                <div className="typing-indicator">
                  <span className="blinking-dots">
                    <h4>
                      <strong>✨ {t('message.generatingQuiz')}</strong>
                      <span></span>
                      <span></span>
                      <span></span>
                    </h4>
                  </span>
                </div>
              </div>
            )}
            
            {/* Quiz Summary on Completion */}
            {isQuizComplete && (
              <>
                {console.log('🎯 Quiz Complete! Rendering summary')}
                <QuizSummary 
                  totalQuestions={parsedQuizData.length}
                  correctAnswers={quizStreak.totalCorrect}
                  incorrectAnswers={quizStreak.totalIncorrect}
                  longestStreak={quizStreak.longest}
                />
              </>
            )}
          </div>
        )}

        {/* Study Sheet Display */}
        {isAI && message.html && (
          <>
            <ChatStudySheet message={message} />    
          </>
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

       {/* Regular Text Message - Only show if not quiz or studysheet */}
      {message.type !== "quiz" && message.type !== "studysheet" && (
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
                    Voir le fichier
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
        <div className="message-timestamp">
          {/* {formatTimeForChat(message.timestamp)} */}
        </div>
        {message.model && <div className="message-model">{message.model}</div>}
      </div>
    </div>
  );
};

export default ChatMessage;