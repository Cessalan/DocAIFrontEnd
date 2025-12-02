import { db } from "../Firebase/config";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * Get user progress data from Firestore
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} Progress data or null
 */
export const getUserProgress = async (uid) => {
  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      return data.progress || null;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user progress:", error);
    throw error;
  }
};

/**
 * Update user progress data in Firestore
 * @param {string} uid - User ID
 * @param {Object} progressData - Progress data to update
 * @returns {Promise<void>}
 */
export const updateUserProgress = async (uid, progressData) => {
  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      await updateDoc(userRef, {
        progress: progressData,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, {
        progress: progressData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error updating user progress:", error);
    throw error;
  }
};

/**
 * Check and update login streak
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Updated streak info
 */
export const checkAndUpdateStreak = async (uid) => {
  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!userDoc.exists()) {
      // New user - start streak at 1
      const initialProgress = {
        totalXP: 0,
        currentStreak: 1,
        longestStreak: 1,
        lastLoginDate: today,
        dailyCorrectAnswers: 0,
        dailySerumDate: null,
        topicStats: {},
      };

      await setDoc(userRef, {
        progress: initialProgress,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { currentStreak: 1, longestStreak: 1 };
    }

    const data = userDoc.data();
    const progress = data.progress || {};

    // Get last login date
    let lastLogin = progress.lastLoginDate;
    if (lastLogin?.toDate) {
      lastLogin = lastLogin.toDate();
    } else if (lastLogin) {
      lastLogin = new Date(lastLogin);
    }

    if (lastLogin) {
      lastLogin.setHours(0, 0, 0, 0);
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreak = progress.currentStreak || 0;
    let longestStreak = progress.longestStreak || 0;

    if (!lastLogin) {
      // First login ever
      newStreak = 1;
    } else if (lastLogin.getTime() === today.getTime()) {
      // Already logged in today - no change
      return { currentStreak: newStreak, longestStreak };
    } else if (lastLogin.getTime() === yesterday.getTime()) {
      // Consecutive day - increment streak
      newStreak += 1;
    } else {
      // Streak broken - reset to 1
      newStreak = 1;
    }

    // Update longest streak if needed
    if (newStreak > longestStreak) {
      longestStreak = newStreak;
    }

    // Update Firestore
    await updateDoc(userRef, {
      'progress.currentStreak': newStreak,
      'progress.longestStreak': longestStreak,
      'progress.lastLoginDate': today,
      updatedAt: serverTimestamp(),
    });

    return { currentStreak: newStreak, longestStreak };
  } catch (error) {
    console.error("Error updating streak:", error);
    throw error;
  }
};

/**
 * Record a correct answer - adds XP, updates daily serum, and topic stats
 * @param {string} uid - User ID
 * @param {string|null} topic - Quiz topic (optional)
 * @returns {Promise<Object>} Updated progress data
 */
export const recordCorrectAnswer = async (uid, topic = null) => {
  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);

    const today = new Date();
    const todayString = today.toDateString();

    if (!userDoc.exists()) {
      // Create new progress for new user
      const newProgress = {
        totalXP: 1,
        currentStreak: 1,
        longestStreak: 1,
        lastLoginDate: today,
        dailyCorrectAnswers: 1,
        dailySerumDate: today,
        topicStats: topic ? { [topic]: { correct: 1, total: 1 } } : {},
      };

      await setDoc(userRef, {
        progress: newProgress,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return newProgress;
    }

    const data = userDoc.data();
    const progress = data.progress || {};

    // Calculate new XP
    const newTotalXP = (progress.totalXP || 0) + 1;

    // Check if daily serum needs reset
    let serumDate = progress.dailySerumDate;
    if (serumDate?.toDate) {
      serumDate = serumDate.toDate();
    }
    const serumDateString = serumDate?.toDateString?.() || null;

    let dailyCorrect = progress.dailyCorrectAnswers || 0;
    if (serumDateString !== todayString) {
      // New day - reset daily counter
      dailyCorrect = 0;
    }
    dailyCorrect += 1;

    // Update topic stats
    const topicStats = { ...(progress.topicStats || {}) };
    if (topic) {
      if (!topicStats[topic]) {
        topicStats[topic] = { correct: 0, total: 0 };
      }
      topicStats[topic].correct += 1;
      topicStats[topic].total += 1;
    }

    // Update Firestore
    await updateDoc(userRef, {
      'progress.totalXP': newTotalXP,
      'progress.dailyCorrectAnswers': dailyCorrect,
      'progress.dailySerumDate': today,
      'progress.topicStats': topicStats,
      updatedAt: serverTimestamp(),
    });

    return {
      totalXP: newTotalXP,
      dailyCorrectAnswers: dailyCorrect,
      dailySerumDate: today,
      topicStats,
    };
  } catch (error) {
    console.error("Error recording correct answer:", error);
    throw error;
  }
};

/**
 * Record an incorrect answer - only updates topic stats (no XP)
 * @param {string} uid - User ID
 * @param {string} topic - Quiz topic
 * @returns {Promise<Object>} Updated topic stats
 */
export const recordIncorrectAnswer = async (uid, topic) => {
  if (!topic) return null;

  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    const topicStats = { ...(data.progress?.topicStats || {}) };

    if (!topicStats[topic]) {
      topicStats[topic] = { correct: 0, total: 0 };
    }
    topicStats[topic].total += 1;

    await updateDoc(userRef, {
      'progress.topicStats': topicStats,
      updatedAt: serverTimestamp(),
    });

    return { topicStats };
  } catch (error) {
    console.error("Error recording incorrect answer:", error);
    throw error;
  }
};
