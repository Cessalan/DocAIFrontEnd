/**
 * ============================================
 * QUIZ SCORING UTILITIES
 * ============================================
 *
 * This module provides scoring logic for different question types.
 * Currently supports:
 * - MCQ (Multiple Choice Questions) - single correct answer
 * - SATA (Select All That Apply) - multiple correct answers with partial credit
 *
 * NCLEX-Style Scoring for SATA:
 * - You get +1 point for each correct option you select
 * - You lose 1 point for each incorrect option you select
 * - You get 0 points for correct options you didn't select (no penalty for missing)
 * - Minimum score is always 0 (can't go negative)
 * - Maximum score equals the number of correct options
 *
 * Example:
 * If a question has 3 correct answers out of 5 options:
 * - Selecting all 3 correct = 3/3 = 100%
 * - Selecting 2 correct, 0 incorrect = 2/3 = 67%
 * - Selecting 2 correct, 1 incorrect = (2-1)/3 = 1/3 = 33%
 * - Selecting 1 correct, 2 incorrect = max(0, 1-2)/3 = 0/3 = 0%
 */

// ============================================
// CONSTANTS
// ============================================

/**
 * Scoring strategies available for SATA questions
 */
export const SCORING_TYPES = {
  /** NCLEX-style: +1 correct, -1 incorrect, min 0 */
  PARTIAL: 'partial',
  /** All correct selections required, no partial credit */
  ALL_OR_NOTHING: 'all_or_nothing'
};

// ============================================
// MCQ SCORING (Single Answer)
// ============================================

/**
 * Calculates the score for a Multiple Choice Question (MCQ)
 *
 * @param {number} selectedIndex - The index of the option the user selected
 * @param {number} correctIndex - The index of the correct option
 * @returns {Object} Score result with isCorrect flag
 *
 * @example
 * const result = calculateMCQScore(1, 1);
 * // Returns: { isCorrect: true, score: 1, maxScore: 1, percentage: 100 }
 */
export function calculateMCQScore(selectedIndex, correctIndex) {
  const isCorrect = selectedIndex === correctIndex;

  return {
    isCorrect,
    score: isCorrect ? 1 : 0,
    maxScore: 1,
    percentage: isCorrect ? 100 : 0
  };
}

// ============================================
// SATA SCORING (Multiple Answers)
// ============================================

/**
 * Calculates the score for a Select All That Apply (SATA) question
 * using NCLEX-style partial credit scoring.
 *
 * Scoring Logic:
 * - +1 for each correct option selected
 * - -1 for each incorrect option selected
 * - 0 for correct options not selected (no penalty)
 * - Final score cannot go below 0
 *
 * @param {string[]} selectedOptions - Array of options the user selected
 * @param {string[]} correctOptions - Array of correct options
 * @param {string} scoringType - Either 'partial' or 'all_or_nothing'
 * @returns {Object} Detailed score result with breakdown
 *
 * @example
 * const result = calculateSATAScore(
 *   ['Tremors', 'Confusion'],           // User selected these
 *   ['Tremors', 'Diaphoresis', 'Confusion'], // These are correct
 *   'partial'
 * );
 * // Returns:
 * // {
 * //   score: 2,
 * //   maxScore: 3,
 * //   percentage: 66.67,
 * //   isFullyCorrect: false,
 * //   breakdown: {
 * //     correctSelections: ['Tremors', 'Confusion'],
 * //     incorrectSelections: [],
 * //     missedCorrect: ['Diaphoresis']
 * //   }
 * // }
 */
export function calculateSATAScore(selectedOptions, correctOptions, scoringType = SCORING_TYPES.PARTIAL) {
  // Ensure we're working with arrays
  const selected = Array.isArray(selectedOptions) ? selectedOptions : [];
  const correct = Array.isArray(correctOptions) ? correctOptions : [];

  // Calculate breakdown categories
  const correctSelections = selected.filter(option => correct.includes(option));
  const incorrectSelections = selected.filter(option => !correct.includes(option));
  const missedCorrect = correct.filter(option => !selected.includes(option));

  // Check if answer is fully correct (all correct selected, no incorrect selected)
  const isFullyCorrect =
    correctSelections.length === correct.length &&
    incorrectSelections.length === 0;

  // Calculate score based on scoring type
  let score;
  const maxScore = correct.length;

  if (scoringType === SCORING_TYPES.ALL_OR_NOTHING) {
    // All or nothing: only get points if perfectly correct
    score = isFullyCorrect ? maxScore : 0;
  } else {
    // NCLEX-style partial credit
    // +1 for each correct, -1 for each incorrect, minimum 0
    const rawScore = correctSelections.length - incorrectSelections.length;
    score = Math.max(0, rawScore);
  }

  // Calculate percentage (avoid division by zero)
  const percentage = maxScore > 0
    ? Math.round((score / maxScore) * 10000) / 100  // Round to 2 decimal places
    : 0;

  return {
    score,
    maxScore,
    percentage,
    isFullyCorrect,
    breakdown: {
      correctSelections,    // Options correctly selected (green checkmark)
      incorrectSelections,  // Options incorrectly selected (red X)
      missedCorrect         // Correct options not selected (yellow/orange indicator)
    }
  };
}

/**
 * Gets detailed feedback for each option in a SATA question.
 * This is useful for rendering visual feedback after submission.
 *
 * @param {string[]} allOptions - All options in the question
 * @param {string[]} selectedOptions - Options the user selected
 * @param {string[]} correctOptions - The correct options
 * @returns {Object[]} Array of feedback objects for each option
 *
 * @example
 * const feedback = getSATAOptionFeedback(
 *   ['A', 'B', 'C', 'D'],
 *   ['A', 'C'],
 *   ['A', 'B']
 * );
 * // Returns:
 * // [
 * //   { option: 'A', status: 'correct', wasSelected: true, shouldBeSelected: true },
 * //   { option: 'B', status: 'missed', wasSelected: false, shouldBeSelected: true },
 * //   { option: 'C', status: 'incorrect', wasSelected: true, shouldBeSelected: false },
 * //   { option: 'D', status: 'neutral', wasSelected: false, shouldBeSelected: false }
 * // ]
 */
export function getSATAOptionFeedback(allOptions, selectedOptions, correctOptions) {
  const selected = new Set(selectedOptions);
  const correct = new Set(correctOptions);

  return allOptions.map(option => {
    const wasSelected = selected.has(option);
    const shouldBeSelected = correct.has(option);

    let status;
    if (wasSelected && shouldBeSelected) {
      status = 'correct';      // User correctly selected this option ✓
    } else if (wasSelected && !shouldBeSelected) {
      status = 'incorrect';    // User incorrectly selected this option ✗
    } else if (!wasSelected && shouldBeSelected) {
      status = 'missed';       // User should have selected this but didn't ○
    } else {
      status = 'neutral';      // Correctly not selected (no indicator needed)
    }

    return {
      option,
      status,
      wasSelected,
      shouldBeSelected
    };
  });
}

/**
 * Determines if a SATA question has been answered (at least one selection made)
 *
 * @param {string[]} selectedOptions - The options user has selected
 * @returns {boolean} True if at least one option is selected
 */
export function isSATAAnswered(selectedOptions) {
  return Array.isArray(selectedOptions) && selectedOptions.length > 0;
}

/**
 * Gets a human-readable score description for SATA results
 *
 * @param {Object} scoreResult - The result from calculateSATAScore
 * @returns {string} A description like "2 out of 3 correct (67%)"
 */
export function getSATAScoreDescription(scoreResult) {
  const { score, maxScore, percentage, isFullyCorrect } = scoreResult;

  if (isFullyCorrect) {
    return `Perfect! ${score} out of ${maxScore} (${percentage}%)`;
  }

  return `${score} out of ${maxScore} correct (${percentage}%)`;
}

// ============================================
// ORDERING/CASE STUDY SCORING
// ============================================

/**
 * Calculates the score for an Ordering/Case Study question
 * where the user must arrange items in the correct sequence.
 *
 * Scoring Logic (partial credit):
 * - Each item in the correct position gets +1 point
 * - Maximum score equals total number of items
 * - Percentage reflects how many items are correctly positioned
 *
 * @param {string[]} userOrder - Array of item IDs in user's order
 * @param {string[]} correctOrder - Array of item IDs in correct order
 * @param {string} scoringType - Either 'partial' or 'all_or_nothing'
 * @returns {Object} Detailed score result with breakdown
 *
 * @example
 * const result = calculateOrderingScore(
 *   ['item2', 'item1', 'item3', 'item4'],  // User's order
 *   ['item1', 'item2', 'item3', 'item4'],  // Correct order
 *   'partial'
 * );
 * // Returns:
 * // {
 * //   score: 2,
 * //   maxScore: 4,
 * //   percentage: 50,
 * //   isFullyCorrect: false,
 * //   correctPositions: 2,
 * //   totalItems: 4,
 * //   positionDetails: [
 * //     { id: 'item2', userPosition: 0, correctPosition: 1, isCorrect: false },
 * //     { id: 'item1', userPosition: 1, correctPosition: 0, isCorrect: false },
 * //     { id: 'item3', userPosition: 2, correctPosition: 2, isCorrect: true },
 * //     { id: 'item4', userPosition: 3, correctPosition: 3, isCorrect: true }
 * //   ]
 * // }
 */
export function calculateOrderingScore(userOrder, correctOrder, scoringType = 'partial') {
  // Ensure we're working with arrays
  const user = Array.isArray(userOrder) ? userOrder : [];
  const correct = Array.isArray(correctOrder) ? correctOrder : [];

  const totalItems = correct.length;

  // Build position details and count correct positions
  const positionDetails = user.map((itemId, index) => {
    const correctPosition = correct.indexOf(itemId);
    const isCorrect = correctPosition === index;

    return {
      id: itemId,
      userPosition: index,
      correctPosition,
      isCorrect
    };
  });

  const correctPositions = positionDetails.filter(p => p.isCorrect).length;
  const isFullyCorrect = correctPositions === totalItems;

  // Calculate score based on scoring type
  let score;
  const maxScore = totalItems;

  if (scoringType === 'all_or_nothing') {
    score = isFullyCorrect ? maxScore : 0;
  } else {
    // Partial credit: 1 point per correct position
    score = correctPositions;
  }

  // Calculate percentage
  const percentage = maxScore > 0
    ? Math.round((score / maxScore) * 100)
    : 0;

  return {
    score,
    maxScore,
    percentage,
    isFullyCorrect,
    correctPositions,
    totalItems,
    positionDetails
  };
}

/**
 * Checks if a question is an ordering/case study question
 *
 * @param {Object} question - The question object
 * @returns {boolean} True if the question is an ordering type
 */
export function isOrderingQuestion(question) {
  if (!question) return false;
  return question.questionType === 'casestudy' ||
         question.questionType === 'ordering' ||
         question.questionType === 'bowtie';
}

// ============================================
// UTILITY: QUESTION TYPE DETECTION
// ============================================

/**
 * Determines the question type from question data.
 * Falls back to 'mcq' for backward compatibility.
 *
 * Supported types:
 * - 'mcq' - Multiple Choice Question (single answer)
 * - 'sata' - Select All That Apply (multiple answers)
 * - 'casestudy' - Simple ordering/case study
 * - 'ordering' - Ordering question
 * - 'bowtie' - Bowtie NGN format
 * - 'unfoldingCase' - 6-item unfolding case study (NGN advanced)
 *
 * @param {Object} question - The question object
 * @returns {string} The question type ('mcq', 'sata', 'casestudy', 'unfoldingCase', etc.)
 */
export function getQuestionType(question) {
  if (!question) return 'mcq';

  // Check explicit questionType field first
  if (question.questionType) {
    return question.questionType;
  }

  // Check for unfolding case study indicators
  // These have a scenario with items array
  if (question.scenario && Array.isArray(question.scenario.items)) {
    return 'unfoldingCase';
  }

  // Infer from answer format for backward compatibility
  // If answer is an array, it's likely SATA
  if (Array.isArray(question.answer)) {
    return 'sata';
  }

  // Check for case study/ordering indicators
  if (question.correctOrder || question.caseStudy) {
    return 'casestudy';
  }

  // Default to MCQ
  return 'mcq';
}

/**
 * Checks if a question is a SATA question
 *
 * @param {Object} question - The question object
 * @returns {boolean} True if the question is SATA type
 */
export function isSATAQuestion(question) {
  return getQuestionType(question) === 'sata';
}

// ============================================
// EXPORT DEFAULT OBJECT (for convenience)
// ============================================

const quizScoring = {
  SCORING_TYPES,
  calculateMCQScore,
  calculateSATAScore,
  getSATAOptionFeedback,
  isSATAAnswered,
  getSATAScoreDescription,
  calculateOrderingScore,
  isOrderingQuestion,
  getQuestionType,
  isSATAQuestion
};

export default quizScoring;
