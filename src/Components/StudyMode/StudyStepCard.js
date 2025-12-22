import React from 'react';
import StudyLessonCard from './StudyLessonCard';
import StudyQuizCard from './StudyQuizCard';
import StudyFlashcardCard from './StudyFlashcardCard';
import StudyAudioCard from './StudyAudioCard';

/**
 * StudyStepCard - Routes to the correct card component based on node type
 *
 * @param {Object} node - Current active node
 * @param {Object} content - Generated content for the node
 * @param {boolean} isLoading - Whether content is being generated
 * @param {boolean} isGeneratingAudio - Whether audio is being generated
 * @param {string} audioGeneratingMessage - Message during audio generation
 * @param {Function} onAnswer - Callback for quiz answers
 * @param {Function} onReview - Callback for flashcard reviews
 * @param {Function} onGenerateAudio - Callback to trigger audio generation
 * @param {Function} onContinue - Callback when step is completed
 */
const StudyStepCard = ({
  node,
  content,
  isLoading = false,
  isGeneratingAudio = false,
  audioGeneratingMessage = '',
  onAnswer,
  onReview,
  onGenerateAudio,
  onContinue
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="study-step-card">
        <div className="study-loading">
          <div className="study-loading-spinner" />
          <p className="study-loading-text">
            Preparing your {node?.type || 'content'}...
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
            Click START on a node to begin
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
        />
      );

    case 'quiz':
      return (
        <StudyQuizCard
          content={content}
          onAnswer={onAnswer}
          onContinue={onContinue}
        />
      );

    case 'flashcard':
      return (
        <StudyFlashcardCard
          content={content}
          onReview={onReview}
          onContinue={onContinue}
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
