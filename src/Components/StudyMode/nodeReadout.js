/**
 * nodeReadout — what the tutor SAYS about a node the student just finished.
 *
 * The transition screen used to be a status report: a header keyed off the
 * score bucket, the score, a recap line, and the same "Keep going →" no matter
 * what happened. Everything in it was true, and none of it required having
 * watched her answer.
 *
 * This module turns the same data into the four things a tutor would actually
 * say, in order:
 *
 *   1. what happened        → headline
 *   2. what I noticed       → the insight (from the backend debrief)
 *   3. what that's based on → evidence (computed, never phrased by a model)
 *   4. what I'd do next     → a recommendation that CHANGES with 2 and 3
 *
 * The load-bearing rule is that 4 has to follow from 2. A recommendation that
 * says "targeted at the pattern I just noticed" and then serves the same
 * generic next node is worse than saying nothing: it teaches her the
 * observation was decoration. So every recommendation here carries the node
 * definition that delivers on its own copy — a prioritization claim builds a
 * prioritization drill, a select-all claim builds a select-all drill — and
 * where there is no evidence for a claim, the fallback makes no claim.
 *
 * Pure functions on purpose: the screen renders this, it doesn't compute it.
 */

import { findMatchingTopicKey } from '../../Services/StudySessionService';

/** Questions in an adaptive drill. Short enough to read as a fix, not a retest. */
export const DRILL_QUESTIONS = 3;

/**
 * Skill keys exactly as the debrief reports them (BUCKET_NAME in main.py's
 * node_debrief). Constants because they choose the drill FORMAT — a typo here
 * silently downgrades a targeted drill to plain multiple choice, which is the
 * one failure mode this whole module exists to prevent.
 */
export const SKILL_PRIORITY = 'prioritization';
export const SKILL_MULTI = 'select-all-that-apply';

/* ── Improvement detection ─────────────────────────────────────────────
   "You're getting better at X" is the most motivating thing this screen can
   say and the easiest to fake. It is claimed only from two real measurements:
   the performance snapshot taken BEFORE this node started, and what she just
   scored. The thresholds are deliberately mean — a jump off three prior
   questions is noise, and being caught inventing progress costs more than
   never mentioning it. */
const IMPROVEMENT_MIN_PRIOR = 5;    // prior answers needed before there's a baseline
const IMPROVEMENT_MIN_NOW = 4;      // items in the node just finished
const IMPROVEMENT_MIN_JUMP = 0.2;   // 20 points clear of that baseline
const IMPROVEMENT_MIN_NOW_ACC = 0.7;

/**
 * Did she measurably get better at this topic?
 *
 * @param {Object} result - the scored node result
 * @param {Object|null} prior - studyPerformance doc snapshotted before the node
 * @returns {{ priorPct: number, nowPct: number, priorTotal: number }|null}
 */
export const detectImprovement = (result, prior) => {
  if (!result || !result.scored || !prior || !prior.topics) return null;

  const keys = Object.keys(prior.topics);
  if (!keys.length) return null;

  const before = prior.topics[findMatchingTopicKey(result.topic, keys)];
  if (!before) return null;

  const isFlashcard = result.type === 'flashcard';
  const priorTotal = (isFlashcard ? before.flashcardsTotal : before.questionsTotal) || 0;
  const priorCorrect = (isFlashcard ? before.flashcardsMastered : before.questionsCorrect) || 0;
  const nowTotal = result.total || 0;
  const nowCorrect = (isFlashcard ? result.mastered : result.correct) || 0;

  if (priorTotal < IMPROVEMENT_MIN_PRIOR || nowTotal < IMPROVEMENT_MIN_NOW) return null;

  const priorAcc = priorCorrect / priorTotal;
  const nowAcc = nowCorrect / nowTotal;
  if (nowAcc < IMPROVEMENT_MIN_NOW_ACC) return null;
  if (nowAcc - priorAcc < IMPROVEMENT_MIN_JUMP) return null;

  return {
    priorPct: Math.round(priorAcc * 100),
    nowPct: Math.round(nowAcc * 100),
    priorTotal,
  };
};

/* ── Drill shape per skill ─────────────────────────────────────────────
   A drill is delivered as an `exam` node carrying its own config, and that is
   what lets it be honest about format: the study quiz card renders multiple
   choice only, so "3 select-all questions" served through it would quietly
   become 3 multiple-choice questions. The exam card renders all three formats,
   and a node carrying `examConfig` launches straight into them instead of
   stopping at the mini-test config modal — nothing in it is her decision. */
const skillDrill = (skill) => {
  if (skill === SKILL_PRIORITY) {
    return {
      questionTypes: ['casestudy'],
      instructions:
        'Every question must hinge on deciding what the nurse does FIRST. '
        + 'Distractors should be actions that are correct but out of order.',
    };
  }
  if (skill === SKILL_MULTI) {
    return {
      questionTypes: ['sata'],
      instructions:
        'Select-all-that-apply only. Each option must be judgeable on its own, '
        + 'with distractors that are true statements but wrong answers here.',
    };
  }
  return { questionTypes: ['mcq'], instructions: '' };
};

/** Human name for a skill, for copy. Falls back to the raw key. */
const skillLabel = (skill, t) => {
  if (skill === SKILL_PRIORITY) return t('transition.skillPriority', 'prioritization');
  if (skill === SKILL_MULTI) return t('transition.skillMulti', 'select-all-that-apply');
  return skill || t('transition.skillGeneric', 'these');
};

/* ── Evidence strength ─────────────────────────────────────────────────
   The debrief clears its own bar before claiming a pattern at all, so this is
   a second, higher bar: is the pattern established enough to spend her time
   FIXING, or still a theory worth TESTING with one question? The debrief adds
   its third evidence line only when the misses in THIS node corroborate the
   plan-wide split, which is exactly the difference between the two. */
const PATTERN_ESTABLISHED_EVIDENCE = 3;

export const isPatternEstablished = (debrief) =>
  !!(debrief && debrief.hasPattern)
  && ((debrief.evidence && debrief.evidence.length) || 0) >= PATTERN_ESTABLISHED_EVIDENCE;

/**
 * The full readout for a completed scored node.
 *
 * @returns {{
 *   tone: 'confirmed'|'pattern'|'improving'|'plain',
 *   headline: string,
 *   caption: string,
 *   improvement: Object|null,
 *   recommendation: {
 *     kind: 'test'|'fix'|'harder'|'walkthrough'|'continue',
 *     title: string,
 *     rationale: string,
 *     cta: string,
 *     meta: string,
 *     node: Object|null,      // null = advance to the planned next node
 *     testSkill: string|null  // set when the action is the one-question experiment
 *   }
 * }}
 */
export const buildNodeReadout = ({
  result,
  bucket,
  debrief,
  experimentConfirmed,
  nextNode,
  priorPerformance,
  canTestTheory,
  node,
  estimateMinutes,
  t,
}) => {
  const topic = (result && result.topic) || '';
  const miss = result && result.type === 'flashcard'
    ? (result.needReview || 0)
    : ((result && result.incorrect) || 0);
  const improvement = detectImprovement(result, priorPerformance);
  const hasPattern = !!(debrief && debrief.hasPattern);
  const skill = (debrief && debrief.skill) || '';

  /* ── 1. Headline ──────────────────────────────────────────────────
     Ordered by what she'd most want to know, not by score. A discovery about
     how she thinks outranks the score; the score outranks nothing. */
  const tone = experimentConfirmed ? 'confirmed'
    : hasPattern ? 'pattern'
      : improvement ? 'improving'
        : 'plain';

  let headline;
  if (tone === 'confirmed') {
    headline = t('transition.hConfirmed', 'You just proved it.');
  } else if (tone === 'pattern') {
    headline = t('transition.hPattern', 'I found something interesting.');
  } else if (tone === 'improving') {
    headline = t('transition.hImproving', { topic, defaultValue: "You're getting better at {{topic}}." });
  } else if (bucket === 'mastered') {
    headline = t('transition.hMastered', "That's locked in.");
  } else if (bucket === 'solid') {
    headline = t('transition.hSolid', "You're getting the hang of this.");
  } else if (bucket === 'gaps') {
    headline = t('transition.hGaps', 'This one exposed a gap worth fixing.');
  } else {
    headline = t('transition.hTough', 'Now I know what to work on with you.');
  }

  /* ── 2. Score caption ─────────────────────────────────────────────
     The number is context for the insight, never the point — so the caption
     says what the number MEANS. When a real pattern exists it says the misses
     aren't scattered, which is the reason to read the next block. */
  let caption;
  if (improvement) {
    caption = t('transition.capImproving', {
      pct: improvement.priorPct,
      defaultValue: 'Up from {{pct}}% on this topic before today.',
    });
  } else if (hasPattern) {
    caption = t('transition.capPattern', "Your misses here aren't random.");
  } else if (bucket === 'mastered') {
    caption = result && result.type === 'flashcard'
      ? t('transition.capMasteredFc', 'Every card, first time.')
      : t('transition.capMastered', 'Nothing left to firm up here.');
  } else if (bucket === 'solid') {
    caption = miss === 1
      ? t('transition.capSolidOne', 'One thing to firm up.')
      : t('transition.capSolid', { count: miss, defaultValue: '{{count}} to firm up.' });
  } else if (bucket === 'gaps') {
    caption = t('transition.capGaps', { count: miss, defaultValue: '{{count}} concepts to revisit.' });
  } else {
    caption = t('transition.capTough', 'Worth another pass before you move on.');
  }

  /* ── 3. Recommendation ────────────────────────────────────────────
     One action. It has to be the thing the insight implies, or the insight
     was decoration. */
  const est = typeof estimateMinutes === 'function' ? estimateMinutes : () => 4;
  const sourceTags = ['adaptive', 'source:' + ((node && node.id) || 'unknown')];

  const drillNode = (label, drill, reason) => ({
    type: 'exam',
    label,
    tags: sourceTags.concat('weak_area'),
    difficulty: 2,
    adaptive: true,
    reason,
    examConfig: {
      questionTypes: drill.questionTypes,
      questionCount: DRILL_QUESTIONS,
      timerEnabled: false,
      customInstructions: [topic ? 'Focus on ' + topic + '.' : '', drill.instructions]
        .filter(Boolean).join(' '),
    },
  });

  let recommendation;

  if (tone !== 'confirmed' && hasPattern && !isPatternEstablished(debrief) && canTestTheory) {
    /* The evidence clears the bar for a theory, not a verdict. One question she
       can win by reading differently proves it to her in a way no explanation
       does — and if she misses it, nothing was oversold. */
    recommendation = {
      kind: 'test',
      title: t('transition.recTestTitle', {
        skill: skillLabel(skill, t),
        defaultValue: 'One question, built around {{skill}}',
      }),
      rationale: t('transition.recTestWhy',
        "If I'm right, you'll get it by changing how you read it — not by knowing more."),
      cta: t('transition.ctaTest', 'Test my theory →'),
      meta: t('transition.metaOneQuestion', '1 question · ~2 min'),
      node: null,
      testSkill: skill,
    };
  } else if (tone !== 'confirmed' && hasPattern) {
    const drill = skillDrill(skill);
    recommendation = {
      kind: 'fix',
      title: t('transition.recFixTitle', {
        count: DRILL_QUESTIONS,
        skill: skillLabel(skill, t),
        defaultValue: '{{count}} {{skill}} questions',
      }),
      rationale: t('transition.recFixWhy', 'Aimed at the exact pattern I just described — not at the topic.'),
      cta: t('transition.ctaFix', 'Fix this →'),
      meta: t('transition.metaDrill', { count: DRILL_QUESTIONS, defaultValue: '{{count}} questions · ~5 min' }),
      node: drillNode(
        t('transition.drillLabel', {
          skill: skillLabel(skill, t),
          defaultValue: 'Targeted practice: {{skill}}',
        }),
        drill,
        'Practice ' + skillLabel(skill, t)
      ),
      testSkill: null,
    };
  } else if (bucket === 'tough') {
    // Below 40%, more questions is just more failure. Re-teach, then retest.
    recommendation = {
      kind: 'walkthrough',
      title: t('transition.recWalkTitle', 'One worked example first'),
      rationale: t('transition.recWalkWhy',
        "Let's slow this one down. I'll walk you through it before testing you again."),
      cta: t('transition.ctaWalk', 'Show me how →'),
      meta: t('transition.metaLesson', 'Lesson · ~5 min'),
      node: {
        type: 'lesson',
        label: t('transition.remediationLesson', { topic, defaultValue: 'Review: ' + topic }),
        tags: sourceTags.concat('weak_area'),
        difficulty: (node && node.difficulty) || 1,
        adaptive: true,
        reason: 'Re-teach ' + topic,
      },
      testSkill: null,
    };
  } else if (bucket === 'gaps') {
    /* Real misses, no pattern behind them — so the claim is about the concepts
       she missed, which we have, and says nothing about how she thinks. */
    recommendation = {
      kind: 'fix',
      title: t('transition.recMissedTitle', {
        count: DRILL_QUESTIONS,
        defaultValue: '{{count}} questions on what you missed',
      }),
      rationale: t('transition.recMissedWhy', 'Same concepts, asked a different way.'),
      cta: t('transition.ctaFix', 'Fix this →'),
      meta: t('transition.metaDrill', { count: DRILL_QUESTIONS, defaultValue: '{{count}} questions · ~5 min' }),
      node: drillNode(
        t('transition.remediationQuiz', { topic, defaultValue: 'Focused drill: ' + topic }),
        {
          questionTypes: ['mcq'],
          instructions: (result && result.missedQuestions && result.missedQuestions.length)
            ? 'She missed these — cover the same concepts from a different angle: '
              + result.missedQuestions.slice(0, 4).join(' | ')
            : '',
        },
        'Review ' + miss + ' missed concept' + (miss === 1 ? '' : 's')
      ),
      testSkill: null,
    };
  } else if (bucket === 'mastered' && result && result.type !== 'flashcard') {
    /* A clean run means the next useful signal isn't more of the same
       difficulty — it's whether the knowledge survives a clinical scenario. */
    recommendation = {
      kind: 'harder',
      title: t('transition.recHarderTitle', { topic, defaultValue: 'A harder version of {{topic}}' }),
      rationale: t('transition.recHarderWhy',
        "Same concepts inside a full patient scenario — that's where they actually get tested."),
      cta: t('transition.ctaHarder', 'Challenge me →'),
      meta: t('transition.metaChallenge', '2 scenarios · ~6 min'),
      node: {
        type: 'exam',
        label: t('transition.challengeLabel', { topic, defaultValue: 'Harder: {{topic}}' }),
        tags: sourceTags.concat('challenge'),
        difficulty: 3,
        adaptive: true,
        reason: 'Stretch on ' + topic,
        examConfig: {
          questionTypes: ['casestudy'],
          questionCount: 2,
          timerEnabled: false,
          customInstructions: topic
            + '. Harder than a standard question: multi-step clinical judgment, no giveaway options.',
        },
      },
      testSkill: null,
    };
  } else if (nextNode) {
    recommendation = {
      kind: 'continue',
      title: nextNode.label || t('transition.recNextFallback', 'The next step in your plan'),
      rationale: tone === 'confirmed'
        ? t('transition.recNextWhyConfirmed', 'Carry that same approach into the next one.')
        : t('transition.recNextWhy', "You're solid here — this is what it builds into."),
      cta: t('transition.ctaKeep', 'Keep building →'),
      meta: t('study.nodeType.' + nextNode.type, nextNode.type) + ' · ~' + est(nextNode.type) + ' min',
      node: null,
      testSkill: null,
    };
  } else {
    /* End of the plan with nothing queued: offer the stretch rather than a
       dead "Continue" with nowhere to go. */
    recommendation = {
      kind: 'harder',
      title: t('transition.recMoreTitle', { topic, defaultValue: 'More on {{topic}}' }),
      rationale: t('transition.recMoreWhy', "You've finished the plan for this one — let's keep it warm."),
      cta: t('transition.ctaHarder', 'Challenge me →'),
      meta: t('transition.metaDrill', { count: DRILL_QUESTIONS, defaultValue: '{{count}} questions · ~5 min' }),
      node: drillNode(
        t('transition.remediationQuiz', { topic, defaultValue: 'Focused drill: ' + topic }),
        { questionTypes: ['mcq'], instructions: '' },
        'More practice on ' + topic
      ),
      testSkill: null,
    };
  }

  return { tone, headline, caption, improvement, recommendation };
};

export default buildNodeReadout;
