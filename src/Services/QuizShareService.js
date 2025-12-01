import { db } from "../Firebase/config";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";

/**
 * Share a quiz publicly and generate a shareable link
 * @param {Object} quizData - The quiz data to share
 * @param {string} quizData.messageId - The message ID
 * @param {Array} quizData.quizzes - Array of quiz questions
 * @param {string} quizData.topic - Optional topic/title
 * @returns {Promise<string>} - The shareable URL
 */
export const shareQuiz = async (quizData, userResults) => {
  try {
    // Generate a unique share ID
    const shareId = generateShareId();

    // Clean quizzes - remove user answers and selections
    const cleanedQuizzes = quizData.quizzes.map(quiz => ({
      question: quiz.question,
      options: quiz.options,
      answer: quiz.answer,
      justification: quiz.justification,
      topic: quiz.topic || null
      // Explicitly exclude: userSelection, isCorrect, selectedIndex, etc.
    }));

    // Prepare the public quiz document (no analytics - each user gets their own results)
    const publicQuizData = {
      shareId,
      quizzes: cleanedQuizzes,
      topic: quizData.topic || "Nursing Quiz",
      totalQuestions: cleanedQuizzes.length,
      createdAt: serverTimestamp(),
    };

    // Save to Firestore public collection
    const shareRef = doc(db, "publicQuizzes", shareId);
    await setDoc(shareRef, publicQuizData);

    // Generate the shareable URL
    const shareUrl = `${window.location.origin}/quiz/${shareId}`;

    console.log("✅ Quiz shared successfully:", shareUrl);
    return shareUrl;

  } catch (error) {
    console.error("❌ Error sharing quiz:", error);
    throw new Error("Failed to share quiz. Please try again.");
  }
};

/**
 * Fetch a shared quiz by its share ID
 * @param {string} shareId - The unique share ID
 * @returns {Promise<Object>} - The quiz data
 */
export const fetchSharedQuiz = async (shareId) => {
  try {
    const shareRef = doc(db, "publicQuizzes", shareId);
    const shareDoc = await getDoc(shareRef);

    if (!shareDoc.exists()) {
      throw new Error("Quiz not found");
    }

    return shareDoc.data();

  } catch (error) {
    console.error("❌ Error fetching shared quiz:", error);
    throw error;
  }
};

/**
 * Generate a unique, URL-friendly share ID
 * @returns {string} - A unique share ID
 */
const generateShareId = () => {
  // Generate a random 10-character alphanumeric ID
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let shareId = '';
  for (let i = 0; i < 10; i++) {
    shareId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return shareId;
};

/**
 * Copy text to clipboard and return success status
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
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
    }
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
};
