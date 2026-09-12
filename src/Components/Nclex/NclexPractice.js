import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import DrillQuestion from '../ExamDrill/DrillQuestion';
import NclexMcq from './NclexMcq';
import NclexShell from './NclexShell';
import { nextSpec, sessionLength } from './nclexSpec';
import { buildProfile, formatRows } from './nclexProfile';
import { nextAction } from './nclexVerdict';
import { handoffContext } from './nclexHandoff';
import { FORMAT_LABELS, findCategory } from './nclexCurriculum';
import { generate_exam } from '../../Services/FastAPICalls';
import {
  logAttempt,
  loadAttempts,
  loadMeta,
  saveMeta,
  daysUntil,
  saveSession,
  loadSession,
  clearSession,
} from '../../Services/NclexService';
import { devLog, devWarn } from '../../Services/devLogger';
import './Nclex.css';

/**
 * NclexPractice — one session of questions.
 *
 * WHERE THE QUESTIONS COME FROM
 * ─────────────────────────────
 * `/study/generate-exam` already handles the no-documents case: it sets
 * `source = "scratch"` when a session has no vectorstore and generates from
 * the topic and instructions alone. That is exactly this product's situation
 * — she has graduated and has nothing to upload — so no new backend endpoint
 * is needed to make this work.
 *
 * The chat id is a stable per-user pseudo-id (`nclex-{uid}`). The backend
 * keys its own quota on it, so it must be stable, and it must not collide
 * with a real chat.
 *
 * ONE AHEAD, NOT A BATCH
 * ──────────────────────
 * Generation for question n+1 starts the moment she answers n — never
 * earlier. That ordering is the whole of the adaptivity: the spec for n+1
 * has to see the answer to n, and a batch of ten generated up front cannot
 * adapt at all, which would make "adaptive" a claim rather than a behaviour.
 *
 * Exactly one question is held in reserve. Two would mean generating n+2
 * before n+1 is answered, which is the batch problem again in miniature.
 *
 * WHO RENDERS THE QUESTION
 * ────────────────────────
 * Multiple choice goes to NclexMcq — select, reflect, then commit, so she
 * can change her mind and say how sure she is before answering. SATA and
 * case study go to the drill's DrillQuestion, which owns NCLEX partial-credit
 * scoring; forking those would fork the grading rules that every format
 * bucket in the profile depends on.
 *
 * Confidence is therefore captured on multiple choice only today. That is a
 * real limit on the data, not just the UI: any read of the confidence signal
 * has to be per format rather than across the whole log.
 */
const NclexPractice = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { currentUser } = useAuth() || {};
  const { requireQuota, consume } = useUsageLimit() || {};

  const mode = params.get('mode') || 'practice';
  const total = sessionLength(params.get('count'), mode);
  const fixed = useMemo(
    () => ({
      mode,
      subject: params.get('subject') || null,
      area: params.get('area') || null,
      category: params.get('category') || null,
      format: params.get('format') || null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params]
  );

  const [history, setHistory] = useState([]);      // attempts logged this session
  const [priorAttempts, setPriorAttempts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [question, setQuestion] = useState(null);
  const [spec, setSpec] = useState(null);
  const [answered, setAnswered] = useState(null);
  /* Index of the question ON SCREEN — not derived from history.length.
     SATAQuestion resets its selection whenever `quizIndex` changes
     (SATAQuestion.js:261, and it keys a remount on it at :421); CaseStudy
     does the same via `${quiz.question}-${quizIndex}`. Deriving the position
     from history.length changed it at the exact moment she submitted, which
     wiped her answer and made both formats need a second submit. */
  const [qIndex, setQIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const askedAt = useRef(Date.now());
  const startedRef = useRef(false);

  /* Mirrors of render state. A prefetch landing is not a re-render, so the
     resume point has to be computable outside one. */
  const questionRef = useRef(null);
  const specRef = useRef(null);
  const answeredRef = useRef(null);
  const qIndexRef = useRef(0);
  const historyRef = useRef([]);
  questionRef.current = question;
  specRef.current = spec;
  answeredRef.current = answered;
  qIndexRef.current = qIndex;
  historyRef.current = history;

  const chatId = currentUser?.uid ? `nclex-${currentUser.uid}` : null;

  // Profile from everything she has ever answered, plus this session so far —
  // so difficulty and category choice keep adapting inside the session.
  const profile = useMemo(
    () => buildProfile([...priorAttempts, ...history]),
    [priorAttempts, history]
  );

  /* What she arrived with from a landing page, reduced to what is still
     worth telling the generator. A ref, because the first spec is built
     inside the session effect before `meta` has rendered. The reduction is
     re-run against the WORKING profile on every spec so a concept drops out
     the moment the log has enough of its own evidence on it. */
  const metaRef = useRef(null);
  metaRef.current = meta;
  const contextFor = useCallback(
    (workingProfile) =>
      handoffContext(
        metaRef.current?.seoContext || null,
        workingProfile,
        Date.now(),
        daysUntil(metaRef.current?.examDate)
      ),
    []
  );

  /* One fetch, no state. Takes a spec so the caller owns the decision of
     WHAT to ask for; returns { question, spec } or null. */
  const fetchQuestion = useCallback(
    async (spec_) => {
      if (!chatId || !spec_) return null;
      try {
        const result = await generate_exam(
          chatId,
          spec_.topic,
          [spec_.format],
          1,
          spec_.instructions,
          i18n.language || 'en'
        );
        const q = result?.questions?.[0];
        if (!q) return null;
        return {
          question: { ...q, questionType: q.questionType || spec_.format },
          spec: spec_,
        };
      } catch (err) {
        devWarn('[nclex] generation failed', err);
        return null;
      }
    },
    [chatId, i18n.language]
  );

  /* Put a question on screen and start her clock.
     `consume` fires HERE rather than on arrival: a prefetched question can be
     generated and never seen (she leaves, or the session ends), and charging
     her free quota for a question she was never shown would be a quiet leak.
     The unit is questions served, not questions generated. */
  const present = useCallback(
    ({ question: q, spec: s }, index, charge = true) => {
      setQIndex(index);
      setSpec(s);
      setQuestion(q);
      setAnswered(null);
      setError(null);
      setLoading(false);
      askedAt.current = Date.now();
      /* Not charged on resume: this question was already served and already
         counted the first time she saw it. Charging again would bill her free
         quota twice for one question because she closed a tab. */
      if (charge) consume?.(1);
    },
    [consume]
  );

  const generate = useCallback(
    async (index, workingProfile) => {
      if (!chatId) return;
      const s = nextSpec(workingProfile, index, fixed, contextFor(workingProfile));
      setLoading(true);
      setError(null);
      setAnswered(null);
      setSpec(s);

      const got = await fetchQuestion(s);
      if (!got) {
        setError(t('nclex.genFailed', "That question didn't come through. Try again."));
        setLoading(false);
        return;
      }
      present(got, index);
    },
    [chatId, fixed, fetchQuestion, present, t, contextFor]
  );

  /* ── Prefetch ────────────────────────────────────────────────────────
     The next question starts generating the moment the CURRENT one is put on
     screen — not when she answers it. Answer-time was still too late: a
     student who reads the rationale in four seconds, or skips it, was left
     waiting on a fresh LLM call every time.

     THE TRADE, AND WHY IT IS SAFE HERE
     ──────────────────────────────────
     Generating n+1 before n is answered means its spec was chosen without
     seeing that answer, and the spec is where the adaptivity lives. In
     practice almost none of it moves on a single answer:

       format      `formatForIndex(n)` is a fixed index-based rotation and
                   does not consult the profile at all.
       category    ranked over the whole history by exam risk; one answer
                   rarely reorders the top three.
       difficulty  needs MIN_FOR_VERDICT answers in that category and bands
                   at 50% / 85%; one answer rarely crosses a band.

     So rather than take the trade on faith, `ensurePrefetch` RE-CHECKS on
     answer: it recomputes the spec against the profile that now includes her
     answer, and if the category, format, area or difficulty actually changed,
     it throws the speculative question away and fetches the right one. The
     common case is instant; the rare case degrades to exactly the behaviour
     we had before. It is never wrong, only sometimes wasteful.

     `prefetchSeq` guards a superseded fetch landing after the one that
     replaced it, and the session key guards one landing in a later session. */
  /* syncSession is defined below ensurePrefetch and used inside it; the ref
     breaks the cycle without reordering the file. */
  const syncSessionRef = useRef(null);

  const prefetched = useRef(null);   // { index, spec, question }
  const prefetching = useRef(null);  // { index, spec, seq }
  const prefetchSeq = useRef(0);

  /** Two specs ask for the same thing. `topic`/`instructions` derive from
      these four, so comparing them compares the whole request. */
  const sameSpec = (x, y) =>
    !!x && !!y &&
    x.category === y.category &&
    x.format === y.format &&
    x.area === y.area &&
    x.difficulty === y.difficulty;

  const ensurePrefetch = useCallback(
    (index, workingProfile, key) => {
      if (index >= total) return;              // nothing after the last question
      const want = nextSpec(workingProfile, index, fixed, contextFor(workingProfile));

      // Already have exactly this, or already fetching exactly this.
      if (prefetched.current?.index === index && sameSpec(prefetched.current.spec, want)) return;
      if (prefetching.current?.index === index && sameSpec(prefetching.current.spec, want)) return;

      // Anything else held for this slot was speculated wrong — drop it.
      if (prefetched.current?.index === index) prefetched.current = null;

      const seq = (prefetchSeq.current += 1);
      /* The promise is kept so `handleNext` can await a fetch that is already
         running instead of firing a second call for the same slot. */
      const promise = (async () => {
        const got = await fetchQuestion(want);
        if (startedRef.current !== key) return;      // session moved on
        if (prefetchSeq.current !== seq) return;     // superseded by a newer one
        prefetching.current = null;
        if (got) {
          prefetched.current = { index, ...got };
          // A landing prefetch moves the resume point but triggers no render.
          if (answeredRef.current) syncSessionRef.current?.();
        }
      })();
      prefetching.current = { index, spec: want, seq, promise };
    },
    [fetchQuestion, fixed, total, contextFor]
  );

  /* Where she would come back to. Unanswered: the question on screen.
     Answered: whatever is queued behind it — so returning never re-serves a
     question she has already dealt with. */
  const syncSession = useCallback(() => {
    if (!currentUser?.uid) return;
    const next = answeredRef.current
      ? prefetched.current
      : questionRef.current && {
          index: qIndexRef.current,
          question: questionRef.current,
          spec: specRef.current,
        };
    saveSession(currentUser.uid, {
      key: startedRef.current,
      total,
      history: historyRef.current,
      next: next
        ? { index: next.index, question: next.question, spec: next.spec }
        : null,
    });
  }, [currentUser, total]);

  syncSessionRef.current = syncSession;

  useEffect(() => {
    if (!question || done) return;
    syncSession();
  }, [question, answered, history, done, syncSession]);

  /* Kick it off as soon as a question is on screen. A ref for the profile so
     this fires once per question rather than on every profile identity
     change; `qIndex` is the guard because it is stable for the lifetime of
     the question being shown. */
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const displayPrefetchedFor = useRef(-1);

  useEffect(() => {
    if (!question || loading) return;
    if (displayPrefetchedFor.current === qIndex) return;
    displayPrefetchedFor.current = qIndex;
    ensurePrefetch(qIndex + 1, profileRef.current, startedRef.current);
  }, [question, qIndex, loading, ensurePrefetch]);

  /* Open (or re-open) the session.
   *
   * Keyed on the query string rather than on mount, so finishing a session
   * and starting the recommended follow-up — which is a navigate() to the
   * same route with different params, and therefore does NOT remount —
   * resets the session properly instead of resuming the finished one. */
  const sessionKey = params.toString();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser?.uid) return;
      if (startedRef.current === sessionKey) return;
      startedRef.current = sessionKey;

      setHistory([]);
      setDone(false);
      setQuestion(null);
      setAnswered(null);
      setQIndex(0);
      setLoading(true);
      prefetched.current = null;
      prefetching.current = null;
      displayPrefetchedFor.current = -1;

      const [rows, m, saved] = await Promise.all([
        loadAttempts(currentUser.uid),
        loadMeta(currentUser.uid),
        loadSession(currentUser.uid),
      ]);
      if (cancelled) return;
      setPriorAttempts(rows);
      setMeta(m);
      metaRef.current = m; // generate(0) below runs before the state renders

      /* Resume, if she left one exactly like this behind. Matching on the
         query string means a saved pharmacology session is never resumed
         into a mental-health one — it is simply replaced. */
      const resumable =
        saved &&
        saved.key === sessionKey &&
        saved.next?.question &&
        (saved.history?.length || 0) < total;

      if (resumable) {
        setHistory(saved.history || []);
        devLog('[nclex] resumed at', saved.next.index, 'of', total);
        // Already generated and already charged when she first saw it.
        present({ question: saved.next.question, spec: saved.next.spec }, saved.next.index, false);
        return;
      }

      if (requireQuota && !requireQuota({ topic: 'NCLEX practice' })) {
        setLoading(false);
        setError(t('nclex.quota', 'You have used your free questions for now.'));
        return;
      }
      generate(0, buildProfile(rows));
    })();
    return () => { cancelled = true; };
  }, [currentUser, generate, present, requireQuota, t, sessionKey, total]);

  const handleAnswer = useCallback(
    async (data) => {
      setAnswered(data);
      const seconds = Math.round((Date.now() - askedAt.current) / 1000);

      const attempt = {
        subject: spec?.subject || null,
        area: spec?.area || null,
        category: spec?.category || null,
        // The generator is asked to name the concept; if it did not, we store
        // nothing rather than falling back to the question text. A coarse key
        // merges unrelated questions into one bucket and the profile then
        // reports a misconception as resolved on unrelated evidence.
        concept: question?.concept || question?.conceptLabel || null,
        skills: Array.isArray(question?.skills) ? question.skills : [],
        format: data.format || spec?.format || 'mcq',
        difficulty: spec?.difficulty ?? null,
        correct: !!data.isCorrect,
        partialScore:
          data.maxScore > 0 && !data.isCorrect ? (data.score || 0) / data.maxScore : 0,
        // Optional, and only offered on multiple choice today — SATA and
        // case study submit themselves through the shared components. Any
        // analysis of confidence must therefore be read per format, not
        // across the whole log.
        confidence: data.confidence ?? null,
        questionId: question?.id || null,
      };

      const nextHistory = [...history, attempt];
      setHistory(nextHistory);
      if (currentUser?.uid) logAttempt(currentUser.uid, attempt);
      devLog('[nclex] answered', attempt.format, attempt.correct, `${seconds}s`);

      // Re-check the speculative question against a profile that now includes
      // the answer she just gave. Keeps it if the request is unchanged (the
      // common case), replaces it if her answer actually moved the plan.
      ensurePrefetch(
        nextHistory.length,
        buildProfile([...priorAttempts, ...nextHistory]),
        startedRef.current
      );
    },
    [spec, question, currentUser, history, priorAttempts, ensurePrefetch]
  );

  const handleNext = useCallback(async () => {
    const answeredCount = history.length;
    if (answeredCount >= total) {
      setDone(true);
      if (currentUser?.uid) clearSession(currentUser.uid);
      return;
    }
    if (requireQuota && !requireQuota({ topic: 'NCLEX practice' })) {
      setDone(true);
      if (currentUser?.uid) clearSession(currentUser.uid);
      return;
    }

    // The happy path: already written, so there is no loading state at all.
    const ready = prefetched.current;
    if (ready && ready.index === answeredCount) {
      prefetched.current = null;
      present(ready, answeredCount);
      return;
    }

    // Started but not landed — wait on the call already running rather than
    // firing a second one for the same slot.
    const inflight = prefetching.current;
    if (inflight && inflight.index === answeredCount && inflight.promise) {
      setLoading(true);
      setAnswered(null);
      await inflight.promise;
      const landed = prefetched.current;
      if (landed && landed.index === answeredCount) {
        prefetched.current = null;
        present(landed, answeredCount);
        return;
      }
    }

    // Nothing usable — fetch on demand, as before.
    generate(answeredCount, profile);
  }, [history.length, total, generate, present, profile, requireQuota, currentUser]);

  const handleSaveExamDate = useCallback(
    async (date) => {
      setMeta((m) => ({ ...(m || {}), examDate: date }));
      if (currentUser?.uid) await saveMeta(currentUser.uid, { examDate: date });
    },
    [currentUser]
  );

  const shellProps = {
    examDate: meta?.examDate || null,
    daysLeft: daysUntil(meta?.examDate),
    onSaveExamDate: handleSaveExamDate,
  };

  /* ── Session readout ─────────────────────────────────────────────── */
  if (done || (history.length >= total && answered === null)) {
    const sessionProfile = buildProfile(history);
    const correct = history.filter((h) => h.correct).length;
    const partial = history.filter((h) => !h.correct && h.partialScore > 0).length;
    const action = nextAction(profile);
    const confidentMisses = history.filter(
      (h) => !h.correct && h.confidence === 'very_sure'
    ).length;

    const pct = history.length ? Math.round((correct / history.length) * 100) : 0;
    const missedConcepts = [
      ...new Set(history.filter((h) => !h.correct && h.concept).map((h) => h.concept)),
    ].slice(0, 4);

    return (
      <NclexShell {...shellProps}>
        <div className="nq-hero">
          <div className="nq-hero-glow" aria-hidden="true" />
          <span className="nq-hand">{t('nclex.sessionHand', 'pencils down')}</span>
          <section className="nq-verdict">
            <span className="nq-tape" aria-hidden="true" />
            <p className="nq-eyebrow">{t('nclex.sessionDone', 'Session complete')}</p>
            <div className="nq-verdict-body">
              <div className="nq-verdict-main">
                <h1 className="nq-verdict-headline">
                  {correct}/{history.length} {t('nclex.correctLower', 'correct')}
                  {partial > 0 && (
                    <>
                      {' · '}
                      {t('nclex.partialCount', '{{n}} partly right', { count: partial, n: partial })}
                    </>
                  )}
                </h1>
                <p className="nq-verdict-detail">
                  {confidentMisses > 0
                    ? t(
                        'nclex.confidentMiss',
                        'You were sure about {{n}} of the ones you missed. Those are the ones that cost people the exam — you do not go back and review what you think you know.',
                        { n: confidentMisses }
                      )
                    : t(
                        'nclex.sessionNote',
                        'Everything here is folded into your readiness picture.'
                      )}
                </p>
                {missedConcepts.length > 0 && (
                  <div className="nq-arrival-missed" style={{ marginTop: 18, marginBottom: 0 }}>
                    <span className="nq-arrival-label">
                      {t('nclex.missedThisSession', 'Missed this session')}
                    </span>
                    <div className="nq-arrival-tags">
                      {missedConcepts.map((c, i) => (
                        <span key={c}>
                          <b>{String(i + 1).padStart(2, '0')}</b>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="nq-readiness">
                <div
                  className="nq-ring"
                  style={{ '--score': `${pct * 3.6}deg` }}
                  role="img"
                  aria-label={`${pct}% ${t('nclex.correctLower', 'correct')}`}
                >
                  <div>
                    <strong>{pct}%</strong>
                    <span>{t('nclex.thisSessionShort', 'this session')}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="nq-section">
          <div className="nq-section-head">
            <div>
              <span className="nq-hand">{t('nclex.byFormatHand', 'where the exam is hardest')}</span>
              <h2 className="nq-h2">{t('nclex.thisSession', 'This session, by format')}</h2>
            </div>
          </div>
          <div className="nq-formats">
            {formatRows(sessionProfile)
              .filter((f) => f.total > 0)
              .map((f) => (
                <div className="nq-format" key={f.key}>
                  <span className="nq-format-name">{FORMAT_LABELS[f.key]}</span>
                  <span className="nq-format-num">
                    {f.correct}/{f.total}
                  </span>
                  <span className="nq-format-meta">
                    {f.partial > 0
                      ? `${f.partial} ${t('nclex.partial', 'partial')}`
                      : `${Math.round(f.accuracy * 100)}%`}
                  </span>
                </div>
              ))}
          </div>
        </section>

        <span className="nq-next-note">{t('nclex.doThisNext', 'do this next →')}</span>
        <button
          type="button"
          className="nq-action"
          onClick={() => {
            const next = new URLSearchParams(
              Object.entries(action).filter(
                ([k, v]) => ['subject', 'category', 'format', 'count'].includes(k) && v != null
              )
            );
            // A nonce so that "practice the same thing again" still changes
            // the session key and therefore still starts a new session.
            next.set('s', String(Date.now()));
            const qs = next.toString();
            // The session effect is keyed on the query string, so this
            // navigate() alone re-opens the session — no reload needed.
            navigate(`/nclex/practice${qs ? `?${qs}` : ''}`);
          }}
        >
          <span>
            <span className="nq-action-label">{action.label}</span>
            <span className="nq-action-sub">{action.sublabel}</span>
          </span>
          <span className="nq-action-arrow" aria-hidden="true">→</span>
        </button>

        <button type="button" className="nq-back" onClick={() => navigate('/nclex')}>
          ← {t('nclex.backHome', 'Back to your readiness')}
        </button>
      </NclexShell>
    );
  }

  /* ── Live question ───────────────────────────────────────────────── */
  const cat = spec ? findCategory(spec.category) : null;

  return (
    <NclexShell {...shellProps}>
      <button type="button" className="nq-back" onClick={() => navigate('/nclex')}>
        ← {t('nclex.leave', 'Leave session')}
      </button>

      {/* Progress first, metadata second. The content area and format are
          useful orientation but they are not what she is here to read, so
          they sit under the bar in a quiet single line rather than as pills
          competing with the count. */}
      <div className="nq-practice-head">
        <span className="nq-practice-count">
          {t('nclex.questionN', 'Question {{n}} of {{total}}', {
            n: Math.min(qIndex + 1, total),
            total,
          })}
        </span>
        <div className="nq-progress" role="presentation">
          <div
            className="nq-progress-fill"
            style={{ width: `${(history.length / Math.max(1, total)) * 100}%` }}
          />
        </div>
        {spec && (
          <p className="nq-practice-meta">
            {cat ? cat.label : ''}
            {cat ? ' · ' : ''}
            {FORMAT_LABELS[spec.format]}
          </p>
        )}
      </div>

      {error ? (
        <div className="nq-empty" style={{ marginTop: 20 }}>
          {error}
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="nq-area-go"
              onClick={() => generate(history.length, profile)}
            >
              {t('nclex.retry', 'Try again')}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="nq-loading">{t('nclex.writing', 'Writing your next question…')}</div>
      ) : question ? (
        <>
          <div className="nq-question">
            {(question.questionType || 'mcq') === 'mcq' ? (
              <NclexMcq
                question={question}
                questionNumber={qIndex + 1}
                onAnswer={handleAnswer}
                answered={answered}
              />
            ) : (
              <DrillQuestion
                question={question}
                questionNumber={qIndex + 1}
                positionInBlock={qIndex + 1}
                blockSize={total}
                onAnswer={handleAnswer}
                onNext={handleNext}
                answered={answered}
              />
            )}
          </div>

          {answered && answered.format === 'mcq' && (
            <button type="button" className="nq-action" onClick={handleNext}>
              <span>
                <span className="nq-action-label">
                  {history.length >= total
                    ? t('nclex.seeResults', 'See your results')
                    : t('nclex.nextQuestion', 'Next question')}
                </span>
              </span>
              <span className="nq-action-arrow" aria-hidden="true">→</span>
            </button>
          )}
        </>
      ) : (
        <div className="nq-loading">{t('nclex.writing', 'Writing your next question…')}</div>
      )}
    </NclexShell>
  );
};

export default NclexPractice;
