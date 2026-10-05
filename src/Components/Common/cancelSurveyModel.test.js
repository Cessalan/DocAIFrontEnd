import {
  CANCEL_REASONS,
  CHURN_KIND,
  asksOutcome,
  buildCancelSignal,
  churnKindFor,
  examDaysFromNow,
  proTenureDays,
  sentimentFor
} from './cancelSurveyModel';

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 30, 12);

describe('cancelSurveyModel', () => {
  test('every reason has a churn kind', () => {
    CANCEL_REASONS.forEach((r) => {
      expect(Object.values(CHURN_KIND)).toContain(r.kind);
    });
  });

  test('exam done is natural churn, product reasons are failures', () => {
    expect(churnKindFor('exam_done')).toBe(CHURN_KIND.NATURAL);
    expect(churnKindFor('not_helping')).toBe(CHURN_KIND.FAILURE);
    expect(churnKindFor('questions_mismatch')).toBe(CHURN_KIND.FAILURE);
    expect(churnKindFor('switched')).toBe(CHURN_KIND.FAILURE);
    expect(churnKindFor('too_expensive')).toBe(CHURN_KIND.CIRCUMSTANCE);
    expect(churnKindFor('nonsense')).toBeNull();
  });

  test('only exam done asks how it went', () => {
    expect(asksOutcome('exam_done')).toBe(true);
    expect(asksOutcome('other')).toBe(false);
  });

  test('sentiment is derived from the answers', () => {
    expect(sentimentFor('exam_done', 'passed')).toBe(1);
    expect(sentimentFor('exam_done', 'not_passed')).toBe(0);
    expect(sentimentFor('exam_done')).toBe(0);
    expect(sentimentFor('not_helping')).toBe(-1);
    expect(sentimentFor('too_expensive')).toBe(0);
    expect(sentimentFor(null)).toBeNull();
  });

  test('exam days are signed', () => {
    expect(examDaysFromNow(new Date(NOW + 3 * DAY).toISOString(), NOW)).toBe(3);
    expect(examDaysFromNow(new Date(NOW - 5 * DAY).toISOString(), NOW)).toBe(-5);
    expect(examDaysFromNow(null, NOW)).toBeNull();
    expect(examDaysFromNow('not a date', NOW)).toBeNull();
  });

  test('tenure accepts Firestore timestamps', () => {
    const ts = { toDate: () => new Date(NOW - 10 * DAY) };
    expect(proTenureDays(ts, NOW)).toBe(10);
    expect(proTenureDays(null, NOW)).toBeNull();
  });

  test('an outcome is dropped when the reason stops asking for it', () => {
    const row = buildCancelSignal({ reasonId: 'too_expensive', outcome: 'passed', now: NOW });
    expect(row.context.examOutcome).toBeNull();
    expect(row.sentiment).toBe(0);
  });

  test('detail is kept only for reasons that ask for it', () => {
    expect(buildCancelSignal({ reasonId: 'switched', detail: ' UWorld ', now: NOW }).context.reasonDetail)
      .toBe('UWorld');
    expect(buildCancelSignal({ reasonId: 'not_helping', detail: 'stale', now: NOW }).context.reasonDetail)
      .toBeNull();
  });

  test('the stay note becomes the comment and the reason is an array', () => {
    const row = buildCancelSignal({
      reasonId: 'exam_done', outcome: 'passed', stayNote: '  NCLEX prep after my course ', now: NOW
    });
    expect(row.reasons).toEqual(['exam_done']);
    expect(row.comment).toBe('NCLEX prep after my course');
    expect(row.sentiment).toBe(1);
    expect(row.context.churnKind).toBe('natural');
    expect(row.context.continuedToPortal).toBe(false);
  });
});
