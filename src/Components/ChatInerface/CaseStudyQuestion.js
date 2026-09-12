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

function ChartIcon({ kind }) {
  return <svg className="case-chart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'observations' ? <><path d="M3 12h4l3-7 4 14 3-7h4" /><path d="M4 5V4h3M17 20h3v-1" /></> : kind === 'file' ? <><path d="M9 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-3" /><rect x="9" y="2" width="6" height="4" rx="1" /><path d="M9 12h6M12 9v6" /></> : <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>}
  </svg>;
}

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

function SortableItem({ id, item, index, isRevealed, correctPosition, isCorrectPosition, onMove, total, t }) {
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
    opacity: 1,
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
    >
      <span className="case-priority-number">{index + 1}</span>
      <button type="button" className="drag-handle" {...attributes} {...listeners} disabled={isRevealed} aria-label={t('caseStudy.moveAction', 'Drag action {{number}}', { number: index + 1 })}><DragHandleIcon /></button>
      <span className="drag-item-text">{item.text}</span>

      {!isRevealed && <div className="case-move-controls">
        <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={t('caseStudy.moveUp', 'Move action {{number}} up', { number: index + 1 })}>↑</button>
        <button type="button" disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label={t('caseStudy.moveDown', 'Move action {{number}} down', { number: index + 1 })}>↓</button>
      </div>}
      {isRevealed && (
        <span className={`drag-item-status ${isCorrectPosition ? 'correct' : 'incorrect'}`}>
          {isCorrectPosition ? <CheckmarkIcon /> : <XMarkIcon />}
        </span>
      )}

      {isRevealed && !isCorrectPosition && correctPosition !== undefined && (
        <span className="drag-item-correct-pos">
          {t('caseStudy.expectedPosition', 'Expected #{{number}}', { number: correctPosition + 1 })}
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
  onOpenModal,
  tutorPanel,
  onOpenTutor
}) {
  const { t } = useTranslation();

  // Glossary popover for clickable medical terms in rationales
  const { rationaleRef, rationaleHandlers, popover: glossaryPopover } = useGlossary();

  // ----------------------------------------
  // State
  // ----------------------------------------

  // Active tab in case study


  // Drag items (order can change)
  const [activeTab, setActiveTab] = useState(TAB_KEYS.NURSES_NOTES);
  const [mobileView, setMobileView] = useState('chart');
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

        <div className="case-mobile-switch" aria-label="Case view"><button type="button" aria-pressed={mobileView === 'chart'} onClick={() => setMobileView('chart')}>{t('caseStudy.patientFile', 'Patient chart')}</button><button type="button" aria-pressed={mobileView === 'answer'} onClick={() => setMobileView('answer')}>{t('caseStudy.yourDecision', 'Your answer')}</button></div>
        <div className={`case-split-layout case-view-${mobileView}`}>
        <div className="case-reference-pane">
        {tutorPanel || <section className="case-patient-file" aria-label={t('caseStudy.patientFile', 'Patient file')}>
          <div className="case-file-label"><span className="case-file-heading"><ChartIcon kind="file" />{t('caseStudy.patientFile', 'Patient chart')}</span>{onOpenTutor && <button type="button" onClick={onOpenTutor}>{t('caseStudy.askTutor', 'Ask your tutor')} ↗</button>}</div>
          <div className="case-chart-tabs" role="tablist" aria-label="Patient chart">
            {[{ key: TAB_KEYS.NURSES_NOTES, label: t('caseStudy.nursesNotes', 'Notes') }, { key: 'observations', label: t('caseStudy.vitalsAndLabs', 'Vitals & labs') }].map(tab => <button type="button" role="tab" aria-selected={activeTab === tab.key} key={tab.key} onClick={() => setActiveTab(tab.key)}><ChartIcon kind={tab.key} />{tab.label}</button>)}
          </div>
          <div className="case-chart-text case-chart-scroll" role="tabpanel" tabIndex={0} key={activeTab}>
            {(activeTab === TAB_KEYS.NURSES_NOTES ? [TAB_KEYS.NURSES_NOTES] : [TAB_KEYS.VITAL_SIGNS, TAB_KEYS.LAB_RESULTS]).filter(key => availableTabs.includes(key)).map(key => <section key={key}>
              {activeTab !== TAB_KEYS.NURSES_NOTES && <h3>{key === TAB_KEYS.VITAL_SIGNS ? t('caseStudy.vitalSigns', 'Vital signs') : t('caseStudy.labResults', 'Lab results')}</h3>}
              <div dangerouslySetInnerHTML={{ __html: getTabContent(key) || '' }} />
            </section>)}
            {!(activeTab === TAB_KEYS.NURSES_NOTES ? availableTabs.includes(TAB_KEYS.NURSES_NOTES) : availableTabs.some(key => key !== TAB_KEYS.NURSES_NOTES)) && <p>{t('caseStudy.noRecordedData', 'No information recorded here.')}</p>}
          </div>
        </section>}
        {tutorPanel && <p className="case-chart-return-note">{t('caseStudy.closeTutorForChart', 'Close the tutor to return to your patient chart.')}</p>}
        </div>
        <div className="case-answer-pane">
        {/* Question Text */}
        <div className="case-study-question">
          <span className="case-task-label">{t('caseStudy.yourDecision', 'Your decision')}</span>
          {quiz.question}
        </div>

        {/* Instructions */}
        {!revealed && (
          <div className="case-study-hint">
            {t('caseStudy.orderInstructions', 'Place the first action at the top. Drag the handle or use the arrows.')}
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
                    t={t}
                    total={items.length}
                    onMove={(position, direction) => setItems(current => arrayMove(current, position, position + direction))}
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
            className="case-study-submit-btn enabled"
            onClick={handleSubmit}
            disabled={!items.length}
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
              <div className="case-order-comparison">
                <section><p className="correct-order-label">{t('caseStudy.yourOrder', 'Your order')}</p><ol className="correct-order-list">{items.map(item => <li key={item.id} className="correct-order-item">{item.text}</li>)}</ol></section>
              <section className="correct-order-section">
                <p className="correct-order-label">
                  {t('caseStudy.correctOrder', 'Correct Order:')}
                </p>
                <ol className="correct-order-list">
                  {correctOrder.map(id => (
                    <li key={id} className="correct-order-item">
                      {normalizedOptions.find(item => item.id === id)?.text || id}
                    </li>
                  ))}
                </ol>
              </section></div>
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
        </div></div>
      </div>
      {glossaryPopover}
    </div>
  );
}

export default CaseStudyQuestion;
