import { getUserExams, getExamChat } from "./ExamService";
import { getUserProfile, updateUserProfile } from "./UserService";
import { getStudyPerformance } from "./StudySessionService";
import { recordSignal, SURFACE } from "./SatisfactionService";
import { exam_debrief_turn } from "./FastAPICalls";
import {
  selectExamDebrief,
  collectCandidates,
  daysSince,
  dayKey,
  DEBRIEF_LOOKBACK_DAYS
} from "../Components/ExamDebrief/examDebriefModel";
import {
  buildDebriefWrite,
  toWireMessages
} from "../Components/ExamDebrief/examDebriefConversation";
import { devLog } from "./devLogger";

/**
 * ExamDebriefService — everything the post-exam conversation touches outside
 * the component: which exam to raise, what the tutor knows going in, and where
 * the answers land.
 *
 * WHY THIS EXISTS
 *
 * The question "how did the exam actually go?" had never been asked, so the
 * only thing we knew about the moment the whole product is aimed at was the
 * date it happened on. Everything else — whether the prep held up, what she
 * wished she had practised, what the exam threw at her that we never covered —
 * was invisible.
 *
 * The judgment lives elsewhere on purpose: `examDebriefModel` decides WHEN to
 * ask, `examDebriefConversation` decides what a conversation becomes in
 * Firestore, and the backend decides what to say next. This file is the I/O
 * between them.
 *
 * DESIGN NOTES
 *
 *  - The "already asked" record lives on the USER document, not localStorage.
 *    A student who answers on her laptop must not be asked again on her phone;
 *    a per-device memory turns a thoughtful one-time question into a nag.
 *
 *  - Answering and dismissing are stored the same way, differing only in
 *    `status`. Both mean "do not ask about this exam again" — a skip is an
 *    answer to "do you want to talk about this" — and keeping the distinction
 *    lets us read the response rate later without a second collection.
 *
 *  - The row is written after the FIRST exchange and refined on every turn,
 *    rather than saved at the end. Most conversations end with the student
 *    closing the tab, and a design that only writes on a clean finish would
 *    systematically discard the debriefs of the students who had the worst
 *    exams.
 *
 *  - Study context is best-effort and silent. It sharpens the tutor's
 *    questions; it is not worth delaying, let alone failing, the conversation
 *    for.
 *
 *  - Every write is best-effort. A failed feedback write must never surface to
 *    someone who has just walked out of an exam.
 */

/** Map field on the user document: debrief key → { status, day, at }. */
const FIELD = "examDebriefs";

/** Topics named in the prompt. Enough to be specific, short enough to read. */
const MAX_CONTEXT_TOPICS = 12;

/**
 * Find the exam worth asking about, if there is one.
 *
 * Reads the profile fresh rather than taking AuthContext's copy: that snapshot
 * is taken once at login and can be hours old by the time this runs, and a
 * stale `examDebriefs` map is precisely the state that re-asks a question
 * already answered in another tab.
 *
 * @param {string} uid
 * @param {Date}   [now]
 * @returns {Promise<Object|null>} The chosen exam, or null when there is none.
 */
export const findPendingExamDebrief = async (uid, now = new Date()) => {
  if (!uid) return null;

  try {
    const [exams, profile] = await Promise.all([
      getUserExams(uid),
      getUserProfile(uid).catch(() => null)
    ]);

    const chosen = selectExamDebrief({
      exams,
      onboardingExamDate: profile?.onboarding?.examDate || null,
      debriefs: profile?.[FIELD] || {},
      now
    });

    if (chosen) {
      devLog("🎓 exam debrief pending:", chosen.key, `${chosen.daysAgo}d ago`);
    } else {
      explainNoDebrief({
        exams,
        onboardingExamDate: profile?.onboarding?.examDate || null,
        debriefs: profile?.[FIELD] || {},
        now
      });
    }
    return chosen;
  } catch (error) {
    // A student who cannot be asked is a missing row; a thrown error here would
    // break the app shell she came to use.
    devLog("findPendingExamDebrief failed (non-fatal):", error?.message);
    return null;
  }
};

/**
 * Say why no conversation was raised.
 *
 * Silence was the single most confusing thing about this feature in
 * development: nothing happens on load, and nothing happens is also exactly
 * what a working app does for a student with no recent exam. Every gate is
 * printed with the value that failed it, so "why didn't it ask me?" is answered
 * by the console rather than by reading the model.
 *
 * devLog only — this is noise in production, where nothing happening is the
 * overwhelmingly common and correct outcome.
 */
const explainNoDebrief = ({ exams, onboardingExamDate, debriefs, now }) => {
  const candidates = collectCandidates({ exams, onboardingExamDate });

  if (candidates.length === 0) {
    devLog(
      "🎓 no exam debrief: this account has no exam date at all.",
      "Exams come from users/{uid}/exams (ExamPrepModal) or",
      "users/{uid}.onboarding.examDate (mirrored when a chat with an examDate is opened)."
    );
    return;
  }

  candidates.forEach((candidate) => {
    const ago = daysSince(candidate.date, now);
    const name = candidate.label || "(unnamed)";

    if (Object.prototype.hasOwnProperty.call(debriefs || {}, candidate.key)) {
      devLog(
        `🎓 no exam debrief for ${name}: already ${debriefs[candidate.key]?.status}.`,
        `Clear users/{uid}.examDebriefs["${candidate.key}"] to ask again.`
      );
    } else if (ago === null) {
      devLog(`🎓 no exam debrief for ${name}: its date could not be read.`);
    } else if (ago < 1) {
      devLog(
        `🎓 no exam debrief for ${name}: the exam day is not over yet`,
        `(${ago === 0 ? "it is today" : `${-ago}d away`}). It is asked the day AFTER.`
      );
    } else if (ago > DEBRIEF_LOOKBACK_DAYS) {
      devLog(
        `🎓 no exam debrief for ${name}: ${ago}d ago, past the`,
        `${DEBRIEF_LOOKBACK_DAYS}d recall window.`
      );
    } else {
      devLog(`🎓 no exam debrief for ${name}: covered by another exam on ${candidate.day}.`);
    }
  });
};

/**
 * What her preparation actually looked like, for the tutor's context.
 *
 * Only reachable when the exam came from the `exams` subcollection — the path
 * that links an exam to a chat. Returns null otherwise, and null is a supported
 * outcome everywhere downstream: the conversation is about her experience, and
 * the plan is only there so the questions can be specific.
 *
 * @param {Object} exam  From findPendingExamDebrief.
 * @returns {Promise<Object|null>} { topics, nodes_completed, nodes_total, average_score }
 */
export const loadStudyContext = async (exam) => {
  if (!exam?.examId) return null;

  try {
    const chat = await getExamChat(exam.examId);
    if (!chat?.id) return null;

    const nodes = Array.isArray(chat?.study?.path?.nodes) ? chat.study.path.nodes : [];
    // Banners are section headers, not work she did — counting them would
    // overstate the plan and understate how much of it she finished.
    const realNodes = nodes.filter((n) => n && n.type !== "section_banner");

    const topics = [];
    realNodes.forEach((node) => {
      const label = (node.label || "").trim();
      if (label && !topics.includes(label)) topics.push(label);
    });

    // What KINDS of work the plan was made of. Four lessons and one quiz is a
    // different week from five quizzes, and it changes which question is worth
    // asking about how the exam felt.
    const planShape = {};
    realNodes.forEach((node) => {
      const kind = node.type || "step";
      if (!planShape[kind]) planShape[kind] = { total: 0, completed: 0 };
      planShape[kind].total += 1;
      if (node.status === "completed") planShape[kind].completed += 1;
    });

    const context = {
      topics: topics.slice(0, MAX_CONTEXT_TOPICS),
      nodes_completed: realNodes.filter((n) => n.status === "completed").length,
      nodes_total: realNodes.length,
      plan_shape: planShape
    };

    // Her measured accuracy on OUR questions. Worth having next to what she
    // says about the real exam — "78% here, blindsided there" is the exact gap
    // this whole feature exists to find.
    const performance = await getStudyPerformance(chat.id).catch(() => null);
    const topicEntries = performance?.topics ? Object.entries(performance.topics) : [];
    const totals = topicEntries.reduce(
      (acc, [, t]) => ({
        correct: acc.correct + (Number(t?.correct) || 0),
        total: acc.total + (Number(t?.total) || 0)
      }),
      { correct: 0, total: 0 }
    );
    if (totals.total > 0) {
      context.average_score = Math.round((totals.correct / totals.total) * 100);
    }

    // Where she was weakest in our own material. Lets the tutor say "you found
    // that hard here too" — or, more usefully, spot the opposite: a topic she
    // scored well on and was still blindsided by, which means OUR version of it
    // was easier than the exam's.
    context.weakest_topics = topicEntries
      .map(([topic, stats]) => ({
        topic,
        correct: Number(stats?.correct) || 0,
        total: Number(stats?.total) || 0
      }))
      // Three answers is the floor for a rate meaning anything; below that a
      // single unlucky question would name the "weakest" topic.
      .filter((t) => t.total >= 3)
      .sort((a, b) => a.correct / a.total - b.correct / b.total)
      .slice(0, 4);

    // The calibration line: what she actually drilled, by format. If the exam
    // leaned on select-all and she saw six of them here, that is the finding —
    // and it is visible before she says a word.
    if (performance?.formats && typeof performance.formats === "object") {
      context.practice_formats = performance.formats;
    }

    return context;
  } catch (error) {
    devLog("loadStudyContext failed (non-fatal):", error?.message);
    return null;
  }
};

/**
 * Ask the tutor what to say next.
 *
 * Deliberately NOT wrapped in a try/catch: the caller has to know this failed,
 * because the right response is to close the conversation warmly rather than
 * leave her typing into something that will never answer.
 *
 * @param {Object} params
 * @param {Array}  params.messages      Conversation so far, oldest first.
 * @param {Object} params.exam
 * @param {Object} [params.studyContext]
 * @param {string} [params.locale]
 * @returns {Promise<{reply: string, done: boolean, insights: Object}>}
 */
export const nextDebriefMessage = async ({ messages, exam, studyContext, locale }) => {
  const result = await exam_debrief_turn({
    messages: toWireMessages(messages),
    examName: exam?.label || null,
    examDate: exam?.day || null,
    daysAfter: typeof exam?.daysAgo === "number" ? exam.daysAgo : null,
    studyContext: studyContext || null,
    language: locale || "en"
  });

  devLog("🎓 debrief turn:", result?.done ? "closing" : "continuing");
  return result;
};

/**
 * Remember that this exam has been dealt with, so it is never raised again.
 *
 * @param {string} uid
 * @param {Object} exam    From findPendingExamDebrief.
 * @param {string} status  'answered' | 'dismissed'
 */
export const markExamDebriefHandled = async (uid, exam, status) => {
  if (!uid || !exam?.key) return { success: false };

  try {
    await updateUserProfile(uid, {
      [`${FIELD}.${exam.key}`]: {
        status,
        day: exam.day || dayKey(exam.date),
        at: new Date()
      }
    });
    return { success: true };
  } catch (error) {
    devLog("markExamDebriefHandled failed (non-fatal):", error?.message);
    return { success: false };
  }
};

/**
 * Save the conversation and what it revealed.
 *
 * Called after every turn. The first call inserts and returns a `signalId`;
 * later calls pass it back and rewrite the same row, because the insights are
 * re-derived from the whole transcript each turn and her later messages
 * routinely correct the reading of her first.
 *
 * @param {Object}   params
 * @param {Object}   params.exam
 * @param {Object}   params.insights   Raw insights from the backend.
 * @param {Array}    params.messages   Conversation so far.
 * @param {string}   [params.signalId] Present after the first save.
 * @param {string}   [params.locale]
 * @returns {Promise<{success: boolean, signalId?: string}>}
 */
export const saveExamDebrief = async ({ exam, insights, messages, signalId, locale }) => {
  if (!exam?.key) return { success: false, reason: "missing-exam" };

  const write = buildDebriefWrite({ insights, messages, exam, locale });

  return recordSignal({
    surface: SURFACE.EXAM_DEBRIEF,
    subjectId: exam.key,
    signalId,
    ...write
  });
};
