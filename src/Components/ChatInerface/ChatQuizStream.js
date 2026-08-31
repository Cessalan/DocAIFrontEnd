import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { playCorrectSound, playIncorrectSound, playCelebrationSound, playMilestoneSound } from '../../utils/soundEffects';
import { getQuestionType } from '../../utils/quizScoring';
import parseRationaleOptions from '../../utils/parseRationale';
import { fetchQuizRationale } from '../../Services/FastAPICalls';
import useQuizAutoExtend from './useQuizAutoExtend';
import SATAQuestion from './SATAQuestion';
import CaseStudyQuestion from './CaseStudyQuestion';
import ContentRating from './ContentRating';
import { ratingFromChatQuiz } from '../StudyMode/ratingContext';
import './ChatQuizStream.css';

/**
 * ChatQuizStream - High-dopamine quiz component for chat interface
 * Based on StudyQuizCard with streaming support, sounds, and celebrations
 *
 * Adapts backend quiz format: { question, options, answer, justification, topic }
 * to the internal format needed for the Duolingo-style experience.
 */
const ChatQuizStream = ({
  quizData = [],
  messageId,
  isStreaming = false,
  expectedTotal = 10,
  generatingCurrent = 0,
  onAnswerSelect,
  // Called when the user clicks Learn more and we successfully fetch the
  // full per-option rationale for a question. Receives (questionIndex, html)
  // so the parent can persist it back onto the saved chat message — that way
  // a reload doesn't re-pay the LLM call. Optional; if absent, the rationale
  // is still cached client-side for the rest of the session.
  onRationaleFetched,
  onComplete,
  // Auto-extension: the quiz ships short and grows as the student advances.
  // Both are required for it to run at all — without them the quiz simply
  // stays the length it arrived at. See useQuizAutoExtend.
  chatId,
  quizTopic,
  onQuestionsAppended
}) => {
  const { t, i18n } = useTranslation();

  // Convert backend format to internal format
  // Backend: { question, options, answer, justification, topic, userSelection?, correctIndex? }
  // Internal: { question, options, correctIndex, rationale, topic }
  const questions = useMemo(() => {
    return quizData.map(q => {
      // Determine correctIndex - multiple strategies
      let correctIndex = -1;

      // Get the answer field - could be 'answer', 'correct_answer', or 'correctAnswer'
      const answerValue = q.answer ?? q.correct_answer ?? q.correctAnswer;

      // Strategy 1: If correctIndex is already provided as a number
      if (typeof q.correctIndex === 'number') {
        correctIndex = q.correctIndex;
      }
      // Strategy 2: If correct_index is provided (snake_case from backend)
      else if (typeof q.correct_index === 'number') {
        correctIndex = q.correct_index;
      }
      // Strategy 3: If answer is a number or numeric string (0-indexed)
      else if (answerValue !== undefined && !isNaN(parseInt(answerValue)) && parseInt(answerValue) < (q.options?.length || 0)) {
        correctIndex = parseInt(answerValue);
      }
      // Strategy 4: Robust Letter Parsing
      else if (typeof answerValue === 'string') {
        const trimmed = answerValue.trim();

        // Pattern 1: "Option X is correct" or "Option X:" or "Option X " (with anything after)
        const optionIsCorrectMatch = trimmed.match(/^Option\s+([A-F])(?:\s+is\s+correct|\s*:|(?=\s|$))/i);

        // Pattern 2: Explicit "Answer: X" or "Answer X" format
        const answerMatch = trimmed.match(/^Answer[:\s]+([A-F])(?:\b|$)/i);

        // Pattern 3: Standalone letter with optional punctuation "A", "A.", "(A)", "[A]"
        const standaloneMatch = trimmed.match(/^[\(\[]?([A-F])[\.\)\]]?$/i);

        // Pattern 4: Just letter followed by any text (e.g., "A. They regulate..." - extract first letter)
        const letterStartMatch = trimmed.match(/^([A-F])[\.\)\:\s]/i);

        if (optionIsCorrectMatch) {
          correctIndex = optionIsCorrectMatch[1].toUpperCase().charCodeAt(0) - 65;
        } else if (answerMatch) {
          correctIndex = answerMatch[1].toUpperCase().charCodeAt(0) - 65;
        } else if (standaloneMatch) {
          correctIndex = standaloneMatch[1].toUpperCase().charCodeAt(0) - 65;
        } else if (letterStartMatch) {
          correctIndex = letterStartMatch[1].toUpperCase().charCodeAt(0) - 65;
        }
      }

      // Strategy 5: Extract letter from sentences like "Option A is correct because..."
      if (correctIndex === -1 && typeof answerValue === 'string') {
        // Look for "Option X is correct" anywhere in the string
        const optionCorrectAnywhere = answerValue.match(/Option\s+([A-F])\s+is\s+correct/i);
        if (optionCorrectAnywhere) {
          correctIndex = optionCorrectAnywhere[1].toUpperCase().charCodeAt(0) - 65;
        }
      }

      // Strategy 5b: Check if justification contains "Option X is correct" (fallback)
      if (correctIndex === -1 && q.justification) {
        const justificationMatch = q.justification.match(/Option\s+([A-F])\s+is\s+correct/i);
        if (justificationMatch) {
          correctIndex = justificationMatch[1].toUpperCase().charCodeAt(0) - 65;
        }
      }

      // Strategy 6: Full text match (if not found by letter)
      if (correctIndex === -1 && q.options && answerValue) {
        const answerStr = String(answerValue).trim();

        // Try exact match first
        const exactMatch = q.options.findIndex(opt => String(opt).trim() === answerStr);
        if (exactMatch !== -1) {
          correctIndex = exactMatch;
        } else {
          // Strategy 7: Normalize both and compare
          const normalizeText = (text) => {
            return String(text)
              .trim()
              .toLowerCase()
              .replace(/^[a-f][\)\.\:\s]+\s*/i, '') // Remove letter prefix like "A) " or "A. "
              .replace(/\s+/g, ' ') // Normalize whitespace
              .replace(/[^\w\s]/g, ''); // Remove punctuation
          };

          const normalizedAnswer = normalizeText(answerStr);

          // Only proceed with fuzzy match if we have enough content
          // This prevents "A" from matching "Apple" via includes()
          if (normalizedAnswer.length >= 2) {
            correctIndex = q.options.findIndex(opt => {
              const normalizedOpt = normalizeText(opt);
              // Check various matching strategies
              return normalizedOpt === normalizedAnswer ||
                normalizedOpt.includes(normalizedAnswer) ||
                (normalizedAnswer.length > 5 && normalizedAnswer.includes(normalizedOpt)) ||
                // Also try matching first 50 chars in case of truncation
                (normalizedAnswer.length > 10 && normalizedOpt.substring(0, 50) === normalizedAnswer.substring(0, 50));
            });
          }
        }
      }

      // Debug logging - especially useful when correctIndex is -1
      if (correctIndex === -1) {
        console.warn('⚠️ Quiz correctIndex could not be determined:', {
          questionPreview: q.question?.substring(0, 50),
          rawAnswer: q.answer,
          rawCorrectAnswer: q.correct_answer,
          answerValue: answerValue,
          answerValueType: typeof answerValue,
          answerValueLength: answerValue?.length,
          providedCorrectIndex: q.correctIndex,
          providedCorrectIndexSnake: q.correct_index,
          optionsCount: q.options?.length,
          options: q.options?.map((o, i) => `${i}: ${String(o).substring(0, 50)}`)
        });
      } else {
        console.log('🎯 Quiz correctIndex calculated:', {
          questionPreview: q.question?.substring(0, 50),
          answerValue: String(answerValue).substring(0, 50),
          calculatedIndex: correctIndex
        });
      }

      return {
        ...q,
        correctIndex,
        // The full per-option rationale HTML. New generations don't ship
        // this inline anymore — it's fetched on demand when the user clicks
        // Learn more (see handleLearnMore). Old saved quizzes still carry
        // their `justification` here, so we expand them instantly without
        // a network call.
        rationale: q.rationale || q.justification || '',
        // One-sentence summary of why the correct answer is correct. Shipped
        // with every new question so the immediate "Correct/Incorrect"
        // feedback feels reasoned without paying for a full rationale.
        correctBlurb: q.correctBlurb || q.correct_blurb || '',
        // Preserve userSelection if already answered
        userSelection: q.userSelection
      };
    });
  }, [quizData]);

  const totalQuestions = questions.length;

  // UI state
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Per-question rationale state. Keyed by question index inside the
  // `questions` array (NOT by queue position, so re-shuffles don't lose it).
  // Each entry: { html, loading, error }.
  //   html       — the per-option rationale HTML once fetched (or seeded
  //                from a legacy saved question that already had it).
  //   loading    — request in flight; bar button shows a spinner.
  //   error      — last fetch failed; user can tap the button to retry.
  // The set of currently-EXPANDED questions is tracked separately in
  // expandedRationales so opening one question doesn't disturb others
  // (matters for review mode where the user can navigate between answered
  // questions and might want a previous expansion to stay open).
  const [questionRationales, setQuestionRationales] = useState({});
  const [expandedRationales, setExpandedRationales] = useState(() => new Set());

  // Question queue management
  const [queueIndex, setQueueIndex] = useState(0);
  const [questionStatuses, setQuestionStatuses] = useState({});
  const [isReviewRound, setIsReviewRound] = useState(false);

  // Fetches the next batch once the student is within a couple of questions of
  // the end, so the quiz grows without them ever meeting a loading state.
  // Declared after queueIndex — it reads the student's current position.
  useQuizAutoExtend({
    chatId,
    topic: quizTopic,
    quizData: questions,
    currentIndex: queueIndex,
    isStreaming,
    onQuestions: onQuestionsAppended
  });
  // Initialize queue with indices when questions exist - critical for streaming!
  const [questionQueue, setQuestionQueue] = useState(() =>
    quizData.length > 0 ? quizData.map((_, i) => i) : []
  );

  // Celebration states
  const [showMilestoneCelebration, setShowMilestoneCelebration] = useState(false);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const [showReviewTransition, setShowReviewTransition] = useState(false);
  const [reviewTransitionCount, setReviewTransitionCount] = useState(0);
  const [hasShownMilestone, setHasShownMilestone] = useState(false);
  const [waitingForNextQuestion, setWaitingForNextQuestion] = useState(false);

  // Post-completion review mode (browse questions without answering)
  const [isPostReviewMode, setIsPostReviewMode] = useState(false);

  /* First-attempt record, keyed by question index.
     `questionStatuses` is overwritten during the review round, and the
     completion screen only appears once every question is correct — so by the
     time anything on that screen is rendered, questionStatuses says 100% no
     matter how the quiz actually went. That is fine for the XP it drives and
     useless as a measure of the quiz. This ref never overwrites an entry, so
     it keeps what she got right the FIRST time, which is the number the rating
     context needs. A ref rather than state: nothing renders from it, and a
     re-render per answer to store a number for later is wasted work. */
  const firstAttemptRef = useRef({});
  const [postReviewIndex, setPostReviewIndex] = useState(0);

  // XP animation
  const [showXpPopup, setShowXpPopup] = useState(false);

  // Tracking
  const startTimeRef = useRef(Date.now());
  const hasRestoredProgress = useRef(false);

  // Option letters
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Initialize/update queue when questions change (streaming support)
  useEffect(() => {
    if (totalQuestions === 0) return;

    // Restore previous answers from quizData
    if (!hasRestoredProgress.current) {
      const restoredStatuses = {};
      questions.forEach((q, idx) => {
        if (q.userSelection) {
          restoredStatuses[idx] = q.userSelection.isCorrect ? 'correct' : 'incorrect';
          // Seed the first-attempt record for a resumed quiz. The persisted
          // selection is the closest thing to a first attempt we have across a
          // reload; leaving it unseeded would report every resumed quiz as
          // zero correct, which is worse than approximate.
          if (firstAttemptRef.current[idx] === undefined) {
            firstAttemptRef.current[idx] = !!q.userSelection.isCorrect;
          }
        }
      });

      if (Object.keys(restoredStatuses).length > 0) {
        setQuestionStatuses(restoredStatuses);
        // Find first unanswered
        const firstUnanswered = questions.findIndex((q, idx) => !restoredStatuses[idx]);
        if (firstUnanswered === -1) {
          // All answered - check if review needed
          const incorrectCount = Object.values(restoredStatuses).filter(s => s === 'incorrect').length;
          if (incorrectCount > 0 && !isStreaming) {
            setIsReviewRound(true);
            const reviewQueue = Object.entries(restoredStatuses)
              .filter(([_, status]) => status === 'incorrect')
              .map(([idx]) => parseInt(idx));
            setQuestionQueue(reviewQueue);
            setQueueIndex(0);
          } else if (incorrectCount === 0) {
            setShowCompletionCelebration(true);
            playCelebrationSound();
          }
        } else {
          setQueueIndex(firstUnanswered);
        }
      }
      // Always mark as restored after first check, even if no data to restore
      // This prevents the restore logic from running again when userSelection is saved
      hasRestoredProgress.current = true;
    }

    // Update queue for streaming
    if (!isReviewRound) {
      const newQueue = questions.map((_, i) => i);
      if (newQueue.length !== questionQueue.length) {
        setQuestionQueue(newQueue);

        // Auto-advance if waiting for next question
        if (waitingForNextQuestion && newQueue.length > queueIndex + 1) {
          setWaitingForNextQuestion(false);
          setQueueIndex(queueIndex + 1);
          resetQuestionState();
        }
      }
    }
  }, [questions, totalQuestions, isStreaming, isReviewRound, questionQueue.length, queueIndex, waitingForNextQuestion]);

  // ✅ Sync questionStatuses with quizData.userSelection when props update (save as you go)
  // This ensures answers are persisted and restored correctly when quizData is updated from Firebase
  useEffect(() => {
    if (totalQuestions === 0) return;

    // Build status map from current quizData userSelections
    const statusesFromProps = {};
    questions.forEach((q, idx) => {
      if (q.userSelection) {
        statusesFromProps[idx] = q.userSelection.isCorrect ? 'correct' : 'incorrect';
      }
    });

    // Merge with existing statuses (props take precedence for answered questions)
    setQuestionStatuses(prev => {
      const merged = { ...prev };
      let hasChanges = false;

      Object.entries(statusesFromProps).forEach(([idx, status]) => {
        if (merged[idx] !== status) {
          merged[idx] = status;
          hasChanges = true;
        }
      });

      return hasChanges ? merged : prev;
    });
  }, [questions, totalQuestions]);

  // Current question - use direct index if queue not yet populated (streaming)
  // This ensures the first question shows IMMEDIATELY when it arrives
  const currentQueuePosition = questionQueue.length > 0 ? (questionQueue[queueIndex] ?? 0) : queueIndex;
  const currentQuestion = questions[currentQueuePosition] || {};
  const { question, options = [], correctIndex, rationale, correctBlurb, topic } = currentQuestion;

  // Progress calculations
  const correctCount = Object.values(questionStatuses).filter(s => s === 'correct').length;
  const allQuestionsReceived = !isStreaming || totalQuestions >= expectedTotal;
  const allCorrect = correctCount === totalQuestions && totalQuestions > 0 && allQuestionsReceived;

  // Milestone at 30% of expected total
  const milestoneTotal = expectedTotal || 10;
  const minQuestionsForMilestone = Math.ceil(milestoneTotal * 0.3);

  // Trigger milestone celebration
  useEffect(() => {
    if (correctCount >= minQuestionsForMilestone && !hasShownMilestone && !isReviewRound && correctCount < totalQuestions) {
      setShowMilestoneCelebration(true);
      setHasShownMilestone(true);
      playMilestoneSound();
    }
  }, [correctCount, minQuestionsForMilestone, hasShownMilestone, isReviewRound, totalQuestions]);

  // Trigger completion celebration
  useEffect(() => {
    // Don't auto-trigger if already in post-review mode
    if (allCorrect && totalQuestions > 0 && !showCompletionCelebration && !isPostReviewMode) {
      const timer = setTimeout(() => {
        setShowCompletionCelebration(true);
        playCelebrationSound();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allCorrect, totalQuestions, showCompletionCelebration, isPostReviewMode]);

  // Reset question state helper. Per-question rationale state is intentionally
  // NOT cleared here — fetched HTML stays cached across navigation so the
  // review round (and any back-tracking) doesn't re-pay LLM cost.
  const resetQuestionState = useCallback(() => {
    setSelectedIndex(null);
    setShowFeedback(false);
    setIsCorrect(false);
  }, []);

  // Handle the "Learn more" button click. Three branches:
  //  1. Already expanded → collapse (no fetch).
  //  2. Not expanded, rationale available (cached or legacy) → expand instantly.
  //  3. Not expanded, no rationale yet → expand container immediately AND kick
  //     off a fetch. The container shows a skeleton until the response lands.
  //     Expanding before the fetch resolves is what makes this feel snappy —
  //     the user gets visual confirmation that something's happening.
  const handleLearnMore = useCallback(async (qIndex) => {
    if (qIndex < 0 || qIndex >= questions.length) return;

    // Branch 1: collapse if already open.
    if (expandedRationales.has(qIndex)) {
      setExpandedRationales(prev => {
        const next = new Set(prev);
        next.delete(qIndex);
        return next;
      });
      return;
    }

    const q = questions[qIndex];
    const cached = questionRationales[qIndex];
    const haveHtml = (cached && cached.html) || (q && q.rationale);

    // Branch 2 & 3 share the optimistic expand.
    setExpandedRationales(prev => new Set(prev).add(qIndex));

    if (haveHtml) return;  // Branch 2 — no fetch needed.

    // Branch 3 — fetch.
    setQuestionRationales(prev => ({
      ...prev,
      [qIndex]: { html: '', loading: true, error: false }
    }));

    try {
      const result = await fetchQuizRationale(
        q.question,
        q.options,
        q.correctIndex,
        i18n?.language
      );
      const html = (result && result.rationale_html) || '';

      setQuestionRationales(prev => ({
        ...prev,
        [qIndex]: { html, loading: false, error: !html }
      }));

      // Notify parent so the chat message in Firestore can be updated. We
      // pass the question's stable text alongside the index so the parent
      // can match it against its own quiz array even if order shifts.
      if (html && typeof onRationaleFetched === 'function') {
        onRationaleFetched(qIndex, html, q.question);
      }
    } catch (err) {
      console.error('Quiz rationale fetch failed', err);
      setQuestionRationales(prev => ({
        ...prev,
        [qIndex]: { html: '', loading: false, error: true }
      }));
    }
  }, [questions, questionRationales, expandedRationales, onRationaleFetched, i18n?.language]);

  // ── Keeping the question in view ──────────────────────────────────────
  // The card lives inside the chat's scroll pane, so a long stem plus four
  // options plus an open rationale is taller than the viewport and the
  // student has to go hunting for the choices they haven't seen. Shrinking
  // the card alone can't fix that — question length varies too much — so we
  // also move the scroller for them at the three moments the card changes
  // height: a new question, the feedback panel opening, and the rationale
  // expanding. scrollIntoView walks every scrollable ancestor, which is what
  // we want: the chat pane and the window both settle.
  const cardRef = useRef(null);
  const feedbackRef = useRef(null);
  const rationaleRef = useRef(null);

  const reveal = useCallback((el, block) => {
    if (!el) return;
    const reduced = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block });
  }, []);

  // Skip the very first pass so we don't fight the chat's own
  // scroll-to-bottom when the quiz message first arrives.
  const hasMountedRef = useRef(false);

  // New question → put the card's top at the top of the pane.
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const id = setTimeout(() => reveal(cardRef.current, 'start'), 60);
    return () => clearTimeout(id);
  }, [currentQueuePosition, isReviewRound, reveal]);

  // Feedback opened → 'nearest' scrolls the minimum needed, and nothing at
  // all when the panel already fits below the options.
  useEffect(() => {
    if (!showFeedback) return undefined;
    const id = setTimeout(() => reveal(feedbackRef.current, 'nearest'), 140);
    return () => clearTimeout(id);
  }, [showFeedback, currentQueuePosition, reveal]);

  // Rationale expanded (or its skeleton swapped for real text) → wait out
  // the 0.34s grid-row transition, then bring it into view. We target the
  // rationale itself rather than the feedback panel: once four per-option
  // rows are open the panel is taller than the pane, and aligning *its* top
  // would scroll back up past the text the student just asked to see.
  const rationaleOpen = expandedRationales.has(currentQueuePosition);
  const rationaleLoading = !!questionRationales[currentQueuePosition]?.loading;
  useEffect(() => {
    if (!rationaleOpen) return undefined;
    const id = setTimeout(() => reveal(rationaleRef.current, 'nearest'), 380);
    return () => clearTimeout(id);
  }, [rationaleOpen, rationaleLoading, currentQueuePosition, reveal]);

  // Track previous queue position to detect navigation
  const prevQueuePositionRef = useRef(currentQueuePosition);

  // ✅ Restore UI state when navigating to a NEW question
  // In review round, allow re-answering so reset state when navigating
  useEffect(() => {
    // Only run when actually navigating to a different question
    if (prevQueuePositionRef.current === currentQueuePosition) {
      return;
    }
    prevQueuePositionRef.current = currentQueuePosition;

    // In review round, questions should be answerable again - reset state for each question.
    // We don't touch the rationale-cache (questionRationales) — keep fetched HTML around.
    if (isReviewRound) {
      // Reset to allow re-answering
      setSelectedIndex(null);
      setShowFeedback(false);
      setIsCorrect(false);
      return;
    }

    const currentQ = questions[currentQueuePosition];
    if (currentQ?.userSelection) {
      // Question was previously answered - restore the UI state
      const userSel = currentQ.userSelection;
      setSelectedIndex(userSel.selectedIndex ?? userSel.selectedOptionIndex ?? null);
      setIsCorrect(userSel.isCorrect);
      setShowFeedback(true);
    }
    // If no userSelection, the question is unanswered - state should already be clean from resetQuestionState
  }, [currentQueuePosition, isReviewRound, questions]);

  // Strip letter prefix from options
  const stripLetterPrefix = (text) => {
    if (!text) return '';
    if (typeof text !== 'string') return String(text);
    return text.replace(/^[A-Fa-f][).:]\s*/, '');
  };

  // Get short rationale
  const getShortRationale = (fullRationale) => {
    if (!fullRationale) return null;
    const textOnly = fullRationale.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const correctMatch = textOnly.match(/Option\s+[A-D]\s+is\s+correct[^.]*\./i);
    if (correctMatch) return correctMatch[0];
    const firstSentence = textOnly.match(/^[^.!?]+[.!?]/);
    if (firstSentence && firstSentence[0].length < 200) return firstSentence[0];
    return textOnly.substring(0, 150) + '...';
  };

  const hasMoreRationale = (fullRationale, shortRationale) => {
    if (!fullRationale || !shortRationale) return false;
    const textOnly = fullRationale.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return textOnly.length > shortRationale.length + 20;
  };

  // Handle option click
  const handleOptionClick = useCallback((index) => {
    if (showFeedback) return;

    setSelectedIndex(index);
    const correct = index === correctIndex;
    setIsCorrect(correct);
    setShowFeedback(true);

    // Play sound
    if (correct) {
      playCorrectSound();
      // Show XP popup
      setShowXpPopup(true);
      setTimeout(() => setShowXpPopup(false), 1500);
      // Vibrate on mobile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } else {
      playIncorrectSound();
    }

    // Update status
    const newStatuses = {
      ...questionStatuses,
      [currentQueuePosition]: correct ? 'correct' : 'incorrect'
    };
    setQuestionStatuses(newStatuses);

    // Record the first attempt only. A retry in the review round must not
    // overwrite the miss that sent her there.
    if (firstAttemptRef.current[currentQueuePosition] === undefined) {
      firstAttemptRef.current[currentQueuePosition] = correct;
    }

    // Notify parent
    if (onAnswerSelect) {
      onAnswerSelect({
        messageId,
        quizIndex: currentQueuePosition,
        questionText: question,
        selectedOptionIndex: index,
        selectedOptionText: options[index],
        correctOptionIndex: correctIndex,
        correctOptionText: options[correctIndex],
        isCorrect: correct,
        timestamp: new Date().toISOString(),
        topic: topic || null,
        isReviewAttempt: isReviewRound // Flag to tell parent to override existing answer
      });
    }
  }, [showFeedback, correctIndex, questionStatuses, currentQueuePosition, messageId, question, options, topic, onAnswerSelect, isReviewRound]);

  // Handle next question
  const handleNextQuestion = useCallback(() => {
    const nextQueueIndex = queueIndex + 1;

    if (nextQueueIndex >= questionQueue.length) {
      // Check if still streaming
      if (isStreaming && totalQuestions < expectedTotal) {
        setWaitingForNextQuestion(true);
        resetQuestionState();
        return;
      }

      // Check for questions that still need review (answered incorrectly)
      const questionsToReview = Object.entries(questionStatuses)
        .filter(([_, status]) => status === 'incorrect')
        .map(([idx]) => parseInt(idx));

      if (questionsToReview.length > 0) {
        if (!isReviewRound) {
          // First time entering review round - show transition
          setReviewTransitionCount(questionsToReview.length);
          setShowReviewTransition(true);
          setIsReviewRound(true);
        }
        // Cycle through incorrect questions again (whether first time or continuing review)
        setQuestionQueue(questionsToReview);
        setQueueIndex(0);
        resetQuestionState();
      } else {
        // No questions to review - all correct, trigger completion immediately
        setShowCompletionCelebration(true);
        playCelebrationSound();
      }
    } else {
      setQueueIndex(nextQueueIndex);
      resetQuestionState();
    }
  }, [queueIndex, questionQueue.length, isStreaming, totalQuestions, expectedTotal, questionStatuses, resetQuestionState, isReviewRound]);

  // Bridge handler for non-MCQ question types (SATA, CaseStudy).
  // These components manage their own internal state but we need to feed
  // the answer result back into ChatQuizStream's progress/scoring system.
  const handleNonMCQAnswerSelect = useCallback((answerData) => {
    const correct = answerData.isCorrect === true ||
      (typeof answerData.percentage === 'number' && answerData.percentage >= 100);

    if (correct) {
      playCorrectSound();
      setShowXpPopup(true);
      setTimeout(() => setShowXpPopup(false), 1500);
      if (navigator.vibrate) navigator.vibrate(50);
    } else {
      playIncorrectSound();
    }

    setQuestionStatuses(prev => ({
      ...prev,
      [currentQueuePosition]: correct ? 'correct' : 'incorrect'
    }));

    // Forward to parent with messageId so Firebase persistence works
    if (onAnswerSelect) {
      onAnswerSelect({
        ...answerData,
        messageId,
        quizIndex: currentQueuePosition,
        isReviewAttempt: isReviewRound
      });
    }
  }, [currentQueuePosition, isReviewRound, messageId, onAnswerSelect]);

  // Calculate progress for display
  const getProgressPercent = () => {
    const displayTotal = isStreaming ? expectedTotal : totalQuestions;
    if (displayTotal === 0) return 0;
    if (allCorrect) return 100;
    if (isReviewRound) {
      // In review mode, show progress through the review queue (not overall correctness)
      const reviewTotal = questionQueue.length;
      if (reviewTotal === 0) return 0;
      return ((queueIndex + (showFeedback ? 1 : 0)) / reviewTotal) * 100;
    }
    return ((queueIndex + (showFeedback ? 1 : 0)) / displayTotal) * 100;
  };

  // Check if there are more questions
  const hasMoreQuestions = queueIndex < questionQueue.length - 1;
  const moreQuestionsExpected = isStreaming && totalQuestions < expectedTotal;
  const needsReviewRound = () => {
    if (hasMoreQuestions || moreQuestionsExpected) return false;
    return Object.values(questionStatuses).filter(s => s === 'incorrect').length > 0;
  };

  // Calculate XP earned
  const xpEarned = correctCount * 10;
  const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
  const isPerfect = correctCount === totalQuestions && Object.values(questionStatuses).every(s => s === 'correct');

  /* Context for the post-quiz rating. Built from the FIRST-attempt record, not
     questionStatuses — the celebration screen this is shown on only appears
     once every question is correct, so questionStatuses reads 100% for
     everyone and would flatten every rating into the same bucket. Recomputed
     on the celebration render only; it is stable by then. */
  const rating = useMemo(() => {
    const attempts = Object.values(firstAttemptRef.current);
    if (attempts.length === 0) return null;
    return ratingFromChatQuiz(
      {
        correctCount: attempts.filter(Boolean).length,
        totalQuestions: attempts.length,
        topic: quizTopic || topic
      },
      { locale: i18n.language }
    );
    // questionStatuses is not read here, but it changes on every answer and is
    // the cheapest signal that the first-attempt record may have grown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionStatuses, quizTopic, topic, i18n.language]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Icons
  const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  const ChevronDownIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  // Renders the expanded rationale: parses "<b>Option X is correct</b> because..."
  // into per-option rows. Falls back to raw HTML if the format doesn't match.
  const renderRationale = (rationale) => {
    const parsed = parseRationaleOptions(rationale);

    if (parsed.length === 0) {
      return (
        <div
          className="cqs-feedback-rationale"
          dangerouslySetInnerHTML={{ __html: rationale }}
        />
      );
    }

    return (
      <div className="cqs-feedback-rationale structured">
        {parsed.map((item, i) => (
          <div key={i} className={`rationale-row ${item.status}`}>
            <div className="rationale-row-marker">
              {item.status === 'correct' ? <CheckIcon /> : <XIcon />}
            </div>
            <div className="rationale-row-body">
              <div className="rationale-row-label">
                <span className="rationale-row-letter">Option {item.letter}</span>
                <span className="rationale-row-status">{item.status}</span>
              </div>
              <div
                className="rationale-row-text"
                dangerouslySetInnerHTML={{ __html: item.html }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ChevronUpIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );

  const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );

  // Render milestone celebration
  if (showMilestoneCelebration) {
    return (
      <div className="chat-quiz-stream-card">
        <div className="cqs-milestone-celebration">
          <div className="cqs-milestone-icon">
            <span>🎯</span>
          </div>
          <h2 className="cqs-milestone-title">{t('study.milestoneGreat1', "You're doing great!")}</h2>
          <p className="cqs-milestone-stats">
            {correctCount} / {totalQuestions} {t('quiz.correct', 'correct')}
          </p>
          <button
            className="cqs-milestone-btn"
            onClick={() => setShowMilestoneCelebration(false)}
          >
            {t('study.continue', 'CONTINUE')}
          </button>
        </div>
      </div>
    );
  }

  // Render completion celebration
  if (showCompletionCelebration) {
    return (
      <div className="chat-quiz-stream-card">
        <div className="cqs-completion-celebration">
          {/* Confetti */}
          <div className="cqs-confetti">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={`cqs-confetti-particle cqs-confetti-${i % 5}`}
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${1.5 + Math.random() * 1}s`
                }}
              />
            ))}
          </div>

          <div className="cqs-completion-icon">
            <span>🎉</span>
          </div>
          <h2 className="cqs-completion-title">{t('study.lessonComplete', 'Amazing work!')}</h2>

          <div className="cqs-completion-stats">
            <div className="cqs-stat-card cqs-stat-xp">
              <span className="cqs-stat-label">{t('study.totalXP', 'TOTAL XP')}</span>
              <div className="cqs-stat-value">
                <span className="cqs-stat-icon">⚡</span>
                <span className="cqs-stat-number">{xpEarned}</span>
              </div>
            </div>
          </div>

          <div className="cqs-completion-buttons">
            <button
              className="cqs-review-questions-btn"
              onClick={() => {
                setShowCompletionCelebration(false);
                setIsPostReviewMode(true);
                setPostReviewIndex(0);
              }}
            >
              {t('study.reviewQuestions', 'Review Questions')} 📖
            </button>
          </div>

          {/* Was the quiz itself any good? Asked here rather than mid-quiz:
              this is the first moment she can actually answer it. */}
          {rating && (
            <ContentRating
              surface={rating.surface}
              chatId={chatId}
              subjectId={messageId}
              context={rating.context}
            />
          )}
        </div>
      </div>
    );
  }

  // Render review transition
  if (showReviewTransition) {
    return (
      <div className="chat-quiz-stream-card">
        <div className="cqs-review-transition">
          <div className="cqs-review-icon">
            <RefreshIcon />
          </div>
          <h2 className="cqs-review-title">{t('study.timeToReview', 'Time to Review!')}</h2>
          <p className="cqs-review-message">
            {t('study.reviewQuestionMessage', {
              count: reviewTransitionCount,
              defaultValue: `You have ${reviewTransitionCount} question${reviewTransitionCount > 1 ? 's' : ''} to review. Let's try again!`
            })}
          </p>
          <button
            className="cqs-review-btn"
            onClick={() => setShowReviewTransition(false)}
          >
            {t('study.startReview', "Let's Go!")} →
          </button>
        </div>
      </div>
    );
  }

  // Render post-completion review mode (browse questions without answering)
  if (isPostReviewMode) {
    const reviewQuestion = questions[postReviewIndex] || {};
    const reviewOptions = reviewQuestion.options || [];
    const reviewCorrectIndex = reviewQuestion.correctIndex;
    const reviewRationale = reviewQuestion.rationale;

    return (
      <div className="chat-quiz-stream-card">
        {/* Progress bar for review */}
        <div className="cqs-progress-container">
          <div className="cqs-progress-bar">
            <div
              className="cqs-progress-fill"
              style={{ width: `${((postReviewIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
          <div className="cqs-progress-text">
            <span className="cqs-progress-count">
              {postReviewIndex + 1} / {totalQuestions}
            </span>
            <span className="cqs-review-badge">
              📖 {t('study.reviewMode', 'Review Mode')}
            </span>
          </div>
        </div>

        {/* Question content */}
        <div className="cqs-question-wrapper" data-selectable="true">
          {/* Question number badge */}
          <div className="cqs-question-number">
            {t('quiz.questionNumber', 'Question')} {postReviewIndex + 1} {t('quiz.of', 'of')} {totalQuestions}
          </div>

          {/* Topic badge */}
          {reviewQuestion.topic && (
            <div className="cqs-topic-badge">
              <span className="cqs-topic-icon">📚</span>
              <span className="cqs-topic-text">{reviewQuestion.topic}</span>
            </div>
          )}

          {/* Question */}
          <div className="cqs-question">
            {reviewQuestion.question || 'Loading question...'}
          </div>

          {/* Options - show correct answer highlighted */}
          <div className="cqs-options">
            {reviewOptions.map((option, index) => {
              const isCorrectOption = index === reviewCorrectIndex;
              return (
                <div
                  key={index}
                  className={`cqs-option disabled ${isCorrectOption ? 'correct' : ''}`}
                >
                  <span className="cqs-option-letter">{letters[index]}</span>
                  <span className="cqs-option-text">{stripLetterPrefix(option)}</span>
                  {isCorrectOption && <span className="cqs-correct-indicator">✓</span>}
                </div>
              );
            })}
          </div>

          {/* Always show rationale in review mode */}
          {reviewRationale && (
            <div className="cqs-feedback correct" style={{ marginTop: '20px' }}>
              <div className="cqs-feedback-header">
                <div className="cqs-feedback-icon">
                  <CheckIcon />
                </div>
                <span className="cqs-feedback-title">{t('study.explanation', 'Explanation')}</span>
              </div>
              <div
                className="cqs-feedback-rationale"
                style={{ marginLeft: 0, marginTop: '12px' }}
                dangerouslySetInnerHTML={{ __html: reviewRationale }}
              />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="cqs-post-review-nav">
            <button
              className="cqs-nav-btn cqs-nav-prev"
              onClick={() => setPostReviewIndex(prev => Math.max(0, prev - 1))}
              disabled={postReviewIndex === 0}
            >
              ← {t('study.previous', 'Previous')}
            </button>

            <button
              className="cqs-nav-btn cqs-nav-done"
              onClick={() => {
                setIsPostReviewMode(false);
                if (onComplete) onComplete({ xpEarned, timeTaken, isPerfect, correctCount, totalQuestions });
              }}
            >
              {t('study.done', 'Done')}
            </button>

            <button
              className="cqs-nav-btn cqs-nav-next"
              onClick={() => setPostReviewIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
              disabled={postReviewIndex === totalQuestions - 1}
            >
              {t('study.next', 'Next')} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render waiting for questions (streaming) - Now shows skeleton preview
  // Only show skeleton if NO questions at all, or if waiting for next AND current question isn't ready
  const hasValidCurrentQuestion = currentQuestion && currentQuestion.question && options.length > 0;
  // Use generatingCurrent for progress when no questions received yet, otherwise use totalQuestions
  const progressValue = totalQuestions > 0 ? totalQuestions : generatingCurrent;
  const generationProgress = expectedTotal > 0 ? Math.round((progressValue / expectedTotal) * 100) : 0;

  if ((isStreaming && totalQuestions === 0) || (waitingForNextQuestion && !hasValidCurrentQuestion)) {
    return (
      <div className="chat-quiz-stream-card">
        <div className="cqs-skeleton-loading">
          {/* Progress indicator with real percentage */}
          <div className="cqs-skeleton-progress">
            <div className="cqs-generation-progress-bar">
              <div
                className="cqs-generation-progress-fill"
                style={{ width: `${generationProgress}%` }}
              />
              {generationProgress === 0 && (
                <div className="cqs-skeleton-progress-pulse" />
              )}
            </div>
            <div className="cqs-skeleton-progress-text">
              <span className="cqs-skeleton-count">
                {generatingCurrent > 0
                  ? t('study.generatingProgress', {
                      current: generatingCurrent,
                      total: expectedTotal,
                      defaultValue: `Generating question ${generatingCurrent} of ${expectedTotal}...`
                    })
                  : t('study.generatingQuestions', 'Generating questions...')}
              </span>
              <span className="cqs-generation-percent">{generationProgress}%</span>
            </div>
          </div>

          {/* Skeleton question */}
          <div className="cqs-skeleton-question">
            <div className="cqs-skeleton-line cqs-skeleton-line-long"></div>
            <div className="cqs-skeleton-line cqs-skeleton-line-medium"></div>
          </div>

          {/* Skeleton options */}
          <div className="cqs-skeleton-options">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="cqs-skeleton-option" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="cqs-skeleton-option-letter"></div>
                <div className="cqs-skeleton-option-text">
                  <div className="cqs-skeleton-line cqs-skeleton-line-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render quiz question.
  //
  // shortRationale: the one-line "why" shown next to the verdict. We prefer
  // the new `correctBlurb` field shipped with every question post-rollout,
  // and fall back to the old client-side parser for legacy saved quizzes
  // that still carry a full justification HTML blob.
  const shortRationale = correctBlurb || getShortRationale(rationale);

  // Per-question rationale state for the currently displayed question.
  const cachedRationale = questionRationales[currentQueuePosition];
  const effectiveRationaleHtml = (cachedRationale && cachedRationale.html) || rationale || '';
  const isRationaleExpanded = expandedRationales.has(currentQueuePosition);
  const isRationaleLoading = cachedRationale ? cachedRationale.loading : false;
  const hasRationaleError = cachedRationale ? cachedRationale.error && !cachedRationale.html : false;

  // hasMore: do we have anything to show / fetch behind the Learn-more button?
  // After answering, we ALWAYS offer it — either the rationale exists already
  // or we can fetch it on demand. We only hide the button when the question
  // is malformed (no question text or no valid correct index).
  const hasMore = !!(question && correctIndex >= 0 && correctIndex < (options?.length || 0));

  // Detect the question type for the current question
  const currentQuestionType = getQuestionType(currentQuestion);
  const isLastQuestion = !hasMoreQuestions && !moreQuestionsExpected && !needsReviewRound();

  // Key for question animation - changes when question changes
  const questionKey = `question-${currentQueuePosition}-${isReviewRound ? 'review' : 'initial'}`;

  // ── Shared progress header (shown above every question type) ──────────
  const progressHeader = (
    <div className="cqs-progress-container">
      <div className="cqs-progress-bar">
        <div
          className="cqs-progress-fill"
          style={{ width: `${getProgressPercent()}%` }}
        />
        {isStreaming && <div className="cqs-progress-shimmer" />}
      </div>
      <div className="cqs-progress-text">
        <span className="cqs-progress-count">
          {isReviewRound
            ? `${queueIndex + 1} / ${questionQueue.length}`
            : `${queueIndex + 1} / ${isStreaming ? `${totalQuestions}+` : totalQuestions}`
          }
        </span>
        {isStreaming && !isReviewRound && (
          <span className="cqs-streaming-indicator">
            <span className="cqs-streaming-dot"></span>
            <span className="cqs-streaming-dot"></span>
            <span className="cqs-streaming-dot"></span>
          </span>
        )}
        {isReviewRound && (
          <span className="cqs-review-badge">
            <RefreshIcon /> {t('quiz.review', 'Review')} ({questionQueue.length} {t('quiz.remaining', 'left')})
          </span>
        )}
      </div>
    </div>
  );

  // ── SATA question ──────────────────────────────────────────────────────
  if (currentQuestionType === 'sata') {
    return (
      <div className="chat-quiz-stream-card" ref={cardRef}>
        {showXpPopup && <div className="cqs-xp-popup">+10 XP</div>}
        {progressHeader}
        <SATAQuestion
          key={questionKey}
          quiz={currentQuestion}
          quizIndex={currentQueuePosition}
          totalQuestions={totalQuestions}
          onAnswerSelect={handleNonMCQAnswerSelect}
          onNext={handleNextQuestion}
          isLastQuestion={isLastQuestion}
          inModal={false}
          reviewMode={isReviewRound}
          previousAnswer={currentQuestion.userSelection || null}
        />
      </div>
    );
  }

  // ── Case study / ordering / bowtie question ────────────────────────────
  if (currentQuestionType === 'casestudy' || currentQuestionType === 'ordering' || currentQuestionType === 'bowtie') {
    return (
      <div className="chat-quiz-stream-card" ref={cardRef}>
        {showXpPopup && <div className="cqs-xp-popup">+10 XP</div>}
        {progressHeader}
        <CaseStudyQuestion
          key={questionKey}
          quiz={currentQuestion}
          quizIndex={currentQueuePosition}
          totalQuestions={totalQuestions}
          onAnswerSelect={handleNonMCQAnswerSelect}
          onNext={handleNextQuestion}
          isLastQuestion={isLastQuestion}
          inModal={false}
          reviewMode={isReviewRound}
          previousAnswer={currentQuestion.userSelection || null}
        />
      </div>
    );
  }

  // ── MCQ (default) ──────────────────────────────────────────────────────
  return (
    <div className="chat-quiz-stream-card" ref={cardRef}>
      {/* XP Popup */}
      {showXpPopup && (
        <div className="cqs-xp-popup">
          +10 XP
        </div>
      )}

      {/* Progress bar */}
      {progressHeader}

      {/* Question content with animation wrapper */}
      <div key={questionKey} className="cqs-question-wrapper cqs-question-enter" data-selectable="true">
        {/* Question number badge */}
        <div className="cqs-question-number">
          {t('quiz.questionNumber', 'Question')} {queueIndex + 1}
          {isStreaming && !isReviewRound && ` ${t('quiz.of', 'of')} ${totalQuestions}+`}
          {!isStreaming && !isReviewRound && ` ${t('quiz.of', 'of')} ${totalQuestions}`}
        </div>

        {/* Topic badge */}
        {topic && (
          <div className="cqs-topic-badge">
            <span className="cqs-topic-icon">📚</span>
            <span className="cqs-topic-text">{topic}</span>
          </div>
        )}

        {/* Question */}
        <div className="cqs-question">
          {question || 'Loading question...'}
        </div>

        {/* Options */}
        <div className="cqs-options">
          {options.map((option, index) => {
            let optionClass = 'cqs-option cqs-option-enter';
            if (showFeedback) {
              optionClass += ' disabled';
              if (index === selectedIndex) {
                if (isCorrect) {
                  optionClass += ' correct';
                } else {
                  optionClass += ' incorrect';
                }
              }
            } else if (index === selectedIndex) {
              optionClass += ' selected';
            }

            return (
              <button
                key={index}
                className={optionClass}
                onClick={() => handleOptionClick(index)}
                disabled={showFeedback}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <span className="cqs-option-letter">{letters[index]}</span>
                <span className="cqs-option-text">{stripLetterPrefix(option)}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div
            className={`cqs-feedback ${isCorrect ? 'correct' : 'incorrect'}`}
            ref={feedbackRef}
          >
            <div className="cqs-feedback-header">
              <div className="cqs-feedback-icon">
                {isCorrect ? <CheckIcon /> : <XIcon />}
              </div>
              <span className="cqs-feedback-title">
                {isCorrect ? t('study.correct', 'Correct!') : t('study.incorrect', 'Incorrect')}
              </span>
            </div>

            {/* Show correct answer when wrong */}
            {!isCorrect && correctIndex >= 0 && correctIndex < options.length && (
              <div className="cqs-correct-answer">
                <span className="cqs-correct-label">{t('study.correctAnswer', 'Correct Answer:')}</span>
                <span className="cqs-correct-text">
                  {letters[correctIndex]}. {stripLetterPrefix(options[correctIndex])}
                </span>
              </div>
            )}

            {/* Short rationale */}
            {shortRationale && (
              <p className="cqs-feedback-short">{shortRationale}</p>
            )}

            {/* Learn more — defers full per-option rationale to an on-demand
                fetch. When the user opens it for the first time and we don't
                already have HTML cached, we expand the container immediately
                with a skeleton (instant feedback) and swap the real content
                in when the request resolves. */}
            {hasMore && (
              <>
                <button
                  className={`cqs-learn-more-btn${isRationaleLoading ? ' is-loading' : ''}`}
                  onClick={() => handleLearnMore(currentQueuePosition)}
                  disabled={isRationaleLoading}
                  aria-expanded={isRationaleExpanded}
                >
                  {isRationaleLoading ? (
                    <>
                      <span className="cqs-learn-more-spinner" aria-hidden="true" />
                      {t('study.loadingRationale', 'Loading…')}
                    </>
                  ) : isRationaleExpanded ? (
                    <>
                      <ChevronUpIcon />
                      {t('study.showLess', 'Show less')}
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon />
                      {t('study.learnMore', 'Learn more')}
                    </>
                  )}
                </button>

                {/* Smooth height-animated container. The grid-template-rows
                    0fr → 1fr trick lets us animate to natural content height
                    without a JS measurement pass. The inner div needs
                    overflow:hidden to clip during the transition. */}
                <div
                  className={`cqs-rationale-collapse${isRationaleExpanded ? ' expanded' : ''}`}
                  ref={rationaleRef}
                >
                  <div className="cqs-rationale-collapse-inner">
                    {isRationaleLoading ? (
                      <div className="cqs-rationale-skeleton" aria-hidden="true">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className="cqs-rationale-skel-row">
                            <div className="cqs-rationale-skel-marker" />
                            <div className="cqs-rationale-skel-body">
                              <div className="cqs-rationale-skel-line cqs-skel-w-30" />
                              <div className="cqs-rationale-skel-line cqs-skel-w-90" />
                              <div className="cqs-rationale-skel-line cqs-skel-w-70" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : hasRationaleError ? (
                      <div className="cqs-rationale-error">
                        <p>{t('study.rationaleError', "Couldn't load the explanation. Try again?")}</p>
                        <button
                          type="button"
                          className="cqs-rationale-retry-btn"
                          onClick={() => {
                            // Clear error then re-trigger fetch via Learn-more flow
                            setQuestionRationales(prev => {
                              const next = { ...prev };
                              delete next[currentQueuePosition];
                              return next;
                            });
                            // Collapse first so handleLearnMore re-opens with a fetch
                            setExpandedRationales(prev => {
                              const next = new Set(prev);
                              next.delete(currentQueuePosition);
                              return next;
                            });
                            // Defer to next tick so state has settled
                            setTimeout(() => handleLearnMore(currentQueuePosition), 0);
                          }}
                        >
                          {t('study.retry', 'Retry')}
                        </button>
                      </div>
                    ) : effectiveRationaleHtml ? (
                      renderRationale(effectiveRationaleHtml)
                    ) : null}
                  </div>
                </div>
              </>
            )}

            {/* Continue/Next button - always show when feedback is visible */}
            <button
              className={`cqs-feedback-btn ${isCorrect ? 'correct' : 'incorrect'}`}
              onClick={handleNextQuestion}
            >
              {hasMoreQuestions || moreQuestionsExpected || needsReviewRound()
                ? (isCorrect ? t('study.continue', 'CONTINUE') : t('study.gotIt', 'GOT IT'))
                : t('study.finish', 'FINISH')
              }
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ChatQuizStream;
