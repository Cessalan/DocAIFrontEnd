import { SURFACE } from '../../Services/satisfactionEnums';

/**
 * ratingContext — what gets stored alongside a thumbs-up/down on study content.
 *
 * WHY THIS EXISTS
 *
 * A raw sentiment is nearly uninterpretable on its own. "Student disliked this
 * quiz" reads the same whether the questions were wrong or she scored 2/10 and
 * is annoyed at herself — and those two need opposite responses from us. What
 * she scored has to travel with the rating, or the whole signal is noise.
 *
 * Every surface that can be rated reports its results in a different shape:
 * the study path's NodeTransition builds a `result` object whose fields differ
 * per node type (`correct` for quizzes, `mastered` for flashcards, nothing at
 * all for a lesson), while ChatQuizStream's completion screen reports
 * `{ correctCount, totalQuestions }`. Normalising at each call site would put
 * four subtly different context shapes into one collection — exactly the
 * fragmentation SatisfactionService was built to end. So every adapter lives
 * here and they all emit one shape.
 *
 * Each adapter returns `{ surface, context }` rather than context alone. The
 * surface decides which chip set the student is offered, so letting a call site
 * pass it separately would allow a flashcard to be rated with quiz reasons —
 * a mismatch nothing downstream could detect, because both are valid values.
 *
 * DESIGN NOTES
 *
 *  - `scorePercent` is recomputed rather than trusted. NodeTransition already
 *    derives one, but the chat surface has none, and a field present on half
 *    the rows can't be grouped on.
 *
 *  - Counts are clamped, never assumed sane. A rating arriving mid-stream with
 *    total = 0 must not write NaN into a field we later average.
 *
 *  - `bucket` mirrors NodeTransition's thresholds exactly (100 / 70 / 40) so a
 *    complaint can be read against the same tiers the copy on screen used. If
 *    those thresholds move, they move in both places.
 *
 *  - Unscored content (lesson, audio, mindmap) gets `scorePercent: null`, never
 *    a stand-in zero. A lesson has no score, and a zero would sink the average
 *    of every surface it was grouped with.
 *
 *  - No question or card text, ever. The complaint is about the content; the
 *    items themselves add no signal, and `subjectId` already points at the node
 *    that has them.
 */

/** Score tiers, identical to the ones NodeTransition buckets its copy with. */
export const SCORE_BUCKETS = ['tough', 'gaps', 'solid', 'mastered'];

/** Where the rated content was worked through. Closed set — grouping needs it. */
export const RATING_SOURCE = {
  STUDY_NODE: 'study_node',
  CHAT: 'chat'
};

const toCount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/**
 * Bucket a percentage the same way the transition screen does.
 * Returns null for unscorable content rather than guessing at 'tough'.
 */
export const scoreBucket = (scorePercent) => {
  if (typeof scorePercent !== 'number' || Number.isNaN(scorePercent)) return null;
  if (scorePercent >= 100) return 'mastered';
  if (scorePercent >= 70) return 'solid';
  if (scorePercent >= 40) return 'gaps';
  return 'tough';
};

/**
 * The shared output shape. Every adapter funnels through here so the collection
 * only ever sees one set of keys.
 */
const buildContext = ({ source, correct, total, topic, nodeType, scored, locale }) => {
  const safeTotal = toCount(total);
  // A correct count above the total is a bug upstream, not a perfect score.
  const safeCorrect = Math.min(toCount(correct), safeTotal);
  const scorePercent = scored && safeTotal > 0
    ? Math.round((safeCorrect / safeTotal) * 100)
    : null;

  return {
    source,
    scored: !!scored,
    correct: scored ? safeCorrect : null,
    total: scored ? safeTotal : null,
    scorePercent,
    bucket: scoreBucket(scorePercent),
    topic: topic || null,
    nodeType: nodeType || null,
    locale: locale || null
  };
};

/**
 * Adapter for the study path's post-node screen — every node type.
 *
 * Takes NodeTransition's own `result` memo and routes on its type, so the
 * caller never has to decide which surface a node belongs to:
 *
 *   quiz / exam        → SURFACE.QUIZ,        scored on correct answers
 *   flashcard          → SURFACE.FLASHCARD,   scored on cards mastered
 *   lesson / audio /
 *   mindmap / anything → SURFACE.STUDY_BLOCK, unscored
 *
 * Flashcards deliberately do NOT reuse the quiz shape: `mastered` is a
 * self-report ("got it"), not a marked answer, and averaging the two together
 * would produce a number that means neither.
 *
 * @param {Object} result  NodeTransition's result.
 * @param {Object} [options] { locale }
 * @returns {{surface: string, context: Object}|null}
 */
export const ratingFromNodeResult = (result, { locale } = {}) => {
  if (!result) return null;

  const type = result.type;

  if (result.scored && (type === 'quiz' || type === 'exam')) {
    return {
      surface: SURFACE.QUIZ,
      context: buildContext({
        source: RATING_SOURCE.STUDY_NODE,
        scored: true,
        correct: result.correct,
        total: result.total,
        topic: result.topic,
        nodeType: type,
        locale
      })
    };
  }

  if (result.scored && type === 'flashcard') {
    return {
      surface: SURFACE.FLASHCARD,
      context: buildContext({
        source: RATING_SOURCE.STUDY_NODE,
        scored: true,
        correct: result.mastered,
        total: result.total,
        topic: result.topic,
        nodeType: type,
        locale
      })
    };
  }

  // Lessons, audio, mindmaps — and any node type added later. There is nothing
  // to score, but "was that worth my time?" is still answerable, and these are
  // the majority of nodes a student completes.
  return {
    surface: SURFACE.STUDY_BLOCK,
    context: buildContext({
      source: RATING_SOURCE.STUDY_NODE,
      scored: false,
      topic: result.topic,
      nodeType: type || null,
      locale
    })
  };
};

/**
 * Adapter for the in-chat quiz completion screen.
 *
 * @param {Object} completion  { correctCount, totalQuestions, topic }
 * @param {Object} [options]   { locale }
 * @returns {{surface: string, context: Object}|null}
 */
export const ratingFromChatQuiz = (completion, { locale } = {}) => {
  if (!completion) return null;

  return {
    surface: SURFACE.QUIZ,
    context: buildContext({
      source: RATING_SOURCE.CHAT,
      scored: true,
      correct: completion.correctCount,
      total: completion.totalQuestions,
      topic: completion.topic,
      nodeType: 'quiz',
      locale
    })
  };
};
