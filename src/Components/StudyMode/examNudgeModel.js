/* ══════════════════════════════════════════════════════════════════════
   EXAM NUDGE — the one sentence on the dashboard, done properly.

   WHAT WAS WRONG WITH THE OLD ONE
   ───────────────────────────────
   With the exam TOMORROW, the card said:

       "Review beats cramming now. Airway and Breathing Management in
        Trauma is the highest-impact thing left."

   Four separate faults, and they are worth naming so they do not come
   back in a reword:

     1. It lectures. "Review beats cramming" is study-technique advice
        she did not ask for, and it presumes she was about to cram. The
        night before an exam is the worst possible moment to be told how
        to study.
     2. It analyses instead of instructing. "X is the highest-impact
        thing left" is a finding. She does not need a finding at this
        point, she needs to be told what to do for the next hour.
     3. It said the same thing at two days as at one. Those are
        completely different situations and a person would never use one
        sentence for both.
     4. It ignored readiness entirely. The advice for someone sitting at
        67% the night before is not the advice for someone at 25%. One
        needs to be told to stop and consolidate; the other needs
        permission to abandon most of the material.

   THE RULE THIS FILE ENFORCES
   ───────────────────────────
   Every nudge is ONE honest read of the situation plus ONE concrete
   instruction. No study-technique lectures. No inventory reports. And
   the read has to match the calendar — reassurance that ignores the
   date is not reassurance, it is being handled, and she already knows
   what day it is.

   Voice is shared with `coachMessageModel` (the knowledge map's closing
   message). Two surfaces, one tutor: if these drift the product starts
   sounding like two different people.
   ══════════════════════════════════════════════════════════════════════ */

/** Above this, she has a real base to consolidate rather than a hole to dig out of. */
export const STEADY_ENOUGH_PCT = 60;

/**
 * @param {string}  phase        from getExamPhase: steady|focus|final|examDay|past|none
 * @param {number}  daysRemaining
 * @param {string}  nextTopic    the topic today's session would open
 * @param {number}  readinessPct null when she has not answered enough to say
 * @param {boolean} onTrack
 * @param {boolean} studyComplete
 * @param {boolean} allLocked
 * @returns {{key: string, fallback: string, params: object}}
 */
export const buildExamNudge = ({
  phase = 'none',
  daysRemaining = null,
  nextTopic = null,
  readinessPct = null,
  onTrack = true,
  studyComplete = false,
  allLocked = false,
} = {}) => {
  const topic = nextTopic || null;
  const p = { topic, count: daysRemaining };

  // Only claim she is in decent shape when there is evidence for it.
  // Absent readiness is treated as "not established", never as fine.
  const steady = readinessPct != null && readinessPct >= STEADY_ENOUGH_PCT;

  if (studyComplete) {
    return allLocked
      ? {
          key: 'warmUrgency.nudgeCompleteAllLocked',
          fallback: "Plan's done and topics are locked in — a practice round keeps it sharp.",
          params: p,
        }
      : {
          key: 'warmUrgency.nudgeCompletePartial',
          fallback: "You've made it through the plan — one practice round can solidify everything.",
          params: p,
        };
  }

  if (phase === 'past') {
    return {
      key: 'warmUrgency.nudgePast',
      fallback: 'That exam date has passed — finish the plan whenever suits you, or start a new one.',
      params: p,
    };
  }

  /* Exam day. Nothing that sounds like "there is still time to learn this"
     is allowed here — a few hours out it is actively harmful. The job of
     this sentence is to give her permission to stop. */
  if (phase === 'examDay') {
    if (topic) {
      return steady
        ? {
            key: 'warmUrgency.nudgeExamDayReady',
            fallback: "Today's the day. Nothing new now — one calm pass over {{topic}}, then trust the work you've put in.",
            params: p,
          }
        : {
            key: 'warmUrgency.nudgeExamDayTopic',
            fallback: "Today's the day. Nothing new now — one calm pass over {{topic}} and leave the rest.",
            params: p,
          };
    }
    return {
      key: 'warmUrgency.nudgeExamDay',
      fallback: "Today's the day. Nothing new now — a light look over what you've already covered is enough.",
      params: p,
    };
  }

  /* The final 48 hours. One day and two days get genuinely different
     advice, and both branch on whether she has a base to protect or a
     hole to triage. */
  if (phase === 'final') {
    const tomorrow = daysRemaining != null && daysRemaining <= 1;

    if (!topic) {
      return tomorrow
        ? {
            key: 'warmUrgency.nudgeTomorrowGeneric',
            fallback: 'Tomorrow. Go back over the things you already half-know — that is where tonight actually pays off.',
            params: p,
          }
        : {
            key: 'warmUrgency.nudgeTwoDaysGeneric',
            fallback: 'Two days. Go narrow — a couple of topics made solid will do more than a pass over everything.',
            params: p,
          };
    }

    if (tomorrow) {
      return steady
        ? {
            key: 'warmUrgency.nudgeTomorrowReady',
            fallback: "Tomorrow — and you've got a real base. Tonight is for locking in {{topic}}, not starting anything new.",
            params: p,
          }
        : {
            key: 'warmUrgency.nudgeTomorrowBehind',
            fallback: "Tomorrow. Don't spread yourself thin — get {{topic}} solid and let the rest go. One topic properly beats five half-read.",
            params: p,
          };
    }

    return steady
      ? {
          key: 'warmUrgency.nudgeTwoDaysReady',
          fallback: "Two days. That's enough to make {{topic}} properly solid — it's the one that moves your score most.",
          params: p,
        }
      : {
          key: 'warmUrgency.nudgeTwoDaysBehind',
          fallback: 'Two days, so we go narrow: {{topic}} today, review tomorrow. Chasing everything is how both days disappear.',
          params: p,
        };
  }

  if (phase === 'focus') {
    if (!topic) {
      return {
        key: 'warmUrgency.nudgeFocusGeneric',
        fallback: "Exam week — today's session goes at your biggest gaps first.",
        params: p,
      };
    }
    return onTrack
      ? {
          key: 'warmUrgency.nudgeFocus',
          fallback: '{{count}} days out. Enough time to fix {{topic}} properly, and that is what today is for.',
          params: p,
        }
      : {
          key: 'warmUrgency.nudgeFocusBehind',
          fallback: "{{count}} days out, and the plan's been reshaped around them. {{topic}} is today.",
          params: p,
        };
  }

  if (!onTrack) {
    // Rebalanced, not scolded: the plan already redistributed the backlog,
    // so say that rather than reporting a debt she cannot pay off.
    return {
      key: 'warmUrgency.nudgeRebalanced',
      fallback: "We've rebalanced the rest of your plan around the days you have left.",
      params: p,
    };
  }

  /* Only reachable at 8+ days, which is what makes "good position" true
     rather than flattery. The same sentence at three days would be a lie. */
  return {
    key: 'warmUrgency.nudgeCalm',
    fallback: "You're in a good position. Consistent daily sessions are what turn into confidence on exam day.",
    params: p,
  };
};
