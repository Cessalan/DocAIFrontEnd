import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import StudyQuizCard from '../StudyMode/StudyQuizCard';
import StudyPathMascot from '../QuizRoom/StudyPathMascot';
import ChatSendButton from './ChatSendButton';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import { askPracticeTutor, savePractice, streamPracticeBatch, copyPracticeToOwnChat } from '../../Services/PracticeService';
import { appendUniqueQuestions, initialPracticeSettings, normalizePracticeQuestion, permittedTotal } from './practiceModel';
import '../StudyMode/StudyMode.css';
import './FocusedQuiz.css';

// Matching path commands let the browser interpolate a curved, narrowing sheet.
// The lower edge stays attached to the launch card as the upper edge unfurls.
import { paperContour } from './paperTransition';

export function PracticeShimmer() {
  return <div className="practice-shimmer" role="status" aria-label="Preparing your questions">
    <span className="practice-skeleton short" /><span className="practice-skeleton title" />
    {[0, 1, 2, 3].map(i => <span key={i} className="practice-skeleton option" />)}
    <p>Preparing your questions…</p>
  </div>;
}

export default function FocusedQuiz({ message, chatId, visible, onExit, onPracticeChange, readOnly = false, onCopyCreated, launchOrigin, onSessionComplete }) {
  const { i18n, t } = useTranslation();
  const { remaining, isPro, refresh, openUpgrade } = useUsageLimit();
  const [practice, setPractice] = useState(() => ({ questions: [], answers: {}, discussions: {}, ...message.practice, settings: initialPracticeSettings(message) }));
  const initialSnapshot = useRef(message.practice?.snapshot);
  const [active, setActive] = useState(null);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [animateTutor, setAnimateTutor] = useState(false);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(visible);
  useLayoutEffect(() => { setOpening(visible); setAnimateTutor(false); }, [visible]);
  const exitPending = useRef(false);
  const [copying, setCopying] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [extending, setExtending] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [tutorError, setTutorError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const practiceRef = useRef(practice), dirty = useRef(false), saveChain = useRef(Promise.resolve());
  const changeCallback = useRef(onPracticeChange); changeCallback.current = onPracticeChange;
  useEffect(() => { if (!readOnly) changeCallback.current?.(practice); }, [practice, readOnly]);
  const batchRef = useRef(null), tutorAbort = useRef(null), questionPane = useRef(null), tutorBottom = useRef(null);
  const persist = useCallback(() => {
    if (readOnly || !dirty.current) return;
    const value = practiceRef.current;
    dirty.current = false;
    saveChain.current = saveChain.current.catch(() => {}).then(() => savePractice(chatId, message.id, value))
      .then(() => setSaveError('')).catch(() => { dirty.current = true; setSaveError('Progress could not sync. Keep this tab open and retry.'); });
  }, [chatId, message.id, readOnly]);
  const update = useCallback(patch => {
    const next = typeof patch === 'function' ? patch(practiceRef.current) : { ...practiceRef.current, ...patch };
    practiceRef.current = next; dirty.current = true; setPractice(next);
  }, []);
  useEffect(() => { const timer = setTimeout(persist, 350); return () => clearTimeout(timer); }, [practice, persist]);
  useEffect(() => () => { persist(); tutorAbort.current?.abort(); batchRef.current?.controller.abort(); }, [persist]);
  useEffect(() => { if (!visible) persist(); }, [visible, persist]);
  const finishExit = useCallback(() => {
    if (!exitPending.current) return;
    exitPending.current = false;
    onExit();
  }, [onExit]);
  const closePractice = useCallback(() => {
    if (exitPending.current) return;
    persist();
    const saved = practiceRef.current;
    const all = appendUniqueQuestions(message.quizData || [], saved.questions || []);
    const allowed = permittedTotal(saved.settings.requested_total, all.length, remaining, isPro);
    if (!readOnly && !message.isStreaming && !batchRef.current && !saved.pendingBatch && all.length >= allowed && all.length > 0 &&
        all.every((q, i) => typeof (saved.answers?.[i] || q.userSelection)?.isCorrect === 'boolean')) {
      onSessionComplete?.({ messageId: message.id, questionCount: all.length,
        saved: saveChain.current.then(() => { if (dirty.current) throw new Error('Progress has not synced yet.'); }) });
    }
    exitPending.current = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finishExit();
    else setClosing(true);
  }, [persist, finishExit, message, remaining, isPro, readOnly, onSessionComplete]);
  useEffect(() => {
    if (!closing) return;
    // Also finish if the browser interrupts the CSS animation.
    const timer = setTimeout(finishExit, 620);
    return () => clearTimeout(timer);
  }, [closing, finishExit]);
  useEffect(() => {
    if (!visible) { exitPending.current = false; setClosing(false); }
  }, [visible]);

  const questions = useMemo(() => appendUniqueQuestions(message.quizData || [], practice.questions || []).map((q, index) =>
    normalizePracticeQuestion({ ...q, userSelection: practice.answers?.[index] || q.userSelection })), [message.quizData, practice.questions, practice.answers]);
  const loaded = questions.length;
  const target = permittedTotal(practice.settings.requested_total, loaded, remaining, isPro);
  const questionIndex = active?.questionIndex ?? practice.snapshot?.queueIndex ?? 0;
  const current = questions[questionIndex];
  const history = practice.discussions?.[questionIndex] || [];
  const settingsRef = useRef(practice.settings); settingsRef.current = practice.settings;
  const questionRef = useRef(questions); questionRef.current = questions;
  const quotaRef = useRef({ remaining, isPro }); quotaRef.current = { remaining, isPro };
  const onContext = useCallback(context => setActive(previous => {
    if (previous?.questionIndex === context.questionIndex && previous?.selectedIndex === context.selectedIndex && previous?.showFeedback === context.showFeedback && previous?.question === context.question) return previous;
    return context;
  }), []);
  const previousQuestion = useRef(questionIndex);
  useEffect(() => { if (previousQuestion.current !== questionIndex) setTutorOpen(false); previousQuestion.current = questionIndex; setText(''); setTutorError(''); }, [questionIndex]);
  useEffect(() => {
    const discussion = tutorBottom.current?.parentElement;
    if (discussion) discussion.scrollTop = discussion.scrollHeight;
  }, [history.length, busy, tutorOpen]);

  const onSnapshot = useCallback(snapshot => update(previous => ({ ...previous, snapshot })), [update]);
  const onAnswer = useCallback(answer => {
    if (answer.questionIndex == null || answer.isCorrect == null) return;
    update(previous => ({ ...previous, firstAnswers: { ...previous.firstAnswers, [answer.questionIndex]: previous.firstAnswers?.[answer.questionIndex] || {
      ...answer, selectedOption: questionRef.current[answer.questionIndex]?.options?.[answer.selectedIndex],
    } }, answers: { ...previous.answers, [answer.questionIndex]: {
      ...answer, progress: undefined, selectedOption: questionRef.current[answer.questionIndex]?.options?.[answer.selectedIndex],
      timestamp: new Date().toISOString()
    } } }));
  }, [update]);
  const addTurn = useCallback((index, turn) => update(previous => ({ ...previous,
    discussions: { ...previous.discussions, [index]: [...(previous.discussions?.[index] || []), turn] }
  })), [update]);

  const extend = useCallback(async () => {
    if (readOnly || batchRef.current || message.isStreaming) return;
    const qs = questionRef.current, settings = settingsRef.current, quota = quotaRef.current;
    const total = permittedTotal(settings.requested_total, qs.length, quota.remaining, quota.isPro);
    if (total <= qs.length && !practiceRef.current.pendingBatch) { if (!quota.isPro && quota.remaining <= 0) openUpgrade(); return; }
    const controller = new AbortController();
    const pending = practiceRef.current.pendingBatch || {
      chat_id: chatId, request_id: uuid(), topic: message.quizTopic || message.topic || qs[0]?.topic || 'Uploaded course material',
      count: Math.min(5, total - qs.length), settings, existing_questions: qs.map(q => q.question), language: i18n.language
    };
    update({ pendingBatch: pending });
    batchRef.current = { controller }; setExtending(true); setBatchError('');
    try {
      await streamPracticeBatch(pending, q => update(previous => ({ ...previous,
        questions: appendUniqueQuestions(previous.questions || [], [q]) })), controller.signal);
      update({ pendingBatch: null });
    } catch (error) {
      if (error.name !== 'AbortError') { setBatchError(error.message); if (error.status === 429) { update({ pendingBatch: null }); openUpgrade(); } }
    } finally { batchRef.current = null; setExtending(false); refresh(); }
  }, [readOnly, message.isStreaming, message.quizTopic, message.topic, chatId, i18n.language, update, refresh, openUpgrade]);
  useEffect(() => {
    if (!visible || extending || batchError || message.isStreaming || !loaded) return;
    if (practiceRef.current.pendingBatch || (target > loaded && loaded - questionIndex <= 3)) extend();
  }, [visible, extending, batchError, message.isStreaming, loaded, target, questionIndex, extend]);

  async function send(value = text) {
    if (readOnly || !value.trim() || busy || !current) return;
    const index = questionIndex, question = current;
    const controller = new AbortController(); tutorAbort.current = controller;
    if (!tutorOpen) setAnimateTutor(true);
    setTutorOpen(true); setBusy(true); setTutorError(''); setText('');
    addTurn(index, { role: 'user', content: value });
    try {
      const response = await askPracticeTutor({ chat_id: chatId, message: value, question,
        selection: practiceRef.current.answers?.[index] || { selectedIndex: active?.selectedIndex },
        history: (practiceRef.current.discussions?.[index] || []).slice(-16), settings: settingsRef.current,
        performance: { answered: Object.keys(practiceRef.current.answers || {}).length,
          correct: Object.values(practiceRef.current.answers || {}).filter(a => a.isCorrect).length,
          generated: loaded, requested: target }, language: i18n.language }, controller.signal);
      addTurn(index, { role: 'assistant', content: response.reply, sources: response.sources || [] });
      if (response.action === 'stop') closePractice();
      if (response.action === 'continue') setTutorOpen(false);
      if (['configure', 'extend'].includes(response.action)) {
        const old = settingsRef.current;
        const requested = response.settings?.requested_total || (response.action === 'extend' ? Math.max(old.requested_total, loaded) + 5 : old.requested_total);
        const allowed = permittedTotal(requested, questionRef.current.length, quotaRef.current.remaining, quotaRef.current.isPro);
        const settings = { ...old, ...response.settings, requested_total: allowed };
        settingsRef.current = settings; update({ settings });
        setNotice(requested > allowed ? `Your allowance supports ${allowed} questions in this practice. Existing questions stay available.` : 'Preferences saved for future batches. Your current question and answers are preserved.');
        if (!quotaRef.current.isPro && quotaRef.current.remaining <= 0 && requested > loaded) openUpgrade();
        else if (response.action === 'extend') extend();
      }
    } catch (error) { if (error.name !== 'AbortError') { setTutorError(error.message); setText(value); } }
    finally { setBusy(false); tutorAbort.current = null; }
  }

  const content = useMemo(() => ({ questions, _expectedTotal: target,
    _isStreaming: !readOnly && (!!message.isStreaming || extending || (target > loaded && !batchError)) }), [questions, target, message.isStreaming, extending, loaded, batchError, readOnly]);
  const origin = launchOrigin?.width > 0 ? launchOrigin : { left: window.innerWidth * .3, top: window.innerHeight * .3, width: window.innerWidth * .4, height: window.innerHeight * .3 };
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = window.innerHeight;
  const originStyle = {
    '--practice-paper-source': paperContour(origin.left, origin.left + origin.width, origin.top, origin.top + origin.height, origin.left, origin.left + origin.width, 22),
    '--practice-paper-bend': paperContour(0, viewportWidth, 0, Math.max(origin.top + origin.height, viewportHeight * .76), origin.left, origin.left + origin.width, 18),
    '--practice-paper-full': paperContour(0, viewportWidth, 0, viewportHeight, 0, viewportWidth, 0),
  };
  const isCase = ['casestudy', 'ordering', 'bowtie'].includes(current?.questionType);
  const tutorPanel = <aside className="practice-tutor" data-animate={animateTutor} data-has-discussion={history.length > 0 || busy || !!tutorError} aria-label="Question tutor"><header><div className="practice-tutor-identity"><div className="practice-tutor-mascot" aria-hidden="true"><StudyPathMascot size={48} /></div><div className="practice-tutor-label"><strong>Your tutor</strong><span>Question {questionIndex + 1} · {active?.showFeedback ? 'Let’s review your reasoning' : 'Hints first. Your answer is yours.'}</span></div></div>{!isCase && <button onClick={() => setTutorOpen(false)} aria-label="Close tutor">×</button>}</header>
      <div className="practice-discussion">{!history.length && <><p>{active?.showFeedback ? 'Talk through your answer, one step at a time.' : 'A little help, without giving it away. Tell me where you’re stuck.'}</p><div className="practice-starters">{['Rephrase the question', 'Give me a small hint'].map(prompt => <button key={prompt} disabled={readOnly || busy} onClick={() => send(prompt)}>{prompt}</button>)}</div></>}
        {history.map((turn, index) => <div key={index} className={`practice-turn ${turn.role}`}><ReactMarkdown>{turn.content}</ReactMarkdown>
          {turn.sources?.map((source, i) => <details key={i}><summary>{source.source}{source.page != null ? ` · page ${Number(source.page) + 1}` : ''}</summary><p>{source.text}</p></details>)}</div>)}
        {busy && <div className="practice-tutor-loading" role="status"><span className="practice-skeleton" /><span className="practice-skeleton short" /><span className="sr-only">Your tutor is responding</span></div>}
        {tutorError && <p className="practice-error" role="alert">{tutorError} Your message is in the input so you can retry.</p>}<div ref={tutorBottom} /></div>
    <form className="practice-composer" onSubmit={event => { event.preventDefault(); send(); }}><div><label htmlFor="practice-input">Question {questionIndex + 1}{active?.showFeedback ? ' · Answer saved' : ''}</label><button className="practice-mobile-return" type="button" onClick={() => { questionPane.current?.scrollTo({ top: 0, behavior: 'smooth' }); questionPane.current?.parentElement?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to question ↑</button></div>
      <div className="practice-input-shell"><textarea id="practice-input" disabled={readOnly} value={text} onChange={event => setText(event.target.value)} placeholder="Ask your tutor…" rows={2}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
      <ChatSendButton label={t('chat.send', 'Send')} busy={busy} disabled={readOnly || !text.trim() || !current} /></div></form>
    </aside>;
  return createPortal(<section className={`focused-quiz study-mode-container ${isCase ? 'has-case has-tutor' : tutorOpen ? 'has-tutor' : ''} ${closing ? 'is-folding' : opening ? 'is-opening' : ''}`} style={originStyle} hidden={!visible} inert={closing ? true : undefined} aria-label="Focused quiz practice"
    onAnimationEnd={event => {
      if (event.target !== event.currentTarget) return;
      if (event.animationName === 'practice-paper-fold') finishExit();
      if (event.animationName === 'practice-paper-unfold') setOpening(false);
    }}>
    <header className="practice-header"><div><strong>{message.quizTopic || 'Your practice'}</strong><span>{loaded} ready · {target} questions{!isPro ? ` · ${remaining} remaining in your allowance` : ''}</span></div>
      <button type="button" onClick={closePractice}>← Back to chat</button></header>
    {notice && <div className="practice-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}
    {readOnly && <div className="practice-notice">This is another user's conversation. Make your own copy to answer and discuss it. Uploaded source files are not copied.
      {onCopyCreated && <button disabled={copying} onClick={async () => { setCopying(true); try { const id = await copyPracticeToOwnChat(message, questions); onCopyCreated(id); } catch (error) { setSaveError(error.message); } finally { setCopying(false); } }}>{copying ? 'Creating your practice…' : 'Practice in my own chat'}</button>}</div>}
    {saveError && <div className="practice-error" role="alert">{saveError} <button onClick={persist}>Retry save</button></div>}
    <div className="practice-work"><div className="practice-question" ref={questionPane}>
      {loaded === 0 ? <PracticeShimmer /> : <StudyQuizCard content={content} savedProgress={initialSnapshot.current}
        practiceMode onHint={() => send('Give me a small hint')} onQuestionContext={onContext} onSnapshot={readOnly ? undefined : onSnapshot} onAnswer={readOnly ? undefined : onAnswer}
        renderLoading={() => <PracticeShimmer />} onContinue={closePractice} />}
      {loaded > 0 && !isCase && <button className="practice-help" onClick={() => { setAnimateTutor(true); setTutorOpen(value => !value); }}>{tutorOpen ? 'Close discussion' : 'Discuss this question'}</button>}
      {batchError && <div className="practice-error" role="alert">{batchError}<button disabled={extending} onClick={() => extend()}>Retry batch</button></div>}
      {!message.isStreaming && loaded === 0 && <div className="practice-error">No questions arrived. Return to chat to retry your request.</div>}
    </div>
    {(isCase || tutorOpen) && tutorPanel}
    </div>
  </section>, document.body);
}
