/**
 * walkthroughModel — the order and the marking of a "Show me how" walkthrough.
 *
 * WHY THIS EXISTS
 *
 * The walkthrough teaches one method for select-all questions (one fact, one
 * test question, every option alone) on the question she just missed, in
 * three stages: the tutor demonstrates one option (watch), she does the next
 * with a hint (together), then the rest alone (your turn).
 *
 * The options are walked TOP TO BOTTOM, A first. That order is the method
 * itself: on the exam she should judge A, then B, then C, each on its own.
 * An earlier version demonstrated on an option she got right and then jumped
 * to her mistakes; to her it looked random, and it modelled skipping around
 * the list (owner, 2026-10-10). Nothing is given away by demonstrating on a
 * mistake, because the card has already revealed every answer by the time
 * the walkthrough opens. Her mistakes are still named as she reaches them.
 *
 * Marking compares her tap with the STORED answer key, never with anything a
 * model wrote, so a tap is marked instantly and cannot be marked wrongly.
 */

export const STAGE = Object.freeze({ WATCH: 'watch', TOGETHER: 'together', YOURS: 'yours' });

/**
 * @param {number} optionCount
 * @param {number[]} correctIndices  the answer key
 * @param {number[]} selectedIndices what she picked
 * @returns {{ order: number[], missed: number[] }} top to bottom; order[0] is
 *   demonstrated, `missed` lists the options she judged wrong
 */
export const planWalkthrough = (optionCount, correctIndices = [], selectedIndices = []) => {
  const key = new Set(correctIndices);
  const picked = new Set(selectedIndices);
  const order = Array.from({ length: Math.max(0, optionCount) }, (_, i) => i);
  const missed = order.filter((i) => key.has(i) !== picked.has(i));
  return { order, missed };
};

/** Which stage the step at `position` in the order belongs to. */
export const stageAt = (position) =>
  position <= 0 ? STAGE.WATCH : position === 1 ? STAGE.TOGETHER : STAGE.YOURS;

/** Is her yes/no on option `index` right, by the answer key? */
export const isRightCall = (index, saidYes, correctIndices = []) =>
  correctIndices.includes(index) === Boolean(saidYes);

/** "A) Check the pulse" and "Check the pulse" are the same option. */
const bare = (text) => String(text || '').replace(/^[A-Ha-h][).:-]\s*/, '').trim().toLowerCase();

/** Option texts to indices, the way the select-all card stores answers.
 *  Matches with or without the "A)" prefix, since stored keys vary. */
export const toIndices = (options = [], texts = []) =>
  [...new Set((Array.isArray(texts) ? texts : [texts])
    .map((text) => {
      const exact = options.indexOf(text);
      return exact >= 0 ? exact : options.findIndex((o) => bare(o) === bare(text));
    })
    .filter((i) => i >= 0))];

/* ── First-time discovery ─────────────────────────────────────────────
   A "Show me how" button inside the feedback box was easy to miss, so the
   first AUTO_OPEN_TIMES misses on a device open the walkthrough on their
   own; after that it waits for the button. Device-level on purpose: this is
   a discovery nudge, not a record anyone needs to read back. Storage can be
   unavailable (private windows), in which case it never auto-opens rather
   than auto-opening every time. */
export const AUTO_OPEN_TIMES = 2;
const AUTO_OPEN_KEY = 'nqWalkthroughAutoOpened';

export const shouldAutoOpen = (storage = typeof window !== 'undefined' ? window.localStorage : null) => {
  try {
    return Number(storage?.getItem(AUTO_OPEN_KEY) || 0) < AUTO_OPEN_TIMES && !!storage;
  } catch {
    return false;
  }
};

export const recordAutoOpen = (storage = typeof window !== 'undefined' ? window.localStorage : null) => {
  try {
    storage?.setItem(AUTO_OPEN_KEY, String(Number(storage.getItem(AUTO_OPEN_KEY) || 0) + 1));
  } catch { /* discovery nudge only */ }
};
