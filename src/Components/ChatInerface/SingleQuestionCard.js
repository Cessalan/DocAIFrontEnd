import React, { useState, useCallback, useMemo } from 'react';
import './SingleQuestionCard.css';

// Helper function to strip letter prefix from options (e.g., "A) Answer" -> "Answer")
function stripLetterPrefix(text) {
  if (!text) return '';
  // Match patterns like "A)", "A.", "A ", "A:" at the start
  return text.replace(/^[A-Fa-f][\)\.\:\s]\s*/, '').trim();
}

/**
 * SingleQuestionCard - Minimal single question for momentum phase
 *
 * No modal, no "Question 1 of X", no skip, no view results
 * Just: question → answer options → visual feedback on selection
 * Micro-rationale displays separately in chat (not in this component)
 *
 * Data format from backend:
 * - question.options = array of strings like ["A) First answer", "B) Second answer", ...]
 * - question.answer = the correct answer string
 */
const SingleQuestionCard = ({ question, onAnswerSelect, messageId }) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Find the correct answer index by comparing with question.answer
  const correctIndex = useMemo(() => {
    if (!question || !Array.isArray(question.options)) return -1;
    return question.options.findIndex(opt => opt === question.answer);
  }, [question]);

  const handleAnswerSelect = useCallback((answerIndex) => {
    if (hasAnswered) return;

    setSelectedAnswer(answerIndex);
    setHasAnswered(true);

    const isCorrect = answerIndex === correctIndex;
    const selectedOptionText = question.options?.[answerIndex];
    const correctOptionText = question.answer;

    // Notify parent with answer data for micro-rationale
    if (onAnswerSelect) {
      onAnswerSelect({
        questionId: question.id || messageId,
        question: question.question,
        // Fields for micro-rationale request
        selectedAnswer: stripLetterPrefix(selectedOptionText),
        correctAnswer: stripLetterPrefix(correctOptionText),
        // Fields for UI state update (matching ChatQuiz format)
        selectedOptionIndex: answerIndex,
        selectedOptionText: stripLetterPrefix(selectedOptionText),
        correctAnswerText: stripLetterPrefix(correctOptionText),
        isCorrect,
        topic: question.topic || null,
        originalRationale: question.justification || question.explanation || null,
        timestamp: new Date().toISOString()
      });
    }
  }, [hasAnswered, question, correctIndex, onAnswerSelect, messageId]);

  if (!question) return null;

  return (
    <div className="single-question-card">
      {/* Question */}
      <div className="sqc-question">
        <p className="sqc-question-text">{question.question}</p>
      </div>

      {/* Options */}
      <div className="sqc-options">
        {question.options?.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrectOption = index === correctIndex;

          let optionClass = 'sqc-option';
          if (hasAnswered) {
            if (isCorrectOption) {
              optionClass += ' sqc-option-correct';
            } else if (isSelected && !isCorrectOption) {
              optionClass += ' sqc-option-incorrect';
            } else {
              optionClass += ' sqc-option-disabled';
            }
          }

          return (
            <button
              key={index}
              className={optionClass}
              onClick={() => handleAnswerSelect(index)}
              disabled={hasAnswered}
            >
              <span className="sqc-option-letter">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="sqc-option-text">{stripLetterPrefix(option)}</span>
              {hasAnswered && isCorrectOption && (
                <span className="sqc-option-check">✓</span>
              )}
              {hasAnswered && isSelected && !isCorrectOption && (
                <span className="sqc-option-x">✗</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SingleQuestionCard;
