import { useState,useEffect } from "react";
import './ChatInterface.css';
import './ChatQuiz.css';
// translation
import { useTranslation } from 'react-i18next';

const ChatQuiz = ({ quiz, onAnswerSelect, messageId, quizIndex }) => {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [revealed, setRevealed] = useState(false);

  // Check if user has already answered this question
  useEffect(() => {
    if (quiz.userSelection) {
      setSelectedIndex(quiz.userSelection.selectedIndex);
      setRevealed(true);
    }
  }, [quiz.userSelection]);

  const { t , i18n} = useTranslation();

  const handleSelect = (index) => {
    if (revealed) return;
    
    setSelectedIndex(index);
    setRevealed(true);

    // Pass the answer selection up to parent components
    if (onAnswerSelect) {

      const correctIndex = Array.isArray(quiz.options)
        ? quiz.options.findIndex(opt => opt === quiz.answer)
        : -1;
      
      const isCorrect = index === correctIndex;
      
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

  return (
    <div className="quiz-container">
      <strong> {quiz.question}</strong>

      <ul className="quiz-options">
        {Array.isArray(quiz.options) &&
          quiz.options.map((choice, index) => {
            const isSelected = index === selectedIndex;
            const isAnswer = index === correctIndex;

            return (
              <li
                key={index}
                onClick={() => handleSelect(index)}
                className={`quiz-option ${revealed ? (isAnswer ? 'correct' : isSelected ? 'incorrect' : '') : ''} 
                          ${isSelected ? 'selected' : ''}`}
              >
                {choice}
              </li>
            );
          })}
      </ul>

      {revealed && correctIndex !== -1 && (
        <div className="quiz-feedback">
          <p className={`quiz-feedback-title ${isCorrect ? 'correct-text' : 'incorrect-text'}`}>
            {isCorrect ? `✅${t("message.goodanswer")}` : `❌ ${t("message.badanswer")}`}
          </p>
          <p className="quiz-explanation-label">{t("message.explanation")}</p>
          <p>{quiz.justification}</p>
        </div>
      )}
    </div>
  );
};

export default ChatQuiz;