import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { briefLines, isDone } from './requestBriefModel';
import './RequestBrief.css';

const SIZES = [25, 50, 75, 100];

function Mark({ status, t }) {
  // Shape carries the meaning, not colour alone: a tick is done, a ring is
  // still being worked on, an "i" is something she should know.
  if (isDone(status)) {
    return <svg className="request-brief-mark is-done" viewBox="0 0 16 16" role="img" aria-label={t('requestBrief.done')}>
      <circle cx="8" cy="8" r="7.25" /><path d="M4.8 8.3l2.1 2.1 4.3-4.6" /></svg>;
  }
  if (status === 'heard') {
    return <svg className="request-brief-mark is-pending" viewBox="0 0 16 16" role="img" aria-label={t('requestBrief.pending')}>
      <circle cx="8" cy="8" r="6.5" /></svg>;
  }
  return <svg className="request-brief-mark is-note" viewBox="0 0 16 16" role="img" aria-label={t('requestBrief.note')}>
    <circle cx="8" cy="8" r="7.25" /><path d="M8 7.2v4" /><circle className="dot" cx="8" cy="4.9" r=".9" /></svg>;
}

function lineText(line, t) {
  if (line.text) {
    const vars = { ...(line.text.vars || {}) };
    if (Array.isArray(vars.formats)) {
      vars.list = vars.formats.map(f => t(`practiceProfile.format.${f}`, f)).join(' · ');
    }
    return t(line.text.key, vars);
  }
  return line.label || line.said || '';
}

/**
 * Her request, read back and ticked as it is done (requestBriefModel.js).
 * `compact` is the one-line version inside a running quiz; it opens into the
 * full list.
 */
export default function RequestBrief({ brief, plan, allowance, questions = [], words = '', compact = false,
  onChangeTotal, onUpgrade }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [sizing, setSizing] = useState(false);
  const lines = useMemo(() => briefLines({ brief, plan, allowance, questions }), [brief, plan, allowance, questions]);
  if (!lines.length) return null;

  if (compact && !open) {
    const summary = lines.filter(l => l.kind !== 'unsupported').slice(0, 5).map(l => lineText(l, t)).filter(Boolean).join(' · ');
    return <button type="button" className="request-brief-compact" onClick={() => setOpen(true)} aria-expanded="false">
      <span className="request-brief-compact-label">{t('requestBrief.title')}</span>
      <span className="request-brief-compact-summary">{summary}</span>
    </button>;
  }

  return <section className={`request-brief${compact ? ' is-open' : ''}`} aria-label={t('requestBrief.title')}>
    <header className="request-brief-head">
      <span className="request-brief-label">{t('requestBrief.title')}</span>
      {compact && <button type="button" className="request-brief-hide" onClick={() => setOpen(false)}>{t('requestBrief.hide')}</button>}
    </header>
    {words && <blockquote className="request-brief-words">{words}</blockquote>}
    <ul className="request-brief-lines">
      {lines.map(line => {
        const detail = line.detail ? t(line.detail.key, line.detail.vars || {}) : '';
        const canResize = line.kind === 'count' && onChangeTotal && line.status !== 'limited';
        return <li key={line.id} className={`request-brief-line is-${line.status}`}>
          <Mark status={line.status} t={t} />
          <div className="request-brief-body">
            <span className="request-brief-text">{lineText(line, t)}</span>
            {detail && <span className="request-brief-detail">{detail}</span>}
            {line.note && <span className="request-brief-detail">{t(line.note.key, line.note.vars || {})}</span>}
            {canResize && !sizing && <button type="button" className="request-brief-action" onClick={() => setSizing(true)}>{t('requestBrief.change')}</button>}
            {canResize && sizing && <span className="request-brief-sizes" role="group" aria-label={t('requestBrief.change')}>
              {SIZES.map(size => <button type="button" key={size} aria-pressed={size === (brief?.total)}
                onClick={() => { setSizing(false); onChangeTotal(size); }}>{size}</button>)}
            </span>}
            {line.status === 'limited' && onUpgrade && <button type="button" className="request-brief-action" onClick={onUpgrade}>{t('requestBrief.upgrade')}</button>}
          </div>
        </li>;
      })}
    </ul>
  </section>;
}
