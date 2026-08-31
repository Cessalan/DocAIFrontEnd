import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { rateContent, SENTIMENT, SURFACE } from '../../Services/SatisfactionService';
import ShareFeedbackModal from './ShareFeedbackModal';
import './ContentRating.css';

/**
 * ContentRating - "was that worth your time?", asked once, at the end.
 *
 * WHY THIS EXISTS
 *
 * The quiz used to carry a popover in the nav footer (QuizFeedback), which
 * asked mid-quiz, had to be discovered by hovering a rail most students never
 * looked at, allowed exactly one reason from three emoji, and wrote to a
 * `feedbackData` field on the message that nothing mounted ever read. Content
 * quality was therefore the least measured thing in the app, despite being
 * what students actually complain about.
 *
 * This asks at the one moment the question is answerable: after the content is
 * finished, when she knows how it went and hasn't yet moved on.
 *
 * DESIGN NOTES
 *
 *  - Same interaction contract as MessageRating, deliberately: thumbs-up is one
 *    tap and done; thumbs-down records the negative IMMEDIATELY and then opens
 *    the modal, so a closed modal still leaves a counted signal. Two rating
 *    widgets in one app that behave differently would teach students to
 *    distrust both.
 *
 *  - The score rides along in `context` rather than being inferred later. A
 *    thumbs-down at 9/10 is a complaint about the questions; the same tap at
 *    2/10 is usually frustration at the result. Aggregated without the score
 *    they cancel out into a number that means nothing.
 *
 *  - Prompt and chips are chosen from `surface`, not passed in. Letting the
 *    caller supply them separately would allow a flashcard to be rated with
 *    quiz reasons - a mismatch nothing downstream could detect, because both
 *    are valid values. ratingContext's adapters pick the surface, so the two
 *    are decided in one place from the node itself.
 *
 *  - Every surface gets its own chips because the failure modes do not
 *    transfer. "Too long" is not a quiz complaint; "wrong answer marked
 *    correct" is meaningless for a lesson. A student whose complaint has no
 *    matching chip picks whichever sits closest, and that is worse than no
 *    reason at all, because it still looks like data.
 *
 *  - Rendered inline in the end screen, not hover-revealed. The old popover's
 *    collection rate is the evidence for that.
 *
 * @param {string}   surface    One of SURFACE - picks the prompt and chips.
 * @param {string}   chatId
 * @param {string}   subjectId  Node id (study path) or message id (chat).
 * @param {Object}   context    From ratingContext's adapters.
 * @param {string}   [className]
 * @param {Function} [onRated]  (sentiment) => void, for the caller's own state.
 */

// Slugs are stored; labels are translated at render. Each one points somewhere
// actionable: `wrong_answer` at the generator's answer key, `not_in_my_material`
// at RAG retrieval (the failure that previously had no way to be reported at
// all), `too_easy`/`too_hard` at difficulty calibration.
export const QUIZ_FEEDBACK_REASONS = [
  { id: 'wrong_answer', key: 'contentRating.reasonWrongAnswer', fallback: 'Wrong answer marked correct' },
  { id: 'not_in_my_material', key: 'contentRating.reasonNotInMaterial', fallback: 'Not from my material' },
  { id: 'bad_explanation', key: 'contentRating.reasonBadExplanation', fallback: "Explanation didn't help" },
  { id: 'confusing_wording', key: 'contentRating.reasonConfusingWording', fallback: 'Confusing wording' },
  { id: 'too_hard', key: 'contentRating.reasonTooHard', fallback: 'Too hard' },
  { id: 'too_easy', key: 'contentRating.reasonTooEasy', fallback: 'Too easy' },
  { id: 'not_exam_style', key: 'contentRating.reasonNotExamStyle', fallback: 'Not NCLEX-style' },
  { id: 'other', key: 'contentRating.reasonOther', fallback: 'Other' }
];

// A card is rated on its two sides, so its failures are about the split: a
// front that gives the answer away, a back that is a paragraph instead of a
// fact. Nothing here is about being marked wrong, because nothing marks it.
export const FLASHCARD_FEEDBACK_REASONS = [
  { id: 'wrong_answer', key: 'contentRating.reasonCardWrong', fallback: 'The answer looks wrong' },
  { id: 'not_in_my_material', key: 'contentRating.reasonNotInMaterial', fallback: 'Not from my material' },
  { id: 'too_wordy', key: 'contentRating.reasonCardWordy', fallback: 'Too much text on the card' },
  { id: 'confusing_wording', key: 'contentRating.reasonConfusingWording', fallback: 'Confusing wording' },
  { id: 'too_easy', key: 'contentRating.reasonTooEasy', fallback: 'Too easy' },
  { id: 'repetitive', key: 'contentRating.reasonRepetitive', fallback: 'Repetitive cards' },
  { id: 'other', key: 'contentRating.reasonOther', fallback: 'Other' }
];

// Lessons, audio and mindmaps. `not_in_my_material` and `nothing_new` are the
// two that route somewhere: the first at retrieval, the second at a planner
// that keeps re-teaching what she already knows - the complaint most likely to
// be sitting behind an abandoned plan.
export const STUDY_BLOCK_FEEDBACK_REASONS = [
  { id: 'nothing_new', key: 'contentRating.reasonNothingNew', fallback: "Didn't teach me anything new" },
  { id: 'not_in_my_material', key: 'contentRating.reasonNotInMaterial', fallback: 'Not from my material' },
  { id: 'too_shallow', key: 'contentRating.reasonTooShallow', fallback: 'Too shallow' },
  { id: 'confusing_wording', key: 'contentRating.reasonConfusingWording', fallback: 'Confusing explanation' },
  { id: 'too_long', key: 'contentRating.reasonTooLong', fallback: 'Too long' },
  { id: 'not_exam_style', key: 'contentRating.reasonNotExamStyle', fallback: 'Not NCLEX-style' },
  { id: 'other', key: 'contentRating.reasonOther', fallback: 'Other' }
];

/* Surface decides what the student is asked and what they can say back. Quiz is
   the fallback for an unrecognised surface rather than an error: a missing
   entry should cost the right chips, never the whole rating. */
const BY_SURFACE = {
  [SURFACE.QUIZ]: {
    reasons: QUIZ_FEEDBACK_REASONS,
    promptKey: 'contentRating.promptQuiz',
    promptFallback: 'Was this quiz useful?',
    modalKey: 'contentRating.modalTitleQuiz',
    modalFallback: 'What was wrong with this quiz?'
  },
  [SURFACE.FLASHCARD]: {
    reasons: FLASHCARD_FEEDBACK_REASONS,
    promptKey: 'contentRating.promptFlashcard',
    promptFallback: 'Were these cards useful?',
    modalKey: 'contentRating.modalTitleFlashcard',
    modalFallback: 'What was wrong with these cards?'
  },
  [SURFACE.STUDY_BLOCK]: {
    reasons: STUDY_BLOCK_FEEDBACK_REASONS,
    promptKey: 'contentRating.promptBlock',
    promptFallback: 'Was this useful?',
    modalKey: 'contentRating.modalTitleBlock',
    modalFallback: 'What was wrong with this?'
  }
};

const THANKS_MS = 2600;

function ThumbUpIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <path d="M7 10l4.2-7.4a1 1 0 0 1 1.8.2l.3 1a4 4 0 0 1-.2 2.8L12 9h5.6a2 2 0 0 1 2 2.5l-1.7 7A2 2 0 0 1 16 20H7" />
    </svg>
  );
}

function ThumbDownIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1z" />
      <path d="M17 14l-4.2 7.4a1 1 0 0 1-1.8-.2l-.3-1a4 4 0 0 1 .2-2.8L12 15H6.4a2 2 0 0 1-2-2.5l1.7-7A2 2 0 0 1 8 4h9" />
    </svg>
  );
}

const ContentRating = ({
  surface = SURFACE.QUIZ,
  chatId,
  subjectId,
  context,
  className = '',
  onRated
}) => {
  const { t, i18n } = useTranslation();

  const copy = BY_SURFACE[surface] || BY_SURFACE[SURFACE.QUIZ];

  const [sentiment, setSentiment] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [thanks, setThanks] = useState(false);

  // Refs, not state: the modal can be submitted before the thumb's write has
  // come back. A stale closure over a state value would send signalId: null and
  // insert a SECOND row — the double-count the refine pass exists to avoid.
  const signalRef = useRef(null);
  const pendingRef = useRef(null);
  const thanksTimer = useRef(null);

  useEffect(() => () => clearTimeout(thanksTimer.current), []);

  const showThanks = useCallback(() => {
    setThanks(true);
    clearTimeout(thanksTimer.current);
    thanksTimer.current = setTimeout(() => setThanks(false), THANKS_MS);
  }, []);

  const handleThumb = useCallback(async (value) => {
    const isNegative = value === SENTIMENT.NEGATIVE;

    // Re-tapping the active thumb is not an un-rate. The signal is already
    // counted, and deleting it would make the measurement depend on tap parity.
    // A repeat 👎 reopens the modal, so a student who closed it by accident can
    // still say what went wrong.
    if (sentiment === value) {
      if (isNegative) setModalOpen(true);
      return;
    }

    setSentiment(value);
    if (isNegative) setModalOpen(true);
    else showThanks();

    if (onRated) onRated(value);

    signalRef.current = null;
    const pending = rateContent({
      surface,
      chatId,
      subjectId,
      sentiment: value,
      context: { ...(context || {}), locale: i18n.language }
    });
    pendingRef.current = pending;

    const result = await pending;
    if (result?.signalId) signalRef.current = result.signalId;
  }, [sentiment, surface, chatId, subjectId, context, onRated, showThanks, i18n.language]);

  const handleDetails = useCallback(async ({ reasons, comment }) => {
    showThanks();

    // Settle the thumb's write first if it hasn't landed, so this refines that
    // row rather than racing it. If it failed outright signalRef stays null and
    // this inserts instead — a duplicate row beats a lost report.
    if (!signalRef.current && pendingRef.current) {
      const first = await pendingRef.current;
      if (first?.signalId) signalRef.current = first.signalId;
    }

    await rateContent({
      surface,
      chatId,
      subjectId,
      sentiment: SENTIMENT.NEGATIVE,
      context: { ...(context || {}), locale: i18n.language },
      reasons,
      comment,
      signalId: signalRef.current
    });
  }, [surface, chatId, subjectId, context, showThanks, i18n.language]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const isPositive = sentiment === SENTIMENT.POSITIVE;
  const isNegative = sentiment === SENTIMENT.NEGATIVE;

  return (
    <>
      <div className={`content-rating ${className}`.trim()}>
        <span className="content-rating__prompt">
          {thanks
            ? t('contentRating.thanks', 'Thanks — noted')
            : t(copy.promptKey, copy.promptFallback)}
        </span>

        <div className="content-rating__buttons" role="group" aria-label={t('contentRating.groupAria', 'Rate this content')}>
          <button
            type="button"
            className={`content-rating__btn ${isPositive ? 'is-active is-positive' : ''}`}
            onClick={() => handleThumb(SENTIMENT.POSITIVE)}
            aria-pressed={isPositive}
            aria-label={t('contentRating.helpfulAria', 'This was useful')}
            title={t('contentRating.helpful', 'Useful')}
          >
            <ThumbUpIcon filled={isPositive} />
          </button>

          <button
            type="button"
            className={`content-rating__btn ${isNegative ? 'is-active is-negative' : ''}`}
            onClick={() => handleThumb(SENTIMENT.NEGATIVE)}
            aria-pressed={isNegative}
            aria-label={t('contentRating.notHelpfulAria', 'This was not useful')}
            title={t('contentRating.notHelpful', 'Not useful')}
          >
            <ThumbDownIcon filled={isNegative} />
          </button>
        </div>
      </div>

      <ShareFeedbackModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSubmit={handleDetails}
        reasons={copy.reasons}
        title={t(copy.modalKey, copy.modalFallback)}
      />
    </>
  );
};

export default ContentRating;
