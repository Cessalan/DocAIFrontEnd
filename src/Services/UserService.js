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
