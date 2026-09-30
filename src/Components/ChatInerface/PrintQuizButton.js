import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { renderQuizPrintHtml, printFrame, printQuiz, prefersTab } from './quizPrintDocument';
import './PrintQuizButton.css';

function PrinterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 9V3.5h10V9M7 17.5H5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v6.5H7z" />
    </svg>
  );
}

// Shows the exact document that will print, then hands that same frame to the
// browser's print dialog. The frame is sandboxed without scripts: it only
// needs same-origin (so we can print it) and modals (print() is one).
function PrintPreview({ html, onClose, onPrintTab, t }) {
  const frame = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const print = async () => {
    // Phone browsers print a frame unreliably; there the document gets its own
    // tab. window.open has to run inside this click, before any await.
    if (prefersTab()) { onPrintTab(); return; }
    if (!frame.current || busy) return;
    setBusy(true);
    try { await printFrame(frame.current); } catch (error) { console.error('Quiz print failed:', error); } finally { setBusy(false); }
  };

  return createPortal(
    <div className="print-preview-overlay" onClick={onClose}>
      <div className="print-preview" role="dialog" aria-modal="true" aria-label={t('quizPrint.previewTitle')} onClick={event => event.stopPropagation()}>
        <header className="print-preview-bar">
          <div className="print-preview-heading">
            <strong>{t('quizPrint.previewTitle')}</strong>
            <small>{t('quizPrint.previewHint')}</small>
          </div>
          <div className="print-preview-actions">
            <button type="button" className="print-preview-close" onClick={onClose}>{t('quizPrint.close')}</button>
            <button type="button" className="print-preview-print" onClick={print} disabled={busy} autoFocus>
              <PrinterIcon />{busy ? t('quizPrint.preparing') : t('quizPrint.print')}
            </button>
          </div>
        </header>
        <iframe ref={frame} className="print-preview-frame" title={t('quizPrint.previewTitle')} srcDoc={html} sandbox="allow-same-origin allow-modals" />
      </div>
    </div>,
    document.body
  );
}

export default function PrintQuizButton({ questions = [], answers, topic, className = '' }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ready = questions.some(q => q?.question || q?.scenario?.items);
  const input = { questions, answers, topic, t, language: i18n?.language || 'en' };
  // Built when the preview opens, so answers given since are included.
  const html = useMemo(() => (open ? renderQuizPrintHtml({ ...input, mode: 'preview' }) : ''), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return null;

  return (
    <>
      <button type="button" className={`print-quiz-btn ${className}`} onClick={() => setOpen(true)} title={t('quizPrint.buttonTitle')} aria-label={t('quizPrint.buttonTitle')}>
        <PrinterIcon />
        <span className="print-quiz-label">{t('quizPrint.button')}</span>
      </button>
      {open && <PrintPreview html={html} t={t} onClose={() => setOpen(false)}
        onPrintTab={() => printQuiz(input).catch(error => console.error('Quiz print failed:', error))} />}
    </>
  );
}
