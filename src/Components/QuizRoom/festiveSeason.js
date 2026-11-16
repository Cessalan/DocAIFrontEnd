/**
 * When Pip wears the Christmas hat: 15 November through 6 January.
 *
 * Derived from the date on each render, never stored, so the hat comes off
 * by itself and nobody has to remember to ship a "remove the hat" change in
 * January.
 */
export const isFestiveSeason = (date = new Date()) => {
  const month = date.getMonth(); // 0 = January
  const day = date.getDate();
  if (month === 11) return true;
  if (month === 10) return day >= 15;
  if (month === 0) return day <= 6;
  return false;
};
