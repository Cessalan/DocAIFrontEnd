import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentsIcon, LinkIcon } from './CourseIntelligenceIcons';
import CourseSourceDrawer from './CourseSourceDrawer';
import './CourseSourceTabs.css';

function webSources(report) {
  const seen = new Set();
  return [...(report.resources?.resources || []), ...(report.course?.citations || []), ...(report.instructor?.citations || [])]
    .flatMap(source => {
      try {
        const url = new URL(source.url);
        if (!['https:', 'http:'].includes(url.protocol) || seen.has(url.href)) return [];
        seen.add(url.href);
        return [{ ...source, url: url.href, host: url.hostname.replace(/^www\./, ''), why: source.why || source.snippet || '' }];
      } catch { return []; }
    });
}

export default function CourseSourceTabs({ report, filenames = [] }) {
  const { t } = useTranslation();
  const id = useId();
  const [selected, setSelected] = useState('docs');
  const [viewer, setViewer] = useState(null);
  const docsRef = useRef(null);
  const webRef = useRef(null);
  const files = [...new Set([...filenames, ...(report.materials?.filenames || [])])].filter(Boolean);
  const sources = webSources(report);
  const active = selected === 'web' && sources.length ? 'web' : 'docs';
  const topics = report.materials?.topics || [];
  const count = files.length || report.materials?.fileCount || 0;
  const documents = items => <ul className="cs-document-list">{items.map(filename => {
    const covered = topics.filter(topic => Array.isArray(topic.files) && topic.files.includes(filename)).map(topic => topic.topic).filter(Boolean);
    return <li key={filename}><DocumentsIcon size={18} /><div><strong>{filename}</strong>
      {covered.length > 0 && <span>{covered.slice(0, 3).join(' · ')}</span>}
    </div></li>;
  })}</ul>;
  const links = items => <ul className="cs-web-source-list">{items.map(source => <li key={source.url}>
    <a href={source.url} target="_blank" rel="noopener noreferrer nofollow"><strong>{source.title || source.host}</strong><span aria-hidden="true">↗</span></a>
    <span className="cs-web-source-host">{source.host}</span>
    {source.why && <p>{source.why}</p>}
  </li>)}</ul>;
  const changeTab = event => {
    if (!sources.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'docs' : event.key === 'End' ? 'web' : active === 'docs' ? 'web' : 'docs';
    setSelected(next);
    (next === 'docs' ? docsRef : webRef).current?.focus();
  };
  return <section className="cs-source-tabs">
    <div className="cs-source-tablist" role="tablist" aria-label={t('courseStudio.sourceTabs')} onKeyDown={changeTab}>
      <button type="button" ref={docsRef} role="tab" id={`${id}-docs-tab`} aria-controls={`${id}-docs-panel`}
        aria-selected={active === 'docs'} tabIndex={active === 'docs' ? 0 : -1} onClick={() => setSelected('docs')}>
        <DocumentsIcon size={15} />{t('courseStudio.documentsTab')}<span>{count}</span>
      </button>
      {sources.length > 0 && <button type="button" ref={webRef} role="tab" className="cs-web-tab" id={`${id}-web-tab`} aria-controls={`${id}-web-panel`}
        aria-selected={active === 'web'} tabIndex={active === 'web' ? 0 : -1} onClick={() => setSelected('web')}>
        <LinkIcon size={15} />{t('courseStudio.webTab')}<span>{sources.length}</span>
      </button>}
    </div>
    <div className="cs-source-tabpanel" role="tabpanel" id={`${id}-docs-panel`} aria-labelledby={`${id}-docs-tab`} hidden={active !== 'docs'} tabIndex={0}>
      {documents(files.slice(0, 2))}
      {files.length > 2 && <button type="button" className="cs-view-all" aria-haspopup="dialog" onClick={() => setViewer('docs')}>{t('courseStudio.viewAllDocuments', { count: files.length })}<span aria-hidden="true">↗</span></button>}
      {!files.length && <p className="cs-source-empty">{t('courseStudio.files', { count })}</p>}
      {report.exam?.coverage?.length > 0 && <p className="cs-source-exam"><strong>{report.exam.type || t('courseStudio.examDate')}</strong>{report.exam.coverage.slice(0, 3).join(' · ')}</p>}
    </div>
    {sources.length > 0 && <div className="cs-source-tabpanel" role="tabpanel" id={`${id}-web-panel`} aria-labelledby={`${id}-web-tab`} hidden={active !== 'web'} tabIndex={0}>
      {links(sources.slice(0, 2))}
      {sources.length > 2 && <button type="button" className="cs-view-all" aria-haspopup="dialog" onClick={() => setViewer('web')}>{t('courseStudio.viewAllSources', { count: sources.length })}<span aria-hidden="true">↗</span></button>}
    </div>}
    {viewer && <CourseSourceDrawer title={t(viewer === 'docs' ? 'courseStudio.documentsTab' : 'courseStudio.webTab')} onClose={() => setViewer(null)}>
      {viewer === 'docs' ? documents(files) : links(sources)}
    </CourseSourceDrawer>}
  </section>;
}
