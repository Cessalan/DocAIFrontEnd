/**
 * sataFeedbackModel — what the select-all card says after an answer, kept calm.
 *
 * WHY THIS EXISTS
 *
 * The feedback after a select-all answer had five things competing for the
 * eye: a tinted box, three coloured count pills, a scrolling explanation
 * inside the box, and two filled buttons (owner, 2026-10-10). It now says the
 * result in one sentence that names the letters ("You picked one extra: D"),
 * and shows the explanation as a one-line lead that expands. These two
 * derivations are the only logic in that; they live here so they are tested.
 */

const LETTERS = 'ABCDEFGH';

/** Option texts → their letters, in option order. */
export const lettersOf = (options = [], texts = []) => {
  const bare = (s) => String(s || '').replace(/^[A-Ha-h][).:-]\s*/, '').trim().toLowerCase();
  return options
    .map((option, i) => (texts.some((t) => t === option || bare(t) === bare(option)) ? LETTERS[i] : null))
    .filter(Boolean);
};

/**
 * The detail half of the verdict sentence: which letters were extra, which
 * were missed. Returns { key, values } for i18n, or null when fully right.
 */
export const verdictDetail = (options, breakdown) => {
  const extra = lettersOf(options, breakdown?.incorrectSelections || []);
  const missed = lettersOf(options, breakdown?.missedCorrect || []);
  const list = (l) => l.join(', ');
  if (extra.length && missed.length) {
    return { key: 'sata.verdict.both', values: { extra: list(extra), missed: list(missed) } };
  }
  if (extra.length) return { key: 'sata.verdict.extra', values: { letters: list(extra), count: extra.length } };
  if (missed.length) return { key: 'sata.verdict.missed', values: { letters: list(missed), count: missed.length } };
  return null;
};

/** Longest lead shown before "Full explanation". */
export const LEAD_MAX = 170;

/**
 * The first sentence or two of the explanation, as plain text, for the
 * collapsed view. Whole sentences only, so the lead never stops mid-thought
 * unless a single sentence is longer than LEAD_MAX.
 */
export const explanationLead = (html) => {
  // Only the first paragraph: it says why the right options are right. The
  // per-option "B is incorrect because…" lines after the first blank line are
  // the detail behind "Full explanation".
  const firstParagraph = String(html || '').split(/(?:<br\s*\/?>\s*){2,}|\n\s*\n/i)[0];
  const text = firstParagraph
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  let lead = '';
  for (const sentence of sentences) {
    if ((lead + sentence).trim().length > LEAD_MAX) break;
    lead += sentence;
  }
  lead = lead.trim();
  if (lead) return lead;
  return `${text.slice(0, LEAD_MAX - 1).replace(/\s+\S*$/, '')}…`;
};
