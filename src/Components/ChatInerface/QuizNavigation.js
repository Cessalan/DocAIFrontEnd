import React from 'react';
import { useTranslation } from 'react-i18next';
import './QuizNavigation.css';
import QuizFeedback from './QuizFeedback';

function QuizNavigation({
  questions = [],
  currentIndex,
  onNavigate,
  userAnswers = [],
  skippedQuestions = []
}) {
  const { t } = useTranslation();

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

      <div className="quiz-nav-list">
        {questions.map((question, index) => {
          const isCurrent = index === currentIndex;
          const answer = userAnswers.find(a => a.quizIndex === index) || (question.userSelection ? { isCorrect: question.userSelection.isCorrect } : null);
          const isAnswered = !!answer;
          const isCorrect = answer?.isCorrect;
          const isSkipped = skippedQuestions.includes(index);

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
              key={index}
              className={`quiz-nav-item ${statusClass}`}
              onClick={() => onNavigate(index)}
              aria-label={`${t('quizNavigation.questionPrefix')}${index + 1}`}
              title={`${t('quizNavigation.questionPrefix')}${index + 1}: ${statusText}`}
            >
              <span className="nav-number">{index + 1}</span>
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
        <QuizFeedback />
      </div>
    </div>
  );
}

export default QuizNavigation;
