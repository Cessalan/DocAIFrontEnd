import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from './CourseIntelligenceIcons';
import './CourseResearchActivity.css';

const labels = { course_research: 'searchCourse', professor_research: 'searchInstructor', academic_resources_research: 'searchReferences' };

const sourceLinks = searches => {
  const seen = new Set();
  return searches.flatMap(step => step.detail?.sources || []).flatMap(source => {
    try {
      const url = new URL(source.url);
      if (!['https:', 'http:'].includes(url.protocol) || seen.has(url.href)) return [];
      seen.add(url.href);
      return [{ url: url.href, domain: url.hostname.replace(/^www\./, ''), title: source.title || url.hostname }];
    } catch { return []; }
  }).slice(0, 3);
};

const WebGlobe = () => <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
  <circle cx="16" cy="16" r="12" /><ellipse cx="16" cy="16" rx="5.5" ry="12" />
  <path d="M4 16h24M7 9.5c6 3 12 3 18 0M7 22.5c6-3 12-3 18 0" />
</svg>;

export default function CourseResearchActivity({ timeline, stopped = false, compact = false }) {
  const { t } = useTranslation();
  // Never infer a search from context or the report's synthetic completion.
  const searches = (timeline?.steps || []).filter(step => labels[step.id] && step.started);
  if (!searches.length) return null;
  const running = searches.filter(step => step.state === 'running');
  const interrupted = (stopped || timeline.failed) && running.length > 0;
  const active = running.length > 0 && !interrupted;
  const resources = searches.find(step => step.id === 'academic_resources_research')?.detail?.resource_count || 0;
  const citations = searches.reduce((count, step) => count + (Number(step.detail?.citation_count) || 0), 0);
  const sources = sourceLinks(searches);
  if (compact && !active && !interrupted && !resources && !citations && !sources.length) return null;
  const topics = (timeline?.steps?.find(step => step.id === 'materials_analyzed')?.detail?.top_topics || [])
    .filter(topic => typeof topic === 'string' && topic.trim()).slice(0, 2);
  return <section className={`cs-research-panel${active ? ' is-searching' : ''}${compact ? ' is-compact' : ''}`}>
    <div className="cs-research-activity" role="status" aria-live="polite">
    <span className="cs-web-orb" aria-hidden="true"><WebGlobe />{!active && !interrupted && <i><CheckIcon size={10} /></i>}</span>
    <div><strong>{t(`courseStudio.${interrupted ? 'searchInterrupted' : active ? 'searchOnline' : resources > 0 || citations > 0 || sources.length > 0 ? 'searchComplete' : 'searchFinishedEmpty'}`)}</strong>
      <span>{active ? running.map(step => t(`courseStudio.${labels[step.id]}`)).join(' · ')
        : resources > 0 ? t('courseStudio.searchResourceCount', { count: resources })
          : citations > 0 ? t('courseStudio.searchCitationCount', { count: citations })
          : t(`courseStudio.${interrupted ? 'searchResumeHint' : 'searchChecked'}`)}</span>
    </div>
    {active && <span className="cs-research-pulse" aria-hidden="true" />}
    </div>
    {!compact && active && topics.length > 0 && <div className="cs-search-subjects">{topics.map(topic => <span key={topic}>{topic}</span>)}</div>}
    {compact ? sources.length > 0 && <div className="cs-research-domains">{sources.slice(0, 2).map(source =>
      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}>{source.domain} ↗</a>)}</div> : sources.length > 0 ? <div className="cs-search-sources">
      {sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
        className="cs-search-source" style={{ '--source-index': index }}>
        <span className="cs-source-domain">{source.domain}</span><strong>{source.title}</strong><span className="cs-source-arrow" aria-hidden="true">↗</span>
      </a>)}
    </div> : active && <div className="cs-search-skeleton" aria-hidden="true"><span /><span /></div>}
  </section>;
}
