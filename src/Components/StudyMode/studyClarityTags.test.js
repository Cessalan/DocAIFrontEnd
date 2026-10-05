import { progressBucket, examCountdownBucket, studyPlanTags } from './studyClarityTags';

describe('progressBucket', () => {
  it('separates the never-started plan from everything else', () => {
    expect(progressBucket(0, 8)).toBe('not_started');
    expect(progressBucket(1, 8)).toBe('under_half');
    expect(progressBucket(4, 8)).toBe('over_half');
    expect(progressBucket(8, 8)).toBe('finished');
  });

  it('has no opinion on an empty plan', () => {
    expect(progressBucket(0, 0)).toBeNull();
  });
});

describe('examCountdownBucket', () => {
  const now = new Date(2026, 9, 1, 23, 0); // 11pm, Oct 1

  it('counts calendar days, not 24h windows', () => {
    expect(examCountdownBucket(new Date(2026, 9, 2, 8, 0), now)).toBe('1-3_days');
    expect(examCountdownBucket(new Date(2026, 9, 1, 9, 0), now)).toBe('today');
  });

  it('buckets the rest', () => {
    expect(examCountdownBucket(new Date(2026, 9, 6), now)).toBe('4-7_days');
    expect(examCountdownBucket(new Date(2026, 9, 12), now)).toBe('8-14_days');
    expect(examCountdownBucket(new Date(2026, 10, 30), now)).toBe('15+_days');
    expect(examCountdownBucket(new Date(2026, 8, 20), now)).toBe('past');
  });

  it('reads Firestore timestamps and rejects junk', () => {
    expect(examCountdownBucket({ toDate: () => new Date(2026, 9, 3) }, now)).toBe('1-3_days');
    expect(examCountdownBucket(null, now)).toBe('no_date');
    expect(examCountdownBucket('not a date', now)).toBe('no_date');
  });
});

it('studyPlanTags combines them', () => {
  expect(studyPlanTags({ completed: 0, total: 5, examDate: null })).toEqual({
    study_plan: 'yes', plan_progress: 'not_started', exam_countdown: 'no_date',
  });
});
