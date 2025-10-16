import React from "react";
import './ChatScenario.css'; // reuse your existing styles

const ChatScenario = ({ scenario,askScenario}) => {
  const { scenario: description, question, options, correctAnswer, explanation } = scenario;
  const [selectedIndex, setSelectedIndex] = React.useState(null);
  const [revealed, setRevealed] = React.useState(false);

  console.log("from ChatScenario :", scenario);

  const handleSelect = (index) => {
    if (revealed) return;
    setSelectedIndex(index);
    setRevealed(true);
  };

  const isCorrect = selectedIndex === correctAnswer;

  return (
    <div className="scenario-container">
      <div className="scenario-description">
        <strong>Mise en situation:</strong>
        <p>{description}</p>
      </div>

      <div className="scenario-question">
        <strong>❓ Question:</strong>
        <p>{question}</p>
      </div>

      <ul className="scenario-options">
        {options.map((option, index) => {
          const isSelected = selectedIndex === index;
          const isAnswer = index === correctAnswer;

          return (
            <li
              key={index}
              onClick={() => handleSelect(index)}
              className={
                revealed
                  ? isAnswer
                    ? "option correct"
                    : isSelected
                    ? "option incorrect"
                    : "option"
                  : "option"
              }
            >
              {option}
            </li>
          );
        })}
      </ul>

      {revealed && (
        <div className="scenario-feedback">
          <p>{isCorrect ? "✅ Bonne réponse !" : "❌ Mauvaise réponse."}</p>
          <p><strong>Explication:</strong> {explanation}</p>
        </div>
      )}

      <button onClick={askScenario} className="scenario-retry-button"> 
        <strong> ↻ Essayer un autre scenario </strong>
      </button>
    </div>
  );
};

export default ChatScenario;
