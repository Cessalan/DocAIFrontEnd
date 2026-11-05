/**
 * missEvidence — what she got wrong in a finished quiz, and what she chose.
 *
 * The adaptive plan (ADAPTIVE_PLAN_IMPLEMENTATION.md) builds a "mix-up"
 * lesson from the answer she actually picked: "You chose fluid restriction."
 * The container's `firstAttemptAnswers[i].selection` kept single-answer picks
 * but saved null for select-all, which stores option texts; from 2026-11-01
 * the card also records `firstAttemptChoices` for every format. `firstChoices`
 * reads both, so quizzes begun before the release still give evidence.
 *
 * One row per first-attempt miss, in question order, capped so a history row
 * stays small. `chosen` is the option TEXT, because the option order of a
 * saved quiz is not guaranteed to survive regeneration and the text is what
 * the next step quotes. It is null when she pressed "I don't know" or the
 * choice was not recorded (quizzes answered before this shipped): an absent
 * choice is never guessed.
 *
 * Pure: the transition screen calls it, nothing here touches Firestore.
 */

/** Most misses kept per step. Matches the `missed` cap in appendStudyHistory. */
export const MISS_CAP = 5;

/** Longest option text kept. Enough to quote, short enough for an array row. */
export const CHOICE_MAX = 160;

const optionIndex = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[A-Fa-f]$/.test(value.trim())) {
    return value.trim().toUpperCase().charCodeAt(0) - 65;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return parseInt(value, 10);
  return -1;
};

const LABEL = /^\s*[A-Fa-f][.)]\s+/;
const sameOption = (a, b) => a.replace(LABEL, '').trim().toLowerCase() === b.replace(LABEL, '').trim().toLowerCase();

const optionText = (question, value) => {
  const options = Array.isArray(question?.options) ? question.options : [];
  // Select-all records the option texts themselves, not their positions.
  let index = optionIndex(value);
  if (index < 0 && typeof value === 'string' && value.trim()) {
    index = options.findIndex(option => typeof option === 'string' && sameOption(option, value));
  }
  const text = index >= 0 ? options[index] : null;
  if (typeof text !== 'string' || !text.trim()) return null;
  // Saved options often carry their letter ("B) Apply…"); she chose the words.
  const clean = text.replace(LABEL, '').trim() || text.trim();
  return clean.length > CHOICE_MAX ? `${clean.slice(0, CHOICE_MAX - 1)}…` : clean;
};

/** The choice as text: a string for one answer, an array for select-all. */
const chosenText = (question, choice) => {
  if (choice === null || choice === undefined || choice === -1) return null;
  if (Array.isArray(choice)) {
    const picked = choice.map(value => optionText(question, value)).filter(Boolean);
    return picked.length ? picked : null;
  }
  return optionText(question, choice);
};

/**
 * Her first-attempt choices from saved quiz progress. `firstAttemptChoices`
 * (2026-11-01) wins; before it, `firstAttemptAnswers[i].selection` already
 * kept single-answer picks (select-all saved null there), so a quiz started
 * before the release still yields evidence instead of none.
 */
export const firstChoices = (progress) => {
  const legacy = {};
  Object.entries(progress?.firstAttemptAnswers || {}).forEach(([index, answer]) => {
    const selection = answer?.selection;
    if (typeof selection === 'number' || (Array.isArray(selection) && selection.length)) legacy[index] = selection;
  });
  return { ...legacy, ...(progress?.firstAttemptChoices || {}) };
};

/**
 * @param {Array} questions        The quiz's questions, in saved order.
 * @param {Object} statuses        First-attempt statuses by question index.
 * @param {Object} [choices]       First-attempt choices by question index.
 * @returns {Array<{ index, concept, format, chosen }>}
 */
export const collectMisses = (questions = [], statuses = {}, choices = {}) => {
  if (!Array.isArray(questions) || !statuses) return [];
  return Object.keys(statuses)
    .map(key => parseInt(key, 10))
    .filter(index => Number.isInteger(index) && statuses[index] === 'incorrect' && questions[index])
    .sort((a, b) => a - b)
    .slice(0, MISS_CAP)
    .map(index => {
      const question = questions[index];
      return {
        index,
        concept: typeof question.concept === 'string' && question.concept.trim() ? question.concept.trim() : null,
        format: question.questionType || question.metadata?.questionType || 'mcq',
        chosen: chosenText(question, choices?.[index]),
      };
    });
};

export default collectMisses;
