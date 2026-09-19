import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildPlanPreview } from './planPreviewModel';
import { buildVerdict, describeVerdictFinding } from './readinessVerdict';
import { FUNNEL, logFunnelStep, logFunnelStepOnce } from '../../Services/FunnelService';
import './LockedPlanPreview.css';

/**
 * LockedPlanPreview — what her check found, and the fix, before she is asked
 * to pay.
 *
 * THE CHANGE THIS IS
 *
 * The plan gate used to fire before generation, so a student at 3/3 plans
 * saw an upgrade modal saying she had used her three plans. Five of the ten
 * paying subscribers converted at exactly that moment, which made it the
 * most productive paywall in the product — and it was still selling the
 * wrong thing. "You have run out of plans" names our accounting.
 *
 * The first fix (2026-09-05) showed the plan instead: topics, a score each, a
 * session count and "Unlock my study plan". It still did not sell: "Needs
 * work · you scored 33%" is a number, not a finding, and "7 sessions · about
 * 21 min" behind a padlock reads as paying to see 21 minutes of content.
 *
 * Since 2026-09-16 it leads with the VERDICT, free and in full: two to four
 * weak spots from her readiness check, each with its evidence and a plain
 * severity label (readinessVerdict). Then the fix, named after those same
 * findings and sized to her exam. Nothing else: the owner's rule for this
 * screen is that it already does the job, so it must not grow.
 *
 * WHY IT IS DERIVED, NOT GENERATED
 *
 * We cannot generate a real plan for someone the server will refuse to
 * generate one for. Everything here comes from planPreviewModel, which mirrors
 * the planner's own shaping arithmetic, and from answers already on the
 * client. See planPreviewModel for the cross-repo contract.
 *
 * WHAT IT MUST NOT DO
 *
 * Show anything she will not get, or claim more than her answers show. The
 * minutes are the plan's TOTAL — never "per session" — and thin evidence is
 * labelled an early signal.
 */

/* ── CTA test ──────────────────────────────────────────────────────────────
   "Fix my weak spots" names the outcome; "Build my plan" is plainer and may
   read as less of a sales line. Assigned once per browser and logged on the
   verdict view and the click, so /admin/paywall can compare them. */
export const CTA_VARIANTS = ['fix', 'build'];
const CTA_STORAGE_KEY = 'nqVerdictCta';

const storedCtaVariant = () => {
  try {
    const saved = window.localStorage.getItem(CTA_STORAGE_KEY);
    if (CTA_VARIANTS.includes(saved)) return saved;
    const pick = CTA_VARIANTS[Math.floor(Math.random() * CTA_VARIANTS.length)];
    window.localStorage.setItem(CTA_STORAGE_KEY, pick);
    return pick;
  } catch {
    return CTA_VARIANTS[0];
  }
};

// "Coronary Artery Disease (CAD)" → "CAD": the name she will recognise in a
// sentence. Anything without a short bracketed form is used as written.
const shortTopic = (topic) => {
  const match = /\(([A-Za-z0-9&/+\- ]{2,12})\)\s*$/.exec(topic || '');
  return match ? match[1].trim() : topic;
};

const LockedPlanPreview = ({
  topics = [],
  diagnostic = null,
  daysToExam = null,
  // { answers, funnelId } from the readiness check, or null.
  readiness = null,
  // Forces a CTA variant (tests, previews); otherwise assigned per browser.
  ctaVariant: forcedVariant = null,
  onUnlock,
  onClose,
}) => {
  const { t } = useTranslation();

  const preview = buildPlanPreview({ topics, diagnostic, daysToExam });
  const verdict = useMemo(() => buildVerdict(readiness?.answers), [readiness]);
  const findings = verdict?.findings || [];
  const hasDate = daysToExam !== null && daysToExam !== undefined;
  const [storedVariant] = useState(() => (forcedVariant ? null : storedCtaVariant()));
  const ctaVariant = CTA_VARIANTS.includes(forcedVariant) ? forcedVariant : storedVariant;

  useEffect(() => {
    logFunnelStepOnce(FUNNEL.PLAN_PREVIEW_VIEWED, {
      locked: true,
      sessionCount: preview.sessionCount,
      archetype: preview.archetype,
      topicCount: preview.rows.length,
      daysToExam,
      withVerdict: Boolean(verdict),
    });
  }, [preview.sessionCount, preview.archetype, preview.rows.length, daysToExam, verdict]);

  // The strategy's north-star event: she has seen, with evidence, where she
  // stands. Tagged with the upload's funnel so it counts after a reload too.
  useEffect(() => {
    if (!verdict) return;
    logFunnelStepOnce(FUNNEL.WEAKNESS_INSIGHT_VIEWED, {
      via: 'locked_preview',
      answered: verdict.answered,
      findingCount: verdict.findings.length,
      findingKeys: verdict.findings.map(f => f.key).join(','),
      ctaVariant,
      ...(readiness?.funnelId ? { funnelId: readiness.funnelId } : {}),
    });
  }, [verdict, readiness, ctaVariant]);

  const lead = findings[0] || null;

  const handleUnlock = () => {
    logFunnelStep(FUNNEL.PAYWALL_CTA_CLICKED, {
      from: 'plan_preview',
      sessionCount: preview.sessionCount,
      withVerdict: Boolean(verdict),
      findingCount: findings.length,
      ...(verdict ? { ctaVariant } : {}),
    });
    onUnlock && onUnlock(lead?.key === 'topic' ? lead.topic : null);
  };

  // "Your plan starts with SATA + prioritization, then rechecks CAD until it
  // improves." Built from the findings on screen, in their order. One topic
  // when skills lead, up to two when topics are all there is.
  const fixCopy = () => {
    const skills = [...new Set(findings.filter(f => f.key !== 'topic')
      .map(f => t(`lockedPlan.verdict.short.${f.key}`)))].slice(0, 2);
    const topicNames = findings.filter(f => f.key === 'topic').map(f => shortTopic(f.topic));
    if (skills.length && topicNames.length) {
      return t('lockedPlan.verdict.fixBoth', { skills: skills.join(' + '), topics: topicNames[0], count: 1 });
    }
    if (skills.length) return t('lockedPlan.verdict.fixSkills', { skills: skills.join(' + ') });
    const named = topicNames.slice(0, 2);
    return t('lockedPlan.verdict.fixTopics', { topics: named.join(' + '), count: named.length });
  };

  // Said out loud rather than hidden: a sprint plan genuinely cannot cover
  // everything, and a student who later notices a missing topic should have
  // been told here, not discover it mid-plan.
  const trimmedNote = preview.trimmed > 0 && (
    <p className="locked-plan__trimmed">
      {t('lockedPlan.trimmed', { count: preview.trimmed })}
    </p>
  );

  if (verdict) {
    const clean = findings.length === 0;
    const title = clean
      ? t('lockedPlan.verdict.titleClean')
      : !hasDate
        ? t('lockedPlan.verdict.titleNoDate')
        : daysToExam === 0
          ? t('lockedPlan.verdict.titleToday')
          : daysToExam === 1
            ? t('lockedPlan.verdict.titleTomorrow')
            : t('lockedPlan.verdict.titleDays', { days: daysToExam });

    return (
      <div className="locked-plan">
        <div className="locked-plan__head">
          <p className="locked-plan__eyebrow">{t('lockedPlan.verdict.eyebrow')}</p>
          <h2 className="locked-plan__title">{title}</h2>
          <p className="locked-plan__basis">
            {verdict.allEarly
              ? t('lockedPlan.verdict.basedOnEarly', { count: verdict.answered })
              : t('lockedPlan.verdict.basedOn', { count: verdict.answered })}
          </p>
        </div>

        {!clean && (
          <ul className="locked-plan__findings">
            {findings.map((f, i) => {
              const d = describeVerdictFinding(f, t);
              return (
                <li key={`${f.key}-${f.topic || i}`} className="locked-plan__finding">
                  <span className="locked-plan__finding-body">
                    <span className="locked-plan__finding-title">{d.title}</span>
                    <span className="locked-plan__finding-evidence">{d.evidence}</span>
                  </span>
                  {/* An all-early verdict says so once, in the header. */}
                  {!verdict.allEarly && (
                    <span className={`locked-plan__severity is-${f.severity}`}>
                      {t(`lockedPlan.verdict.severity.${f.severity}`)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {clean && verdict.strength && (
          <p className="locked-plan__strength">
            {t('lockedPlan.verdict.strength', {
              topic: verdict.strength.topic, correct: verdict.strength.correct, total: verdict.strength.total,
            })}
          </p>
        )}

        <div className="locked-plan__fix">
          <p className="locked-plan__fix-label">{t('lockedPlan.verdict.fixLabel')}</p>
          <p className="locked-plan__fix-copy">
            {clean ? t('lockedPlan.verdict.fixCopyClean') : fixCopy()}
          </p>
          <p className="locked-plan__fix-meta">
            <strong>{t('lockedPlan.totalSessions', { count: preview.sessionCount })}</strong>
            {' '}{t('lockedPlan.totalMinutes', { count: preview.estimatedMinutes })}
            {hasDate && <> {t('lockedPlan.verdict.builtForExam')}</>}
          </p>
          {trimmedNote}
        </div>

        <div className="locked-plan__gate locked-plan__gate--verdict">
          <button type="button" className="locked-plan__cta" onClick={handleUnlock}>
            {clean
              ? t('lockedPlan.verdict.ctaClean')
              : t(ctaVariant === 'build' ? 'lockedPlan.verdict.ctaBuild' : 'lockedPlan.verdict.ctaFix')}
          </button>
          <button type="button" className="locked-plan__later" onClick={onClose}>
            {t('lockedPlan.later', 'Not now')}
          </button>
        </div>
      </div>
    );
  }

  // ── No check answers: the plan itself is the best evidence we have ──────
  const headline = !hasDate
    ? t('lockedPlan.titleNoDate', 'Your study plan is ready')
    : daysToExam === 0
      ? t('lockedPlan.titleToday', 'Your exam is today — your plan is ready')
      : daysToExam === 1
        ? t('lockedPlan.titleTomorrow', 'Your exam is tomorrow — your plan is ready')
        : t('lockedPlan.titleDays', '{{days}} days until your exam', { days: daysToExam });

  const TIER_LABEL = {
    gap: t('lockedPlan.tiers.gap', 'Needs work'),
    shaky: t('lockedPlan.tiers.shaky', 'Review'),
    untested: t('lockedPlan.tiers.untested', 'To cover'),
    solid: t('lockedPlan.tiers.solid', 'Quick refresh'),
  };

  return (
    <div className="locked-plan">
      <div className="locked-plan__head">
        <p className="locked-plan__eyebrow">{t('lockedPlan.eyebrow', 'Your plan')}</p>
        <h2 className="locked-plan__title">{headline}</h2>
      </div>

      <ul className="locked-plan__rows">
        {preview.rows.map((row, i) => (
          <li key={`${row.topic}-${i}`} className={`locked-plan__row is-${row.tier}`}>
            <span className="locked-plan__row-main">
              <span className="locked-plan__topic">{row.topic}</span>
              <span className="locked-plan__tier">
                {TIER_LABEL[row.tier]}
                {row.percent !== null && row.percent !== undefined && (
                  <span className="locked-plan__score">
                    {t('lockedPlan.scored', '· you scored {{percent}}%', { percent: Math.round(row.percent) })}
                  </span>
                )}
              </span>
            </span>
            <span className="locked-plan__count">
              {t('lockedPlan.sessionCount', { count: row.nodeCount })}
            </span>
          </li>
        ))}
      </ul>

      <div className="locked-plan__summary">
        <strong>{t('lockedPlan.totalSessions', { count: preview.sessionCount })}</strong>
        <span>{t('lockedPlan.totalMinutes', { count: preview.estimatedMinutes })}</span>
      </div>

      {trimmedNote}

      <div className="locked-plan__gate">
        <p className="locked-plan__gate-copy">{t('lockedPlan.gateCopy')}</p>
        <button type="button" className="locked-plan__cta" onClick={handleUnlock}>
          {t('lockedPlan.cta')}
        </button>
        <button type="button" className="locked-plan__later" onClick={onClose}>
          {t('lockedPlan.later', 'Not now')}
        </button>
      </div>
    </div>
  );
};

export default LockedPlanPreview;
