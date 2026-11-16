import { isFestiveSeason } from './festiveSeason';

const on = (y, m, d) => isFestiveSeason(new Date(y, m - 1, d));

describe('isFestiveSeason', () => {
  it('starts on 15 November', () => {
    expect(on(2026, 11, 14)).toBe(false);
    expect(on(2026, 11, 15)).toBe(true);
  });

  it('covers all of December', () => {
    expect(on(2026, 12, 1)).toBe(true);
    expect(on(2026, 12, 31)).toBe(true);
  });

  it('ends after 6 January', () => {
    expect(on(2027, 1, 6)).toBe(true);
    expect(on(2027, 1, 7)).toBe(false);
  });

  it('is off the rest of the year', () => {
    expect(on(2026, 7, 4)).toBe(false);
    expect(on(2026, 10, 31)).toBe(false);
  });
});
