import { useState, useEffect, memo } from "react";
import './ChatInterface.css';
import './ChatQuiz.css';
// translation
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

const ChatQuiz = ({ quiz, onAnswerSelect, messageId, quizIndex }) => {

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Check if user has already answered this question
  useEffect(() => {
    if (quiz.userSelection) {
      setSelectedIndex(quiz.userSelection.selectedIndex);
      setRevealed(true);
      setShowFeedback(true); // Show feedback immediately for answered questions
    }
  }, [quiz.userSelection]);

  const { t, i18n } = useTranslation();

  const handleSelect = (index) => {
    if (revealed) return;
    
    setSelectedIndex(index);
    setRevealed(true);

    const correctIndex = Array.isArray(quiz.options)
      ? quiz.options.findIndex(opt => opt === quiz.answer)
      : -1;
    
    const isCorrect = index === correctIndex;

    // Trigger confetti for correct answers
    if (isCorrect) {
      setShowConfetti(true);
      
      // Haptic feedback on mobile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Remove confetti after animation completes
      setTimeout(() => setShowConfetti(false), 700);
    }

    // Delay feedback appearance for premium feel (500ms = animation time)
    setTimeout(() => {
      setShowFeedback(true);
    }, 500);

    // Pass the answer selection up to parent components
    if (onAnswerSelect) {
      onAnswerSelect({
        quizIndex,
        questionText: quiz.question,
        selectedOptionIndex: index,
        selectedOptionText: quiz.options[index],
        correctOptionIndex: correctIndex,
        correctOptionText: quiz.answer,
        isCorrect,
        timestamp: new Date()
      });
    }
  };

  const correctIndex = Array.isArray(quiz.options)
    ? quiz.options.findIndex(opt => opt === quiz.answer)
    : -1;

  const isCorrect = selectedIndex === correctIndex;

  // SVG Icons
  const CheckmarkIcon = () => (
    <svg viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const XIcon = () => (
    <svg viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  return (
    <div className="quiz-container quiz-fade-in">
      <strong>{quiz.question}</strong>

      <ul className="quiz-options">
        {Array.isArray(quiz.options) &&
          quiz.options.map((choice, index) => {
            const isSelected = index === selectedIndex;
            const isAnswer = index === correctIndex;
            
            // Show correct highlight only after wrong answer
            const shouldHighlightCorrect = revealed && !isCorrect && isAnswer;

            return (
              <li
                key={index}
                onClick={() => handleSelect(index)}
                className={`quiz-option 
                  ${revealed ? (isAnswer ? 'correct' : isSelected ? 'incorrect' : '') : ''} 
                  ${isSelected ? 'selected' : ''}
                  ${shouldHighlightCorrect ? 'correct-highlight' : ''}`}
              >
                <span>{choice}</span>
                
                {/* Show checkmark icon for correct answer */}
                {revealed && isAnswer && isSelected && (
                  <span className="answer-icon checkmark">
                    <CheckmarkIcon />
                  </span>
                )}
                
                {/* Show X icon for incorrect answer */}
                {revealed && !isAnswer && isSelected && (
                  <span className="answer-icon x-mark">
                    <XIcon />
                  </span>
                )}
              </li>
            );
          })}
      </ul>

      {/* Confetti particles (checkmarks only) */}
      {showConfetti && (
        <div className="confetti-container">
          <div className="confetti-particle">
            <CheckmarkIcon />
          </div>
          <div className="confetti-particle">
            <CheckmarkIcon />
          </div>
          <div className="confetti-particle">
            <CheckmarkIcon />
          </div>
        </div>
      )}

      {/* Feedback section with delayed appearance */}
      {showFeedback && correctIndex !== -1 && (
        <div className="quiz-feedback">
          <p className={`quiz-feedback-title ${isCorrect ? 'correct-text' : 'incorrect-text'}`}>
            {isCorrect ? `✅ ${t("message.goodanswer")}` : `❌ ${t("message.badanswer")}`}
          </p>
          <p className="quiz-explanation-label">{t("message.explanation")}</p>
          <div 
            className="explanation" 
            dangerouslySetInnerHTML={{ __html: quiz.justification }} // llm will return an html as explanation
          />
        </div>
      )}
    </div>
  );
};

// Performance optimization: Prevent unnecessary re-renders
// export default memo(ChatQuiz, (prevProps, nextProps) => {
//   return (
//     prevProps.quiz === nextProps.quiz &&
//     prevProps.messageId === nextProps.messageId &&
//     prevProps.quizIndex === nextProps.quizIndex
//   );
// });
export default ChatQuiz;