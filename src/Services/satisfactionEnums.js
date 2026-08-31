/**
 * satisfactionEnums — the closed value sets for satisfaction signals.
 *
 * WHY THIS IS SEPARATE FROM SatisfactionService
 *
 * These constants are needed by pure derivation modules (`ratingContext`) and
 * by components, but `SatisfactionService` imports Firebase at module scope.
 * Importing the service just to read an enum drags Firebase initialisation into
 * every test that touches those modules — which defeats the point of keeping
 * the derivation logic pure and cheap to run.
 *
 * `SatisfactionService` re-exports both, so existing imports from there keep
 * working and there is still only one place these are defined.
 */

/** Where the signal was captured. Kept as a closed set so grouping stays sane. */
export const SURFACE = {
  CHAT_ANSWER: "chat_answer",
  QUIZ: "quiz",
  FLASHCARD: "flashcard",
  STUDY_BLOCK: "study_block",
  APP: "app"
};

/**
 * Sentiment is -1 / 0 / +1, not 'bad' / 'neutral' / 'good'. Numbers average;
 * strings don't.
 */
export const SENTIMENT = {
  NEGATIVE: -1,
  NEUTRAL: 0,
  POSITIVE: 1
};
