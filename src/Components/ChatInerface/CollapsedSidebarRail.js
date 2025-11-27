import React from 'react';
import { useTranslation } from 'react-i18next';
import './CollapsedSidebarRail.css';

/**
 * CollapsedSidebarRail - A slim icon rail shown when sidebar is collapsed
 * Similar to Gemini/Claude/ChatGPT collapsed sidebar behavior
 */
const CollapsedSidebarRail = ({ onExpandSidebar, onNewChat, isDarkMode }) => {
  const { t } = useTranslation();

  return (
    <div className={`collapsed-sidebar-rail ${isDarkMode ? 'dark' : ''}`}>
      {/* Expand/Menu button */}
      <button
        className="rail-icon-button menu-button"
        onClick={onExpandSidebar}
        data-tooltip={t('side.expandSidebar')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      {/* New Chat button */}
      <button
        className="rail-icon-button new-chat-button"
        onClick={onNewChat}
        data-tooltip={t('side.newChat')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"></path>
        </svg>
      </button>

      {/* Spacer to push bottom items down */}
      <div className="rail-spacer"></div>

      {/* Chat history icon */}
      <button
        className="rail-icon-button"
        onClick={onExpandSidebar}
        data-tooltip={t('side.chats')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    </div>
  );
};

export default CollapsedSidebarRail;
