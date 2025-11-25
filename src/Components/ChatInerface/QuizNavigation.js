import React, { useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './QuizNavigation.css';
import QuizFeedback from './QuizFeedback';

function QuizNavigation({
  questions = [],
  currentIndex,
  onNavigate,
  userAnswers = [],
  skippedQuestions = [],
  onFeedbackSubmit,
  hasGivenFeedback
}) {
  const { t } = useTranslation();
  const navListRef = useRef(null);
  const currentItemRef = useRef(null);

  // Show ALL questions in a scrollable list
  const visibleQuestions = useMemo(() => {
    return questions.map((q, i) => ({
      question: q,
      originalIndex: i
    }));
  }, [questions]);

  // Auto-scroll to current question
  useEffect(() => {
    if (currentItemRef.current && navListRef.current) {
      currentItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [currentIndex]);

  return (
    <div className="quiz-navigation compact">
      <div className="quiz-nav-stats">
        <div className="nav-stat-item correct" title={t('quizNavigation.correct')}>
          <span className="stat-dot"></span>
          <span className="stat-count">
            {questions.filter((q, i) => {
              const answer = userAnswers.find(a => a.quizIndex === i) || (q.userSelection ? { isCorrect: q.userSelection.isCorrect } : null);
              return answer && answer.isCorrect;
            }).length}
          </span>
        </div>
        <div className="nav-stat-item incorrect" title={t('quizNavigation.incorrect')}>
          <span className="stat-dot"></span>
          <span className="stat-count">
            {questions.filter((q, i) => {
              const answer = userAnswers.find(a => a.quizIndex === i) || (q.userSelection ? { isCorrect: q.userSelection.isCorrect } : null);
              return answer && !answer.isCorrect;
            }).length}
          </span>
        </div>
      </div>

      <div className="quiz-nav-divider"></div>

      <div className="quiz-nav-list" ref={navListRef}>
        {visibleQuestions.map(({ question, originalIndex }) => {
          const isCurrent = originalIndex === currentIndex;
          const answer = userAnswers.find(a => a.quizIndex === originalIndex) || (question.userSelection ? { isCorrect: question.userSelection.isCorrect } : null);
          const isAnswered = !!answer;
          const isCorrect = answer?.isCorrect;
          const isSkipped = skippedQuestions.includes(originalIndex);

          let statusClass = '';
          let statusText = '';

          if (isCurrent) {
            statusClass = 'current';
            statusText = t('quizNavigation.current');
          } else if (isAnswered) {
            statusClass = isCorrect ? 'correct' : 'incorrect';
            statusText = isCorrect ? t('quizNavigation.correct') : t('quizNavigation.incorrect');
          } else if (isSkipped) {
            statusClass = 'skipped';
            statusText = t('quizNavigation.skipped');
          } else {
            statusClass = 'unanswered';
            statusText = t('quizNavigation.unanswered');
          }

          return (
            <button
              key={originalIndex}
              ref={isCurrent ? currentItemRef : null}
              className={`quiz-nav-item ${statusClass}`}
              onClick={() => onNavigate(originalIndex)}
              aria-label={`${t('quizNavigation.questionPrefix')}${originalIndex + 1}`}
              title={`${t('quizNavigation.questionPrefix')}${originalIndex + 1}: ${statusText}`}
            >
              <span className="nav-number">{originalIndex + 1}</span>
              {isAnswered && (
                <span className="nav-status-dot">
                  {isCorrect ? '✓' : '✗'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="quiz-nav-footer">
        <QuizFeedback
          onFeedbackSubmit={onFeedbackSubmit}
          hasSubmitted={hasGivenFeedback}
        />
      </div>
    </div>
  );
}

export default QuizNavigation;
