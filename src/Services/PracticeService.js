import { auth, db } from '../Firebase/config';
import { doc, setDoc, getDocs, collection, query, where, limit, writeBatch, serverTimestamp } from 'firebase/firestore';
import { API_BASE_URL } from './config';

async function headers() {
  if (!auth.currentUser) throw new Error('Sign in to continue practice.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` };
}

export async function copyPracticeToOwnChat(message, questions) {
  if (!auth.currentUser) throw new Error('Sign in to practice this quiz.');
  const chat = doc(collection(db, 'chats'));
  const quiz = doc(collection(chat, 'messages'));
  const batch = writeBatch(db);
  batch.set(chat, { userId: auth.currentUser.uid, title: message.quizTopic || 'Quiz practice', updatedAt: serverTimestamp() });
  const cleanQuestions = questions.map(({ userSelection, ...question }) => question);
  batch.set(quiz, { id: quiz.id, role: 'assistant', type: 'quiz', quizTopic: message.quizTopic || 'Quiz practice',
    quizData: JSON.parse(JSON.stringify(cleanQuestions)), expectedTotal: cleanQuestions.length, requestedTotal: cleanQuestions.length, timestamp: serverTimestamp() });
  await batch.commit();
  return chat.id;
}

async function check(response) {
  if (response.ok) return response;
  const data = await response.json().catch(() => ({}));
  const error = new Error(typeof data.detail === 'string' ? data.detail : 'Practice is unavailable. Please retry.');
  error.status = response.status;
  throw error;
}

export async function askPracticeTutor(body, signal) {
  return (await check(await fetch(`${API_BASE_URL}/quiz/tutor`, { method: 'POST', headers: await headers(), body: JSON.stringify(body), signal }))).json();
}

export async function streamPracticeBatch(body, onQuestion, signal) {
  const response = await check(await fetch(`${API_BASE_URL}/quiz/practice-stream`, { method: 'POST', headers: await headers(), body: JSON.stringify(body), signal }));
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', complete = false;
  const line = text => {
    if (!text.trim()) return;
    const data = JSON.parse(text);
    if (data.status === 'error') throw new Error(data.message);
    if (data.status === 'question_ready') onQuestion(data.question);
    if (data.status === 'quiz_complete') complete = true;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop(); lines.forEach(line);
    }
    if (buffer.trim()) line(buffer);
    if (!complete) throw new Error('The connection ended early. Retry to recover your batch.');
  } finally { reader.releaseLock(); }
}

// Preserve the original message timestamp and resolve legacy random document IDs.
export async function savePractice(chatId, messageId, practice) {
  const matches = await getDocs(query(collection(db, 'chats', chatId, 'messages'), where('id', '==', messageId), limit(1)));
  const ref = matches.empty ? doc(db, 'chats', chatId, 'messages', messageId) : matches.docs[0].ref;
  await setDoc(ref, { practice: JSON.parse(JSON.stringify(practice)) }, { merge: true });
}
