import React from 'react';
import './DarkModeToggle.css';

const DarkModeToggle = ({ isDark, onToggle }) => {
  return (
    <div className="dark-mode-toggle-container">
      <button
        className="dark-mode-toggle"
        onClick={onToggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <div className={`toggle-track ${isDark ? 'dark' : 'light'}`}>
          <div className="toggle-thumb">
            {isDark ? '🌙' : '☀️'}
          </div>
        </div>
        <span className="toggle-label">
          {isDark ? 'Dark' : 'Light'}
        </span>
      </button>
    </div>
  );
};

export default DarkModeToggle;
