import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { recommendedStart, revealStats, CONFIDENCE } from './courseIntelligenceModel';
import { SparkIcon, ExamIcon, DocumentsIcon, ConnectIcon, StrategyIcon } from './CourseIntelligenceIcons';
import { FUNNEL, logFunnelStepOnce } from '../../Services/FunnelService';
import './PlanReveal.css';

/**
 * PlanReveal — the last screen before the plan generates.
 *
 * WHAT IT IS FOR
 * ──────────────
 * The report proved we looked. This closes the loop: it says what the plan
 * will do with what we found, names the first topic, and gives the reason.
 * Then it gets out of the way.
 *
 * WHY THE NUMBERS ARE SAFE TO SHOW HERE
 * ─────────────────────────────────────
 * "12 topics · 4h 30m" is a promise made before the plan exists, and this
 * product has already been bitten by exactly that: the locked preview once
 * quoted a session count derived independently of the generator, and a
 * mismatch means quoting fourteen sessions and delivering eight. So the count
 * comes from revealStats → buildPlanPreview, which mirrors the backend's
 * budget arithmetic and is covered by planPreviewModel's tests. Do not
 * compute a second number here, however small.
 *
 * WHERE THE PAYWALL IS
 * ────────────────────
 * Not here. This screen is free, and deliberately so — it sits in front of
 * StartStudyModal, which is where the plan quota is checked after her real
 * plan is on screen. Putting a gate on this card would move the wall back in
 * front of the value, undoing the change of 2026-09-05.
 */

const REASON_ICONS = {
  exam: ExamIcon,
  emphasis: DocumentsIcon,
  unlocks: ConnectIcon,
  clinical: StrategyIcon,
};

const PlanReveal = ({
  report,
  daysToExam = null,
  examDate = null,
  language = 'en',
  disabled = false,
  onStart,
  onBack,
}) => {
  const { t } = useTranslation();

  const stats = useMemo(
    () => revealStats({ report, daysToExam }),
    [report, daysToExam]
  );
  const start = useMemo(() => recommendedStart(report), [report]);

  useEffect(() => {
    logFunnelStepOnce(FUNNEL.REVEAL_VIEWED, {
      topicCount: stats.topicCount,
      sessionCount: stats.sessionCount,
      archetype: stats.archetype,
      startTopic: start ? start.topic : null,
    });
  }, [stats, start]);

  const examLabel = useMemo(() => {
    if (!examDate) return null;
    const d = new Date(`${String(examDate).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const locale = (language || 'en').toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
    return d.toLocaleDateString(locale, { month: 'long', day: 'numeric' });
  }, [examDate, language]);

  const duration = useMemo(() => {
    const mins = stats.estimatedMinutes || 0;
    if (mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return t('courseIntel.reveal.minutes', { count: m, defaultValue: '{{count}} min' });
    if (m === 0) return t('courseIntel.reveal.hours', { count: h, defaultValue: '{{count}}h' });
    return `${h}h ${m}m`;
  }, [stats.estimatedMinutes, t]);

  // What the plan will prioritise. Each line is claimed only when the report
  // actually supports it — a plan with no exam description does not get to
  // say it is built around an exam.
  const priorities = useMemo(() => {
    const out = [];
    if (report && report.exam) out.push('exam');
    if (report && report.materials.topicCount > 0) out.push('materials');
    if (report && report.strategy.connections.length > 0) out.push('connections');
    out.push('clinical');
    out.push('highvalue');
    return out.slice(0, 5);
  }, [report]);

  return (
    <section className="ci-reveal">
      <header className="ci-reveal__header">
        <span className="ci-reveal__eyebrow">
          <SparkIcon size={14} />
          {t('courseIntel.reveal.eyebrow', 'Ready')}
        </span>
        <h3 className="ci-reveal__title">
          {t('courseIntel.reveal.title', 'I know enough to build your plan.')}
        </h3>
        <p className="ci-reveal__sub">
          {report && report.researchRan
            ? t(
              'courseIntel.reveal.subResearched',
              'I read your materials, your course information, your exam description, and the public academic context I could verify.'
            )
            : t(
              'courseIntel.reveal.subMaterials',
              'I read your materials and your exam description, and built the order around them.'
            )}
        </p>
      </header>

      <ul className="ci-reveal__priorities">
        {priorities.map(key => (
          <li key={key} className="ci-reveal__priority">
            {t(`courseIntel.reveal.priority.${key}`)}
          </li>
        ))}
      </ul>

      <div className="ci-reveal__stats">
        <div className="ci-reveal__stat">
          <span className="ci-reveal__stat-value">{stats.topicCount}</span>
          <span className="ci-reveal__stat-label">
            {t('courseIntel.reveal.statTopics', { count: stats.topicCount, defaultValue: 'topics' })}
          </span>
        </div>
        {duration && (
          <div className="ci-reveal__stat">
            <span className="ci-reveal__stat-value">{duration}</span>
            <span className="ci-reveal__stat-label">
              {t('courseIntel.reveal.statTime', 'estimated study time')}
            </span>
          </div>
        )}
        {examLabel && (
          <div className="ci-reveal__stat">
            <span className="ci-reveal__stat-value">{examLabel}</span>
            <span className="ci-reveal__stat-label">
              {t('courseIntel.reveal.statExam', 'exam')}
            </span>
          </div>
        )}
      </div>

      {/* Sessions are trimmed to fit a near exam. Saying which topics were
          deferred, and why, is the difference between a shorter plan and a
          worse one. */}
      {stats.trimmed > 0 && (
        <p className="ci-reveal__trimmed">
          {t('courseIntel.reveal.trimmed', {
            count: stats.trimmed,
            defaultValue: '{{count}} lower-priority topics deferred to fit your exam date.',
          })}
        </p>
      )}

      {start && (
        <div className="ci-reveal__start">
          <p className="ci-reveal__start-eyebrow">
            {t('courseIntel.reveal.startEyebrow', 'Recommended starting point')}
          </p>
          <h4 className="ci-reveal__start-topic">{start.topic}</h4>
          <p className="ci-reveal__start-why">
            {t('courseIntel.reveal.startWhy', 'Why start here?')}
          </p>
          <ul className="ci-reveal__reasons">
            {start.reasons.map((reason) => {
              const Icon = REASON_ICONS[reason.key] || SparkIcon;
              return (
                <li
                  key={reason.key}
                  className={`ci-reveal__reason is-${reason.confidence || CONFIDENCE.INFERENCE}`}
                >
                  <Icon size={14} />
                  <span>{t(`courseIntel.reveal.reason.${reason.key}`)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="ci-reveal__actions">
        <button
          type="button"
          className="ci-reveal__cta"
          onClick={onStart}
          disabled={disabled}
        >
          <span>
            {start
              ? t('courseIntel.reveal.ctaTopic', { topic: start.topic, defaultValue: 'Start with {{topic}}' })
              : t('courseIntel.reveal.cta', 'Build my study plan')}
          </span>
          <span className="ci-reveal__arrow" aria-hidden="true">→</span>
        </button>
        {onBack && (
          <button
            type="button"
            className="ci-reveal__back"
            onClick={onBack}
            disabled={disabled}
          >
            {t('courseIntel.reveal.back', 'See the findings again')}
          </button>
        )}
      </div>
    </section>
  );
};

export default PlanReveal;
