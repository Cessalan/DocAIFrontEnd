/**
 * examDateChoices — the one place "when is your exam?" is defined.
 *
 * The study plan has always asked this as question 1 of PlanOnboarding. The
 * drill now asks it too, because a student who goes straight to the drill
 * never passes through plan onboarding and therefore never has an exam date —
 * so the countdown on the resume card ("8 days until your exam"), which is the
 * strongest reason to come back tomorrow, could never appear for exactly the
 * users who chose the fastest path in.
 *
 * Two surfaces asking one question is how the offsets drift apart, and a
 * countdown that says 10 days on one screen and 14 on another is worse than no
 * countdown. So the choices live here and both import them.
 *
 * WHY OFFSETS AND NOT A CALENDAR
 * ──────────────────────────────
 * Inherited from PlanOnboarding, whose comment is worth keeping: the prompt
 * only needs to capture the urgency tier, not a precise calendar day. Someone
 * who cares about the exact date can pick one; everyone else answers in one
 * tap, which is the difference between a question that gets answered and a
 * question that gets skipped.
 */

/** Quick choices, in the order they are offered. */
export const EXAM_DATE_CHOICES = [
  { key: 'today', daysAway: 0 },
  { key: 'tomorrow', daysAway: 1 },
  { key: 'this_week', daysAway: 5 },
  { key: 'next_week', daysAway: 10 },
  { key: 'two_plus_weeks', daysAway: 21 },
];

/** Local midnight today — the origin every offset is measured from. */
export const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * Resolve a choice key (or a 'YYYY-MM-DD' custom date) to a real date.
 *
 * @param {string} key            One of EXAM_DATE_CHOICES, or 'custom'.
 * @param {string} [customDate]   'YYYY-MM-DD', required when key is 'custom'.
 * @returns {{date: Date, iso: string, daysAway: number}|null} null when the
 *          key is unknown or the custom date is unusable — never a guess.
 */
export const resolveExamDate = (key, customDate) => {
  const today = startOfToday();

  if (key === 'custom') {
    if (!customDate) return null;
    const date = new Date(`${customDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    // Past dates clamp to 0 rather than counting backwards: a negative
    // countdown is not a thing we ever want to render.
    const daysAway = Math.max(0, Math.round((date - today) / 86400000));
    return { date, iso: date.toISOString(), daysAway };
  }

  const choice = EXAM_DATE_CHOICES.find((c) => c.key === key);
  if (!choice) return null;

  const date = new Date(today);
  date.setDate(date.getDate() + choice.daysAway);
  return { date, iso: date.toISOString(), daysAway: choice.daysAway };
};
