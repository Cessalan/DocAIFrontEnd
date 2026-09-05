import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SATAQuestion from '../ChatInerface/SATAQuestion';
import CaseStudyQuestion from '../ChatInerface/CaseStudyQuestion';
import { playCorrectSound, playIncorrectSound } from '../../utils/soundEffects';

/**
 * DrillQuestion — renders one drill question in whichever format it arrived as.
 *
 * SATA and case study are handed to the components the exam node already uses.
 * They own their own selection UI, submit button and feedback panel, and they
 * already implement NCLEX partial-credit scoring — rebuilding either here would
 * fork the grading rules that `updateStudyPerformance` buckets by format.
 *
 * MCQ is inline because the shared card is built around a fixed question array
 * and the drill has exactly one question in flight at a time.
 *
 * COMMIT-THEN-REVEAL
 * ──────────────────
 * Once an answer is submitted it cannot be changed. This does more for the
 * exam feeling than any amount of styling, and it keeps the student model
 * honest: an answer the student was allowed to walk back is not evidence.
 */
const DrillQuestion = ({
  question,
  questionNumber,
  positionInBlock,  // 1-based position within the current block
  blockSize,        // questions in this block, so the reused components can
                    // render "Question 3 of 10" instead of "3 of 0"
  onAnswer,      // ({ isCorrect, score, maxScore, format, ... })
  onNext,
  answered,      // answer payload once submitted, else null
}) => {
  const { t } = useTranslation();
  const format = question?.questionType || 'mcq';

  const [selected, setSelected] = useState(null);
  const [showRationale, setShowRationale] = useState(false);

  // Reset per question. Keyed on questionNumber rather than the object so a
  // regenerated question at the same position still clears the selection.
  useEffect(() => {
    setSelected(null);
    setShowRationale(false);
  }, [questionNumber]);

  const revealed = !!answered;

  const handleMCQ = (index) => {
    if (revealed) return;
    const correct = index === question.correctIndex;
    setSelected(index);
    if (correct) playCorrectSound();
    else playIncorrectSound();

    onAnswer({
      format: 'mcq',
      isCorrect: correct,
      score: correct ? 1 : 0,
      maxScore: 1,
      selectedIndex: index,
      concept: correct ? undefined : question.question,
      conceptKey: question.concept || question.conceptKey || null,
      topic: question.topic,
    });
  };

  const handleComplex = (data) => {
    if (revealed) return;
    if (data.isCorrect) playCorrectSound();
    else playIncorrectSound();

    onAnswer({
      format,
      isCorrect: !!data.isCorrect,
      score: data.score ?? 0,
      maxScore: data.maxScore ?? 1,
      percentage: data.percentage ?? 0,
      concept: data.isCorrect ? undefined : question.question,
      conceptKey: question.concept || question.conceptKey || null,
      topic: question.topic,
    });
  };

  if (!question) return null;

  // SATA and case study render themselves whole, including their own feedback.
  if (format === 'sata') {
    return (
      <SATAQuestion
        quiz={question}
        quizIndex={Math.max(0, (positionInBlock || 1) - 1)}
        totalQuestions={blockSize || 1}
        onAnswerSelect={handleComplex}
        onNext={onNext}
        isLastQuestion={false}
        inModal={false}
      />
    );
  }

  if (format === 'casestudy') {
    return (
      <CaseStudyQuestion
        quiz={question}
        quizIndex={Math.max(0, (positionInBlock || 1) - 1)}
        totalQuestions={blockSize || 1}
        onAnswerSelect={handleComplex}
        onNext={onNext}
        isLastQuestion={false}
        inModal={false}
      />
    );
  }

  const selectedIndex = revealed ? (answered.selectedIndex ?? selected) : selected;
  const wasCorrect = revealed && answered.isCorrect;

  return (
    <div className="drill-mcq" data-selectable="true">
      <p className="drill-mcq__question">{question.question}</p>

      <div className="drill-options">
        {(question.options || []).map((opt, i) => {
          let cls = 'drill-option';
          if (revealed) {
            cls += ' revealed';
            if (i === selectedIndex) cls += wasCorrect ? ' correct' : ' incorrect';
            if (i === question.correctIndex && !wasCorrect) cls += ' correct';
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => handleMCQ(i)}
              disabled={revealed}
              type="button"
            >
              <span className="drill-option__letter">{String.fromCharCode(65 + i)}</span>
              <span className="drill-option__text">{opt.replace(/^[A-Da-d]\)\s*/, '')}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className={`drill-verdict ${wasCorrect ? 'correct' : 'incorrect'}`}>
          <span className="drill-verdict__label">
            {wasCorrect ? t('drill.correct', 'Correct') : t('drill.incorrect', 'Not quite')}
          </span>
          {question.correctBlurb && (
            <span className="drill-verdict__blurb">{question.correctBlurb}</span>
          )}
        </div>
      )}

      {revealed && question.rationale && (
        <div className="drill-rationale">
          <button
            className="drill-rationale__toggle"
            onClick={() => setShowRationale((v) => !v)}
            type="button"
          >
            {showRationale ? t('study.showLess', 'Show less') : t('study.learnMore', 'Learn more')}
          </button>
          {showRationale && (
            <p
              className="drill-rationale__text"
              dangerouslySetInnerHTML={{ __html: question.rationale }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DrillQuestion;
