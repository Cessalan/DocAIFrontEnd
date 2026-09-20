import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { plan_diagnostic_quiz } from '../../Services/FastAPICalls';
import { updateStudyPerformance, saveQuickCheckRecord } from '../../Services/StudySessionService';
import { QuestionAnswerRecord, QuickCheckRecord } from '../../Services/QuickCheckRecord';
import { v4 as uuidv4 } from 'uuid';
import { FUNNEL, logFunnelStep, logFunnelStepOnce } from '../../Services/FunnelService';
import { plannerTopics } from './courseIntelligenceModel';
import {
  calibrationQuestions, calibrationPlan, gradeAnswer, isKeyOption, answerKey, formatTally, questionFormatCounts,
} from './courseCalibrationModel';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import { CourseStudioHeader } from './CourseStudioFrame';
import CourseSourceTabs from './CourseSourceTabs';
import { CheckIcon } from './CourseIntelligenceIcons';
import DatePicker from '../Common/DatePicker';
import './CourseStudio.css';
import CourseSourcePassage from './CourseSourcePassage';
import './CourseDocumentStage.css';
import CourseExamWelcome from './CourseExamWelcome';
import QuickCheckFindings from './QuickCheckFindings';

const QUESTION_WAIT_MS = 25000;

// A chip naming the format before she reads the stem, so a select-all item is
// never mistaken for "pick one". Plain applied questions need no label.
const formatLabelKey = (question) => {
  if (question?.format === 'sata') return 'courseStudio.formatSata';
  if (question?.format === 'casestudy') return 'courseStudio.formatCase';
  if (question?.kind === 'prioritization') return 'courseStudio.formatPriority';
  return null;
};

// A single surface: course evidence -> first-attempt answers -> an explained order.
// The raw course report remains untouched; answers travel beside it to the planner.
const CourseStudyBrief = ({ report, chatId, filenames = [], language = 'en', daysToExam = null,
  examDate = null, onExamDate, disabled = false, onStart, initialQuiz = null, initialPhase = 'brief', streamlined = false,
  // The upload this check belongs to. Logged explicitly so a check resumed after
  // a reload still lands in its upload's funnel — the in-memory id is gone by then.
  funnelId = null, savedProgress = null, onProgress }) => {
  const { t } = useTranslation();
  const questionId = useId();
  const [resume] = useState(savedProgress);
  const [phase, setPhase] = useState(resume?.phase || initialPhase);
  const [questionLanguage, setQuestionLanguage] = useState(resume?.language || null);
  const [quiz, setQuiz] = useState(resume ? { state: 'ready', questions: resume.questions } : initialQuiz ? { state: 'ready', questions: initialQuiz.questions } : { state: 'loading', questions: [] });
  const [answers, setAnswers] = useState(resume?.answers || []);
  const [picked, setPicked] = useState(resume?.picked ?? null);
  // Select-all choices before "Check my answer". `picked` stays null until she
  // commits, so every "has she answered" test below means the same thing.
  const [selection, setSelection] = useState(resume?.selection || []);
  const { consume } = useUsageLimit();
  const [showDate, setShowDate] = useState(false);
  const [starting, setStarting] = useState(false);
  const heading = useRef(null);
  const questionHeading = useRef(null);
  const dateAnchor = useRef(null);
  const phaseRef = useRef(initialPhase);
  const answerLock = useRef(false);
  const completedRef = useRef(resume?.phase === 'result' || resume?.phase === 'date');
  const [checkId] = useState(() => resume?.checkId || uuidv4());
  const buildLock = useRef(false);
  const requestRef = useRef(null);
  const topicKey = JSON.stringify(plannerTopics(report));
  // Once the check starts, translating the surrounding UI must not replace
  // questions underneath answers the student has already given.
  const requestLanguage = questionLanguage || language;
  const initialPlan = useMemo(() => calibrationPlan(report), [report]);
  const adaptedPlan = useMemo(() => calibrationPlan(report, answers, daysToExam), [report, answers, daysToExam]);
  const isResult = phase === 'result';
  const currentPlan = isResult || phase === 'date' ? adaptedPlan : initialPlan;
  const question = quiz.questions[answers.length];
  const hasAnswer = picked !== null;
  const lead = currentPlan.rows[0];
  const isSata = question?.format === 'sata';
  const grade = question && hasAnswer ? gradeAnswer(question, picked) : { correct: false, partial: false };
  const tagFunnel = (props) => (funnelId ? { ...props, funnelId } : props);

  // Save the exact questions and review state, including committed answers
  // awaiting Next and uncommitted select-all choices. The callback is kept in
  // a ref so parent message updates cannot cause a persistence render loop.
  const onProgressRef = useRef(onProgress);
  useLayoutEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => {
    if (quiz.state !== 'ready') return;
    onProgressRef.current?.({ checkId, questions: quiz.questions, answers, picked, selection,
      phase, language: requestLanguage });
  }, [checkId, quiz, answers, picked, selection, phase, requestLanguage]);

  useEffect(() => {
    if (initialPhase === 'check' && !resume) {
      heading.current?.focus();
      logFunnelStep(FUNNEL.DIAGNOSTIC_STARTED, { via: 'source_transformation', questionCount: initialQuiz?.questions?.length || 0 });
      logFunnelStep(FUNNEL.READINESS_CHECK_STARTED, tagFunnel({
        via: 'source_transformation',
        questionCount: initialQuiz?.questions?.length || 0,
        ...questionFormatCounts(initialQuiz?.questions || []),
      }));
    }
    // tagFunnel only reads funnelId, which is fixed for the life of the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhase, initialQuiz, resume]);

  useEffect(() => {
    logFunnelStepOnce(FUNNEL.REPORT_VIEWED, { via: 'course_brief', priorityCount: initialPlan.rows.length });
  }, [initialPlan.rows.length]);

  // Prepare questions while the student reads the brief. Abort on skip/unmount;
  // late responses cannot replace a result or restart an abandoned assessment.
  useEffect(() => {
    if (initialQuiz || resume) return undefined;
    let alive = true;
    const controller = new AbortController();
    requestRef.current = controller;
    setQuiz({ state: 'loading', questions: [] });
    const timer = setTimeout(() => {
      if (!alive) return;
      alive = false;
      controller.abort();
      setQuiz({ state: 'unavailable', questions: [] });
    }, QUESTION_WAIT_MS);
    const topics = JSON.parse(topicKey);
    const load = async () => {
      try {
        if (!chatId || !topics.length) throw new Error('No course topics');
        const data = await plan_diagnostic_quiz(chatId, [], requestLanguage, {}, { priorityTopics: topics.slice(0, 3), signal: controller.signal });
        if (!alive) return;
        const questions = calibrationQuestions(data, topics);
        setQuiz({ state: questions.length >= 2 ? 'ready' : 'unavailable', questions });
      } catch (error) {
        if (alive && !controller.signal.aborted) setQuiz({ state: 'unavailable', questions: [] });
      } finally {
        clearTimeout(timer);
      }
    };
    load();
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [chatId, requestLanguage, topicKey, initialQuiz, resume]);

  useEffect(() => {
    if (phaseRef.current !== phase) {
      heading.current?.focus();
      phaseRef.current = phase;
    }
  }, [phase]);
  useEffect(() => {
    if (phase === 'check' && answers.length > 0) questionHeading.current?.focus();
  }, [phase, answers.length]);

  const finish = (all) => {
    if (completedRef.current) return;
    completedRef.current = true;
    setQuestionLanguage(value => value || language);
    requestRef.current?.abort();
    setAnswers(all);
    setPhase('result');
    if (chatId && all.length) {
      const record = new QuickCheckRecord({ checkId, chatId, answers: all, offered: quiz.questions.length, funnelId });
      Promise.resolve(saveQuickCheckRecord(record))
        .catch(() => saveQuickCheckRecord(record))
        .catch(error => console.error('Failed to save quick-check baseline:', error));
    }
    const plan = calibrationPlan(report, all, daysToExam);
    logFunnelStep(FUNNEL.DIAGNOSTIC_COMPLETED, tagFunnel({
      via: 'course_brief', answered: all.length, offered: quiz.questions.length,
      skipped: all.length === 0, scoredTopics: Object.keys(plan.scores || {}).length,
      ...formatTally(all),
    }));
    // Metered, never gated. The check is the value a free plan exists to show,
    // so it always runs, but what she answered still counts toward the weekly
    // allowance. Charged per answer, not per question generated: a question
    // she skipped taught her nothing.
    if (all.length) Promise.resolve(consume(all.length)).catch(() => {});
    logFunnelStepOnce(FUNNEL.REVEAL_VIEWED, { via: 'course_brief', changedStart: plan.changed, startTopic: plan.rows[0]?.topic });
    // Writes touch the same performance document: serialize them to avoid
    // concurrent read/modify/write losing part of the student's baseline.
    if (chatId && all.length) {
      (async () => {
        for (const answer of all) {
          await updateStudyPerformance(chatId, {
            topic: answer.topic, type: 'quiz', correct: answer.correct,
            concept: answer.correct ? undefined : answer.question,
            conceptKey: answer.concept || undefined, format: answer.format || 'mcq',
          });
        }
      })().catch(() => { /* The plan already carries the scores if baseline storage fails. */ });
    }
  };

  // One answer, as the planner and the funnel read it.
  const answerRecord = () => {
    const graded = gradeAnswer(question, picked);
    return new QuestionAnswerRecord({ checkId, questionIndex: answers.length, question, selection: picked, grade: graded }).toJSON();
  };

  const advance = () => {
    if (!question || !hasAnswer || answerLock.current || disabled) return;
    answerLock.current = true;
    const all = [...answers, answerRecord()];
    if (all.length === quiz.questions.length) finish(all);
    else { setAnswers(all); setPicked(null); setSelection([]); }
  };
  useEffect(() => { answerLock.current = false; }, [answers.length]);

  const begin = () => {
    if (disabled) return;
    setQuestionLanguage(language);
    logFunnelStep(FUNNEL.DIAGNOSTIC_STARTED, { via: 'course_brief', questionCount: quiz.questions.length });
    logFunnelStep(FUNNEL.READINESS_CHECK_STARTED, tagFunnel({
      via: 'course_brief', questionCount: quiz.questions.length, ...questionFormatCounts(quiz.questions),
    }));
    setPhase('check');
  };
  const build = () => {
    if (disabled || starting) return;
    setStarting(true);
    onStart?.({ diagnostic: adaptedPlan.scores, answers,
      rankedTopics: adaptedPlan.rows.map(row => ({ topic: row.topic })),
      focusTopics: adaptedPlan.rows.filter(row => row.tier === 'gap' || row.tier === 'shaky').slice(0, 2).map(row => row.topic),
    });
  };

  const dateLabel = examDate ? new Date(`${String(examDate).slice(0, 10)}T00:00:00`).toLocaleDateString(language.startsWith('fr') ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric' }) : null;
  const resultTitle = answers.length ? adaptedPlan.changed ? 'changedTitle' : 'resultTitle' : 'skippedTitle';

  if (streamlined && (phase === 'date' || (isResult && answers.length === 0))) {
    const chooseDateAndBuild = (date) => {
      if (disabled || buildLock.current) return;
      buildLock.current = true;
      setStarting(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = date ? Math.max(0, Math.round((new Date(`${date}T00:00:00`) - today) / 86400000)) : null;
      const plan = calibrationPlan(report, answers, days);
      onStart?.({ examDate: date, diagnostic: plan.scores, answers,
        rankedTopics: plan.rows.map(row => ({ topic: row.topic })),
        focusTopics: plan.rows.filter(row => row.tier === 'gap' || row.tier === 'shaky').slice(0, 2).map(row => row.topic),
      });
    };
    return <CourseExamWelcome language={language} disabled={disabled || starting} animateGreeting={false}
      question={t('courseStudio.examDateQuestion')}
      greeting={t(answers.length ? 'courseStudio.checkRecommendation' : 'courseStudio.materialsRecommendation', { topic: lead?.topic || t('courseStudio.empty') })}
      onChoose={chooseDateAndBuild} />;
  }

  if (streamlined && isResult && answers.length > 0) {
    return <section className="cs-shell cs-brief is-result" aria-busy={starting}>
      <div className="cs-body">
        <h3 ref={heading} tabIndex={-1} className="cs-title">{t('courseStudio.findingsTitle')}</h3>
        <QuickCheckFindings answers={answers} lead={lead} funnelId={funnelId}>
        <div className="cs-primary-action cs-findings-action">
          <button type="button" className="course-context__cta cs-button" disabled={disabled || starting}
            onClick={() => setPhase('date')}>{t('courseStudio.findingsContinue')}<span aria-hidden="true">→</span></button>
          <p className="cs-findings-action__hint">{t('courseStudio.findingsContinueHint')}</p>
        </div>
        </QuickCheckFindings>
      </div>
    </section>;
  }

  const sourceQuiz = phase === 'check' && Boolean(initialQuiz);
  return <section className={`cs-shell cs-brief is-${phase}${sourceQuiz ? ' cs-source-quiz' : ''}`} aria-busy={starting}>
    {!streamlined && <CourseStudioHeader context={report.context} stage={isResult ? 2 : 1} />}
    <div className="cs-body">
      <div className="cs-section-heading">
        <h3 ref={heading} tabIndex={-1} className="cs-title">{t(`courseStudio.${streamlined ? 'checkHeading' : isResult ? resultTitle : phase === 'check' ? initialQuiz ? 'transformTitle' : 'checkTitle' : 'briefTitle'}`)}</h3>
        {phase === 'check' && !initialQuiz && !streamlined && <p className="cs-sub">{t('courseStudio.checkSub')}</p>}
        {/* Set the expectation before the first hard question, so a low score
            reads as information rather than failure. Opening on a graded test
            used to cost 22 points of first-node completion. */}
        {phase === 'check' && answers.length === 0 && !hasAnswer && <p className="cs-sub cs-readiness-framing">{t('courseStudio.readinessFraming')}</p>}
      </div>

      {phase === 'check' ? <div className="cs-assessment">
        {quiz.state === 'ready' && question ? <div className={`cs-question${sourceQuiz ? ' cs-document-card is-ready' : ''}${answers.length === 0 ? ' is-first-question' : ''}`} key={answers.length}>
          {sourceQuiz && question.source && <CourseSourcePassage source={question.source} compact />}
          <div className="cs-question-meta"><span>{question.topic}</span><span className="cs-question-meta__end">
            {formatLabelKey(question) && <span className={`cs-format-chip is-${question.format}`}>{t(formatLabelKey(question))}</span>}
            <span>{t('courseStudio.questionCount', { current: answers.length + 1, total: quiz.questions.length })}</span>
          </span></div>
          <div className="cs-question-progress" aria-hidden="true">{quiz.questions.map((_, index) => <span key={index} className={index < answers.length ? 'is-done' : index === answers.length ? 'is-current' : ''} />)}</div>
          {!sourceQuiz && question.source && <CourseSourcePassage source={question.source} compact />}
          {question.format === 'casestudy' && question.scenario && <div className="cs-scenario">
            <span className="cs-kicker">{t('courseStudio.scenarioLabel')}</span>
            <p>{question.scenario}</p>
          </div>}
          <h4 id={questionId} ref={questionHeading} tabIndex={-1}>{question.question}</h4>
          <p className="cs-answer-hint">{t(isSata ? 'courseStudio.answerHintSata' : 'courseStudio.answerHint')}</p>
          <div className="cs-options" role="group" aria-labelledby={questionId}>
            {question.options.map((option, index) => {
              const chosen = isSata
                ? (hasAnswer ? Array.isArray(picked) && picked.includes(index) : selection.includes(index))
                : picked === index;
              const key = hasAnswer && isKeyOption(question, index);
              return <button key={index} type="button" disabled={hasAnswer || disabled}
                aria-pressed={chosen}
                aria-label={key ? t('courseStudio.answer', { answer: option }) : undefined}
                className={`study-quiz-option cs-option${isSata ? ' cs-option--multi' : ''}${hasAnswer || disabled ? ' disabled' : ''}${chosen ? ' selected' : ''}${key ? ' correct' : ''}${hasAnswer && chosen && !key ? ' incorrect' : ''}`}
                onClick={() => {
                  if (picked !== null) return;
                  if (isSata) setSelection(prev => (prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]));
                  else setPicked(index);
                }}>
                <span className="study-quiz-option-letter">{String.fromCharCode(65 + index)}</span><span className="study-quiz-option-text">{option}</span>
                {key && <CheckIcon size={18} />}
              </button>;
            })}
            {!hasAnswer && isSata && <button type="button" className="course-context__cta cs-button cs-check-answer"
              disabled={disabled || selection.length === 0}
              onClick={() => setPicked([...selection].sort((a, b) => a - b))}>{t('courseStudio.checkAnswer')}</button>}
            {!hasAnswer && <button type="button" className="study-quiz-idk-btn cs-unsure" disabled={disabled} onClick={() => setPicked('unsure')}><span aria-hidden="true">?</span>{t('courseStudio.unsure')}</button>}
          </div>
          {hasAnswer && <div className="cs-answer-review">
            <div className="cs-feedback" role="status">
              <div className="cs-feedback-heading">
                <span>{t(isSata ? 'courseStudio.correctAnswers' : 'courseStudio.correctAnswer')}</span>
                {grade.correct && <span className="cs-feedback-correct"><CheckIcon size={13} />{t('courseStudio.correct')}</span>}
              </div>
              {answerKey(question).map(index => <div key={index} className="cs-feedback-answer"><span>{String.fromCharCode(65 + index)}</span><strong>{question.options[index]}</strong></div>)}
              {grade.partial && <p className="cs-feedback-partial">{t('courseStudio.partialSata')}</p>}
              {question.rationale && <p>{question.rationale}</p>}
            </div>
            <div className="cs-review-action"><button type="button" className="course-context__cta cs-button" disabled={disabled} onClick={advance}>{t(answers.length + 1 === quiz.questions.length ? 'courseStudio.seeResult' : 'courseStudio.next')}<span aria-hidden="true">→</span></button></div>
          </div>}
          {!streamlined && sourceQuiz && answers.length === 0 && question.source?.excerpt && <div className="cs-document-reveal-source" aria-hidden="true"><p>{question.source.excerpt}</p></div>}
        </div> : quiz.state === 'loading' ? <div className="cs-quiz-skeleton" aria-busy="true">
          <div aria-hidden="true">
            <div className="cs-quiz-skeleton__meta">
              <span className="cs-quiz-skeleton__fill" /><span className="cs-quiz-skeleton__fill" />
            </div>
            <div className="cs-quiz-skeleton__prompt">
              <span className="cs-quiz-skeleton__fill" /><span className="cs-quiz-skeleton__fill" />
            </div>
            <div className="cs-options">
              {[0, 1, 2, 3].map(index => <div className="cs-quiz-skeleton__option" key={index}>
                <span className="cs-quiz-skeleton__fill cs-quiz-skeleton__letter" />
                <span className="cs-quiz-skeleton__fill cs-quiz-skeleton__answer" style={{ width: `${[72, 57, 65, 48][index]}%` }} />
              </div>)}
            </div>
          </div>
          <p className="cs-quiz-skeleton__status" role="status">{t('courseStudio.quizLoading')}</p>
        </div> : <div className="cs-quiz-wait" role="status">
          <h4>{t('courseStudio.quizUnavailable')}</h4>
        </div>}
        <button type="button" className="cs-text-button cs-assessment-skip" disabled={disabled} onClick={() => {
          // Preserve an answer already revealed even if the student skips before Next.
          const all = question && hasAnswer ? [...answers, answerRecord()] : answers;
          finish(all);
        }}>{t('courseStudio.skipRemaining')}</button>
      </div> : <>
        {isResult && answers.length > 0 && <QuickCheckFindings answers={answers} lead={lead} funnelId={funnelId} />}
        <div className={`cs-brief-grid${!isResult ? ' is-compact' : ''}`}>
          <div className="cs-focus-story">
            <span className="cs-kicker">{t('courseStudio.first')}</span>
            <h4>{lead?.topic || t('courseStudio.empty')}</h4>
            {isResult && answers.length > 0 ? <p>{lead?.revisit.length
              ? t('courseStudio.focusReason', { concepts: lead.revisit.slice(0, 2).join(' · ') })
              : t(lead?.tested ? 'courseStudio.sampleReason' : 'courseStudio.untestedReason')}</p>
              : null}
            {!isResult && currentPlan.rows.length > 1 && <p className="cs-up-next">{t('courseStudio.nextUp')}: {currentPlan.rows.slice(1, 3).map(row => row.topic).join(' · ')}</p>}
          </div>
          {isResult && <StudyOrder rows={currentPlan.rows} initialRows={initialPlan.rows} adapted={answers.length > 0} t={t} />}
        </div>
        {isResult ? <>
          {adaptedPlan.trimmed > 0 && <p className="cs-sample-note">{t('courseStudio.trimmed', { count: adaptedPlan.trimmed })}</p>}
          <div className="cs-date-inline"><button type="button" className="course-context__date-chip cs-date-button" disabled={disabled || starting} ref={dateAnchor} onClick={() => setShowDate(v => !v)} aria-haspopup="dialog" aria-expanded={showDate}>
            {dateLabel ? t('courseStudio.dateLabel', { date: dateLabel }) : t('courseStudio.addDate')}<span aria-hidden="true">↗</span>
          </button>
            {showDate && <DatePicker value={examDate ? String(examDate).slice(0, 10) : ''} onChange={value => { onExamDate?.(value); setShowDate(false); }} minDate={new Date()} onClose={() => setShowDate(false)} anchorRef={dateAnchor} language={language} />}
          </div>
        </> : null}
        <div className="cs-primary-action">
          <button type="button" className="course-context__cta cs-button" disabled={disabled || starting} onClick={isResult ? build : begin}>
            {t(isResult ? 'courseStudio.build' : 'courseStudio.startCheck')}<span aria-hidden="true">→</span>
          </button>
          {!isResult && <>
            <span className="cs-footer-note">{t(quiz.state === 'ready' ? 'courseStudio.questionsReady' : 'courseStudio.questionsPreparing', { count: quiz.questions.length })}</span>
            <button type="button" className="cs-text-button" disabled={disabled} onClick={() => finish([])}>{t('courseStudio.skipCheck')}</button>
          </>}
        </div>
        <CourseSourceTabs report={report} filenames={filenames} />
      </>}
    </div>
  </section>;
};

const StudyOrder = ({ rows, initialRows, adapted, t }) => {
  const [displayRows, setDisplayRows] = useState(adapted ? initialRows : rows);
  const listRef = useRef(null);
  const previous = useRef(new Map());
  useLayoutEffect(() => {
    const next = new Map();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    for (const node of listRef.current?.children || []) {
      const top = node.offsetTop;
      const before = previous.current.get(node.dataset.topic);
      if (!reduced && before !== undefined && before !== top && node.animate) {
        node.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
      next.set(node.dataset.topic, top);
    }
    previous.current = next;
  }, [displayRows]);
  // Mount in the course order, measure it, then animate the actual adjustment.
  // There is no timed reveal and no delay before the next action is usable.
  useLayoutEffect(() => { setDisplayRows(rows); }, [rows]);
  return <div className={`cs-route${adapted ? ' is-adapted' : ''}`}>
    <div className="cs-route-heading"><span className="cs-kicker">{t(adapted ? 'courseStudio.adaptedOrder' : 'courseStudio.initialOrder')}</span><span className="cs-route-mark" aria-hidden="true">↗</span></div>
    <ol ref={listRef} className="cs-route-list">{displayRows.slice(0, adapted ? 5 : 3).map((row, index) => <li key={row.topic} data-topic={row.topic} className={`cs-route-row${index === 0 ? ' is-first' : ''}`}>
      <span className="cs-route-number">{String(index + 1).padStart(2, '0')}</span>
      <div><strong>{row.topic}</strong><span className="cs-route-detail">{adapted
        ? row.tested ? t(row.correct === row.tested ? 'courseStudio.sampled' : 'courseStudio.focus') : t('courseStudio.untested')
        : t(index === 0 ? 'courseStudio.first' : 'courseStudio.nextUp')}</span>
        {adapted && row.tested > 0 && <span className="cs-route-evidence">{t('courseStudio.checkedCount', { correct: row.correct, total: row.tested })}</span>}
      </div>
      {adapted && row.previousRank > row.rank && <span className="cs-moved" title={t('courseStudio.moved', { rank: row.previousRank })}>↑ {row.previousRank - row.rank}</span>}
    </li>)}</ol>
  </div>;
};

export default CourseStudyBrief;
