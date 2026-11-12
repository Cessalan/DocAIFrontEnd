import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SATAQuestion from '../ChatInerface/SATAQuestion';
import CaseStudyQuestion from '../ChatInerface/CaseStudyQuestion';
import MatrixQuestion from '../StudyMode/MatrixQuestion';
import { clarityEvent } from '../../Services/ClarityService';
import {
  fetchSharedQuiz, flagSharedQuestion, isMyShare, recordSetCompleted, recordSetStarted, saveSharedWalkthrough,
} from '../../Services/QuizShareService';
import { cleanWalkthrough, gradeSet, isRight, readSharedSet } from '../ShareSet/shareSetModel';
import { isUsable } from '../ChatInerface/orderWalkthroughModel';
import SharedMcqCard from './SharedMcqCard';
import SharedSetResult from './SharedSetResult';
import './SharedQuiz.css';

/**
 * /quiz/:shareId — a classmate opens a shared set.
 *
 * The link lands on question 1. No homepage, no upload, no account and no
 * survey stand between a classmate and the first answer; the one sign-up
 * prompt is on the result screen. Mobile matters most here: the link arrives
 * in a group chat, and phones were 157 visitors to 1 finished step
 * (2026-11-10) because the homepage asks a phone for lecture slides.
 *
 * Everything shown comes through readSharedSet, which strips markup: the
 * stored document is client-writable.
 */
export default function PublicQuizView() {
  const { shareId } = useParams();
  const { t } = useTranslation();
  const [status, setStatus] = useState('loading');
  const [set, setSet] = useState(null);
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(false);
  const [flagged, setFlagged] = useState({});
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('publicQuizDarkMode');
      if (saved !== null) return JSON.parse(saved);
    } catch { /* fall through to the system setting */ }
    return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  });
  const mine = useMemo(() => isMyShare(shareId), [shareId]);
  const top = useRef(null);
  const startedRef = useRef(false);
  // Walkthroughs by stored question index: saved ones from the set, plus any
  // generated in this visit. `pending` keeps one request per question even if
  // she retakes the set before the first answer comes back.
  const walkthroughs = useRef({});
  const pending = useRef({});
  const loaders = useRef({});

  useEffect(() => {
    document.body.classList.toggle('dark-mode', dark);
    try { localStorage.setItem('publicQuizDarkMode', JSON.stringify(dark)); } catch { /* private mode */ }
    return () => document.body.classList.remove('dark-mode');
  }, [dark]);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    fetchSharedQuiz(shareId)
      .then((raw) => {
        if (!live) return;
        const read = readSharedSet(raw);
        if (!read) { setStatus('missing'); return; }
        walkthroughs.current = { ...read.walkthroughs };
        setSet(read);
        setStatus('ready');
        document.title = read.topic ? `${read.topic} · NurseQuizAI` : 'NurseQuizAI';
        clarityEvent('shared_quiz_opened', { questions: read.questions.length, mine, named: !!read.senderName });
      })
      .catch(() => live && setStatus('missing'));
    return () => { live = false; };
  }, [shareId, mine]);

  useEffect(() => {
    if (position > 0 || done) top.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [position, done]);

  if (status === 'loading') {
    return <Shell dark={dark} onTheme={setDark}><div className="shared-quiz__loading" role="status" aria-label={t('shareSet.loading')}><span /><span /><span /></div></Shell>;
  }

  if (status === 'missing') {
    return (
      <Shell dark={dark} onTheme={setDark}>
        <div className="shared-card shared-missing">
          <p className="shared-eyebrow">{t('shareSet.missingEyebrow')}</p>
          <h1>{t('shareSet.missingTitle')}</h1>
          <p>{t('shareSet.missingBody')}</p>
          <a className="shared-primary" href="/">{t('shareSet.missingCta')}</a>
        </div>
      </Shell>
    );
  }

  const total = set.questions.length;
  const question = set.questions[position];
  const last = position + 1 === total;

  const record = (answer) => {
    setAnswers((all) => ({ ...all, [position]: answer }));
    if (!startedRef.current) {
      startedRef.current = true;
      if (!mine) recordSetStarted(shareId);
      clarityEvent('shared_quiz_answered', { kind: question.questionType, correct: isRight(answer), mine });
    }
  };

  const next = () => {
    if (!last) { setPosition((at) => at + 1); return; }
    const result = gradeSet(set.questions, answers);
    if (!mine) recordSetCompleted(shareId, result.missedIndices);
    clarityEvent('shared_quiz_completed', { correct: result.correct, total: result.total, mine });
    setDone(true);
  };

  const restart = () => { setAnswers({}); setPosition(0); setDone(false); };

  const flag = () => {
    setFlagged((all) => ({ ...all, [position]: true }));
    flagSharedQuestion(shareId, question.index);
    clarityEvent('shared_question_flagged', { kind: question.questionType });
  };

  if (done) {
    return (
      <Shell dark={dark} onTheme={setDark}>
        <div ref={top} />
        <SharedSetResult set={set} answers={answers} result={gradeSet(set.questions, answers)} onRetry={restart} />
      </Shell>
    );
  }

  // A walkthrough is generated at most once per question per shared set: the
  // first visitor who needs it pays for the model call and it is saved on the
  // set; every visitor after that gets the saved copy (owner, 2026-11-11). A
  // declined or failed request is not saved, so the next visitor can try.
  const loadWalkthrough = (item) => (fetchFresh) => {
    const saved = walkthroughs.current[item.index];
    if (saved) return Promise.resolve(saved);
    if (!pending.current[item.index]) {
      pending.current[item.index] = fetchFresh()
        .then((fresh) => {
          const usable = item.questionType === 'casestudy'
            ? isUsable(fresh, item.correctOrder.length)
            : !!cleanWalkthrough(fresh);
          if (!usable) return fresh;
          clarityEvent('shared_walkthrough_generated', { kind: item.questionType });
          return saveSharedWalkthrough(shareId, item.index, fresh).then(cleanWalkthrough);
        })
        .then((kept) => {
          if (kept) walkthroughs.current[item.index] = kept;
          else delete pending.current[item.index];
          return kept;
        })
        .catch(() => { delete pending.current[item.index]; return null; });
    }
    return pending.current[item.index];
  };

  const cardProps = {
    quiz: question, quizIndex: position, totalQuestions: total, isLastQuestion: last,
    onAnswerSelect: record, onNext: next,
  };
  // One stable loader per question, so the cards' callbacks do not change on
  // every render.
  if (!loaders.current[question.index]) loaders.current[question.index] = loadWalkthrough(question);
  const walkthroughProps = { loadWalkthrough: loaders.current[question.index] };

  return (
    <Shell dark={dark} onTheme={setDark}>
      <div ref={top} className="shared-head">
        <p className="shared-eyebrow">
          {set.senderName ? t('shareSet.fromName', { name: set.senderName }) : t('shareSet.fromClassmate')}
        </p>
        <div className="shared-head__row">
          <h1>{set.topic || t('shareSet.untitled')}</h1>
          <span className="shared-head__count">{position + 1} / {total}</span>
        </div>
        <div className="shared-segments" aria-hidden="true">
          {set.questions.map((item, at) => (
            <span key={item.index} className={
              answers[at] ? (isRight(answers[at]) ? 'is-right' : 'is-missed') : at === position ? 'is-current' : ''
            } />
          ))}
        </div>
      </div>

      <div className={`shared-card shared-card--${question.questionType}`}>
        {question.questionType === 'mcq' && <SharedMcqCard key={position} {...cardProps} previousAnswer={answers[position]} />}
        {question.questionType === 'sata' && <SATAQuestion key={position} {...cardProps} {...walkthroughProps} inModal={false} />}
        {question.questionType === 'casestudy' && <CaseStudyQuestion key={position} {...cardProps} {...walkthroughProps} inModal={false} />}
        {question.questionType === 'matrix' && <MatrixQuestion key={position} {...cardProps} previousAnswer={answers[position]} />}
      </div>

      {answers[position] && (
        <p className="shared-flag">
          {flagged[position]
            ? t('shareSet.flagThanks')
            : <button type="button" onClick={flag}>{t('shareSet.flag')}</button>}
        </p>
      )}
    </Shell>
  );
}

function Shell({ dark, onTheme, children }) {
  const { t } = useTranslation();
  return (
    <div className="shared-quiz">
      <header className="shared-bar">
        <a className="shared-brand" href="/" aria-label="NurseQuizAI">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
          <span>NurseQuizAI</span>
        </a>
        <button type="button" className="shared-theme" onClick={() => onTheme(!dark)} aria-label={dark ? t('shareSet.lightMode') : t('shareSet.darkMode')}>
          {dark
            ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4" /></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>}
        </button>
      </header>
      <main className="shared-main">{children}</main>
    </div>
  );
}
