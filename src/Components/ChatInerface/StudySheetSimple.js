import React, { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveStudySheet, sourceLabel, sheetFilename } from './studySheetModel';
import './StudySheetSimple.css';

// React text nodes keep uploaded/model content inert. Only these inline marks
// are interpreted; no generated HTML or executable links reach the page.
function Inline({ text }) {
  return String(text || '').split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// Older sheets used all-caps headings. Keep their wording and medical
// abbreviations, while presenting them with the same hierarchy as new sheets.
function readableHeading(value) {
  const text = String(value || '');
  if (text !== text.toUpperCase() || !/\p{Lu}/u.test(text)) return text;
  return text.toLowerCase()
    .replace(/\b(?:gn|rpgn|nclex|ckd|esrd|aki|gbm|gfr|egfr|bun|uti|siadh|adh|ace|arb|copd|ecg|ekg|hiv|aids|dka|iv|icu|cns|pns|sata|rna|dna|rbc|wbc)\b/g, word => word.toUpperCase())
    .replace(/\biga\b/g, 'IgA').replace(/\bigg\b/g, 'IgG')
    .replace(/^\p{L}/u, letter => letter.toUpperCase());
}

function Block({ block, french, sources, sourcePrefix }) {
  const labels = french
    ? { teacher: 'Votre priorité', practice: 'À revoir après votre quiz', takeaway: 'À retenir', example: 'Exemple', self_check: 'Vérifiez votre compréhension' }
    : { teacher: 'Your priority', practice: 'Review from your practice', takeaway: 'Keep in mind', example: 'Worked example', self_check: 'Check your understanding' };
  let body;
  if (block.kind === 'paragraph') body = <p><Inline text={block.text} /></p>;
  if (block.kind === 'list') {
    const List = block.ordered ? 'ol' : 'ul';
    body = <List>{block.items.map((item, i) => <li key={i}><Inline text={item} /></li>)}</List>;
  }
  if (block.kind === 'table') body = <div className="sheet-table-scroll" tabIndex={0} role="region" aria-label={block.title || (french ? 'Tableau comparatif' : 'Comparison table')}>
    <table><thead><tr>{block.columns.map((c, i) => <th key={i} scope="col"><Inline text={c} /></th>)}</tr></thead>
      <tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0
        ? <th key={j} scope="row"><Inline text={cell} /></th> : <td key={j}><Inline text={cell} /></td>)}</tr>)}</tbody></table>
  </div>;
  if (block.kind === 'callout') body = <aside className={`sheet-callout sheet-callout-${block.tone}`}>
    <span className="sheet-callout-label">{labels[block.tone]}</span>
    {block.title && <h3>{block.title}</h3>}<p><Inline text={block.text} /></p>
  </aside>;
  if (block.kind === 'self_check') body = <div className="sheet-self-check">
    <span className="sheet-callout-label">{labels.self_check}</span>
    {block.questions.map((q, i) => <div className="sheet-check-item" key={i}>
      <p><span className="sheet-check-number">{i + 1}</span><Inline text={q.question} /></p>
      <details><summary>{french ? 'Voir la réponse et le raisonnement' : 'Show answer and reasoning'}</summary>
        <p><Inline text={q.answer} /></p></details>
    </div>)}
  </div>;
  const refs = (block.sourceIds || []).map(id => sources.find(s => s.id === id)).filter(Boolean);
  return <div className="sheet-block">
    {block.supplemental && <span className="sheet-callout-label sheet-supplemental">{french ? 'Explication complémentaire' : 'Supplemental explanation'}</span>}
    {block.title && block.kind !== 'callout' && <h3>{block.title}</h3>}{body}
    {!!refs.length && <div className="sheet-block-sources">{refs.map(s => <a key={s.id} href={`#${sourcePrefix}-${s.id}`} onClick={() => {
      const disclosure = document.getElementById(`${sourcePrefix}-${s.id}`)?.closest('details');
      if (disclosure) disclosure.open = true;
    }}>{sourceLabel(s, french)}</a>)}</div>}
  </div>;
}

export default function StudySheetSimple({ topic, content = '', studySheet = null, isStreaming = false, error = null, inline = false }) {
  const { i18n } = useTranslation();
  const id = useId().replace(/:/g, '');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [folded, setFolded] = useState({});
  const sheet = useMemo(() => resolveStudySheet(studySheet, topic, content,
    i18n.language?.startsWith('fr') ? 'french' : 'english'), [studySheet, topic, content, i18n.language]);
  const french = sheet.language === 'french' || sheet.language === 'fr';
  const hasContent = sheet.sections.length > 0;
  const sources = sheet.sources || [];
  const sourcePrefix = `sheet-${id}-source`;
  const download = async () => {
    setDownloading(true); setDownloadError(false);
    try {
      const { createStudySheetPDF } = await import('./studySheetPdf');
      const pdf = await createStudySheetPDF(sheet);
      await pdf.save(sheetFilename(sheet.title), { returnPromise: true });
    } catch (err) {
      console.error('Study sheet PDF export failed:', err);
      setDownloadError(true);
    } finally { setDownloading(false); }
  };
  return <article className={`study-sheet-simple-wrapper ${inline ? 'study-sheet-inline' : ''}`} aria-label={french ? 'Fiche de révision' : 'Study sheet'}>
    <header className="sheet-header">
      <div className="sheet-toolbar">
        <span className="sheet-kicker">{french ? 'Fiche de révision' : 'Study sheet'}</span>
        {hasContent && !isStreaming && !error && <button className="study-download-btn" onClick={download} disabled={downloading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" /></svg>
          {downloading ? (french ? 'Préparation…' : 'Preparing…') : (french ? 'Télécharger le PDF' : 'Download PDF')}
        </button>}
      </div>
      <h2 className={`study-sheet-title ${String(sheet.title || '').length > 90 ? 'sheet-long-title' : ''}`}>{readableHeading(sheet.title)}</h2>
      {sheet.subtitle && <p className="sheet-subtitle">{sheet.subtitle}</p>}
      {(isStreaming || error) && <div className="sheet-status" role="status">{error ? (french ? 'Fiche incomplète' : 'Sheet incomplete')
        : <><span className="sheet-loading-dot" />{french ? 'Préparation de votre fiche…' : 'Building your study sheet…'}</>}</div>}
      {downloadError && <p className="sheet-error" role="alert">{french ? 'Le PDF n’a pas pu être préparé. Réessayez.' : 'The PDF could not be prepared. Please try again.'}</p>}
    </header>
    {sheet.summary && <div className="sheet-overview"><span className="sheet-callout-label">{french ? 'En un coup d’œil' : 'At a glance'}</span><p><Inline text={sheet.summary} /></p></div>}
    {sheet.sections.length > 2 && <details className="sheet-contents">
      <summary><span>{french ? 'Voir les sections' : 'View sections'}</span><span className="sheet-contents-count">{sheet.sections.length}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <nav className="sheet-nav" aria-label={french ? 'Sections de la fiche' : 'Study sheet sections'}>
        {sheet.sections.map((section, i) => <a key={section.id} href={`#sheet-${id}-${section.id}`} onClick={event => {
          setFolded(prev => ({ ...prev, [section.id]: false }));
          event.currentTarget.closest('details').open = false;
        }}><span>{String(i + 1).padStart(2, '0')}</span>{readableHeading(section.title) || (french ? 'Révision' : 'Review')}</a>)}
      </nav>
    </details>}
    <div className="study-sheet-simple-content">
      {sheet.sections.map((section, i) => <section className="sheet-section" id={`sheet-${id}-${section.id}`} key={section.id}>
        {section.title && <h2 className="sheet-section-heading"><button aria-expanded={!folded[section.id]} aria-controls={`sheet-${id}-${section.id}-body`}
          onClick={() => setFolded(prev => ({ ...prev, [section.id]: !prev[section.id] }))}>
          <span className="sheet-section-index">{String(i + 1).padStart(2, '0')}</span><span>{readableHeading(section.title)}</span>
          <svg className="sheet-collapse-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button></h2>}
        <div id={`sheet-${id}-${section.id}-body`} hidden={!!folded[section.id]}>
          {section.blocks.map((block, j) => <Block key={j} block={block} french={french} sources={sources} sourcePrefix={sourcePrefix} />)}
        </div>
      </section>)}
      {isStreaming && !hasContent && <div className="sheet-skeleton" aria-hidden="true"><i /><i /><i /></div>}
      {error && <p className="sheet-error" role="alert">{error}</p>}
    </div>
    {!!sources.length && !isStreaming && <details className="sheet-sources"><summary>{french ? 'Sources et contexte utilisés' : 'Sources and context used'}</summary>
      <ol>{sources.map(s => <li id={`${sourcePrefix}-${s.id}`} key={s.id}><strong>{sourceLabel(s, french)}</strong>
        {s.quote && <p>“{s.quote}”</p>}{s.kind === 'quiz' && <span> · {s.answered}/{s.total} {french ? 'questions répondues' : 'questions answered'}</span>}
      </li>)}</ol>
    </details>}
  </article>;
}
