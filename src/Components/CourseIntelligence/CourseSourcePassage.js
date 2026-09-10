import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentsIcon } from './CourseIntelligenceIcons';
import './CourseTransformation.css';

export default function CourseSourcePassage({ source, compact = false, featured = false }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (!source?.filename || !source?.excerpt) return null;
  const label = <><DocumentsIcon size={16} /><span>{source.filename}</span></>;
  const limit = featured ? 360 : 180;
  const shorten = !compact && !expanded && source.excerpt.length > limit;
  const excerpt = shorten ? `${source.excerpt.slice(0, limit).replace(/\s+\S*$/, '')}…` : source.excerpt;
  const sentenceEnd = featured ? excerpt.search(/[.!?](?=\s|$)/) + 1 : 0;
  const highlightEnd = sentenceEnd > 30 ? sentenceEnd : excerpt.length;
  const passage = <blockquote><mark>{excerpt.slice(0, highlightEnd)}</mark>{excerpt.slice(highlightEnd)}</blockquote>;
  return compact ? <details className="cs-source-passage is-compact">
    <summary>{label}<small>{t('courseStudio.seePassage')}</small></summary>{passage}
  </details> : <div className="cs-source-passage"><div className="cs-source-filename">{label}</div>{passage}
    {source.excerpt.length > limit && <button type="button" className="cs-text-button cs-passage-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{t(expanded ? 'courseStudio.lessPassage' : 'courseStudio.seePassage')}</button>}
  </div>;
}
