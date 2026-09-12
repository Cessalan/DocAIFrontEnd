import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import catalog from './catalog.json';
import { experienceFor, guideNotes } from './content';
import { bankFor, coverageTopics, createPlan, dateKey, diagnostic, faqs, grade, pickSet, subjects, unseenCount } from './model';
import { continueSeo, loadSavedProduct, readLocal, trackSeo, writeLocal } from '../../Services/SeoMiniProductService';
import { paperContour } from '../ChatInerface/paperTransition';
import './SeoMiniProduct.css';

function launchRect(node) {
  const box = node?.getBoundingClientRect?.();
  if (box?.width > 0 && box?.height > 0) return { left: box.left, top: box.top, width: box.width, height: box.height };
  const width = typeof window === 'undefined' ? 800 : window.innerWidth;
  const height = typeof window === 'undefined' ? 600 : window.innerHeight;
  return { left: width * 0.3, top: height * 0.28, width: Math.min(280, width * 0.4), height: 56 };
}

function paperStyle(origin) {
  const box = origin || launchRect(null);
  const width = document.documentElement?.clientWidth || window.innerWidth;
  const height = window.innerHeight;
  return {
    '--practice-paper-source': paperContour(box.left, box.left + box.width, box.top, box.top + box.height, box.left, box.left + box.width, 22),
    '--practice-paper-bend': paperContour(0, width, 0, Math.max(box.top + box.height, height * 0.76), box.left, box.left + box.width, 18),
    '--practice-paper-full': paperContour(0, width, 0, height, 0, width, 0)
  };
}

export function MiniIcon({ name = 'book' }) {
  const paths = { calendar: 'M5 5h14v15H5z M8 2v6 M16 2v6 M5 10h14 M9 14h2 M14 14h2 M9 17h2', book: 'M3 4h6q3 0 3 3q0-3 3-3h6v15h-6q-3 0-3 2q0-2-3-2H3z M12 7v14', pulse: 'M2 12h5l3-8 4 16 3-8h5', calculator: 'M5 2h14v20H5z M8 5h8v4H8z M8 13h1 M15 13h1 M8 17h1 M15 17h1', clipboard: 'M8 4H5v17h14V4h-3 M8 2h8v5H8z M8 12h8 M8 16h5', heart: 'M12 21S2 14 2 7c0-5 7-6 10-1c3-5 10-4 10 1c0 7-10 14-10 14z', spark: 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z' };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.book} /></svg>;
}
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function SeoPracticeRoom({ page, origin, pool, dark, onClose }) {
  const root = useRef(null);
  const finished = useRef(false);
  const [opening, setOpening] = useState(true);
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    if (finished.current || closing) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finished.current = true; onClose(); return; }
    setClosing(true);
  }, [closing, onClose]);
  useEffect(() => {
    const node = root.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node?.focus();
    const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    node?.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; node?.removeEventListener('keydown', onKey); };
  }, [close]);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => { if (!finished.current) { finished.current = true; onClose(); } }, 620);
    return () => clearTimeout(timer);
  }, [closing, onClose]);
  return createPortal(
    <section
      ref={root}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={page.title}
      style={paperStyle(origin)}
      className={`seo-mini seo-room ${dark ? 'seo-dark' : ''} ${closing ? 'is-folding' : opening ? 'is-opening' : ''}`}
      onAnimationEnd={event => {
        if (event.target !== event.currentTarget) return;
        if (event.animationName === 'seo-paper-unfold') setOpening(false);
        if (event.animationName === 'seo-paper-fold' && !finished.current) { finished.current = true; onClose(); }
      }}
    >
      <header className="seo-room-header">
        <div>
          <span className="seo-hand">a little practice, right now</span>
          <strong>{page.title}</strong>
        </div>
        <button type="button" className="seo-text-button" onClick={close}>← Back to page</button>
      </header>
      <div className="seo-room-body">
        <Diagnostic page={page} autoStart pool={pool} />
      </div>
    </section>,
    document.body
  );
}

function Metadata({ page }) {
  useEffect(() => {
    const oldTitle = document.title;
    document.title = `${page.title} | NurseQuiz`;
    const changed = [];
    const set = (selector, tag, attrs) => {
      let node = document.head.querySelector(selector);
      const previous = node?.outerHTML;
      if (!node) { node = document.createElement(tag); document.head.appendChild(node); }
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
      changed.push(() => { if (previous) node.outerHTML = previous; else node.remove(); });
    };
    set('meta[name="description"]', 'meta', { name: 'description', content: page.description });
    set('link[rel="canonical"]', 'link', { rel: 'canonical', href: `https://nursequizai.com/${page.slug}` });
    set('meta[property="og:title"]', 'meta', { property: 'og:title', content: page.title });
    set('meta[property="og:description"]', 'meta', { property: 'og:description', content: page.description });
    set('meta[property="og:url"]', 'meta', { property: 'og:url', content: `https://nursequizai.com/${page.slug}` });
    return () => { document.title = oldTitle; changed.reverse().forEach(restore => restore()); };
  }, [page]);
  return null;
}

function ContinueCard({ page, value, topic, track, label, save = false, lead = false }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  async function act() {
    if (status === 'saving') return;
    setStatus('saving'); setError('');
    try {
      const destination = await continueSeo(page, value, { save, topic, track });
      if (destination) navigate(destination); else setStatus('saved');
    } catch (err) { setStatus(''); setError(err.message || 'Could not save. Your result is still here—please try again.'); }
  }
  const toNclex = page.cluster === 'NCLEX' || page.cluster === 'Nursing school';
  const heading = save ? 'Your plan is ready. Keep it with you.'
    : topic && toNclex ? `Open a session on ${topic}.`
    : page.cluster === 'HESI A2' ? 'Keep building your admission skills.'
    : page.cluster === 'Nursing HESI' ? 'Make the next set about your course.'
    : 'Make the next session about you.';
  const body = save ? 'Save it to your NCLEX workspace, see today’s task, and start practicing in the subjects you flagged.'
    : page.cluster === 'Nursing HESI' ? 'Have an upcoming exam? Bring your course material into NurseQuiz for practice on what you are actually studying.'
    : toNclex ? 'Your answers come with you. The first session opens on this weak spot, with new questions written around it.'
    : `Continue with ${topic || 'the concepts you want to review'}, one question at a time.`;
  return <div className={`seo-continue${lead ? ' seo-continue-lead' : ''}`}>
    <div className="seo-continue-copy"><span className="seo-kicker"><MiniIcon name="spark" />{lead ? 'Your next session' : 'Your personalized next step'}</span>{!lead && <span className="seo-hand">take the next little step</span>}<h3>{heading}</h3><p>{body}</p></div>
    <div className="seo-continue-action"><button className="seo-primary" onClick={act} disabled={status === 'saving' || status === 'saved'}>{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved to your account ✓' : label || page.conversion}<span aria-hidden="true">→</span></button>
    <small>{toNclex ? 'Free account. Your workspace tracks readiness by area and format.' : 'Free account needed to save or continue. In-app practice follows your plan’s question allowance.'}</small></div>
    {error && <p role="alert">{error}</p>}
  </div>;
}

function Planner({ page }) {
  const [input, setInput] = useState({ track: 'RN', examDate: '', unscheduled: true, weeks: 4, minutes: 60, weak: [] });
  const [plan, setPlan] = useState(null), [done, setDone] = useState({}), [week, setWeek] = useState(0), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    let live = true;
    const restore = value => { if (!live || !value?.plan?.rows?.length) return; setPlan(value.plan); setDone(value.done || {}); if (value.input) setInput(value.input); };
    restore(readLocal(page.slug));
    if (new URLSearchParams(window.location.search).get('save') === '1') {
      const value = readLocal(page.slug);
      if (value?.plan) continueSeo(page, value, { save: true, automatic: true }).then(url => { if (live && !url) setSaved(true); }).catch(() => live && setError('Your plan is still on this device. Use Save my plan to retry syncing.'));
    } else loadSavedProduct(page.slug).then(value => { if (!readLocal(page.slug)) restore(value); }).catch(() => {});
    return () => { live = false; };
  }, [page]);
  function change(patch) {
    if (!started.current) { started.current = true; trackSeo('seo_mini_product_started', page); }
    setInput(value => ({ ...value, ...patch }));
  }
  function generate(event) {
    event.preventDefault(); setError('');
    try {
      if (!started.current) { started.current = true; trackSeo('seo_mini_product_started', page); }
      const value = createPlan(input);
      setPlan(value); setDone({}); setWeek(0); setSaved(false);
      writeLocal(page.slug, { input, plan: value, done: {} });
      trackSeo('seo_mini_product_completed', page, { durationDays: value.days, examTrack: value.track });
      trackSeo('seo_result_viewed', page);
    } catch (err) { setError(err.message); }
  }
  const options = subjects.map(s => input.track === 'PN' && s === 'Management of care' ? 'Coordinated care' : s);
  return <div className="seo-planner">
    <form className="seo-paper seo-plan-form" onSubmit={generate}>
      <span className="seo-tape" aria-hidden="true" /><div className="seo-panel-heading"><MiniIcon name="calendar" /><div><span className="seo-hand">let’s make room for progress</span><h2>Your time. Your priorities.</h2></div></div>
      <fieldset><legend>Which exam are you taking?</legend><div className="seo-choice-row">{['RN', 'PN'].map(track => <label key={track} className={input.track === track ? 'selected' : ''}><input type="radio" name="exam" value={track} checked={input.track === track} onChange={() => change({ track, weak: [] })} />NCLEX-{track}</label>)}</div></fieldset>
      <fieldset><legend>When is test day?</legend><label className="seo-check"><input type="checkbox" checked={input.unscheduled} onChange={event => change({ unscheduled: event.target.checked })} />Not scheduled yet</label>
        {input.unscheduled ? <div className="seo-choice-row">{[2, 4, 8].map(weeks => <button type="button" key={weeks} aria-pressed={Number(input.weeks) === weeks} onClick={() => change({ weeks })}>{weeks} weeks</button>)}</div> : <label className="seo-field">Exam date<input type="date" required value={input.examDate} min={dateKey(new Date(Date.now() + 86400000))} onChange={e => change({ examDate: e.target.value })} /></label>}
      </fieldset>
      <fieldset><legend>How much time can you protect each day?</legend><div className="seo-choice-row">{[30, 60, 90, 120].map(minutes => <button type="button" key={minutes} aria-pressed={input.minutes === minutes} onClick={() => change({ minutes })}>{minutes} min</button>)}</div></fieldset>
      <fieldset><legend>What would you like more practice with?</legend><p className="seo-small">Pick a few, or leave blank for a balanced start.</p><div className="seo-subjects">{options.map(subject => <label key={subject} className={input.weak.includes(subject) ? 'selected' : ''}><input type="checkbox" checked={input.weak.includes(subject)} onChange={() => change({ weak: input.weak.includes(subject) ? input.weak.filter(s => s !== subject) : [...input.weak, subject] })} />{subject}</label>)}</div></fieldset>
      {error && <p role="alert">{error}</p>}<button type="submit" className="seo-primary">{plan ? 'Update my plan' : 'Build my plan'}<span aria-hidden="true">→</span></button><p className="seo-small">Free to build. No account needed.</p>
    </form>
    <div className="seo-plan-result" aria-live="polite">
      {!plan ? <div className="seo-plan-preview"><span className="seo-hand">less guessing, more direction</span><h2>A plan with a next step.<br />Not another empty calendar.</h2><div className="seo-preview-day"><span>01</span><div><strong>Find your starting point</strong><p>A short practice session, then review what you missed.</p></div></div><div className="seo-preview-day"><span>02</span><div><strong>Give the tricky topics more time</strong><p>Keep broad coverage while revisiting your priorities.</p></div></div><div className="seo-preview-day"><span>03</span><div><strong>Bring it together</strong><p>Mix clinical decisions, select-all questions, and case studies.</p></div></div><p className="seo-small">This is how your plan will be organized. Your dates and tasks appear after you build it.</p></div> : <>
        <div className="seo-result-heading"><span className="seo-hand">one day at a time</span><h2>{plan.days} days{plan.examDate ? ' until NCLEX' : ' of focused review'}</h2><p>NCLEX-{plan.track} · {plan.minutes} minutes a day · {Object.keys(done).filter(k => done[k]).length}/{plan.days} days checked off</p><div className="seo-tags">{plan.priorities.map(s => <span key={s}>{s}</span>)}</div></div>
        <div className="seo-plan-phases" aria-label="Your three study phases"><div><span>01</span><strong>Find your gaps</strong><small>Baseline questions</small></div><div><span>02</span><strong>Build weak areas</strong><small>Focused repetition</small></div><div><span>03</span><strong>Mix decisions</strong><small>Exam-style practice</small></div></div>
        <div className="seo-week-nav"><button disabled={week === 0} onClick={() => setWeek(w => w - 1)} aria-label="Previous week">←</button><strong>Week {week + 1} · {plan.rows[week * 7]?.phase}</strong><button disabled={(week + 1) * 7 >= plan.days} onClick={() => setWeek(w => w + 1)} aria-label="Next week">→</button></div>
        <div className="seo-schedule">{plan.rows.slice(week * 7, week * 7 + 7).map(row => <article key={row.date} className={done[row.date] ? 'is-done' : ''}><label className="seo-day-check"><input type="checkbox" checked={!!done[row.date]} aria-label={`Complete ${formatDate(row.date)}`} onChange={() => { const next = { ...done, [row.date]: !done[row.date] }; setDone(next); setSaved(false); writeLocal(page.slug, { input, plan, done: next }); }} /><span>{formatDate(row.date)}</span></label><div><h3>{row.title}</h3><p>{row.task}</p><PlanPractice page={page} row={row} value={{ input, plan, done }} /></div></article>)}</div>
        <p className="seo-small">Daily question counts are study targets, not a free-question entitlement. Review time is included. This schedule is a starting point, not a readiness prediction.</p>
        {saved && <p role="status">Your plan is saved to your account.</p>}<ContinueCard key={JSON.stringify(done) + plan.createdAt} page={page} value={{ input, plan, done }} save label="Save my plan" />
      </>}
    </div>
  </div>;
}

function PlanPractice({ page, row, value }) {
  const navigate = useNavigate(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <><button className="seo-text-button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const url = await continueSeo(page, value, { topic: row.subject, track: value.plan.track }); if (url) navigate(url); } catch { setError('Could not open practice. Please try again.'); } finally { setBusy(false); } }}>{busy ? 'Opening…' : 'Start this practice'} →</button>{error && <p role="alert">{error}</p>}</>;
}

export function Diagnostic({ page, initialQuestions, compact = false, autoStart = false, pool: forcedPool, onLaunch }) {
  const available = initialQuestions || forcedPool || bankFor(page.slug);
  const sections = [...new Set(available.map(q => q.section))];
  // A fixed list (study-guide recall check) is served as-is; a page bank is
  // sampled per visit so a refresh, or "keep going", brings new questions.
  const size = initialQuestions ? 0 : page.sessionSize || 6;
  const seenKey = `seen:${page.slug}`;
  const [seen, setSeen] = useState(() => (size && readLocal(seenKey)?.ids) || []);
  const [lastSet, setLastSet] = useState(() => (size && readLocal(seenKey)?.lastSet) || []);
  const [chosen, setChosen] = useState(sections);
  const [questions, setQuestions] = useState(() => {
    if (!autoStart) return [];
    if (!size) return [...available];
    return pickSet(available, size, (readLocal(seenKey)?.ids) || []);
  });
  const [position, setPosition] = useState(0), [selected, setSelected] = useState([]), [answers, setAnswers] = useState({}), [finished, setFinished] = useState(false), [retry, setRetry] = useState(false);
  const trackedStart = useRef(false);
  const prompt = useRef(null);
  const q = questions[position];
  const committed = q && Array.isArray(answers[q.id]);
  const result = diagnostic(questions, answers);
  const allCorrect = result.total > 0 && result.correct === result.total;
  const pool = available.filter(item => chosen.includes(item.section));
  const setLength = size ? Math.min(size, pool.length) : pool.length;
  const remaining = size ? unseenCount(pool, seen) : 0;
  useEffect(() => { if (q) prompt.current?.focus({ preventScroll: true }); }, [q]);
  useEffect(() => {
    if (!autoStart || trackedStart.current || !questions.length) return;
    trackedStart.current = true;
    trackSeo('seo_mini_product_started', page, { questionCount: questions.length, via: 'overlay' });
  }, [autoStart, page, questions.length]);
  function start(list, isRetry = false, fresh = false) {
    // "Keep going" serves only unseen questions, even if fewer than a full set,
    // so the button's count is honest. A plain start always fills the set.
    // After the bank is exhausted, pick against the last set so shuffle still
    // prefers the least-recent items — without lying that they are unseen.
    const remainingNow = unseenCount(list, seen);
    const pickSize = fresh && remainingNow > 0 ? Math.min(size, remainingNow) : size;
    const pickSeen = remainingNow === 0 ? lastSet : seen;
    const set = isRetry ? list : pickSet(list, pickSize, pickSeen);
    setQuestions(set); setPosition(0); setSelected([]); setAnswers({}); setFinished(false); setRetry(isRetry);
    trackSeo('seo_mini_product_started', page, { questionCount: set.length, isRetry, fresh });
  }
  function next() {
    if (position + 1 === questions.length) {
      setFinished(true); writeLocal(page.slug, { result, answers, questionIds: questions.map(item => item.id), isRetry: retry });
      if (size && !retry) {
        const currentIds = questions.map(item => item.id);
        const ids = [...new Set([...seen, ...currentIds])];
        setSeen(ids); setLastSet(currentIds); writeLocal(seenKey, { ids, lastSet: currentIds, at: Date.now() });
      }
      trackSeo('seo_mini_product_completed', page, { questionCount: result.total, correct: result.correct, isRetry: retry });
      trackSeo('seo_result_viewed', page, { isRetry: retry });
    } else { setPosition(p => p + 1); setSelected([]); }
  }
  if (!questions.length) return <div className={`seo-paper seo-diagnostic-start ${compact ? 'seo-compact' : ''}`}><span className="seo-tape" aria-hidden="true" /><div className="seo-panel-heading"><MiniIcon name={page.icon} /><div><span className="seo-hand">a small check, a useful next step</span><h2>{compact ? 'Try it from memory' : 'Let’s see where you are.'}</h2></div></div><p>{compact ? 'Reviewing first is part of learning. This is a recall check, not a baseline score.' : `${available.length} original practice questions in this bank. Each visit draws a fresh set of ${setLength}, one at a time, with an explanation after every answer.`}</p>
    {sections.length > 1 && <fieldset><legend>Choose your sections</legend><div className="seo-subjects">{sections.map(section => <label key={section} className={chosen.includes(section) ? 'selected' : ''}><input type="checkbox" checked={chosen.includes(section)} onChange={() => setChosen(list => list.includes(section) ? list.filter(s => s !== section) : [...list, section])} />{section}</label>)}</div></fieldset>}
    <div className="seo-start-footer"><button className="seo-primary" disabled={!chosen.length} onClick={event => onLaunch && !compact ? onLaunch(event.currentTarget, pool) : start(pool)}>Start {compact ? 'recall check' : 'practice'}<span aria-hidden="true">→</span></button><span className="seo-small">No signup · Untimed · {setLength} questions{size > 0 && seen.length > 0 && remaining > 0 ? ` · ${remaining} you haven’t seen yet` : ''}</span></div><p className="seo-small">A starter sample, not a full exam or a validated readiness assessment.</p></div>;
  if (finished) {
    const nextTopic = result.needsWork || result.missed[0] || result.strongest;
    const nextCount = remaining > 0 ? Math.min(setLength, Math.max(remaining, 1)) : 0;
    const takeaway = allCorrect
      ? (compact ? 'This one held after the review. A larger set will tell you if the idea stuck.' : 'This set held. A longer session will tell you if it was a pattern or a lucky pass.')
      : result.needsWork
        ? `Start the next session with ${result.needsWork} while the reasoning is still fresh.`
        : 'A few concepts need another look. Take them into a longer session, not another isolated retry.';
    return <div className="seo-paper seo-results" aria-live="polite">
      <span className="seo-tape" aria-hidden="true" />
      <div className="seo-result-hero">
        <div className="seo-score-ring" style={{ '--score': `${result.percentage * 3.6}deg` }}><div><strong>{result.percentage}%</strong><span>{result.band}</span></div></div>
        <div>
          <span className="seo-hand">one useful takeaway</span>
          <h2>{result.correct}/{result.total} correct{retry ? ' on this retry' : compact ? ' after reviewing' : ' on your first pass'}.</h2>
          <p>{takeaway}</p>
        </div>
      </div>
      {!allCorrect && (result.needsWork || result.missed.length > 0) && <div className="seo-result-next">
        <span className="seo-kicker">Do this next</span>
        <strong>{result.needsWork || result.missed[0]}</strong>
        {result.missed.length > 0 && <div className="seo-tags">{result.missed.slice(0, 3).map(concept => <span key={concept}>{concept}</span>)}</div>}
      </div>}
      <ContinueCard lead page={page} value={{ result, answers, questionIds: questions.map(item => item.id) }} topic={nextTopic} label={allCorrect ? 'Keep building in NurseQuiz' : page.conversion} />
      <div className="seo-result-more">
        {result.missed.length > 0 && <button className="seo-text-button" onClick={() => start(questions.filter(item => !grade(item, answers[item.id])), true)}>Retry missed questions</button>}
        {size > 0 && pool.length > questions.length && <button className="seo-text-button" onClick={() => start(pool, false, true)}>{remaining > 0 ? `Next ${nextCount} questions` : 'Shuffle and go again'}</button>}
        <details className="seo-answer-review">
          <summary>Review answers{result.areas.length > 1 ? ' and section scores' : ''}</summary>
          {result.areas.length > 1 && <div className="seo-score-areas">{result.areas.map(area => <div key={area.section}><span>{area.section}</span><strong>{area.correct}/{area.total}</strong><div className="seo-meter"><span style={{ width: `${area.correct / area.total * 100}%` }} /></div></div>)}</div>}
          {questions.map(item => <div key={item.id}><h3>{item.stem}</h3><p><strong>Your answer:</strong> {(answers[item.id] || []).map(i => item.options[i]).join('; ')}</p><p><strong>Expected:</strong> {item.answer.map(i => item.options[i]).join('; ')}</p><p>{item.why}</p></div>)}
        </details>
      </div>
    </div>;
  }
  const correct = committed && grade(q, answers[q.id]);
  return <div className="seo-paper seo-question-card"><div className="seo-question-meta"><span>{q.section} · {q.type === 'sata' ? 'Select all that apply' : 'Choose one answer'}</span><span>{position + 1} / {questions.length}</span></div><div className="seo-meter" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={Object.keys(answers).length}><span style={{ width: `${Object.keys(answers).length / questions.length * 100}%` }} /></div><h2 ref={prompt} tabIndex={-1}>{q.stem}</h2>
    <fieldset disabled={committed}><legend className="seo-sr-only">Your answer</legend>{q.options.map((option, i) => <label className={`seo-answer ${selected.includes(i) ? 'selected' : ''} ${committed && q.answer.includes(i) ? 'correct' : ''} ${committed && selected.includes(i) && !q.answer.includes(i) ? 'incorrect' : ''}`} key={option}><input type={q.type === 'sata' ? 'checkbox' : 'radio'} name={`answer-${q.id}`} checked={selected.includes(i)} onChange={() => setSelected(list => q.type === 'sata' ? list.includes(i) ? list.filter(x => x !== i) : [...list, i] : [i])} /><span className="seo-answer-letter">{String.fromCharCode(65 + i)}</span><span>{option}</span>{committed && q.answer.includes(i) && <span className="seo-answer-mark" aria-hidden="true">✓</span>}{committed && selected.includes(i) && !q.answer.includes(i) && <span className="seo-answer-mark" aria-hidden="true">×</span>}</label>)}</fieldset>
    {!committed ? <button className="seo-primary" disabled={!selected.length} onClick={() => setAnswers(value => ({ ...value, [q.id]: [...selected] }))}>Check my answer →</button> : <div className={`seo-rationale ${correct ? 'is-correct' : ''}`} role="status"><span className="seo-rationale-label">{correct ? 'Correct reasoning' : 'Review the decision'}</span><strong>{correct ? 'That’s right.' : 'Not quite—here’s the idea.'}</strong><p>{q.why}</p>{q.type === 'sata' && <p className="seo-small">This check counts a question as correct only when all correct choices—and no others—are selected.</p>}<div className="seo-rationale-footer"><a href={catalog.sources[q.source].url} target="_blank" rel="noreferrer">{catalog.sources[q.source].label} ↗</a><button className="seo-primary" onClick={next}>{position + 1 === questions.length ? 'See my takeaways' : 'Next question'} →</button></div></div>}
  </div>;
}

function StudyGuide({ page }) {
  const questions = bankFor(page.slug);
  const [active, setActive] = useState(questions[0].id), [testing, setTesting] = useState(false);
  const q = questions.find(item => item.id === active);
  const note = guideNotes[q.id];
  return <div className="seo-guide"><nav className="seo-paper seo-topic-map" aria-label="Study guide topics"><span className="seo-hand">your review notebook</span>{[...new Set(questions.map(item => item.section))].map(section => <div key={section}><h2>{section}</h2>{questions.filter(item => item.section === section).map(item => <button key={item.id} aria-pressed={active === item.id} onClick={() => { setActive(item.id); setTesting(false); trackSeo('seo_guide_topic_viewed', page, { topicId: item.id }); }}>{item.concept}<span aria-hidden="true">↗</span></button>)}</div>)}</nav><div><div className="seo-paper seo-guide-note"><span className="seo-tape" aria-hidden="true" /><span className="seo-kicker">{q.section} · Quick review</span><h2>{q.concept}</h2><p className="seo-guide-summary">{note?.summary || q.why}</p>{note?.points && <div className="seo-key-points"><span>Keep these three ideas</span>{note.points.map((point, index) => <div key={point}><b>{String(index + 1).padStart(2, '0')}</b><p>{point}</p></div>)}</div>}<div className="seo-common-trap"><MiniIcon name="spark" /><div><strong>Common trap</strong><p>{note?.trap || 'Recognizing the wording without being able to apply the idea.'}</p></div></div><div className="seo-guide-actions"><a href={catalog.sources[q.source].url} target="_blank" rel="noreferrer">Explore the reference ↗</a><button className="seo-primary" onClick={() => { setTesting(true); trackSeo('seo_guide_test_clicked', page, { topicId: q.id }); }}>Close the notes & test me →</button></div></div>{testing && <Diagnostic key={q.id} page={page} initialQuestions={[q]} compact />}</div></div>;
}

function ExperienceSection({ page, experience }) {
  return <section className="seo-experience"><div className="seo-section-heading"><span className="seo-kicker">{experience.label}</span><h2>{experience.title}</h2><p>{experience.lede}</p></div><div className="seo-experience-grid">{experience.cards.map(([eyebrow, title, body]) => <article key={title}><span>{eyebrow}</span><h3>{title}</h3><p>{body}</p></article>)}</div>{page.kind === 'planner' && <div className="seo-duration-guide"><div><strong>2 weeks</strong><span>Focused triage</span><p>Prioritize weak areas and mixed practice when time is tight.</p></div><div><strong>4 weeks</strong><span>Balanced repetition</span><p>Revisit missed concepts while maintaining broad exam coverage.</p></div><div><strong>8 weeks</strong><span>More spacing</span><p>Build in recovery days and repeat difficult topics over time.</p></div></div>}</section>;
}

export default function SeoMiniProduct({ slug }) {
  const page = catalog.pages.find(p => p.slug === slug);
  const [dark, setDark] = useState(false);
  const [room, setRoom] = useState(null);
  const seen = useRef(false);
  useEffect(() => {
    let preferred = document.body.classList.contains('dark-mode');
    try { const saved = localStorage.getItem('darkMode'); if (saved !== null) preferred = saved === 'true'; } catch {}
    setDark(preferred);
    if (!seen.current) { seen.current = true; trackSeo('seo_page_viewed', page); }
    setRoom(null);
  }, [page]);
  function openQuiz(node, pool) {
    trackSeo('seo_primary_cta_clicked', page, { destination: 'quiz' });
    setRoom({ origin: launchRect(node), pool: pool || null });
  }
  function primary(event) {
    if (page.kind === 'diagnostic') { openQuiz(event.currentTarget); return; }
    trackSeo('seo_primary_cta_clicked', page);
    document.getElementById('mini-product')?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  const related = catalog.pages.filter(p => p.slug !== slug).sort((a, b) => Number(b.cluster === page.cluster) - Number(a.cluster === page.cluster)).slice(0, 4);
  const faq = faqs(page);
  const experience = experienceFor(page);
  const schema = { '@context': 'https://schema.org', '@type': 'WebPage', name: page.title, description: page.description, url: `https://nursequizai.com/${slug}`, publisher: { '@type': 'Organization', name: 'NurseQuiz', url: 'https://nursequizai.com' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'NurseQuiz', item: 'https://nursequizai.com' }, { '@type': 'ListItem', position: 2, name: page.title, item: `https://nursequizai.com/${slug}` }] } };
  return <div className={`seo-mini ${dark ? 'seo-dark' : ''}`}><Metadata page={page} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} /><a className="seo-skip" href="#mini-product">Skip to practice</a>
    <nav className="seo-nav" aria-label="Main navigation"><Link className="seo-brand" to="/"><img src="/seo-heart.svg" alt="" />NurseQuiz<span>AI</span></Link><div><Link to="/nclex-study-plan">Study planner</Link><Link to="/hesi-a2-practice-test">HESI A2</Link><button className="seo-theme-toggle" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => { setDark(value => !value); document.body.classList.toggle('dark-mode', !dark); try { localStorage.setItem('darkMode', String(!dark)); } catch {} }}><MiniIcon name="spark" /></button><Link className="seo-nav-login" to="/login">Log in →</Link></div></nav>
    <main><header className="seo-hero"><div className="seo-hero-glow" aria-hidden="true" /><div className="seo-kicker"><MiniIcon name={page.icon} />{page.cluster} · Free study tools</div><span className="seo-hand">a little direction goes a long way</span><h1>{page.title}</h1><p>{page.subtitle}</p><button className="seo-primary" onClick={primary}>{page.cta}<span aria-hidden="true">→</span></button><div className="seo-hero-details"><span>✓ No account to begin</span><span>✓ Explanations included</span><span>✓ A personalized next step</span></div><div className="seo-hero-metrics">{experience.metrics.map(([value, label]) => <div key={value}><strong>{value}</strong><span>{label}</span></div>)}</div></header>
      <section id="mini-product" className="seo-product" aria-label={page.title}><div className="seo-product-topline"><span>{page.kind === 'planner' ? '01 · Tell us what you need' : page.kind === 'guide' ? '01 · Choose a topic' : '01 · Choose your focus'}</span><i /><span>{page.kind === 'planner' ? '02 · Get your schedule' : page.kind === 'guide' ? '02 · Review the idea' : '02 · Answer one at a time'}</span><i /><span>{page.kind === 'planner' ? '03 · Start today' : '03 · See what to review'}</span></div>{page.kind === 'planner' ? <Planner page={page} /> : page.kind === 'guide' ? <StudyGuide page={page} /> : <div className="seo-practice-layout"><Diagnostic page={page} onLaunch={openQuiz} /><aside className="seo-margin-note"><MiniIcon name="book" /><span className="seo-hand">make the mistake here.</span><h2>Then understand why.</h2><p>Choose an answer. Read the reasoning. Leave with a specific idea to review.</p><ol><li>Try it without your notes.</li><li>Notice what led you to your choice.</li><li>Practice the concept you missed.</li></ol><p className="seo-small">Original learning questions. No recalled exam content. {page.cluster === 'HESI A2' ? 'Check your school’s required sections.' : 'Educational practice, not clinical instructions.'}</p></aside></div>}</section>
      {page.kind !== 'planner' && <section className="seo-coverage"><div className="seo-section-heading"><span className="seo-hand">inside this practice notebook</span><h2>What you’ll work through.</h2><p>{page.kind === 'guide' ? 'A focused sample across the concepts below.' : `Every visit draws a fresh set of ${page.sessionSize || 6} from the ${bankFor(page.slug).length} questions in this bank, so a refresh never repeats the same run.`} Question wording stays inside the practice so your first answer is genuinely yours.</p></div><div>{coverageTopics(bankFor(page.slug)).map((item, index) => <article key={`${item.section}-${item.concept}`}><b>{String(index + 1).padStart(2, '0')}</b><span>{item.section}</span><h3>{item.concept}</h3><p>{item.type === 'sata' ? 'Select-all reasoning' : item.section === 'Dosage calculations' ? 'Calculation setup' : 'Applied recall'} · rationale included</p></article>)}</div></section>}
      <ExperienceSection page={page} experience={experience} />
      <section className="seo-support"><div><span className="seo-hand">a few things worth knowing</span><h2>{page.kind === 'planner' ? 'A schedule that leaves room to learn.' : page.kind === 'guide' ? 'Review is the beginning. Recall makes it useful.' : 'A score is a starting point.'}</h2></div><div><p>{page.kind === 'planner' ? 'Your plan balances priority topics with broader review, then brings them together in mixed practice. Check off each day and update the plan if your date or available time changes.' : page.cluster === 'HESI A2' ? 'Admission requirements differ by school. Use this starter alongside the sections your program asks for; it does not cover every possible HESI A2 subject.' : 'A handful of questions cannot tell you whether you will pass. It can show a missed calculation step, an unsafe assumption, or a concept worth revisiting.'}</p><p>{page.kind === 'planner' ? 'A two-week plan is a focused review window. Four weeks allows more repetition. Eight weeks gives more space between revisits. Choose the horizon you can sustain.' : 'Treat a correct guess differently from an answer you can explain. When you retry, check that you understand the reasoning rather than remembering the letter.'}</p><a href={page.cluster === 'HESI A2' || page.cluster === 'Nursing HESI' ? catalog.sources.hesi.url : catalog.sources.nclex.url} target="_blank" rel="noreferrer">Read the official exam guidance ↗</a></div></section>
      <section className="seo-faq"><span className="seo-hand">before you go</span><h2>A few good questions.</h2>{faq.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</section>
      <section className="seo-related"><div className="seo-related-title"><h2>Keep your momentum.</h2><span className="seo-hand">a few pages for your next study break</span></div><div>{related.map(item => <Link to={`/${item.slug}`} key={item.slug}><MiniIcon name={item.icon} /><span>{item.cluster}</span><h3>{item.title}</h3><span aria-hidden="true">↗</span></Link>)}</div></section>
    </main><footer className="seo-footer"><Link className="seo-brand" to="/">NurseQuiz<span>AI</span></Link><p>Little steps. Clearer thinking.</p><small>Independent study tools. Not affiliated with NCSBN or Elsevier. NCLEX and HESI are their respective owners’ trademarks.</small><div><Link to="/nclex-question-generator">Practice from your notes</Link><Link to="/hesi-practice-questions">Nursing HESI practice</Link><Link to="/hesi-a2-study-guide">HESI A2 study guide</Link></div></footer>
    {room && <SeoPracticeRoom page={page} origin={room.origin} pool={room.pool} dark={dark} onClose={() => setRoom(null)} />}
  </div>;
}
