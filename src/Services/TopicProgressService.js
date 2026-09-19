import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { v5 as uuidv5 } from 'uuid';
import { db, auth } from '../Firebase/config';
import { baselineTopics, questionFingerprint } from './topicProgressModel';

const checkRef = (chatId, checkId) => {
  const uid = auth.currentUser?.uid;
  if (!uid || !chatId || !checkId) return null;
  return doc(db, 'users', uid, 'studyPerformance', chatId, 'quickChecks', checkId);
};

export const getTopicProgress = async (chatId, checkId) => {
  const ref = checkRef(chatId, checkId);
  if (!ref) return null;
  const [baseline, latest] = await Promise.all([getDoc(ref), getDoc(doc(ref, 'progress', 'summary'))]);
  if (!baseline.exists()) return null;
  return { baseline: baselineTopics(baseline.data()), latest: latest.data()?.topics || {} };
};

/** One transaction records the attempt, reserves fresh questions, and updates
 * topic summaries. Concurrent tabs and repeated completion cannot double-count.
 */
export const savePracticeAttempt = async (chatId, record) => {
  const data = record.toJSON();
  const ref = checkRef(chatId, data.checkId);
  if (!ref || !data.answers.length) return null;
  const attemptRef = doc(ref, 'practiceAttempts', uuidv5(data.nodeId, uuidv5.URL));
  const summaryRef = doc(ref, 'progress', 'summary');
  return runTransaction(db, async transaction => {
    const [baselineSnap, attemptSnap, summarySnap] = await Promise.all([
      transaction.get(ref), transaction.get(attemptRef), transaction.get(summaryRef),
    ]);
    if (!baselineSnap.exists()) return null;
    const baseline = baselineTopics(baselineSnap.data());
    const topics = { ...(summarySnap.data()?.topics || {}) };
    if (attemptSnap.exists()) return { baseline, latest: topics };
    const baselineFingerprints = new Set((baselineSnap.data().answers || []).map(questionFingerprint));
    const seenRefs = data.answers.map(answer => doc(ref, 'seenQuestions', uuidv5(answer.fingerprint, uuidv5.URL)));
    const seen = await Promise.all(seenRefs.map(target => transaction.get(target)));
    const withinAttempt = new Set();
    const results = {};
    const answers = data.answers.map((answer, index) => {
      const repeated = baselineFingerprints.has(answer.fingerprint) || seen[index].exists() || withinAttempt.has(answer.fingerprint);
      withinAttempt.add(answer.fingerprint);
      const eligible = !repeated && !!baseline[answer.topicKey];
      if (!seen[index].exists()) transaction.set(seenRefs[index], { nodeId: data.nodeId });
      if (eligible) {
        const row = results[answer.topicKey] || { topicKey: answer.topicKey, topic: baseline[answer.topicKey].topic,
          correct: 0, answered: 0, completedAt: data.completedAt, nodeId: data.nodeId };
        row.answered += 1;
        row.correct += Number(answer.correct);
        results[answer.topicKey] = row;
      }
      return { ...answer, eligible, repeated };
    });
    Object.entries(results).forEach(([key, result]) => {
      if (!topics[key] || topics[key].completedAt <= data.completedAt) topics[key] = result;
    });
    transaction.set(attemptRef, { ...data, answers });
    transaction.set(summaryRef, { topics });
    return { baseline, latest: topics };
  });
};
