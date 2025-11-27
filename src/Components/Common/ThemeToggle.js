import React, { useState, useEffect, useCallback } from 'react';
import './ThemeToggle.css';

/**
 * Custom hook to detect and toggle dark mode
 * Uses MutationObserver to detect body.dark-mode class changes
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    return document.body.classList.contains('dark-mode');
  });

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.body.classList.contains('dark-mode'));
        }
      });
    });

    observer.observe(document.body, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const toggleDarkMode = useCallback(() => {
    const newIsDark = !document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode', newIsDark);
    localStorage.setItem('darkMode', newIsDark.toString());
  }, []);

  return [isDark, toggleDarkMode];
}

/**
 * Reusable theme toggle button component
 * Matches the premium style from QuizRoomLanding
 */
const ThemeToggle = ({ className = '' }) => {
  const [isDark, toggleDarkMode] = useDarkMode();

  return (
    <button
      className={`theme-toggle-btn ${className}`}
      onClick={toggleDarkMode}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        // Sun icon - shown in dark mode (click to switch to light)
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 2V4M12 20V22M4 12H2M22 12H20M5.64 5.64L4.22 4.22M19.78 19.78L18.36 18.36M5.64 18.36L4.22 19.78M19.78 4.22L18.36 5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ) : (
        // Moon icon - shown in light mode (click to switch to dark)
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
