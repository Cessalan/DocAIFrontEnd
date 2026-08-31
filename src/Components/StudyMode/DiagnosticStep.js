import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './DiagnosticStep.css';

/**
 * DiagnosticStep — six questions, before the plan exists.
 *
 * WHY THIS IS THE RISKIEST SCREEN IN THE PRODUCT
 * ───────────────────────────────────────────────
 * Production data says opening with questions is the most dangerous thing we
 * can do: quiz-first plans complete their first node 66.6% of the time against
 * 89.0% for lesson-first, with content successfully delivered in both cases. A
 * graded test at the door drives anxious students away.
 *
 * We ask anyway, because nothing else can produce the three things the rest of
 * the experience is built on — a plan shaped around her, a map that shows she
 * was understood, and a baseline that makes "you got stronger" a measurement
 * instead of a compliment.
 *
 * So every decision here is aimed at the EMOTIONAL cost, not the mechanical one:
 *
 *   · Never scored, and the words "quiz" and "test" never appear. The frame is
 *     set before the first question renders.
 *   · The benefit is stated before the cost — she is spending ninety seconds,
 *     so she is told what she is buying with them.
 *   · "I'm not sure yet" is a real, equal-weight answer, not a forfeit. It is
 *     also better data than a lucky guess.
 *   · Every answer teaches immediately. The ninety seconds is not dead time
 *     she spends being measured; she learns six things while we listen.
 *   · A wrong answer is never called wrong. There is no red, no "Incorrect",
 *     no score climbing in a corner. She is told the idea, and we move on.
 *   · She can leave at any time and still get a plan.
 *
 * The kill criterion, so it is not a matter of opinion later: if fewer than
 * ~70% of students who start this finish it, the frame is not working and the
 * diagnostic should become an optional entry point rather than the front door.
 *
 * @param {Array}    questions   from /study/diagnostic-quiz
 * @param {Function} onComplete  ({scores, answers}) -> void. `scores` is
 *                               {topic: percent}, exactly the shape
 *                               _weight_path_by_diagnostic expects.
 * @param {Function} onSkip      builds the uniform plan instead.
 * @param {string}   examName    shown in the header when we know it.
 */
const DiagnosticStep = ({ questions = [], onComplete, onSkip, examName }) => {
  const { t } = useTranslation();

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);   // option index, or 'unsure'
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [finishing, setFinishing] = useState(false);

  const total = questions.length;
  const question = questions[index];

  /* Per-topic percentages — the only output that matters downstream.
     "Not sure" counts as incorrect: she is telling us she does not have it,
     which is exactly what a wrong answer tells us, only more honestly. */
  const scoresFrom = useCallback((all) => {
    const byTopic = {};
    all.forEach((a) => {
      const key = (a.topic || 'General').trim();
      const bucket = byTopic[key] || { correct: 0, total: 0 };
      bucket.total += 1;
      if (a.correct) bucket.correct += 1;
      byTopic[key] = bucket;
    });
    const out = {};
    Object.entries(byTopic).forEach(([topic, b]) => {
      out[topic] = b.total ? Math.round((b.correct / b.total) * 100) : 0;
    });
    return out;
  }, []);

  const choose = (choice) => {
    if (revealed) return;
    setPicked(choice);
    setRevealed(true);
  };

  const advance = () => {
    const correct = picked !== 'unsure' && picked === question.correctIndex;
    const entry = {
      topic: question.topic || 'General',
      concept: question.concept || null,
      question: question.question,
      correct,
      unsure: picked === 'unsure',
    };
    const all = [...answers, entry];
    setAnswers(all);

    if (index + 1 >= total) {
      setFinishing(true);
      onComplete?.({ scores: scoresFrom(all), answers: all });
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setRevealed(false);
  };

  /* Feedback copy. Three registers, and none of them is a verdict.

     The "wrong" case deliberately has no failure word in it. She already knows
     she picked the other one; naming it adds nothing except the feeling of
     being marked. What she does not have yet is the idea, so that is what the
     panel leads with. */
  const feedback = useMemo(() => {
    if (!revealed || !question) return null;
    if (picked === 'unsure') {
      return {
        tone: 'unsure',
        title: t('diagnostic.unsureTitle', 'Good — that’s worth knowing.'),
        body: question.rationale,
      };
    }
    if (picked === question.correctIndex) {
      return {
        tone: 'known',
        title: t('diagnostic.knownTitle', 'You’ve got this one.'),
        body: question.rationale,
      };
    }
    return {
      tone: 'teach',
      title: t('diagnostic.teachTitle', 'Here’s the idea:'),
      body: question.rationale,
    };
  }, [revealed, picked, question, t]);

  if (finishing) {
    return (
      <div className="diagnostic" role="status" aria-live="polite">
        <div className="diagnostic__finishing">
          <div className="diagnostic__pulse" aria-hidden="true" />
          <h2 className="diagnostic__finishingTitle">
            {t('diagnostic.buildingTitle', 'Reading what you just showed me…')}
          </h2>
          <p className="diagnostic__finishingSub">
            {t('diagnostic.buildingSub', 'Working out where you actually stand.')}
          </p>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="diagnostic">
      <header className="diagnostic__head">
        <p className="diagnostic__eyebrow">
          {examName
            ? t('diagnostic.eyebrowExam', 'Before we plan for {{exam}}', { exam: examName })
            : t('diagnostic.eyebrow', 'Before we build your plan')}
        </p>
        <h2 className="diagnostic__title">
          {t('diagnostic.title', 'A few quick questions')}
        </h2>
        <p className="diagnostic__sub">
          {t(
            'diagnostic.sub',
            'Nothing here is graded. I just don’t want to waste your time teaching you things you already know.'
          )}
        </p>

        {/* Dots, not "3 of 6 · 1 correct". A running score is the single
            fastest way to turn this back into a test. */}
        <div className="diagnostic__dots" aria-hidden="true">
          {questions.map((_, i) => (
            <span
              key={i}
              className={
                'diagnostic__dot' +
                (i < index ? ' is-done' : '') +
                (i === index ? ' is-current' : '')
              }
            />
          ))}
        </div>
        <span className="sr-only">
          {t('diagnostic.progressSr', 'Question {{n}} of {{total}}', {
            n: index + 1,
            total,
          })}
        </span>
      </header>

      <div className="diagnostic__card">
        <p className="diagnostic__question">{question.question}</p>

        <div className="diagnostic__options" role="group">
          {(question.options || []).map((opt, i) => {
            const isPicked = picked === i;
            const isAnswer = revealed && i === question.correctIndex;
            return (
              <button
                key={i}
                type="button"
                className={
                  'diagnostic__option' +
                  (isPicked ? ' is-picked' : '') +
                  (isAnswer ? ' is-answer' : '') +
                  (revealed ? ' is-locked' : '')
                }
                onClick={() => choose(i)}
                disabled={revealed}
              >
                {/* Letter chip — the app marks every quiz option this way, and
                    without it these read as generic buttons from somewhere
                    else. */}
                <span className="diagnostic__optionLetter" aria-hidden="true">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="diagnostic__optionText">{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Equal visual weight with the options on purpose. Sized down or
            greyed out, this reads as giving up; at full weight it reads as one
            of the answers — which is what it is, and the most useful one when
            it is true. */}
        {!revealed && (
          <button
            type="button"
            className="diagnostic__unsure"
            onClick={() => choose('unsure')}
          >
            {t('diagnostic.unsure', 'I’m not sure yet')}
          </button>
        )}

        {feedback && (
          <div className={`diagnostic__feedback is-${feedback.tone}`} role="status">
            <p className="diagnostic__feedbackTitle">{feedback.title}</p>
            {feedback.body && (
              <p className="diagnostic__feedbackBody">{feedback.body}</p>
            )}
            <button
              type="button"
              className="diagnostic__next"
              onClick={advance}
              autoFocus
            >
              {index + 1 >= total
                ? t('diagnostic.seeResults', 'Show me where I stand')
                : t('diagnostic.next', 'Next')}
            </button>
          </div>
        )}
      </div>

      {/* Always available, never dramatic. An escape hatch turns a hard exit
          into a soft one — she still gets a plan, it is just not shaped
          around her. */}
      <button type="button" className="diagnostic__skip" onClick={onSkip}>
        {t('diagnostic.skip', 'Skip this — just build my plan')}
      </button>
    </div>
  );
};

export default DiagnosticStep;
