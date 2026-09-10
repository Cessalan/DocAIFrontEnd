import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CourseStudioHeader } from './CourseStudioFrame';
import { DocumentsIcon } from './CourseIntelligenceIcons';
import CourseSourcePassage from './CourseSourcePassage';
import CourseResearchActivity from './CourseResearchActivity';
import './CourseStudio.css';
import './CourseDocumentStage.css';

const CourseIntelligenceTimeline = ({ timeline, context = {}, materialsReady = true, filenames = [], onSkip, onAddContext, failed = false, onRetry }) => {
  const { t } = useTranslation();
  const cardRef = useRef(null);
  useEffect(() => {
    const card = cardRef.current;
    const chat = card?.closest('.messages-container');
    if (!card) return undefined;
    const measure = () => {
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop || 0;
      const bottom = top + (viewport?.height || window.innerHeight);
      let available = bottom - Math.max(card.getBoundingClientRect().top, top) - 16;
      if (chat) {
        const bounds = chat.getBoundingClientRect();
        const style = window.getComputedStyle(chat);
        const visible = Math.min(bounds.bottom, bottom) - Math.max(bounds.top, top);
        available = visible - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0) - 24;
      }
      card.style.setProperty('--ci-chat-height', `${Math.max(160, available)}px`);
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (chat) observer?.observe(chat);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);
  const transformation = timeline?.transformation;
  const source = transformation?.source;
  const hasPassage = Boolean(source?.filename && source?.excerpt);
  const unavailable = transformation?.state === 'unavailable';

  return <section ref={cardRef} className={`cs-shell cs-transform cs-document-stage ${hasPassage ? 'has-passage' : ''} ${failed || unavailable ? 'is-failed' : ''}`}>
    <CourseStudioHeader context={context} />
    <div className="cs-body">
      <div className="cs-section-heading">
        <h3 className="cs-title">{t('courseStudio.transformTitle')}</h3>
      </div>
      <article className="cs-document-card" aria-label={t('courseStudio.yourFiles')}>
        {hasPassage ? <CourseSourcePassage source={source} featured /> : <>
          <div className="cs-source-filename"><DocumentsIcon size={16} /><span>{filenames[0] || t('courseStudio.yourFiles')}</span>
            {filenames.length > 1 && <small>+{filenames.length - 1}</small>}
          </div>
          <div className="cs-document-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        </>}
      </article>
      <div className="cs-transform-status" role="status" aria-live="polite">
        {!unavailable && !failed && <span className="cs-live-dot is-active" aria-hidden="true" />}
        <span>{t(failed ? 'courseStudio.transformFailed' : !materialsReady ? 'courseStudio.processingFiles' : unavailable ? 'courseStudio.previewUnavailable' : hasPassage ? 'courseStudio.formingQuestion' : 'courseStudio.findingPassage')}</span>
      </div>
      <CourseResearchActivity timeline={timeline} stopped={failed} compact />
    </div>
    {(onAddContext || (materialsReady && onSkip)) && <footer className="cs-footer cs-footer--quiet">
      {failed && onRetry && <button type="button" className="course-context__cta cs-button" onClick={onRetry}>{t('courseStudio.retryQuestion')}</button>}
      {onAddContext && <button type="button" className="cs-text-button" onClick={onAddContext}>{t('courseStudio.addCourseContext')} +</button>}
      {materialsReady && onSkip && <button type="button" className="cs-text-button" onClick={onSkip}>{t('courseStudio.continueMaterials')} →</button>}
    </footer>}
  </section>;
};
export default CourseIntelligenceTimeline;
