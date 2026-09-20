import React, { useLayoutEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import StudyPathMascot from '../QuizRoom/StudyPathMascot';
import ChatSendButton from './ChatSendButton';

export default function TutorDiscussionPanel({ animateTutor = false, conversational = false, history = [], busy, tutorError, questionIndex = 0, active, isCase = false, readOnly = false, setTutorOpen, send, tutorBottom, questionPane, text, setText, current, t, title = 'Your tutor', inputId = 'practice-input' }) {
  const discussion = useRef(null), latestUser = useRef(null);
  const latestUserIndex = history.reduce((last, turn, index) => turn.role === 'user' ? index : last, -1);
  useLayoutEffect(() => {
    if (!conversational || !discussion.current || !latestUser.current) return;
    const pane = discussion.current;
    const user = latestUser.current;
    let frame = null, disposed = false;
    const reserveReplySpace = () => {
      frame = null;
      if (disposed) return;
      const space = Math.max(52, Math.round(pane.clientHeight - user.offsetHeight - 64)) + 'px';
      if (pane.style.getPropertyValue('--reply-space') !== space) {
        pane.style.setProperty('--reply-space', space);
      }
    };
    reserveReplySpace();
    // Never change layout during ResizeObserver delivery. Coalesce measurements
    // into the next frame and skip unchanged values to avoid resize feedback.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      if (!disposed && frame === null) frame = requestAnimationFrame(reserveReplySpace);
    }) : null;
    observer?.observe(pane);
    pane.scrollTop += latestUser.current.getBoundingClientRect().top - pane.getBoundingClientRect().top - 12;
    return () => {
      disposed = true;
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [conversational, latestUserIndex]);
  return <aside className="practice-tutor" data-animate={animateTutor} data-has-discussion={history.length > 0 || busy || !!tutorError} aria-label={title === 'Your tutor' ? 'Question tutor' : title}><header><div className="practice-tutor-identity"><div className="practice-tutor-mascot" aria-hidden="true"><StudyPathMascot size={48} /></div><div className="practice-tutor-label"><strong>{title}</strong><span>Question {questionIndex + 1} · {active?.showFeedback ? 'Let’s review your reasoning' : 'Hints first. Your answer is yours.'}</span></div></div>{!isCase && <button onClick={() => setTutorOpen(false)} aria-label="Close tutor">×</button>}</header>
      <div ref={discussion} className={`practice-discussion ${conversational ? 'is-conversational' : ''}`}>{!history.length && <><p>{active?.showFeedback ? 'Talk through your answer, one step at a time.' : 'A little help, without giving it away. Tell me where you’re stuck.'}</p><div className="practice-starters">{['Rephrase the question', 'Give me a small hint'].map(prompt => <button key={prompt} disabled={readOnly || busy} onClick={() => send(prompt)}>{prompt}</button>)}</div></>}
        {history.map((turn, index) => <div key={index} ref={index === latestUserIndex ? latestUser : undefined} className={`practice-turn ${turn.role} ${conversational && index >= latestUserIndex ? 'is-latest' : ''}`}><ReactMarkdown>{turn.content}</ReactMarkdown>
          {turn.sources?.map((source, i) => <details key={i}><summary>{source.source}{source.page != null ? ` · page ${Number(source.page) + 1}` : ''}</summary><p>{source.text}</p></details>)}</div>)}
        {busy && (conversational ? <div className="reasoning-typing" role="status"><span className="reasoning-typing-label">Thinking it through</span></div> : <div className="practice-tutor-loading" role="status"><span className="paper-skeleton" /><span className="paper-skeleton short" /><span className="sr-only">Your tutor is responding</span></div>)}
        {tutorError && <p className="practice-error" role="alert">{tutorError} Your message is in the input so you can retry.</p>}<div ref={tutorBottom} /></div>
    <form className="practice-composer" onSubmit={event => { event.preventDefault(); send(); }}><div><label htmlFor={inputId}>Question {questionIndex + 1}{active?.showFeedback ? ' · Answer saved' : ''}</label><button className="practice-mobile-return" type="button" onClick={() => { questionPane.current?.scrollTo({ top: 0, behavior: 'smooth' }); questionPane.current?.parentElement?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to question ↑</button></div>
      <div className="practice-input-shell"><textarea id={inputId} maxLength={4000} disabled={readOnly || busy} value={text} onChange={event => setText(event.target.value)} placeholder="Ask your tutor…" rows={2}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
      <ChatSendButton label={t('chat.send', 'Send')} busy={busy} disabled={readOnly || !text.trim() || !current} /></div></form>
    </aside>;
}
