import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './OrientationFlow.css';

/**
 * OrientationFlow - Post-upload guided insight experience
 *
 * Shows 2-3 key insights from uploaded file with zero-effort progress.
 * Flow: Passive reading → "Got it" → Progress update → Next insight or continue
 *
 * Props:
 * - insights: Array of { topic, insight, explanation } from backend
 * - topics: Array of topic strings extracted from file
 * - filename: Name of uploaded file
 * - onComplete: Callback when orientation is done
 * - onContinue: Callback when user clicks "Continue studying"
 * - onLater: Callback when user clicks "Do this later"
 */
const OrientationFlow = ({
  insights = [],
  topics = [],
  filename,
  onComplete,
  onContinue,
  onLater
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0); // 0 = intro, 1+ = insights, final = CTA
  const [progress, setProgress] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const buttonTimerRef = useRef(null);

  // Generate insights from topics if not provided directly
  const generatedInsights = insights.length > 0 ? insights : generateInsightsFromTopics(topics);
  const totalSteps = generatedInsights.length + 2; // intro + insights + final CTA

  // Delay showing button for 1.5s to encourage reading first
  useEffect(() => {
    setShowButton(false);
    buttonTimerRef.current = setTimeout(() => {
      setShowButton(true);
    }, 1500);

    return () => {
      if (buttonTimerRef.current) {
        clearTimeout(buttonTimerRef.current);
      }
    };
  }, [currentStep]);

  // Calculate progress based on current step
  useEffect(() => {
    const progressPerStep = 100 / (totalSteps - 1);
    setProgress(Math.min(currentStep * progressPerStep, 100));
  }, [currentStep, totalSteps]);

  const handleGotIt = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleContinue = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (onContinue) onContinue();
      if (onComplete) onComplete();
    }, 300);
  };

  const handleLater = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (onLater) onLater();
      if (onComplete) onComplete();
    }, 300);
  };

  // Intro screen (step 0)
  const renderIntro = () => (
    <div className="orientation-card orientation-intro">
      <div className="orientation-icon">🧠</div>
      <h2 className="orientation-title">{t('orientation.analyzed')}</h2>
      <p className="orientation-subtitle">
        {t('orientation.keyTopics', { count: generatedInsights.length })}
      </p>
      <div className="orientation-topics">
        {generatedInsights.slice(0, 3).map((insight, idx) => (
          <span key={idx} className="orientation-topic-pill">
            {insight.topic}
          </span>
        ))}
      </div>
    </div>
  );

  // Insight screen (steps 1 to n)
  const renderInsight = (insight, index) => {
    // Handle key_points (new format) or relevance (old format) as array
    const keyPoints = Array.isArray(insight.key_points)
      ? insight.key_points
      : Array.isArray(insight.relevance)
        ? insight.relevance
        : insight.relevance
          ? [insight.relevance]
          : [];

    return (
      <div className="orientation-card orientation-insight">
        <div className="orientation-insight-header">
          <span className="insight-emoji">💡</span>
          <span className="insight-topic">{insight.topic}</span>
          <span className="insight-level-badge">{t('orientation.basics')}</span>
        </div>
        {insight.insight && (
          <p className="insight-text">{insight.insight}</p>
        )}
        {keyPoints.length > 0 && (
          <ul className="insight-relevance-list">
            {keyPoints.map((item, idx) => (
              <li key={idx} className="insight-relevance-item">{item}</li>
            ))}
          </ul>
        )}
        {insight.context && (
          <p className="insight-context">{insight.context}</p>
        )}
      </div>
    );
  };

  // Final CTA screen
  const renderFinalCTA = () => (
    <div className="orientation-card orientation-complete">
      <div className="orientation-icon">✅</div>
      <h2 className="orientation-title">{t('orientation.goodStart')}</h2>
      <p className="orientation-subtitle">
        {t('orientation.coveredBasics')}
      </p>
      <div className="orientation-cta-buttons">
        <button
          className="orientation-btn orientation-btn-primary"
          onClick={handleContinue}
        >
          {t('orientation.continueStudying')}
        </button>
        <button
          className="orientation-btn orientation-btn-secondary"
          onClick={handleLater}
        >
          {t('orientation.doLater')}
        </button>
      </div>
    </div>
  );

  // Determine what to render based on current step
  const renderCurrentStep = () => {
    if (currentStep === 0) {
      return renderIntro();
    } else if (currentStep <= generatedInsights.length) {
      return renderInsight(generatedInsights[currentStep - 1], currentStep - 1);
    } else {
      return renderFinalCTA();
    }
  };

  // Check if we're on the final CTA step
  const isFinalStep = currentStep >= totalSteps - 1;

  return (
    <div className={`orientation-flow ${isExiting ? 'orientation-exiting' : ''}`}>
      {/* Progress bar */}
      <div className="orientation-progress-container">
        <div
          className="orientation-progress-bar"
          style={{ width: `${progress}%` }}
        />
        <span className="orientation-progress-text">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Content */}
      <div className="orientation-content">
        {renderCurrentStep()}
      </div>

      {/* Got it button (hidden on final step) */}
      {!isFinalStep && (
        <div className={`orientation-action ${showButton ? 'visible' : ''}`}>
          <button
            className="orientation-got-it-btn"
            onClick={handleGotIt}
            disabled={!showButton}
          >
            {t('orientation.gotIt')}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Simple fallback when backend doesn't provide insights
 * Just shows topic names - the real educational content should come from the backend
 */
function generateInsightsFromTopics(topics) {
  if (!topics || topics.length === 0) {
    return [{
      topic: 'Your Document',
      insight: 'We\'ve analyzed your material and identified key concepts.',
      explanation: ''
    }];
  }

  // Simple fallback - just show topics without fake educational content
  return topics.slice(0, 3).map(topic => ({
    topic: topic,
    insight: '',  // Backend should provide the real insight
    explanation: ''
  }));
}

export default OrientationFlow;
