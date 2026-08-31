/* ══════════════════════════════════════════════════════════════════════
   COACH MESSAGE MODEL — what a person would say, given the calendar.

   The map used to end on a static paragraph. It was accurate and it was
   dead: the same sentence whether her exam was tomorrow or in a month,
   with the number dropped into a slot. Nobody talks like that, and a
   tutor who does not react to "my exam is tomorrow" is not a tutor.

   So the ending is now a short message that gets TYPED OUT, and the
   first thing it does is name the deadline and say something true about
   it:

       "Your exam is 12 days away — we've got time. Here's the game plan."
       "Your exam is tomorrow. That's not much time, so we're going
        straight at the things most likely to cost you marks."

   THE RULE THAT KEEPS THIS HONEST: the time judgement must match the
   time. Telling someone with two days that there is plenty of room is
   the fastest way to lose her, because she already knows there isn't.
   Reassurance that ignores the facts is not reassurance — it is being
   handled, and students can feel the difference instantly. The warmth
   has to come from having a plan, never from softening the calendar.

   This module returns i18n KEYS and params rather than finished strings,
   so the copy lives with the rest of the copy (and exists in French)
   while the phase logic stays assertable here.

   (Named `coachMessageModel` and not `coachMessage` because the component
   next door is `CoachMessage.js`, and on a case-insensitive filesystem a
   name differing only in case is the SAME FILE — one silently overwrites
   the other. Same convention as `knowledgeMapModel`.)
   ══════════════════════════════════════════════════════════════════════ */

import { getExamPhase } from './studySchedule';

/** "A", "A and B", "A, B and C" — never a bare comma list. */
export const joinTopics = (topics = [], andWord = ' and ') => {
  const list = topics.filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return list.join(andWord);
  return `${list.slice(0, -1).join(', ')}${andWord}${list[list.length - 1]}`;
};

/**
 * Build the closing message.
 *
 * @param {number|null} daysToExam  null when she never gave us a date
 * @param {Array} needsWork  topic objects, weakest first
 * @param {Array} strong     topic objects she is already solid on
 * @param {string} [examName]
 * @returns {{phase: string, beats: Array<{key, fallback, params}>}}
 */
export const buildCoachMessage = ({
  daysToExam = null,
  needsWork = [],
  strong = [],
  examName = null,
} = {}) => {
  const phase = daysToExam == null ? 'undated' : getExamPhase(daysToExam);
  const focus = needsWork.slice(0, 2).map((t) => t.topic);
  const beats = [];

  const exam = examName || null;
  const p = { count: daysToExam, exam };

  /* ── Beat 1: the deadline, and an honest read on it ── */
  switch (phase) {
    case 'past':
      beats.push({
        key: 'coach.past',
        fallback: 'That exam date has already gone by.',
        params: p,
      });
      break;
    case 'examDay':
      beats.push({
        key: 'coach.examDay',
        fallback: 'Your exam is today.',
        params: p,
      });
      break;
    case 'final':
      beats.push({
        key: daysToExam <= 1 ? 'coach.tomorrow' : 'coach.twoDays',
        fallback:
          daysToExam <= 1
            ? 'Your exam is tomorrow. That’s not much time.'
            : 'Two days out. That’s tight.',
        params: p,
      });
      break;
    case 'focus':
      beats.push({
        key: 'coach.focus',
        fallback:
          'Your exam is {{count}} days away. Enough time to fix real gaps — not enough to redo everything.',
        params: p,
      });
      break;
    case 'steady':
      beats.push({
        key: 'coach.steady',
        fallback: 'Your exam is {{count}} days away — we’ve got time.',
        params: p,
      });
      break;
    default: // undated
      beats.push({
        key: 'coach.undated',
        fallback: 'No exam date set, so we’ll go at a steady pace.',
        params: p,
      });
  }

  /* ── Beat 2: what we are going to do about it ──
     Each phase gets its own verb, because the strategy genuinely differs.
     Under two days the honest advice is triage, and saying so out loud is
     what makes the reassurance credible on the days we do offer it. */
  const topics = joinTopics(focus);
  const withTopics = { ...p, topics };

  if (focus.length === 0) {
    beats.push({
      key: 'coach.planAllStrong',
      fallback:
        'Honestly, you’re in good shape. Your path is short checks to keep it that way, not a rebuild.',
      params: withTopics,
    });
  } else if (phase === 'examDay') {
    beats.push({
      key: 'coach.planExamDay',
      fallback:
        'No new material today — that never helps. One fast pass over {{topics}}, then stop.',
      params: withTopics,
    });
  } else if (phase === 'final') {
    beats.push({
      key: 'coach.planFinal',
      fallback:
        'So we’re not covering everything. Straight at {{topics}} — that’s where the marks are.',
      params: withTopics,
    });
  } else if (phase === 'focus') {
    beats.push({
      key: 'coach.planFocus',
      fallback: 'So here’s the plan: {{topics}} first, properly.',
      params: withTopics,
    });
  } else {
    beats.push({
      key: 'coach.planSteady',
      fallback:
        'Here’s the game plan. We start with {{topics}}, and we take them properly rather than skimming.',
      params: withTopics,
    });
  }

  /* ── Beat 3: the tail, only when there is one ──
     Skipped on exam day: "we'll refresh it at the end" is meaningless when
     there is no end left to put anything at. */
  if (strong.length > 0 && focus.length > 0 && phase !== 'examDay') {
    beats.push({
      key: 'coach.tail',
      fallback:
        '{{strong}} you’ve already got — that moves to the end as a quick refresh.',
      params: { ...p, strong: joinTopics(strong.slice(0, 3).map((t) => t.topic)) },
    });
  }

  return { phase, beats };
};
