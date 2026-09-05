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
  APP: "app",
  /* Asked once, after the exam is over: did the prep hold up? This is the only
     surface that rates US rather than a piece of content, and the only one
     whose answer we cannot get any other way — nothing in the app knows what
     happened in the exam room. */
  EXAM_DEBRIEF: "exam_debrief"
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

/**
 * How prepared the student felt walking into the exam, as an ordinal 4..1.
 *
 * Kept alongside — not instead of — the -1/0/+1 sentiment. Sentiment is what
 * makes this comparable with every other surface's thumbs; the ordinal is the
 * measure that actually matters here, because the interesting movement is
 * between "mostly" and "well prepared", and a binary throws that away.
 */
export const PREPAREDNESS = {
  WELL: 4,
  MOSTLY: 3,
  SOMEWHAT_UNPREPARED: 2,
  NOT_ENOUGH: 1
};
