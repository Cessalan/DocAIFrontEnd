import { db, auth } from "../Firebase/config";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { devLog } from "./devLogger";
import { markMessageRated } from "./FireBaseServiceChats";

/**
 * SatisfactionService — one shape for every "how did that feel?" signal.
 *
 * WHY THIS EXISTS
 *
 * Satisfaction was previously recorded in three incompatible places: free text
 * in `feedback/` (the sidebar modal), a rating string buried in
 * `chats/{id}/messages/{id}.feedbackData` (quiz + flashcard), and a
 * `quickFeedback/` collection nothing ever wrote to. No single query could
 * answer "are students happy this week?", because the three shapes had no
 * common field to group on.
 *
 * Every signal now also lands here as one flat row: who, which surface, how
 * they felt, and optionally why. That makes satisfaction countable — by
 * surface, by week, by tier — without touching the per-surface storage the
 * existing UIs already depend on.
 *
 * `reasons` is an ARRAY. A student reporting a wrong answer that is also too
 * long has two complaints, and a single-valued field silently discards one of
 * them. Group with `array-contains` rather than equality.
 *
 * DESIGN NOTES
 *
 *  - Sentiment is -1 / 0 / +1, not 'bad' / 'neutral' / 'good'. Numbers average;
 *    strings don't. The legacy vocabulary maps onto it exactly (see
 *    `sentimentFromLegacyRating`), so historical quiz ratings can be backfilled
 *    into the same funnel rather than stranded.
 *
 *  - Sentiment is written the instant it's tapped, before any reason is picked,
 *    and the caller gets the id back to refine later. A student who taps 👎 and
 *    then ignores the follow-up still leaves a usable data point — which is the
 *    common case, and the one a submit-button design throws away.
 *
 *  - Every write is best-effort and non-fatal, exactly like markMessageEngaged.
 *    Losing a rating is a missing row in an analysis; letting that failure
 *    surface would break the conversation the student is actually having.
 */

/** Where the signal was captured. Kept as a closed set so grouping stays sane. */
export const SURFACE = {
  CHAT_ANSWER: "chat_answer",
  QUIZ: "quiz",
  FLASHCARD: "flashcard",
  STUDY_BLOCK: "study_block",
  APP: "app"
};

export const SENTIMENT = {
  NEGATIVE: -1,
  NEUTRAL: 0,
  POSITIVE: 1
};

const COLLECTION = "satisfactionSignals";

/**
 * Translate the pre-existing quiz/flashcard vocabulary into the numeric scale.
 * Anything unrecognized returns null rather than guessing at neutral — an
 * unparseable rating should be visibly absent, not silently averaged in.
 */
export const sentimentFromLegacyRating = (rating) => {
  switch (rating) {
    case "bad": return SENTIMENT.NEGATIVE;
    case "neutral": return SENTIMENT.NEUTRAL;
    case "good": return SENTIMENT.POSITIVE;
    default: return null;
  }
};

/** Strip undefined values — Firestore rejects them, and optional fields are common here. */
const compact = (obj) => {
  const out = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) out[key] = obj[key];
  });
  return out;
};

/**
 * Write a satisfaction signal, or refine one already written.
 *
 * @param {Object}  params
 * @param {string}  params.surface     One of SURFACE.
 * @param {number}  params.sentiment   One of SENTIMENT.
 * @param {string}  [params.subjectId] What was rated — messageId, nodeId, etc.
 * @param {string}  [params.chatId]    Conversation it happened in, when there is one.
 * @param {string[]} [params.reasons]  Chip slugs, added on the refine pass.
 * @param {string}  [params.comment]   Optional free text — what the chips couldn't say.
 * @param {Object}  [params.context]   Anything worth slicing by later.
 * @param {string}  [params.signalId]  Present on a refine — updates instead of inserting.
 * @returns {Promise<{success: boolean, signalId?: string}>}
 */
export const recordSignal = async ({
  surface,
  sentiment,
  subjectId,
  chatId,
  reasons,
  comment,
  context,
  signalId
} = {}) => {
  if (!surface) return { success: false, reason: "missing-surface" };

  try {
    // Refine pass: the row already exists, only add what's new.
    if (signalId) {
      await updateDoc(
        doc(db, COLLECTION, signalId),
        compact({
          sentiment,
          reasons,
          comment,
          refinedAt: serverTimestamp(),
          updatedAt: new Date()
        })
      );
      return { success: true, signalId };
    }

    // `user` exported from config is a module-load snapshot and is always null;
    // read the live value off auth instead.
    const current = auth.currentUser;

    const created = await addDoc(
      collection(db, COLLECTION),
      compact({
        surface,
        sentiment,
        subjectId: subjectId || null,
        chatId: chatId || null,
        reasons: reasons || [],
        comment: comment || null,
        userId: current?.uid || null,
        userEmail: current?.email || null,
        context: context || {},
        timestamp: serverTimestamp(),
        createdAt: new Date()
      })
    );

    devLog("📊 satisfaction signal:", surface, sentiment, (reasons || []).join(",") || "");
    return { success: true, signalId: created.id };
  } catch (error) {
    devLog("recordSignal failed (non-fatal):", error?.message);
    return { success: false };
  }
};

/**
 * Rate an AI chat answer.
 *
 * Does both halves of the write: the analyzable row in `satisfactionSignals`,
 * and a mirror onto the message document. The mirror is what lets the thumbs
 * come back already filled after a reload — the signals collection is queried
 * for analysis, never to render a message.
 *
 * @param {Object} params
 * @param {string} params.chatId
 * @param {Object} params.message   The message being rated.
 * @param {number} params.sentiment SENTIMENT.POSITIVE | SENTIMENT.NEGATIVE
 * @param {string[]} [params.reasons] Reason slugs, on the refine pass.
 * @param {string} [params.comment]  Free text, on the refine pass.
 * @param {string} [params.signalId] Id from the first pass, when refining.
 * @param {string} [params.locale]
 */
export const rateChatAnswer = async ({
  chatId,
  message,
  sentiment,
  reasons,
  comment,
  signalId,
  locale
}) => {
  const messageId = message?.id;
  if (!messageId) return { success: false, reason: "missing-message" };

  const result = await recordSignal({
    surface: SURFACE.CHAT_ANSWER,
    sentiment,
    subjectId: messageId,
    chatId,
    reasons,
    comment,
    signalId,
    context: compact({
      messageType: message?.type || "text",
      // Long answers get disliked for different causes than short ones; keeping
      // the length makes that separable without storing the answer itself.
      contentLength: typeof message?.content === "string" ? message.content.length : null,
      locale: locale || null
    })
  });

  // Best-effort mirror. If it fails the signal still counted; the student just
  // sees an unrated message again on reload.
  markMessageRated(chatId, messageId, { sentiment, reasons: reasons || [] });

  return result;
};
