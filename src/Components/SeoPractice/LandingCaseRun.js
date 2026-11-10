import React, { useEffect, useRef, useState } from 'react';
import CaseStudyQuestion from '../ChatInerface/CaseStudyQuestion';
import SATAQuestion from '../ChatInerface/SATAQuestion';
import { ContinueCard } from './SeoMiniProduct';
import { caseOutcome, LANDING_CASES } from './landingCases';
import { LANDING_PRACTICE_PAGE } from './landingPracticeModel';
import { readLocal, trackSeo } from '../../Services/SeoMiniProductService';

/**
 * "Keep practicing" on the homepage: the app's real select-all and case-study
 * cards with their real walkthroughs, stored so they open instantly and with no
 * backend call (see landingCases.js).
 *
 * Her answers here are NOT carried through signup. Those questions have no place
 * in QUESTION_TARGETS, and an attempt with no target is never invented. The end
 * screen's signup carries the three starter answers, which do have one.
 */
export default function LandingCaseRun() {
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState({});
  const top = useRef(null);
  const started = useRef(false);
  const step = LANDING_CASES[position];

  useEffect(() => {
    if (started.current) {
      top.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      return;
    }
    started.current = true;
    trackSeo('landing_cases_started', LANDING_PRACTICE_PAGE);
  }, [position]);

  const record = (answer) => {
    setAnswers((all) => ({ ...all, [step.id]: answer }));
    trackSeo('landing_case_answered', LANDING_PRACTICE_PAGE, { caseId: step.id, kind: step.kind, correct: !!answer.isCorrect });
  };

  const next = () => {
    if (position + 1 === LANDING_CASES.length) {
      trackSeo('landing_cases_completed', LANDING_PRACTICE_PAGE, { answered: Object.keys(answers).length });
    }
    setPosition((at) => at + 1);
  };

  if (!step) {
    const starter = readLocal(LANDING_PRACTICE_PAGE.slug) || {};
    const topic = starter.result?.needsWork || starter.result?.missed?.[0] || starter.result?.strongest;
    return (
      <div ref={top} className="landing-cases-end seo-mini seo-embedded">
        <div className="seo-paper">
          <span className="seo-hand">that is the whole method</span>
          <h2>You just practiced what the exam asks.</h2>
          <ul className="landing-cases-list">
            {LANDING_CASES.map((item) => {
              const outcome = caseOutcome(answers[item.id]);
              return (
                <li key={item.id}>
                  <span
                    className={`landing-cases-mark${outcome.correct ? ' is-right' : outcome.done ? ' is-partial' : ''}`}
                    aria-hidden="true"
                  />
                  <span className="landing-cases-name">{item.label}</span>
                  <span className="landing-cases-line">{outcome.line}</span>
                </li>
              );
            })}
          </ul>
          <ContinueCard
            lead
            page={LANDING_PRACTICE_PAGE}
            value={starter}
            topic={topic}
            label={LANDING_PRACTICE_PAGE.conversion}
            bodyText="Your first three answers come with you. The first session opens on your weak spot, with new questions written around it."
          />
        </div>
      </div>
    );
  }

  const Card = step.kind === 'sata' ? SATAQuestion : CaseStudyQuestion;
  return (
    <div ref={top} className="landing-cases-card">
      <Card
        key={step.id}
        quiz={step.quiz}
        quizIndex={position}
        totalQuestions={LANDING_CASES.length}
        isLastQuestion={position + 1 === LANDING_CASES.length}
        onAnswerSelect={record}
        onNext={next}
        presetWalkthrough={step.walkthrough}
      />
    </div>
  );
}
