import { useState, useEffect } from 'react';
import './SuggestedPrompts.css';
import { useTranslation } from 'react-i18next';

/**
 * SuggestedPrompts Component - Compact Chat Integration
 * * Displays AI-generated suggestions as a compact card in the chat flow.
 * Does NOT take over screen or block scrolling.
 * * @param {Array} suggestions - Array of suggestion strings from backend
 * @param {Function} onSuggestionClick - Callback when user clicks a suggestion
 * @param {Boolean} isLoading - Whether AI is currently responding
 */
const SuggestedPrompts = ({ suggestions = [], onSuggestionClick, isLoading = false }) => {

  const { t, i18n } = useTranslation();
  const [cleanedSuggestions, setCleanedSuggestions] = useState([]);


  // ============================================
  // AGGRESSIVE CLEANING - Remove ALL artifacts
  // ============================================
  useEffect(() => {
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      setCleanedSuggestions([]);
      return;
    }

    // ... (cleaning logic is unchanged) ...
    
    console.log("🔍 RAW suggestions received:", suggestions);

    const cleaned = suggestions
      .map(item => {
        let text = String(item);
        text = text.replace(/["'`]/g, '');
        text = text.replace(/[\[\]{}]/g, '');
        text = text.replace(/[,;.]+$/g, '');
        text = text.replace(/^\s*json\s*/i, '');
        text = text.replace(/[`↩]/g, '');
        text = text.trim();
        return text;
      })
      .filter(text => {
        return text.length > 3 && 
               /[a-zA-Z]/.test(text) && 
               !/^[\[\]{},;.]+$/.test(text);
      });

    console.log("✅ CLEANED suggestions:", cleaned);
    setCleanedSuggestions(cleaned);
  }, [suggestions]);

  // ============================================
  // CLICK HANDLER
  // ============================================
  const handleClick = (suggestion) => {
    if (isLoading) return;
    
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    onSuggestionClick(suggestion);
  };

  // ============================================
  // KEYBOARD ACCESSIBILITY
  // ============================================
  const handleKeyDown = (e, suggestion) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(suggestion);
    }
  };

  // Don't render if no valid suggestions
  if (cleanedSuggestions.length === 0) {
    return null;
  }



  return (
    <div className="suggestions-wrapper">
      <div className="suggestions-card">
        <div className="suggestions-header">
          <span className="suggestions-icon">💡</span>
          <span className="suggestions-title">{t('chat.continuelearning')}</span>
        </div>
        
        <div className="suggestions-list">
          {cleanedSuggestions.map((suggestion, index) => (
            <button
              key={`suggestion-${index}-${suggestion.substring(0, 20)}`}
              className={`suggestion-item ${isLoading ? 'disabled' : ''}`}
              onClick={() => handleClick(suggestion)}
              onKeyDown={(e) => handleKeyDown(e, suggestion)}
              disabled={isLoading}
              tabIndex={0}
              aria-label={`Ask: ${suggestion}`}
            >
              <svg 
                className="suggestion-icon-arrow" 
                width="14" 
                height="14" 
                viewBox="0 0 16 16" 
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* === ICON PATH UPDATED HERE === */}
                <path 
                  d="M4 4V12H12M9 9L12 12L9 15" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <span className="suggestion-text">{suggestion}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuggestedPrompts;