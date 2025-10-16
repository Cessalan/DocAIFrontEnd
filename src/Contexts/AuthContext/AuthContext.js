import React, { useContext, useEffect, useState } from 'react';
import { auth } from '../../Firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

// Create a context for authentication
// This creates a "container" that will hold our auth data and methods
const AuthContext = React.createContext();

// Custom hook to easily use the auth context in components
// This saves us from having to import useContext and AuthContext in every component
export function useAuth() {
  return useContext(AuthContext);
}

// Provider component that wraps our app and makes auth data available to any
// child component that calls useAuth()
export function AuthProvider({ children }) {

  // State for tracking the current user object
  const [currentUser, setCurrentUser] = useState(null);
  
  // State for tracking login status (provides a simple boolean for checks)
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  
  // State for tracking whether the initial auth check is complete
  // Used to prevent rendering components that depend on auth status until we know for sure
  const [isLoading, setIsLoading] = useState(true);

  // Set up listener for authentication state changes when component mounts
  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function
    // This will run whenever the user logs in or out
    const unsubscribe = onAuthStateChanged(auth, initializeUser);
    
    // Clean up subscription when component unmounts (removed from the UI)
    return unsubscribe;
  }, []) // Empty dependency array means this effect runs once on mount

  // Handler function that processes authentication state changes
  async function initializeUser(user) {
    if (user) {
      // User is signed in
      // We spread the user object to create a copy of it
      setCurrentUser({ ...user });
      // We mark the user as Logged In
      setIsUserLoggedIn(true);
    } else {
      // User is signed out
      setCurrentUser(null);
      // Mark User as Logged Out
      setIsUserLoggedIn(false);
    }
    
    // Whether signed in or not, we're done loading
    setIsLoading(false);
  }

  // Object containing all the values we want to provide to components
  const value = {
    currentUser,
    isUserLoggedIn,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Only render children when the loading is complete */}
      {/* This prevents flashing unauthenticated content */}
      {!isLoading && children}
    </AuthContext.Provider>
  );
}