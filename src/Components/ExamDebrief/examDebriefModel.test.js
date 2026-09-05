import {
  selectExamDebrief,
  collectCandidates,
  coerceDate,
  dayKey,
  daysSince,
  sentimentFromPreparedness,
  DEBRIEF_LOOKBACK_DAYS
} from './examDebriefModel';
import { SENTIMENT, PREPAREDNESS } from '../../Services/satisfactionEnums';

/* Local midnight, matching how every exam date in the app is written. Building
   dates from parts rather than ISO strings on purpose: `new Date('2026-08-20')`
   is parsed as UTC and lands on the 19th west of Greenwich, which is exactly
   the off-by-one this model exists to get right. */
const at = (y, m, d, h = 0) => new Date(y, m - 1, d, h, 0, 0, 0);

const NOW = at(2026, 8, 31, 10); // Monday morning

describe('coerceDate', () => {
  it('passes a Date through', () => {
    const d = at(2026, 8, 20);
    expect(coerceDate(d)).toBe(d);
  });

  it('unwraps a Firestore Timestamp', () => {
    const d = at(2026, 8, 20);
    expect(coerceDate({ toDate: () => d })).toEqual(d);
  });

  it('reads the seconds field when toDate is missing', () => {
    const d = at(2026, 8, 20);
    expect(coerceDate({ seconds: Math.floor(d.getTime() / 1000) })).toEqual(d);
  });

  it('returns null for junk rather than an Invalid Date', () => {
    // An Invalid Date compares false against everything, which would read as
    // "not due yet" and silently disable the prompt forever.
    expect(coerceDate('not a date')).toBeNull();
    expect(coerceDate(null)).toBeNull();
    expect(coerceDate(undefined)).toBeNull();
    expect(coerceDate(new Date('nope'))).toBeNull();
  });
});

describe('dayKey / daysSince', () => {
  it('keys on the local calendar day', () => {
    expect(dayKey(at(2026, 8, 5, 23))).toBe('2026-08-05');
  });

  it('counts whole days between exam day and today, ignoring clock time', () => {
    expect(daysSince(at(2026, 8, 30, 23), NOW)).toBe(1);
    expect(daysSince(at(2026, 8, 31, 1), NOW)).toBe(0);
    expect(daysSince(at(2026, 8, 24), NOW)).toBe(7);
  });
});

describe('collectCandidates', () => {
  it('names an exam from `name`, falling back to `subject`', () => {
    const found = collectCandidates({
      exams: [
        { id: 'a', name: 'Pharmacology', date: at(2026, 8, 20) },
        { id: 'b', subject: 'Med-Surg', date: at(2026, 8, 21) }
      ]
    });
    expect(found.map((c) => c.label)).toEqual(['Pharmacology', 'Med-Surg']);
    expect(found.every((c) => c.named)).toBe(true);
  });

  it('skips exams with no usable date instead of dropping the whole list', () => {
    const found = collectCandidates({
      exams: [
        { id: 'a', name: 'Broken', date: 'garbage' },
        { id: 'b', name: 'Fine', date: at(2026, 8, 20) }
      ]
    });
    expect(found).toHaveLength(1);
    expect(found[0].label).toBe('Fine');
  });

  it('adds the unnamed onboarding date under a date-shaped key', () => {
    const found = collectCandidates({ onboardingExamDate: at(2026, 8, 20) });
    expect(found).toEqual([
      expect.objectContaining({ key: 'date:2026-08-20', label: null, named: false })
    ]);
  });
});

describe('selectExamDebrief', () => {
  it('returns null when there is no exam at all', () => {
    expect(selectExamDebrief({ now: NOW })).toBeNull();
  });

  it('asks about an exam that finished yesterday', () => {
    const chosen = selectExamDebrief({
      exams: [{ id: 'a', name: 'Pharmacology', date: at(2026, 8, 30) }],
      now: NOW
    });
    expect(chosen).toMatchObject({
      key: 'exam:a',
      label: 'Pharmacology',
      daysAgo: 1,
      isThisWeek: true
    });
  });

  it('does not ask on the day of the exam', () => {
    // She may not have sat it yet. Same-day is the one case that makes the
    // question look like it was sent by something that is not paying attention.
    expect(
      selectExamDebrief({
        exams: [{ id: 'a', name: 'Pharmacology', date: at(2026, 8, 31) }],
        now: NOW
      })
    ).toBeNull();
  });

  it('does not ask about an exam still ahead', () => {
    expect(
      selectExamDebrief({
        exams: [{ id: 'a', name: 'Pharmacology', date: at(2026, 9, 10) }],
        now: NOW
      })
    ).toBeNull();
  });

  it('stops asking once the exam is older than the lookback window', () => {
    const justInside = at(2026, 8, 31 - DEBRIEF_LOOKBACK_DAYS);
    const justOutside = at(2026, 8, 31 - DEBRIEF_LOOKBACK_DAYS - 1);

    expect(
      selectExamDebrief({ exams: [{ id: 'a', date: justInside }], now: NOW })
    ).not.toBeNull();
    expect(
      selectExamDebrief({ exams: [{ id: 'a', date: justOutside }], now: NOW })
    ).toBeNull();
  });

  it('flags anything older than a week as not "this week"', () => {
    const chosen = selectExamDebrief({
      exams: [{ id: 'a', name: 'Pharmacology', date: at(2026, 8, 21) }],
      now: NOW
    });
    expect(chosen.daysAgo).toBe(10);
    expect(chosen.isThisWeek).toBe(false);
  });

  it('picks the most recent exam when several are in the window', () => {
    const chosen = selectExamDebrief({
      exams: [
        { id: 'old', name: 'Med-Surg', date: at(2026, 8, 22) },
        { id: 'new', name: 'Pharmacology', date: at(2026, 8, 28) }
      ],
      now: NOW
    });
    expect(chosen.key).toBe('exam:new');
  });

  it('never asks twice about the same exam, answered or skipped', () => {
    const exams = [{ id: 'a', name: 'Pharmacology', date: at(2026, 8, 30) }];
    const answered = { 'exam:a': { status: 'answered', day: '2026-08-30' } };
    const dismissed = { 'exam:a': { status: 'dismissed', day: '2026-08-30' } };

    expect(selectExamDebrief({ exams, debriefs: answered, now: NOW })).toBeNull();
    expect(selectExamDebrief({ exams, debriefs: dismissed, now: NOW })).toBeNull();
  });

  it('moves on to the earlier exam once the recent one is handled', () => {
    const chosen = selectExamDebrief({
      exams: [
        { id: 'old', name: 'Med-Surg', date: at(2026, 8, 22) },
        { id: 'new', name: 'Pharmacology', date: at(2026, 8, 28) }
      ],
      debriefs: { 'exam:new': { status: 'answered', day: '2026-08-28' } },
      now: NOW
    });
    expect(chosen.key).toBe('exam:old');
  });

  it('asks once, with the name, when the same exam is in both places', () => {
    // ExamPrepModal writes the exams subcollection; PlanOnboarding writes
    // onboarding.examDate. Nothing links them, so the same exam arrives twice.
    const chosen = selectExamDebrief({
      exams: [{ id: 'a', name: 'Pharmacology', date: at(2026, 8, 28) }],
      onboardingExamDate: at(2026, 8, 28),
      now: NOW
    });
    expect(chosen).toMatchObject({ key: 'exam:a', label: 'Pharmacology' });
  });

  it('does not re-ask the unnamed duplicate after the named one was answered', () => {
    expect(
      selectExamDebrief({
        exams: [{ id: 'a', name: 'Pharmacology', date: at(2026, 8, 28) }],
        onboardingExamDate: at(2026, 8, 28),
        debriefs: { 'exam:a': { status: 'answered', day: '2026-08-28' } },
        now: NOW
      })
    ).toBeNull();
  });

  it('falls back to the unnamed onboarding date when that is all there is', () => {
    const chosen = selectExamDebrief({
      onboardingExamDate: at(2026, 8, 29),
      now: NOW
    });
    expect(chosen).toMatchObject({ key: 'date:2026-08-29', label: null, daysAgo: 2 });
  });
});

describe('sentimentFromPreparedness', () => {
  it('splits the four-point scale 2/2 with no neutral', () => {
    expect(sentimentFromPreparedness(PREPAREDNESS.WELL)).toBe(SENTIMENT.POSITIVE);
    expect(sentimentFromPreparedness(PREPAREDNESS.MOSTLY)).toBe(SENTIMENT.POSITIVE);
    expect(sentimentFromPreparedness(PREPAREDNESS.SOMEWHAT_UNPREPARED)).toBe(SENTIMENT.NEGATIVE);
    expect(sentimentFromPreparedness(PREPAREDNESS.NOT_ENOUGH)).toBe(SENTIMENT.NEGATIVE);
  });

  it('returns null for anything off the scale rather than guessing', () => {
    expect(sentimentFromPreparedness(undefined)).toBeNull();
    expect(sentimentFromPreparedness(0)).toBeNull();
  });
});
