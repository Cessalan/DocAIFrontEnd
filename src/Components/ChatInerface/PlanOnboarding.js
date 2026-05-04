import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  start_study_journey,
  clear_in_flight_study_journey
} from '../../Services/FastAPICalls';
import {
  NotStartedIcon,
  JustStartedIcon,
  MakingProgressIcon,
  CrammingIcon,
  CalendarIcon,
  TargetIcon,
  BooksIcon,
  SparkleIcon
} from './PlanOnboardingIcons';
import PlanDatePicker from './PlanDatePicker';
import './PlanOnboarding.css';

/**
 * PlanOnboarding — 3-question gate before the study plan generates.
 *
 * Flow: hook -> q1 (exam date) -> q2 (hardest topics) -> q3 (prep status) -> confirm
 *
 * On Q3 selection we pre-fire `start_study_journey` so the plan generates in the
 * background while the user reviews the confirmation summary. By the time they
 * tap "Build my plan", the in-flight cache holds a (usually resolved) promise
 * that StartStudyModal picks up on autoStart.
 *
 * Edit-answers and Skip both clear the in-flight cache so a stale promise
 * doesn't haunt a later attempt.
 *
 * Gating (parent's responsibility): only render this for first-upload exam-prep
 * users. Non-exam users get the existing PostUploadActions/wow-card path.
 */

// Q1 choices map to a relative day count off "today". The day numbers below
// are friendly approximations — the exam-date prompt only needs to capture
// urgency tier, not a precise calendar day. Users who care can hit "Pick a date".
const EXAM_OPTIONS = [
  { key: 'today',           daysAway: 0 },
  { key: 'tomorrow',        daysAway: 1 },
  { key: 'this_week',       daysAway: 5 },
  { key: 'next_week',       daysAway: 10 },
  { key: 'two_plus_weeks',  daysAway: 21 }
];

const PREP_OPTIONS = [
  { key: 'not_started',     Icon: NotStartedIcon },
  { key: 'just_started',    Icon: JustStartedIcon },
  { key: 'making_progress', Icon: MakingProgressIcon },
  { key: 'cramming',        Icon: CrammingIcon }
];

const PlanOnboarding = ({
  topics = [],
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
  const [phase, setPhase] = useState('hook');
  const [examKey, setExamKey] = useState(null);
  const [customDate, setCustomDate] = useState('');
  const [hardestTopics, setHardestTopics] = useState([]);
  const [prepStatus, setPrepStatus] = useState(null);
  const planHandleRef = useRef(null);
  const dateAnchorRef = useRef(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Set in handleConfirm so the unmount cleanup below knows we're handing the
  // in-flight plan off to StartStudyModal rather than abandoning it. Without
  // this guard, swapping the chat message type on confirm unmounts us, the
  // cleanup nukes the cached promise, and StartStudyModal refires /study/start.
  const confirmedRef = useRef(false);

  // ── Cleanup on unmount ───────────────────────────────────────────────
  // If the user navigates away mid-onboarding (e.g. switches chats),
  // throw away the in-flight plan so it doesn't surface later with stale prefs.
  // Skip the clear when the user confirmed — the modal needs the cache.
  useEffect(() => {
    return () => {
      if (planHandleRef.current && chatId && !confirmedRef.current) {
        clear_in_flight_study_journey(chatId);
      }
    };
  }, [chatId]);

  // ── Derived: exam date ───────────────────────────────────────────────
  const examDateInfo = useMemo(() => {
    if (!examKey) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (examKey === 'custom') {
      if (!customDate) return null;
      const date = new Date(`${customDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) return null;
      const days = Math.max(0, Math.round((date - today) / 86400000));
      return { iso: date.toISOString(), daysAway: days, label: customDate };
    }

    const opt = EXAM_OPTIONS.find(o => o.key === examKey);
    if (!opt) return null;
    const date = new Date(today);
    date.setDate(date.getDate() + opt.daysAway);
    return { iso: date.toISOString(), daysAway: opt.daysAway, label: null };
  }, [examKey, customDate]);

  // Build the userPreferences payload merged with the user's original onboarding.
  // The plan generator doesn't read these new fields today (out-of-scope per the
  // task brief), but they get plumbed through so a later prompt enhancement
  // can pick them up without another schema migration.
  const buildUserPreferences = useCallback((overrides = {}) => ({
    ...userOnboarding,
    examDate:        examDateInfo?.iso ?? null,
    examDaysAway:    examDateInfo?.daysAway ?? null,
    examChoiceKey:   examKey,
    hardestTopics,
    prepStatus,
    ...overrides
  }), [userOnboarding, examDateInfo, examKey, hardestTopics, prepStatus]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleStart = () => setPhase('q1');

  const handleExamChip = (key) => {
    setExamKey(key);
    setCustomDate('');
    // 220ms beat lets the chip animate to its selected state before advancing
    setTimeout(() => setPhase(p => (p === 'q1' ? 'q2' : p)), 220);
  };

  const handleCustomDate = (value) => {
    setCustomDate(value);
    if (value) {
      setExamKey('custom');
      setShowDatePicker(false);
      setTimeout(() => setPhase(p => (p === 'q1' ? 'q2' : p)), 220);
    }
  };

  const toggleDatePicker = () => {
    if (disabled) return;
    setShowDatePicker(s => !s);
  };

  // Pre-compute a friendly label for the chosen date so the chip doesn't show
  // the raw YYYY-MM-DD string. Falls back to the i18n "Pick a date" copy.
  const customDateLabel = useMemo(() => {
    if (!customDate) return null;
    const d = new Date(`${customDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const locale = (language || 'en').toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [customDate, language]);

  const handleTopicToggle = (topic) => {
    setHardestTopics(prev => {
      if (prev.includes(topic)) return prev.filter(x => x !== topic);
      // Cap at 2 — selecting a 3rd swaps out the oldest (FIFO)
      if (prev.length >= 2) return [...prev.slice(1), topic];
      return [...prev, topic];
    });
  };

  const handleQ2Continue = () => {
    // When no topics were extracted from the upload, there's nothing to pick;
    // let the user advance without a selection rather than trapping them.
    if (topics.length > 0 && hardestTopics.length === 0) return;
    setPhase('q3');
  };

  const firePlanInBackground = useCallback((finalPrepStatus) => {
    if (!chatId) return;
    try {
      // Eagerly evict any prior cached promise so we get a fresh fire with
      // the latest prefs (relevant if the user came back via Edit Answers).
      clear_in_flight_study_journey(chatId);
      const prefs = buildUserPreferences({ prepStatus: finalPrepStatus });
      planHandleRef.current = start_study_journey(chatId, [], prefs, language);
    } catch (e) {
      // Non-fatal: StartStudyModal will refire on click if the cache is empty
      console.warn('PlanOnboarding: background plan fire failed', e);
    }
  }, [chatId, language, buildUserPreferences]);

  const handlePrepSelect = (key) => {
    setPrepStatus(key);
    firePlanInBackground(key);
    setTimeout(() => setPhase(p => (p === 'q3' ? 'confirm' : p)), 250);
  };

  const handleEditAnswers = () => {
    if (chatId) clear_in_flight_study_journey(chatId);
    planHandleRef.current = null;
    setPhase('q1');
  };

  const handleConfirm = () => {
    if (disabled) return;
    // hardestTopics may be empty when no topics were extracted from the upload —
    // that's allowed (matches handleQ2Continue's empty-topics escape hatch).
    if (!examKey || !prepStatus) return;
    if (topics.length > 0 && hardestTopics.length === 0) return;
    confirmedRef.current = true;
    onConfirm && onConfirm({
      userPreferences: buildUserPreferences()
    });
  };

  const handleBack = () => {
    setPhase(p => {
      if (p === 'q2') return 'q1';
      if (p === 'q3') return 'q2';
      if (p === 'confirm') return 'q3';
      return p;
    });
  };

  // ── Copy helpers ─────────────────────────────────────────────────────
  // Headline that tries "I read your N pages" if we have a real page count,
  // otherwise falls back to a file-count phrasing.
  const hookHeadline = useMemo(() => {
    const safeTopics = (topics || []).slice(0, 3).filter(Boolean);
    const topicsList = safeTopics.length
      ? formatTopicsList(safeTopics, language)
      : t('planOnboarding.hookFallbackTopic');
    return t('planOnboarding.hookHeadline', {
      count: fileCount || (filenames || []).length || 0,
      topics: topicsList,
      defaultValue: ''
    });
  }, [topics, fileCount, filenames, language, t]);

  // i18next CLDR plurals for EN/FR only cover `_one` (count=1) and `_other`
  // (count=2+). count=0 falls through to `_other` and reads as "0 days from
  // today", which is wrong. We special-case it with explicit *Today keys.
  const dayHelper = useMemo(() => {
    if (!examDateInfo) return '';
    if (examDateInfo.daysAway === 0) return t('planOnboarding.daysHelperToday');
    return t('planOnboarding.daysHelper', {
      count: examDateInfo.daysAway,
      defaultValue: ''
    });
  }, [examDateInfo, t]);

  const formattedExamLabel = useMemo(() => {
    if (!examDateInfo) return '';
    if (examDateInfo.daysAway === 0) return t('planOnboarding.examToday');
    return t('planOnboarding.examInDays', {
      count: examDateInfo.daysAway,
      defaultValue: ''
    });
  }, [examDateInfo, t]);

  const prepStatusLabel = prepStatus
    ? t(`planOnboarding.prepOptions.${prepStatus}`)
    : '';

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="plan-onboarding" data-phase={phase}>
      {phase !== 'hook' && (
        <div className="plan-onboarding__progress" aria-hidden="true">
          <span className={`plan-onboarding__dot ${phase !== 'hook' ? 'is-filled' : ''}`} />
          <span className={`plan-onboarding__dot ${['q2','q3','confirm'].includes(phase) ? 'is-filled' : ''}`} />
          <span className={`plan-onboarding__dot ${['q3','confirm'].includes(phase) ? 'is-filled' : ''}`} />
        </div>
      )}

      {phase === 'hook' && (
        <section className="plan-onboarding__pane plan-onboarding__pane--hook" aria-labelledby="po-hook-title">
          <p className="plan-onboarding__eyebrow">{t('planOnboarding.eyebrow')}</p>
          <h2 className="plan-onboarding__title" id="po-hook-title">{hookHeadline}</h2>
          <p className="plan-onboarding__subtitle">{t('planOnboarding.hookSubtitle')}</p>

          <div className="plan-onboarding__cta-row">
            <button
              type="button"
              className="plan-onboarding__primary"
              onClick={handleStart}
              disabled={disabled}
            >
              <span>{t('planOnboarding.start')}</span>
              <span className="plan-onboarding__arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      )}

      {phase === 'q1' && (
        <section className="plan-onboarding__pane" aria-labelledby="po-q1-title">
          <header className="plan-onboarding__header">
            <h3 className="plan-onboarding__question" id="po-q1-title">
              {t('planOnboarding.q1.title')}
            </h3>
            <p className="plan-onboarding__sub">{t('planOnboarding.q1.subtitle')}</p>
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

          <p className="plan-onboarding__helper" aria-live="polite">{dayHelper}</p>
        </section>
      )}

      {phase === 'q2' && (
        <section className="plan-onboarding__pane" aria-labelledby="po-q2-title">
          <header className="plan-onboarding__header">
            <button
              type="button"
              className="plan-onboarding__back"
              onClick={handleBack}
              disabled={disabled}
              aria-label={t('planOnboarding.back')}
            >
              ← {t('planOnboarding.back')}
            </button>
            <h3 className="plan-onboarding__question" id="po-q2-title">
              {t('planOnboarding.q2.title')}
            </h3>
            <p className="plan-onboarding__sub">{t('planOnboarding.q2.subtitle')}</p>
          </header>

          <div className="plan-onboarding__topics" role="group" aria-labelledby="po-q2-title">
            {(topics && topics.length > 0)
              ? topics.map(topic => (
                  <button
                    key={topic}
                    type="button"
                    aria-pressed={hardestTopics.includes(topic)}
                    className={`plan-onboarding__topic ${hardestTopics.includes(topic) ? 'is-selected' : ''}`}
                    onClick={() => handleTopicToggle(topic)}
                    disabled={disabled}
                  >
                    {topic}
                  </button>
                ))
              : <p className="plan-onboarding__empty">{t('planOnboarding.q2.noTopics')}</p>
            }
          </div>

          <div className="plan-onboarding__counter" aria-live="polite">
            {t('planOnboarding.q2.counter', { count: hardestTopics.length })}
          </div>

          <div className="plan-onboarding__footer">
            <button
              type="button"
              className="plan-onboarding__primary"
              onClick={handleQ2Continue}
              disabled={disabled || (topics.length > 0 && hardestTopics.length === 0)}
            >
              <span>{t('planOnboarding.continue')}</span>
              <span className="plan-onboarding__arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      )}

      {phase === 'q3' && (
        <section className="plan-onboarding__pane" aria-labelledby="po-q3-title">
          <header className="plan-onboarding__header">
            <button
              type="button"
              className="plan-onboarding__back"
              onClick={handleBack}
              disabled={disabled}
              aria-label={t('planOnboarding.back')}
            >
              ← {t('planOnboarding.back')}
            </button>
            <h3 className="plan-onboarding__question" id="po-q3-title">
              {t('planOnboarding.q3.title')}
            </h3>
          </header>

          <div className="plan-onboarding__prep" role="radiogroup" aria-labelledby="po-q3-title">
            {PREP_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={prepStatus === opt.key}
                className={`plan-onboarding__prep-card ${prepStatus === opt.key ? 'is-selected' : ''}`}
                onClick={() => handlePrepSelect(opt.key)}
                disabled={disabled}
              >
                <span className="plan-onboarding__prep-icon" aria-hidden="true">
                  <opt.Icon width="22" height="22" />
                </span>
                <span className="plan-onboarding__prep-label">
                  {t(`planOnboarding.prepOptions.${opt.key}`)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === 'confirm' && (
        <section className="plan-onboarding__pane plan-onboarding__pane--confirm" aria-labelledby="po-confirm-title">
          <header className="plan-onboarding__header">
            <h3 className="plan-onboarding__question" id="po-confirm-title">
              {t('planOnboarding.confirm.title')}
            </h3>
          </header>

          <ul className="plan-onboarding__summary" aria-label={t('planOnboarding.confirm.summaryAria')}>
            <li className="plan-onboarding__summary-row">
              <span className="plan-onboarding__summary-icon" aria-hidden="true">
                <CalendarIcon width="20" height="20" />
              </span>
              <span className="plan-onboarding__summary-text">{formattedExamLabel}</span>
            </li>
            <li className="plan-onboarding__summary-row">
              <span className="plan-onboarding__summary-icon" aria-hidden="true">
                <TargetIcon width="20" height="20" />
              </span>
              <span className="plan-onboarding__summary-text">
                {t('planOnboarding.confirm.focusPrefix')} {hardestTopics.join(t('planOnboarding.confirm.topicJoiner'))}
              </span>
            </li>
            <li className="plan-onboarding__summary-row">
              <span className="plan-onboarding__summary-icon" aria-hidden="true">
                <BooksIcon width="20" height="20" />
              </span>
              <span className="plan-onboarding__summary-text">{prepStatusLabel}</span>
            </li>
          </ul>

          <div className="plan-onboarding__cta-row">
            <button
              type="button"
              className="plan-onboarding__primary plan-onboarding__primary--confirm"
              onClick={handleConfirm}
              disabled={disabled}
            >
              <span>{t('planOnboarding.confirm.cta')}</span>
              <span className="plan-onboarding__sparkle" aria-hidden="true">
                <SparkleIcon width="18" height="18" />
              </span>
            </button>
            <button
              type="button"
              className="plan-onboarding__edit"
              onClick={handleEditAnswers}
              disabled={disabled}
            >
              ← {t('planOnboarding.confirm.edit')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

// Format a topic list naturally for the headline. Keeps the sentence-level
// difference between EN ("A, B, and C") and FR ("A, B et C") in one place
// rather than splattering it across i18n strings.
function formatTopicsList(items, lang) {
  const isFrench = (lang || 'en').toLowerCase().startsWith('fr');
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return isFrench ? `${items[0]} et ${items[1]}` : `${items[0]} and ${items[1]}`;
  const head = items.slice(0, -1).join(', ');
  const tail = items[items.length - 1];
  return isFrench ? `${head} et ${tail}` : `${head}, and ${tail}`;
}

export default PlanOnboarding;
