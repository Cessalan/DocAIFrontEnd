import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DiagnosticStep from './DiagnosticStep';
import KnowledgeMap from './KnowledgeMap';
import { buildKnowledgeMap, scoresForPlan } from './knowledgeMapModel';
import { buildNarration } from './knowledgeNarration';
import { narrate_study_map } from '../../Services/FastAPICalls';
import { updateStudyPerformance } from '../../Services/StudySessionService';
import { getExamPhase } from './studySchedule';
import './DiagnosticStep.css';

/**
 * DiagnosticFlow — the two screens between onboarding and the plan.
 *
 *   questions loading → DiagnosticStep (6 Qs) → KnowledgeMap → plan
 *
 * FAILURE POLICY: this flow can never be the reason a student does not get a
 * plan. Questions fail to load, come back malformed, take too long — every one
 * of those paths calls `onSkip`, which builds the uniform plan exactly as
 * before. The diagnostic is an improvement to the plan, not a prerequisite for
 * it, and treating it as a prerequisite would trade a real activation problem
 * for a worse one.
 *
 * The baseline is written to `studyPerformance` the moment the questions are
 * answered, before the study session document exists. That is deliberate: the
 * misses recorded here become the `firstMissedAt` stamps in the concept ledger,
 * which is what later lets the session readout say "you were confusing X, and
 * now you aren't" instead of just asserting improvement.
 */
const DiagnosticFlow = ({
  chatId,
  questionsPromise,
  userPreferences = {},
  examName,
  daysToExam,
  onDone,
  onSkip,
  planBusy = false,
}) => {
  const { t, i18n } = useTranslation();
  const [phase, setPhase] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  // Rewritten narration lines, or null to use the templates.
  const [voicedLines, setVoicedLines] = useState(null);
  const settled = useRef(false);

  const bail = useCallback((why) => {
    if (settled.current) return;
    settled.current = true;
    console.warn('DiagnosticFlow: falling back to the uniform plan —', why);
    onSkip?.();
  }, [onSkip]);

  useEffect(() => {
    let alive = true;
    if (!questionsPromise) {
      bail('no questions promise');
      return undefined;
    }

    // A student who has already committed to building a plan should not be
    // held at a spinner because one generation call is slow. Twenty-five
    // seconds is past the point where the diagnostic is buying us anything.
    const timer = setTimeout(() => alive && bail('timed out'), 25000);

    Promise.resolve(questionsPromise)
      .then((data) => {
        if (!alive) return;
        clearTimeout(timer);
        const qs = (data?.questions || []).filter(
          (q) => Array.isArray(q?.options) && q.options.length === 4
        );
        if (qs.length < 2) {
          bail(`only ${qs.length} usable questions`);
          return;
        }
        setQuestions(qs);
        setPhase('asking');
      })
      .catch((err) => {
        if (!alive) return;
        clearTimeout(timer);
        bail(err?.message || 'request failed');
      });

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [questionsPromise, bail]);

  /* Seed the baseline. Fire-and-forget — a failed write costs us a nicer
     readout later, and must never hold up the plan. */
  const seedBaseline = useCallback((all) => {
    if (!chatId) return;
    all.forEach((a) => {
      updateStudyPerformance(chatId, {
        topic: a.topic,
        type: 'quiz',
        correct: a.correct,
        concept: !a.correct ? a.question : undefined,
        conceptKey: a.concept || undefined,
        format: 'mcq',
      });
    });
  }, [chatId]);

  const handleComplete = useCallback(async ({ answers: all }) => {
    setAnswers(all);
    seedBaseline(all);

    /* Voice pass. The narration is already written and already true; a cheap
       model only rewrites the wording so her second and third plan do not
       open with the identical sentence.

       It runs HERE rather than inside the map because the "Reading what you
       just showed me…" beat is already on screen — the student is looking at
       a screen that says we are thinking, which is exactly what we are doing.
       Rendering the map first and swapping the text afterwards would be
       visibly worse than never voicing it at all.

       Capped hard: past ~2.5s the beat stops feeling like thought and starts
       feeling like lag, and the templates are a complete experience. */
    const map = buildKnowledgeMap(all, userPreferences?.hardestTopics || []);
    const beats = buildNarration(map, daysToExam, examName);
    const lines = beats.map((b) => t(b.key, b.fallback, b.params));

    try {
      const voiced = await Promise.race([
        narrate_study_map(chatId, lines, {
          language: i18n?.language?.split('-')[0] || 'en',
          phase: daysToExam == null ? 'undated' : getExamPhase(daysToExam),
          daysToExam,
          // Topic names must survive the rewrite or the map stops being
          // about her; the backend rejects a response that drops one.
          protectedTerms: map.topics.map((tp) => tp.topic),
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
      if (voiced) setVoicedLines(voiced);
    } catch (err) {
      // Already non-throwing, but a failed flourish must never cost her the map.
      console.warn('Narration voice pass failed:', err);
    }

    setPhase('map');
  }, [seedBaseline, chatId, userPreferences, daysToExam, examName, t, i18n]);

  const handleContinue = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    const map = buildKnowledgeMap(answers, userPreferences?.hardestTopics || []);
    onDone?.({
      scores: scoresForPlan(map),
      answers,
      map,
    });
  }, [answers, userPreferences, onDone]);

  if (phase === 'loading') {
    return (
      <div className="diagnostic" role="status" aria-live="polite">
        <div className="diagnostic__finishing">
          <div className="diagnostic__pulse" aria-hidden="true" />
          <h2 className="diagnostic__finishingTitle">
            {t('diagnostic.loadingTitle', 'Reading your material…')}
          </h2>
          <p className="diagnostic__finishingSub">
            {t('diagnostic.loadingSub', 'Working out what to ask you.')}
          </p>
        </div>
        <button type="button" className="diagnostic__skip" onClick={() => bail('user skipped at load')}>
          {t('diagnostic.skip', 'Skip this — just build my plan')}
        </button>
      </div>
    );
  }

  if (phase === 'asking') {
    return (
      <DiagnosticStep
        questions={questions}
        examName={examName}
        onComplete={handleComplete}
        onSkip={() => bail('user skipped mid-diagnostic')}
      />
    );
  }

  return (
    <KnowledgeMap
      answers={answers}
      hardestTopics={userPreferences?.hardestTopics || []}
      examName={examName}
      daysToExam={daysToExam}
      onContinue={handleContinue}
      busy={planBusy}
      voicedLines={voicedLines}
    />
  );
};

export default DiagnosticFlow;
