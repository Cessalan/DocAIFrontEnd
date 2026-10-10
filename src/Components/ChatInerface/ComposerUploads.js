import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { anyUploading, displayProgress } from './composerUploadModel';
import './ComposerUploads.css';

const RADIUS = 14.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/* One quiet glyph per file kind. The ring and the name carry the state;
   the glyph only says "this is your PDF / your slides". */
export function KindGlyph({ kind }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (kind) {
    case 'slides':
      return <svg {...common}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4M8 20h8" /></svg>;
    case 'image':
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 9" /></svg>;
    case 'sheet':
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16M10 3v18" /></svg>;
    case 'pdf':
    case 'doc':
    case 'text':
    default:
      return <svg {...common}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>;
  }
}

/**
 * The files attached in the message box. A thin ring fills around each
 * file's glyph from real upload stages (composerUploadModel); when a file
 * is ready the ring fades, the glyph settles, and the name turns full ink.
 */
export default function ComposerUploads({ files = [] }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const moving = anyUploading(files);

  // Redraw while anything is loading so the ring keeps easing between events.
  useEffect(() => {
    if (!moving) return undefined;
    let frame;
    const tick = () => { setNow(Date.now()); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moving]);

  if (files.length === 0) return null;
  return (
    <div className="composer-uploads" aria-live="polite">
      {files.map(file => {
        const progress = displayProgress(file, now);
        const state = file.status === 'ready' ? 'is-ready' : file.status === 'error' ? 'is-error' : 'is-loading';
        const label = file.status === 'ready'
          ? t('composerUpload.ready', { name: file.name })
          : file.status === 'error'
            ? t('composerUpload.failedFile', { name: file.name })
            : t('composerUpload.uploading', { name: file.name });
        return (
          <div key={file.key} className={`composer-upload ${state} kind-${file.kind}`} title={file.name} aria-label={label} role="group">
            <span className="composer-upload__icon">
              <svg className="composer-upload__ring" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
                <circle className="composer-upload__track" cx="16" cy="16" r={RADIUS} />
                <circle
                  className="composer-upload__fill"
                  cx="16" cy="16" r={RADIUS}
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - progress / 100)}
                  transform="rotate(-90 16 16)"
                />
              </svg>
              <span className="composer-upload__glyph"><KindGlyph kind={file.kind} /></span>
            </span>
            <span className="composer-upload__name">{file.name}</span>
          </div>
        );
      })}
    </div>
  );
}
