import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A single-answer question on a shared set.
 *
 * The select-all, ordering and matrix formats use the app's own cards. The
 * app's single-answer card lives inside the study plan (hints, the question
 * meter, saved progress) and cannot run for a visitor with no account, so this
 * is the same interaction with none of that: tap, see the verdict and the
 * reasoning at once, move on.
 *
 * The explanation is rendered as text. It arrives through readSharedSet with
 * markup already stripped, and stays text here regardless.
 */
export default function SharedMcqCard({ quiz, onAnswerSelect, onNext, isLastQuestion, previousAnswer = null }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(previousAnswer?.selectedIndex ?? null);
  const answered = selected !== null;
  const correct = answered && selected === quiz.correctIndex;

  const choose = (index) => {
    if (answered) return;
    setSelected(index);
    const right = index === quiz.correctIndex;
    onAnswerSelect?.({ questionType: 'mcq', selectedIndex: index, isCorrect: right, score: right ? 1 : 0, maxScore: 1 });
  };

  return (
    <div className="shared-mcq">
      <p className="shared-mcq__kind">{t('shareSet.kindMcq')}</p>
      <h2 className="shared-mcq__question">{quiz.question}</h2>
      <div className="shared-mcq__options" role="group" aria-label={t('shareSet.optionsLabel')}>
        {quiz.options.map((option, index) => {
          const isKey = answered && index === quiz.correctIndex;
          const isMiss = answered && index === selected && !correct;
          return (
            <button
              key={index}
              type="button"
              className={`shared-option${isKey ? ' is-right' : ''}${isMiss ? ' is-missed' : ''}${answered && !isKey && !isMiss ? ' is-rest' : ''}`}
              onClick={() => choose(index)}
              disabled={answered}
              aria-pressed={index === selected}
            >
              <span className="shared-option__letter" aria-hidden="true">
                {isKey ? '✓' : isMiss ? '✕' : String.fromCharCode(65 + index)}
              </span>
              <span className="shared-option__text">{option.replace(/^[A-Fa-f][).]\s+/, '')}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="shared-mcq__after" role="status">
          <p className={`shared-verdict${correct ? ' is-right' : ''}`}>
            {correct ? t('shareSet.right') : t('shareSet.notQuite')}
          </p>
          {(quiz.rationale || quiz.correctBlurb) && (
            <p className="shared-mcq__why">{quiz.rationale || quiz.correctBlurb}</p>
          )}
          <button type="button" className="shared-primary" onClick={onNext}>
            {isLastQuestion ? t('shareSet.seeResult') : t('shareSet.nextQuestion')}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
