import React from 'react';
import { useTranslation } from 'react-i18next';
import { sheetProgress, checkIsSourced } from './studySheetProgressModel';
import './StudySheetProgress.css';

// What is shown in the sheet's place until the sheet is finished: the steps
// the backend is really going through, ticked as each one ends. The model
// (studySheetProgressModel.js) decides the states; this file only names them.

function Box({ state }) {
  return (
    <span className={`ssp-box ssp-box-${state}`} aria-hidden="true">
      {state === 'done' && (
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
          <path d="M4 8.4l2.6 2.6L12 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {state === 'failed' && (
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
          <path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

function label(step, steps, t) {
  const { id, state, facts, sections } = step;
  const done = state === 'done';
  if (id === 'materials') {
    if (!done) return t('studySheetProgress.materials.active');
    if (typeof facts.files !== 'number') return t('studySheetProgress.materials.done');
    if (facts.files > 0) return t('studySheetProgress.materials.files', { count: facts.files });
    return facts.notes ? t('studySheetProgress.materials.notesOnly') : t('studySheetProgress.materials.none');
  }
  if (id === 'plan') return t(done ? 'studySheetProgress.plan.done' : 'studySheetProgress.plan.active');
  if (id === 'write') {
    return done && sections.length
      ? t('studySheetProgress.write.done', { count: sections.length })
      : t('studySheetProgress.write.active');
  }
  const sourced = checkIsSourced(steps);
  if (sourced === null) return t('studySheetProgress.check.generic');
  return t(sourced ? 'studySheetProgress.check.sourced' : 'studySheetProgress.check.unsourced');
}

function details(step, restarted, t) {
  const { id, state, facts } = step;
  const lines = [];
  if (id === 'materials' && state === 'done' && facts.files > 0 && facts.notes) {
    lines.push(t('studySheetProgress.materials.plusNotes'));
  }
  if (id === 'plan' && state === 'done') {
    if (Array.isArray(facts.topics) && facts.topics.length) lines.push(facts.topics.join(', '));
    if (facts.priorities > 0) lines.push(t('studySheetProgress.plan.priorities'));
    if (facts.quizzes > 0) lines.push(t('studySheetProgress.plan.quizzes', { count: facts.quizzes }));
  }
  if (id === 'write' && state === 'active' && restarted) lines.push(t('studySheetProgress.write.restarted'));
  return lines;
}

export default function StudySheetProgress({ message }) {
  const { t } = useTranslation();
  const { steps, failed, restarted } = sheetProgress(message);
  const stateWord = state => t(`studySheetProgress.state.${state}`);

  return (
    <section className={`ssp ${failed ? 'ssp-failed' : ''}`} aria-label={t('studySheetProgress.aria')}>
      <span className="ssp-kicker">{t('studySheetProgress.kicker')}</span>
      <h2 className="ssp-title">{t(failed ? 'studySheetProgress.titleFailed' : 'studySheetProgress.title')}</h2>
      <ol className="ssp-steps" role="status" aria-live="polite">
        {steps.map(step => {
          const lines = details(step, restarted, t);
          return (
            <li key={step.id} className={`ssp-step ssp-step-${step.state}`}>
              <Box state={step.state} />
              <div className="ssp-step-body">
                <p className="ssp-step-label">
                  {label(step, steps, t)}
                  <span className="ssp-sr"> ({stateWord(step.state)})</span>
                </p>
                {lines.map((line, i) => <p className="ssp-step-detail" key={i}>{line}</p>)}
                {step.sections.length > 0 && (
                  <ul className="ssp-sections">
                    {step.sections.map((title, i) => <li key={i}>{title}</li>)}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {failed && <p className="ssp-error" role="alert">{message.error}</p>}
    </section>
  );
}
