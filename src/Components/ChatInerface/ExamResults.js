import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { examResults, verdict } from './examResultsModel';
import './ExamResults.css';

// One mark per answer: filled right, half partly right, hollow missed. Shape
// carries the meaning, so it reads without colour.
function Marks({ marks, t }) {
  return <span className="exam-marks" role="img" aria-label={marks.map(m => t(`examMode.mark.${m}`)).join(', ')}>
    {marks.map((mark, i) => <i key={i} className={`exam-mark is-${mark}`} aria-hidden="true" />)}
  </span>;
}

function Rows({ title, rows, t }) {
  if (!rows.length) return null;
  return <section className="exam-results-section">
    <h3>{title}</h3>
    <ul>{rows.map(row => <li key={row.name}>
      <span className="exam-row-name">{row.name}</span>
      <Marks marks={row.marks} t={t} />
      <span className="exam-row-count">{t('examMode.ofCount', { right: row.right, count: row.total })}</span>
    </li>)}</ul>
  </section>;
}

/**
 * The end of an exam taken under exam conditions (examResultsModel.js):
 * the score, where it was lost, and every miss with her answer and why.
 */
export default function ExamResults({ questions, answers, brief, onBack }) {
  const { t } = useTranslation();
  const result = useMemo(() => examResults(questions, answers, brief), [questions, answers, brief]);
  const marks = useMemo(() => (questions || []).map((q, i) => verdict((answers || {})[i] || q.userSelection)).filter(Boolean),
    [questions, answers]);

  return <section className="exam-results" aria-label={t('examMode.scoreTitle')}>
    <p className="exam-results-kicker">{t('examMode.scoreTitle')}</p>
    <h2 className="exam-results-score">{t('examMode.score', { right: result.right, count: result.answered })}</h2>
    <p className="exam-results-sub">
      {result.percent}%{result.partial > 0 && <> · {t('examMode.partial', { count: result.partial })}</>}
    </p>
    <Marks marks={marks} t={t} />

    <Rows title={t('examMode.byRequest')} rows={result.byFocus} t={t} />
    <Rows title={t('examMode.bySection')} rows={result.byChapter} t={t} />

    <section className="exam-results-section">
      <h3>{result.missed.length ? t('examMode.misses', { count: result.missed.length }) : t('examMode.noMisses')}</h3>
      {result.missed.map(miss => <details key={miss.index} className="exam-miss">
        <summary><span className={`exam-mark is-${miss.verdict}`} aria-hidden="true" />
          <span className="exam-miss-number">{miss.index + 1}.</span> <span>{miss.question}</span></summary>
        <dl>
          <dt>{t('examMode.yourAnswer')}</dt><dd>{miss.yours.length ? miss.yours.join(' · ') : t('examMode.noAnswer')}</dd>
          <dt>{t('examMode.correctAnswer')}</dt><dd>{miss.correct.join(' · ')}</dd>
          {miss.why && <><dt>{t('examMode.why')}</dt><dd>{miss.why}</dd></>}
        </dl>
      </details>)}
    </section>

    <button type="button" className="study-continue-btn exam-results-back" onClick={onBack}>{t('examMode.backToChat')}</button>
  </section>;
}
