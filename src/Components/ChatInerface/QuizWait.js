import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PaperShimmer from './PaperShimmer';
import { waitCopy, ROTATE_MS } from './quizWaitModel';
import './QuizWait.css';

/**
 * The quiz's waiting screen: a shimmering line naming the real stage
 * (see quizWaitModel), a quieter line from her own notes, and the paper
 * skeleton underneath so the first question lands where the wait was.
 */
export default function QuizWait({ stage = 'writing', total = 0, current = 0, subtopics = [] }) {
  const { t } = useTranslation();
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(() => Date.now());

  // The clock restarts with each stage: "slow" means slow at THIS step.
  useEffect(() => { startedAt.current = Date.now(); setNow(Date.now()); }, [stage]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), Math.min(1000, ROTATE_MS));
    return () => clearInterval(timer);
  }, []);

  const { headline, detail } = waitCopy({ stage, total, current, subtopics, elapsedMs: now - startedAt.current });
  const headlineText = t(headline.key, headline.vars);
  const detailText = detail ? t(detail.key, detail.vars) : '';

  return <div className="quiz-wait">
    {/* Only the stage is announced; the rotating detail would be read out every few seconds. */}
    <p className="quiz-wait-headline" role="status" aria-live="polite" key={headlineText}>
      <span className="quiz-wait-shimmer">{headlineText}</span>
    </p>
    <p className="quiz-wait-detail" aria-hidden="true" key={detailText || 'none'}>{detailText}</p>
    <PaperShimmer className="practice-shimmer" label={null} />
  </div>;
}
