import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../AuthContext/AuthContext';
import {
  getUserProgress,
  updateUserProgress,
  recordCorrectAnswer,
  checkAndUpdateStreak
} from '../../Services/ProgressService';

// Level thresholds
const LEVEL_THRESHOLDS = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 25 },
  { level: 3, xpRequired: 50 },
  { level: 4, xpRequired: 75 },
  { level: 5, xpRequired: 100 },
  { level: 6, xpRequired: 150 },
];

// Daily serum goal
const DAILY_SERUM_GOAL = 5;

// Create context
const ProgressContext = React.createContext();

// Custom hook for using progress context
export function useProgress() {
  return useContext(ProgressContext);
}

// Calculate level from XP
export function calculateLevel(xp) {
  let currentLevel = 1;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.xpRequired) {
      currentLevel = threshold.level;
    } else {
      break;
    }
  }
  return currentLevel;
}

// Get XP needed for next level
export function getXPForNextLevel(currentLevel) {
  const nextLevelData = LEVEL_THRESHOLDS.find(t => t.level === currentLevel + 1);
  return nextLevelData ? nextLevelData.xpRequired : null;
}

// Get XP threshold for current level
export function getXPForCurrentLevel(currentLevel) {
  const currentLevelData = LEVEL_THRESHOLDS.find(t => t.level === currentLevel);
  return currentLevelData ? currentLevelData.xpRequired : 0;
}

// Provider component
export function ProgressProvider({ children }) {
  const { currentUser, isUserLoggedIn } = useAuth();

  // Progress state
  const [progressData, setProgressData] = useState({
    totalXP: 0,
    currentLevel: 1,
    currentStreak: 0,
    longestStreak: 0,
    lastLoginDate: null,
    dailyCorrectAnswers: 0,
    dailySerumDate: null,
    topicStats: {}, // { topicName: { correct: number, total: number } }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [xpGainAnimation, setXpGainAnimation] = useState(null); // { amount: number, timestamp: number }

  // Load user progress on mount/login
  useEffect(() => {
    async function loadProgress() {
      if (!currentUser?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getUserProgress(currentUser.uid);

        if (data) {
          // Check if we need to reset daily serum (new day)
          const today = new Date().toDateString();
          const serumDate = data.dailySerumDate?.toDate?.()?.toDateString() || data.dailySerumDate;

          const updatedData = {
            totalXP: data.totalXP || 0,
            currentLevel: calculateLevel(data.totalXP || 0),
            currentStreak: data.currentStreak || 0,
            longestStreak: data.longestStreak || 0,
            lastLoginDate: data.lastLoginDate,
            dailyCorrectAnswers: serumDate === today ? (data.dailyCorrectAnswers || 0) : 0,
            dailySerumDate: serumDate === today ? data.dailySerumDate : null,
            topicStats: data.topicStats || {},
          };

          setProgressData(updatedData);

          // Update streak on login
          await checkAndUpdateStreak(currentUser.uid);

          // Reload to get updated streak
          const refreshedData = await getUserProgress(currentUser.uid);
          if (refreshedData) {
            setProgressData(prev => ({
              ...prev,
              currentStreak: refreshedData.currentStreak || 0,
              longestStreak: refreshedData.longestStreak || 0,
              lastLoginDate: refreshedData.lastLoginDate,
            }));
          }
        } else {
          // Initialize new user progress
          const initialData = {
            totalXP: 0,
            currentStreak: 1,
            longestStreak: 1,
            lastLoginDate: new Date(),
            dailyCorrectAnswers: 0,
            dailySerumDate: null,
            topicStats: {},
          };

          await updateUserProgress(currentUser.uid, initialData);
          setProgressData({
            ...initialData,
            currentLevel: 1,
          });
        }
      } catch (error) {
        console.error('Error loading progress:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (isUserLoggedIn && currentUser) {
      loadProgress();
    } else {
      setIsLoading(false);
    }
  }, [currentUser, isUserLoggedIn]);

  // Add XP for correct answer
  const addCorrectAnswer = useCallback(async (topic = null) => {
    if (!currentUser?.uid) return;

    try {
      const result = await recordCorrectAnswer(currentUser.uid, topic);

      if (result) {
        setProgressData(prev => ({
          ...prev,
          totalXP: result.totalXP,
          currentLevel: calculateLevel(result.totalXP),
          dailyCorrectAnswers: result.dailyCorrectAnswers,
          dailySerumDate: result.dailySerumDate,
          topicStats: result.topicStats || prev.topicStats,
        }));

        // Trigger +1 XP animation
        setXpGainAnimation({ amount: 1, timestamp: Date.now() });
      }
    } catch (error) {
      console.error('Error recording correct answer:', error);
    }
  }, [currentUser]);

  // Record an incorrect answer (for topic stats only, no XP)
  const addIncorrectAnswer = useCallback(async (topic = null) => {
    if (!currentUser?.uid || !topic) return;

    try {
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../Firebase/config');

      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        const topicStats = data.progress?.topicStats || {};

        if (!topicStats[topic]) {
          topicStats[topic] = { correct: 0, total: 0 };
        }
        topicStats[topic].total += 1;

        await updateDoc(userRef, {
          'progress.topicStats': topicStats,
        });

        setProgressData(prev => ({
          ...prev,
          topicStats,
        }));
      }
    } catch (error) {
      console.error('Error recording incorrect answer:', error);
    }
  }, [currentUser]);

  // Toggle dashboard
  const toggleDashboard = useCallback(() => {
    setDashboardOpen(prev => !prev);
  }, []);

  const closeDashboard = useCallback(() => {
    setDashboardOpen(false);
  }, []);

  // Computed values
  const xpForNextLevel = getXPForNextLevel(progressData.currentLevel);
  const xpForCurrentLevel = getXPForCurrentLevel(progressData.currentLevel);
  const xpProgress = xpForNextLevel
    ? progressData.totalXP - xpForCurrentLevel
    : progressData.totalXP;
  const xpNeeded = xpForNextLevel
    ? xpForNextLevel - xpForCurrentLevel
    : 0;

  const serumPercentage = Math.min(
    (progressData.dailyCorrectAnswers / DAILY_SERUM_GOAL) * 100,
    100
  );
  const isSerumComplete = progressData.dailyCorrectAnswers >= DAILY_SERUM_GOAL;

  // Clear animation after it plays
  const clearXpAnimation = useCallback(() => {
    setXpGainAnimation(null);
  }, []);

  const value = {
    // Data
    ...progressData,
    xpProgress,
    xpNeeded,
    xpForNextLevel,
    serumPercentage,
    isSerumComplete,
    dailySerumGoal: DAILY_SERUM_GOAL,
    levelThresholds: LEVEL_THRESHOLDS,

    // State
    isLoading,
    dashboardOpen,
    xpGainAnimation,

    // Actions
    addCorrectAnswer,
    addIncorrectAnswer,
    toggleDashboard,
    closeDashboard,
    clearXpAnimation,
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}
