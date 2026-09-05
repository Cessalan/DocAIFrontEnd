/**
 * ExamDrillService.js — generation and persistence for Exam Drill.
 *
 * ONE QUESTION AT A TIME, ON PURPOSE
 * ──────────────────────────────────
 * The drill asks for exactly one question per call. That is what makes it
 * adaptive: the spec for question N+1 is computed from the answer to question
 * N, so there is no pre-generated batch to invalidate when the student turns
 * out to be weaker (or stronger) than we thought.
 *
 * It needs no backend endpoint of its own. `/study/generate-exam` already
 * accepts `question_types` and `question_count`, so a single forced-format
 * question is just `question_count: 1` with a one-element type list. The
 * backend's `usage_guard` quota check runs on it exactly as it does for exam
 * nodes, which is what keeps the free cap honest on the server side rather
 * than only in the client's UsageContext.
 *
 * PERSISTENCE
 * ───────────
 * A drill lives on the chat document under `drill`, mirroring how a study
 * session lives under `study`. Same reasoning: the drill is about the material
 * uploaded to this chat, so it belongs to the chat and inherits its
 * vectorstore, uploads and ownership rather than needing a parallel
 * collection with its own lifecycle.
 */

import { db } from '../Firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { generate_exam } from './FastAPICalls';
import { devLog, devWarn } from './devLogger';
import { normalizeFormat } from '../Components/ExamDrill/drillModel';
import { resolveExamDate } from './examDateChoices';
import { updateUserProfile } from './UserService';

/**
 * Answers kept on the persisted state.
 *
 * The aggregate buckets (`topics`, `formats`, `concepts`) are never trimmed,
 * so this cap costs the per-answer timeline beyond it, not the student model.
 *
 * WHY IT IS NOT 60 ANY MORE
 * ─────────────────────────
 * It was, back when `history` was a record and the buckets were the product.
 * History is now the drill's event log — every row carries the format, the
 * partial score, how long it took and when — and the analysis is scoped to
 * ONE CHAT, which makes this cap the horizon of everything the drill can ever
 * notice about a student. At 60 a serious session silently forgot its own
 * opening while the student was still in it.
 *
 * 250 rows at roughly 220 bytes is about 55KB against Firestore's 1MiB
 * document limit, on a chat document that also carries the `study` map. That
 * is comfortable rather than free, which is the right place to sit: raise it
 * again only with the arithmetic redone.
 */
export const DRILL_HISTORY_CAP = 250;

/** Concept labels we mention to the generator when asking it not to repeat. */
const ANTI_REPEAT_WINDOW = 12;

/**
 * Difficulty 1-3 as words the question generator actually responds to.
 * The backend takes `difficulty` as a string on its own arg, but the drill
 * steers through `custom_instructions` so it can say *why* as well as *what*.
 */
const DIFFICULTY_WORD = { 1: 'foundational', 2: 'application-level', 3: 'analysis-level' };

/**
 * Turn a spec from `selectNextSpec` into instructions for the generator.
 *
 * The reason strings map onto what the drill is trying to learn, and they
 * change the question meaningfully: probing a suspected-strong topic should
 * produce something that can actually falsify the strength, while drilling a
 * known weakness should stay on the same concept rather than wander.
 */
export const buildInstructions = (spec, state, t) => {
  const parts = [];
  const level = DIFFICULTY_WORD[spec.difficulty] || DIFFICULTY_WORD[1];
  parts.push(`Write one ${level} question.`);

  switch (spec.reason) {
    case 'drillWeak':
      parts.push(
        'The student has repeatedly missed this topic. Target the specific misunderstanding rather than testing the topic broadly.'
      );
      break;
    case 'proveStrength':
      parts.push(
        'The student has answered this topic correctly on multiple choice only. Write a question that would expose a shallow understanding — one that cannot be answered by recognising a familiar phrase.'
      );
      break;
    case 'gatherEvidence':
      parts.push('We have little evidence on this topic. Test the central idea, not an edge case.');
      break;
    case 'resolveInconsistency':
      parts.push(
        'The student is inconsistent here. Test the same underlying principle from a different angle to settle whether they actually have it.'
      );
      break;
    case 'blockFormatQuota':
      parts.push('Cover the most exam-relevant idea available for this topic.');
      break;
    default:
      parts.push('Introduce this topic at a fair difficulty.');
  }

  // Anti-repeat. We name concepts rather than question text: the same
  // misconception phrased two ways is the same question to a student.
  const recent = (state?.history || [])
    .slice(-ANTI_REPEAT_WINDOW)
    .map((h) => h.conceptKey)
    .filter(Boolean);
  const unique = [...new Set(recent)];
  if (unique.length) {
    parts.push(`Do not re-test these concepts: ${unique.join('; ')}.`);
  }

  return parts.join(' ');
};

/**
 * Generate exactly one question matching a spec.
 *
 * Resolves to `null` rather than throwing when the generator comes back empty,
 * so a single bad generation degrades into "try again" instead of ending the
 * drill. A quota rejection (429) is rethrown tagged, because that one the UI
 * must handle differently — it is the paywall, not an error.
 *
 * @param {Object} args
 * @param {string} args.chatId
 * @param {Object} args.spec      From selectNextSpec().
 * @param {Object} args.state     Current drill state (for anti-repeat).
 * @param {string} [args.language]
 * @returns {Promise<Object|null>} A question shaped for the renderers.
 */
export const generateDrillQuestion = async ({ chatId, spec, state, language = 'en' }) => {
  const format = normalizeFormat(spec?.format);
  const topic = spec?.topic || 'General';

  try {
    const result = await generate_exam(
      chatId,
      topic,
      [format],
      1,
      buildInstructions(spec, state),
      language
    );

    const question = result?.questions?.[0];
    if (!question) {
      devWarn('Drill generation returned no question for', topic, format);
      return null;
    }

    // The backend echoes questionType, but a bank-sourced question can come
    // back in a different format than we asked for. Trust what arrived over
    // what we requested — grading and the student model both key on this.
    return {
      ...question,
      questionType: normalizeFormat(question.questionType || format),
      topic: question.topic || topic,
      drillReason: spec?.reason || null,
      drillDifficulty: spec?.difficulty ?? 1,
    };
  } catch (error) {
    if (String(error?.message || '').includes('429')) {
      const quotaError = new Error('drill_quota_exceeded');
      quotaError.code = 'quota_exceeded';
      throw quotaError;
    }
    console.error('❌ Drill question generation failed:', error);
    return null;
  }
};

/* ── Persistence ──────────────────────────────────────────────────────── */

/** Strip a state down to what is worth storing. */
export const serializeDrillState = (state) => ({
  answered: state.answered,
  topics: state.topics,
  formats: state.formats,
  concepts: state.concepts,
  difficulty: state.difficulty,
  streak: state.streak,
  lastCheckpointAt: state.lastCheckpointAt,
  topicPool: state.topicPool || [],
  history: (state.history || []).slice(-DRILL_HISTORY_CAP),
  askedHashes: (state.askedHashes || []).slice(-DRILL_HISTORY_CAP),
});

/**
 * Load a saved drill, or null when this chat has never run one.
 * Shape-defaults every field so a document written by an older build cannot
 * crash the model with a missing map.
 */
export const loadDrillState = async (chatId) => {
  if (!chatId) return null;
  try {
    const snap = await getDoc(doc(db, 'chats', chatId));
    const saved = snap.exists() ? snap.data()?.drill : null;
    if (!saved) return null;
    return {
      answered: saved.answered || 0,
      history: saved.history || [],
      topics: saved.topics || {},
      formats: saved.formats || {},
      concepts: saved.concepts || {},
      difficulty: saved.difficulty || 1,
      streak: saved.streak || 0,
      askedHashes: saved.askedHashes || [],
      lastCheckpointAt: saved.lastCheckpointAt || 0,
      topicPool: saved.topicPool || [],
    };
  } catch (error) {
    console.error('❌ Error loading drill state:', error);
    return null;
  }
};

/**
 * Persist the drill.
 *
 * Deliberately fire-and-forget at the call site: a drill that pauses between
 * questions to wait for Firestore feels broken, and the state is fully
 * reconstructible from the next write if one is dropped.
 */
export const saveDrillState = async (chatId, state) => {
  if (!chatId || !state) return;
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      drill: { ...serializeDrillState(state), updatedAt: new Date().toISOString() },
      updatedAt: serverTimestamp(),
    });
    devLog('💾 Drill state saved:', state.answered, 'answered');
  } catch (error) {
    console.error('❌ Error saving drill state:', error);
  }
};

/** Clear a drill so the student can start a fresh one on the same material. */
export const resetDrillState = async (chatId) => {
  if (!chatId) return;
  try {
    await updateDoc(doc(db, 'chats', chatId), { drill: null, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error('❌ Error resetting drill:', error);
  }
};

/* ── Exam date ────────────────────────────────────────────────────────── */

/**
 * Persist the student's answer to "when is your exam?".
 *
 * Lives here rather than at either call site because the question is now asked
 * in two places — during the drill upload (ChatInterface) and on the way into a
 * drill that was never asked (ExamDrillPage) — and two copies of these writes
 * is how one of them quietly stops mirroring to the profile.
 *
 * Fire-and-forget by design: she has just answered a question about her own
 * exam, there is nothing useful to tell her if Firestore is slow, and making
 * her wait to enter a drill she already asked for is a real cost. A dropped
 * write means we ask again next time — the harmless direction to fail in.
 *
 * @returns {Date|null} the resolved date, so the caller can light up the
 *          countdown without waiting for a reload. null when the answer could
 *          not be resolved, which is never written.
 */
export const saveExamDate = ({ chatId, uid, key, customDate }) => {
  const resolved = resolveExamDate(key, customDate);
  if (!resolved || !chatId) return null;

  updateDoc(doc(db, 'chats', chatId), {
    examDate: resolved.date,
    // Recorded at the document ROOT, never under `drill`: saveDrillState
    // rewrites that whole map on every answer, so a flag parked inside it
    // is erased by the student's next question.
    examDateAskedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  }).catch((error) => console.error('❌ Could not save the exam date:', error));

  // Mirrored onto the profile so the countdown follows her to her other chats,
  // exactly as plan onboarding's answer already does.
  if (uid) {
    updateUserProfile(uid, { 'onboarding.examDate': resolved.date })
      .catch((error) => console.error('❌ Could not save the exam date to the profile:', error));
  }

  return resolved.date;
};

/** She declined. Recorded so this chat does not ask again. */
export const noteExamDateAsked = (chatId) => {
  if (!chatId) return;
  updateDoc(doc(db, 'chats', chatId), {
    examDateAskedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  }).catch((error) => console.error('❌ Could not record the exam-date skip:', error));
};
