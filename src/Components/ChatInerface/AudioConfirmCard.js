import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './AudioConfirmCard.css';

/**
 * AudioConfirmCard - Shows audio generation options for user confirmation
 * Displays topic, intent style, and duration options
 */
const AudioConfirmCard = ({
  topic,
  intent,
  styleName,
  styleDescription,
  durations,
  defaultDuration,
  onGenerate,
  onCancel
}) => {
  const { t } = useTranslation();
  const [selectedDuration, setSelectedDuration] = useState(defaultDuration);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    onGenerate(selectedDuration);
  };

  // Format duration for display
  const formatDuration = (dur) => {
    const num = parseInt(dur);
    return `${num} ${num === 1 ? t('audio.minute', 'min') : t('audio.minutes', 'min')}`;
  };

  // Get icon based on intent
  const getIntentIcon = () => {
    switch (intent) {
      case 'teach': return '🎓';
      case 'summarize': return '📋';
      case 'deep_dive': return '🔬';
      case 'simplify': return '💡';
      case 'progress': return '📊';
      default: return '🎙️';
    }
  };

  // Get translated style name based on intent
  const getTranslatedStyleName = () => {
    switch (intent) {
      case 'teach': return t('audio.fullLesson', 'Full Lesson');
      case 'summarize': return t('audio.quickSummary', 'Quick Summary');
      case 'deep_dive': return t('audio.deepDive', 'Deep Dive');
      case 'simplify': return t('audio.simpleExplanation', 'Simple Explanation');
      case 'progress': return t('audio.progressReport', 'Progress Report');
      default: return styleName;
    }
  };

  // Get translated style description based on intent
  const getTranslatedStyleDescription = () => {
    switch (intent) {
      case 'teach': return t('audio.fullLessonDesc', 'Structured lesson with examples and clinical context');
      case 'summarize': return t('audio.quickSummaryDesc', 'Key points only, concise overview');
      case 'deep_dive': return t('audio.deepDiveDesc', 'Comprehensive, detailed exploration');
      case 'simplify': return t('audio.simpleExplanationDesc', 'Beginner-friendly, uses analogies');
      case 'progress': return t('audio.progressReportDesc', 'Your stats, achievements, and recommendations');
      default: return styleDescription;
    }
  };

  return (
    <div className="audio-confirm-card">
      <div className="audio-confirm-header">
        <span className="audio-icon">{getIntentIcon()}</span>
        <div className="audio-header-text">
          <h3 className="audio-title">{t('audio.readyToGenerate', 'Audio Ready')}</h3>
          <span className="audio-style-name">{getTranslatedStyleName()}</span>
        </div>
      </div>

      <div className="audio-confirm-content">
        <div className="audio-topic-row">
          <span className="audio-label">{t('audio.topic', 'Topic')}:</span>
          <span className="audio-topic">{topic}</span>
        </div>

        <p className="audio-style-description">{getTranslatedStyleDescription()}</p>

        <div className="audio-duration-section">
          <span className="audio-label">{t('audio.duration', 'Duration')}:</span>
          <div className="audio-duration-options">
            {durations.map((dur) => (
              <button
                key={dur}
                className={`audio-duration-btn ${selectedDuration === dur ? 'selected' : ''}`}
                onClick={() => setSelectedDuration(dur)}
                disabled={isGenerating}
              >
                {formatDuration(dur)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="audio-confirm-actions">
        <button
          className="audio-cancel-btn"
          onClick={onCancel}
          disabled={isGenerating}
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          className="audio-generate-btn"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="audio-spinner"></span>
              {t('audio.generating', 'Generating...')}
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              {t('audio.generate', 'Generate Audio')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AudioConfirmCard;
