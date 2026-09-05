import { SENTIMENT, PREPAREDNESS } from '../../Services/satisfactionEnums';

/**
 * examDebriefModel — decides whether there is an exam worth asking about, and
 * which one.
 *
 * WHY THIS EXISTS
 *
 * We know a student's exam date and we know everything they did to prepare, and
 * then the one moment that decides whether any of it worked happens somewhere
 * we cannot see. Nothing in the app has ever asked what happened in the exam
 * room, so "what was missing from the prep" has never been answerable — only
 * guessed at from quiz scores, which measure our own questions, not theirs.
 *
 * The trigger has to be exactly right or the question is worse than not asking:
 * ask too early and they have not sat it, ask too late and the recall is
 * fiction, ask twice and we look like we were not listening. That decision is
 * pure date arithmetic over a few different places an exam date can live, so it
 * lives here with a test rather than inline in a modal.
 *
 * DESIGN NOTES
 *
 *  - "Passed" means the exam DAY is over in the student's own timezone, not
 *    that the timestamp is behind `now`. Exam dates are stored at local
 *    midnight, so a same-day check would ask a student at 8am how an exam went
 *    that they sit at 2pm.
 *
 *  - LOOKBACK_DAYS caps how stale a question we are willing to ask. Three weeks
 *    on, "what would have helped?" gets an answer reconstructed from mood
 *    rather than memory, and that answer is indistinguishable from a real one
 *    once it is in the collection.
 *
 *  - Candidates are deduped by CALENDAR DAY, not by id. The same exam is
 *    recorded in two unrelated places — the `exams` subcollection (named, via
 *    ExamPrepModal) and `onboarding.examDate` (unnamed, via PlanOnboarding) —
 *    and nothing links them. Without the day-level dedupe a student who used
 *    both paths gets asked about one exam twice, which is the single most
 *    damaging outcome for a question that only works if it feels attentive.
 *    The named candidate wins, because "Your Pharmacology exam" is worth more
 *    than "Your exam".
 *
 *    One prompt per day is deliberate, and it is why two exams sat on the SAME
 *    day produce one question rather than two. Students sitting back-to-back
 *    finals are the people least willing to answer a second popup, and one
 *    honest answer about a hard week is worth more than two skipped ones.
 *
 *  - A dismissal is stored and honoured exactly like an answer. Skipping IS the
 *    answer to "do you want to talk about this", and re-asking would be the app
 *    arguing with it.
 *
 *  - Only the most recent unanswered exam is returned per call. Two exams in
 *    one week produce two prompts on two separate logins, never a queue of
 *    modals in one sitting.
 */

/** How long after an exam we still trust the recall. */
export const DEBRIEF_LOOKBACK_DAYS = 14;

/** Recent enough that the copy can say "this week" instead of a date. */
export const THIS_WEEK_DAYS = 7;

/**
 * Accept every shape an exam date arrives in: a Firestore Timestamp, a Date, an
 * ISO string, or epoch millis. Anything unparseable returns null rather than an
 * Invalid Date, so a bad row is skipped instead of poisoning a comparison
 * (every comparison against an Invalid Date is false, which would silently mean
 * "never ask").
 */
export const coerceDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    try {
      const d = value.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Local calendar day, `YYYY-MM-DD`. The dedupe key and the stored day stamp. */
export const dayKey = (date) => {
  const d = coerceDate(date);
  if (!d) return null;
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

/** Whole days between the exam day and today, in local time. */
export const daysSince = (date, now) => {
  const d = coerceDate(date);
  if (!d) return null;
  const examMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nowDate = coerceDate(now) || new Date();
  const todayMidnight = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  return Math.round((todayMidnight - examMidnight) / 86400000);
};

/**
 * Turn the two storage locations into one list of candidates.
 *
 * @param {Array}  [exams]              From `users/{uid}/exams` — named.
 * @param {*}      [onboardingExamDate] `users/{uid}.onboarding.examDate` — unnamed.
 * @returns {Array<{key, examId, label, date, day, named}>}
 */
export const collectCandidates = ({ exams = [], onboardingExamDate = null } = {}) => {
  const out = [];

  (Array.isArray(exams) ? exams : []).forEach((exam) => {
    const date = coerceDate(exam?.date);
    if (!date || !exam?.id) return;
    const label = (exam.name || exam.subject || '').trim();
    out.push({
      key: `exam:${exam.id}`,
      // The id, not just the key: it is what links this exam to the chat that
      // holds her study plan, which is the context the debrief conversation
      // uses to ask specific questions instead of generic ones.
      examId: exam.id,
      label: label || null,
      date,
      day: dayKey(date),
      named: Boolean(label)
    });
  });

  const onboardingDate = coerceDate(onboardingExamDate);
  if (onboardingDate) {
    out.push({
      key: `date:${dayKey(onboardingDate)}`,
      label: null,
      date: onboardingDate,
      day: dayKey(onboardingDate),
      named: false
    });
  }

  return out;
};

/**
 * Every day already spoken for — either by a stored `day` on an entry or by a
 * date-shaped key. Both are needed: the key alone misses the case where the
 * student answered about the named exam and the unnamed duplicate is still
 * sitting there under a different key.
 */
const handledDays = (debriefs) => {
  const days = new Set();
  Object.entries(debriefs || {}).forEach(([key, entry]) => {
    if (entry?.day) days.add(entry.day);
    if (key.startsWith('date:')) days.add(key.slice(5));
  });
  return days;
};

/**
 * Pick the one exam to ask about, or null.
 *
 * @param {Object} params
 * @param {Array}  [params.exams]
 * @param {*}      [params.onboardingExamDate]
 * @param {Object} [params.debriefs]  `users/{uid}.examDebriefs` — key → {status, day}.
 * @param {Date}   [params.now]
 * @param {number} [params.lookbackDays]
 * @returns {{key, label, date, day, daysAgo, isThisWeek}|null}
 */
export const selectExamDebrief = ({
  exams = [],
  onboardingExamDate = null,
  debriefs = {},
  now = new Date(),
  lookbackDays = DEBRIEF_LOOKBACK_DAYS
} = {}) => {
  const asked = handledDays(debriefs);

  const eligible = collectCandidates({ exams, onboardingExamDate })
    .filter((c) => {
      if (debriefs && Object.prototype.hasOwnProperty.call(debriefs, c.key)) return false;
      if (asked.has(c.day)) return false;
      const ago = daysSince(c.date, now);
      // >= 1 means the exam day itself is over. Same-day is never asked.
      return ago !== null && ago >= 1 && ago <= lookbackDays;
    })
    // Most recent first; a named candidate outranks an unnamed one on the same
    // day so the dedupe below keeps the one that can say what the exam was.
    .sort((a, b) => (b.date - a.date) || (Number(b.named) - Number(a.named)));

  const seenDays = new Set();
  const deduped = eligible.filter((c) => {
    if (seenDays.has(c.day)) return false;
    seenDays.add(c.day);
    return true;
  });

  const chosen = deduped[0];
  if (!chosen) return null;

  const daysAgo = daysSince(chosen.date, now);
  return {
    key: chosen.key,
    examId: chosen.examId || null,
    label: chosen.label,
    date: chosen.date,
    day: chosen.day,
    daysAgo,
    isThisWeek: daysAgo <= THIS_WEEK_DAYS
  };
};

/**
 * Collapse the 4-point scale onto the shared sentiment axis.
 *
 * The split is deliberately 2/2 with no neutral. "Somewhat unprepared" is not a
 * neutral outcome — it is prep that did not do its job — and filing it as 0
 * would let a bad week average out against a good one and read as fine. The
 * ordinal survives untouched in `context.preparedness` for anyone who needs the
 * finer read.
 */
export const sentimentFromPreparedness = (value) => {
  switch (value) {
    case PREPAREDNESS.WELL:
    case PREPAREDNESS.MOSTLY:
      return SENTIMENT.POSITIVE;
    case PREPAREDNESS.SOMEWHAT_UNPREPARED:
    case PREPAREDNESS.NOT_ENOUGH:
      return SENTIMENT.NEGATIVE;
    default:
      return null;
  }
};

/**
 * The four-point preparedness scale, kept as documentation of what the stored
 * ordinal means. Nothing renders these any more: the survey they belonged to
 * was replaced by a conversation, and the model now reports preparedness as a
 * word that `examDebriefConversation` maps back onto this same 4..1 scale — so
 * rows written before and after the rewrite still count together.
 */
export const PREPAREDNESS_LABELS = {
  [PREPAREDNESS.WELL]: 'Well prepared',
  [PREPAREDNESS.MOSTLY]: 'Mostly prepared',
  [PREPAREDNESS.SOMEWHAT_UNPREPARED]: 'Somewhat unprepared',
  [PREPAREDNESS.NOT_ENOUGH]: 'Not prepared enough'
};

/**
 * What would have helped — the closed set the conversation is tagged with.
 *
 * These used to be chips the student tapped. They are now assigned by the model
 * from what she actually said, which is the only reason a free-form
 * conversation can still be counted: "eleven students wanted more case
 * scenarios" is a sentence someone can act on, and prose is not.
 *
 * CROSS-REPO CONTRACT: this list is mirrored verbatim in GAP_TAGS in
 * NQBackEnd2/services/exam_debrief.py and in GAP_LABELS in
 * SatisfactionDashboard.js. A slug added on one side and not the others is
 * either never produced or renders as a raw slug on the dashboard.
 *
 * Every slug names something we could actually change next sprint. Nothing here
 * is a satisfaction rating — this is a work queue, ranked by the people who
 * just sat the exam.
 */
export const EXAM_GAP_REASONS = [
  'more_realistic_questions',
  'harder_questions',
  'more_case_scenarios',
  'better_explanations',
  'more_topic_practice',
  'better_guidance',
  'other'
];
