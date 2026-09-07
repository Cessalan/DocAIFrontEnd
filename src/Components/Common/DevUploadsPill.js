import React, { useCallback, useEffect, useState } from 'react';
import { GetChatUploads } from '../../Services/FireBaseServiceChats';
import { devLog } from '../../Services/devLogger';

/**
 * DevUploadsPill — development-only control that pulls down the source files a
 * student actually attached to a session.
 *
 * WHY THIS EXISTS
 *
 * Everything downstream of an upload is a claim about a document we can no
 * longer see. The insights card says "your notes go deepest here — 4 key
 * points"; the planner tiers on a topic label; a drill picks its pool. When one
 * of those is wrong the first question is always the same — what was actually
 * IN the file? — and answering it meant opening the Firebase console, finding
 * the chat, then the Storage path, and downloading by hand.
 *
 * Worth remembering while reading whatever comes back: the extractor does NOT
 * see the file you download here. For anything over 5000 characters it reads
 * three RANDOM 1000-char windows, truncated to 2500 chars in the prompt
 * (`extract_file_insights_from_text` in NQBackEnd2/main.py). A topic missing
 * from the card is at least as likely to have been missed by the sampling as
 * to be absent from the document, and re-running the same upload can sample
 * differently. Reading the file tells you which.
 *
 * Mounted at ChatLayout (covers chat AND study mode, which renders inside it)
 * and at ExamDrillPage (its own route). All three surfaces are keyed by the
 * same chatId and uploads hang off the chat doc, so one component serves them.
 *
 * Safety: returns null outside development builds, and reads only — it never
 * writes to Firestore or Storage.
 *
 * Styles are inline on purpose, following DevPaywallPill: this is scaffolding,
 * and it should be deletable in one file with no leftovers in a stylesheet.
 *
 * @param {string} chatId - the session whose uploads to list
 */

const btn = {
  padding: '5px 9px',
  border: 'none',
  borderRadius: 6,
  background: 'rgba(0, 0, 0, 0.18)',
  color: '#1a1a1a',
  font: '600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace',
  cursor: 'pointer',
};

const humanSize = (size) => {
  // Firestore rows carry whatever the upload path put there (often a
  // pre-formatted string); Storage metadata gives bytes. Take both.
  if (size === null || size === undefined) return null;
  if (typeof size === 'string') return size;
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = Number(size);
  if (!Number.isFinite(n)) return null;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u += 1; }
  return `${n < 10 && u > 0 ? n.toFixed(1) : Math.round(n)} ${units[u]}`;
};

/**
 * Save one file under its real name.
 *
 * The blob round-trip is what makes the filename stick: `downloadURL` points at
 * storage.googleapis.com, and the `download` attribute is ignored cross-origin,
 * so a plain link opens a PDF in a tab instead of saving "Week 4 Notes.pdf".
 * When the bucket has no CORS policy the fetch throws, and opening the tab is
 * strictly better than failing silently — hence the fallback rather than a
 * catch that swallows.
 */
const saveFile = async (file) => {
  if (!file?.downloadURL) return;
  try {
    const res = await fetch(file.downloadURL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'upload';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    devLog('DevUploadsPill: blob download failed, opening directly', e);
    window.open(file.downloadURL, '_blank', 'noopener');
  }
};

const DevUploadsPill = ({ chatId }) => {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [state, setState] = useState('idle'); // idle | loading | done | error

  const load = useCallback(async () => {
    if (!chatId) return;
    setState('loading');
    try {
      setFiles(await GetChatUploads(chatId));
      setState('done');
    } catch (e) {
      devLog('DevUploadsPill: load failed', e);
      setState('error');
    }
  }, [chatId]);

  // Only on open: a listAll plus a getDownloadURL per file on every chat switch
  // is real network for a panel that is usually closed.
  useEffect(() => { if (open) load(); }, [open, load]);

  // A different session is a different file set — never show the last one's.
  useEffect(() => { setFiles([]); setState('idle'); }, [chatId]);

  if (process.env.NODE_ENV !== 'development') return null;
  if (!chatId) return null;

  return (
    <div
      style={{
        position: 'fixed',
        // Stacked above DevExamDebriefPill, which owns bottom-left at 16.
        bottom: 60,
        left: 16,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        userSelect: 'none',
      }}
    >
      {open && (
        <div
          style={{
            maxHeight: 320,
            width: 320,
            overflowY: 'auto',
            padding: 10,
            borderRadius: 10,
            background: '#1f2430',
            color: '#e8e8ea',
            font: '11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          }}
        >
          {state === 'loading' && <div style={{ opacity: 0.7 }}>Loading…</div>}
          {state === 'error' && <div style={{ color: '#ff8a80' }}>Could not read uploads.</div>}
          {state === 'done' && files.length === 0 && (
            <div style={{ opacity: 0.7 }}>No files on this session.</div>
          )}

          {files.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ wordBreak: 'break-all' }}>
                  {f.name}
                  {/* The upload landed but the client never wrote its row —
                      worth seeing, because it means the chat's own file list
                      is missing this one too. */}
                  {f.orphan && (
                    <span
                      style={{ color: '#ffb74d', marginLeft: 6 }}
                      title="In Storage, but no Firestore row"
                    >
                      ⚠ orphan
                    </span>
                  )}
                </div>
                <div style={{ opacity: 0.55 }}>
                  {[humanSize(f.size), f.wordCount ? `${f.wordCount} words` : null]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
              </div>
              <button
                type="button"
                style={{ ...btn, background: 'rgba(255,255,255,0.14)', color: '#e8e8ea' }}
                onClick={() => saveFile(f)}
                disabled={!f.downloadURL}
                title={f.downloadURL ? `Download ${f.name}` : 'No download URL on this row'}
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderRadius: 999,
          background: '#8ab4f8',
          color: '#000',
          fontSize: 11,
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        <span style={{ letterSpacing: '0.04em' }}>UPLOADS</span>
        <button
          type="button"
          style={btn}
          onClick={() => setOpen((o) => !o)}
          title="Dev only: list and download this session's source files"
        >
          {open ? '×' : '↓'}
        </button>
        {open && files.length > 0 && (
          <button
            type="button"
            style={btn}
            onClick={() => files.forEach((f) => saveFile(f))}
            title="Download every file on this session"
          >
            all
          </button>
        )}
      </div>
    </div>
  );
};

export default DevUploadsPill;
