import { db } from "../Firebase/config";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * Fetches the user profile from Firestore.
 * @param {string} uid - The user's unique ID.
 * @returns {Promise<Object|null>} The user profile data or null if not found.
 */
export const getUserProfile = async (uid) => {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            return userDoc.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        throw error;
    }
};

/**
 * Creates a new user profile in Firestore.
 * @param {string} uid - The user's unique ID.
 * @param {Object} data - The initial profile data (e.g., onboarding responses).
 * @returns {Promise<void>}
 */
export const createUserProfile = async (uid, data) => {
    try {
        const userDocRef = doc(db, "users", uid);
        await setDoc(userDocRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error creating user profile:", error);
        throw error;
    }
};

/**
 * Updates an existing user profile in Firestore.
 * @param {string} uid - The user's unique ID.
 * @param {Object} data - The data to update.
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (uid, data) => {
    try {
        const userDocRef = doc(db, "users", uid);
        await updateDoc(userDocRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating user profile:", error);
        throw error;
    }
};

/**
 * Marks that the user has completed their first upload.
 * This is used to ensure the "wow effect" only shows once.
 * @param {string} uid - The user's unique ID.
 * @returns {Promise<void>}
 */
export const markFirstUploadComplete = async (uid) => {
    try {
        const userDocRef = doc(db, "users", uid);
        await updateDoc(userDocRef, {
            hasCompletedFirstUpload: true,
            firstUploadCompletedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error marking first upload complete:", error);
        throw error;
    }
};

/**
 * Determines the "wow effect" configuration based on onboarding preferences.
 * Returns the recommended action and personalized message key for first-time upload.
 *
 * @param {string} studyGoal - "NCLEX Prep", "Course Exam", or "General Review"
 * @param {string} reviewFormat - "Transfer to flashcard apps", "Save scores and track progress", or "Print or copy content manually"
 * @returns {{ actionId: string, messageKey: string, ctaKey: string } | null}
 */
export const getWowEffectConfig = (studyGoal, reviewFormat) => {
    // Validate inputs - skip for dev mode or missing data
    if (!studyGoal || !reviewFormat) return null;
    if (studyGoal.includes('Dev') || studyGoal.includes('Skip')) return null;
    if (reviewFormat.includes('Dev') || reviewFormat.includes('Skip')) return null;

    // Mapping based on reviewFormat (primary signal)
    if (reviewFormat === 'Flashcards') {
        return {
            actionId: 'flashcards',
            messageKey: 'wowEffect.flashcards',
            ctaKey: 'wowEffect.cta.flashcards'
        };
    }

    if (reviewFormat === 'Practice Questions') {
        // Study Journey for all "track progress" users - it's our best feature for this
        return {
            actionId: 'studyjourney',
            messageKey: 'wowEffect.studyjourney',
            ctaKey: 'wowEffect.cta.studyjourney'
        };
    }

    if (reviewFormat === 'Visual Concept Maps') {
        return {
            actionId: 'mindmap',
            messageKey: 'wowEffect.mindmap',
            ctaKey: 'wowEffect.cta.mindmap'
        };
    }
    
    if (reviewFormat === 'Audio Summaries') {
        return {
            actionId: 'audio',
            messageKey: 'wowEffect.audio',
            ctaKey: 'wowEffect.cta.audio'
        };
    }

    // Fallback - shouldn't reach here with valid data
    return null;
};
