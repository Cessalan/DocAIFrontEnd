import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon } from './PlanOnboardingIcons';
import DatePicker from '../Common/DatePicker';
import UploadInsightsCard from './UploadInsightsCard';
import FirstLessonPane from './FirstLessonPane';
import CourseContextForm from '../CourseIntelligence/CourseContextForm';
import { CourseUploadWelcome } from '../CourseIntelligence/CourseExamWelcome';
import CourseIntelligenceTimeline from '../CourseIntelligence/CourseIntelligenceTimeline';
import CourseStudyBrief from '../CourseIntelligence/CourseStudyBrief';
import {
  initialTimeline,
  reduceTimeline,
  normalizeReport,
  leadTopics,
  plannerTopics,
} from '../CourseIntelligence/courseIntelligenceModel';
import { calibrationQuestions } from '../CourseIntelligence/courseCalibrationModel';
import { run_course_intelligence } from '../../Services/CourseIntelligenceService';
import { rankUploadTopics } from './uploadPriority';
import { EXAM_DATE_CHOICES, resolveExamDate } from '../../Services/examDateChoices';
import { FUNNEL, logFunnelStep, logFunnelStepOnce, enrichFunnel } from '../../Services/FunnelService';
import { devLog } from '../../Services/devLogger';
import './PlanOnboarding.css';

/**
 * Owns upload readiness and the intelligence request. The course brief handles
 * the diagnostic and its animated result in one surface, then hands measured
 * scores beside the untouched report to the existing plan launcher.
 *
 * Research failure retains the insights -> lesson/check -> date fallback.
 * A skipped diagnostic leaves scores null; course priority then sets the order.
 * Plan generation and quota enforcement remain in StartStudyModal.
 */

const EXAM_OPTIONS = EXAM_DATE_CHOICES;

// How many ranked topics become `hardestTopics` for the plan generator. Two,
// matching the cap the old question imposed — the planner's focus archetype
// leads on these, and leading on four is not leading.
const AUTO_FOCUS_TOPICS = 2;

const PlanOnboarding = ({
  topics = [],
  insights = [],
  filenames = [],
  fileCount = 0,
  language = 'en',
  chatId,
  userOnboarding = {},
  disabled = false,
  autoInvestigate = false,
  // False while the upload stream is still running. The intelligence run is
  // held until this flips, because the backend reads her file insights from
  // the session and a run fired early would investigate an empty upload.
  materialsReady = true,
  uploadFailed = false,
  // Persisted context from an earlier visit to this card, so a reload does
  // not ask her the same four questions again.
  savedCourseContext = null,
  onCourseContext,
  onConfirm
}) => {
  const { t } = useTranslation();

  // ── State ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState(() => {
    return autoInvestigate || savedCourseContext ? 'intelligence' : 'context';
  });
  const [examKey, setExamKey] = useState(null);
  const [customDate, setCustomDate] = useState('');
  const [quickCheckResult, setQuickCheckResult] = useState(null);
  const dateAnchorRef = useRef(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Course intelligence ──────────────────────────────────────────────
  const [courseContext, setCourseContext] = useState(savedCourseContext || null);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [report, setReport] = useState(null);
  const [previewReport, setPreviewReport] = useState(null);
  const [seedQuiz, setSeedQuiz] = useState(null);
  const [intelligenceFailed, setIntelligenceFailed] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const runRef = useRef(null);
  const startedRef = useRef(false);
  // The backend's own payload, kept beside the normalized one. /study/start
  // reads `study_strategy.ordered_topics` and `priority_topics` in their
  // original shape, and normalizeReport deliberately renames things for the
  // UI — handing the renamed version back would silently produce an unordered
  // plan, which is the failure this whole feature exists to prevent.
  const rawReportRef = useRef(null);

  // Dates belong to this course. A profile date may refer to another exam;
  // only an explicit choice saved in this course's context is reused here.
  // The fallback date chips pass their choice directly to confirm().
  const resolvedExam = useMemo(() => {
    const iso = courseContext?.examDate || null;
    if (!iso) return { iso: null, daysAway: null };
    const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return { iso: null, daysAway: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysAway = Math.round((date.getTime() - today.getTime()) / 86400000);
    return { iso: date.toISOString(), daysAway };
  }, [courseContext]);

  // The topic the fallback lesson is built on, and the topics the plan leads
  // with when there is no report. Ranked here as well as inside
  // UploadInsightsCard so the lesson opens on the SAME topic the card just
  // promised — recomputing from the same inputs is cheap and pure, and
  // threading it through as state would let the two drift.
  const ranked = useMemo(
    () => rankUploadTopics({ topics, insights, max: 6 }),
    [topics, insights]
  );
  const leadTopic = ranked.top?.topic || topics[0] || null;

  // Replaces the question we removed. The report's order wins when we have
  // one, because it read her exam description; the upload ranking is the
  // fallback and reads only coverage.
  const autoHardestTopics = useMemo(() => {
    const fromReport = leadTopics(report, AUTO_FOCUS_TOPICS);
    if (fromReport.length > 0) return fromReport;
    return ranked.topics.slice(0, AUTO_FOCUS_TOPICS).map(r => r.topic).filter(Boolean);
  }, [report, ranked]);

  // Legacy fallback lesson results. The intelligence path receives its measured
  // diagnostic directly from CourseStudyBrief at confirmation.
  const diagnostic = useMemo(() => {
    const scores = {};
    if (quickCheckResult?.topic && quickCheckResult.percent !== null && quickCheckResult.percent !== undefined) {
      scores[quickCheckResult.topic] = quickCheckResult.percent;
    }
    return Object.keys(scores).length > 0 ? scores : null;
  }, [quickCheckResult]);

  useEffect(() => {
    if (phase === 'examdate') logFunnelStepOnce(FUNNEL.EXAM_DATE_STARTED);
  }, [phase]);

  // ── The intelligence run ─────────────────────────────────────────────
  //
  // Fires once, and only once her materials are actually in. The guard is a
  // ref rather than state because a re-render between the two conditions
  // would otherwise start a second stream — three web searches, billed
  // twice, for one upload.
  useEffect(() => {
    if (phase !== 'intelligence') return undefined;
    if (!materialsReady || startedRef.current || !chatId) return undefined;

    startedRef.current = true;
    let cancelled = false;
    let revealTimer;
    logFunnelStep(FUNNEL.INTELLIGENCE_STARTED, {
      hasSchool: Boolean(courseContext?.school),
      hasCourse: Boolean(courseContext?.courseCode || courseContext?.courseName),
      hasProfessor: Boolean(courseContext?.professor),
      hasExamDescription: Boolean(courseContext?.examDescription),
    });

    const run = run_course_intelligence({
      chatId,
      materialsOnly: autoInvestigate,
      courseContext: courseContext || {},
      language,
      onEvent: (event) => {
        if (cancelled) return;
        setTimeline(prev => reduceTimeline(prev, event));
        if (event.status === 'course_question_ready') {
          const preview = normalizeReport(event.report);
          const questions = preview ? calibrationQuestions(event, plannerTopics(preview)) : [];
          if (questions.length >= 2) {
            setPreviewReport(preview);
            setSeedQuiz({ questions });
            // A student can start before optional research finishes.
            if (!rawReportRef.current) rawReportRef.current = event.report;
          }
        }
      },
    });
    runRef.current = run;

    run.promise
      .then((raw) => {
        if (cancelled) return;
        const normalized = normalizeReport(raw) || normalizeReport(rawReportRef.current);
        if (!normalized) {
          devLog('🔎 Course intelligence returned nothing usable — falling back');
          setIntelligenceFailed(true);
          setPhase(autoInvestigate ? 'retry' : 'insights');
          logFunnelStep(FUNNEL.INTELLIGENCE_FAILED, { reason: 'empty_report' });
          return;
        }
        rawReportRef.current = raw || rawReportRef.current;
        setReport(normalized);
        logFunnelStep(FUNNEL.INTELLIGENCE_COMPLETED, {
          researchRan: normalized.researchRan,
          priorityCount: normalized.priorityTopics.length,
          elapsedMs: normalized.elapsedMs,
        });
        // A short beat so the last checkmark is visibly a checkmark before
        // the card swaps. Without it the timeline's final state is never seen.
        revealTimer = setTimeout(() => { if (!cancelled) setPhase('report'); }, 220);
      })
      .catch((error) => {
        if (cancelled) return;
        setTimeline(prev => ({ ...prev, failed: true }));
        if (rawReportRef.current) {
          setReport(normalizeReport(rawReportRef.current));
          setPhase('report');
          return;
        }
        console.error('❌ Course intelligence failed:', error);
        logFunnelStep(FUNNEL.INTELLIGENCE_FAILED, { reason: error?.message || 'stream_error' });
        // Not a dead end. She drops into the flow this card had before the
        // investigation existed, and still gets a plan.
        setIntelligenceFailed(true);
        setPhase(autoInvestigate ? 'retry' : 'insights');
      });

    return () => {
      cancelled = true;
      clearTimeout(revealTimer);
      run.abort();
      // A StrictMode setup/cleanup cycle must leave the next setup runnable.
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, materialsReady, chatId, retryAttempt]);

  // The upload itself died. There is nothing to investigate and nothing to
  // teach from, so go straight to the exam date and let the planner work from
  // whatever it can reach.
  useEffect(() => {
    if (uploadFailed && (phase === 'welcome' || phase === 'context' || phase === 'intelligence')) {
      setIntelligenceFailed(true);
      setPhase('examdate');
    }
  }, [uploadFailed, phase]);

  // ── Phase transitions ────────────────────────────────────────────────

  const handleContextSubmit = useCallback((context) => {
    setCourseContext(context);
    onCourseContext && onCourseContext(context);
    setPhase('intelligence');
  }, [onCourseContext]);

  const handleInsightsContinue = () => {
    // No lead topic means the upload produced nothing to teach from. Skip
    // straight to the exam date rather than opening an empty lesson.
    setPhase(leadTopic ? 'lesson' : 'examdate');
  };

  const handleLessonDone = (result) => {
    setQuickCheckResult(result || null);
    setPhase('examdate');
  };

  /**
   * Hand off to the plan.
   *
   * Everything the planner needs is assembled here in one place: the exam
   * date, the focus topics, the diagnostic (null when the check is skipped),
   * and the report itself, which the backend turns into a topic order and a
   * prompt brief.
   */
  const confirm = useCallback((examIso, examDaysAway, examChoiceKey, calibration = null) => {
    const prefs = {
      ...userOnboarding,
      examDate: examIso ?? null,
      examDaysAway: examDaysAway ?? null,
      examChoiceKey: examChoiceKey ?? null,
      hardestTopics: calibration ? calibration.focusTopics : autoHardestTopics,
      focusSource: calibration?.diagnostic ? 'diagnostic' : report ? 'course' : 'self_report',
    };

    if (!calibration) logFunnelStep(FUNNEL.DIAGNOSTIC_COMPLETED, {
      derived: true,
      scoredTopics: diagnostic ? Object.keys(diagnostic).length : 0,
      viaIntelligence: Boolean(report),
      fellBack: intelligenceFailed,
    });

    onConfirm && onConfirm({
      userPreferences: prefs,
      diagnostic: calibration ? calibration.diagnostic : diagnostic,
      rankedTopics: calibration ? calibration.rankedTopics : ranked.topics,
      quickCheckResult,
      courseContext: calibration?.courseContext || courseContext,
      // The raw-shaped report the backend expects back on /study/start. It is
      // carried rather than re-fetched: the run cost three web searches and
      // an LLM pass, and re-deriving it would spend them twice.
      courseIntelligence: rawReportRef.current,
      courseIntelligenceReport: report,
    });
  }, [
    userOnboarding, autoHardestTopics, diagnostic, ranked,
    quickCheckResult, courseContext, report, intelligenceFailed, onConfirm,
  ]);

  const handleBriefStart = useCallback((calibration) => {
    if (calibration && Object.prototype.hasOwnProperty.call(calibration, 'examDate')) {
      const next = { ...(courseContext || {}), examDate: calibration.examDate, examDatePromptAnswered: true };
      const chosen = calibration.examDate ? resolveExamDate('custom', calibration.examDate) : null;
      setCourseContext(next);
      onCourseContext?.(next);
      confirm(chosen?.iso ?? null, chosen?.daysAway ?? null, chosen ? 'custom' : null, { ...calibration, courseContext: next });
      setPhase('report');
      return;
    }
    confirm(resolvedExam.iso, resolvedExam.daysAway, courseContext?.examDate ? 'custom' : null, calibration);
    setPhase('report');
  }, [confirm, resolvedExam, courseContext, onCourseContext]);

  const handleBriefDate = useCallback((examDate) => {
    const next = { ...(courseContext || {}), examDate };
    setCourseContext(next);
    onCourseContext?.(next);
  }, [courseContext, onCourseContext]);

  /**
   * The fallback exam-date screen.
   *
   * The date is resolved from the tapped `key` rather than from state, because
   * `setExamKey` has not flushed yet when this runs — reading the derived state
   * here would build preferences from the PREVIOUS selection (null on the
   * first tap).
   *
   * resolveExamDate is the shared helper the drill also uses; duplicating the
   * offset arithmetic locally is exactly how two surfaces end up disagreeing
   * about how many days are left.
   */
  const advanceFromDate = useCallback((key, customDateStr = null) => {
    const info = resolveExamDate(key, customDateStr);

    logFunnelStep(FUNNEL.EXAM_DATE_COMPLETED, {
      examChoiceKey: key,
      daysAway: info?.daysAway ?? null,
    });
    enrichFunnel({ examChoiceKey: key, examDaysAway: info?.daysAway ?? null });

    // 220ms beat lets the chip animate to its selected state before handing off.
    setTimeout(() => {
      confirm(info?.iso ?? null, info?.daysAway ?? null, key);
    }, 220);
  }, [confirm]);

  const handleExamChip = (key) => {
    if (disabled) return;
    setExamKey(key);
    setCustomDate('');
    advanceFromDate(key);
  };

  const handleCustomDate = (value) => {
    if (!value) return;
    setCustomDate(value);
    setExamKey('custom');
    setShowDatePicker(false);
    advanceFromDate('custom', value);
  };

  const toggleDatePicker = () => {
    if (disabled) return;
    setShowDatePicker(s => !s);
  };

  // Friendly label for a chosen date so the chip doesn't show YYYY-MM-DD.
  const customDateLabel = useMemo(() => {
    if (!customDate) return null;
    const d = new Date(`${customDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const locale = (language || 'en').toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [customDate, language]);

  // Skipping the research mid-run keeps whatever the timeline already
  // reported and moves on. The stream is aborted so we stop paying for
  // searches she has said she does not want to wait for.
  const handleSkipResearch = useCallback(() => {
    if (runRef.current) runRef.current.abort();
    setIntelligenceFailed(true);
    setPhase(leadTopic ? 'insights' : 'examdate');
  }, [leadTopic]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="plan-onboarding" data-phase={phase}>
      {phase === 'context' && (
        <CourseContextForm
          language={language}
          fileCount={fileCount}
          uploading={!materialsReady}
          filenames={filenames}
          disabled={disabled}
          initialValues={courseContext || {}}
          onSubmit={context => handleContextSubmit({ ...courseContext, ...context })}
          onSkip={context => handleContextSubmit({ ...courseContext, ...context })}
        />
      )}

      {(phase === 'intelligence' || phase === 'retry') && !seedQuiz && (autoInvestigate ?
        <CourseUploadWelcome materialsReady={materialsReady} failed={phase === 'retry'} onRetry={() => {
          setTimeline(initialTimeline()); setIntelligenceFailed(false); setRetryAttempt(attempt => attempt + 1); setPhase('intelligence');
        }} /> :
        <CourseIntelligenceTimeline
          timeline={timeline}
          context={courseContext || {}}
          filenames={filenames}
          materialsReady={materialsReady}
          failed={phase === 'retry'}
          onRetry={() => {
            setTimeline(initialTimeline());
            setIntelligenceFailed(false);
            setRetryAttempt(attempt => attempt + 1);
            setPhase('intelligence');
          }}
          onAddContext={autoInvestigate && !materialsReady ? () => setPhase('context') : undefined}
          onSkip={handleSkipResearch}
        />
      )}

      {(phase === 'report' || (phase === 'intelligence' && seedQuiz)) && (
        <CourseStudyBrief
          timeline={timeline}
          report={report || previewReport}
          initialQuiz={seedQuiz}
          initialPhase={autoInvestigate || seedQuiz ? 'check' : 'brief'}
          streamlined={autoInvestigate}
          chatId={chatId}
          filenames={filenames}
          daysToExam={resolvedExam.daysAway}
          examDate={resolvedExam.iso}
          language={language}
          disabled={disabled}
          onExamDate={handleBriefDate}
          onStart={handleBriefStart}
        />
      )}

      {phase === 'insights' && (
        <UploadInsightsCard
          topics={topics}
          insights={insights}
          fileCount={fileCount || (filenames || []).length || 0}
          disabled={disabled}
          onContinue={handleInsightsContinue}
        />
      )}

      {phase === 'lesson' && (
        <FirstLessonPane
          chatId={chatId}
          topic={leadTopic}
          contextTags={ranked.top?.keyPoints?.slice(0, 3) || []}
          language={language}
          onDone={handleLessonDone}
        />
      )}

      {phase === 'examdate' && (
        <section className="plan-onboarding__pane" aria-labelledby="po-q1-title">
          <header className="plan-onboarding__header">
            <h3 className="plan-onboarding__question" id="po-q1-title">
              {t('planOnboarding.q1.title')}
            </h3>
            {/* She has just been shown something, so this is an offer to fit
                it to her calendar — not an explanation of why we need data. */}
            <p className="plan-onboarding__sub">
              {report
                ? t('planOnboarding.q1.subtitleAfterReport', 'One last thing, and I can size the plan exactly.')
                : t('planOnboarding.q1.subtitleAfterValue')}
            </p>
          </header>

          <div className="plan-onboarding__chips" role="radiogroup" aria-labelledby="po-q1-title">
            {EXAM_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={examKey === opt.key}
                className={`plan-onboarding__chip ${examKey === opt.key ? 'is-selected' : ''}`}
                onClick={() => handleExamChip(opt.key)}
                disabled={disabled}
              >
                {t(`planOnboarding.q1.options.${opt.key}`)}
              </button>
            ))}

            <button
              ref={dateAnchorRef}
              type="button"
              className={`plan-onboarding__chip plan-onboarding__chip--date ${examKey === 'custom' ? 'is-selected' : ''}`}
              onClick={toggleDatePicker}
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={showDatePicker}
              aria-label={t('planOnboarding.q1.pickDate')}
            >
              <span className="plan-onboarding__chip-icon" aria-hidden="true">
                <CalendarIcon width="15" height="15" />
              </span>
              <span>{customDateLabel || t('planOnboarding.q1.pickDate')}</span>
            </button>
            {showDatePicker && (
              <DatePicker
                value={customDate}
                onChange={handleCustomDate}
                minDate={new Date()}
                onClose={() => setShowDatePicker(false)}
                anchorRef={dateAnchorRef}
                language={language}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default PlanOnboarding;
