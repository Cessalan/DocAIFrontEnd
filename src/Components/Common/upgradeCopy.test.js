import { daysUntilExam, isExamSoon } from './upgradeCopy';

/**
 * These exist because the exam-urgency copy in UpgradeModal was dark in
 * production for a reason nothing surfaced: the field WAS populated, with a
 * value this helper cannot read.
 *
 * `onboarding.examDate` was written straight from the chat document, where it
 * is a Firestore Timestamp. `new Date(timestampObject)` is Invalid Date, so
 * daysUntilExam returned null, isExamSoon returned false, and every student —
 * however close her exam — got the generic pitch. No error, no warning, just
 * the weakest version of the copy, always.
 *
 * The fix is to store an ISO string at both write sites. The guard is here.
 */
describe('daysUntilExam', () => {
  const inDays = (n) => new Date(Date.now() + n * 86400000);

  it('reads an ISO string — the shape both write paths now store', () => {
    expect(daysUntilExam(inDays(5).toISOString())).toBe(5);
  });

  it('reads a Date and a millisecond timestamp', () => {
    expect(daysUntilExam(inDays(3))).toBe(3);
    expect(daysUntilExam(inDays(3).getTime())).toBe(3);
  });

  it('CANNOT read a Firestore Timestamp — which is why we never store one', () => {
    // Shape of a Firestore Timestamp: {seconds, nanoseconds, toDate()}.
    // This is the regression. If someone "simplifies" a write site back to
    // passing chatData.examDate straight through, this is what the modal gets.
    const firestoreTimestamp = {
      seconds: Math.floor(inDays(5).getTime() / 1000),
      nanoseconds: 0,
      toDate() { return inDays(5); },
    };
    expect(daysUntilExam(firestoreTimestamp)).toBeNull();
    expect(isExamSoon(firestoreTimestamp)).toBe(false);
  });

  it('returns null for a missing date rather than pretending urgency', () => {
    expect(daysUntilExam(null)).toBeNull();
    expect(daysUntilExam(undefined)).toBeNull();
    expect(daysUntilExam('')).toBeNull();
  });

  it('treats a past exam as no urgency, not negative urgency', () => {
    // A stale date must not render "your exam is in -12 days".
    expect(daysUntilExam(inDays(-12).toISOString())).toBeNull();
  });

  it('does not invent a countdown from garbage', () => {
    expect(daysUntilExam('next tuesday')).toBeNull();
  });
});

describe('isExamSoon', () => {
  const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

  it('is true inside the window and false outside it', () => {
    expect(isExamSoon(inDays(5))).toBe(true);
    expect(isExamSoon(inDays(29))).toBe(true);
    expect(isExamSoon(inDays(45))).toBe(false);
  });

  it('honours a custom window', () => {
    expect(isExamSoon(inDays(10), 7)).toBe(false);
    expect(isExamSoon(inDays(5), 7)).toBe(true);
  });
});
