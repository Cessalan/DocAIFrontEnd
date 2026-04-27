import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SATAQuestion from '../ChatInerface/SATAQuestion';
import CaseStudyQuestion from '../ChatInerface/CaseStudyQuestion';
import StudyCelebration from './StudyCelebration';
import { playCorrectSound, playIncorrectSound, playCelebrationSound } from '../../utils/soundEffects';
import './StudyMode.css';

/**
 * StudyExamCard — NCLEX-style mixed-format exam for study mode.
 *
 * Routes each question to the correct renderer:
 *   - "mcq" → inline MCQ (same as StudyQuizCard but single question)
 *   - "sata" → SATAQuestion component
 *   - "casestudy" → CaseStudyQuestion component
 *
 * Features:
 *   - Optional per-question timer
 *   - Progress bar across all questions
 *   - Score summary at the end
 *   - Handles mixed types in a single session
 */
const StudyExamCard = ({
  content,           // { questions: [...], examConfig: {...} }
  savedProgress,     // For resume
  onAnswer,          // Per-question callback
  onContinue,        // When exam is complete
  onExit,            // Exit exam
  viewOnly = false,
}) => {
  const { t } = useTranslation();

  const questions = content?.questions || [];
  const examConfig = content?.examConfig || {};
  const totalQuestions = questions.length;
  const timerEnabled = examConfig.timerEnabled || false;
  const timerSecondsPerQ = examConfig.timerSeconds || 90;

  // State
  const [currentIndex, setCurrentIndex] = useState(savedProgress?.currentIndex || 0);
  const [answers, setAnswers] = useState(savedProgress?.answers || {}); // { [index]: answerData }
  const [showFeedback, setShowFeedback] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState(timerSecondsPerQ);
  const timerRef = useRef(null);

  // Current question
  const currentQuestion = questions[currentIndex];
  const questionType = currentQuestion?.questionType || 'mcq';
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const hasAnswered = answers[currentIndex] !== undefined;

  // MCQ state (only for mcq type rendered inline)
  const [selectedMCQ, setSelectedMCQ] = useState(null);
  const [mcqFeedback, setMcqFeedback] = useState(false);
  const [mcqCorrect, setMcqCorrect] = useState(false);
  const [showRationale, setShowRationale] = useState(false);

  // Reset MCQ state when moving to a new question
  useEffect(() => {
    setSelectedMCQ(null);
    setMcqFeedback(false);
    setMcqCorrect(false);
    setShowRationale(false);
    setShowFeedback(false);

    // Reset timer
    if (timerEnabled) {
      setTimeLeft(timerSecondsPerQ);
    }
  }, [currentIndex, timerEnabled, timerSecondsPerQ]);

  // Timer tick
  useEffect(() => {
    if (!timerEnabled || showFeedback || hasAnswered || isComplete) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timerEnabled, showFeedback, hasAnswered, isComplete, currentIndex]);

  // Format timer
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Score calculation
  const getScoreSummary = useCallback(() => {
    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;

    Object.entries(answers).forEach(([idx, answer]) => {
      const q = questions[parseInt(idx)];
      if (!q) return;

      if (q.questionType === 'mcq' || !q.questionType) {
        maxScore += 1;
        if (answer.isCorrect) {
          totalScore += 1;
          correctCount++;
        }
      } else if (q.questionType === 'sata') {
        maxScore += (answer.maxScore || 1);
        totalScore += (answer.score || 0);
        if (answer.isCorrect) correctCount++;
      } else if (q.questionType === 'casestudy') {
        maxScore += (answer.maxScore || 1);
        totalScore += (answer.score || 0);
        if (answer.isCorrect) correctCount++;
      }
    });

    const percent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    return { totalScore, maxScore, correctCount, percent, total: totalQuestions };
  }, [answers, questions, totalQuestions]);

  // ── MCQ answer handler ──
  const handleMCQAnswer = (index) => {
    if (mcqFeedback || hasAnswered) return;

    setSelectedMCQ(index);
    const correct = index === currentQuestion.correctIndex;
    setMcqCorrect(correct);
    setMcqFeedback(true);
    setShowFeedback(true);

    if (correct) playCorrectSound();
    else playIncorrectSound();

    // Store answer
    const answerData = {
      questionType: 'mcq',
      isCorrect: correct,
      selectedIndex: index,
      score: correct ? 1 : 0,
      maxScore: 1,
    };
    setAnswers(prev => ({ ...prev, [currentIndex]: answerData }));

    if (onAnswer) {
      onAnswer({
        questionIndex: currentIndex,
        ...answerData,
        progress: { currentIndex, answers: { ...answers, [currentIndex]: answerData } }
      });
    }
  };

  // ── SATA / CaseStudy answer handler ──
  const handleComplexAnswer = (answerData) => {
    setShowFeedback(true);

    if (answerData.isCorrect) playCorrectSound();
    else playIncorrectSound();

    const storedAnswer = {
      questionType: answerData.questionType || questionType,
      isCorrect: answerData.isCorrect || false,
      score: answerData.score || 0,
      maxScore: answerData.maxScore || 1,
      percentage: answerData.percentage || 0,
    };
    setAnswers(prev => ({ ...prev, [currentIndex]: storedAnswer }));

    if (onAnswer) {
      onAnswer({
        questionIndex: currentIndex,
        ...storedAnswer,
        progress: { currentIndex, answers: { ...answers, [currentIndex]: storedAnswer } }
      });
    }
  };

  // ── Next question ──
  const handleNext = () => {
    if (isLastQuestion) {
      // Exam complete
      setIsComplete(true);
      setShowCelebration(true);
      playCelebrationSound();
      return;
    }
    setCurrentIndex(prev => prev + 1);
  };

  // ── Completion continue ──
  const handleCompletionContinue = () => {
    setShowCelebration(false);
    if (onContinue) onContinue();
  };

  // Progress percentage
  const answeredCount = Object.keys(answers).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // ════════════════════════════════════════════════════════════════
  // COMPLETION SCREEN
  // ════════════════════════════════════════════════════════════════
  if (isComplete) {
    const summary = getScoreSummary();

    if (showCelebration) {
      return (
        <div className="study-step-card">
          <StudyCelebration
            correctCount={summary.correctCount}
            totalCount={summary.total}
            expectedTotal={summary.total}
            onContinue={handleCompletionContinue}
          />
        </div>
      );
    }

    return (
      <div className="study-step-card exam-complete">
        <div className="exam-complete__header">
          <h2>{t('exam.complete', 'Mini-Test Complete')}</h2>
          <p className="exam-complete__score">{summary.percent}%</p>
          <p className="exam-complete__detail">
            {t('exam.scoreDetail', '{{correct}} of {{total}} correct', {
              correct: summary.correctCount,
              total: summary.total
            })}
          </p>
        </div>
        <button className="study-continue-btn" onClick={handleCompletionContinue}>
          {t('study.continueBtn', 'Continue')}
        </button>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // EXAM IN PROGRESS
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="study-step-card study-exam-card">
      {/* Header bar */}
      <div className="exam-header">
        <div className="exam-header__info">
          <span className="exam-header__badge">{t('exam.examBadge', 'EXAM')}</span>
          <span className="exam-header__progress">
            {t('exam.questionProgress', '{{current}} / {{total}}', {
              current: currentIndex + 1,
              total: totalQuestions
            })}
          </span>
        </div>

        <div className="exam-header__right">
          {timerEnabled && !hasAnswered && (
            <span className={`exam-header__timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {formatTime(timeLeft)}
            </span>
          )}
          {onExit && (
            <button className="exam-header__exit" onClick={onExit} title={t('transition.exit', 'Exit session')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="exam-progress-bar">
        <div className="exam-progress-bar__fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Question type badge */}
      <div className="exam-type-badge">
        {questionType === 'mcq' && t('exam.typeMCQ', 'Multiple Choice')}
        {questionType === 'sata' && t('exam.typeSATA', 'Select All That Apply')}
        {questionType === 'casestudy' && t('exam.typeCaseStudy', 'Case Study')}
      </div>

      {/* ── MCQ Renderer ── */}
      {(questionType === 'mcq' || !questionType) && currentQuestion && (
        <div className="exam-mcq">
          <p className="exam-mcq__question">{currentQuestion.question}</p>
          <div className="study-quiz-options">
            {(currentQuestion.options || []).map((opt, i) => {
              let cls = 'study-quiz-option';
              if (mcqFeedback) {
                cls += ' disabled';
                if (i === selectedMCQ) cls += mcqCorrect ? ' correct' : ' incorrect';
                if (i === currentQuestion.correctIndex && !mcqCorrect) cls += ' correct';
              }
              return (
                <button
                  key={i}
                  className={cls}
                  onClick={() => handleMCQAnswer(i)}
                  disabled={mcqFeedback}
                >
                  <span className="study-quiz-option-letter">{String.fromCharCode(65 + i)}</span>
                  <span className="study-quiz-option-text">{opt.replace(/^[A-Da-d]\)\s*/, '')}</span>
                </button>
              );
            })}
          </div>

          {/* Rationale */}
          {mcqFeedback && currentQuestion.rationale && (
            <div className="exam-mcq__rationale">
              <button
                className="exam-mcq__rationale-toggle"
                onClick={() => setShowRationale(!showRationale)}
              >
                {showRationale
                  ? t('study.showLess', 'Show less')
                  : t('study.learnMore', 'Learn more')}
              </button>
              {showRationale && (
                <p className="exam-mcq__rationale-text" dangerouslySetInnerHTML={{ __html: currentQuestion.rationale }} />
              )}
            </div>
          )}

          {/* Next button */}
          {mcqFeedback && (
            <button className="study-continue-btn" onClick={handleNext}>
              {isLastQuestion
                ? t('exam.finishExam', 'Finish Exam')
                : t('exam.nextQuestion', 'Next Question')}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── SATA Renderer ── */}
      {questionType === 'sata' && currentQuestion && (
        <SATAQuestion
          quiz={currentQuestion}
          quizIndex={currentIndex}
          totalQuestions={totalQuestions}
          onAnswerSelect={handleComplexAnswer}
          onNext={handleNext}
          isLastQuestion={isLastQuestion}
          inModal={false}
        />
      )}

      {/* ── Case Study Renderer ── */}
      {questionType === 'casestudy' && currentQuestion && (
        <CaseStudyQuestion
          quiz={currentQuestion}
          quizIndex={currentIndex}
          totalQuestions={totalQuestions}
          onAnswerSelect={handleComplexAnswer}
          onNext={handleNext}
          isLastQuestion={isLastQuestion}
          inModal={false}
        />
      )}
    </div>
  );
};

export default StudyExamCard;
