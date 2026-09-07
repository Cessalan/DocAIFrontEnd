import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon } from './PlanOnboardingIcons';
import PlanDatePicker from './PlanDatePicker';
import UploadInsightsCard from './UploadInsightsCard';
import FirstLessonPane from './FirstLessonPane';
import { rankUploadTopics } from './uploadPriority';
import { EXAM_DATE_CHOICES, resolveExamDate } from '../../Services/examDateChoices';
import { FUNNEL, logFunnelStep, logFunnelStepOnce, enrichFunnel } from '../../Services/FunnelService';
import './PlanOnboarding.css';

/**
 * PlanOnboarding — the post-upload coach flow.
 *
 * WHAT CHANGED, AND WHY
 * ─────────────────────
 * This used to be three questions between the upload and any generated
 * content: exam date, hardest topics, prep status, then a diagnostic, then a
 * plan. Measured across 3,208 uploads, 26.6% of students answered the first
 * question. The other 73% were asked to configure a tutor before it had done
 * anything for them.
 *
 * The order is now inverted, and the sequence is deliberately SHORT:
 *
 *     insights → first lesson → quick check → exam date → plan
 *
 * Everything that costs her something sits behind something that gave her
 * something, and nothing sits in between that does neither.
 *
 * WHAT WAS REMOVED, AND WHY EACH ONE
 * ──────────────────────────────────
 * The first version of this reordering kept every old ask and added the new
 * value screens on top, which made a 5-screen flow into a 9-screen one. A
 * longer path to the same paywall converts worse no matter how good the
 * screens are, so three steps came back out:
 *
 *   PREP STATUS ("where are you in your prep?") — was written into
 *   userPreferences and read by nothing, in either repo. The diagnostic
 *   measures the same thing by observation instead of self-report.
 *
 *   HARDEST TOPICS ("anything you'd add?") — the weakest of the three signals
 *   and the only one that asked the student to do the product's job. We now
 *   take `hardestTopics` from the upload ranking instead (see uploadPriority),
 *   which reads the coverage in her own document rather than asking her to
 *   guess. The plan generator still receives the field, so the focus
 *   archetype is unaffected.
 *
 *   CONFIRM ("here's what I'll build for you") — a summary of two answers she
 *   had just given, one screen earlier, with nothing destructive behind it.
 *   A confirmation step earns its place when the next action is expensive or
 *   irreversible; this one only added a click.
 *
 *   THE DIAGNOSTIC (5 more questions) — the largest cut. It asked her a second
 *   set of questions about the same uploaded material she had just been
 *   questioned on by the quick check, two screens earlier. Seven questions to
 *   reach a plan.
 *
 *   Its output was never the questions, it was a {topic: percent} map for the
 *   planner to tier on, and we can build that from evidence we already hold —
 *   see `diagnostic` below. Note the old diagnostic was 5 questions spread
 *   "breadth-first across all major topics", i.e. roughly ONE question per
 *   topic; the quick check gives two on the topic it covers. Per-topic this
 *   is not thinner evidence, it is thicker.
 *
 * WHERE THE PAYWALL WENT
 * ──────────────────────
 * It used to fire here, on the prep-status tap. A student at 3/3 plans
 * answered three questions and received nothing — the single most productive
 * paywall in the product, and also the one that sold a quota rather than an
 * outcome. This component no longer checks the plan gate at all. The check now
 * happens in StartStudyModal, AFTER her plan is on screen. See that file's
 * `handleStartFromPreview`.
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
  onConfirm
}) => {
  const { t } = useTranslation();

  // ── State ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('insights');
  const [examKey, setExamKey] = useState(null);
  const [customDate, setCustomDate] = useState('');
  const [quickCheckResult, setQuickCheckResult] = useState(null);
  const dateAnchorRef = useRef(null);
  const [showDatePicker, setShowDatePicker] = useState(false);


  // The topic the first lesson is built on, and the topics the plan leads
  // with. Ranked here as well as inside UploadInsightsCard so the lesson opens
  // on the SAME topic the card just promised — recomputing from the same
  // inputs is cheap and pure, and threading it through as state would let the
  // two drift.
  const ranked = useMemo(
    () => rankUploadTopics({ topics, insights, max: 6 }),
    [topics, insights]
  );
  const leadTopic = ranked.top?.topic || topics[0] || null;

  // Replaces the question we removed. These are the topics the card already
  // showed her under "Start here", so the plan leads where the evidence points
  // and where she was told it would.
  const autoHardestTopics = useMemo(
    () => ranked.topics.slice(0, AUTO_FOCUS_TOPICS).map(r => r.topic).filter(Boolean),
    [ranked]
  );

  /**
   * The {topic: percent} map the planner tiers on — assembled instead of asked.
   *
   * ONE source: THE QUICK CHECK. It is about this specific material, it just
   * happened, and the topic label is this upload's own, so the planner gets an
   * exact match rather than loose matching across two label sets.
   *
   * It used to be two. The second was her stored past accuracy, surfaced by
   * uploadPriority as `ranked.topics[].percent` — dropped 2026-09-06 because
   * the label matching behind it put an ARDS score on Acute Coronary Syndrome
   * (the full case is in uploadPriority's header). It tiered plans on a number
   * belonging to a different subject, which is worse than tiering on none:
   * a wrong percent moves a topic to `gap` or `solid` with confidence, where
   * absence at least lands it in the honest middle.
   *
   * Topics with no score stay ABSENT rather than being given a number. Absent
   * means `untested` to the planner (2 nodes, mid-order); a fabricated 0 would
   * mean `gap` (5 nodes, front of the plan) and would rearrange her whole plan
   * around a subject nobody ever tested her on.
   *
   * Null when we know nothing at all — the planner's documented "no diagnostic"
   * path, which produces the uniform plan.
   */
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

  // ── Phase transitions ────────────────────────────────────────────────

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
   * The exam-date tap is now the last step: it answers the question, fires the
   * diagnostic, and hands off in one action.
   *
   * The date is resolved from the tapped `key` rather than from state, because
   * `setExamKey` has not flushed yet when this runs — reading the derived state
   * here would build preferences from the PREVIOUS selection (null on the
   * first tap), which is how the pre-fired diagnostic used to be handed an
   * examDate of null.
   *
   * resolveExamDate is the shared helper the drill also uses; duplicating the
   * offset arithmetic locally is exactly how two surfaces end up disagreeing
   * about how many days are left.
   */
  const advanceFromDate = useCallback((key, customDateStr = null) => {
    const info = resolveExamDate(key, customDateStr);

    const prefs = {
      ...userOnboarding,
      examDate: info?.iso ?? null,
      examDaysAway: info?.daysAway ?? null,
      examChoiceKey: key,
      hardestTopics: autoHardestTopics,
    };

    logFunnelStep(FUNNEL.EXAM_DATE_COMPLETED, {
      examChoiceKey: key,
      daysAway: info?.daysAway ?? null,
    });
    enrichFunnel({ examChoiceKey: key, examDaysAway: info?.daysAway ?? null });

    // Nothing is pre-fired here any more. There is no second quiz to warm up,
    // and the plan itself is generated by StartStudyModal on autoStart.
    //
    // Note also what is NOT here: the plan-quota check. Blocking a student at
    // this point is what the redesign exists to stop.
    logFunnelStep(FUNNEL.DIAGNOSTIC_COMPLETED, {
      derived: true,
      scoredTopics: diagnostic ? Object.keys(diagnostic).length : 0,
    });

    // 220ms beat lets the chip animate to its selected state before handing off.
    setTimeout(() => {
      onConfirm && onConfirm({
        userPreferences: prefs,
        diagnostic,
        rankedTopics: ranked.topics,
        quickCheckResult,
      });
    }, 220);
  }, [userOnboarding, autoHardestTopics, ranked, quickCheckResult, diagnostic, onConfirm]);

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

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="plan-onboarding" data-phase={phase}>
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
            {/* She has just been taught something, so this is an offer to fit
                it to her calendar — not an explanation of why we need data. */}
            <p className="plan-onboarding__sub">{t('planOnboarding.q1.subtitleAfterValue')}</p>
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
              <PlanDatePicker
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
