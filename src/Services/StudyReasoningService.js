import { auth, db } from '../Firebase/config';
import { collection, query, where, limit, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { API_BASE_URL } from './config';

const pendingSaves = new Map();

async function nodeMessage(chatId, nodeId) {
  const result = await getDocs(query(collection(db, 'chats', chatId, 'messages'), where('nodeId', '==', nodeId), limit(1)));
  if (result.empty) throw new Error('This question has not finished saving. Please retry.');
  return result.docs[0];
}
export async function loadReasoning(chatId, nodeId, index) {
  const message = await nodeMessage(chatId, nodeId);
  const discussion = await getDoc(doc(message.ref, 'reasoningDiscussions', String(index)));
  return discussion.data()?.history || [];
}
export async function saveReasoning(chatId, nodeId, index, history) {
  const key = chatId + ':' + nodeId;
  const write = (async () => {
    const message = await nodeMessage(chatId, nodeId);
    await setDoc(doc(message.ref, 'reasoningDiscussions', String(index)), { history: JSON.parse(JSON.stringify(history.slice(-40))) });
  })();
  const writes = pendingSaves.get(key) || new Set();
  writes.add(write); pendingSaves.set(key, writes);
  try { await write; } finally {
    writes.delete(write);
    if (!writes.size) pendingSaves.delete(key);
  }
}
export async function discussReasoning(body, signal) {
  if (!auth.currentUser) throw new Error('Sign in to discuss your reasoning.');
  const response = await fetch(`${API_BASE_URL}/study/reasoning`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Your tutor could not respond. Please retry.');
  return data;
}

// Only this completed node's conversations enter its debrief. Never scan other chats.
export async function loadNodeReasoning(chatId, nodeId) {
  if (!nodeId) return [];
  let timer;
  try {
    return await Promise.race([(async () => {
      await Promise.all([...(pendingSaves.get(chatId + ':' + nodeId) || [])]);
      const message = await nodeMessage(chatId, nodeId);
      const discussions = await getDocs(query(collection(message.ref, 'reasoningDiscussions'), limit(8)));
      return discussions.docs.filter(d => /^\d+$/.test(d.id)).map(d => ({
        question_index: Number(d.id),
        history: (d.data().history || []).slice(-10)
          .filter(turn => ['user', 'assistant'].includes(turn.role) && typeof turn.content === 'string')
          .map(({ role, content }) => ({ role, content: content.slice(0, 1600) })),
      }));
    })(), new Promise(resolve => { timer = setTimeout(() => resolve([]), 2000); })]);
  } catch { return []; } finally { clearTimeout(timer); }
}

export async function saveReasoningSummary(chatId, nodeId, result) {
  if (!nodeId || !result.reasoningSummaries?.length) return;
  const message = await nodeMessage(chatId, nodeId);
  await setDoc(doc(message.ref, 'reasoningSummaries', 'latest'), {
    summaries: result.reasoningSummaries, focus: result.reasoningFocus || null,
  });
}
