import React, { useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../../Firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

// Create a context for authentication
const AuthContext = React.createContext();

// Custom hook to easily use the auth context in components
export function useAuth() {
  return useContext(AuthContext);
}

// Provider component that wraps our app and makes auth data available to any
// child component that calls useAuth()
export function AuthProvider({ children }) {

  // State for tracking the current user object
  const [currentUser, setCurrentUser] = useState(null);

  // State for tracking login status
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  // State for tracking whether the initial auth check is complete
  const [isLoading, setIsLoading] = useState(true);

  // State for user profile data from Firestore
  const [userProfile, setUserProfile] = useState(null);

  // State to track if the user has completed onboarding/profile creation
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  // Set up listener for authentication state changes when component mounts
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, initializeUser);
    return unsubscribe;
  }, []);

  // Handler function that processes authentication state changes
  async function initializeUser(user) {
    if (user) {
      // User is signed in
      setCurrentUser({ ...user });
      setIsUserLoggedIn(true);

      // Check for user profile in Firestore
      try {
        // Dynamic import to avoid circular dependencies if any, though standard import is usually fine
        const { getUserProfile } = await import('../../Services/UserService');
        const profile = await getUserProfile(user.uid);

        if (profile) {
          setUserProfile(profile);
          setIsProfileComplete(true);
        } else {
          setUserProfile(null);
          setIsProfileComplete(false);
        }
      } catch (error) {
        console.error("Error initializing user profile:", error);
        setIsProfileComplete(false);
      }

    } else {
      // User is signed out
      setCurrentUser(null);
      setUserProfile(null);
      setIsProfileComplete(false);
      setIsUserLoggedIn(false);
    }

    setIsLoading(false);
  }

  const value = useMemo(() => ({
    currentUser,
    isUserLoggedIn,
    isLoading,
    userProfile,
    isProfileComplete,
    setIsProfileComplete,
    setUserProfile
  }), [currentUser, isUserLoggedIn, isLoading, userProfile, isProfileComplete]);

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}