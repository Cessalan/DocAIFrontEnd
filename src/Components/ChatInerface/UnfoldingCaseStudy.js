/**
 * ============================================
 * UnfoldingCaseStudy Component
 * ============================================
 *
 * WHAT THIS COMPONENT DOES:
 * -------------------------
 * Renders an NCLEX NGN-style "Unfolding Case Study" with:
 * - 6 items per case (each with its own question)
 * - Two-column layout (clinical data on left, question on right)
 * - 4 tabs for clinical data (Health History, Assessment, Vital Signs, Labs)
 * - Mixed question types (MCQ and SATA) within the same case
 * - Navigation between items
 * - Progressive scoring
 *
 * VISUAL LAYOUT:
 * --------------
 * +--------------------------------------------------------+
 * | 🏥 Unfolding Case Study            Item 1 of 6         |
 * | Patient: 45-year-old female with chest pain            |
 * +---------------------------+----------------------------+
 * | [Health History] [Assess] |                            |
 * | [Vitals] [Labs]           | Question text here...      |
 * |                           |                            |
 * | Tab content displays      | [ ] Option A               |
 * | clinical data here...     | [ ] Option B               |
 * |                           | [x] Option C               |
 * |                           | [ ] Option D               |
 * +---------------------------+----------------------------+
 * |        [◀ Previous]   [Next Item ▶]                    |
 * +--------------------------------------------------------+
 *
 * PROPS:
 * ------
 * @param {Object} question - The complete unfolding case study object
 * @param {number} questionIndex - Index in parent quiz (not item index)
 * @param {boolean} inModal - Whether displayed in modal (for styling)
 * @param {Function} onAnswerChange - Callback when answers change
 * @param {boolean} showResults - Whether to show correct/incorrect
 * @param {Array} userAnswers - Array of user answers for all 6 items
 *
 * DATA STRUCTURE EXPECTED:
 * ------------------------
 * {
 *   questionType: "unfoldingCase",
 *   scenario: {
 *     patientInfo: "45-year-old female...",
 *     setting: "Emergency Department",
 *     items: [
 *       {
 *         itemNumber: 1,
 *         progressNote: "Initial presentation...",
 *         clinicalData: {
 *           healthHistory: "...",
 *           assessment: "...",
 *           vitalSigns: "...",
 *           labResults: "..."
 *         },
 *         question: "Which actions should...",
 *         questionType: "sata" | "mcq",
 *         options: ["A) ...", "B) ..."],
 *         answer: ["A) ...", "C) ..."] | "B) ...",
 *         justification: "..."
 *       },
 *       // ... 5 more items
 *     ]
 *   }
 * }
 *
 * @author NurseQuiz Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import './UnfoldingCaseStudy.css';

// ============================================
// MAIN COMPONENT
// ============================================

const UnfoldingCaseStudy = ({
  question,
  questionIndex = 0,
  inModal = false,
  onAnswerChange,
  showResults = false,
  userAnswers = []
}) => {
  // -----------------------------------------
  // STATE MANAGEMENT
  // -----------------------------------------

  // Current item being viewed (0-5 for 6 items)
  const [currentItemIndex, setCurrentItemIndex] = useState(0);

  // Active clinical data tab
  const [activeTab, setActiveTab] = useState('healthHistory');

  // Answers for each item: { 0: ["A)", "C)"], 1: ["B)"], ... }
  const [itemAnswers, setItemAnswers] = useState({});

  // Whether each item has been submitted
  const [submittedItems, setSubmittedItems] = useState({});

  // -----------------------------------------
  // EXTRACT DATA FROM QUESTION PROP
  // -----------------------------------------

  const scenario = question?.scenario || {};
  const items = scenario?.items || [];
  const totalItems = items.length;
  const currentItem = items[currentItemIndex] || {};
  const clinicalData = currentItem?.clinicalData || {};

  // -----------------------------------------
  // INITIALIZE FROM PARENT'S userAnswers
  // -----------------------------------------

  useEffect(() => {
    // If parent passed userAnswers, use them
    if (userAnswers && userAnswers.length > 0) {
      const answersObj = {};
      userAnswers.forEach((ans, idx) => {
        if (ans) {
          answersObj[idx] = Array.isArray(ans) ? ans : [ans];
        }
      });
      setItemAnswers(answersObj);
    }
  }, [userAnswers]);

  // -----------------------------------------
  // TAB DEFINITIONS
  // -----------------------------------------

  const tabs = [
    { id: 'healthHistory', label: 'Health History', icon: '📋' },
    { id: 'assessment', label: 'Assessment', icon: '🩺' },
    { id: 'vitalSigns', label: 'Vital Signs', icon: '💓' },
    { id: 'labResults', label: 'Lab Results', icon: '🧪' }
  ];

  // -----------------------------------------
  // HANDLERS
  // -----------------------------------------

  /**
   * Handle option selection for the current item.
   * MCQ: Single selection (replaces previous)
   * SATA: Toggle selection (adds/removes)
   */
  const handleOptionSelect = useCallback((option) => {
    if (showResults || submittedItems[currentItemIndex]) {
      return; // Don't allow changes after submission
    }

    const itemType = currentItem?.questionType || 'mcq';
    const currentAnswers = itemAnswers[currentItemIndex] || [];

    let newAnswers;

    if (itemType === 'mcq') {
      // MCQ: Only one answer allowed
      newAnswers = [option];
    } else {
      // SATA: Toggle the selection
      if (currentAnswers.includes(option)) {
        // Remove if already selected
        newAnswers = currentAnswers.filter(a => a !== option);
      } else {
        // Add to selection
        newAnswers = [...currentAnswers, option];
      }
    }

    // Update local state
    const updatedAnswers = {
      ...itemAnswers,
      [currentItemIndex]: newAnswers
    };
    setItemAnswers(updatedAnswers);

    // Notify parent of change
    if (onAnswerChange) {
      // Convert to array format for parent
      const answersArray = items.map((_, idx) => updatedAnswers[idx] || []);
      onAnswerChange(answersArray);
    }
  }, [currentItemIndex, currentItem, itemAnswers, items, onAnswerChange, showResults, submittedItems]);

  /**
   * Navigate to the next item
   */
  const goToNextItem = useCallback(() => {
    if (currentItemIndex < totalItems - 1) {
      setCurrentItemIndex(prev => prev + 1);
      setActiveTab('healthHistory'); // Reset to first tab
    }
  }, [currentItemIndex, totalItems]);

  /**
   * Navigate to the previous item
   */
  const goToPrevItem = useCallback(() => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(prev => prev - 1);
      setActiveTab('healthHistory');
    }
  }, [currentItemIndex]);

  /**
   * Submit the current item's answer
   */
  const submitCurrentItem = useCallback(() => {
    setSubmittedItems(prev => ({
      ...prev,
      [currentItemIndex]: true
    }));
  }, [currentItemIndex]);

  // -----------------------------------------
  // SCORING LOGIC
  // -----------------------------------------

  /**
   * Calculate if an option is correct (for showing results)
   */
  const isOptionCorrect = (option) => {
    const correctAnswer = currentItem?.answer;
    if (Array.isArray(correctAnswer)) {
      return correctAnswer.includes(option);
    }
    return correctAnswer === option;
  };

  /**
   * Check if user selected an option
   */
  const isOptionSelected = (option) => {
    const currentAnswers = itemAnswers[currentItemIndex] || [];
    return currentAnswers.includes(option);
  };

  /**
   * Get the CSS class for an option based on state
   */
  const getOptionClass = (option) => {
    const selected = isOptionSelected(option);
    const shouldShowResult = showResults || submittedItems[currentItemIndex];

    if (!shouldShowResult) {
      return selected ? 'selected' : '';
    }

    // Show results
    const correct = isOptionCorrect(option);

    if (correct && selected) return 'correct selected';
    if (correct && !selected) return 'correct-missed';
    if (!correct && selected) return 'incorrect selected';
    return '';
  };

  // -----------------------------------------
  // CALCULATE PROGRESS
  // -----------------------------------------

  const answeredCount = Object.keys(itemAnswers).filter(
    idx => itemAnswers[idx] && itemAnswers[idx].length > 0
  ).length;

  const progressPercentage = Math.round((answeredCount / totalItems) * 100);

  // -----------------------------------------
  // RENDER HELPERS
  // -----------------------------------------

  /**
   * Render the clinical data tab content
   */
  const renderTabContent = () => {
    const content = clinicalData[activeTab];

    if (!content) {
      return (
        <div className="unfolding-tab-empty">
          No {tabs.find(t => t.id === activeTab)?.label || 'data'} available for this item.
        </div>
      );
    }

    // Format vital signs nicely if it's that tab
    if (activeTab === 'vitalSigns') {
      return (
        <div className="unfolding-vitals">
          {content.split('|').map((vital, idx) => (
            <div key={idx} className="vital-item">
              {vital.trim()}
            </div>
          ))}
        </div>
      );
    }

    // Format lab results nicely
    if (activeTab === 'labResults') {
      return (
        <div className="unfolding-labs">
          {content.split('|').map((lab, idx) => (
            <div key={idx} className="lab-item">
              {lab.trim()}
            </div>
          ))}
        </div>
      );
    }

    // Default: render as paragraphs
    return (
      <div className="unfolding-text-content">
        {content.split('\n').map((para, idx) => (
          <p key={idx}>{para}</p>
        ))}
      </div>
    );
  };

  /**
   * Render the question options (MCQ or SATA)
   */
  const renderOptions = () => {
    const options = currentItem?.options || [];
    const itemType = currentItem?.questionType || 'mcq';
    const shouldShowResult = showResults || submittedItems[currentItemIndex];

    return (
      <div className={`unfolding-options ${itemType}`}>
        {options.map((option, idx) => (
          <button
            key={idx}
            className={`unfolding-option ${getOptionClass(option)}`}
            onClick={() => handleOptionSelect(option)}
            disabled={shouldShowResult}
          >
            <span className="option-indicator">
              {itemType === 'sata' ? (
                // Checkbox for SATA
                <span className={`checkbox ${isOptionSelected(option) ? 'checked' : ''}`}>
                  {isOptionSelected(option) ? '✓' : ''}
                </span>
              ) : (
                // Radio for MCQ
                <span className={`radio ${isOptionSelected(option) ? 'checked' : ''}`}>
                  {isOptionSelected(option) ? '●' : '○'}
                </span>
              )}
            </span>
            <span className="option-text">{option}</span>
          </button>
        ))}
      </div>
    );
  };

  /**
   * Render the justification (when showing results)
   */
  const renderJustification = () => {
    const shouldShowResult = showResults || submittedItems[currentItemIndex];

    if (!shouldShowResult) return null;

    const justification = currentItem?.justification;
    if (!justification) return null;

    return (
      <div className="unfolding-justification">
        <h4>📚 Explanation</h4>
        <div
          className="justification-content"
          dangerouslySetInnerHTML={{ __html: justification }}
        />
      </div>
    );
  };

  // -----------------------------------------
  // MAIN RENDER
  // -----------------------------------------

  // Handle missing data gracefully
  if (!items || items.length === 0) {
    return (
      <div className="unfolding-error">
        <p>⚠️ Unable to load case study. Missing items data.</p>
      </div>
    );
  }

  return (
    <div className={`unfolding-case-container ${inModal ? 'in-modal' : ''}`}>
      {/* HEADER: Title and Item Counter */}
      <div className="unfolding-header">
        <div className="unfolding-title">
          <span className="title-icon">🏥</span>
          <span className="title-text">Unfolding Case Study</span>
        </div>
        <div className="unfolding-item-counter">
          Item {currentItemIndex + 1} of {totalItems}
        </div>
      </div>

      {/* PATIENT INFO BAR */}
      <div className="unfolding-patient-bar">
        <div className="patient-info">
          <span className="patient-icon">👤</span>
          <span className="patient-text">{scenario.patientInfo || 'Patient information loading...'}</span>
        </div>
        {scenario.setting && (
          <div className="patient-setting">
            <span className="setting-icon">📍</span>
            <span className="setting-text">{scenario.setting}</span>
          </div>
        )}
      </div>

      {/* PROGRESS NOTE (if any) */}
      {currentItem.progressNote && (
        <div className="unfolding-progress-note">
          <span className="note-icon">📝</span>
          <span className="note-text">{currentItem.progressNote}</span>
        </div>
      )}

      {/* MAIN CONTENT: Two-Column Layout */}
      <div className="unfolding-main-content">
        {/* LEFT COLUMN: Clinical Data Tabs */}
        <div className="unfolding-left-column">
          {/* Tab Buttons */}
          <div className="unfolding-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`unfolding-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="unfolding-tab-content">
            {renderTabContent()}
          </div>
        </div>

        {/* RIGHT COLUMN: Question and Options */}
        <div className="unfolding-right-column">
          {/* Question Type Indicator */}
          <div className="unfolding-question-type">
            {currentItem.questionType === 'sata' ? (
              <span className="type-badge sata">Select All That Apply</span>
            ) : (
              <span className="type-badge mcq">Multiple Choice</span>
            )}
          </div>

          {/* Question Text */}
          <div className="unfolding-question-text">
            {currentItem.question}
          </div>

          {/* Options */}
          {renderOptions()}

          {/* Justification (when showing results) */}
          {renderJustification()}
        </div>
      </div>

      {/* FOOTER: Navigation and Progress */}
      <div className="unfolding-footer">
        {/* Progress Bar */}
        <div className="unfolding-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="progress-text">{answeredCount}/{totalItems} answered</span>
        </div>

        {/* Navigation Buttons */}
        <div className="unfolding-navigation">
          <button
            className="nav-button prev"
            onClick={goToPrevItem}
            disabled={currentItemIndex === 0}
          >
            ◀ Previous
          </button>

          {/* Submit button for current item (only if not yet submitted) */}
          {!showResults && !submittedItems[currentItemIndex] && itemAnswers[currentItemIndex]?.length > 0 && (
            <button
              className="nav-button submit"
              onClick={submitCurrentItem}
            >
              Submit Answer
            </button>
          )}

          <button
            className="nav-button next"
            onClick={goToNextItem}
            disabled={currentItemIndex === totalItems - 1}
          >
            Next Item ▶
          </button>
        </div>

        {/* Item Dots Navigation */}
        <div className="unfolding-dots">
          {items.map((_, idx) => (
            <button
              key={idx}
              className={`dot ${idx === currentItemIndex ? 'current' : ''} ${
                itemAnswers[idx]?.length > 0 ? 'answered' : ''
              } ${submittedItems[idx] ? 'submitted' : ''}`}
              onClick={() => {
                setCurrentItemIndex(idx);
                setActiveTab('healthHistory');
              }}
              title={`Item ${idx + 1}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UnfoldingCaseStudy;
