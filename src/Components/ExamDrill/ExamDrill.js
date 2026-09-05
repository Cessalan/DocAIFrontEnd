import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsageLimit } from '../../Contexts/UsageContext/UsageContext';
import {
  createDrillState,
  recordAnswer,
  selectNextSpec,
  blockFormatsUsed,
  shouldCheckpoint,
  questionsUntilCheckpoint,
  buildCheckpoint,
  blockIndexAt,
  plannedBlockSize,
  answeredInBlock,
} from './drillModel';
import {
  generateDrillQuestion,
  loadDrillState,
  saveDrillState,
} from '../../Services/ExamDrillService';
import { updateStudyPerformance } from '../../Services/StudySessionService';
import DrillQuestion from './DrillQuestion';
import DrillCheckpoint from './DrillCheckpoint';
import DrillWriting, { DrillLoadingShell } from './DrillWriting';
import { devLog } from '../../Services/devLogger';
import './ExamDrill.css';

/**
 * ExamDrill — the adaptive examiner surface.
 *
 * THE LOOP
 * ────────
 *   present a question  →  she answers  →  we immediately start generating the
 *   next one from that answer  →  she reads her feedback  →  presses Next and
 *   it is already there  →  every block, we stop and tell her where she stands.
 *
 * WHY THE PREFETCH STARTS ON SUBMIT, NOT ON "NEXT"
 * ────────────────────────────────────────────────
 * One question at a time is what makes the drill adaptive — question N+1 is
 * chosen from the answer to N, so there is no batch to invalidate when she
 * turns out to be weaker than we thought. But generating on the Next press
 * would put a spinner between every single question, which wrecks the exam
 * feeling far more thoroughly than any styling choice could fix it.
 *
 * The answer submission is the moment the evidence arrives, so that is the
 * earliest instant a correct adaptive choice can be made. We fire there and
 * spend her feedback-reading time on the round trip. She is never waiting on
 * us, and the drill is never guessing ahead of her.
 *
 * WHY THE CHARGE LANDS ON DISPLAY
 * ───────────────────────────────
 * Free users spend one question of their allowance per question they GET. A
 * prefetched question she never sees (she closed the tab after feedback) was
 * never gotten, so it must not be charged — hence `presentQuestion` is the only
 * place `consume` is called, and the prefetched question sits uncharged until
 * it is actually put on screen.
 *
 * The charge is fire-and-forget. `consumeGeneration` is a Firestore
 * transaction, and awaiting it before painting the next question would put a
 * network round trip on the one seam that has to feel instant.
 */

const ExamDrill = ({
  chatId,
  topics = [],
  onExit,
  language = 'en',
}) => {
  const { t } = useTranslation();
  const { isPro, remaining, requireQuota, consume } = useUsageLimit();

  const [phase, setPhase] = useState('loading'); // loading | question | generating | checkpoint | error
  const [drillState, setDrillState] = useState(() => createDrillState(topics));
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [checkpoint, setCheckpoint] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  // WHY THE CHROME IS ANCHORED TO THE PRESENTATION, NOT TO `answered`
  // ────────────────────────────────────────────────────────────────
  // `drillState.answered` increments the instant she answers, so anything
  // derived from it changes UNDER the question she is still looking at. That
  // moved the remount key mid-question, and the SATA and case study cards —
  // which own their submitted state internally — came back blank right after
  // she pressed submit. She then answered a second time, and that second
  // answer was DISCARDED (the drill had already recorded the first), so the
  // drill looked like it only saved on the second try.
  //
  // These two are set only in `presentQuestion`, so a question keeps its
  // identity and its "Question X of Y" from the moment it goes on screen
  // until the next one replaces it.
  const [askedAt, setAskedAt] = useState(0); // `answered` when this went up
  const [seq, setSeq] = useState(0);         // presentations, for the remount key

  // Latest state, readable synchronously from callbacks that must not wait for
  // a re-render (the prefetch and the checkpoint decision both need it).
  const stateRef = useRef(drillState);
  stateRef.current = drillState;

  // The clock, readable from handleAnswer. Same reason as stateRef: the
  // handler is memoised on the question, so closing over `elapsed` would
  // record whatever the timer read when the question went up — zero.
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  // The always-ready next question. Held in memory only: it is uncharged until
  // displayed, and regenerating one is cheaper than reasoning about a
  // half-owned question persisted across sessions.
  const preloadedRef = useRef(null);

  // The in-flight prefetch, so a student who presses Next before it lands
  // JOINS it instead of starting a second one. Without this, being quick was
  // punished twice: a duplicate generation billed against the backend, and a
  // wait as long as the request that was already most of the way done.
  const preloadPromiseRef = useRef(null);

  /** Take the preloaded question, clearing the slot so it can't be served twice. */
  const takePreloaded = () => {
    const q = preloadedRef.current;
    preloadedRef.current = null;
    return q;
  };

  // Remaining allowance when the current block began. Blocks are sized against
  // this rather than against a live-decrementing value so the "X to your
  // checkpoint" promise does not move while she is answering.
  const blockBudgetRef = useRef(Infinity);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  /* ── Generation ─────────────────────────────────────────────────────── */

  const generateFor = useCallback(async (state) => {
    const spec = selectNextSpec(state, {
      remaining: blockBudgetRef.current,
      blockFormatsUsed: blockFormatsUsed(state),
    });
    devLog('🎯 Drill spec:', spec);
    return generateDrillQuestion({ chatId, spec, state, language });
  }, [chatId, language]);

  /**
   * Start generating the next question.
   *
   * Idempotent, and returns the in-flight promise so `handleNext` can await
   * the SAME request rather than racing it with a duplicate.
   */
  const prefetch = useCallback((state) => {
    if (preloadedRef.current) return Promise.resolve(preloadedRef.current);
    if (preloadPromiseRef.current) return preloadPromiseRef.current;

    const pending = generateFor(state)
      .then((q) => {
        if (mountedRef.current) preloadedRef.current = q;
        return q;
      })
      .catch((error) => {
        if (error?.code === 'quota_exceeded') {
          // Server-side cap. The display path raises the paywall; a failed
          // prefetch just means there is nothing to promote.
          devLog('Drill prefetch blocked by server quota');
        }
        return null;
      })
      .finally(() => {
        preloadPromiseRef.current = null;
      });

    preloadPromiseRef.current = pending;
    return pending;
  }, [generateFor]);

  /**
   * Put a question on screen and charge for it.
   * Returns false when the free allowance is spent, having raised the paywall.
   */
  const presentQuestion = useCallback((q) => {
    if (!q) return false;
    if (!requireQuota({ topic: q.topic })) return false;

    setQuestion(q);
    setAnswer(null);
    setAskedAt(stateRef.current.answered);
    setSeq((n) => n + 1);
    setElapsed(0);
    setPhase('question');

    // Fire-and-forget: see the header note on why this is not awaited.
    consume(1);
    return true;
  }, [requireQuota, consume]);

  /* ── Boot ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = await loadDrillState(chatId);
      const initial = saved
        ? { ...saved, topicPool: saved.topicPool?.length ? saved.topicPool : topics }
        : createDrillState(topics);
      if (cancelled) return;

      setDrillState(initial);
      stateRef.current = initial;
      blockBudgetRef.current = isPro ? Infinity : remaining;

      // Record that this chat HAS a drill before she has answered anything.
      // Persistence used to begin at the first answer, so a student who opened
      // the drill and left on question one left no trace: the chat had no
      // `drill` map, the resume card never rendered, and the only way back to
      // the examiner was to upload the same file again.
      if (!saved) saveDrillState(chatId, initial);

      if (!requireQuota()) {
        setPhase('checkpoint');
        setCheckpoint(buildCheckpoint(initial));
        return;
      }

      const first = await generateFor(initial);
      if (cancelled) return;

      if (!first) {
        setPhase('error');
        return;
      }
      presentQuestion(first);
      // Nothing to prefetch from yet — the next spec needs her first answer.
    })();

    return () => { cancelled = true; };
    // Boot once per chat. Quota values are read through refs at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  /* ── Per-question stopwatch ─────────────────────────────────────────── */

  /**
   * Counts up while a question is unanswered.
   *
   * NOT SHOWN TO THE STUDENT. It used to render as a countdown in the top
   * right, which added exam pressure at the cost of hurrying answers that the
   * drill then treats as evidence — a question rushed by a clock tells us
   * about the clock, not about her.
   *
   * The interval stays because the reading is recorded on every answer row
   * (`seconds` in recordAnswer). It is the only signal that separates guessing
   * from working: a wrong answer in nine seconds and a wrong answer in ninety
   * are different problems with different fixes. Delete this and the answer log
   * silently starts writing nulls.
   */
  useEffect(() => {
    if (phase !== 'question' || answer) return undefined;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, answer, question]);

  /* ── Answering ──────────────────────────────────────────────────────── */

  const handleAnswer = useCallback((data) => {
    // How long this one took is part of the answer, not decoration on the
    // clock: it is the only signal that separates guessing from working.
    const next = recordAnswer(stateRef.current, { ...data, seconds: elapsedRef.current });
    stateRef.current = next;
    setDrillState(next);
    setAnswer(data);

    // Feed the same performance store the study plan writes to, so the format
    // breakdown and concept ledger stay one dataset across both surfaces.
    updateStudyPerformance(chatId, {
      topic: data.topic || question?.topic || 'General',
      type: 'quiz',
      correct: data.isCorrect,
      concept: data.isCorrect ? undefined : question?.question,
      conceptKey: question?.concept || question?.conceptKey,
      format: data.format,
    });

    saveDrillState(chatId, next);

    // The moment the evidence arrives, start on the next question.
    if (!shouldCheckpoint(next, blockBudgetRef.current)) {
      prefetch(next);
    }
  }, [chatId, question, prefetch]);

  /* ── Advancing ──────────────────────────────────────────────────────── */

  const handleNext = useCallback(async () => {
    const state = stateRef.current;

    if (shouldCheckpoint(state, blockBudgetRef.current)) {
      const cp = buildCheckpoint(state);
      const marked = { ...state, lastCheckpointAt: state.answered };
      stateRef.current = marked;
      setDrillState(marked);
      saveDrillState(chatId, marked);
      setCheckpoint(cp);
      setPhase('checkpoint');
      // She will spend a while reading this — a good moment to get ahead.
      blockBudgetRef.current = isPro ? Infinity : remaining;
      prefetch(marked);
      return;
    }

    const ready = takePreloaded();
    if (ready) {
      presentQuestion(ready);
      return;
    }

    // Prefetch has not landed yet — she was quicker than the network. Show
    // that we are writing rather than leaving a dead button under her finger,
    // and JOIN the request already in flight instead of firing a second one.
    setPhase('generating');
    const q = await prefetch(state);
    if (!mountedRef.current) return;
    takePreloaded(); // we hold it now; don't let it be served again
    if (!q) {
      setPhase('error');
      return;
    }
    presentQuestion(q);
  }, [chatId, isPro, remaining, prefetch, presentQuestion]);

  const handleCheckpointContinue = useCallback(async () => {
    if (!requireQuota()) return; // Paywall; UpgradeModal is raised by the context.

    blockBudgetRef.current = isPro ? Infinity : remaining;

    const ready = takePreloaded();
    if (ready) {
      presentQuestion(ready);
      return;
    }

    setPhase('generating');
    const q = await prefetch(stateRef.current);
    if (!mountedRef.current) return;
    takePreloaded();
    if (!q) {
      setPhase('error');
      return;
    }
    presentQuestion(q);
  }, [requireQuota, isPro, remaining, prefetch, presentQuestion]);

  /* ── Derived display values ─────────────────────────────────────────── */

  const blockIndex = blockIndexAt(askedAt);
  const blockSize = plannedBlockSize(blockIndex, blockBudgetRef.current);
  const posInBlock = answeredInBlock(askedAt) + 1;
  const toCheckpoint = questionsUntilCheckpoint(drillState, blockBudgetRef.current);

  // Counted from the question ON SCREEN, so it holds still while she reads her
  // feedback, exactly like the number above it. `toCheckpoint` stays live
  // because the footer button uses it to flip to "See where you stand".
  const checkpointIn = Math.max(0, blockSize - answeredInBlock(askedAt));

  // She pressed Next before the prefetch landed. The chrome stays put so she
  // keeps her place; only the question body is swapped for a visible "writing"
  // state, which also covers SATA and case study — those render their own Next
  // button, so a spinner living in our footer would never have been seen.
  const isGenerating = phase === 'generating';

  const format = question?.questionType || 'mcq';

  const formatLabel = {
    mcq: t('exam.typeMCQ', 'Multiple Choice'),
    sata: t('exam.typeSATA', 'Select All That Apply'),
    casestudy: t('exam.typeCaseStudy', 'Case Study'),
  }[format];

  /* ── Render ─────────────────────────────────────────────────────────── */

  // Same surface as every mid-drill wait, so arriving from "Keep drilling"
  // is one continuous page that resolves into a question rather than a
  // spinner, a second spinner and then a hard cut.
  if (phase === 'loading') {
    return <DrillLoadingShell startup />;
  }

  if (phase === 'error') {
    return (
      <div className="drill-shell drill-shell--centered">
        <p className="drill-loading-text">
          {t('drill.generationFailed', 'That question would not generate. Try again in a moment.')}
        </p>
        <button className="drill-btn drill-btn--primary" onClick={handleNext} type="button">
          {t('drill.retry', 'Try again')}
        </button>
        <button className="drill-btn drill-btn--ghost" onClick={onExit} type="button">
          {t('drill.exit', 'Finish for now')}
        </button>
      </div>
    );
  }

  if (phase === 'checkpoint') {
    return (
      <div className="drill-shell">
        <DrillCheckpoint
          checkpoint={checkpoint}
          onContinue={handleCheckpointContinue}
          onExit={onExit}
          canContinue={isPro || remaining > 0}
          remaining={isPro ? Infinity : remaining}
        />
      </div>
    );
  }

  return (
    <div className="drill-shell drill-shell--exam">
      <header className="drill-bar">
        <div className="drill-bar__left">
          {/* THE CUMULATIVE NUMBER, NOT THE POSITION IN THE BLOCK
              The resume card tells her "18 questions answered so far", so a
              header reading "Question 4 of 10" on the way back in says her
              work was lost. Blocks are our bookkeeping, not hers: she counts
              questions answered, and that number only ever goes up. The block
              is still visible as the thing it actually is — a countdown to the
              next checkpoint, plus the bar underneath. */}
          <span className="drill-bar__count">
            {t('drill.questionNumber', 'Question {{n}}', { n: askedAt + 1 })}
          </span>
          <span className="drill-bar__checkpoint">
            {checkpointIn <= 1
              ? t('drill.checkpointNext', 'Checkpoint after this one')
              : t('drill.checkpointIn', 'Checkpoint in {{count}}', { count: checkpointIn })}
          </span>
          <span className="drill-bar__format">{formatLabel}</span>
        </div>

        <div className="drill-bar__right">
          <button
            className="drill-bar__exit"
            onClick={onExit}
            type="button"
            aria-label={t('drill.exit', 'Finish for now')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="drill-progress" role="presentation">
        <div
          className="drill-progress__fill"
          style={{ width: `${blockSize ? ((posInBlock - (answer ? 0 : 1)) / blockSize) * 100 : 0}%` }}
        />
      </div>

      <main className="drill-body">
        {isGenerating ? (
          <DrillWriting />
        ) : (
          /* Keyed on the presentation counter so React remounts on every new
             question — that is what replays the enter animation. Without it
             the content swaps in place and the drill reads as a form being
             overwritten rather than as pages being turned. It must NOT be
             keyed on `answered`: that ticks over on submit, and the remount
             would tear down the card she is mid-feedback on. */
          <div className="drill-enter" key={`q-${seq}`}>
            <DrillQuestion
              question={question}
              questionNumber={askedAt + 1}
              positionInBlock={posInBlock}
              blockSize={blockSize}
              onAnswer={handleAnswer}
              onNext={handleNext}
              answered={answer}
            />
          </div>
        )}
      </main>

      {/* SATA and case study render their own Next control; MCQ needs ours. */}
      {answer && format === 'mcq' && !isGenerating && (
        <footer className="drill-foot">
          <button
            className="drill-btn drill-btn--primary"
            onClick={handleNext}
            type="button"
          >
            {toCheckpoint <= 1
              ? t('drill.seeCheckpoint', 'See where you stand')
              : t('drill.next', 'Next question')}
          </button>
          {toCheckpoint > 1 && (
            <span className="drill-foot__hint">
              {t('drill.untilCheckpoint', '{{count}} until your checkpoint', { count: toCheckpoint })}
            </span>
          )}
        </footer>
      )}
    </div>
  );
};

export default ExamDrill;
