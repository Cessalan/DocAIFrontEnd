import React from 'react';
import { useTranslation } from 'react-i18next';
import StudyLessonCard from './StudyLessonCard';
import StudyQuizCard from './StudyQuizCard';
import StudyFlashcardCard from './StudyFlashcardCard';
import StudyAudioCard from './StudyAudioCard';

/**
 * StudyStepCard - Routes to the correct card component based on node type
 *
 * @param {Object} node - Current active node
 * @param {Object} content - Generated content for the node
 * @param {Object} savedProgress - Saved progress for resuming (flashcard/quiz)
 * @param {boolean} isLoading - Whether content is being generated
 * @param {boolean} isGeneratingAudio - Whether audio is being generated
 * @param {string} audioGeneratingMessage - Message during audio generation
 * @param {Function} onAnswer - Callback for quiz answers
 * @param {Function} onReview - Callback for flashcard reviews
 * @param {Function} onGenerateAudio - Callback to trigger audio generation
 * @param {Function} onContinue - Callback when step is completed
 * @param {Function} onExit - Callback to exit/close the current card
 */
const StudyStepCard = ({
  node,
  content,
  savedProgress = null,
  isLoading = false,
  isGeneratingAudio = false,
  audioGeneratingMessage = '',
  onAnswer,
  onReview,
  onGenerateAudio,
  onContinue,
  onExit
}) => {
  const { t } = useTranslation();

  // Loading state
  if (isLoading) {
    return (
      <div className="study-step-card">
        <div className="study-loading">
          <div className="study-loading-spinner" />
          <p className="study-loading-text">
            {t('study.preparing', { type: t(`study.nodeType.${node?.type}`, node?.type || 'content').toLowerCase(), defaultValue: `Preparing your ${node?.type || 'content'}...` })}
          </p>
        </div>
      </div>
    );
  }

  // No node or content
  if (!node || !content) {
    return (
      <div className="study-step-card">
        <div className="study-loading">
          <p className="study-loading-text">
            {t('study.startingSession', 'Starting your study session...')}
          </p>
        </div>
      </div>
    );
  }

  // Route to correct card type
  switch (node.type) {
    case 'lesson':
      return (
        <StudyLessonCard
          content={content}
          onContinue={onContinue}
          onExit={onExit}
        />
      );

    case 'quiz':
      return (
        <StudyQuizCard
          content={content}
          savedProgress={savedProgress}
          onAnswer={onAnswer}
          onContinue={onContinue}
          onExit={onExit}
        />
      );

    case 'flashcard':
      return (
        <StudyFlashcardCard
          content={content}
          savedProgress={savedProgress}
          onReview={onReview}
          onContinue={onContinue}
          onExit={onExit}
        />
      );

    case 'audio':
      return (
        <StudyAudioCard
          content={content}
          isGenerating={isGeneratingAudio}
          generatingMessage={audioGeneratingMessage}
          onGenerateAudio={onGenerateAudio}
          onContinue={onContinue}
          onExit={onExit}
        />
      );

    default:
      return (
        <div className="study-step-card">
          <div className="study-loading">
            <p className="study-loading-text">
              Unknown content type: {node.type}
            </p>
          </div>
        </div>
      );
  }
};

export default StudyStepCard;
