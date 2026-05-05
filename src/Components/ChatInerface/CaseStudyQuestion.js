/**
 * ============================================
 * CASE STUDY / BOWTIE QUESTION COMPONENT
 * ============================================
 *
 * NGN (Next Generation NCLEX) style case study question with:
 * - Tabbed clinical data (Nurses' Notes, Vital Signs, Lab Results)
 * - Drag-and-drop reordering for answers
 * - NCLEX-style scoring
 *
 * Props:
 * - quiz: The question data object with caseStudy tabs and ordering items
 * - quizIndex: Index of current question
 * - totalQuestions: Total number of questions
 * - onAnswerSelect: Callback when answer is submitted
 * - onNext: Callback to move to next question
 * - isLastQuestion: Boolean indicating if this is the last question
 * - inModal: Boolean for fullscreen modal styling
 *
 * @author NurseQuiz Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { calculateOrderingScore } from '../../utils/quizScoring';
import './CaseStudyQuestion.css';
import useGlossary from '../Glossary/useGlossary';

// ============================================
// CONSTANTS
// ============================================

const TAB_KEYS = {
  NURSES_NOTES: 'nursesNotes',
  VITAL_SIGNS: 'vitalSigns',
  LAB_RESULTS: 'labResults',
};

// ============================================
// ICON COMPONENTS
// ============================================

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm8-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
    </svg>
  );
}

function CheckmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XMarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

// ============================================
// SORTABLE ITEM COMPONENT
// ============================================

// ============================================
// SORTABLE ITEM COMPONENT
// ============================================

function SortableItem({ id, item, index, isRevealed, correctPosition, isCorrectPosition }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isRevealed });

  // Only apply Y-axis transform to prevent horizontal movement
  const style = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  let itemClass = 'case-study-drag-item';
  if (isDragging) itemClass += ' dragging';
  if (isRevealed) {
    itemClass += isCorrectPosition ? ' correct' : ' incorrect';
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={itemClass}
      {...attributes}
      {...listeners}
    >
      <span className="drag-handle">
        <DragHandleIcon />
      </span>
      {/* Index number removed as per user request */}
      <span className="drag-item-text">{item.text}</span>

      {isRevealed && (
        <span className={`drag-item-status ${isCorrectPosition ? 'correct' : 'incorrect'}`}>
          {isCorrectPosition ? <CheckmarkIcon /> : <XMarkIcon />}
        </span>
      )}

      {isRevealed && !isCorrectPosition && correctPosition !== undefined && (
        <span className="drag-item-correct-pos">
          (Should be #{correctPosition + 1})
        </span>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

function CaseStudyQuestion({
  quiz,
  quizIndex = 0,
  totalQuestions = 0,
  onAnswerSelect,
  onNext,
  onSkip,
  isLastQuestion = false,
  inModal = false,
  reviewMode = false,
  previousAnswer = null,
  onOpenModal
}) {
  const { t } = useTranslation();

  // Glossary popover for clickable medical terms in rationales
  const { rationaleRef, rationaleHandlers, popover: glossaryPopover } = useGlossary();

  // ----------------------------------------
  // State
  // ----------------------------------------

  // Active tab in case study
  const [activeTab, setActiveTab] = useState(TAB_KEYS.NURSES_NOTES);

  // Drag items (order can change)
  const [items, setItems] = useState([]);

  // Track if answer has been submitted
  const [revealed, setRevealed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);

  // Track initialization to prevent re-init during same question
  const initializedQuizRef = useRef(null);

  // ----------------------------------------
  // DnD Sensors
  // ----------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ----------------------------------------
  // Derived Values
  // ----------------------------------------

  // Normalize options with stable IDs
  const normalizedOptions = useMemo(() => {
    if (!quiz?.options) return [];
    return quiz.options.map((item, index) => {
      if (typeof item === 'string') {
        return { id: item, text: item, original: item };
      }
      // Ensure object has ID
      // Use existing ID, or text as ID (if unique enough), or fallback to index-based
      // We prefer text over index because correctOrder might not have same index
      const id = item.id || (item.text ? `text-${item.text.substring(0, 20)}-${index}` : `item-${index}`);
      return {
        ...item,
        id,
        text: item.text || item.content || JSON.stringify(item),
        original: item
      };
    });
  }, [quiz?.options]);

  // Get correct order from quiz, mapped to our normalized IDs
  const correctOrder = useMemo(() => {
    if (!quiz?.correctOrder) return [];

    return quiz.correctOrder.map(correctItem => {
      // 1. If it's a string, it might be an ID or the text itself
      if (typeof correctItem === 'string') {
        // Check if it matches an ID in our normalized options
        const matchById = normalizedOptions.find(opt => opt.id === correctItem);
        if (matchById) return matchById.id;

        // Check if it matches text
        const matchByText = normalizedOptions.find(opt => opt.text === correctItem);
        if (matchByText) return matchByText.id;

        return correctItem; // Fallback
      }

      // 2. If it's an object, try to match by ID or Text or Reference
      if (correctItem.id) {
        const matchById = normalizedOptions.find(opt => opt.id === correctItem.id);
        if (matchById) return matchById.id;
        return correctItem.id;
      }

      // Match by text content
      const text = correctItem.text || correctItem.content;
      if (text) {
        const matchByText = normalizedOptions.find(opt => opt.text === text);
        if (matchByText) return matchByText.id;
      }

      return null;
    }).filter(Boolean); // Remove nulls
  }, [quiz?.correctOrder, normalizedOptions]);

  // Progress bar style
  const progressStyle = useMemo(() => {
    if (totalQuestions === 0) return { width: '0%' };
    return { width: `${((quizIndex + 1) / totalQuestions) * 100}%` };
  }, [quizIndex, totalQuestions]);

  // Check if user has reordered (can submit)
  const hasReordered = useMemo(() => {
    if (!normalizedOptions || items.length === 0) return false;

    const initialIds = normalizedOptions.map(item => item.id);
    const currentIds = items.map(item => item.id);
    return JSON.stringify(initialIds) !== JSON.stringify(currentIds);
  }, [normalizedOptions, items]);

  // Memoize item IDs for SortableContext
  const itemIds = useMemo(() => items.map(item => item.id), [items]);

  // Determine which tabs have content (vitalSigns/labResults are optional)
  const availableTabs = useMemo(() => {
    if (!quiz?.caseStudy) return [];
    const tabs = [];
    if (quiz.caseStudy.nursesNotes) tabs.push(TAB_KEYS.NURSES_NOTES);
    if (quiz.caseStudy.vitalSigns && quiz.caseStudy.vitalSigns.trim() !== '') tabs.push(TAB_KEYS.VITAL_SIGNS);
    if (quiz.caseStudy.labResults && quiz.caseStudy.labResults.trim() !== '') tabs.push(TAB_KEYS.LAB_RESULTS);
    return tabs;
  }, [quiz?.caseStudy]);

  // ----------------------------------------
  // Effects
  // ----------------------------------------

  // Create a stable quiz identifier
  const quizId = quiz?.question ? `${quiz.question}-${quizIndex}` : null;

  // Initialize items when quiz changes
  useEffect(() => {
    // Skip if no quiz or already initialized for this quiz
    if (!quiz?.options) return;

    if (initializedQuizRef.current === quizId) {
      return;
    }

    // Mark as initialized
    initializedQuizRef.current = quizId;

    if (previousAnswer && previousAnswer.userOrder) {
      // Restore previous answer order
      const orderedItems = previousAnswer.userOrder.map(id => {
        return normalizedOptions.find(item => item.id === id) || { id, text: 'Unknown Item' };
      });

      setItems(orderedItems);
      setRevealed(true);
      setShowFeedback(true);
      setScoreResult(previousAnswer.scoreResult || null);
    } else {
      // Initialize with normalized options
      setItems(normalizedOptions);
      setRevealed(false);
      setShowFeedback(false);
      setScoreResult(null);
    }
    // Reset to first available tab
    setActiveTab(availableTabs[0] || TAB_KEYS.NURSES_NOTES);
  }, [quizId, quiz?.options, previousAnswer, normalizedOptions, availableTabs]);

  // ----------------------------------------
  // Handlers
  // ----------------------------------------

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;

    // Only process if we have valid active and over targets
    if (!active || !over) {
      return;
    }

    // Only reorder if dropped on a different item
    if (active.id !== over.id) {
      setItems((prevItems) => {
        const oldIndex = prevItems.findIndex(item => item.id === active.id);
        const newIndex = prevItems.findIndex(item => item.id === over.id);

        // Safety check: ensure both indices are valid
        if (oldIndex === -1 || newIndex === -1) {
          return prevItems;
        }

        const newItems = arrayMove(prevItems, oldIndex, newIndex);
        return newItems;
      });
    } else {
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (revealed || !quiz) return;

    setRevealed(true);

    // Calculate score
    const userOrder = items.map(item => item.id);
    const result = calculateOrderingScore(userOrder, correctOrder, 'partial');
    setScoreResult(result);

    // Show feedback after animation
    setTimeout(() => {
      setShowFeedback(true);
    }, 300);

    // Call parent callback
    if (onAnswerSelect) {
      onAnswerSelect({
        quizIndex,
        questionType: 'casestudy',
        questionText: quiz.question,
        userOrder,
        correctOrder,
        scoreResult: result,
        isCorrect: result.isFullyCorrect,
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        timestamp: new Date()
      });
    }
  }, [revealed, quiz, items, correctOrder, quizIndex, onAnswerSelect]);

  // ----------------------------------------
  // Early Return
  // ----------------------------------------

  if (!quiz) return null;

  // ----------------------------------------
  // Render Helpers
  // ----------------------------------------

  // Get tab content
  const getTabContent = (tabKey) => {
    if (!quiz.caseStudy) return null;

    switch (tabKey) {
      case TAB_KEYS.NURSES_NOTES:
        return quiz.caseStudy.nursesNotes;
      case TAB_KEYS.VITAL_SIGNS:
        return quiz.caseStudy.vitalSigns;
      case TAB_KEYS.LAB_RESULTS:
        return quiz.caseStudy.labResults;
      default:
        return null;
    }
  };

  // Check if item is in correct position
  const getItemFeedback = (itemId, currentIndex) => {
    const correctIndex = correctOrder.indexOf(itemId);
    return {
      isCorrectPosition: correctIndex === currentIndex,
      correctPosition: correctIndex
    };
  };

  // ----------------------------------------
  // Main Render
  // ----------------------------------------

  return (
    <div className={`case-study-container glassmorphic ${inModal ? 'in-modal' : ''}`}>
      <div className="case-study-content-wrapper">

        {/* Header */}
        <div className="case-study-header">
          <div className="case-study-title-row">
            <span className="case-study-title">
              {t('quiz.question')} {quizIndex + 1} {t('quiz.of')} {totalQuestions}
              {reviewMode && (
                <span className="review-badge"> ({t('quiz.review')})</span>
              )}
            </span>
            <div className="case-study-header-actions">
              <span className="case-study-type-badge">
                {t('caseStudy.badge', 'Case Study')}
              </span>
              {!inModal && onOpenModal && (
                <button
                  className="case-study-expand-btn"
                  onClick={onOpenModal}
                  aria-label="View fullscreen"
                  type="button"
                >
                  <ExpandIcon />
                </button>
              )}
            </div>
          </div>
          <div className="case-study-progress-track">
            <div className="case-study-progress-fill" style={progressStyle} />
          </div>
        </div>

        {/* Topic Badge */}
        {quiz.topic && (
          <div className="case-study-topic-badge">
            <span className="topic-badge-icon">📋</span>
            <span className="topic-badge-text">{quiz.topic}</span>
          </div>
        )}

        {/* Case Study Tabs — only render tabs that have content */}
        {quiz.caseStudy && availableTabs.length > 0 && (
          <div className="case-study-tabs-container">
            {/* Show tab bar only when there are 2+ tabs; single tab renders content directly */}
            {availableTabs.length > 1 && (
              <div className="case-study-tabs">
                {availableTabs.includes(TAB_KEYS.NURSES_NOTES) && (
                  <button
                    className={`case-study-tab ${activeTab === TAB_KEYS.NURSES_NOTES ? 'active' : ''}`}
                    onClick={() => setActiveTab(TAB_KEYS.NURSES_NOTES)}
                    type="button"
                  >
                    {t('caseStudy.nursesNotes', "Nurses' Notes")}
                  </button>
                )}
                {availableTabs.includes(TAB_KEYS.VITAL_SIGNS) && (
                  <button
                    className={`case-study-tab ${activeTab === TAB_KEYS.VITAL_SIGNS ? 'active' : ''}`}
                    onClick={() => setActiveTab(TAB_KEYS.VITAL_SIGNS)}
                    type="button"
                  >
                    {t('caseStudy.vitalSigns', 'Vital Signs')}
                  </button>
                )}
                {availableTabs.includes(TAB_KEYS.LAB_RESULTS) && (
                  <button
                    className={`case-study-tab ${activeTab === TAB_KEYS.LAB_RESULTS ? 'active' : ''}`}
                    onClick={() => setActiveTab(TAB_KEYS.LAB_RESULTS)}
                    type="button"
                  >
                    {t('caseStudy.labResults', 'Laboratory Results')}
                  </button>
                )}
              </div>
            )}

            <div className="case-study-tab-content">
              {getTabContent(activeTab) ? (
                <div
                  className="tab-content-inner"
                  dangerouslySetInnerHTML={{ __html: getTabContent(activeTab) }}
                />
              ) : (
                <p className="tab-content-empty">
                  {t('caseStudy.noData', 'No data available for this tab.')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Question Text */}
        <div className="case-study-question">
          {quiz.question}
        </div>

        {/* Instructions */}
        {!revealed && (
          <div className="case-study-hint">
            {t('caseStudy.dragHint', 'Drag and drop to arrange in the correct order')}
          </div>
        )}

        {/* Drag and Drop Area */}
        <div className="case-study-drag-area">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item, index) => {
                const feedback = getItemFeedback(item.id, index);
                return (
                  <SortableItem
                    key={item.id}
                    id={item.id}
                    item={item}
                    index={index}
                    isRevealed={revealed}
                    correctPosition={feedback.correctPosition}
                    isCorrectPosition={feedback.isCorrectPosition}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>

        {/* Submit Button */}
        {!revealed && !reviewMode && (
          <button
            className={`case-study-submit-btn ${hasReordered ? 'enabled' : 'disabled'}`}
            onClick={handleSubmit}
            disabled={!hasReordered}
            type="button"
          >
            {t('caseStudy.submitOrder', 'Submit Order')}
          </button>
        )}

        {/* Skip Button */}
        {!revealed && onSkip && !reviewMode && (
          <button
            className="case-study-skip-btn"
            onClick={onSkip}
            type="button"
          >
            {t('quiz.skipQuestion')} →
          </button>
        )}

        {/* Feedback Section */}
        {showFeedback && scoreResult && (
          <div className={`case-study-feedback ${scoreResult.isFullyCorrect ? 'correct' : scoreResult.percentage >= 50 ? 'partial' : 'incorrect'}`}>
            <div className="feedback-header">
              <span className={`feedback-status ${scoreResult.isFullyCorrect ? 'correct' : scoreResult.percentage >= 50 ? 'partial' : 'incorrect'}`}>
                {scoreResult.isFullyCorrect
                  ? `✓ ${t('quiz.thatsRight')}`
                  : scoreResult.percentage >= 50
                    ? `◐ ${t('caseStudy.partialCredit', 'Partial Credit')}`
                    : `✗ ${t('quiz.notQuite')}`
                }
              </span>
              <span className="feedback-score">
                {scoreResult.correctPositions}/{scoreResult.totalItems}
              </span>
            </div>

            {/* Show correct order if not fully correct */}
            {!scoreResult.isFullyCorrect && (
              <div className="correct-order-section">
                <p className="correct-order-label">
                  {t('caseStudy.correctOrder', 'Correct Order:')}
                </p>
                <ol className="correct-order-list">
                  {quiz.correctOrder.map((item, index) => (
                    <li key={item.id} className="correct-order-item">
                      {item.text}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Justification */}
            {quiz.justification && (
              <div className="feedback-rationale-container">
                <div
                  ref={rationaleRef}
                  className="feedback-rationale-content"
                  {...rationaleHandlers}
                  data-selectable="true"
                  dangerouslySetInnerHTML={{ __html: quiz.justification }}
                />
              </div>
            )}
          </div>
        )}

        {/* Next Button */}
        {showFeedback && onNext && (
          <button
            className="case-study-next-btn"
            onClick={onNext}
            type="button"
          >
            {isLastQuestion
              ? `${t('quiz.viewResults')} →`
              : `${t('quiz.nextQuestion')} →`
            }
          </button>
        )}
      </div>
      {glossaryPopover}
    </div>
  );
}

export default CaseStudyQuestion;
