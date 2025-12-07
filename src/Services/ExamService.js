import { db } from "../Firebase/config";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy
} from "firebase/firestore";

/**
 * Fetches all exams for a user from Firestore.
 * @param {string} uid - The user's unique ID.
 * @returns {Promise<Array>} Array of exam objects.
 */
export const getUserExams = async (uid) => {
  try {
    const examsRef = collection(db, "users", uid, "exams");
    const q = query(examsRef, orderBy("date", "asc"));
    const querySnapshot = await getDocs(q);

    const exams = [];
    querySnapshot.forEach((doc) => {
      exams.push({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to date string if needed
        date: doc.data().date?.toDate?.() || doc.data().date
      });
    });

    return exams;
  } catch (error) {
    console.error("Error fetching user exams:", error);
    return [];
  }
};

/**
 * Gets a single exam by ID.
 * @param {string} uid - The user's unique ID.
 * @param {string} examId - The exam's unique ID.
 * @returns {Promise<Object|null>} The exam data or null if not found.
 */
export const getExamById = async (uid, examId) => {
  try {
    const examRef = doc(db, "users", uid, "exams", examId);
    const examDoc = await getDoc(examRef);

    if (examDoc.exists()) {
      return {
        id: examDoc.id,
        ...examDoc.data(),
        date: examDoc.data().date?.toDate?.() || examDoc.data().date
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching exam:", error);
    throw error;
  }
};

/**
 * Creates a new exam for a user.
 * @param {string} uid - The user's unique ID.
 * @param {Object} examData - The exam data (name, date, subject, etc.).
 * @returns {Promise<Object>} The created exam with its ID.
 */
export const createExam = async (uid, examData) => {
  try {
    const examsRef = collection(db, "users", uid, "exams");
    const newExamRef = doc(examsRef);

    const examToSave = {
      ...examData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(newExamRef, examToSave);

    return {
      id: newExamRef.id,
      ...examData
    };
  } catch (error) {
    console.error("Error creating exam:", error);
    throw error;
  }
};

/**
 * Updates an existing exam.
 * @param {string} uid - The user's unique ID.
 * @param {string} examId - The exam's unique ID.
 * @param {Object} updates - The fields to update.
 * @returns {Promise<void>}
 */
export const updateExam = async (uid, examId, updates) => {
  try {
    const examRef = doc(db, "users", uid, "exams", examId);
    await updateDoc(examRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating exam:", error);
    throw error;
  }
};

/**
 * Deletes an exam.
 * @param {string} uid - The user's unique ID.
 * @param {string} examId - The exam's unique ID.
 * @returns {Promise<void>}
 */
export const deleteExam = async (uid, examId) => {
  try {
    const examRef = doc(db, "users", uid, "exams", examId);
    await deleteDoc(examRef);
  } catch (error) {
    console.error("Error deleting exam:", error);
    throw error;
  }
};

/**
 * Gets the next upcoming exam for a user.
 * @param {string} uid - The user's unique ID.
 * @returns {Promise<Object|null>} The next exam or null if none.
 */
export const getNextExam = async (uid) => {
  try {
    const exams = await getUserExams(uid);
    const now = new Date();

    const upcomingExams = exams
      .filter(exam => new Date(exam.date) > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return upcomingExams[0] || null;
  } catch (error) {
    console.error("Error fetching next exam:", error);
    return null;
  }
};

/**
 * Gets the chat linked to an exam.
 * @param {string} examId - The exam's unique ID.
 * @returns {Promise<Object|null>} The chat data or null if not found.
 */
export const getExamChat = async (examId) => {
  try {
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("examId", "==", examId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const chatDoc = querySnapshot.docs[0];
      return {
        id: chatDoc.id,
        ...chatDoc.data()
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching exam chat:", error);
    return null;
  }
};

/**
 * Calculates exam readiness based on quiz results in the exam's chat.
 * @param {string} examId - The exam's unique ID.
 * @returns {Promise<Object>} Object with readiness percentage and stats.
 */
export const getExamReadiness = async (examId) => {
  try {
    // Find the chat linked to this exam
    const examChat = await getExamChat(examId);

    if (!examChat) {
      return { percentage: 0, totalQuestions: 0, correctAnswers: 0, hasStarted: false };
    }

    // Get all messages in this chat that contain quiz results
    const messagesRef = collection(db, "chats", examChat.id, "messages");
    const messagesSnapshot = await getDocs(messagesRef);

    let totalQuestions = 0;
    let correctAnswers = 0;

    messagesSnapshot.forEach((doc) => {
      const message = doc.data();

      // Check for quiz progress in the message
      if (message.quizProgress) {
        totalQuestions += message.quizProgress.totalQuestions || 0;
        correctAnswers += message.quizProgress.correctCount || 0;
      }

      // Also check for individual question answers
      if (message.type === 'quiz_answer' && message.isCorrect !== undefined) {
        totalQuestions += 1;
        if (message.isCorrect) correctAnswers += 1;
      }
    });

    const percentage = totalQuestions > 0
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : 0;

    return {
      percentage,
      totalQuestions,
      correctAnswers,
      hasStarted: totalQuestions > 0,
      chatId: examChat.id
    };
  } catch (error) {
    console.error("Error calculating exam readiness:", error);
    return { percentage: 0, totalQuestions: 0, correctAnswers: 0, hasStarted: false };
  }
};
