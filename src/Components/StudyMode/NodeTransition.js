import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './StudyMode.css';

/**
 * NodeTransition — The post-node decision moment.
 *
 * Two variants:
 *   SCORED (quiz, flashcard): Full diagnosis + score bar + 3 options
 *   LIGHT  (lesson, audio, mindmap): Acknowledgment + Continue + subtle customize link
 *
 * Design principles:
 *   - The system recommends. The student decides.
 *   - Every recommendation carries its evidence in plain language.
 *   - Skipping is never punished.
 *   - Low cognitive effort: don't make her think when there's nothing to think about.
 */
const NodeTransition = ({
  node,              // The node that was just completed
  content,           // Content that was shown (questions, cards, etc.)
  quizProgress,      // { questionStatuses: { 0: 'correct', 1: 'incorrect', ... } }
  flashcardProgress, // { cardStatuses: { 0: 'got_it', 1: 'need_review', ... } }
  mindmapProgress,   // { visitedNodeIds: [], totalNodes: N }
  audioSkipped,      // True when the user tapped Skip on the audio intro
  nextNode,          // The originally planned next node (for preview)
  performanceData,   // Current studyPerformance snapshot
  onContinue,        // () => advance to next planned node
  onPracticeMore,    // (remediationNode) => insert & go to remediation node
  onCustomRequest,   // (userText) => open custom request flow
  onExit,            // () => exit study mode entirely
  isLoadingPractice, // Whether "Practice More" is generating
  isLoadingCustom,   // Whether custom request is being interpreted
  customEcho,        // { message: "I'll create...", node: {...} } from backend
  onConfirmCustom,   // () => confirm the echoed custom node
  onCancelCustom,    // () => cancel the custom request
}) => {
  const { t } = useTranslation();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');

  // ── Compute result data from the completed node ─────────────────────
  const result = useMemo(() => {
    if (!node) return null;

    const type = node.type;

    // Quiz results — use firstAttemptStatuses for accurate scoring
    // (questionStatuses may have been overwritten during review round)
    if (type === 'quiz' && quizProgress?.questionStatuses && content?.questions) {
      const statuses = quizProgress.firstAttemptStatuses || quizProgress.questionStatuses;
      const total = content.questions.length;
      const correct = Object.values(statuses).filter(s => s === 'correct').length;
      const incorrect = total - correct;
      const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

      // Collect missed question texts (truncated) for the diagnosis
      const missedQuestions = [];
      Object.entries(statuses).forEach(([idx, status]) => {
        if (status !== 'correct' && content.questions[parseInt(idx)]) {
          const q = content.questions[parseInt(idx)].question || '';
          missedQuestions.push(q.length > 80 ? q.substring(0, 80) + '...' : q);
        }
      });

      return {
        scored: true,
        type: 'quiz',
        total,
        correct,
        incorrect,
        scorePercent,
        missedQuestions,
        topic: node.label
      };
    }

    // Exam results — answers stored as { [index]: { isCorrect, score, maxScore, questionType } }
    if (type === 'exam' && quizProgress?.answers && content?.questions) {
      const examAnswers = quizProgress.answers;
      const total = content.questions.length;
      let correctCount = 0;
      let totalScore = 0;
      let maxScore = 0;

      const missedQuestions = [];
      Object.entries(examAnswers).forEach(([idx, answer]) => {
        const q = content.questions[parseInt(idx)];
        if (!q) return;
        totalScore += (answer.score || 0);
        maxScore += (answer.maxScore || 1);
        if (answer.isCorrect) {
          correctCount++;
        } else {
          const qText = q.question || '';
          missedQuestions.push(qText.length > 80 ? qText.substring(0, 80) + '...' : qText);
        }
      });

      const scorePercent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      return {
        scored: true,
        type: 'exam',
        total,
        correct: correctCount,
        incorrect: total - correctCount,
        scorePercent,
        missedQuestions,
        topic: node.label
      };
    }

    // Flashcard results
    if (type === 'flashcard' && flashcardProgress?.cardStatuses && content?.cards) {
      const statuses = flashcardProgress.cardStatuses;
      const total = content.cards.length;
      const mastered = Object.values(statuses).filter(s => s === 'got_it').length;
      const needReview = total - mastered;
      const scorePercent = total > 0 ? Math.round((mastered / total) * 100) : 0;

      // Collect cards that needed review
      const reviewCards = [];
      Object.entries(statuses).forEach(([idx, status]) => {
        if (status !== 'got_it' && content.cards[parseInt(idx)]) {
          const front = content.cards[parseInt(idx)].front || '';
          reviewCards.push(front.length > 60 ? front.substring(0, 60) + '...' : front);
        }
      });

      return {
        scored: true,
        type: 'flashcard',
        total,
        mastered,
        needReview,
        scorePercent,
        reviewCards,
        topic: node.label
      };
    }

    // Mindmap results (partial score)
    if (type === 'mindmap' && mindmapProgress) {
      const visited = mindmapProgress.visitedNodeIds?.length || 0;
      const total = mindmapProgress.totalNodes || 0;
      return {
        scored: false,
        type: 'mindmap',
        visited,
        total,
        topic: node.label
      };
    }

    // Lesson, audio — no score
    return {
      scored: false,
      type,
      topic: node.label
    };
  }, [node, content, quizProgress, flashcardProgress, mindmapProgress]);

  // ── Build diagnosis message ─────────────────────────────────────────
  const diagnosis = useMemo(() => {
    if (!result) return '';

    if (result.type === 'quiz') {
      if (result.scorePercent >= 90) {
        return t('transition.quizExcellent', {
          correct: result.correct,
          total: result.total,
          topic: result.topic,
          defaultValue: `${result.correct} of ${result.total} on ${result.topic}. You crushed it.`
        });
      }
      if (result.scorePercent >= 70) {
        return t('transition.quizGood', {
          correct: result.correct,
          total: result.total,
          topic: result.topic,
          missed: result.incorrect,
          defaultValue: `${result.correct} of ${result.total} on ${result.topic}. ${result.incorrect} ${result.incorrect === 1 ? 'miss' : 'misses'} — close to solid.`
        });
      }
      if (result.scorePercent >= 50) {
        return t('transition.quizMixed', {
          correct: result.correct,
          total: result.total,
          topic: result.topic,
          defaultValue: `${result.correct} of ${result.total} on ${result.topic}. Some gaps worth tightening.`
        });
      }
      return t('transition.quizTough', {
        correct: result.correct,
        total: result.total,
        topic: result.topic,
        defaultValue: `${result.correct} of ${result.total} on ${result.topic}. This one was tough — that's ok, it means we found what to work on.`
      });
    }

    if (result.type === 'exam') {
      if (result.scorePercent >= 90) {
        return t('transition.examExcellent', {
          correct: result.correct,
          total: result.total,
          topic: result.topic,
          defaultValue: `${result.correct} of ${result.total} on the ${result.topic} exam. Excellent — you're exam-ready.`
        });
      }
      if (result.scorePercent >= 70) {
        return t('transition.examGood', {
          correct: result.correct,
          total: result.total,
          topic: result.topic,
          missed: result.incorrect,
          defaultValue: `${result.correct} of ${result.total} on the ${result.topic} exam. ${result.incorrect} to review before you're solid.`
        });
      }
      if (result.scorePercent >= 50) {
        return t('transition.examMixed', {
          correct: result.correct,
          total: result.total,
          topic: result.topic,
          defaultValue: `${result.correct} of ${result.total} on the ${result.topic} exam. Some concepts need more work.`
        });
      }
      return t('transition.examTough', {
        correct: result.correct,
        total: result.total,
        topic: result.topic,
        defaultValue: `${result.correct} of ${result.total} on the ${result.topic} exam. This section needs review — let's strengthen it.`
      });
    }

    if (result.type === 'flashcard') {
      if (result.scorePercent >= 90) {
        return t('transition.flashcardExcellent', {
          mastered: result.mastered,
          total: result.total,
          topic: result.topic,
          defaultValue: `${result.mastered} of ${result.total} mastered on ${result.topic}. Sharp.`
        });
      }
      if (result.scorePercent >= 70) {
        return t('transition.flashcardGood', {
          mastered: result.mastered,
          total: result.total,
          topic: result.topic,
          review: result.needReview,
          defaultValue: `${result.mastered} of ${result.total} mastered on ${result.topic}. ${result.needReview} needed another look.`
        });
      }
      return t('transition.flashcardTough', {
        mastered: result.mastered,
        total: result.total,
        topic: result.topic,
        defaultValue: `${result.mastered} of ${result.total} mastered on ${result.topic}. These concepts could use more time.`
      });
    }

    if (result.type === 'lesson') {
      return t('transition.lessonDone', {
        topic: result.topic,
        defaultValue: `You covered ${result.topic}.`
      });
    }

    if (result.type === 'audio') {
      // The user can complete an audio node two ways: actually listen to it
      // or skip the intro entirely. Different copy for each — claiming the
      // user "listened" when they tapped Skip would feel dishonest and
      // misleading, especially in study insights.
      if (audioSkipped) {
        return t('transition.audioSkipped', {
          topic: result.topic,
          defaultValue: `You skipped the audio for ${result.topic}.`
        });
      }
      return t('transition.audioDone', {
        topic: result.topic,
        defaultValue: `You listened to ${result.topic}.`
      });
    }

    if (result.type === 'mindmap') {
      if (result.total > 0) {
        return t('transition.mindmapDone', {
          visited: result.visited,
          total: result.total,
          topic: result.topic,
          defaultValue: `You explored ${result.visited} of ${result.total} concepts in ${result.topic}.`
        });
      }
      return t('transition.mindmapDoneSimple', {
        topic: result.topic,
        defaultValue: `You explored the concept map for ${result.topic}.`
      });
    }

    return '';
  }, [result, audioSkipped, t]);

  // ── Build suggestion message ────────────────────────────────────────
  const suggestion = useMemo(() => {
    if (!result || !nextNode) return '';

    const nextLabel = nextNode.label || '';
    const nextType = t(`study.nodeType.${nextNode.type}`, nextNode.type);

    if (!result.scored) {
      return t('transition.suggestNext', {
        type: nextType.toLowerCase(),
        label: nextLabel,
        defaultValue: `Up next: ${nextType} on ${nextLabel}.`
      });
    }

    if (result.scorePercent >= 85) {
      return t('transition.suggestContinue', {
        type: nextType.toLowerCase(),
        label: nextLabel,
        defaultValue: `You're solid here. Next up is ${nextType.toLowerCase()} on ${nextLabel}.`
      });
    }

    if (result.scorePercent >= 50) {
      return t('transition.suggestEither', {
        defaultValue: `You could drill the gaps before moving on, or press ahead. Your call.`
      });
    }

    return t('transition.suggestRemediate', {
      defaultValue: `A focused practice session could help lock these in.`
    });
  }, [result, nextNode, t]);

  // ── Determine remediation node type based on severity ───────────────
  const remediationType = useMemo(() => {
    if (!result?.scored) return null;
    if (result.scorePercent < 50) return 'lesson';     // Re-teach
    if (result.scorePercent <= 70) return 'flashcard';  // Reinforce
    return 'quiz';                                       // Focused drill
  }, [result]);

  const remediationLabel = useMemo(() => {
    if (!remediationType) return '';
    const labels = {
      lesson: t('transition.remediationLesson', { topic: result?.topic, defaultValue: `Review: ${result?.topic}` }),
      flashcard: t('transition.remediationFlashcard', { topic: result?.topic, defaultValue: `Practice: ${result?.topic}` }),
      quiz: t('transition.remediationQuiz', { topic: result?.topic, defaultValue: `Focused drill: ${result?.topic}` }),
    };
    return labels[remediationType] || '';
  }, [remediationType, result, t]);

  // ── Determine "Practice More" visual weight ────────────────────────
  // High scores (>85%) → visually lighter. Lower scores → equal weight.
  const practiceWeight = result?.scored
    ? (result.scorePercent > 85 ? 'subtle' : 'equal')
    : 'subtle';

  // ── Example chips for custom input ──────────────────────────────────
  const exampleChips = useMemo(() => {
    const chips = [];
    if (result?.type === 'quiz' || result?.type === 'flashcard' || result?.type === 'exam') {
      chips.push(t('transition.chipHarder', 'Make it harder'));
      chips.push(t('transition.chipFlashcards', 'Just flashcards'));
      chips.push(t('transition.chipExplain', 'Explain what I missed'));
    }
    if (result?.type === 'lesson' || result?.type === 'audio') {
      chips.push(t('transition.chipQuizMe', 'Quiz me on this'));
      chips.push(t('transition.chipFlashcards', 'Just flashcards'));
      chips.push(t('transition.chipGoDeeper', 'Go deeper'));
    }
    if (result?.type === 'mindmap') {
      chips.push(t('transition.chipQuizMe', 'Quiz me on this'));
      chips.push(t('transition.chipFlashcards', 'Just flashcards'));
    }
    chips.push(t('transition.chipSkipAhead', 'Skip ahead'));
    return chips;
  }, [result, t]);

  // ── Handle "Practice More" ──────────────────────────────────────────
  const handlePracticeMore = () => {
    if (!remediationType || !result) return;

    // Build the remediation node definition
    const gapCount = result.incorrect || result.needReview || 0;
    const remediationNode = {
      type: remediationType,
      label: remediationLabel,
      tags: [
        'remediation',
        `source:${node.id}`,
        ...(node.tags || [])
      ],
      difficulty: node.difficulty || 1,
      adaptive: true,
      reason: gapCount > 0
        ? t('transition.drillGaps', { count: gapCount, defaultValue: `Review ${gapCount} missed concept${gapCount === 1 ? '' : 's'}` })
        : t('transition.practiceMore', 'Practice more'),
    };

    // Include missed content in tags for context
    if (result.type === 'quiz' && result.missedQuestions?.length > 0) {
      remediationNode.tags.push('focus:missed_concepts');
    }
    if (result.type === 'flashcard' && result.reviewCards?.length > 0) {
      remediationNode.tags.push('focus:review_cards');
    }

    onPracticeMore(remediationNode);
  };

  // ── Handle custom request submit ────────────────────────────────────
  const handleCustomSubmit = () => {
    const text = customText.trim();
    if (!text) return;

    // Pass missed concepts as context so the backend knows what she struggled with
    const context = {
      scorePercent: result?.scorePercent,
      missedItems: result?.missedQuestions || result?.reviewCards || [],
    };
    onCustomRequest(text, context);
  };

  const handleChipClick = (chip) => {
    setCustomText(chip);
    setShowCustomInput(true);
  };

  if (!result) return null;

  // ════════════════════════════════════════════════════════════════════
  // CUSTOM ECHO CONFIRMATION (shown after backend interprets request)
  // ════════════════════════════════════════════════════════════════════
  if (customEcho) {
    return (
      <div className="node-transition">
        <div className="node-transition__card node-transition__echo">
          {onExit && (
            <button className="node-transition__exit" onClick={onExit} title={t('transition.exit', 'Exit session')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <div className="node-transition__echo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <p className="node-transition__echo-message">{customEcho.message}</p>
          <div className="node-transition__echo-actions">
            <button
              className="node-transition__btn node-transition__btn--secondary"
              onClick={onCancelCustom}
            >
              {t('transition.goBack', 'Go back')}
            </button>
            {customEcho.node && (
              <button
                className="node-transition__btn node-transition__btn--choice"
                onClick={onConfirmCustom}
              >
                <span className="node-transition__btn-label">
                  {t('transition.soundsGood', "Sounds good")}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // LIGHT VARIANT (lesson, audio, mindmap — no meaningful score)
  // ════════════════════════════════════════════════════════════════════
  if (!result.scored) {
    return (
      <div className="node-transition node-transition--light">
        <div className="node-transition__card">
          {onExit && (
            <button className="node-transition__exit" onClick={onExit} title={t('transition.exit', 'Exit session')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {/* Completion indicator — green check for normal completions, a
              coral skip-forward arrow when the user opted out (e.g. tapped
              Skip on the audio intro) so the icon matches the diagnosis
              copy below it. */}
          {(() => {
            const wasSkipped = result.type === 'audio' && audioSkipped;
            return (
              <div className="node-transition__check-row">
                <div className={`node-transition__check${wasSkipped ? ' node-transition__check--skipped' : ''}`}>
                  {wasSkipped ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="6 19 14 12 6 5 6 19" fill="currentColor" />
                      <line x1="18" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div className="node-transition__check-text">
                  <p className="node-transition__diagnosis">{diagnosis}</p>
                  {suggestion && (
                    <p className="node-transition__suggestion">{suggestion}</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Continue */}
          <button
            className="node-transition__btn node-transition__btn--choice"
            onClick={onContinue}
          >
            <span className="node-transition__btn-label">
              {nextNode
                ? t('transition.moveOn', { topic: nextNode.label, defaultValue: `Move on to ${nextNode.label}` })
                : t('transition.continue', 'Continue')}
            </span>
            {nextNode && (
              <span className="node-transition__btn-preview">
                {t(`study.nodeType.${nextNode.type}`, nextNode.type)} · ~{getEstimate(nextNode.type)} min
              </span>
            )}
          </button>

          {/* Subtle: customize link */}
          <button
            className="node-transition__customize-link"
            onClick={() => setShowCustomInput(!showCustomInput)}
          >
            {t('transition.orCustomize', 'Or tell the coach what you want')}
          </button>

          {/* Custom input (expandable) */}
          {showCustomInput && (
            <div className="node-transition__custom">
              <div className="node-transition__chips">
                {exampleChips.map((chip, i) => (
                  <button
                    key={i}
                    className="node-transition__chip"
                    onClick={() => handleChipClick(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="node-transition__input-row">
                <input
                  type="text"
                  className="node-transition__input"
                  placeholder={t('transition.placeholder', 'e.g. "Quiz me on this" or "Make it harder"')}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                  autoFocus
                />
                <button
                  className="node-transition__send"
                  onClick={handleCustomSubmit}
                  disabled={!customText.trim() || isLoadingCustom}
                >
                  {isLoadingCustom ? (
                    <div className="node-transition__spinner" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // SCORED VARIANT (quiz, flashcard — full diagnosis + 3 options)
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="node-transition node-transition--scored">
      <div className="node-transition__card">
        {onExit && (
          <button className="node-transition__exit" onClick={onExit} title={t('transition.exit', 'Exit session')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {/* ── Compact header ── */}
        <div className="node-transition__header">
          <div className="node-transition__score-ring" data-score={
            result.scorePercent >= 90 ? 'high' :
            result.scorePercent >= 70 ? 'neutral' : 'low'
          }>
            <span className="node-transition__score-num">{result.scorePercent}</span>
            <span className="node-transition__score-pct">%</span>
          </div>
          <div className="node-transition__header-text">
            <h2 className="node-transition__title">
              {result.type === 'exam'
                ? t('transition.examDone', 'Exam Complete')
                : result.type === 'quiz'
                ? t('transition.quizDone', 'Quiz Complete')
                : t('transition.flashcardDone', 'Flashcards Complete')}
            </h2>
            <p className="node-transition__topic">{result.topic}</p>
          </div>
        </div>

        {/* ── Score bar ── */}
        <div className="node-transition__bar-section">
          <div className="node-transition__bar-row">
            <span className="node-transition__bar-label">
              {result.type === 'quiz' || result.type === 'exam'
                ? t('transition.correct', 'Correct')
                : t('transition.mastered', 'Mastered')}
            </span>
            <span className="node-transition__bar-value">
              {result.type === 'quiz' || result.type === 'exam' ? result.correct : result.mastered}/{result.total}
            </span>
          </div>
          <div className="node-transition__bar-track">
            <div
              className="node-transition__bar-fill"
              data-score={
                result.scorePercent >= 90 ? 'high' :
                result.scorePercent >= 70 ? 'neutral' : 'low'
              }
              style={{ width: `${Math.max(result.scorePercent, 3)}%` }}
            />
          </div>
        </div>

        {/* ── Diagnosis — hero of the screen ── */}
        <p className="node-transition__diagnosis node-transition__diagnosis--hero">{diagnosis}</p>

        {/* ── Missed concepts (collapsed, max 3) ── */}
        {(result.type === 'quiz' || result.type === 'exam') && result.missedQuestions?.length > 0 && (
          <div className="node-transition__missed">
            <p className="node-transition__missed-label">
              {t('transition.toReview', 'To review:')}
            </p>
            <ul className="node-transition__missed-list">
              {result.missedQuestions.slice(0, 3).map((q, i) => (
                <li key={i} className="node-transition__missed-item">{q}</li>
              ))}
            </ul>
          </div>
        )}
        {result.type === 'flashcard' && result.reviewCards?.length > 0 && (
          <div className="node-transition__missed">
            <p className="node-transition__missed-label">
              {t('transition.cardsToReview', 'Cards that needed another look:')}
            </p>
            <ul className="node-transition__missed-list">
              {result.reviewCards.slice(0, 3).map((c, i) => (
                <li key={i} className="node-transition__missed-item">{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Suggestion ── */}
        {suggestion && (
          <p className="node-transition__suggestion">{suggestion}</p>
        )}

        {/* ── The Three Options — equal weight, no pre-deciding ── */}
        <div className="node-transition__actions">
          {/* Option 1: Drill the gaps (remediation — responsive to what just happened) */}
          <button
            className="node-transition__btn node-transition__btn--choice"
            onClick={handlePracticeMore}
            disabled={isLoadingPractice}
          >
            {isLoadingPractice ? (
              <>
                <div className="node-transition__spinner" />
                <span className="node-transition__btn-label">
                  {t('transition.building', 'Building your practice...')}
                </span>
              </>
            ) : (
              <>
                <span className="node-transition__btn-label">
                  {result.incorrect > 0 || result.needReview > 0
                    ? t('transition.drillGaps', {
                        count: result.incorrect || result.needReview,
                        defaultValue: `Review ${result.incorrect || result.needReview} missed concept${(result.incorrect || result.needReview) === 1 ? '' : 's'}`
                      })
                    : t('transition.practiceMore', 'Practice more')}
                </span>
                <span className="node-transition__btn-preview">
                  {t(`study.nodeType.${remediationType}`, remediationType)} · ~{getEstimate(remediationType)} min
                </span>
              </>
            )}
          </button>

          {/* Option 2: Move on to next planned node */}
          <button
            className="node-transition__btn node-transition__btn--choice"
            onClick={onContinue}
          >
            <span className="node-transition__btn-label">
              {nextNode
                ? t('transition.moveOn', {
                    topic: nextNode.label,
                    defaultValue: `Move on to ${nextNode.label}`
                  })
                : t('transition.continue', 'Continue')}
            </span>
            {nextNode && (
              <span className="node-transition__btn-preview">
                {t(`study.nodeType.${nextNode.type}`, nextNode.type)} · ~{getEstimate(nextNode.type)} min
              </span>
            )}
          </button>
        </div>

        {/* Option 3: Tell the coach — real tappable row, not gray text */}
        <button
          className="node-transition__coach-row"
          onClick={() => setShowCustomInput(!showCustomInput)}
        >
          <svg className="node-transition__coach-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="node-transition__coach-label">
            {t('transition.orCustomize', 'Or tell the coach what you want')}
          </span>
          <svg className="node-transition__coach-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {showCustomInput && (
          <div className="node-transition__custom">
            <div className="node-transition__chips">
              {exampleChips.map((chip, i) => (
                <button
                  key={i}
                  className="node-transition__chip"
                  onClick={() => handleChipClick(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="node-transition__input-row">
              <input
                type="text"
                className="node-transition__input"
                placeholder={t('transition.placeholder', 'e.g. "Focus on side effects" or "Make it harder"')}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                autoFocus
              />
              <button
                className="node-transition__send"
                onClick={handleCustomSubmit}
                disabled={!customText.trim() || isLoadingCustom}
              >
                {isLoadingCustom ? (
                  <div className="node-transition__spinner" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Estimated minutes per node type
function getEstimate(type) {
  const map = { lesson: 5, quiz: 4, flashcard: 3, audio: 6, mindmap: 5, exam: 15, review: 2 };
  return map[type] || 4;
}

export default NodeTransition;
