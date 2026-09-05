import { EXAM_DATE_CHOICES, resolveExamDate, startOfToday } from './examDateChoices';

const daysBetween = (a, b) => Math.round((b - a) / 86400000);

describe('resolveExamDate', () => {
  it('resolves every offered choice', () => {
    EXAM_DATE_CHOICES.forEach((choice) => {
      const resolved = resolveExamDate(choice.key);
      expect(resolved).not.toBeNull();
      expect(resolved.daysAway).toBe(choice.daysAway);
      expect(daysBetween(startOfToday(), resolved.date)).toBe(choice.daysAway);
    });
  });

  it('lands "today" on today, not on a timestamp hours from now', () => {
    // The countdown renders whole days, so an exam "today" must be midnight
    // today — a now() would make calendarDaysBetween round to tomorrow after
    // lunch, and the student would be told she has a day she does not have.
    const { date } = resolveExamDate('today');
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(daysBetween(startOfToday(), date)).toBe(0);
  });

  it('accepts an explicit calendar date', () => {
    const target = new Date(startOfToday());
    target.setDate(target.getDate() + 12);
    const iso = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;

    const resolved = resolveExamDate('custom', iso);
    expect(resolved.daysAway).toBe(12);
  });

  it('clamps a date that has already passed instead of counting backwards', () => {
    const past = new Date(startOfToday());
    past.setDate(past.getDate() - 30);
    const iso = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;

    expect(resolveExamDate('custom', iso).daysAway).toBe(0);
  });

  it('returns null rather than guessing at unusable input', () => {
    expect(resolveExamDate('someday')).toBeNull();
    expect(resolveExamDate('custom')).toBeNull();
    expect(resolveExamDate('custom', 'not-a-date')).toBeNull();
    expect(resolveExamDate(undefined)).toBeNull();
  });
});
