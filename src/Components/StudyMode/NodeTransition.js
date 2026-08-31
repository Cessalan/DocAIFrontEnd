import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getStepTopicLabel } from './planFormatting';
import { buildNodeReadout } from './nodeReadout';
import { buildHistoryFeedback } from './studyHistoryModel';
import { collectCovered, wasSkipped } from './lightReadout';
import { appendStudyHistory, getStudyPerformance } from '../../Services/StudySessionService';
import { selectActiveStruggles, selectResolvedConcepts } from '../../Services/conceptLedger';
import { get_node_debrief } from '../../Services/FastAPICalls';
import {
  isReminderSupported,
  getReminderState,
  enableReminder,
  disableReminder,
} from '../../Services/StudyReminderService';
import './StudyMode.css';

// Truncate long topic names per spec (40 chars + ellipsis)
const truncateTopic = (s, max = 40) => {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

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
  chatId,            // Study session id — keys the optional return reminder
  node,              // The node that was just completed
  content,           // Content that was shown (questions, cards, etc.)
  quizProgress,      // { questionStatuses: { 0: 'correct', 1: 'incorrect', ... } }
  flashcardProgress, // { cardStatuses: { 0: 'got_it', 1: 'need_review', ... } }
  mindmapProgress,   // { visitedNodeIds: [], totalNodes: N }
  audioSkipped,      // True when the user tapped Skip on the audio intro
  nextNode,          // The originally planned next node (for preview)
  performanceData,   // Current studyPerformance snapshot
  examDate,          // Exam date (Date | null) — gates the readiness delta line
  readinessDelta,    // Number | null — % closer to ready since this node started
  onContinue,        // () => advance to next planned node
  onPracticeMore,    // (remediationNode) => insert & go to remediation node
  onCustomRequest,   // (userText) => open custom request flow
  onExit,            // () => exit study mode entirely
  isAdvancing,       // Whether "continue" is in flight (advance + next node load)
  isLoadingPractice, // Whether "Practice More" is generating
  isLoadingCustom,   // Whether custom request is being interpreted
  customEcho,        // { message: "I'll create...", node: {...} } from backend
  onConfirmCustom,   // () => confirm the echoed custom node
  onCancelCustom,    // () => cancel the custom request
  onAnalytics,       // (event, payload) => fire analytics (no-op safe)
  onTestTheory,      // (skill) => insert a single question built around the pattern
  priorPerformance,  // studyPerformance snapshot taken BEFORE this node started
}) => {
  const { t, i18n } = useTranslation();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  // Farewell card shown after the user taps "Save progress & return tomorrow".
  // The exit is deferred until they close this card so the message has time
  // to land before we navigate away.
  const [showFarewell, setShowFarewell] = useState(false);

  // ── Return reminder (farewell card only) ──────────────────────────────
  // Local notification opt-in. Permission is requested from this button —
  // a user gesture, after a completed node — never on load, because a denied
  // prompt is sticky and would kill the channel for good.
  const reminderSupported = isReminderSupported();
  const [reminderState, setReminderState] = useState(
    () => (chatId ? getReminderState(chatId) : 'off')
  );

  const handleToggleReminder = async () => {
    if (!chatId) return;
    if (reminderState === 'on') {
      setReminderState(disableReminder(chatId));
      onAnalytics?.('return_reminder_disabled', {});
      return;
    }
    const next = await enableReminder(chatId, {
      label: nextNode ? getStepTopicLabel(nextNode.label) : null,
      type: nextNode?.type || null,
    });
    setReminderState(next);
    onAnalytics?.('return_reminder_enabled', { granted: next === 'on' });
  };

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

  // ── Identity bucket for scored results (drives header + copy) ───────
  // 100 = mastered · 70-99 = solid · 40-69 = gaps · <40 = tough
  // Banned: "Quiz Complete", "you crushed it", "great job", percentile copy.
  // Low scorers get no readiness delta and no judgmental list.
  const bucket = useMemo(() => {
    if (!result?.scored) return null;
    if (result.scorePercent >= 100) return 'mastered';
    if (result.scorePercent >= 70) return 'solid';
    if (result.scorePercent >= 40) return 'gaps';
    return 'tough';
  }, [result]);

  // Show readiness delta only if exam date is set, delta is positive,
  // and the user did well enough that the boost feels earned (not patronizing).
  const showReadinessDelta = !!examDate
    && typeof readinessDelta === 'number'
    && readinessDelta > 0
    && (bucket === 'mastered' || bucket === 'solid');

  /* Raw score for the header row. Everything the screen SAYS about that score
     — the headline, the caption under it, and what to do next — is built in
     nodeReadout from the same inputs, so a change of voice never drifts out of
     sync with a change of recommendation. */
  const score = useMemo(() => {
    if (!result?.scored) return null;
    return {
      total: result.total,
      got: result.type === 'flashcard' ? result.mastered : result.correct,
    };
  }, [result]);

  /* ── Generated debrief ────────────────────────────────────────────────
     What went right, what went wrong, what to work on — written against the
     actual questions she just answered, not a template.

     Fired here because this is the moment of maximum receptivity: she has
     just felt the misses and has not yet decided what to do next. The call
     is best-effort and never blocks — the transition renders immediately and
     the section slots in when it arrives, or stays absent if it doesn't.

     Quiz and exam only. The headline finding this produces is a FORMAT
     pattern ("the ones you missed were all select-all-that-apply"), which
     has no meaning for flashcards. */
  /* Accumulated per-format record for the whole plan. Written per answer by
     updateStudyPerformance, so it is only populated for sessions answered
     after that counter shipped — absent simply means no pattern line. */
  const planFormats = useMemo(() => {
    const f = performanceData?.formats;
    if (!f || typeof f !== 'object') return [];
    return Object.entries(f).map(([type, b]) => ({
      type,
      correct: b?.correct || 0,
      total: b?.total || 0,
    }));
  }, [performanceData]);

  /* When the node just completed is the one-question experiment, the payoff
     is confirming the theory rather than running a fresh diagnosis. Tagged at
     insertion so this survives a reload — nothing is held in memory. */
  const experimentSkill = useMemo(() => {
    const tags = node?.tags || [];
    const tag = tags.find((x) => typeof x === 'string' && x.startsWith('experiment:'));
    return tag ? tag.slice('experiment:'.length) : null;
  }, [node]);

  const experimentConfirmed = !!experimentSkill
    && !!result?.scored
    && result.total > 0
    && result.correct === result.total;

  const [debrief, setDebrief] = useState(null);
  const [debriefLoading, setDebriefLoading] = useState(false);

  const daysUntilExam = useMemo(() => {
    if (!examDate) return null;
    const ms = new Date(examDate).getTime();
    if (Number.isNaN(ms)) return null;
    const days = Math.ceil((ms - Date.now()) / 86400000);
    return days >= 0 ? days : null;
  }, [examDate]);

  useEffect(() => {
    if (!result?.scored) return undefined;
    if (result.type !== 'quiz' && result.type !== 'exam') return undefined;
    // The experiment node has its own payoff copy; re-diagnosing a single
    // question would also never clear the evidence bar anyway.
    if (experimentConfirmed) {
      setDebrief({ hasPattern: false, stillLooking: '' });
      return undefined;
    }

    const questions = content?.questions;
    if (!Array.isArray(questions) || !questions.length) return undefined;

    /* Quizzes and exams record correctness in different shapes — quizzes in
       a status map keyed by index, exams in `answers` with an isCorrect flag.
       Reading only the quiz shape silently skipped every exam, which are the
       nodes that actually mix formats and so produce the most useful debrief. */
    const statuses = quizProgress?.firstAttemptStatuses || quizProgress?.questionStatuses;
    const answers = quizProgress?.answers;
    if (!statuses && !answers) return undefined;

    const wasCorrect = (i) => (answers ? !!answers[i]?.isCorrect : statuses[i] === 'correct');
    // Only score what she actually reached; an abandoned exam would otherwise
    // report every unseen question as a miss.
    const wasAnswered = (i) => (answers ? answers[i] != null : statuses[i] != null);

    const items = questions
      .map((q, i) => ({
        question: String(q?.question || '').slice(0, 400),
        correct: wasCorrect(i),
        answered: wasAnswered(i),
        question_type: q?.questionType || q?.metadata?.questionType || 'mcq',
        // Generators disagree on the field name; the debrief reads whichever
        // is populated so it can explain the miss rather than just name it.
        rationale: String(q?.justification || q?.rationale || q?.correctBlurb || '').slice(0, 600),
      }))
      .filter((it) => it.question && it.answered)
      .map(({ answered, ...it }) => it);

    if (!items.length) return undefined;

    let alive = true;
    setDebriefLoading(true);
    (async () => {
      const res = await get_node_debrief(
        chatId,
        {
          topic: result.topic,
          node_type: result.type,
          score_percent: result.scorePercent,
          items,
          days_until_exam: daysUntilExam,
          // Plan-wide per-format record, already in hand via performanceData —
          // no extra read. Lets the debrief say "this keeps happening" rather
          // than judging one node in isolation.
          plan_formats: planFormats,
        },
        i18n?.language || 'en'
      );
      if (alive) {
        setDebrief(res);
        setDebriefLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [result, content, quizProgress, chatId, daysUntilExam, planFormats, experimentConfirmed, i18n]);

  /* ── Debrief for everything that isn't a quiz ──────────────────────────
     Flashcards, lessons, audio and concept maps are most of a plan, and
     until this they ended on a green tick and a restatement of the node
     label — sentences writable before she arrived. A student who is paying
     us for insight into her own studying was getting it on her quizzes and
     inventory on everything else, which is the half of the product she can
     most easily conclude is automated.

     A SEPARATE effect from the quiz one above rather than a branch inside
     it: the two need different payloads and different guards, and only one
     can ever fire for a given node, so there is no race between them.

     Two shapes:

       FLASHCARDS are scored but single-format, so the format-pattern
       machinery can never fire on them. The backend reads the cards
       directly instead. Cards map onto the item shape as front→question,
       got_it→correct, back→rationale, which is what lets the note say what
       the ones she blanked on had in common.

       LESSON / AUDIO / MINDMAP have no right or wrong at all. What makes a
       note on them worth reading is the connection between what the node
       covered and what her record says she keeps missing — so we send both,
       and the backend decides whether the link is real. `covered` is
       deliberately only what she actually reached (see lightReadout).

     Best-effort like the quiz debrief: the screen renders immediately and
     the note slots in, or never arrives and the plain acknowledgement
     stands. Nothing here blocks Continue. */
  /* One request per completed node, enforced by id rather than by effect
     deps. Several of the deps below (`content`, `nextNode`, the progress
     objects) are references the parent can hand us fresh on any render, and
     a re-fire here is not a wasted render — it is another model call, billed,
     that also replaces a note she may already be reading. */
  const notedNodeRef = useRef(null);

  useEffect(() => {
    if (!result) return undefined;
    const type = result.type;
    const isCards = result.scored && type === 'flashcard';
    const isUnscored = !result.scored
      && (type === 'lesson' || type === 'audio' || type === 'mindmap');
    if (!isCards && !isUnscored) return undefined;

    const key = `${node?.id || 'node'}:${type}`;
    if (notedNodeRef.current === key) return undefined;

    let items = [];
    if (isCards) {
      const cards = content?.cards;
      const statuses = flashcardProgress?.cardStatuses;
      if (!Array.isArray(cards) || !cards.length || !statuses) return undefined;
      /* Only cards she actually reached. An abandoned deck would otherwise
         report every card she never saw as one she couldn't recall, and the
         note would describe a blank she never drew. */
      items = cards
        .map((c, i) => ({
          question: String(c?.front || '').slice(0, 400),
          correct: statuses[i] === 'got_it',
          question_type: 'mcq',
          rationale: String(c?.back || '').slice(0, 600),
          _answered: statuses[i] != null,
        }))
        .filter((it) => it.question && it._answered)
        .map(({ _answered, ...it }) => it);
      if (!items.length) return undefined;
    }

    /* Claimed only once every guard above has passed. Set any earlier and a
       node whose content is still streaming in would burn its one attempt on
       the render where the cards had not arrived yet, and never ask again. */
    notedNodeRef.current = key;

    let alive = true;
    setDebriefLoading(true);
    (async () => {
      /* Her concept ledger is the whole basis of an unscored note, so it is
         read fresh here rather than taken from `performanceData` — that one
         is loaded once when the session opens and would be missing every
         concept resolved since. Failure is not fatal: no ledger simply
         means the backend writes the forward-looking note instead. */
      let struggles = [];
      let resolved = [];
      if (isUnscored && chatId) {
        try {
          const perf = await getStudyPerformance(chatId);
          const concepts = perf?.concepts || {};
          // `key` is the normalised label and is always present; falling back
          // to it keeps an entry whose display label was never captured.
          struggles = selectActiveStruggles(concepts).map((c) => c.label || c.key).filter(Boolean).slice(0, 8);
          resolved = selectResolvedConcepts(concepts).map((c) => c.label || c.key).filter(Boolean).slice(0, 8);
        } catch {
          // Ledger unavailable — carry on with empty lists.
        }
      }
      if (!alive) return;

      const res = await get_node_debrief(
        chatId,
        {
          topic: result.topic,
          node_type: type,
          score_percent: isCards ? result.scorePercent : 0,
          items,
          days_until_exam: daysUntilExam,
          plan_formats: [],
          covered: isUnscored ? collectCovered({ node, content, mindmapProgress }) : [],
          struggles,
          resolved,
          skipped: isUnscored && wasSkipped({ node, audioSkipped, mindmapProgress }),
          next_label: nextNode?.label || '',
          next_type: nextNode?.type || '',
        },
        i18n?.language || 'en'
      );
      if (alive) {
        setDebrief(res);
        setDebriefLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [result, node, content, flashcardProgress, mindmapProgress, audioSkipped,
    nextNode, chatId, daysUntilExam, i18n]);

  // ── Build diagnosis message ─────────────────────────────────────────
  const diagnosis = useMemo(() => {
    if (!result) return '';

    // A scored type can land here unscored when its progress snapshot is
    // missing (e.g. an exam whose answers never made it into quizProgress).
    // The score templates would then interpolate nothing and render
    // "of on the … exam." — say something true and plain instead.
    if (!result.scored && (result.type === 'quiz' || result.type === 'exam' || result.type === 'flashcard')) {
      return t('transition.sessionDone', {
        topic: result.topic,
        defaultValue: `You finished ${result.topic}.`
      });
    }

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

  /* ── The readout ──────────────────────────────────────────────────────
     Headline, score caption and the recommendation, all built together from
     one set of inputs. Built together on purpose: the recommendation's copy
     claims to follow from the insight above it, so the two cannot be allowed
     to come from different places and disagree. */
  const readout = useMemo(() => {
    if (!result?.scored) return null;
    return buildNodeReadout({
      result,
      bucket,
      debrief,
      experimentConfirmed,
      nextNode,
      priorPerformance,
      canTestTheory: !!onTestTheory,
      node,
      estimateMinutes: getEstimate,
      t,
    });
  }, [result, bucket, debrief, experimentConfirmed, nextNode, priorPerformance, onTestTheory, node, t]);

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

  // ── Example chips for custom input ──────────────────────────────────
  // "Practice more" lives here as a chip (instead of a top-level button)
  // for scored types — keeps the screen calm with one primary CTA while
  // preserving full user control under "tell the coach".
  const exampleChips = useMemo(() => {
    const chips = [];
    if (result?.type === 'quiz' || result?.type === 'flashcard' || result?.type === 'exam') {
      chips.push(t('transition.chipPracticeMore', 'Practice more'));
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

  /* ── History: what she has done, and what we told her about it ──────
     Recorded once per node, alongside the conclusion drawn. Storing the
     conclusion is what stops us delivering the same observation twice as
     though it were new — nothing erodes "it's paying attention" faster
     than being told the same thing about yourself three screens running.

     The feedback line is built from the SAME read, so the sentence she
     sees and the sentence we record can never disagree. */
  const [historyLine, setHistoryLine] = useState(null);

  useEffect(() => {
    if (!chatId || !result?.scored || !result?.topic) return;
    let alive = true;

    (async () => {
      try {
        const perf = await getStudyPerformance(chatId);
        if (!alive) return;

        const feedback = buildHistoryFeedback({
          history: perf?.history || [],
          concepts: perf?.concepts || {},
          topic: result.topic,
        });

        if (feedback) {
          setHistoryLine(t(feedback.key, feedback.fallback, feedback.params));
        }

        // Append AFTER reading, so this node's own result cannot be used as
        // evidence that she improved during this very node.
        await appendStudyHistory(chatId, {
          nodeId: node?.id,
          type: result.type,
          topic: result.topic,
          correct: score?.got ?? 0,
          total: score?.total ?? 0,
          missed: result.missedConcepts || [],
          conclusion: feedback?.conclusionKey || null,
        });
      } catch (err) {
        // A missing history line costs a nice sentence, never the screen.
        console.warn('History feedback unavailable:', err);
      }
    })();

    return () => { alive = false; };
    // Once per node, deliberately — same lifecycle as the analytics event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Analytics: fire shown event once per mount with score bucket ───
  useEffect(() => {
    if (!onAnalytics || !result) return;
    onAnalytics('end_of_session_screen_shown', {
      score_bucket: bucket,
      scored: !!result.scored,
      score_percent: result.scorePercent ?? null,
      has_exam_date: !!examDate,
      next_step_exists: !!nextNode,
      node_type: result.type,
    });
    // Intentionally fire only once when the screen first renders for a node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Practice more chip routes directly to the local remediation builder
    // so we keep the same fast path the old top-level button had.
    const practiceMoreLabel = t('transition.chipPracticeMore', 'Practice more');
    if (chip === practiceMoreLabel) {
      onAnalytics?.('practice_more_chip_clicked', { score_bucket: bucket });
      handlePracticeMore();
      return;
    }
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

          {/* ── What I wrote down ──
              The one thing on this screen that could not have been written
              before she arrived. Same treatment as the scored variant on
              purpose: a note in the tutor's own hand, and underneath it the
              concepts it is talking about — which are matched server-side
              from her ledger, never phrased by the model.

              It is allowed to say nothing. A lesson that has no bearing on
              anything she has missed gets a forward-looking note and no
              chips, because the alternative is claiming a connection that
              isn't there, and a student who catches that once stops
              believing the quiz insights too. */}
          {(debriefLoading || debrief?.note) && (
            <div className="nt2-insight nt2-insight--light">
              {debriefLoading ? (
                <div className="nt2-insight__skeleton" aria-live="polite" aria-busy="true">
                  <span className="nt2-insight__bar nt2-insight__bar--head" />
                  <span className="nt2-insight__bar" />
                  <span className="sr-only">
                    {t('transition.noteLoading', 'Looking at what this covered for you…')}
                  </span>
                </div>
              ) : (
                <>
                  {/* Same one-line shape as the scored screen's takeaway.
                      Two visual languages for "here is the personalised bit"
                      inside one component would teach her that the styling
                      means something, when all it would mean is which branch
                      rendered it. The label differs because this one is a
                      connection to her record, not a thing to revise. */}
                  <p className="nt4-takeaway">
                    <span className="nt4-takeaway__label">
                      {t('transition.noticedLead', 'What I noticed')}
                    </span>
                    <span className="nt4-takeaway__text">{debrief.note}</span>
                  </p>
                  {debrief.linked?.length > 0 && (
                    <ul className="nt2-insight__evidence">
                      {debrief.linked.map((label, i) => (
                        <li key={i} className="nt2-insight__stat">
                          {debrief.noteMode === 'reinforced'
                            ? t('transition.linkedFixed', {
                              concept: label,
                              defaultValue: 'you used to miss “{{concept}}”',
                            })
                            : t('transition.linkedStruggle', {
                              concept: label,
                              defaultValue: 'still costing you: “{{concept}}”',
                            })}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {/* Continue — advancing takes a couple of network round trips before
              the next node's content appears, so the button has to say so.
              Silence here reads as a broken button and gets tapped again. */}
          <button
            className="node-transition__btn node-transition__btn--choice"
            onClick={onContinue}
            disabled={isAdvancing}
          >
            {isAdvancing ? (
              <>
                <div className="node-transition__spinner" />
                <span className="node-transition__btn-label">
                  {t('transition.loadingNext', 'Loading your next step…')}
                </span>
              </>
            ) : (
              <>
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
              </>
            )}
          </button>

          {/* Subtle: customize link */}
          <button
            className="node-transition__customize-link"
            onClick={() => setShowCustomInput(!showCustomInput)}
          >
            {t('transition.askFor', 'Ask for something else')}
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

  // ═════════════════════════════════════════════════════════════════════
  // SCORED VARIANT — result → insight → recommendation → action.
  //
  // The order IS the argument: what happened, what it means, one thing to do
  // about it. Anything that competes with that order turns the screen back
  // into a dashboard — a second button of equal weight, a product feature
  // announcing itself, a label like "YOUR NEXT STEP IS" over a button that
  // says the same thing every time.
  // ═════════════════════════════════════════════════════════════════════

  const recommendation = readout?.recommendation;

  /* The one primary action. Where it goes is decided by what the insight just
     claimed, not by the score — that dependency is the whole point, so it is
     resolved from the recommendation and nowhere else. */
  const handleRecommendation = () => {
    if (!recommendation) return;
    onAnalytics?.('transition_recommendation_clicked', {
      kind: recommendation.kind,
      tone: readout?.tone,
      score_bucket: bucket,
      skill: debrief?.skill || null,
    });
    if (recommendation.testSkill && onTestTheory) {
      onTestTheory(recommendation.testSkill);
      return;
    }
    if (recommendation.node) {
      onPracticeMore(recommendation.node);
      return;
    }
    onContinue();
  };

  /* Secondary: lock in what she just covered. A flashcard pass over the SAME
     node, never anything new — it is the retention move, not a second
     recommendation, and must not read as a choice between two things the
     tutor wants. Hidden when the recommendation is already a re-teach, which
     would put the same offer on screen twice. */
  const showRecap = !!recommendation && recommendation.kind !== 'walkthrough';
  const handleRecap = () => {
    onAnalytics?.('transition_recap_clicked', { score_bucket: bucket });
    onPracticeMore({
      type: 'flashcard',
      label: t('transition.recapLabel', { topic: result.topic, defaultValue: 'Recap: {{topic}}' }),
      tags: ['adaptive', 'recap', `source:${node?.id || 'unknown'}`],
      difficulty: node?.difficulty || 1,
      adaptive: true,
      reason: t('transition.recapReason', 'Lock in what you just learned'),
    });
  };

  const handleDoneForToday = () => {
    onAnalytics?.('done_for_today_clicked', { score_bucket: bucket });
    setShowFarewell(true);
  };

  const handleFarewellClose = () => {
    onAnalytics?.('farewell_dismissed', { score_bucket: bucket });
    if (onExit) onExit();
  };

  const handleClose = () => {
    onAnalytics?.('close_x_clicked', { score_bucket: bucket });
    if (onExit) onExit();
  };

  // ── Farewell card — shown after "Save progress & return tomorrow" ───
  // A calm goodbye that lets the message land before we exit. The X and
  // the Close button both fully exit; there is no commitment flow.
  if (showFarewell) {
    return (
      <div className="node-transition node-transition--scored">
        <div className="node-transition__card node-transition__card--v2 nt2-farewell">
          <button
            className="node-transition__exit"
            onClick={handleFarewellClose}
            title={t('transition.exit', 'Exit session')}
            aria-label={t('transition.farewellClose', 'Close')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="nt2-farewell__check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h2 className="nt2-farewell__title">
            {t('transition.farewellTitle', 'Progress saved.')}
          </h2>

          <p className="nt2-farewell__body">
            {t('transition.farewellBody1', "Your brain is now deciding what stays and what fades.")}
          </p>

          {/* Name what's waiting. A designed exit that says exactly what comes
              next, and how long it takes, gives the student something concrete
              to return TO — "tomorrow" in the abstract is what gets skipped. */}
          {nextNode ? (
            <div className="nt2-farewell__next">
              <span className="nt2-farewell__next-label">
                {t('transition.farewellNextLabel', 'Next time')}
              </span>
              <span className="nt2-farewell__next-node">
                {truncateTopic(getStepTopicLabel(nextNode.label))}
              </span>
              <span className="nt2-farewell__next-meta">
                {t(`study.nodeType.${nextNode.type}`, nextNode.type)} · ~{getEstimate(nextNode.type)} min
              </span>
            </div>
          ) : (
            <p className="nt2-farewell__body">
              {t('transition.farewellBody2', "Tomorrow's 4-minute recall will reinforce the concepts that matter most.")}
            </p>
          )}

          {/* Optional nudge. Permission is requested here — after a completed
              node, at the moment they've chosen to come back — never on load. */}
          {reminderSupported && (
            <button
              type="button"
              className={`nt2-farewell__remind${reminderState === 'on' ? ' is-on' : ''}`}
              onClick={handleToggleReminder}
              disabled={reminderState === 'blocked'}
            >
              {reminderState === 'on' ? (
                <>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4"
                       strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
                    <polyline points="3 8.5 6.5 12 13 4.5" />
                  </svg>
                  {t('transition.remindOn', "I'll remind you tomorrow")}
                </>
              ) : reminderState === 'blocked' ? (
                t('transition.remindBlocked', 'Reminders are blocked in your browser settings')
              ) : (
                t('transition.remindMe', 'Remind me tomorrow')
              )}
            </button>
          )}

          <p className="nt2-farewell__footer">
            {t('transition.farewellFooter', 'Your streak continues tomorrow.')}
          </p>

          <button className="nt2-farewell__close" onClick={handleFarewellClose}>
            {t('transition.farewellClose', 'Close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="node-transition node-transition--scored">
      <div className="node-transition__card node-transition__card--v2">
        {onExit && (
          <button className="node-transition__exit" onClick={handleClose} title={t('transition.exit', 'Exit session')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* ── 1. What happened ──
             The topic sits above the headline as a quiet label rather than in
             a sentence of its own: she knows what she just did, she needs one
             line of orientation, not prose about it. */}
        <div className="nt2-identity">
          <div className={`nt2-identity__check nt2-identity__check--${bucket}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          {result.topic && (
            <p className="nt3-eyebrow" title={result.topic}>
              {truncateTopic(getStepTopicLabel(result.topic), 44)}
            </p>
          )}

          <h2 className="nt2-identity__header">{readout?.headline}</h2>

          {/* The score supports the caption, not the other way round: the
              number stays small and the sentence beside it says what it means. */}
          <p className="nt2-score-line">
            <span className="nt2-score-line__score">
              {score?.got} <span className="nt2-score-line__of">/</span> {score?.total}
            </span>
            <span className="nt2-score-line__sep">·</span>
            <span className="nt2-score-line__tail">{readout?.caption}</span>
            {showReadinessDelta && (
              <span className="nt2-score-line__delta">
                ↑ {readinessDelta}% {t('transition.closerToReady', 'closer to ready')}
              </span>
            )}
          </p>

          {/* The history line. Absent whenever there is nothing true to say —
              buildHistoryFeedback returns null rather than manufacturing
              encouragement, and the silence is what makes it land when it
              does appear. */}
          {historyLine && (
            <p className="nt2-history-line">{historyLine}</p>
          )}
        </div>

        {/* ── 2. What I noticed ──
             The most valuable thing on the screen, and the reason the
             recommendation below is worth taking. Four states, deliberately:

               experiment confirmed — she just proved the theory herself
               pattern found        — the discovery, carrying its evidence
               still learning       — honest about not knowing yet, and says
                                      what would change that
               (loading)            — a skeleton, because an insight that pops
                                      in late reads as a guess

             A manufactured pattern would be worse than none: it would teach
             her to discount everything else the product says. The backend
             decides which state applies; this only renders it. */}
        {/* Nothing to show is a real state now that the fallback copy is gone:
            a debrief with no pattern and no takeaway renders neither, so the
            divider and its container must go too or the screen keeps a gap
            where the insight would have been. */}
        {(debriefLoading
          || (debrief && (experimentConfirmed || debrief.hasPattern || debrief.note))) && (
          <>
            <div className="nt2-divider" />
            <div className="nt2-insight">
              {debriefLoading ? (
                <div className="nt2-insight__skeleton" aria-live="polite" aria-busy="true">
                  <span className="nt2-insight__bar nt2-insight__bar--head" />
                  <span className="nt2-insight__bar" />
                  <span className="nt2-insight__bar nt2-insight__bar--short" />
                  <span className="sr-only">
                    {t('transition.insightLoading', 'Looking at how you answered…')}
                  </span>
                </div>
              ) : experimentConfirmed ? (
                <div className="nt2-insight__confirm">
                  <p className="nt2-insight__eureka">
                    <span aria-hidden="true">🔓</span>{' '}
                    {t('transition.thatsIt', "That's it.")}
                  </p>
                  <p className="nt2-insight__body">
                    {t('transition.experimentWorked', {
                      skill: experimentSkill,
                      defaultValue:
                        'You slowed down and worked the {{skill}} through before committing. You didn’t learn a new fact just now — you changed how you approached the question.',
                    })}
                  </p>
                </div>
              ) : debrief.hasPattern ? (
                <>
                  <p className="nt2-insight__lead">
                    <span aria-hidden="true">🧠</span>{' '}
                    {t('transition.iNoticed', 'I noticed something')}
                  </p>
                  <p className="nt2-insight__noticed">{debrief.noticed}</p>

                  {/* Evidence is computed server-side from her actual answers,
                      never written by the model — the numbers are the reason
                      this reads as observation rather than flattery. */}
                  {debrief.evidence?.length > 0 && (
                    <ul className="nt2-insight__evidence">
                      {debrief.evidence.map((e, i) => (
                        <li key={i} className="nt2-insight__stat">{e}</li>
                      ))}
                    </ul>
                  )}

                  <p className="nt2-insight__body">{debrief.pattern}</p>
                </>
              ) : (
                /* No format pattern yet — so the insight is a TAKEAWAY, one
                   line, and it is the hero of the screen.

                   This replaced a headed block containing a handwritten note
                   card plus a "2 more of these and I'll have something
                   specific" promise. Three pieces of furniture around one
                   sentence, and the sentence was competing with them: the
                   personalised part is the only reason to read the screen, so
                   it gets the weight and everything else gets out of its way.

                   The line is a NOUN PHRASE naming the thing to focus on, not
                   a narration of what happened — the backend drops anything
                   that opens with "You missed…". Its label follows the mode,
                   because "focus on" is wrong for a clean run and wrong again
                   for a total blank. */
                debrief.note ? (
                  <p className="nt4-takeaway">
                    <span className="nt4-takeaway__label">
                      {debrief.noteMode === 'clean'
                        ? t('transition.takeawayClean', 'Locked in')
                        : debrief.noteMode === 'blank'
                          ? t('transition.takeawayBlank', 'Start here')
                          : t('transition.takeawayFocus', 'Focus on')}
                    </span>
                    <span className="nt4-takeaway__text">{debrief.note}</span>
                  </p>
                ) : (
                  /* The takeaway is unavailable — offline, slow, or dropped by
                     its own guards. Say nothing rather than manufacture an
                     insight; the score line above already said something true,
                     and the screen still works with the action alone. */
                  null
                )
              )}
            </div>
          </>
        )}

        {/* ── 3. The next action ──
             ONE dominant control, and nothing above it.

             This used to carry a "Here's what I'd do next" heading, the node
             title, and a line explaining why that node and not another —
             three pieces of copy introducing a button whose own label and
             subtitle already say what it does and how long it takes. Stacked
             under a headed insight block it made the screen read as a form to
             work through rather than a decision to make, and it pushed the
             one personalised line on the screen into the middle of a list.

             The reasoning behind the choice has not gone anywhere: it still
             comes from buildNodeReadout, still changes with what was found,
             and now arrives as the button she presses instead of as a
             paragraph she reads first. */}
        <div className="nt3-rec">
          <button
            className="node-transition__btn node-transition__btn--choice nt2-primary"
            onClick={handleRecommendation}
            disabled={isLoadingPractice || isAdvancing}
          >
            {isAdvancing ? (
              <>
                <div className="node-transition__spinner" />
                <span className="node-transition__btn-label">
                  {t('transition.loadingNext', 'Loading your next step…')}
                </span>
              </>
            ) : isLoadingPractice ? (
              <>
                <div className="node-transition__spinner" />
                <span className="node-transition__btn-label">
                  {t('transition.building', 'Building your practice...')}
                </span>
              </>
            ) : (
              <>
                <span className="node-transition__btn-label">{recommendation?.cta}</span>
                <span className="node-transition__btn-preview">{recommendation?.meta}</span>
              </>
            )}
          </button>
        </div>

        {/* ── The alternative, offered as a sentence rather than a rival ──
             This was a bordered card sitting directly under the primary
             button, at nearly the same visual weight — two boxes competing to
             be pressed, which is not a quiet secondary option, it is a second
             decision. As one line it reads as an aside the primary action
             already assumes she will skip. */}
        {showRecap && (
          <p className="nt4-alt">
            {t('transition.lockInFirst', 'Want to lock in that weak spot first?')}{' '}
            <button
              type="button"
              className="nt4-alt__link"
              onClick={handleRecap}
              disabled={isLoadingPractice || isAdvancing}
            >
              {t('transition.reviewMins', 'Review · 4 min')}
            </button>
          </p>
        )}

        {/* ── Full control, one line, no invitation to go browsing ── */}
        <button
          className="node-transition__coach-row nt2-coach"
          onClick={() => setShowCustomInput(!showCustomInput)}
        >
          <svg className="node-transition__coach-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="node-transition__coach-label">
            {t('transition.askFor', 'Ask for something else')}
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
                  disabled={isLoadingPractice}
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

        {/* ── Frictionless exit — small gray text link ── */}
        <button className="nt2-done" onClick={handleDoneForToday}>
          {t('transition.doneForToday', 'Save progress & return tomorrow')}
        </button>
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
