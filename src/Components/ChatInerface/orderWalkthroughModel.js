/**
 * orderWalkthroughModel — the pure logic behind "Who first?", the walkthrough
 * on a missed ordering (case-study) question.
 *
 * WHY THIS EXISTS
 *
 * Prioritization drills are ordering questions, and the card only ever showed
 * the right order beside hers. One student ran 11 prioritization drills at
 * 33-67% with no trend (2026-09-26): seeing the answer does not teach the
 * ladder that produces it. Real misses (2026-10-10) also showed WHERE it goes
 * wrong: number 1 is usually right and number 2 breaks (an EKG before oxygen,
 * an interpreter before a quiet room). So the tutor places number 1 (watch),
 * number 2 is done together, and the rest are hers; the last one places
 * itself, because choosing from one is not a choice.
 *
 * Marking compares her tap with the STORED order, never with anything a model
 * wrote, so a tap cannot be marked wrongly. The words come from
 * NQBackEnd2/services/order_walkthrough.py, already checked there against the
 * key (and withheld when the model would not defend it).
 *
 * CROSS-REPO CONTRACT: LADDER_RUNGS and RULES mirror LADDERS and RULES in
 * order_walkthrough.py. The backend owns the ids and rung counts, this side
 * the words (i18n `orderWalkthrough.ladder.*`, `orderWalkthrough.rule.*`).
 * A ladder or rule this side does not know makes the walkthrough unavailable
 * rather than half-rendered.
 */

export const STAGE = Object.freeze({ WATCH: 'watch', TOGETHER: 'together', YOURS: 'yours' });

export const LADDER_RUNGS = Object.freeze({
  abc: ['airway', 'breathing', 'circulation', 'safety', 'comfort', 'teaching'],
  process: ['assess', 'act', 'report', 'record', 'teach'],
  barriers: ['hear', 'focus', 'understand', 'teach', 'check'],
  procedure: ['prepare', 'protect', 'perform', 'confirm', 'record'],
  maslow: ['body', 'safety', 'belonging', 'esteem', 'growth'],
});

export const RULES = Object.freeze([
  'abc', 'maslow', 'assess_first', 'unstable_first', 'acute_first', 'safety_first',
  'barrier_first', 'prepare_first', 'treat_before_record', 'teach_last', 'sequence',
]);

/** Which stage placing slot `position` (0-based) belongs to. */
export const stageAt = (position) =>
  position <= 0 ? STAGE.WATCH : position === 1 ? STAGE.TOGETHER : STAGE.YOURS;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/**
 * The chart notes as plain text, the same string the backend checks quotes
 * against (the card sends exactly this). Block ends become spaces so
 * "…dizziness.</p><p>Nurse…" does not fuse into one word.
 */
export const chartText = (html = '') => String(html || '')
  .replace(/<\/(p|div|li|tr|td|th|h\d)>|<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&(#\d+|[a-z]+);/gi, (m, name) => {
    const key = name.toLowerCase();
    if (ENTITIES[key] !== undefined) return ENTITIES[key];
    if (key.startsWith('#')) return String.fromCharCode(Number(key.slice(1)));
    return m;
  })
  .replace(/\s+/g, ' ')
  .trim();

/** Is the response one this side can render in full? */
export const isUsable = (walkthrough, itemCount) => {
  if (!walkthrough || !Array.isArray(walkthrough.items) || walkthrough.items.length !== itemCount) return false;
  const rungs = LADDER_RUNGS[walkthrough.ladder];
  if (!rungs) return false;
  return walkthrough.items.every((it) => Number.isInteger(it?.rung) && it.rung >= 0 && it.rung < rungs.length
    && RULES.includes(it.rule) && it.label && it.why_here)
    && Array.isArray(walkthrough.first_thinking) && walkthrough.first_thinking.length > 0;
};

/**
 * Her first wrong slot, for the closing "what you did then" line: the first
 * position where her order differs from the key, what she put there, and what
 * belonged there. Null when her order matches (or is missing).
 *
 * @param {string[]} keyIds  the stored correct order, as item ids
 * @param {string[]} herIds  the order she submitted
 */
export const firstSlip = (keyIds = [], herIds = []) => {
  if (!herIds?.length || herIds.length !== keyIds.length) return null;
  const at = keyIds.findIndex((id, i) => herIds[i] !== id);
  if (at < 0) return null;
  return { position: at, hers: herIds[at], right: keyIds[at] };
};

/** Her tap while slot `position` is open: right only if it is the key's item there. */
export const isRightPick = (keyIds, position, id) => keyIds[position] === id;

/**
 * The rung lit on the ladder for the slot being placed, and the rungs already
 * climbed (the rungs of everything placed so far).
 */
export const ladderState = (items, placedCount) => ({
  current: placedCount < items.length ? items[placedCount].rung : null,
  climbed: new Set(items.slice(0, placedCount).map((it) => it.rung)),
});

/* ── First-time discovery ─────────────────────────────────────────────
   As for select-all (walkthroughModel.js): the first misses on a device open
   the walkthrough on their own. A separate counter, so a student who has seen
   the select-all walkthrough still meets this one the first time she misses
   an ordering question. */
export const AUTO_OPEN_TIMES = 2;
const AUTO_OPEN_KEY = 'nqOrderWalkthroughAutoOpened';

export const shouldAutoOpen = (storage = typeof window !== 'undefined' ? window.localStorage : null) => {
  try {
    return !!storage && Number(storage.getItem(AUTO_OPEN_KEY) || 0) < AUTO_OPEN_TIMES;
  } catch {
    return false;
  }
};

export const recordAutoOpen = (storage = typeof window !== 'undefined' ? window.localStorage : null) => {
  try {
    storage?.setItem(AUTO_OPEN_KEY, String(Number(storage.getItem(AUTO_OPEN_KEY) || 0) + 1));
  } catch { /* discovery nudge only */ }
};
