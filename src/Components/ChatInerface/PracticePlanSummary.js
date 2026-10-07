import React from 'react';
import { useTranslation } from 'react-i18next';
import './PracticePlanSummary.css';

export default function PracticePlanSummary({ plan }) {
  const { t } = useTranslation();
  if (!plan || !plan.coverage || !Number.isInteger(plan.total)) return null;
  return <details className="practice-plan">
    <summary>{t('practicePlan.title', { defaultValue: 'Your {{count}}-question test plan', count: plan.total })}</summary>
    {plan.summary && <p>{plan.summary}</p>}
    <ul>{Object.entries(plan.coverage).map(([topic, count]) => <li key={topic}><span>{topic}</span><span>{count}</span></li>)}</ul>
    {Array.isArray(plan.uncertainties) && plan.uncertainties.length > 0 && <p className="practice-plan-note">{plan.uncertainties.join(' ')}</p>}
  </details>;
}
