import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { adminRequest } from '../../Services/AdminService';
import StudyInspectorLink from './StudyInspectorLink';
import { answerEvidence, answerKey, buildSteps, buildTimeline, contentType, questionOutcome, questionReview, questionsOf, selectionText, textOf, timeMs } from './studyTimelineModel';
import StudyExperience, { QuestionReviewSummary } from './StudyExperience';
import './StudyPlanInspector.css';

const root = '/admin/workspace/study-plans';
const date = value => timeMs(value) === null ? 'Time not recorded' : new Date(timeMs(value)).toLocaleString();
const grade = value => value === true ? 'Correct' : value === false ? 'Incorrect' : 'Not reliably recorded';
const Markdown = ({ children }) => <ReactMarkdown>{textOf(children)}</ReactMarkdown>;
const ArrayList = ({ value }) => Array.isArray(value) ? <ul>{value.map((v, i) => <li key={i}><Markdown>{v}</Markdown></li>)}</ul> : <Markdown>{value}</Markdown>;
const ContentType = ({ label }) => <span className="si-content-type" data-type={label}>{label}</span>;

function PlanDirectory() {
  const [plans, setPlans] = useState([]), [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [search, setSearch] = useState(''), [chatId, setChatId] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError('');
    adminRequest(root, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setPlans(data.items); setCursor(data.cursor); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [retry]);
  async function more() {
    setBusy(true); setError('');
    try { const data = await adminRequest(root + '?cursor=' + encodeURIComponent(cursor));
      setPlans(old => [...new Map([...old, ...data.items].map(p => [p.id, p])).values()]); setCursor(data.cursor);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const shown = plans.filter(p => `${p.title} ${p.id} ${p.userId}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (timeMs(b.updatedAt || b.createdAt) || 0) - (timeMs(a.updatedAt || a.createdAt) || 0));
  return <main className="study-inspector si-directory">
    <header><p className="si-eyebrow">ADMIN · SAVED STUDENT SESSIONS</p><h1>Study plan history</h1><p>Open an existing plan in its own window. Inspect saved content and activity without running the student flow.</p></header>
    <div className="si-toolbar"><label>Open a specific session<input value={chatId} onChange={e => setChatId(e.target.value.trim())} placeholder="Paste a chat ID" /></label><StudyInspectorLink chatId={chatId} /></div>
    <label>Find a loaded plan<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Title, chat ID, or student UID" /></label>
    <p>{plans.length} plans loaded{cursor ? ' · More historical plans are available below.' : ' · All available plans loaded.'}</p>
    {error && <p role="alert" className="si-warning">{error} <button onClick={() => setRetry(v => v + 1)}>Retry</button></p>}
    <div className="si-plan-list">{shown.map(p => <article key={p.id}><div><h2>{p.title || 'Untitled study plan'}</h2><p>{date(p.updatedAt || p.createdAt)} · {p.study?.status || 'Status not recorded'}</p><small>Student: {p.userId} · Session: {p.id}</small></div><StudyInspectorLink chatId={p.id} /></article>)}</div>
    {busy && <p role="status">Loading saved plans…</p>}
    {!busy && !error && !shown.length && <p>No matching plans in the loaded records.</p>}
    {cursor && <button disabled={busy} onClick={more}>Load more historical plans</button>}
  </main>;
}

function Conversation({ history, title }) {
  if (!history?.length) return null;
  return <section className="si-conversation"><h4>{title}</h4>{history.map((turn, i) => <div key={i} className={'si-turn ' + (turn.role === 'user' ? 'si-student' : 'si-tutor')}>
    <strong>{turn.role === 'user' ? 'Student' : turn.role === 'assistant' ? 'AI tutor' : 'Saved message'}</strong>
    <Markdown>{turn.content}</Markdown>
    {(turn.timestamp || turn.createdAt) && <small>{date(turn.timestamp || turn.createdAt)}</small>}
  </div>)}<small>Conversation order is preserved. Individual turn times may not have been saved.</small></section>;
}

function Question({ message, question, index, discussions, highlighted }) {
  const evidence = answerEvidence(message, index);
  const outcome = questionOutcome(evidence);
  const [open, setOpen] = useState(highlighted);
  useEffect(() => { if (highlighted) setOpen(true); }, [highlighted]);
  const rationale = question.rationale || question.justification || question.correctBlurb || question.correct_blurb;
  const thread = discussions.find(d => d.id === String(index))?.history;
  const turns = [...(thread || []), ...(message.practice?.discussions?.[index] || [])].filter(t => t.role === 'user').length;
  const rawFormat = question.questionType || question.metadata?.questionType;
  const format = { mcq: 'Multiple choice', sata: 'Select all that apply', matrix: 'Matrix', ordering: 'Put in order' }[rawFormat] || rawFormat || 'Question';
  return <details open={open} onToggle={e => setOpen(e.currentTarget.open)} id={'si-question-' + index} className={'si-question-card' + (highlighted ? ' si-highlight' : '')}>
    <summary><span className="si-question-heading"><strong>Question {index + 1} · {format}</strong><span className={'si-outcome si-' + outcome.tone}>{outcome.label}</span></span><span className="si-question-preview">{textOf(question.question || question.questionText)}</span><span className="si-question-cue">{turns ? `${turns} student message${turns === 1 ? '' : 's'} with the tutor · ` : ''}{open ? 'Close question' : 'Inspect question, answers and help'} ↓</span></summary>
    <div className="si-question-body">
    {(question.caseStudy || question.case_study) && <details open><summary>Case scenario</summary><div className="si-preserve">{textOf(question.caseStudy || question.case_study)}</div></details>}
    <Markdown>{question.question || question.questionText}</Markdown>
    {question.options?.length > 0 && <ol className="si-options">{question.options.map((option, i) => <li key={i}><Markdown>{option}</Markdown></li>)}</ol>}
    {question.rows?.length > 0 && <div className="si-table-wrap"><table><thead><tr><th>Statement</th><th>Stored correct classification</th></tr></thead><tbody>{question.rows.map((row, i) => <tr key={row.id || i}><td>{textOf(row.text)}</td><td>{question.columns?.find(c => c.id === row.correctColumnId)?.label || 'Not recorded'}{row.explanation && <small>{textOf(row.explanation)}</small>}</td></tr>)}</tbody></table></div>}
    {(evidence.stale || evidence.conflict) && <p className="si-warning">{evidence.stale ? 'This first-answer record predates this question set. It may belong to an earlier quiz.' : 'The two saved first-attempt fields disagree.'} It is excluded from the first-attempt result shown here.</p>}
    <div className="si-answer-grid"><section><h4>First attempt</h4><strong>{grade(evidence.firstCorrect)}</strong><p className="si-preserve">{evidence.stale || evidence.conflict ? 'See the conflicting record below.' : selectionText(evidence.first, question)}</p>{evidence.first && <small>{date(evidence.first.recordedAt || evidence.first.timestamp)}</small>}</section>
      <section><h4>Latest saved answer</h4><strong>{grade(evidence.latestCorrect)}{evidence.latest?.isPartial ? ' · partial credit' : ''}</strong><p className="si-preserve">{selectionText(evidence.latest, question)}</p></section></div>
    <section className="si-rationale"><h4>Correct answer</h4><div className="si-preserve">{answerKey(question)}</div><details><summary>Read the AI’s answer explanation</summary>{rationale ? <Markdown>{rationale}</Markdown> : <p>No explanation was saved for this question.</p>}</details></section>
    <Conversation title="Saved reasoning discussion" history={thread} />
    <Conversation title="Saved practice tutor discussion" history={message.practice?.discussions?.[index]} />
    {(evidence.stale || evidence.conflict) && <details><summary>Inspect conflicting answer fields</summary><pre>{JSON.stringify({ firstAnswer: evidence.first, firstStatus: evidence.status }, null, 2)}</pre></details>}
    {(question.concept || question.topic || question.metadata?.sourceDocument) && <small className="si-source">{[question.concept || question.topic, question.metadata?.sourceDocument].filter(Boolean).join(' · ')}</small>}
    </div></details>;
}

function SavedMessage({ data, highlighted }) {
  const message = data.message, questions = questionsOf(message);
  const [filter, setFilter] = useState('all');
  useEffect(() => { if (highlighted != null) setFilter('all'); }, [highlighted]);
  const rows = questionReview(data);
  const shown = rows.filter(r => filter === 'all' || r.index === highlighted ||
    (filter === 'missed' && (r.evidence.firstCorrect === false || r.evidence.latestCorrect === false)) ||
    (filter === 'discussion' && r.studentTurns.length > 0) || (filter === 'uncertain' && (r.evidence.stale || r.evidence.conflict)));
  useEffect(() => {
    if (highlighted == null) return;
    document.getElementById('si-question-' + highlighted)?.scrollIntoView?.({ block: 'center' });
  }, [highlighted, message.id]);
  const extra = Object.keys(message.quizProgress?.firstAttemptAnswers || message.practice?.firstAnswers || {}).filter(i => Number(i) >= questions.length);
  const content = message.studyContent || {};
  return <>
    <p className="si-record-date">Saved {date(message.timestamp || message.createdAt)} · {message.type || message.role} {message.hidden && '· hidden in student chat'}</p>
    {questions.length > 0 && <QuestionReviewSummary rows={rows} filter={filter} onFilter={setFilter} />}
    {questions.length > 0 && extra.length > 0 && <p className="si-warning">{extra.length} first-answer records refer to question numbers outside this saved set. They are not counted as answers to these questions.</p>}
    {data.reasoningTruncated && <p className="si-warning">This unusually large discussion was limited to 200 question threads and 20 summary documents.</p>}
    {(data.summaries || []).map(summary => <details className="si-coaching" key={summary.id}><summary>What the AI concluded and suggested next</summary>
      {(summary.summaries || []).map((s, i) => <div key={i}><h4>{Number.isInteger(s.question_index) ? 'Question ' + (s.question_index + 1) : 'Discussion'}</h4>{s.learner_quote && <blockquote>{s.learner_quote}</blockquote>}<Markdown>{s.summary}</Markdown><small>{s.status || ''}</small></div>)}
      {summary.focus && <p><strong>Suggested practice:</strong> {summary.focus.skill}</p>}
    </details>)}
    {message.content && <details className="si-saved-copy" open={!questions.length}><summary>{message.role === 'user' ? 'Student message' : questions.length ? 'Introduction shown to the student' : 'Saved content / feedback'}</summary><Markdown>{message.content}</Markdown></details>}
    {shown.map(row => <Question key={row.index} question={row.question} message={message} index={row.index} discussions={data.discussions || []} highlighted={highlighted === row.index} />)}
    {questions.length > 0 && !shown.length && <p>No questions match this filter.</p>}
    {!questions.length && <>
      {content.pages?.map((page, i) => <section className="si-question" key={i}><h3>{page.title || `Page ${i + 1}`}</h3><Markdown>{page.content || page.text || page.body || page}</Markdown></section>)}
      {content.cards?.map((card, i) => <section className="si-question" key={i}><h3>Card {i + 1}</h3><Markdown>{card.front}</Markdown><details><summary>Back of card</summary><Markdown>{card.back}</Markdown></details></section>)}
      {content.content && <Markdown>{content.content}</Markdown>}
      {(data.discussions || []).map(d => <Conversation key={d.id} title={'Saved question discussion ' + (Number(d.id) + 1)} history={d.history} />)}
    </>}
    <details className="si-raw"><summary>All saved content and progress for this record</summary><pre>{JSON.stringify(message, null, 2)}</pre></details>
  </>;
}

function PlanReader({ chatId }) {
  const [state, setState] = useState({ loading: true, messages: [] }), [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState('steps'), [selected, setSelected] = useState(null), [messageId, setMessageId] = useState(null), [questionIndex, setQuestionIndex] = useState(null);
  const [record, setRecord] = useState(null), [recordAttempt, setRecordAttempt] = useState(0), [search, setSearch] = useState('');
  const [overview, setOverview] = useState(true);
  const detailPane = useRef(null);
  useEffect(() => { if (detailPane.current) detailPane.current.scrollTop = 0; }, [overview, selected, messageId]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, messages: [] }); setSelected(null); setMessageId(null); setRecord(null);
    (async () => {
      const data = await adminRequest(root + '/' + encodeURIComponent(chatId), { signal: controller.signal });
      if (controller.signal.aborted) return;
      setState({ ...data, loading: true, messages: [] });
      let cursor = null, messages = [];
      do {
        const page = await adminRequest(root + '/' + encodeURIComponent(chatId) + '/messages' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), { signal: controller.signal });
        if (controller.signal.aborted) return;
        messages = [...messages, ...page.items]; cursor = page.cursor;
        setState({ ...data, messages, loading: !!cursor });
      } while (cursor);
    })().catch(e => { if (!controller.signal.aborted) setState(old => ({ ...old, loading: false, error: e.message, incomplete: true })); });
    return () => controller.abort();
  }, [chatId, attempt]);
  const steps = useMemo(() => buildSteps(state.chat, state.messages), [state.chat, state.messages]);
  const events = useMemo(() => buildTimeline(state.chat, state.messages, state.performance), [state.chat, state.messages, state.performance]);
  const step = steps.find(s => s.id === selected) || steps[0];
  const activeMessage = overview ? null : step?.messages.find(m => m.id === messageId) || step?.messages[0];
  useEffect(() => {
    const controller = new AbortController(); setRecord(null);
    if (!activeMessage) return () => controller.abort();
    const id = activeMessage.id;
    adminRequest(root + '/' + encodeURIComponent(chatId) + '/messages/' + encodeURIComponent(id), { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setRecord({ ...data, id }); })
      .catch(e => { if (!controller.signal.aborted) setRecord({ error: e.message, id }); });
    return () => controller.abort();
  }, [chatId, activeMessage?.id, recordAttempt]); // eslint-disable-line react-hooks/exhaustive-deps
  function select(stepId, msgId = null, question = null) { setOverview(false); setSelected(stepId); setMessageId(msgId); setQuestionIndex(question); }
  const matches = value => String(value || '').toLowerCase().includes(search.toLowerCase());
  const filteredSteps = steps.filter(s => matches(s.label + ' ' + contentType(s.node, s.messages[0])));
  const filteredEvents = events.filter(e => matches(e.contentType + ' ' + e.label + ' ' + (e.detail || '')));
  return <main className="study-inspector">
    <header className="si-header"><div><Link to="/admin/study-plans">← All saved plans</Link><p className="si-eyebrow">ADMIN · HISTORICAL RECORD · READ ONLY</p><h1>{state.chat?.title || 'Study plan timeline'}</h1><p>{state.owner?.email || state.chat?.userId || chatId}{state.chat?.examDate && <> · Exam: {date(state.chat.examDate)}</>}</p></div>
      <button disabled={state.loading} onClick={() => setAttempt(v => v + 1)}>Refresh records</button></header>
    <p className="si-notice">Understand this student’s journey, then inspect the moments that matter. Based on saved activity; content creation does not prove the student viewed it.</p>
    {state.error && <p role="alert" className="si-warning">{state.error} {state.chat && 'The timeline is incomplete.'} <button onClick={() => setAttempt(v => v + 1)}>Retry</button></p>}
    {state.loading && <p role="status">Reading saved history… {state.messages.length} records loaded.</p>}
    <div className="si-workspace"><aside className="si-sidebar"><button className="si-overview-button" aria-pressed={overview} onClick={() => setOverview(true)}>Student experience overview</button><div className="si-mode" role="group" aria-label="Browse history"><button aria-pressed={mode === 'steps'} onClick={() => setMode('steps')}>Plan steps</button><button aria-pressed={mode === 'timeline'} onClick={() => setMode('timeline')}>Activity timeline</button></div>
      <label className="si-search">Find in {mode === 'steps' ? 'steps' : 'timeline'}<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Topic, question or event" /></label>
      <div className="si-navigation">{mode === 'steps' ? filteredSteps.map(s => <button className={'si-step' + (!overview && s.id === step?.id ? ' is-selected' : '')} key={s.id} onClick={() => select(s.id)} aria-current={!overview && s.id === step?.id ? 'step' : undefined}>
        <span className="si-step-number">{s.number || '·'}</span><span><ContentType label={contentType(s.node, s.messages[0])} /><strong>{s.label}</strong><small>{s.node?.status || 'Saved'} · {s.messages.length ? `${s.messages.length} saved record${s.messages.length === 1 ? '' : 's'}` : 'No saved content'}</small></span></button>) : filteredEvents.map((event, i) => <React.Fragment key={event.id}>
          {timeMs(event.at) === null && (i === 0 || timeMs(filteredEvents[i - 1].at) !== null) && <h3 className="si-undated">Time not recorded</h3>}
          <button disabled={!event.stepId} className={'si-event' + (event.warning ? ' has-warning' : '')} onClick={() => select(event.stepId, event.messageId, event.questionIndex)}>
            <time>{date(event.at)}</time><ContentType label={event.contentType} /><strong>{event.label}</strong><span>{event.detail}</span>{event.hidden && <small>Hidden in student chat</small>}
          </button></React.Fragment>)}</div>
    </aside><section ref={detailPane} className="si-detail" aria-label="Saved step details">
      {overview ? <StudyExperience steps={steps} events={events} loading={state.loading} incomplete={state.incomplete} onSelect={select} /> : step ? <><div className="si-step-title"><button className="si-back" onClick={() => setOverview(true)}>← Experience overview</button><p className="si-eyebrow">{step.number ? `STEP ${step.number} · ${contentType(step.node, activeMessage)}` : 'SAVED SESSION CONTENT'}</p><h2>{step.label}</h2>{step.node && <p>Saved status: <strong>{step.node.status || 'Not recorded'}</strong>{step.node.adaptive && ' · Added during practice'}</p>}</div>
        {step.node?.reason && <section className="si-coaching"><h3>Recorded reason for this step</h3><Markdown>{step.node.reason}</Markdown></section>}
        {step.node?.examConfig?.customInstructions && <details className="si-instructions"><summary>Saved instructions used to generate this practice</summary><Markdown>{step.node.examConfig.customInstructions}</Markdown></details>}
        {!!step.node?.tags?.length && <p className="si-tags">{step.node.tags.map(tag => <span key={tag}>{tag}</span>)}</p>}
        {!activeMessage && <div className="si-empty"><h3>No content saved for this step</h3><p>{state.loading ? 'History is still loading.' : state.incomplete ? 'Some records could not be loaded. Retry the history request.' : 'The plan contains this step, but no matching content record exists. Opening this inspector will not generate it.'}</p></div>}
        {step.messages.length > 1 && <label>Saved record<select value={activeMessage?.id || ''} onChange={e => { setMessageId(e.target.value); setQuestionIndex(null); }}>{step.messages.map(m => <option key={m.id} value={m.id}>{date(m.timestamp || m.createdAt)} · {m.type || m.role} · {m.id}</option>)}</select></label>}
        {activeMessage && (!record || record.id !== activeMessage.id) && <p role="status">Loading this step’s questions and discussions…</p>}
        {record?.id === activeMessage?.id && record?.error && <p role="alert" className="si-warning">{record.error} <button onClick={() => setRecordAttempt(v => v + 1)}>Retry this step</button></p>}
        {record?.id === activeMessage?.id && record?.message && <SavedMessage key={record.id} data={record} highlighted={questionIndex} />}
        {(state.performance?.history || []).filter(h => h.nodeId === step.node?.id).map((h, i) => <section key={i} className="si-coaching"><h3>Stored study-history result</h3><p>{h.correct} / {h.total} · {date(h.at)}</p>{h.missed?.length > 0 && <ArrayList value={h.missed} />}{h.conclusion && <p>Saved conclusion: {h.conclusion}</p>}</section>)}
      </> : !state.loading && <div className="si-empty"><h2>No saved steps or messages</h2><p>This session has no recorded plan content.</p></div>}
    </section></div>
  </main>;
}

export default function StudyPlanInspector() {
  const { chatId } = useParams();
  return chatId ? <PlanReader key={chatId} chatId={chatId} /> : <PlanDirectory />;
}
