import React, { useEffect, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './FileViewerModal.css';

// Worker must match the pdfjs-dist version react-pdf bundles internally.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const getExt = (name = '') => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
};

const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'log']);
const PDF_EXTS = new Set(['pdf']);

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.15;

/**
 * Parse a transcript .txt file's "# key: value" header block (lines that
 * start with "# " until a blank line) into a metadata object + the body.
 * Falls back to {body: full text, meta: null} for non-transcript files.
 */
const parseTranscriptHeader = (text) => {
  if (!text || !text.startsWith('# ')) return { meta: null, body: text };
  const lines = text.split('\n');
  const meta = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('# ')) {
      const rest = line.slice(2);
      const colon = rest.indexOf(':');
      if (colon === -1) {
        meta._title = rest.trim();
      } else {
        const key = rest.slice(0, colon).trim().toLowerCase();
        meta[key] = rest.slice(colon + 1).trim();
      }
      i++;
    } else if (line.trim() === '') {
      i++;
      break;
    } else {
      break;
    }
  }
  const body = lines.slice(i).join('\n').trim();
  return { meta, body };
};

const FileViewerModal = ({ file, onClose }) => {
  const [textContent, setTextContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);

  const ext = useMemo(() => getExt(file?.name || ''), [file]);
  const isText = TEXT_EXTS.has(ext);
  const isPdf = PDF_EXTS.has(ext);

  // Stable object reference so react-pdf doesn't re-fetch on every render.
  const pdfFile = useMemo(
    () => (isPdf && file?.downloadURL ? { url: file.downloadURL } : null),
    [isPdf, file?.downloadURL]
  );

  useEffect(() => {
    if (!file || !isText) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(file.downloadURL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!cancelled) setTextContent(text);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load file');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [file, isText]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) return null;

  const parsed = isText && textContent ? parseTranscriptHeader(textContent) : null;
  const meta = parsed?.meta;
  const body = parsed?.body ?? textContent;
  const displayTitle = meta?._title || file.name;

  return (
    <div
      className="fv-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${file.name}`}
    >
      <div className="fv-overlay__backdrop" onClick={onClose} />
      <div className={`fv-panel ${isPdf ? 'fv-panel--pdf' : ''}`}>
        <div className="fv-header">
          <div className="fv-header__main">
            <h2 className="fv-title">{displayTitle}</h2>
            {meta && (
              <div className="fv-meta">
                {meta.recorded && <span>Recorded {new Date(meta.recorded).toLocaleString()}</span>}
                {meta.duration && (
                  <>
                    {meta.recorded && <span className="fv-meta__sep">·</span>}
                    <span>{meta.duration}</span>
                  </>
                )}
                {meta.chunks && (
                  <>
                    <span className="fv-meta__sep">·</span>
                    <span>{meta.chunks} chunk{meta.chunks === '1' ? '' : 's'}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="fv-header__actions">
            <a
              className="fv-icon-btn"
              href={file.downloadURL}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              aria-label="Open in new tab"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            <button
              className="fv-icon-btn"
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="fv-body">
          {isText && (
            <>
              {loading && <div className="fv-loading"><span className="fv-shimmer">Loading…</span></div>}
              {error && <div className="fv-error">Could not load this file. {error}</div>}
              {!loading && !error && body !== null && body !== undefined && (
                <pre className="fv-text">{body}</pre>
              )}
            </>
          )}

          {isPdf && (
            <div className="fv-pdf">
              <div className="fv-pdf__toolbar">
                <button
                  type="button"
                  className="fv-pdf__btn"
                  onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)))}
                  disabled={scale <= MIN_SCALE}
                  aria-label="Zoom out"
                >−</button>
                <span className="fv-pdf__scale">{Math.round(scale * 100)}%</span>
                <button
                  type="button"
                  className="fv-pdf__btn"
                  onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)))}
                  disabled={scale >= MAX_SCALE}
                  aria-label="Zoom in"
                >+</button>
                {numPages > 0 && (
                  <span className="fv-pdf__count">{numPages} page{numPages === 1 ? '' : 's'}</span>
                )}
              </div>
              <div className="fv-pdf__doc">
                <Document
                  file={pdfFile}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  onLoadError={(e) => setError(e?.message || 'Failed to load PDF')}
                  loading={<div className="fv-loading"><span className="fv-shimmer">Loading PDF…</span></div>}
                  error={<div className="fv-error">Could not load this PDF.</div>}
                >
                  {Array.from({ length: numPages }, (_, i) => (
                    <Page
                      key={i + 1}
                      pageNumber={i + 1}
                      scale={scale}
                      className="fv-pdf__page"
                      renderAnnotationLayer={false}
                    />
                  ))}
                </Document>
              </div>
            </div>
          )}

          {!isText && !isPdf && (
            <div className="fv-unsupported">
              <p>Preview isn&apos;t available for this file type.</p>
              <a
                className="fv-link-btn"
                href={file.downloadURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download {file.name}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileViewerModal;
