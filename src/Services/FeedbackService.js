import { db } from "../Firebase/config";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  doc,
  deleteDoc,
  updateDoc
} from "firebase/firestore";

/**
 * Submit user feedback to Firebase
 * @param {Object} feedbackData - Feedback data containing userId, chatId, text, type, etc.
 * @returns {Promise<Object>} - Result object with success status and feedback ID
 */
export const SubmitFeedback = async (feedbackData) => {
  try {
    console.log("📝 Submitting feedback:", feedbackData);

    // Create feedback document in "feedback" collection
    const feedbackRef = collection(db, "feedback");

    const feedbackDoc = {
      userId: feedbackData.userId,
      userEmail: feedbackData.userEmail || null,
      chatId: feedbackData.chatId || null,
      feedbackText: feedbackData.feedbackText,
      feedbackType: feedbackData.feedbackType || 'general',
      userAgent: feedbackData.userAgent || navigator.userAgent,
      language: feedbackData.language || navigator.language,
      timestamp: serverTimestamp(),
      createdAt: feedbackData.timestamp || new Date(),
      status: 'new', // new, reviewed, resolved
      metadata: {
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        platform: navigator.platform,
        vendor: navigator.vendor
      }
    };

    // Add document to Firestore
    const docRef = await addDoc(feedbackRef, feedbackDoc);

    console.log("✅ Feedback submitted successfully with ID:", docRef.id);

    return {
      success: true,
      feedbackId: docRef.id,
      message: "Feedback submitted successfully"
    };

  } catch (error) {
    console.error("❌ Error submitting feedback:", error);
    throw error;
  }
};

/**
 * Get all feedback from Firebase (DEV MODE ONLY)
 * @returns {Promise<Array>} - Array of feedback documents
 */
export const GetAllFeedback = async () => {
  try {
    console.log("📥 Fetching all feedback...");

    const feedbackRef = collection(db, "feedback");
    const feedbackQuery = query(feedbackRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(feedbackQuery);

    const feedbacks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Fetched ${feedbacks.length} feedback items`);
    return feedbacks;

  } catch (error) {
    console.error("❌ Error fetching feedback:", error);
    throw error;
  }
};

/**
 * Delete feedback by ID (DEV MODE ONLY)
 * @param {string} feedbackId - ID of feedback to delete
 * @returns {Promise<void>}
 */
export const DeleteFeedback = async (feedbackId) => {
  try {
    console.log("🗑️ Deleting feedback:", feedbackId);

    const feedbackDoc = doc(db, "feedback", feedbackId);
    await deleteDoc(feedbackDoc);

    console.log("✅ Feedback deleted successfully");

  } catch (error) {
    console.error("❌ Error deleting feedback:", error);
    throw error;
  }
};

/**
 * Update feedback status (DEV MODE ONLY)
 * @param {string} feedbackId - ID of feedback to update
 * @param {string} newStatus - New status (new, reviewed, resolved)
 * @returns {Promise<void>}
 */
export const UpdateFeedbackStatus = async (feedbackId, newStatus) => {
  try {
    console.log(`📝 Updating feedback ${feedbackId} to status: ${newStatus}`);

    const feedbackDoc = doc(db, "feedback", feedbackId);
    await updateDoc(feedbackDoc, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });

    console.log("✅ Feedback status updated successfully");

  } catch (error) {
    console.error("❌ Error updating feedback status:", error);
    throw error;
  }
};
