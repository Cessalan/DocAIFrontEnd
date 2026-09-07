import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StudyLessonCard from '../StudyMode/StudyLessonCard';
import StudyQuizCard from '../StudyMode/StudyQuizCard';
import { generate_study_item_stream } from '../../Services/FastAPICalls';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import { FUNNEL, logFunnelStep, logFunnelStepOnce } from '../../Services/FunnelService';
import './FirstLessonPane.css';

/**
 * FirstLessonPane — teach her something before asking her anything.
 *
 * WHY THIS SITS WHERE IT DOES
 *
 * The old flow asked three questions between the upload and the first piece
 * of generated content. Only 26% of uploads ever answered the first one. This
 * pane is the content that used to be on the far side of that questionnaire,
 * moved in front of it: one lesson on the topic the insights card just said
 * to start with, then two questions to make it stick.
 *
 * LESSON FIRST, NOT QUIZ FIRST
 *
 * Deliberate, and measured: lesson-first plans complete their first node
 * 89.0% of the time against 66.6% for quiz-first. "Just start testing her"
 * is contraindicated by the app's own data, so the quick check comes after
 * the teaching and is two questions, not a diagnostic.
 *
 * ── Metering ────────────────────────────────────────────────────────────
 * The two quick-check questions are CHARGED to the question meter but do not
 * GATE on it. That asymmetry is the point of the whole redesign: gating here
 * would put a paywall in front of the first thing of value she ever sees,
 * which is the failure being fixed. The meter stays honest (she is billed for
 * what was generated) while the demo always runs.
 *
 * The backend keeps its own quota gate on /study/generate-item-stream, so a
 * genuinely exhausted account is still refused server-side. That refusal is
 * handled as a skip, not an error — see `handleFailure`. A student who cannot
 * be shown a lesson should land on the exam-date question, not on a dead end.
 *
 * ── The quick check IS the diagnostic ───────────────────────────────────
 * There used to be a separate 5-question diagnostic after this, asking her
 * more questions on the same uploaded material she had just been questioned
 * on. Two assessments back to back, 7 questions before a plan.
 *
 * These answers now do that job, so the score has to leave this component.
 * `onDone` reports {topic, correct, total, percent} and PlanOnboarding turns
 * it into the {topic: percent} map the planner tiers on.
 *
 * The score is measured on FIRST ATTEMPT (`firstAttemptStatuses`), not on the
 * final state. StudyQuizCard re-queues a missed question until it is answered
 * correctly, which is right for learning and useless for measurement — every
 * student would finish at 100% and every topic would tier as `solid`.
 */

// Matches the `num_questions` we ask the backend for. Two is enough to make
// the teaching land and short enough that nobody abandons midway; a full
// STUDY_QUIZ_QUESTIONS set here would rebuild the wall we just removed.
const QUICK_CHECK_QUESTIONS = 2;

// Pages the lesson generator is asked for, used for the progress bar's
// expected total while pages stream in one at a time.
const EXPECTED_LESSON_PAGES = 4;

const FirstLessonPane = ({
  chatId,
  topic,
  contextTags = [],
  language = 'en',
  onDone,
}) => {
  const { t } = useTranslation();
  const { consume } = useUsageLimit();

  // 'lesson' → 'quickcheck' → done
  const [step, setStep] = useState('lesson');
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState(null);

  // React 18 StrictMode double-invokes effects in development. Without this
  // the pane fires two generations, bills the student twice, and races two
  // streams into the same state.
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

  // Latest first-attempt snapshot from the quiz card, kept in a ref because
  // only `finish` reads it and re-rendering on every answer would restart
  // nothing useful.
  const firstAttemptRef = useRef({});

  useEffect(() => () => { cancelledRef.current = true; }, []);

  /**
   * Any failure to produce content — including a server-side quota refusal —
   * moves her on rather than stopping her. There is nothing useful to retry
   * into: the next screen asks for her exam date and works regardless.
   */
  const handleFailure = useCallback((err, stage) => {
    console.error(`First lesson (${stage}) failed:`, err);
    if (cancelledRef.current) return;
    logFunnelStep(FUNNEL.FLOW_ABANDONED, { stage, reason: err?.message || 'unknown' });
    setError(stage);
  }, []);

  // ── Lesson ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId || !topic || startedRef.current) return;
    startedRef.current = true;

    logFunnelStepOnce(FUNNEL.FIRST_LESSON_STARTED, { topic });

    // Seed a streaming shell so the card paints immediately with a progress
    // bar instead of a spinner — pages land into it as they arrive.
    setLesson({ title: topic, pages: [], _isStreaming: true, _expectedTotal: EXPECTED_LESSON_PAGES });

    const onProgress = (data) => {
      if (cancelledRef.current) return;
      if (data.status === 'lesson_title' && data.title) {
        setLesson(prev => ({ ...prev, title: data.title }));
      }
      if (data.status === 'lesson_page_ready' && data.page) {
        setLesson(prev => ({ ...prev, pages: [...(prev?.pages || []), data.page] }));
      }
    };

    generate_study_item_stream(
      chatId, 'lesson', topic, contextTags, [], language, onProgress
    )
      .then((result) => {
        if (cancelledRef.current) return;
        if (!result?.content) {
          // The stream closed without a final payload. Keep whatever pages
          // arrived — a partial lesson she can read beats an error she can't.
          setLesson((prev) => {
            if (prev?.pages?.length) {
              const { _isStreaming, _expectedTotal, ...rest } = prev;
              return rest;
            }
            handleFailure(new Error('empty lesson'), 'lesson');
            return prev;
          });
          return;
        }
        setLesson({ ...result.content, _isStreaming: false });
      })
      .catch(err => handleFailure(err, 'lesson'));
    // contextTags is a fresh array each render; depending on it would refire
    // the generation. chatId + topic are what actually identify this lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, topic, language, handleFailure]);

  // ── Quick check ──────────────────────────────────────────────────────
  const startQuickCheck = useCallback(() => {
    logFunnelStep(FUNNEL.FIRST_LESSON_COMPLETED, { topic });
    logFunnelStep(FUNNEL.QUICK_CHECK_STARTED, { topic });
    setStep('quickcheck');
    setQuiz({ questions: [], _isStreaming: true, _expectedTotal: QUICK_CHECK_QUESTIONS });

    const onProgress = (data) => {
      if (cancelledRef.current) return;
      if (data.status !== 'question_ready' || !data.question) return;

      // Same A)/B) answer-letter decoding StudyModeContainer does. The
      // generator returns the answer as a letter, the card wants an index.
      const q = data.question;
      const letter = (q.answer || 'A)')[0] || 'A';
      setQuiz(prev => ({
        ...prev,
        questions: [...(prev?.questions || []), {
          question: q.question || '',
          options: q.options || [],
          correctIndex: letter.charCodeAt(0) - 'A'.charCodeAt(0),
          rationale: q.justification || '',
          topic: q.topic || topic,
        }],
      }));
    };

    generate_study_item_stream(
      chatId, 'quiz', topic, contextTags, [], language, onProgress,
      { numQuestions: QUICK_CHECK_QUESTIONS }
    )
      .then((result) => {
        if (cancelledRef.current) return;
        const streamed = result?.content?.questions;
        setQuiz((prev) => {
          const questions = (streamed?.length ? streamed : prev?.questions) || [];
          if (questions.length === 0) {
            handleFailure(new Error('empty quick check'), 'quickcheck');
            return prev;
          }
          return { questions, _isStreaming: false };
        });
        // Charge after the fact — see the metering note in the header.
        consume(QUICK_CHECK_QUESTIONS).catch(() => {});
      })
      .catch(err => handleFailure(err, 'quickcheck'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, topic, language, consume, handleFailure]);

  /**
   * StudyQuizCard reports progress per answer and calls onContinue with no
   * arguments, so the score has to be accumulated here rather than read at
   * the end.
   */
  const handleQuizAnswer = useCallback(({ progress } = {}) => {
    if (progress?.firstAttemptStatuses) {
      firstAttemptRef.current = progress.firstAttemptStatuses;
    }
  }, []);

  const finish = useCallback((extra = {}) => {
    const statuses = Object.values(firstAttemptRef.current || {});
    const total = statuses.length;
    const correct = statuses.filter(st => st === 'correct').length;
    // null, not 0, when she answered nothing — "she scored 0%" and "we never
    // asked" tier a topic very differently, and only one of them is true.
    const percent = total > 0 ? Math.round((correct / total) * 100) : null;

    logFunnelStep(FUNNEL.QUICK_CHECK_COMPLETED, { topic, correct, total, percent });
    onDone && onDone({ topic, correct, total, percent, ...extra });
  }, [onDone, topic]);

  // ── Render ───────────────────────────────────────────────────────────

  // A failure at either stage offers the way forward rather than a retry:
  // the next screen does not depend on this content.
  if (error) {
    return (
      <div className="first-lesson first-lesson--error">
        <p className="first-lesson__error-text">{t('firstLesson.unavailable')}</p>
        <button
          type="button"
          className="first-lesson__skip first-lesson__skip--primary"
          onClick={() => onDone && onDone({ skipped: true, reason: error })}
        >
          {t('firstLesson.continueToPlan')}
        </button>
      </div>
    );
  }

  if (step === 'quickcheck') {
    return (
      <div className="first-lesson">
        <header className="first-lesson__header">
          <p className="first-lesson__eyebrow">{t('firstLesson.quickCheckEyebrow')}</p>
          <p className="first-lesson__sub">{t('firstLesson.quickCheckSub')}</p>
        </header>
        {quiz && (
          <StudyQuizCard
            content={quiz}
            onAnswer={handleQuizAnswer}
            onContinue={finish}
            onExit={() => finish({ skipped: true })}
          />
        )}
      </div>
    );
  }

  return (
    <div className="first-lesson">
      <header className="first-lesson__header">
        <p className="first-lesson__eyebrow">{t('firstLesson.lessonEyebrow')}</p>
        {/* Does not name the topic — the lesson card's own title carries it,
            and printing it twice cost two lines of the height that was
            pushing the CTA under the composer. */}
        <p className="first-lesson__sub">{t('firstLesson.lessonSub')}</p>
      </header>
      {lesson && (
        <StudyLessonCard
          content={lesson}
          // No "Lesson complete!" screen here. In study mode that celebration
          // is the reward for finishing a node; inside this flow it is a
          // full-screen interstitial with one button, sitting between the
          // teaching and the questions that check it.
          skipCelebration
          onContinue={startQuickCheck}
          onExit={startQuickCheck}
        />
      )}
    </div>
  );
};

export default FirstLessonPane;
