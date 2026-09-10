import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DatePicker from '../Common/DatePicker';
import { StudioMascot } from './CourseStudioFrame';
import './CourseExamWelcome.css';

export const TypedLine = ({ text, delay = 0 }) => (
  <span className="cs-exam-welcome__line" aria-hidden="true">
    {Array.from(text).map((letter, index) => <span key={index}
      className="cs-exam-welcome__letter" style={{ animationDelay: `${delay + index * 22}ms` }}>{letter}</span>)}
  </span>
);

export function CourseUploadWelcome({ materialsReady = false, failed = false, onRetry }) {
  const { t } = useTranslation();
  return <section className="cs-shell cs-exam-welcome cs-upload-welcome">
    <StudioMascot size={42} />
    <h3 className="cs-title cs-exam-welcome__title"><span className="sr-only">{t('courseStudio.examWelcome')}</span>
      <TypedLine text={t('courseStudio.examWelcome')} />
    </h3>
    <div className={`cs-upload-welcome__shimmer${failed ? ' is-stopped' : ''}`} aria-hidden="true" />
    <p role="status" className="cs-upload-welcome__status">{t(failed ? 'courseStudio.transformFailed' : materialsReady ? 'courseStudio.quizLoading' : 'courseStudio.processingFiles')}</p>
    {failed && onRetry && <button type="button" className="course-context__cta cs-button" onClick={onRetry}>{t('courseStudio.retryQuestion')}</button>}
  </section>;
}

export default function CourseExamWelcome({ language = 'en', disabled = false, onChoose, greeting: customGreeting, question: customQuestion, animateGreeting = true }) {
  const { t } = useTranslation();
  const titleId = useId();
  const [selectedDate, setSelectedDate] = useState('');
  const [leaving, setLeaving] = useState(false);
  const selectionLock = useRef(false);
  const onChooseRef = useRef(onChoose);
  useEffect(() => { onChooseRef.current = onChoose; }, [onChoose]);
  useEffect(() => {
    if (!selectedDate) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const exitTimer = reduced ? null : setTimeout(() => setLeaving(true), 520);
    const completeTimer = setTimeout(() => onChooseRef.current(selectedDate), reduced ? 120 : 740);
    return () => { clearTimeout(exitTimer); clearTimeout(completeTimer); };
  }, [selectedDate]);
  const greeting = customGreeting || t('courseStudio.examWelcome');
  const question = customQuestion || t('courseStudio.examWelcomeWhen');
  const dateLabel = selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(language, {
    month: 'short', day: 'numeric',
  }) : '';
  return <section className={`cs-shell cs-exam-welcome${selectedDate ? ' is-selected' : ''}${leaving ? ' is-leaving' : ''}`} aria-labelledby={titleId}>
    <StudioMascot size={42} />
    <h3 className="cs-title cs-exam-welcome__title" id={titleId}>
      <span className="sr-only">{greeting} {question}</span>
      {animateGreeting ? <><TypedLine text={greeting} /><TypedLine text={question} delay={Array.from(greeting).length * 22 + 180} /></>
        : <span aria-hidden="true"><span className="cs-exam-welcome__line">{greeting}</span><span className="cs-exam-welcome__line">{question}</span></span>}
    </h3>
    <fieldset className="cs-exam-welcome__calendar" disabled={disabled || Boolean(selectedDate)}>
      <legend className="sr-only">{t('courseStudio.examDate')}</legend>
      <DatePicker inline value={selectedDate} minDate={new Date()} language={language} onChange={date => {
        if (disabled || selectionLock.current) return;
        selectionLock.current = true;
        setSelectedDate(date);
      }} />
    </fieldset>
    <div className="cs-exam-welcome__footer">
      {selectedDate ? <p className="cs-exam-welcome__confirmed" role="status">
        <span aria-hidden="true">✓</span> {t('courseStudio.dateLabel', { date: dateLabel })}
      </p> : <button className="cs-text-button cs-exam-welcome__skip" type="button" disabled={disabled}
        onClick={() => { if (!selectionLock.current) { selectionLock.current = true; onChoose(null); } }}>
        {t('courseStudio.examWelcomeSkip')}
      </button>}
    </div>
  </section>;
}
