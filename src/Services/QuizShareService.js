import { db } from "../Firebase/config";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { buildShareDoc, classSummary, combineSummaries, firstName } from "../Components/ShareSet/shareSetModel";
import { devLog } from "./devLogger";

/**
 * Shared question sets ("send to my study group").
 *
 * Two places, on purpose:
 *
 *  - `publicQuizzes/{shareId}` is what a classmate reads with no account. It
 *    holds questions, a first name if she allowed it, and counters. It never
 *    holds a uid or a chat id: the collection is world-readable.
 *  - `users/{uid}/shareSets/{shareId}` is her own list of what she sent, so the
 *    app can tell her classmates used it. Owner-only under firestore.rules.
 *
 * The counters on the public document are written by anonymous browsers. They
 * are a signal for her, not an audit trail; nothing is gated on them.
 */

const PUBLIC = "publicQuizzes";
const MINE_KEY = "nqMySharedSets";

const generateShareId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint32Array(12);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return Array.from(bytes, (n) => chars[n % chars.length]).join('');
};

export const shareUrlFor = (shareId) => `${window.location.origin}/quiz/${shareId}`;

const readMine = () => {
  try { return JSON.parse(localStorage.getItem(MINE_KEY) || '[]'); } catch { return []; }
};

/** Her own visits to her own link are not classmates. */
export const isMyShare = (shareId) => readMine().includes(shareId);

const rememberMine = (shareId) => {
  try { localStorage.setItem(MINE_KEY, JSON.stringify([...readMine(), shareId].slice(-50))); } catch { /* private mode */ }
};

/**
 * Publish a set and return its link.
 * `questions` are the round's questions as the cards hold them; the model
 * reduces them to what may travel.
 */
export const createShareSet = async ({ uid, chatId, nodeId, questions, topic, senderName, score, showName = true, includeScore = false, language = 'en' }) => {
  const shareId = generateShareId();
  const publicDoc = buildShareDoc({ shareId, questions, topic, senderName, showName, score, includeScore, language });
  if (!publicDoc.questions.length) throw new Error("Nothing to share");
  await setDoc(doc(db, PUBLIC, shareId), { ...publicDoc, createdAt: serverTimestamp() });
  rememberMine(shareId);
  if (uid) {
    // Best effort: the link works without it, she just won't hear back.
    setDoc(doc(db, "users", uid, "shareSets", shareId), {
      shareId, chatId: chatId || null, nodeId: nodeId || null, topic: publicDoc.topic,
      totalQuestions: publicDoc.totalQuestions, createdAt: serverTimestamp(),
    }).catch((error) => console.error("Could not record the shared set:", error));
  }
  devLog("Shared set created:", shareId);
  return { shareId, url: shareUrlFor(shareId), totalQuestions: publicDoc.totalQuestions };
};

/** Her name and score switches, applied to a link that already exists. */
export const updateShareVisibility = (shareId, { senderName, showName, score, includeScore }) =>
  updateDoc(doc(db, PUBLIC, shareId), {
    senderName: showName ? firstName(senderName) || null : null,
    senderScore: includeScore && score?.total > 0 ? { got: score.got, total: score.total } : null,
  });

export const fetchSharedQuiz = async (shareId) => {
  const snapshot = await getDoc(doc(db, PUBLIC, shareId));
  if (!snapshot.exists()) throw new Error("Quiz not found");
  return snapshot.data();
};

const bump = (shareId, patch) =>
  updateDoc(doc(db, PUBLIC, shareId), patch).catch(() => { /* counters never interrupt a quiz */ });

export const recordSetStarted = (shareId) => bump(shareId, { starts: increment(1) });

export const recordSetCompleted = (shareId, missedIndices = []) =>
  bump(shareId, {
    completions: increment(1),
    ...Object.fromEntries(missedIndices.map((index) => [`misses.${index}`, increment(1)])),
  });

/**
 * Keep a walkthrough on the shared set so nobody after this visitor pays for
 * it again. If one is already saved (two classmates missed the same question
 * at once), the saved one wins and is returned; nothing is ever overwritten.
 * A failed save still returns the walkthrough she just got.
 */
export const saveSharedWalkthrough = async (shareId, index, walkthrough) => {
  try {
    return await runTransaction(db, async (transaction) => {
      const ref = doc(db, PUBLIC, shareId);
      const snapshot = await transaction.get(ref);
      const existing = snapshot.data()?.walkthroughs?.[index];
      if (existing) return existing;
      transaction.update(ref, { [`walkthroughs.${index}`]: walkthrough });
      return walkthrough;
    });
  } catch (error) {
    devLog("Could not save the walkthrough on the shared set:", error?.message);
    return walkthrough;
  }
};

/** A classmate says a question is wrong. It leaves the set for everyone after her. */
export const flagSharedQuestion = (shareId, index) => bump(shareId, { flagged: arrayUnion(index) });

/**
 * "3 classmates tried your set", for one study space. Null when nobody has, or
 * when anything fails: this line is a bonus and must never show an error.
 */
export const loadClassSummary = async (uid, chatId) => {
  if (!uid || !chatId) return null;
  try {
    const mine = await getDocs(query(collection(db, "users", uid, "shareSets"), where("chatId", "==", chatId)));
    const ids = mine.docs.map((item) => item.id).slice(-10);
    if (!ids.length) return null;
    const sets = await Promise.all(ids.map((id) => getDoc(doc(db, PUBLIC, id))));
    return combineSummaries(sets.map((set) => (set.exists() ? classSummary(set.data()) : null)));
  } catch (error) {
    devLog("Class summary unavailable:", error?.message);
    return null;
  }
};

/**
 * The 2025 share button (ShareQuizButton, on the retired ChatQuiz results
 * screens) still calls this. Kept so those screens keep working if reached.
 */
export const shareQuiz = async (quizData) => {
  const shareId = generateShareId();
  const quizzes = quizData.quizzes.map((quiz) => ({
    question: quiz.question, options: quiz.options, answer: quiz.answer,
    justification: quiz.justification, topic: quiz.topic || null,
  }));
  await setDoc(doc(db, PUBLIC, shareId), {
    shareId, quizzes, topic: quizData.topic || "Nursing Quiz", totalQuestions: quizzes.length, createdAt: serverTimestamp(),
  });
  return shareUrlFor(shareId);
};

export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
};
