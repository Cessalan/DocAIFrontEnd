import { examCountdown, URGENT_WITHIN_DAYS } from './examCountdown';

const NOW = new Date('2026-08-31T14:00:00');
const at = (iso) => examCountdown(iso, NOW);

describe('examCountdown', () => {
  it('returns nothing without a usable date', () => {
    expect(examCountdown(null, NOW)).toBeNull();
    expect(examCountdown(undefined, NOW)).toBeNull();
    expect(examCountdown('', NOW)).toBeNull();
    expect(examCountdown('not a date', NOW)).toBeNull();
  });

  it('calls the day of the exam today, whatever the clock says', () => {
    // Same calendar day, earlier in the morning: still today, not "yesterday".
    expect(at('2026-08-31T08:00:00')).toMatchObject({ key: 'side.examToday', tone: 'today', days: 0 });
    expect(at('2026-08-31T23:30:00')).toMatchObject({ key: 'side.examToday', days: 0 });
  });

  it('names tomorrow and yesterday rather than counting them', () => {
    expect(at('2026-09-01T09:00:00')).toMatchObject({ key: 'side.examTomorrow', tone: 'soon', days: 1 });
    expect(at('2026-08-30T09:00:00')).toMatchObject({ key: 'side.examYesterday', tone: 'past', days: -1 });
  });

  it('counts forward for upcoming exams', () => {
    expect(at('2026-09-05T09:00:00')).toMatchObject({
      key: 'side.examInDays',
      params: { count: 5 },
      days: 5,
    });
  });

  it('counts backward for exams already sat', () => {
    // Shown, not hidden: "Exam 5 days ago" is what tells her to skip this chat.
    expect(at('2026-08-26T09:00:00')).toMatchObject({
      key: 'side.examDaysAgo',
      params: { count: 5 },
      tone: 'past',
      days: -5,
    });
  });

  it('reports a positive count for past exams, never a negative one', () => {
    expect(at('2026-08-01T09:00:00').params.count).toBeGreaterThan(0);
  });

  it('marks anything inside the urgent window as soon, and beyond it as future', () => {
    expect(at('2026-09-05T09:00:00').tone).toBe('soon');       // 5 days
    expect(at('2026-09-06T09:00:00').tone).toBe('future');     // 6 days
    expect(URGENT_WITHIN_DAYS).toBe(5);
  });

  it('accepts a Date as well as an ISO string', () => {
    expect(examCountdown(new Date('2026-09-02T10:00:00'), NOW)).toMatchObject({ days: 2 });
  });

  it('accepts a Firestore-style timestamp', () => {
    const ts = { toDate: () => new Date('2026-09-03T10:00:00') };
    expect(examCountdown(ts, NOW)).toMatchObject({ days: 3 });
  });

  it('carries copy for every branch so nothing renders a bare key', () => {
    ['2026-08-31T09:00:00', '2026-09-01T09:00:00', '2026-09-09T09:00:00',
     '2026-08-30T09:00:00', '2026-08-20T09:00:00'].forEach((iso) => {
      const out = at(iso);
      expect(typeof out.fallback).toBe('string');
      expect(out.fallback.length).toBeGreaterThan(0);
      expect(out.key.startsWith('side.')).toBe(true);
    });
  });
});
