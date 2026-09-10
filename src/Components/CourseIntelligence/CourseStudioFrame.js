import React from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentsIcon } from './CourseIntelligenceIcons';
import BookMascot from '../QuizRoom/BookMascot';
import BrainMascot from '../QuizRoom/BrainMascot';
import StudyPathMascot from '../QuizRoom/StudyPathMascot';
import './CourseStudio.css';

export const StudioMascot = ({ stage = 0, size = 48 }) => {
  const Mascot = [BookMascot, BrainMascot, StudyPathMascot][stage] || BookMascot;
  return <span className="cs-mascot" aria-hidden="true"><Mascot size={size} isActive /></span>;
};

export const CourseStudioHeader = ({ context = {}, stage = 0 }) => {
  const { t } = useTranslation();
  const subject = [context.courseCode, context.courseName || context.course].filter(Boolean).join(' · ');
  return (
    <header className="cs-header">
      <div className="cs-identity"><StudioMascot stage={stage} /><div><span className="cs-kicker">{t('courseStudio.label')}</span>
        {subject && <span className="cs-course">{subject}</span>}</div></div>
      <ol className="cs-stages" aria-label={t('courseStudio.label')}>
        {['discover', 'check', 'path'].map((key, index) => <li key={key} className={index === stage ? 'is-current' : index < stage ? 'is-done' : ''} aria-current={index === stage ? 'step' : undefined}>
          <span className="cs-stage-dot" /><span>{t(`courseStudio.${key}`)}</span>
        </li>)}
      </ol>
    </header>
  );
};

export const StudioFiles = ({ filenames = [], fileCount = 0, processing = false }) => {
  const { t } = useTranslation();
  const count = fileCount || filenames.length;
  return <div className="cs-files">
    <span className={`cs-file-stack${processing ? ' is-processing' : ''}`} aria-hidden="true"><DocumentsIcon size={21} /></span>
    <div><strong>{t(processing ? 'courseStudio.readingFiles' : 'courseStudio.filesReady')}</strong>
      <span>{filenames.length ? filenames.slice(0, 2).join(' · ') : count === 1 ? t('courseStudio.oneFile') : t('courseStudio.files', { count })}
        {filenames.length > 2 && ` +${filenames.length - 2}`}</span></div>
    <span className={`cs-live-dot${processing ? ' is-active' : ''}`} aria-hidden="true" />
  </div>;
};
