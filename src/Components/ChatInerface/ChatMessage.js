import { useMemo } from 'react';
import ReactMarkDown from "react-markdown";
import ChatQuiz from "./ChatQuiz";
import SummaryDisplay from "./ChatSummary";
import ChatScenario from "./ChatScenario";
import ChatStudySheet from "./ChatStudySheet";

import './ChatInterface.css';
import { useTranslation } from 'react-i18next';

const ChatMessage = ({ message, onOptionClick, onQuizAnswerSelect, uploadedFilesList }) => {

  const isAI = message.role === "assistant";
  const isUser = message.role === "user";

  // Get file included in message
  const fullFile = uploadedFilesList?.find(
    (uploadedFile) => uploadedFile.name === message.file?.name && uploadedFile.id === message.file?.id
  );

  // 🔥 FIX: Use useMemo to re-parse when quizData changes
  const parsedQuizData = useMemo(() => {
    if (message.type !== "quiz" || !message.quizData) return null;
    
    try {
      // If it's already an array, return it
      if (Array.isArray(message.quizData)) {
        return message.quizData;
      }
      
      // If it's a string, parse it
      if (typeof message.quizData === "string") {
        return JSON.parse(message.quizData);
      }
      
      return null;

    } catch (err) {
      console.error("Failed to parse quizData:", err);
      return null;
    }
  }, [message.type, message.quizData]); // Re-run when quizData changes

  // Handle quiz answer selection
  const handleQuizAnswerSelect = (answerData) => {
    if (onQuizAnswerSelect) {
      onQuizAnswerSelect({
        ...answerData,
        messageId: message.id
      });
    }
  };

  const askScenario = () => {
    onOptionClick("Mise en situation", message.file.name);
  }

  const handleAskQuiz = () => {
    onOptionClick("Quiz", message.file.name);
  }

  const { t, i18n } = useTranslation();

  return (
    <div className={`message ${isUser ? "user-message" : "ai-message"}`}>
      {/* Avatar */}
      {isAI && <div>
        <img src="/LogoSimple.png" alt="Logo" width="65" />
      </div>}

      {/* Content */}
      <div className="message-content">

        {/* Summary Display */}
        {isAI && message.type === "summary" && message.summaryData && (
          <div className="message-text">
            <SummaryDisplay summary={message.summaryData} />
          </div>
        )}

        {/* Quiz Display - SUPPORTS PROGRESSIVE RENDERING */}
        {isAI && message.type === "quiz" && Array.isArray(parsedQuizData) && (
          <div className="message-text">
            <div className="quiz-questions-container">
              {parsedQuizData.map((quiz, i) => (
                <ChatQuiz 
                  key={`${message.id}-q${i}`}  // Unique key per question
                  quiz={quiz}
                  messageId={message.id}
                  quizIndex={i}
                  onAnswerSelect={handleQuizAnswerSelect} 
                />
              ))}
            </div>
            
            {/* Show streaming indicator while quiz is generating */}
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
            
            {/* Show completion banner */}
            {!message.isStreaming && parsedQuizData.length > 0 && (
              <div className="quiz-complete-banner">
                ✅ {t('message.quizReady')}- {parsedQuizData.length} questions
              </div>
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

        {/* Regular Text Message */}
        {(!parsedQuizData || message.type !== "quiz") && (
          <div className={isAI ? "message-text" : ""}>
            {isUser ? (
              <div style={{ wordWrap: 'break-word' }}>
                {message.content}
              </div>
            ) : (
              <div className="ai-message-wrapper">
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

        {/* AI Option Buttons */}
        {/* {isAI && message.options && (
          <div className="chat-options">
            {message.options
              .filter(option => option !== "Mise en situation")
              .map((option, index) => (
                <button
                  key={index}
                  onClick={() => onOptionClick(option, message.file.name)}
                  className="chat-option-button">
                  <span>
                    {option === "Résumé" && "📝"}
                    {option === "Quiz" && "🧠"}
                    {option === "Mise en situation" && "🎭"}
                  </span>
                  {option === "Résumé" && t("message.summary")}
                  {option === "Quiz" && "Quiz"}
                </button>
              ))}
          </div>
        )} */}

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