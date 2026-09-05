/**
 * flashcardText — turn whatever arrived into something safe to render.
 *
 * WHY THIS EXISTS
 * ───────────────
 * `formatFlashcardText` guarded its input with `if (!text) return null` and
 * then called `text.split('\n')`. That guard only catches falsy values, so any
 * truthy non-string — a list of bullet points, a wrapper object — reached
 * `.split` and threw `text.split is not a function`, which React escalated
 * into a full unmounted-app error screen. One malformed card took down the
 * whole chat.
 *
 * The card content is LLM-generated and the contract is not enforced anywhere:
 * the backend stores `fc.get("back", "")` exactly as the model returned it, so
 * "back is a string" is a hope, not a guarantee. The renderer is the last place
 * that can be defensive, so it is defensive here.
 *
 * NEVER "[object Object]"
 * ──────────────────────
 * An unrecognised shape returns an empty string, not a stringified object. A
 * student reading "[object Object]" on the answer side of a flashcard is worse
 * off than one reading nothing: the blank card is obviously broken, the
 * stringified one looks like content she failed to understand. Same rule the
 * concept ledger states — skip what we cannot trust rather than dressing it up.
 */

/** Keys the generator has been seen to wrap the real text in. */
const TEXT_KEYS = ['text', 'content', 'answer', 'back', 'front', 'value'];

/** Arrays of arrays are conceivable; infinite nesting is not worth chasing. */
const MAX_DEPTH = 3;

/**
 * @param {*} value  Anything the generator produced.
 * @returns {string} Renderable text, or '' when there is nothing trustworthy.
 */
export const toDisplayText = (value, depth = 0) => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (depth >= MAX_DEPTH) return '';

  // A list of lines is the most common non-string the model returns, and it
  // maps cleanly onto the newline handling the formatter already does.
  if (Array.isArray(value)) {
    return value
      .map((item) => toDisplayText(item, depth + 1))
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    for (const key of TEXT_KEYS) {
      const nested = toDisplayText(value[key], depth + 1);
      if (nested) return nested;
    }
  }

  return '';
};
