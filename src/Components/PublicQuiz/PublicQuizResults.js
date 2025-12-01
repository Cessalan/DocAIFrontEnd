import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PublicQuizResults.css';

function PublicQuizResults({ analytics, topic, totalQuestions }) {
  const navigate = useNavigate();

  if (!analytics) {
    return null;
  }

  const { percentage, correctAnswers, incorrectAnswers, weakTopics, strongTopics } = analytics;

  // Determine performance tier
  const getPerformanceTier = () => {
    if (percentage >= 90) return {
      color: 'outstanding',
      emoji: '🏆',
      title: 'Outstanding!',
      message: 'Someone crushed this quiz!'
    };
    if (percentage >= 80) return {
      color: 'excellent',
      emoji: '🌟',
      title: 'Excellent!',
      message: 'Great performance on this quiz!'
    };
    if (percentage >= 70) return {
      color: 'good',
      emoji: '🎉',
      title: 'Well Done!',
      message: 'Solid understanding shown here!'
    };
    if (percentage >= 60) return {
      color: 'moderate',
      emoji: '💪',
      title: 'Keep Going!',
      message: 'Good start, room to improve!'
    };
    return {
      color: 'practice',
      emoji: '📚',
      title: 'Practice Needed',
      message: 'This quiz needs some work!'
    };
  };

  const performance = getPerformanceTier();

  const handlePracticeWeakAreas = () => {
    // Build practice prompt based on weak areas
    const weakAreasText = weakTopics && weakTopics.length > 0
      ? weakTopics.join(', ')
      : topic;

    const practicePrompt = `I want to practice ${weakAreasText}. Can you give me 5 challenging questions to help me improve?`;

    // Redirect to signup with quiz context
    const signupUrl = `/signup?returnTo=${encodeURIComponent(`/chat`)}&prompt=${encodeURIComponent(practicePrompt)}&quizTopic=${encodeURIComponent(topic)}`;
    navigate(signupUrl);
  };

  const handleTakeQuiz = () => {
    // Reload page to start fresh quiz
    window.location.reload();
  };

  return (
    <div className="public-quiz-results glassmorphic">
      {/* Performance Header */}
      <div className="results-header">
        <div className="performance-circle">
          <div className="circle-bg"></div>
          <div className="circle-progress" style={{ '--progress': percentage }}></div>
          <div className="circle-content">
            <div className="performance-emoji">{performance.emoji}</div>
            <div className="performance-score">{percentage}%</div>
          </div>
        </div>
        <div className="performance-text">
          <h2>{performance.title}</h2>
          <p>{performance.message}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="results-stats">
        <div className="stat-card">
          <div className="stat-icon correct">✓</div>
          <div className="stat-value">{correctAnswers}</div>
          <div className="stat-label">Correct</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon incorrect">✗</div>
          <div className="stat-value">{incorrectAnswers}</div>
          <div className="stat-label">Incorrect</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon total">📝</div>
          <div className="stat-value">{totalQuestions}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      {/* Weak Topics Alert */}
      {weakTopics && weakTopics.length > 0 && (
        <div className="weak-topics-alert">
          <div className="alert-icon">⚠️</div>
          <div className="alert-content">
            <h3>Areas to Improve</h3>
            <div className="topic-tags">
              {weakTopics.map((topic, idx) => (
                <span key={idx} className="topic-tag weak">{topic}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Strong Topics */}
      {strongTopics && strongTopics.length > 0 && (
        <div className="strong-topics-section">
          <h4>💪 Strong Areas</h4>
          <div className="topic-tags">
            {strongTopics.map((topic, idx) => (
              <span key={idx} className="topic-tag strong">{topic}</span>
            ))}
          </div>
        </div>
      )}

      {/* Virality CTA */}
      <div className="virality-cta">
        <div className="cta-badge">
          <span className="badge-icon">🚀</span>
          <span>AI-Powered Practice</span>
        </div>
        <h3>Want to master these topics?</h3>
        <p>Get personalized practice questions powered by AI</p>

        <button className="practice-btn primary" onClick={handlePracticeWeakAreas}>
          <span className="btn-icon">🎯</span>
          <span className="btn-text">Practice Weak Areas</span>
          <span className="btn-arrow">→</span>
        </button>

        <button className="practice-btn secondary" onClick={handleTakeQuiz}>
          <span className="btn-icon">🔄</span>
          <span className="btn-text">Take This Quiz</span>
        </button>

        <p className="cta-note">
          <span className="sparkle">✨</span>
          Free account • AI adapts to your level • Unlimited practice
        </p>
      </div>

      {/* Social Proof */}
      <div className="social-proof">
        <div className="proof-stats">
          <div className="proof-item">
            <strong>10,000+</strong> nursing students
          </div>
          <div className="proof-divider">•</div>
          <div className="proof-item">
            <strong>NCLEX-ready</strong> questions
          </div>
          <div className="proof-divider">•</div>
          <div className="proof-item">
            <strong>AI-powered</strong> learning
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicQuizResults;
