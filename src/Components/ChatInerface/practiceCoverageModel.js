/* ══════════════════════════════════════════════════════════════════════
   PRACTICE COVERAGE — what she has practised in this chat, what she
   missed, and what her material covers that she hasn't touched.

   WHY THIS EXISTS
   ───────────────
   "the questions r too repetitive and i need to cover all areas" (a
   subscriber who later cancelled), and a Pro student naming the next topics
   by hand because nothing else would. Every answer was already stored, on
   each quiz message, and nothing ever read them together. So the debrief
   could say "Question 3 needs another look" and could not say "you missed
   three on fluid balance and haven't practised wound care yet".

   DERIVED, NEVER STORED
   ─────────────────────
   Like the dated schedule and the concept ledger, this is recomputed from
   the saved answers on every render. A stored summary would drift from the
   answers it summarises; this can't.

   THREE COUNTS, KEPT APART
   ────────────────────────
   generated (the question exists), attempted (she answered it) and
   correctFirst (right on the FIRST try). A quiz that grows in batches has
   generated questions nobody saw, and a review round turns every answer
   correct eventually; merging any two of these would overstate what she
   knows.

   Two message shapes carry answers:
     chat quiz  (type 'quiz')        quizData + practice.questions,
                                     first try in practice.firstAnswers
     plan quiz  (type 'study_quiz')  quizData[0].questions,
                                     first try in quizProgress.firstAttemptStatuses
   A plan built in this chat is the same chat, so both count toward the same
   topics: switching between chat and plan keeps the progress.
   ══════════════════════════════════════════════════════════════════════ */
import { findMatchingTopicKey } from '../../Services/topicKey';
import { appendUniqueQuestions } from './practiceModel';

const firstResult = value => {
  if (value == null) return null;
  if (typeof value === 'string') return value === 'correct' ? true : value === 'incorrect' ? false : null;
  if (typeof value.isCorrect === 'boolean') return value.isCorrect;
  if (typeof value.correct === 'boolean') return value.correct;
  return null;
};

const topicOf = q => String(q?.topic || q?.metadata?.topic || q?.concept || '').trim();

/** Every stored question in the chat, with whether and how she first answered it. */
export function collectPracticeItems(messages = []) {
  const items = [];
  for (const message of messages) {
    if (!message || message.isStreaming) continue;
    if (message.type === 'quiz') {
      const practice = message.practice || {};
      const questions = appendUniqueQuestions(message.quizData || [], practice.questions || []);
      const statuses = practice.snapshot?.firstAttemptStatuses || {};
      questions.forEach((question, index) => {
        const first = firstResult(practice.firstAnswers?.[index]) ?? firstResult(statuses[index]) ??
          firstResult(practice.answers?.[index] || question.userSelection);
        items.push({ messageId: message.id, index, question, topic: topicOf(question), origin: 'chat',
          attempted: first !== null, correctFirst: first === true });
      });
    } else if (message.type === 'study_quiz') {
      const questions = (message.quizData || []).flatMap(block => (Array.isArray(block?.questions) ? block.questions : []));
      const statuses = message.quizProgress?.firstAttemptStatuses || {};
      questions.forEach((question, index) => {
        const first = firstResult(statuses[index]) ?? firstResult(message.quizProgress?.firstAttemptAnswers?.[index]);
        items.push({ messageId: message.id, index, question, topic: topicOf(question), origin: 'plan',
          attempted: first !== null, correctFirst: first === true });
      });
    }
  }
  // One entry per question stem, the latest ATTEMPTED copy winning (messages
  // arrive in chat order). A mistake she has redone and got right is no
  // longer a mistake to redo, and a question the backend served twice is one
  // question, not two pieces of coverage.
  const byStem = new Map();
  const unkeyed = [];
  for (const item of items) {
    const stem = String(item.question?.question || '').trim().toLowerCase();
    if (!stem) { unkeyed.push(item); continue; }
    const previous = byStem.get(stem);
    if (!previous || item.attempted || !previous.attempted) byStem.set(stem, item);
  }
  return [...byStem.values(), ...unkeyed];
}

/**
 * Per-topic counts. Source topics (the headings of her notes, or her
 * uploads' topics) come first and in their own order, so questions land on
 * the names she recognises, and a heading nothing has touched shows up as
 * untested instead of simply not existing.
 */
export function buildCoverage(items = [], sourceTopics = [], sourceTopicGroups = []) {
  const keys = sourceTopics.filter(Boolean).map(String);
  const topics = new Map(keys.map(label => [label, { label, fromSource: true, generated: 0, attempted: 0, correctFirst: 0, missed: [] }]));
  // Source topics are main topics ("Examen primaire"); questions are tagged
  // with the subtopic they test ("C — Circulation"). Without this map a quiz
  // on Circulation counted as untouched primary survey, and the review told
  // her she had not practised the thing she had just practised (2026-10-06).
  // Exact label match only: the analysis tags both from the same goal record,
  // and a fuzzy match here could file a question under the wrong chapter.
  const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const parentOf = new Map();
  for (const group of (Array.isArray(sourceTopicGroups) ? sourceTopicGroups : [])) {
    const title = keys.find(key => norm(key) === norm(group?.title));
    if (!title) continue;
    for (const sub of group.subtopics || []) if (!parentOf.has(norm(sub))) parentOf.set(norm(sub), title);
  }
  for (const item of items) {
    if (!item.topic) continue; // never invent a bucket for an unlabelled question
    const key = parentOf.get(norm(item.topic)) || findMatchingTopicKey(item.topic, [...topics.keys()]);
    if (!topics.has(key)) topics.set(key, { label: key, fromSource: false, generated: 0, attempted: 0, correctFirst: 0, missed: [] });
    const entry = topics.get(key);
    entry.generated += 1;
    if (item.attempted) entry.attempted += 1;
    if (item.correctFirst) entry.correctFirst += 1;
    if (item.attempted && !item.correctFirst) entry.missed.push(item);
  }
  const list = [...topics.values()];
  return {
    topics: list,
    untested: list.filter(t => t.fromSource && t.attempted === 0).map(t => t.label),
    attempted: list.reduce((sum, t) => sum + t.attempted, 0)
  };
}

/**
 * The next useful step: her weakest practised topic and the first topic in
 * her material she hasn't practised. Either can be null; both null means
 * there's nothing specific and true to say, so the caller says nothing.
 */
export function nextPractice(coverage) {
  const weak = (coverage?.topics || [])
    .filter(t => t.missed.length > 0)
    .sort((a, b) => b.missed.length - a.missed.length || (a.correctFirst / a.attempted) - (b.correctFirst / b.attempted))[0] || null;
  const fresh = coverage?.untested?.[0] || null;
  if (!weak && !fresh) return null;
  // The count in the sentence and the questions behind "redo" are the same
  // list, so the button never offers a different number than the line said.
  const questions = weak ? missedQuestions(weak.missed) : [];
  return {
    review: weak && questions.length ? { topic: weak.label, missedCount: questions.length, questions } : null,
    fresh
  };
}

/**
 * The questions she got wrong on her first try, exactly as stored, for a
 * replay. Exactly as stored is the point: the same stem, options and key,
 * so a question she sees again can't come back with a different answer.
 * Deduplicated by stem (latest copy wins); the answer she gave is stripped.
 */
export function missedQuestions(items = [], limit = 10) {
  const byStem = new Map();
  for (const item of items) {
    if (!item.attempted || item.correctFirst) continue;
    const stem = String(item.question?.question || '').trim().toLowerCase();
    if (!stem) continue;
    const { userSelection, ...question } = item.question;
    byStem.set(stem, question);
  }
  return [...byStem.values()].slice(-limit);
}
