import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TutorDiscussionPanel from '../ChatInerface/TutorDiscussionPanel';
import ChatSendButton from '../ChatInerface/ChatSendButton';
import { loadReasoning, saveReasoning, discussReasoning } from '../../Services/StudyReasoningService';
import '../ChatInerface/FocusedQuiz.css';
import './StudyReasoning.css';

// Mounted with a question-specific key: pending replies can never land on another question.
export default function StudyReasoning({ chatId, nodeId, questionIndex, question, selection, revealed }) {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState([]), [text, setText] = useState('');
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [unsaved, setUnsaved] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null), restoreFocus = useRef(false);
  const closeDiscussion = useCallback(() => {
    if (closeTimer.current) return;
    restoreFocus.current = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setOpen(false);
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
      setClosing(false);
    }, 200);
  }, []);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open && !busy && restoreFocus.current) {
      input.current?.focus();
      restoreFocus.current = false;
    }
  }, [open, busy]);
  const controller = useRef(null), live = useRef(true), bottom = useRef(null), input = useRef(null);
  const busyRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    live.current = true;
    loadReasoning(chatId, nodeId, questionIndex).then(value => { if (!cancelled) setHistory(value); })
      .catch(() => { if (!cancelled) setError('Previous discussion could not load. Reopen this question to retry.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; live.current = false; controller.current?.abort(); };
  }, [chatId, nodeId, questionIndex]);

  useEffect(() => {
    if (!open) return undefined;
    if (!busy) document.getElementById('study-reasoning-chat')?.focus({ preventScroll: true });
    const onKey = event => { if (event.key === 'Escape') closeDiscussion(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, closeDiscussion]);
  const persist = async value => {
    try { await saveReasoning(chatId, nodeId, questionIndex, value); if (live.current) setUnsaved(null); }
    catch { if (live.current) setUnsaved(value); }
  };
  const send = async prompt => {
    const message = (typeof prompt === 'string' ? prompt : text).trim();
    if (!message || busyRef.current || loading || unsaved) return;
    busyRef.current = true; setBusy(true); setError(''); setOpen(true);
    setPendingMessage({ role: 'user', content: message }); setText('');
    const abort = new AbortController(); controller.current = abort;
    try {
      const result = await discussReasoning({ chat_id: chatId, question, message,
        selection: revealed ? selection : {},
        history: history.slice(-16).map(({ role, content }) => ({ role, content: content.slice(0, 2500) })), language: i18n.language }, abort.signal);
      if (!live.current) return;
      const next = [...history, { role: 'user', content: message }, { role: 'assistant', content: result.reply, sources: result.sources || [] }].slice(-40);
      setHistory(next); setPendingMessage(null); await persist(next);
    } catch (e) { if (live.current && e.name !== 'AbortError') { setText(message); setError(e.message); } }
    finally { busyRef.current = false; if (live.current) setBusy(false); }
  };
  return <div className={`study-reasoning ${open ? 'is-open' : ''}`}>
    <div hidden={open}>
    <label htmlFor="study-reasoning-draft">Talk me through your thinking <span>Optional</span></label>
    <form className="study-reasoning-composer" onSubmit={event => { event.preventDefault(); send(); }}>
    <textarea ref={input} id="study-reasoning-draft" rows={1} maxLength={4000} value={text} onChange={e => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }} placeholder="What guided your choices? Where were you unsure?" disabled={busy || loading} />
    <ChatSendButton label="Discuss my reasoning" busy={busy} disabled={!text.trim() || loading || !!unsaved || error.startsWith('Previous discussion')} />
    </form>
    {history.length > 0 && <button className="study-reasoning-reopen" type="button" onClick={() => setOpen(true)}>Continue discussion <span aria-hidden="true">↗</span></button>}
    </div>
    {loading && <small role="status">Loading discussion…</small>}
    {!open && error && <p role="alert">{error}</p>}
    {unsaved && <p role="alert">Discussion could not save. Keep this question open. <button type="button" onClick={() => persist(unsaved)}>Retry saving</button></p>}
    {open && <div className={`study-reasoning-side ${closing ? 'is-closing' : 'is-entering'}`} inert={closing ? true : undefined}>
      <TutorDiscussionPanel title="Your reasoning" inputId="study-reasoning-chat" history={pendingMessage ? [...history, pendingMessage] : history} conversational busy={busy} tutorError={error}
        questionIndex={questionIndex} active={{ showFeedback: revealed }} readOnly={!!unsaved} setTutorOpen={value => { if (!value) closeDiscussion(); }}
        send={send} tutorBottom={bottom} questionPane={{ current: null }} text={text} setText={setText} current={question} t={t} />
      {unsaved && <button type="button" onClick={() => persist(unsaved)}>Retry saving discussion</button>}
    </div>}
  </div>;
}
