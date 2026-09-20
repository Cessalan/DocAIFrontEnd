import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { buildVerdict, describeVerdictFinding } from '../StudyMode/readinessVerdict';
import { FUNNEL, logFunnelStep } from '../../Services/FunnelService';

// Findings are free for every tier. This surface neither checks nor changes
// entitlement; the existing plan and question gates still own continuation.
export default function QuickCheckFindings({ answers, lead, funnelId, children }) {
  const { t } = useTranslation();
  const verdict = useMemo(() => buildVerdict(answers), [answers]);
  const logged = useRef(false);
  useEffect(() => {
    if (!verdict || logged.current) return;
    logged.current = true;
    logFunnelStep(FUNNEL.WEAKNESS_INSIGHT_VIEWED, {
      via: 'quick_check', answered: verdict.answered,
      findingCount: verdict.findings.length,
      findingKeys: verdict.findings.map(f => f.key).join(','),
      ...(funnelId ? { funnelId } : {}),
    });
  }, [verdict, funnelId]);
  if (!verdict) return null;

  const correct = answers.filter(a => a.correct);
  const missed = answers.filter(a => !a.correct);
  const strengths = [...new Set(correct.map(a => a.concept || a.topic))].slice(0, 3);
  const review = [...new Set(missed.map(a => a.concept || a.question || a.topic))].slice(0, 3);
  const partialSata = answers.filter(a => a.format === 'sata' && a.partial && !a.correct).length;
  const main = verdict.findings[0];
  const takeaway = partialSata > 0
    ? { title: t('courseStudio.takeawayPartial'), evidence: t('courseStudio.takeawayPartialBody', { count: partialSata }) }
    : main ? describeVerdictFinding(main, t)
      : { title: t(missed.length ? 'courseStudio.takeawayReview' : 'courseStudio.findingsClean'),
          evidence: t(missed.length ? 'courseStudio.findingsMissed' : 'courseStudio.findingsCleanBody', { concepts: review.join(' · ') }) };
  const renderFinding = (finding, index) => {
    const description = describeVerdictFinding(finding, t);
    return <li key={finding.key + '-' + (finding.topic || index)}>
      <span className="cs-findings-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div><strong>{description.title}</strong><span>{description.evidence}</span>
        {finding.confidence === 'early' && <small>{t('lockedPlan.verdict.severity.early')}</small>}
      </div>
    </li>;
  };
  return <div className="cs-findings">
    <section className="cs-findings-takeaway">
      <span className="cs-findings-kicker">{t('courseStudio.takeawayLabel')}</span>
      <h4>{takeaway.title}</h4>
    </section>
    {strengths.length > 0 && <section className="cs-findings-strength">
      <span className="cs-findings-check" aria-hidden="true">✓</span>
      <div><h4>{t('courseStudio.findingsStrength')}</h4><p>{strengths.join(' · ')}</p></div>
    </section>}
    {verdict.findings.length > 0 && <section className="cs-findings-section">
      <h4 className="cs-findings-kicker">{t('courseStudio.findingsReview')}</h4>
      <ul className="cs-findings-list">{verdict.findings.slice(0, 2).map(renderFinding)}</ul>
      {verdict.findings.length > 2 && <details className="cs-findings-more">
        <summary>{t('courseStudio.findingsMore', { count: verdict.findings.length - 2 })}</summary>
        <ul className="cs-findings-list">{verdict.findings.slice(2).map((finding, index) => renderFinding(finding, index + 2))}</ul>
      </details>}
    </section>}
    <section className="cs-findings-next">
      <span className="cs-findings-next-icon" aria-hidden="true">↗</span>
      <div><h4>{t('courseStudio.findingsNext')}</h4>
        <strong>{lead?.topic || t('courseStudio.empty')}</strong>
        <p>{lead?.revisit?.length
          ? t('courseStudio.focusReason', { concepts: lead.revisit.slice(0, 2).join(' · ') })
          : t(lead?.tested ? 'courseStudio.sampleReason' : 'courseStudio.untestedReason')}</p>
      </div>
    </section>
    {children}
    <div className="cs-findings-footnote">
      <p>{t('courseStudio.findingsBasis', { correct: verdict.correct, total: verdict.answered })}</p>
      <p>{t('courseStudio.sampleFoot')}</p>
    </div>
  </div>;
}
