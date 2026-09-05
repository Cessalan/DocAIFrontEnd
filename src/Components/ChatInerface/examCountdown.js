/**
 * examCountdown — "Exam in 5 days" / "Exam today" / "Exam 5 days ago" for the
 * sidebar chat list.
 *
 * WHY THE SIDEBAR NEEDS THIS
 * ──────────────────────────
 * A student with four uploaded courses sees four chats ordered by when she
 * last touched them, which is almost never the order she should study them
 * in. The exam date is the only field that answers "which of these is urgent",
 * and it is already on the chat document — it just was not being shown.
 *
 * PAST EXAMS ARE SHOWN, NOT HIDDEN. The drill sheet suppresses them because a
 * countdown to something that already happened is meaningless there. Here the
 * opposite is true: "Exam 5 days ago" is exactly what tells her this chat can
 * be skipped, which is half of prioritising.
 *
 * Returns an i18n descriptor rather than a finished string, so the copy stays
 * in i18n.js with everything else and French comes for free. `tone` is for
 * styling only — it must never be the thing that carries the meaning, since a
 * colour is invisible to anyone who cannot see it.
 */

import { coerceDate, calendarDaysBetween } from '../StudyMode/studySchedule';

/**
 * Days out at or under which an upcoming exam is styled as urgent.
 *
 * Five, because our measured median lead time between a student setting a date
 * and the exam itself is about a week — a threshold of one or two days would
 * light up only after it is too late to act on.
 */
export const URGENT_WITHIN_DAYS = 5;

/**
 * @param {*} examDate  ISO string, Date, or Firestore Timestamp. Anything else
 *                      (including absent) yields null.
 * @param {Date} [now]  Injectable for tests.
 * @returns {{key: string, fallback: string, params: Object, tone: string, days: number}|null}
 */
export const examCountdown = (examDate, now = new Date()) => {
  const when = coerceDate(examDate);
  if (!when) return null;

  const days = calendarDaysBetween(now, when);
  if (days === null || Number.isNaN(days)) return null;

  if (days === 0) {
    return { key: 'side.examToday', fallback: 'Exam today', params: {}, tone: 'today', days };
  }

  if (days === 1) {
    return { key: 'side.examTomorrow', fallback: 'Exam tomorrow', params: {}, tone: 'soon', days };
  }

  if (days > 1) {
    return {
      key: 'side.examInDays',
      fallback: 'Exam in {{count}} days',
      params: { count: days },
      tone: days <= URGENT_WITHIN_DAYS ? 'soon' : 'future',
      days,
    };
  }

  if (days === -1) {
    return { key: 'side.examYesterday', fallback: 'Exam yesterday', params: {}, tone: 'past', days };
  }

  return {
    key: 'side.examDaysAgo',
    fallback: 'Exam {{count}} days ago',
    params: { count: Math.abs(days) },
    tone: 'past',
    days,
  };
};

export default examCountdown;
