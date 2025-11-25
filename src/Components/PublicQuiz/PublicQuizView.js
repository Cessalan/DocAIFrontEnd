import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSharedQuiz } from '../../Services/QuizShareService';
import ChatQuiz from '../ChatInerface/ChatQuiz';
import PublicQuizResults from './PublicQuizResults';
import './PublicQuizView.css';

function PublicQuizView() {
  const { shareId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [skippedQuestions, setSkippedQuestions] = useState([]);

  useEffect(() => {
    loadQuiz();
  }, [shareId]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSharedQuiz(shareId);
      setQuizData(data);
    } catch (err) {
      setError(err.message || "Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerData) => {
    setUserAnswers(prev => {
      const existing = prev.find(a => a.quizIndex === answerData.quizIndex);
      if (existing) {
        return prev.map(a => a.quizIndex === answerData.quizIndex ? answerData : a);
      }
      return [...prev, answerData];
    });

    setSkippedQuestions(prev => prev.filter(idx => idx !== answerData.quizIndex));
  };

  const handleNext = () => {
    if (currentQuizIndex < quizData.quizzes.length - 1) {
      setCurrentQuizIndex(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const handleSkip = () => {
    if (!skippedQuestions.includes(currentQuizIndex)) {
      setSkippedQuestions(prev => [...prev, currentQuizIndex]);
    }
    handleNext();
  };

  const handleNavigate = (index) => {
    setCurrentQuizIndex(index);
    setShowResults(false);
  };

  // Calculate user's analytics from their answers
  const userAnalytics = useMemo(() => {
    if (!showResults || userAnswers.length === 0) return null;

    const correctAnswers = userAnswers.filter(a => a.isCorrect).length;
    const incorrectAnswers = userAnswers.filter(a => !a.isCorrect).length;
    const percentage = Math.round((correctAnswers / quizData.quizzes.length) * 100);

    // Calculate weak and strong topics
    const topicPerformance = {};
    userAnswers.forEach(answer => {
      const question = quizData.quizzes[answer.quizIndex];
      const topic = question.topic || quizData.topic;

      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { correct: 0, total: 0 };
      }

      topicPerformance[topic].total += 1;
      if (answer.isCorrect) {
        topicPerformance[topic].correct += 1;
      }
    });

    const weakTopics = Object.entries(topicPerformance)
      .filter(([_, perf]) => (perf.correct / perf.total) < 0.7)
      .map(([topic]) => topic);

    const strongTopics = Object.entries(topicPerformance)
      .filter(([_, perf]) => (perf.correct / perf.total) >= 0.8)
      .map(([topic]) => topic);

    return {
      totalQuestions: quizData.quizzes.length,
      correctAnswers,
      incorrectAnswers,
      percentage,
      weakTopics,
      strongTopics
    };
  }, [showResults, userAnswers, quizData]);

  const nursingIcons = (
    <>
      <div className="nursing-icon">💊</div>
      <div className="nursing-icon">🩺</div>
      <div className="nursing-icon">💉</div>
      <div className="nursing-icon">💗</div>
      <div className="nursing-icon">🏥</div>
      <div className="nursing-icon">⚕️</div>
      <div className="nursing-icon">🩹</div>
      <div className="nursing-icon">💝</div>
      <div className="nursing-icon">🌡️</div>
      <div className="nursing-icon">💕</div>
      <div className="nursing-icon">🧬</div>
      <div className="nursing-icon">💜</div>
    </>
  );

  if (loading) {
    return (
      <>
        {nursingIcons}
        <div className="public-quiz-container">
          <div className="public-quiz-loading">
            <div className="spinner"></div>
            <p>Loading quiz...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {nursingIcons}
        <div className="public-quiz-container">
          <div className="public-quiz-error">
            <div className="error-icon">⚠️</div>
            <h2>Quiz Not Found</h2>
            <p>{error}</p>
            <button
              className="back-home-btn"
              onClick={() => navigate('/')}
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!quizData) {
    return null;
  }

  return (
    <>
      {nursingIcons}
      <div className="public-quiz-container">
        <div className="public-quiz-header">
        <div className="brand">
          <h1>📚 NurseQuiz AI</h1>
        </div>
        <div className="quiz-info">
          <h2>{quizData.topic}</h2>
          <p className="quiz-meta">
            {quizData.totalQuestions} Questions • Shared Quiz
          </p>
        </div>
      </div>

      <div className="public-quiz-content">
        {showResults ? (
          <PublicQuizResults
            analytics={userAnalytics}
            topic={quizData.topic}
            totalQuestions={quizData.totalQuestions}
          />
        ) : (
          <ChatQuiz
            quiz={quizData.quizzes[currentQuizIndex]}
            quizIndex={currentQuizIndex}
            totalQuestions={quizData.quizzes.length}
            allQuizzes={quizData.quizzes}
            userAnswers={userAnswers}
            skippedQuestions={skippedQuestions}
            onAnswerSelect={handleAnswerSelect}
            onNext={handleNext}
            onSkip={handleSkip}
            onNavigate={handleNavigate}
            isLastQuestion={currentQuizIndex === quizData.quizzes.length - 1}
            messageId={`public-${shareId}`}
          />
        )}
      </div>

      <div className="public-quiz-footer">
        <p>
          {showResults
            ? <>Shared via <strong>NurseQuiz AI</strong> — Your AI study companion</>
            : <>Want to create your own AI-powered quizzes? <a href="/signup" className="signup-link">Sign up for free</a></>
          }
        </p>
      </div>
    </div>
    </>
  );
}

export default PublicQuizView;
