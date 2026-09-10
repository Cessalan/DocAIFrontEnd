import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { playCorrectSound, playIncorrectSound } from '../../utils/soundEffects';
import { CONFIDENCE_ICONS } from './NclexIcons';

/* ══════════════════════════════════════════════════════════════════════
   NCLEX MCQ — read, think, select, reflect, submit.

   WHY THIS IS NOT DrillQuestion
   ─────────────────────────────
   The drill's multiple choice is COMMIT-THEN-REVEAL: the first tap is the
   answer, and it cannot be taken back. That is deliberate there — the drill
   is trying to feel like the exam, and an answer the student was allowed to
   walk back is not evidence.

   This screen is trying to feel like studying. She reads, weighs the
   options, changes her mind, says how sure she is, and only then commits.
   Those are different products with different jobs, so they get different
   components rather than one component with a mode flag.

   SATA and case study still go through DrillQuestion, because they own
   NCLEX partial-credit scoring and forking that would fork the grading
   rules that every format bucket depends on.

   WHY CONFIDENCE MOVED
   ────────────────────
   It used to sit above the question — "before you answer, how sure are
   you?" — which asked her to rate a question she had not read yet. Asking
   after she has chosen is the only point where the answer means anything,
   and it is also where it costs the least: the thinking is done.

   It stays OPTIONAL. Confident-and-wrong is the quadrant that fails
   candidates, so the signal is worth a lot — but a required tap on every
   question would cost more answers than the signal is worth.
   ══════════════════════════════════════════════════════════════════════ */

/** Kept in the order they are offered; stored verbatim on the attempt. */
export const CONFIDENCE_LEVELS = ['not_sure', 'pretty_sure', 'very_sure'];

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const NclexMcq = ({ question, questionNumber, onAnswer, answered }) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [showRationale, setShowRationale] = useState(false);

  // Reset per position, not per object, so a regenerated question at the same
  // position still clears the selection.
  useEffect(() => {
    setSelected(null);
    setConfidence(null);
    setShowRationale(false);
  }, [questionNumber]);

  const revealed = !!answered;
  if (!question) return null;

  const options = question.options || [];
  const shown = revealed ? (answered.selectedIndex ?? selected) : selected;
  const wasCorrect = revealed && answered.isCorrect;

  const submit = () => {
    if (revealed || selected === null) return;
    const correct = selected === question.correctIndex;
    if (correct) playCorrectSound();
    else playIncorrectSound();

    onAnswer({
      format: 'mcq',
      isCorrect: correct,
      score: correct ? 1 : 0,
      maxScore: 1,
      selectedIndex: selected,
      confidence,
      concept: correct ? undefined : question.question,
      conceptKey: question.concept || question.conceptKey || null,
      topic: question.topic,
    });
  };

  return (
    <div className="nq-mcq">
      <h2 className="nq-mcq-stem">{question.question}</h2>
      {!revealed && (
        <p className="nq-mcq-hint">{t('nclex.selectBest', 'Select the best answer.')}</p>
      )}

      <div className="nq-options" role="radiogroup">
        {options.map((opt, i) => {
          const isPicked = i === shown;
          let cls = 'nq-option';
          if (!revealed && isPicked) cls += ' is-picked';
          if (revealed) {
            cls += ' is-revealed';
            if (i === question.correctIndex) cls += ' is-correct';
            else if (isPicked) cls += ' is-wrong';
          }
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isPicked}
              className={cls}
              disabled={revealed}
              onClick={() => setSelected(i)}
            >
              <span className="nq-option-letter">{LETTERS[i] || i + 1}</span>
              <span className="nq-option-text">{opt.replace(/^[A-Fa-f][).]\s*/, '')}</span>
            </button>
          );
        })}
      </div>

      {/* Only after a choice, and never once the answer is in. */}
      {!revealed && selected !== null && (
        <div className="nq-confidence">
          <span className="nq-confidence-ask">
            {t('nclex.howConfident', 'How confident are you?')}
          </span>
          <div className="nq-confidence-scale" role="radiogroup">
            {CONFIDENCE_LEVELS.map((level) => {
              const Mark = CONFIDENCE_ICONS[level];
              const on = confidence === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`nq-conf-card${on ? ' is-on' : ''}`}
                  onClick={() => setConfidence(on ? null : level)}
                >
                  <span className="nq-conf-mark" aria-hidden="true"><Mark /></span>
                  <span className="nq-conf-label">
                    {t(`nclex.conf.${level}`, {
                      not_sure: 'Not sure',
                      pretty_sure: 'Pretty sure',
                      very_sure: 'Very sure',
                    }[level])}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!revealed && (
        <div className="nq-mcq-actions">
          <button
            type="button"
            className="nq-check"
            disabled={selected === null}
            onClick={submit}
          >
            {t('nclex.checkAnswer', 'Check answer')}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {revealed && (
        <div className={`nq-verdict-strip ${wasCorrect ? 'is-correct' : 'is-wrong'}`}>
          <span className="nq-verdict-label">
            {wasCorrect ? t('nclex.correctV', 'Correct') : t('nclex.notQuite', 'Not quite')}
          </span>
          {question.correctBlurb && (
            <span className="nq-verdict-blurb">{question.correctBlurb}</span>
          )}
        </div>
      )}

      {revealed && question.rationale && (
        <div className="nq-rationale">
          <button
            type="button"
            className="nq-rationale-toggle"
            onClick={() => setShowRationale((v) => !v)}
          >
            {showRationale
              ? t('study.showLess', 'Show less')
              : t('study.learnMore', 'Learn more')}
          </button>
          {showRationale && (
            <div
              className="nq-rationale-text"
              dangerouslySetInnerHTML={{ __html: question.rationale }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default NclexMcq;
