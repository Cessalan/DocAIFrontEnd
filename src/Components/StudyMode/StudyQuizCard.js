import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StudyProgressBar from './StudyProgressBar';
import StudyCelebration from './StudyCelebration';
import SATAQuestion from '../ChatInerface/SATAQuestion';
import CaseStudyQuestion from '../ChatInerface/CaseStudyQuestion';
import { playCorrectSound, playIncorrectSound, playCelebrationSound, playMilestoneSound } from '../../utils/soundEffects';
import useGlossary from '../Glossary/useGlossary';
import parseRationaleOptions from '../../utils/parseRationale';
import { fetchQuizRationale } from '../../Services/FastAPICalls';

/**
 * StudyQuizCard - Multiple quiz questions in study mode (Duolingo-style)
 * Questions answered incorrectly are retried at the end until all are correct.
 *
 * @param {Object} content - Quiz content { questions: [{ question, options, correctIndex, rationale }, ...] } or legacy single question
 * @param {Object} savedProgress - Saved progress for resuming { questionStatuses, queueIndex, isReviewRound }
 * @param {boolean} isReviewMode - If true, this is a review of completed content (only 5 XP)
 * @param {boolean} viewOnly - Dev mode: view without tracking progress, shows nav arrows
 * @param {Function} onAnswer - Callback when answer is submitted
 * @param {Function} onContinue - Callback when user completes all questions
 * @param {Function} onExit - Callback to exit/close the card
 */
/* Below this set size a mid-set milestone celebration interrupts more than it
   rewards — the completion celebration is only a couple of items away. */
const QUIZ_MILESTONE_MIN_SET = 8;

const StudyQuizCard = ({ content, savedProgress, isReviewMode = false, isDiagnostic = false, viewOnly = false, onAnswer, onRationaleFetched, onContinue, onExit, practiceMode = false, onQuestionContext, onSnapshot, renderLoading, onHint, caseStudyTutor, onCaseTutor }) => {
  const { t, i18n } = useTranslation();

  // Glossary popover for clickable medical terms in rationales
  const { rationaleRef, rationaleHandlers, popover: glossaryPopover } = useGlossary();

  // Handle both new format { questions: [...] } and legacy format { question, options, ... }
  const questions = content?.questions || [content];
  const isStreaming = content?._isStreaming || false;
  const expectedTotal = content?._expectedTotal || questions.length;
  // Use actual questions length for logic, but expectedTotal for progress display
  const totalQuestions = questions.length;

  // UI state
  const [selectedIndex, setSelectedIndex] = useState(savedProgress?.selectedIndex ?? null);
  const [showFeedback, setShowFeedback] = useState(savedProgress?.showFeedback || false);
  const [isCorrect, setIsCorrect] = useState(savedProgress?.isCorrect || false);

  // Per-question rationale state — keyed by question index, NOT queue position,
  // so a later re-shuffle doesn't lose previously-fetched HTML. Each entry:
  // { html, loading, error }. Tracking expanded vs cached separately means a
  // user can collapse one question, navigate away, come back, and the
  // expanded/collapsed state per question stays sticky.
  const [questionRationales, setQuestionRationales] = useState({});
  const [expandedRationales, setExpandedRationales] = useState(() => new Set());

  // "I don't know" state
  const [isDontKnow, setIsDontKnow] = useState(false);
  const [dontKnowMessage, setDontKnowMessage] = useState('');
  const [streamedText, setStreamedText] = useState('');
  const [isStreamingMessage, setIsStreamingMessage] = useState(false);

  // Question queue (like flashcard queue)
  const [questionQueue, setQuestionQueue] = useState(savedProgress?.questionQueue || []);
  const [queueIndex, setQueueIndex] = useState(() =>
    savedProgress?.queueIndex || 0
  );

  // Track question statuses: 'pending' | 'correct' | 'incorrect'
  // NOTE: During review round, statuses get overwritten to 'correct' as the student retries.
  // Use firstAttemptStatuses for scoring/diagnosis (frozen after first pass).
  const [questionStatuses, setQuestionStatuses] = useState(() =>
    savedProgress?.questionStatuses || {}
  );

  // First-attempt results — frozen when the first pass ends.
  // This is the truth for scoring: "how did she do before retrying?"
  const [firstAttemptStatuses, setFirstAttemptStatuses] = useState(() =>
    savedProgress?.firstAttemptStatuses || {}
  );

  // Track if we're in review round
  const [isReviewRound, setIsReviewRound] = useState(() =>
    savedProgress?.isReviewRound || false
  );

  // Track if we've already restored progress
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  // Celebration and transition state
  const [showMilestoneCelebration, setShowMilestoneCelebration] = useState(false);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const [showReviewTransition, setShowReviewTransition] = useState(false);
  const [reviewTransitionCount, setReviewTransitionCount] = useState(0);
  const [hasShownMilestone, setHasShownMilestone] = useState(false);
  const [waitingForNextQuestion, setWaitingForNextQuestion] = useState(false);

  // Rotating quiz loading messages
  const [quizMsgIndex, setQuizMsgIndex] = useState(0);
  const quizLoadingMessages = t('study.quizLoadingMessages', { returnObjects: true });
  const quizMsgArray = Array.isArray(quizLoadingMessages) ? quizLoadingMessages : [];
  const isShowingQuizLoading = !viewOnly && ((isStreaming && totalQuestions === 0) || waitingForNextQuestion);

  useEffect(() => {
    if (!isShowingQuizLoading || quizMsgArray.length === 0) return;
    setQuizMsgIndex(Math.floor(Math.random() * quizMsgArray.length));
    const interval = setInterval(() => {
      setQuizMsgIndex(prev => (prev + 1) % quizMsgArray.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isShowingQuizLoading, quizMsgArray.length]);

  // Safety valve: exit waitingForNextQuestion in two cases:
  //  1. Streaming ended (isStreaming became false) while we were waiting — the
  //     container finalized the content, so no more questions are coming.
  //  2. Still stuck after 15 seconds — the stream is likely dead.
  //
  // In both cases we need to properly trigger end-of-queue logic (review round
  // or completion), not just hide the spinner.
  useEffect(() => {
    if (!waitingForNextQuestion) return;

    const finalize = () => {
      console.warn('⏱️ Exiting waitingForNextQuestion — finalizing quiz with available questions');
      setWaitingForNextQuestion(false);
      if (practiceMode) return;

      // Replicate end-of-queue logic from handleNextQuestion:
      // Check if any questions were answered incorrectly → start review round
      const incorrectQuestions = Object.entries(questionStatuses)
        .filter(([_, status]) => status === 'incorrect')
        .map(([idx]) => parseInt(idx));

      if (incorrectQuestions.length > 0 && !isReviewRound) {
        const frozenStatuses = { ...questionStatuses };
        setFirstAttemptStatuses(frozenStatuses);
        setReviewTransitionCount(incorrectQuestions.length);
        setShowReviewTransition(true);
        setIsReviewRound(true);
        setQuestionQueue(incorrectQuestions);
        setQueueIndex(0);
        setSelectedIndex(null);
        setShowFeedback(false);
        setIsCorrect(false);
        /* per-question rationale state cleared elsewhere */
        setIsDontKnow(false);
        setIsStreamingMessage(false);
      }
      // If all correct, the allCorrect derived value will become true on
      // re-render (since allQuestionsReceived is now true) and the
      // completion celebration effect fires automatically.
    };

    // Case 1: streaming already ended — finalize immediately
    if (!isStreaming) {
      finalize();
      return;
    }

    // Case 2: streaming still going — give it 15 more seconds then bail
    if (practiceMode) return;
    const timeout = setTimeout(finalize, 15_000);
    return () => clearTimeout(timeout);
  }, [waitingForNextQuestion, isStreaming, practiceMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore from saved progress OR initialize fresh queue
  // Also handle streaming: update queue as new questions arrive
  useEffect(() => {
    if (totalQuestions === 0) return;

    if (practiceMode && hasRestoredProgress && !isReviewRound) {
      if (questionQueue.length !== totalQuestions) setQuestionQueue(questions.map((_, i) => i));
      if (waitingForNextQuestion && totalQuestions > queueIndex + 1) {
        setWaitingForNextQuestion(false);
        setQueueIndex(queueIndex + 1);
      }
      return;
    }

    // In viewOnly mode, always use a simple sequential queue for all questions
    if (viewOnly) {
      const fullQueue = questions.map((_, i) => i);
      if (questionQueue.length !== fullQueue.length) {
        console.log('👁️ viewOnly mode - initializing full question queue');
        setQuestionQueue(fullQueue);
        setQueueIndex(0);
      }
      return;
    }

    if (savedProgress?.questionStatuses && Object.keys(savedProgress.questionStatuses).length > 0) {
      if (!hasRestoredProgress) {
        console.log('📊 Restoring quiz progress:', savedProgress);

        setQuestionStatuses(savedProgress.questionStatuses);
        setIsReviewRound(savedProgress.isReviewRound || false);
        if (savedProgress.firstAttemptStatuses) {
          setFirstAttemptStatuses(savedProgress.firstAttemptStatuses);
        }

        // Rebuild the queue based on saved state
        if (savedProgress.isReviewRound) {
          // In review round - queue only contains questions that were incorrect
          // Use firstAttemptStatuses (frozen truth) to determine which need review
          const sourceStatuses = savedProgress.firstAttemptStatuses || savedProgress.questionStatuses;
          const reviewQuestions = Object.entries(sourceStatuses)
            .filter(([_, status]) => status === 'incorrect')
            .map(([idx]) => parseInt(idx));
          setQuestionQueue(reviewQuestions);
          setQueueIndex(savedProgress.queueIndex || 0);
        } else {
          // First pass - start from where we left off
          setQuestionQueue(questions.map((_, i) => i));
          setQueueIndex(savedProgress.queueIndex || 0);
        }

        setHasRestoredProgress(true);
      }
    } else if (!hasRestoredProgress && !isReviewRound) {
      // Fresh start or streaming - update queue to match available questions
      // This allows us to show questions as they stream in
      // Don't reset queue if we're in review round (queue is already filtered to incorrect questions)
      const newQueue = questions.map((_, i) => i);
      if (newQueue.length !== questionQueue.length) {
        console.log(`🔄 Updating question queue: ${questionQueue.length} -> ${newQueue.length}`);
        setQuestionQueue(newQueue);

        // If user was waiting for next question, auto-advance now
        if (waitingForNextQuestion && newQueue.length > queueIndex + 1) {
          setWaitingForNextQuestion(false);
          setQueueIndex(queueIndex + 1);
        }
      }
    }
  }, [savedProgress, questions, totalQuestions, questionQueue.length, hasRestoredProgress, waitingForNextQuestion, queueIndex, isReviewRound, viewOnly, practiceMode]);

  // Current question from queue
  const currentQueuePosition = questionQueue[queueIndex];
  const currentQuestion = questions[currentQueuePosition] || {};
  const snapshotCallback = useRef(onSnapshot);
  const contextCallback = useRef(onQuestionContext);
  snapshotCallback.current = onSnapshot;
  contextCallback.current = onQuestionContext;
  useEffect(() => {
    if (currentQueuePosition === undefined) return;
    contextCallback.current?.({ question: currentQuestion, questionIndex: currentQueuePosition,
      selectedIndex, showFeedback, isCorrect });
  }, [currentQuestion, currentQueuePosition, selectedIndex, showFeedback, isCorrect]);
  useEffect(() => {
    if (!questionQueue.length) return;
    snapshotCallback.current?.({ questionQueue, queueIndex, questionStatuses, firstAttemptStatuses,
      isReviewRound, selectedIndex, showFeedback, isCorrect });
  }, [questionQueue, queueIndex, questionStatuses, firstAttemptStatuses, isReviewRound, selectedIndex, showFeedback, isCorrect]);
  // Pull both the legacy full-rationale HTML and the new one-sentence blurb.
  // - rationale: only present on legacy saved questions or after a Learn-more
  //   fetch; new generations leave this empty.
  // - correctBlurb: shipped with every new question; renders as the immediate
  //   one-line "why" under the verdict.
  const { question, options = [], correctIndex: rawCorrectIndex } = currentQuestion;
  // Quiz nodes used to be MCQ-only, so questionType was absent and could be
  // assumed. They now emit a MCQ-weighted mix with at least one SATA per node
  // (STUDY_QUIZ_TYPES, backend) — an MCQ-only first quiz was the last thing
  // ~39% of students ever saw, and MCQ is the format they're already good at.
  // Missing questionType still means MCQ, which keeps every saved quiz working.
  const isSata = currentQuestion.questionType === 'sata';
  const isCaseStudy = ['casestudy', 'ordering', 'bowtie'].includes(currentQuestion.questionType);
  const rationale = currentQuestion.rationale || currentQuestion.justification || '';
  const correctBlurb = currentQuestion.correctBlurb || currentQuestion.correct_blurb || '';

  // Normalize correctIndex - convert to number if string
  const correctIndex = (() => {
    if (rawCorrectIndex === undefined || rawCorrectIndex === null) return -1;

    // If it's already a number, use it directly (backend sends 0-indexed)
    if (typeof rawCorrectIndex === 'number') {
      return rawCorrectIndex;
    }

    // If it's a string, try to parse it
    if (typeof rawCorrectIndex === 'string') {
      // Check if it's a letter like "D" or "d"
      if (/^[A-Fa-f]$/.test(rawCorrectIndex)) {
        return rawCorrectIndex.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
      }

      // Try parsing as number
      const parsed = parseInt(rawCorrectIndex, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return -1;
  })();

  // Debug: log correctIndex to help diagnose grading issues
  console.log('🎯 Quiz grading debug:', {
    rawCorrectIndex,
    normalizedCorrectIndex: correctIndex,
    optionsCount: options.length,
    currentQueuePosition,
    queueIndex
  });

  // ── Learn-more handler ──────────────────────────────────────────────
  // Fetches the per-option rationale on demand. Three branches:
  //   1. Already expanded → collapse, no fetch.
  //   2. Not expanded but rationale already cached (or seeded from a legacy
  //      saved question) → expand instantly.
  //   3. Not expanded and no rationale yet → expand the container immediately
  //      with a skeleton so the click feels instant, then kick off the fetch.
  const handleLearnMore = useCallback(async (qIndex) => {
    if (qIndex < 0 || qIndex >= questions.length) return;

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
    const seededHtml = q.rationale || q.justification || '';
    const haveHtml = (cached && cached.html) || seededHtml;

    setExpandedRationales(prev => new Set(prev).add(qIndex));

    if (haveHtml) return;  // Branch 2.

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

  // Per-question rationale state for the currently displayed question.
  const cachedRationale = questionRationales[currentQueuePosition];
  const effectiveRationaleHtml = (cachedRationale && cachedRationale.html) || rationale || '';
  const isRationaleExpanded = expandedRationales.has(currentQueuePosition);
  const isRationaleLoading = cachedRationale ? cachedRationale.loading : false;
  const hasRationaleError = cachedRationale ? (cachedRationale.error && !cachedRationale.html) : false;

  // Reset cache helper for the retry button — clears state + collapses, then
  // schedules a re-fetch via handleLearnMore on the next tick.
  const retryRationale = useCallback((qIndex) => {
    setQuestionRationales(prev => {
      const next = { ...prev };
      delete next[qIndex];
      return next;
    });
    setExpandedRationales(prev => {
      const next = new Set(prev);
      next.delete(qIndex);
      return next;
    });
    setTimeout(() => handleLearnMore(qIndex), 0);
  }, [handleLearnMore]);

  // Calculate progress - count correct answers BEFORE current question
  // This ensures progress only updates when clicking "Next", not when answering
  const getCorrectCountBeforeCurrent = () => {
    let count = 0;
    for (const [idx, status] of Object.entries(questionStatuses)) {
      // Don't count the current question - it will be shown via includeCurrentAsComplete
      if (parseInt(idx) !== currentQueuePosition && status === 'correct') {
        count++;
      }
    }
    return count;
  };

  const correctCountBeforeCurrent = getCorrectCountBeforeCurrent();
  const correctCount = Object.values(questionStatuses).filter(s => s === 'correct').length;

  // Only consider "all correct" when:
  // 1. We have answered all available questions correctly, AND
  // 2. If streaming, we have received all expected questions
  const allQuestionsReceived = !isStreaming || totalQuestions >= expectedTotal;
  const allCorrect = correctCount === totalQuestions && totalQuestions > 0 && allQuestionsReceived;

  // Milestone calculation constants
  // IMPORTANT: Use expectedTotal (default 12) for milestone calculations, not actual questions received
  // This prevents milestone from triggering too early during streaming (e.g., 1/1 = 100% vs 1/12 = 8%)
  const milestoneTotal = expectedTotal || QUIZ_MILESTONE_MIN_SET;
  const minQuestionsForMilestone = Math.ceil(milestoneTotal * 0.3); // 30% of expected total
  // Sets are 5 questions now. A 30% milestone would fire after 2, with the
  // completion celebration 3 questions later — two interruptions inside one
  // short node. Mid-set celebration only earns its place on longer sets.
  const milestoneWorthShowing = !practiceMode && milestoneTotal >= QUIZ_MILESTONE_MIN_SET;

  // Trigger milestone celebration at 30% (long sets only)
  useEffect(() => {
    if (milestoneWorthShowing && correctCount >= minQuestionsForMilestone && !hasShownMilestone && !isReviewRound) {
      setShowMilestoneCelebration(true);
      setHasShownMilestone(true);
      playMilestoneSound();
    }
  }, [milestoneWorthShowing, correctCount, minQuestionsForMilestone, hasShownMilestone, isReviewRound]);

  // Trigger completion celebration when all correct
  useEffect(() => {
    if (allCorrect && totalQuestions > 0) {
      // Small delay to let the UI update first
      const timer = setTimeout(() => {
        setShowCompletionCelebration(true);
        playCelebrationSound();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allCorrect, totalQuestions]);

  // Typewriter effect for "I don't know" encouragement message
  const streamedTextRef = useRef('');
  const typewriterTimeoutRef = useRef(null);
  useEffect(() => {
    if (!isStreamingMessage || !dontKnowMessage) return;

    streamedTextRef.current = '';
    setStreamedText('');
    let charIndex = 0;

    const typeNextChar = () => {
      if (charIndex < dontKnowMessage.length) {
        streamedTextRef.current += dontKnowMessage[charIndex];
        setStreamedText(streamedTextRef.current);
        charIndex++;
        // Random jitter per character for natural feel
        typewriterTimeoutRef.current = setTimeout(typeNextChar, 12 + Math.random() * 12);
      } else {
        setIsStreamingMessage(false);
      }
    };

    typewriterTimeoutRef.current = setTimeout(typeNextChar, 80); // Brief initial delay

    return () => {
      if (typewriterTimeoutRef.current) clearTimeout(typewriterTimeoutRef.current);
    };
  }, [isStreamingMessage, dontKnowMessage]);

  // Handle milestone celebration continue
  const handleMilestoneContinue = () => {
    setShowMilestoneCelebration(false);
  };

  // Handle completion celebration continue
  const handleCompletionContinue = () => {
    setShowCompletionCelebration(false);
    if (onContinue) onContinue();
  };

  // Progress bar logic (same as flashcards):
  // - First pass: progress = queueIndex (advances on "Next Question" click, not on answer)
  // - Review round: progress = correctCountBeforeCurrent, current shown via includeCurrentAsComplete
  // - Use expectedTotal (12) for progress bar during streaming for consistent display
  const getProgressValues = () => {
    // Use expectedTotal (12) for progress bar total during streaming
    const displayTotal = expectedTotal;

    if (allCorrect) {
      // All done - full progress
      return { current: displayTotal, total: displayTotal, includeCurrentAsComplete: false };
    }

    if (isReviewRound) {
      // Review round - show progress toward all correct (mastered)
      // Use correctCountBeforeCurrent so it doesn't jump when answering
      return {
        current: correctCountBeforeCurrent,
        total: totalQuestions, // Use actual count during review
        includeCurrentAsComplete: showFeedback && questionStatuses[currentQueuePosition] === 'correct'
      };
    }

    // First pass - progress is based on queueIndex (how many we've moved past)
    // Only advances when clicking "Next Question", not when answering
    return {
      current: queueIndex,
      total: displayTotal,
      includeCurrentAsComplete: showFeedback
    };
  };

  const progressValues = getProgressValues();

  // Quiz icon
  const QuizIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );

  // Checkmark icon
  const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  // X icon
  const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  // Renders the expanded rationale: parses "<b>Option X is correct</b> because..."
  // into per-option rows. Falls back to raw HTML if the format doesn't match.
  const renderRationale = (rationale) => {
    const parsed = parseRationaleOptions(rationale);

    if (parsed.length === 0) {
      return (
        <div
          ref={rationaleRef}
          className="study-quiz-feedback-rationale"
          {...rationaleHandlers}
          data-selectable="true"
          dangerouslySetInnerHTML={{ __html: rationale }}
        />
      );
    }

    return (
      <div
        ref={rationaleRef}
        className="study-quiz-feedback-rationale structured"
        {...rationaleHandlers}
        data-selectable="true"
      >
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

  // Refresh icon for review round
  const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );

  // Arrow right icon
  const ArrowRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );

  // Lightbulb icon for "I don't know" feedback
  const LightbulbIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </svg>
  );

  // Help circle icon for "I don't know" button
  const HelpCircleIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Strip letter prefix from option text (e.g., "A) To ensure..." -> "To ensure...")
  const stripLetterPrefix = (text) => {
    if (!text) return '';
    // Match patterns like "A) ", "A. ", "a) ", "a. ", "A: ", "a: " at the start
    return text.replace(/^[A-Fa-f][).:]\s*/, '');
  };

  // Extract short rationale (first sentence or paragraph about the correct answer)
  const getShortRationale = (fullRationale) => {
    if (!fullRationale) return null;

    // Remove HTML tags for text processing
    const textOnly = fullRationale.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Look for the correct answer explanation (usually starts with "Option X is correct" or similar)
    const correctMatch = textOnly.match(/Option\s+[A-D]\s+is\s+correct[^.]*\./i);
    if (correctMatch) {
      return correctMatch[0];
    }

    // Fallback: get first sentence
    const firstSentence = textOnly.match(/^[^.!?]+[.!?]/);
    if (firstSentence && firstSentence[0].length < 200) {
      return firstSentence[0];
    }

    // If first sentence is too long, truncate
    return textOnly.substring(0, 150) + '...';
  };

  // Check if rationale has more content beyond the short version
  const hasMoreRationale = (fullRationale, shortRationale) => {
    if (!fullRationale || !shortRationale) return false;
    const textOnly = fullRationale.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return textOnly.length > shortRationale.length + 20;
  };

  // Chevron down icon
  const ChevronDownIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  // Chevron up icon
  const ChevronUpIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );

  const handleOptionClick = (index) => {
    if (showFeedback) return; // Already answered

    // Get the current correct index at click time (avoid stale closure)
    const currentCorrectIndex = questions[currentQueuePosition]?.correctIndex;
    const normalizedCorrect = typeof currentCorrectIndex === 'number'
      ? currentCorrectIndex
      : typeof currentCorrectIndex === 'string'
        ? (/^[A-Fa-f]$/.test(currentCorrectIndex)
            ? currentCorrectIndex.toUpperCase().charCodeAt(0) - 65
            : parseInt(currentCorrectIndex, 10))
        : -1;

    console.log('🎯 Option clicked:', {
      clickedIndex: index,
      correctIndex,
      currentCorrectIndex,
      normalizedCorrect,
      isMatch: index === normalizedCorrect,
      rawCorrectIndex
    });

    setSelectedIndex(index);
    const correct = index === normalizedCorrect;
    setIsCorrect(correct);
    setShowFeedback(true);

    // Play sound effect based on answer
    if (correct) {
      playCorrectSound();
    } else {
      playIncorrectSound();
    }

    // Update question status
    const newStatuses = {
      ...questionStatuses,
      [currentQueuePosition]: correct ? 'correct' : 'incorrect'
    };
    setQuestionStatuses(newStatuses);

    // Notify parent with progress for saving
    if (onAnswer) {
      onAnswer({
        selectedIndex: index,
        isCorrect: correct,
        questionIndex: currentQueuePosition,
        progress: {
          questionStatuses: newStatuses,
          firstAttemptStatuses: Object.keys(firstAttemptStatuses).length > 0
            ? firstAttemptStatuses  // Use frozen snapshot if available
            : newStatuses,          // First pass — current statuses ARE first-attempt
          queueIndex: queueIndex,
          isReviewRound: isReviewRound
        }
      });
    }
  };

  /**
   * Answer handler for non-MCQ questions (currently SATA).
   *
   * SATAQuestion owns its own selection UI, submit button and feedback panel,
   * so this does only the bookkeeping `handleOptionClick` does — status map,
   * sound, and the onAnswer callback the parent saves progress from. It
   * deliberately does NOT set selectedIndex: that drives the MCQ option
   * styling, which isn't rendered for this branch.
   *
   * @param {Object} answerData - from SATAQuestion: { isCorrect, score, maxScore, ... }
   */
  const handleComplexAnswer = (answerData) => {
    if (showFeedback) return;

    const correct = !!answerData?.isCorrect;
    setIsCorrect(correct);
    setShowFeedback(true);

    if (correct) {
      playCorrectSound();
    } else {
      playIncorrectSound();
    }

    const newStatuses = {
      ...questionStatuses,
      [currentQueuePosition]: correct ? 'correct' : 'incorrect'
    };
    setQuestionStatuses(newStatuses);

    if (onAnswer) {
      onAnswer({
        ...answerData,
        selectedIndex: null,
        questionType: answerData?.questionType || 'sata',
        isCorrect: correct,
        score: answerData?.score,
        maxScore: answerData?.maxScore,
        questionIndex: currentQueuePosition,
        progress: {
          questionStatuses: newStatuses,
          firstAttemptStatuses: Object.keys(firstAttemptStatuses).length > 0
            ? firstAttemptStatuses
            : newStatuses,
          queueIndex: queueIndex,
          isReviewRound: isReviewRound
        }
      });
    }
  };

  const handleDontKnow = () => {
    if (showFeedback) return;
    if (practiceMode && onHint) { onHint(); return; }

    // Pick a random encouraging message
    const messages = t('study.dontKnowMessages', { returnObjects: true });
    const msgArray = Array.isArray(messages) ? messages : [];
    const randomMsg = msgArray.length > 0
      ? msgArray[Math.floor(Math.random() * msgArray.length)]
      : "That's okay! This one will come back for review.";

    setSelectedIndex(null);
    setIsCorrect(false);
    setShowFeedback(true);
    setIsDontKnow(true);
    setDontKnowMessage(randomMsg);
    setIsStreamingMessage(true);

    playIncorrectSound();

    // Update question status as incorrect
    const newStatuses = {
      ...questionStatuses,
      [currentQueuePosition]: 'incorrect'
    };
    setQuestionStatuses(newStatuses);

    // Notify parent — isCorrect: false so performance tracking penalizes
    if (onAnswer) {
      onAnswer({
        selectedIndex: null,
        isCorrect: false,
        questionIndex: currentQueuePosition,
        progress: {
          questionStatuses: newStatuses,
          firstAttemptStatuses: Object.keys(firstAttemptStatuses).length > 0
            ? firstAttemptStatuses
            : newStatuses,
          queueIndex: queueIndex,
          isReviewRound: isReviewRound
        }
      });
    }
  };

  const handleNextQuestion = () => {
    const nextQueueIndex = queueIndex + 1;

    // Check if we've finished the current queue
    if (nextQueueIndex >= questionQueue.length) {
      // If still streaming and we haven't reached expected total, wait for more
      // The queue will update via useEffect when new questions arrive
      if (isStreaming && totalQuestions < expectedTotal) {
        // Show waiting state - user answered faster than generation
        setWaitingForNextQuestion(true);
        setSelectedIndex(null);
        setShowFeedback(false);
        setIsCorrect(false);
        /* per-question rationale state cleared elsewhere */
        setIsDontKnow(false);
        setIsStreamingMessage(false);
        return;
      }

      // ── Diagnostic: finish here, right or wrong ──────────────────────
      // The normal flow relies on the review round to mop up incorrect
      // answers, so the end of the queue is only ever reached with
      // everything correct — which is why completion is driven by
      // `allCorrect`. The diagnostic has no review round (it calibrates,
      // it doesn't drill), so that invariant doesn't hold: reaching the end
      // with a single wrong answer would fall through to nothing and strand
      // the student on the last question with no button.
      if (isDiagnostic || practiceMode) {
        setShowCompletionCelebration(true);
        playCelebrationSound();
        return;
      }

      // Get questions that were incorrect (need review)
      const questionsToReview = Object.entries(questionStatuses)
        .filter(([_, status]) => status === 'incorrect')
        .map(([idx]) => parseInt(idx));

      if (questionsToReview.length > 0) {
        // ── Freeze first-attempt results before review round begins ──
        // This snapshot is the truth for scoring and diagnosis.
        const frozenStatuses = { ...questionStatuses };
        setFirstAttemptStatuses(frozenStatuses);

        // Show review transition screen before starting review round
        setReviewTransitionCount(questionsToReview.length);
        setShowReviewTransition(true);

        // Set review round FIRST to prevent useEffect from resetting the queue
        setIsReviewRound(true);

        // Prepare the review queue (will be activated when transition continues)
        setQuestionQueue(questionsToReview);
        setQueueIndex(0);
        setSelectedIndex(null);
        setShowFeedback(false);
        setIsCorrect(false);
        /* per-question rationale state cleared elsewhere */
        setIsDontKnow(false);
        setIsStreamingMessage(false);

        // Save progress when entering review round
        if (onAnswer) {
          onAnswer({
            selectedIndex: null,
            isCorrect: null,
            questionIndex: null,
            progress: {
              questionStatuses: questionStatuses,
              firstAttemptStatuses: frozenStatuses,
              queueIndex: 0,
              isReviewRound: true
            }
          });
        }
      }
      // If no questions to review, allCorrect will be true and we show completion
    } else {
      // Move to next question in queue
      setQueueIndex(nextQueueIndex);
      setSelectedIndex(null);
      setShowFeedback(false);
      setIsCorrect(false);
      /* per-question rationale state cleared elsewhere */
      setIsDontKnow(false);
      setIsStreamingMessage(false);

      // Save progress after advancing
      if (onAnswer) {
        onAnswer({
          selectedIndex: null,
          isCorrect: null,
          questionIndex: null,
          progress: {
            questionStatuses: questionStatuses,
            firstAttemptStatuses: Object.keys(firstAttemptStatuses).length > 0
              ? firstAttemptStatuses : questionStatuses,
            queueIndex: nextQueueIndex,
            isReviewRound: isReviewRound
          }
        });
      }
    }
  };

  // Handle review transition continue
  const handleReviewTransitionContinue = () => {
    setShowReviewTransition(false);
    // isReviewRound is already set to true when entering review mode
  };

  const getOptionClass = (index) => {
    let classes = 'study-quiz-option';

    if (showFeedback) {
      classes += ' disabled';
      // Highlight user's selection: green if correct, peach if wrong
      if (index === selectedIndex) {
        if (isCorrect) {
          classes += ' correct'; // User picked correctly - show green
        } else {
          classes += ' incorrect'; // User picked wrong - show peach
        }
      }
    } else if (index === selectedIndex) {
      classes += ' selected';
    }

    return classes;
  };

  // Check if there are more questions in the queue OR more are being streamed
  const hasMoreQuestions = queueIndex < questionQueue.length - 1;
  const moreQuestionsExpected = isStreaming && totalQuestions < expectedTotal;
  const shouldShowContinueButton = hasMoreQuestions || moreQuestionsExpected;

  // Diagnostic on its final question: no more questions and no review round
  // to fall through to, so the advance button has to be rendered explicitly
  // or there is no way out of the card.
  const canFinishDiagnostic = isDiagnostic && !hasMoreQuestions && !moreQuestionsExpected;

  // Check if we need to start review round after current question
  const needsReviewRound = () => {
    // If more questions are coming, don't start review yet
    if (hasMoreQuestions || moreQuestionsExpected) return false;
    // The diagnostic never sends the student back through misses. Its job is to
    // calibrate the plan — the plan itself is what addresses the gaps. Making
    // someone re-answer questions they just missed, on their very first
    // interaction, is exactly the experience we're removing.
    if (isDiagnostic) return false;
    const incorrectCount = Object.values(questionStatuses).filter(s => s === 'incorrect').length;
    return incorrectCount > 0;
  };

  return (
    <div className="study-step-card">
      <div className="study-card-header">
        <div className="study-card-icon quiz">
          <QuizIcon />
        </div>
        <h2 className="study-card-title">
          {isDiagnostic
            ? t('study.calibrationTitle', 'Quick calibration')
            : practiceMode ? `${t('quiz.questionNumber', 'Question')} ${queueIndex + 1} / ${expectedTotal}` : t('study.quickCheck', 'Quick Check')}
        </h2>
        {onExit && (
          <button className="study-card-close-btn" onClick={onExit} title={t('study.close', 'Close')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar - Duolingo style */}
      <StudyProgressBar
        current={progressValues.current}
        total={progressValues.total}
        includeCurrentAsComplete={progressValues.includeCurrentAsComplete}
      />

      {/* Show celebration/transition INSIDE the card content, or show quiz content */}
      {/* In viewOnly mode, skip all celebrations and show questions directly */}
      {!viewOnly && showMilestoneCelebration ? (
        <div className="study-card-content">
          <StudyCelebration
            type="milestone"
            inline={true}
            correctCount={correctCount}
            totalCount={totalQuestions}
            expectedTotal={milestoneTotal}
            onContinue={handleMilestoneContinue}
          />
        </div>
      ) : !viewOnly && showCompletionCelebration ? (
        <div className="study-card-content">
          {isDiagnostic ? (
            /* Diagnostic outcome is a TUNED PLAN, not a score. Showing "1/3"
               to someone who just met the product tells them they're bad at
               this; showing "your plan is tuned" tells them it worked. */
            <div className="study-diagnostic-done">
              <div className="study-diagnostic-done__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" width="34" height="34">
                  <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21 8 13.9l-6-4.5h7.6z" />
                </svg>
              </div>
              <h3 className="study-diagnostic-done__title">
                {t('study.diagnosticDoneTitle', 'Plan tuned to you')}
              </h3>
              <p className="study-diagnostic-done__body">
                {t('study.diagnosticDoneBody',
                  "That's all I needed. Your plan now starts where it'll help you most.")}
              </p>
              <button className="study-continue-btn" onClick={handleCompletionContinue}>
                {t('study.diagnosticDoneCta', 'See my plan')}
                <ArrowRightIcon />
              </button>
            </div>
          ) : (
            <StudyCelebration
              type="complete"
              inline={true}
              onContinue={handleCompletionContinue}
            />
          )}
        </div>
      ) : !viewOnly && showReviewTransition ? (
        <div className="study-card-content">
          <div className="study-review-transition">
            <div className="review-transition-icon">
              <RefreshIcon />
            </div>
            <h3 className="review-transition-title">
              {t('study.timeToReview', 'Time to Review!')}
            </h3>
            <p className="review-transition-message">
              {t('study.reviewQuestionMessage', {
                count: reviewTransitionCount,
                defaultValue: `You have ${reviewTransitionCount} question${reviewTransitionCount > 1 ? 's' : ''} to review. Let's try again!`
              })}
            </p>
            <button className="study-continue-btn" onClick={handleReviewTransitionContinue}>
              {t('study.startReview', "Let's Go!")}
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      ) : !viewOnly && ((isStreaming && totalQuestions === 0) || waitingForNextQuestion) ? (
        // Show loading state while waiting for first question or next question to stream in
        <div className="study-card-content">
          {renderLoading ? renderLoading() : <div className="study-streaming-loading">
            <div className="study-loading-spinner" />
            <p className="study-loading-text" key={quizMsgIndex}>
              {quizMsgArray.length > 0
                ? quizMsgArray[quizMsgIndex]
                : t('study.generatingQuestions', 'Generating questions...')}
            </p>
          </div>}
        </div>
      ) : (
        <>
          {/* Review badge - show when reviewing questions */}
          {isReviewRound && !allCorrect && (
            <div className="study-review-badge">
              <RefreshIcon />
              <span>{t('study.reviewing', { count: questionQueue.length, defaultValue: `Reviewing ${questionQueue.length} question${questionQueue.length > 1 ? 's' : ''}` })}</span>
            </div>
          )}

          {/* Dev mode navigation arrows */}
          {viewOnly && (
            <div className="study-dev-nav">
              <button
                className="study-dev-nav-btn prev"
                onClick={() => {
                  if (queueIndex > 0) {
                    setQueueIndex(queueIndex - 1);
                    setSelectedIndex(null);
                    setShowFeedback(false);
                    /* per-question rationale state cleared elsewhere */
                  }
                }}
                disabled={queueIndex === 0}
                title="Previous question"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <span className="study-dev-nav-counter">
                {queueIndex + 1} / {totalQuestions}
              </span>
              <button
                className="study-dev-nav-btn next"
                onClick={() => {
                  if (queueIndex < totalQuestions - 1) {
                    setQueueIndex(queueIndex + 1);
                    setSelectedIndex(null);
                    setShowFeedback(false);
                    /* per-question rationale state cleared elsewhere */
                  }
                }}
                disabled={queueIndex >= totalQuestions - 1}
                title="Next question"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          )}

          <div className="study-card-content" data-selectable="true">
            {/* Diagnostic framing — states the contract before the first
                question: short, purposeful, and NOT graded. The opening quiz
                is where the most users are lost; naming the stakes removes
                the reason to bail. */}
            {isDiagnostic && (
              <div className="study-quiz-diagnostic-note">
                <span className="study-quiz-diagnostic-note__icon" aria-hidden="true">✨</span>
                <span>
                  {t('study.diagnosticIntro', {
                    count: expectedTotal || 3,
                    defaultValue: "{{count}} quick questions so I can tune your plan — this isn't graded."
                  })}
                </span>
              </div>
            )}

            {isCaseStudy ? (
              <CaseStudyQuestion key={`${currentQueuePosition}-${isReviewRound}`}
                tutorPanel={caseStudyTutor} onOpenTutor={onCaseTutor}
                quiz={currentQuestion} quizIndex={queueIndex} totalQuestions={expectedTotal || totalQuestions}
                previousAnswer={practiceMode ? currentQuestion.userSelection : null}
                onAnswerSelect={handleComplexAnswer} onNext={handleNextQuestion}
                isLastQuestion={queueIndex >= questionQueue.length - 1} inModal={false} />
            ) : isSata ? (
              /* SATA renders its whole question — stem, multi-select options,
                 submit and feedback — so it replaces the MCQ body rather than
                 slotting into it. Same component the exam card uses, so the
                 two surfaces grade select-all identically. quizIndex is the
                 queue position, which advances on every step (including the
                 review round), giving the component a fresh key each time. */
              <SATAQuestion
                key={`${currentQueuePosition}-${isReviewRound}`}
                quiz={currentQuestion}
                quizIndex={queueIndex}
                totalQuestions={expectedTotal || totalQuestions}
                onAnswerSelect={handleComplexAnswer}
                previousAnswer={practiceMode ? currentQuestion.userSelection : null}
                onNext={handleNextQuestion}
                isLastQuestion={queueIndex >= questionQueue.length - 1}
                inModal={false}
              />
            ) : (
            <>
            {/* Question text */}
            <p className="study-quiz-question">{question || 'Loading question...'}</p>

            {/* DEV MODE: Show correct answer for testing */}
            {!practiceMode && process.env.NODE_ENV === 'development' && (
              <div style={{
                background: '#fef3c7',
                border: '1px dashed #f59e0b',
                padding: '4px 8px',
                borderRadius: '4px',
                marginBottom: '6px',
                fontSize: '10px',
                color: '#92400e'
              }}>
                🧪 DEV: Answer <strong>{letters[correctIndex] || '?'}</strong>
              </div>
            )}

            {/* Options */}
            <div className="study-quiz-options">
              {options.map((option, index) => (
                <button
                  key={index}
                  className={getOptionClass(index)}
                  onClick={() => handleOptionClick(index)}
                  disabled={showFeedback}
                >
                  <span className="study-quiz-option-letter">
                    {letters[index]}
                  </span>
                  <span className="study-quiz-option-text">{stripLetterPrefix(option)}</span>
                </button>
              ))}
            </div>

            {/* "I don't know" button - below options, hidden after feedback.
                On the diagnostic it's phrased forward-looking ("Not sure yet")
                — same signal, none of the finality. */}
            {!showFeedback && !viewOnly && (
              <button className="study-quiz-idk-btn" onClick={handleDontKnow}>
                <HelpCircleIcon />
                {isDiagnostic
                  ? t('study.notSureYet', 'Not sure yet')
                  : t('study.dontKnow', "I don't know")}
              </button>
            )}

            {/* Feedback */}
            {showFeedback && (() => {
              // Prefer the new one-sentence blurb shipped inline. Fall back to
              // the legacy parser for old saved quizzes that still have a full
              // justification HTML blob.
              const shortRationale = correctBlurb || getShortRationale(rationale);
              // After answering, we always offer Learn-more — either the
              // rationale exists already or we can fetch it on demand. Hide
              // only when the question is malformed.
              const hasMore = !!(question && correctIndex >= 0 && correctIndex < (options?.length || 0));

              // "I don't know" gets its own amber feedback panel with typewriter effect
              if (isDontKnow) {
                return (
                  <div className="study-quiz-feedback unsure">
                    <div className="study-quiz-feedback-header">
                      <div className="study-quiz-feedback-icon">
                        <LightbulbIcon />
                      </div>
                      <span className="study-quiz-feedback-title idk-streaming">
                        {streamedText}
                        {isStreamingMessage && <span className="idk-cursor" />}
                      </span>
                    </div>

                    {/* Reveal content after streaming completes */}
                    {!isStreamingMessage && (
                      <div className="idk-reveal-content">
                        <p className="idk-review-note">
                          {t('study.dontKnowReviewNote', 'This one will come back for review.')}
                        </p>

                        {/* Show correct answer */}
                        <div className="study-quiz-correct-answer">
                          <span className="correct-answer-label">{t('study.correctAnswer', 'Correct Answer:')}</span>
                          <span className="correct-answer-text">
                            {letters[correctIndex]}. {stripLetterPrefix(options[correctIndex])}
                          </span>
                        </div>

                        {/* Short rationale */}
                        {shortRationale && (
                          <p className="study-quiz-feedback-short">
                            {shortRationale}
                          </p>
                        )}

                        {/* Expandable full rationale — fetched on demand. The
                            container expands instantly with a skeleton, real
                            content fades in once the request resolves. */}
                        {hasMore && (
                          <>
                            <button
                              className={`study-quiz-learn-more-btn${isRationaleLoading ? ' is-loading' : ''}`}
                              onClick={() => handleLearnMore(currentQueuePosition)}
                              disabled={isRationaleLoading}
                              aria-expanded={isRationaleExpanded}
                            >
                              {isRationaleLoading ? (
                                <>
                                  <span className="study-quiz-learn-more-spinner" aria-hidden="true" />
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

                            <div className={`study-quiz-rationale-collapse${isRationaleExpanded ? ' expanded' : ''}`}>
                              <div className="study-quiz-rationale-collapse-inner">
                                {isRationaleLoading ? (
                                  <div className="study-quiz-rationale-skeleton" aria-hidden="true">
                                    {[0, 1, 2, 3].map(i => (
                                      <div key={i} className="study-quiz-rationale-skel-row">
                                        <div className="study-quiz-rationale-skel-marker" />
                                        <div className="study-quiz-rationale-skel-body">
                                          <div className="study-quiz-rationale-skel-line w-30" />
                                          <div className="study-quiz-rationale-skel-line w-90" />
                                          <div className="study-quiz-rationale-skel-line w-70" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : hasRationaleError ? (
                                  <div className="study-quiz-rationale-error">
                                    <p>{t('study.rationaleError', "Couldn't load the explanation. Try again?")}</p>
                                    <button
                                      type="button"
                                      className="study-quiz-rationale-retry-btn"
                                      onClick={() => retryRationale(currentQueuePosition)}
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

                        {/* GOT IT button */}
                        {(shouldShowContinueButton || needsReviewRound() || canFinishDiagnostic) && (
                          <button
                            className="study-quiz-feedback-btn incorrect"
                            onClick={handleNextQuestion}
                          >
                            {t('study.gotIt', 'GOT IT')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div className={`study-quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
                  <div className="study-quiz-feedback-header">
                    <div className="study-quiz-feedback-icon">
                      {isCorrect ? <CheckIcon /> : <XIcon />}
                    </div>
                    <span className="study-quiz-feedback-title">
                      {isCorrect ? t('study.correct', 'Correct!') : t('study.incorrect', 'Incorrect')}
                    </span>
                  </div>

                  {/* Show correct answer when wrong - Duolingo style */}
                  {!isCorrect && (
                    <div className="study-quiz-correct-answer">
                      <span className="correct-answer-label">{t('study.correctAnswer', 'Correct Answer:')}</span>
                      <span className="correct-answer-text">
                        {letters[correctIndex]}. {stripLetterPrefix(options[correctIndex])}
                      </span>
                    </div>
                  )}

                  {/* Short rationale - always visible */}
                  {shortRationale && (
                    <p className="study-quiz-feedback-short">
                      {shortRationale}
                    </p>
                  )}

                  {/* Expandable full rationale — fetched on demand. */}
                  {hasMore && (
                    <>
                      <button
                        className={`study-quiz-learn-more-btn${isRationaleLoading ? ' is-loading' : ''}`}
                        onClick={() => handleLearnMore(currentQueuePosition)}
                        disabled={isRationaleLoading}
                        aria-expanded={isRationaleExpanded}
                      >
                        {isRationaleLoading ? (
                          <>
                            <span className="study-quiz-learn-more-spinner" aria-hidden="true" />
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

                      <div className={`study-quiz-rationale-collapse${isRationaleExpanded ? ' expanded' : ''}`}>
                        <div className="study-quiz-rationale-collapse-inner">
                          {isRationaleLoading ? (
                            <div className="study-quiz-rationale-skeleton" aria-hidden="true">
                              {[0, 1, 2, 3].map(i => (
                                <div key={i} className="study-quiz-rationale-skel-row">
                                  <div className="study-quiz-rationale-skel-marker" />
                                  <div className="study-quiz-rationale-skel-body">
                                    <div className="study-quiz-rationale-skel-line w-30" />
                                    <div className="study-quiz-rationale-skel-line w-90" />
                                    <div className="study-quiz-rationale-skel-line w-70" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : hasRationaleError ? (
                            <div className="study-quiz-rationale-error">
                              <p>{t('study.rationaleError', "Couldn't load the explanation. Try again?")}</p>
                              <button
                                type="button"
                                className="study-quiz-rationale-retry-btn"
                                onClick={() => retryRationale(currentQueuePosition)}
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

                  {/* Duolingo-style action button inside feedback */}
                  {(shouldShowContinueButton || needsReviewRound() || canFinishDiagnostic) && (
                    <button
                      className={`study-quiz-feedback-btn ${isCorrect ? 'correct' : 'incorrect'}`}
                      onClick={handleNextQuestion}
                    >
                      {isCorrect ? t('study.continue', 'CONTINUE') : t('study.gotIt', 'GOT IT')}
                    </button>
                  )}
                </div>
              );
            })()}
            </>
            )}
          </div>

          {/* Summary and Continue - show when all questions are correct */}
          {allCorrect && (
            <div className="study-card-footer study-card-footer-stacked">
              <div className="study-completion-message">
                {t('study.excellentWork', 'Excellent work! You got them all right.')}
              </div>
              <div className="study-quiz-summary">
                <span className="summary-item got-it">
                  <CheckIcon /> {t('study.correctCount', { count: totalQuestions, defaultValue: `${totalQuestions} correct` })}
                </span>
              </div>
              <button className="study-continue-btn" onClick={onContinue}>
                {t('study.continueBtn', 'Continue')}
                <ArrowRightIcon />
              </button>
            </div>
          )}
        </>
      )}
      {glossaryPopover}
    </div>
  );
};

export default StudyQuizCard;
