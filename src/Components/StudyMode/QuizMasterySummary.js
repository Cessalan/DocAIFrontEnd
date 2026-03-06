import React from 'react';
import { useTranslation } from 'react-i18next';
import './StudyMode.css';

/**
 * QuizMasterySummary — Post-quiz value moment shown after every quiz node.
 * Displays score, improvement since baseline, strength level, and missed concepts.
 *
 * @param {Object} data - Summary data:
 *   { topic, correct, total, scorePercent, strengthLevel, missedConcepts, improvement, beforeAcc, afterAcc }
 * @param {Function} onContinue - Called when user continues to next node
 */
const QuizMasterySummary = ({ data, onContinue }) => {
  const { t } = useTranslation();

  if (!data) return null;

  const {
    topic,
    correct,
    total,
    scorePercent,
    strengthLevel,
    missedConcepts = [],
    improvement,
    beforeAcc,
    afterAcc
  } = data;

  // Determine improvement display
  const hasImprovement = improvement !== null && improvement !== undefined && beforeAcc !== null;
  const improvementSign = improvement > 0 ? '+' : '';
  const improvementColor = improvement > 0 ? 'positive' : improvement < 0 ? 'negative' : 'neutral';

  // Strength label config
  const strengthConfig = {
    strong:      { label: t('study.strong', 'Strong'),      cls: 'strong',      icon: '⭐' },
    developing:  { label: t('study.developing', 'Developing'), cls: 'developing', icon: '📈' },
    weak:        { label: t('study.weak', 'Needs Work'),    cls: 'weak',        icon: '🔁' },
  };
  const strength = strengthConfig[strengthLevel] || null;

  return (
    <div className="quiz-mastery-summary">
      {/* Header */}
      <div className="quiz-mastery-summary__header">
        <div className="quiz-mastery-summary__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <h2 className="quiz-mastery-summary__title">{t('study.quizComplete', 'Quiz Complete')}</h2>
          <p className="quiz-mastery-summary__topic">{topic}</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="quiz-mastery-summary__score-section">
        <div className="quiz-mastery-summary__score-row">
          <span className="quiz-mastery-summary__score-label">{t('study.yourScore', 'Your Score')}</span>
          <span className="quiz-mastery-summary__score-value">{scorePercent}%</span>
          <span className="quiz-mastery-summary__score-fraction">({correct}/{total})</span>
        </div>
        <div className="quiz-mastery-summary__bar-track">
          <div
            className="quiz-mastery-summary__bar-fill"
            style={{ width: `${scorePercent}%` }}
          />
          {/* Baseline marker — show where they were before */}
          {hasImprovement && beforeAcc !== null && (
            <div
              className="quiz-mastery-summary__bar-baseline"
              style={{ left: `${beforeAcc}%` }}
              title={t('study.baselineMark', 'Your baseline')}
            />
          )}
        </div>
      </div>

      {/* Improvement line */}
      {hasImprovement && (
        <div className={`quiz-mastery-summary__improvement improvement--${improvementColor}`}>
          <span className="quiz-mastery-summary__improvement-icon">
            {improvement > 0 ? '📈' : improvement < 0 ? '📉' : '➡️'}
          </span>
          <span className="quiz-mastery-summary__improvement-text">
            {improvement > 0
              ? t('study.improvementPositive', '{{sign}}{{n}}% improvement from your baseline', { sign: improvementSign, n: Math.abs(improvement) })
              : improvement < 0
              ? t('study.improvementNegative', '{{n}}% below your baseline — keep practicing', { n: Math.abs(improvement) })
              : t('study.improvementNeutral', 'Same as your baseline — consistency is key')}
          </span>
        </div>
      )}

      {/* Strength badge */}
      {strength && (
        <div className={`quiz-mastery-summary__badge badge--${strength.cls}`}>
          <span>{strength.icon}</span>
          <span>{strength.label}</span>
        </div>
      )}

      {/* Missed concepts */}
      {missedConcepts.length > 0 && (
        <div className="quiz-mastery-summary__missed">
          <p className="quiz-mastery-summary__missed-label">
            {t('study.reviewThese', 'To review:')}
          </p>
          <ul className="quiz-mastery-summary__missed-list">
            {missedConcepts.map((concept, i) => (
              <li key={i} className="quiz-mastery-summary__missed-item">
                {concept.length > 90 ? concept.substring(0, 90) + '...' : concept}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Continue button */}
      <button className="quiz-mastery-summary__continue" onClick={onContinue}>
        {t('study.continueBtn', 'Continue')}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  );
};

export default QuizMasterySummary;
