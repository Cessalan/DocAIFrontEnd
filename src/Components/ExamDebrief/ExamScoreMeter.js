import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SCORE_MAX, SCORE_MIN, SCORE_STATUS, meterFill } from './examScoreModel';

/**
 * The score meter shown under the debrief's opening line: she slides to the
 * percentage she got and saves it, or says she doesn't have it yet. The rules
 * (unset start, what is stored) live in examScoreModel.js.
 *
 * A native range input underneath, so keyboard, screen readers and touch all
 * work without custom handling; only its look is ours.
 */
const ExamScoreMeter = ({ onAnswer, disabled = false }) => {
  const { t } = useTranslation();
  const id = useId();
  const [value, setValue] = useState(75);
  const [touched, setTouched] = useState(false);

  const move = (event) => {
    setValue(Number(event.target.value));
    setTouched(true);
  };

  const fill = meterFill(value, touched);

  return (
    <div className="exam-score" role="group" aria-labelledby={`${id}-label`}>
      <div className="exam-score-head">
        <label className="exam-score-label" id={`${id}-label`} htmlFor={`${id}-range`}>
          {t('examDebrief.score.question', 'What did you get?')}
        </label>
        <output className={`exam-score-value ${touched ? '' : 'is-unset'}`} htmlFor={`${id}-range`} aria-live="polite">
          {touched ? `${value}%` : t('examDebrief.score.unset', 'Slide to your score')}
        </output>
      </div>

      <input
        id={`${id}-range`}
        className={`exam-score-range ${touched ? '' : 'is-unset'}`}
        type="range"
        min={SCORE_MIN}
        max={SCORE_MAX}
        step={1}
        value={value}
        onChange={move}
        onPointerDown={() => setTouched(true)}
        onKeyDown={() => setTouched(true)}
        disabled={disabled}
        aria-valuetext={touched ? `${value}%` : t('examDebrief.score.unset', 'Slide to your score')}
        style={{ '--exam-score-fill': `${fill * 100}%` }}
      />
      <div className="exam-score-scale" aria-hidden="true">
        <span>0</span><span>50</span><span>100</span>
      </div>

      <div className="exam-score-actions">
        <button
          type="button"
          className="exam-score-later"
          onClick={() => onAnswer(SCORE_STATUS.NOT_YET)}
          disabled={disabled}
        >
          {t('examDebrief.score.notYet', "I don't know my score yet")}
        </button>
        <button
          type="button"
          className="exam-debrief-send exam-score-save"
          onClick={() => onAnswer(SCORE_STATUS.GIVEN, value)}
          disabled={disabled || !touched}
        >
          {t('examDebrief.score.save', 'Save my score')}
        </button>
      </div>
    </div>
  );
};

export default ExamScoreMeter;
