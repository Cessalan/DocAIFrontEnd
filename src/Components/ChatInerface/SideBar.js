import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { handleSignOut } from "../../Firebase/auth";
import { db, auth } from "../../Firebase/config";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  getDoc
} from "firebase/firestore";
import { loadFilesForChat } from '../../Services/FireBaseFiles.js';
import { DeleteChat } from "../../Services/FireBaseServiceChats.js";
import DarkModeToggle from './DarkModeToggle';
import FeedbackButton from './FeedbackButton';
import FeedbackViewer from './FeedbackViewer';
import { SubmitFeedback } from '../../Services/FeedbackService';
import '../../index.css';

// translation
import { useTranslation } from 'react-i18next';

const SideBar = ({ user, activeChatId, onChatSelected, onCloseSidebar, onViewModeChange }) => {
  const navigate = useNavigate();

  // Development mode detection
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  // Feedback viewer state (dev mode only)
  const [showFeedbackViewer, setShowFeedbackViewer] = useState(false);
  const [exportingOnboarding, setExportingOnboarding] = useState(false);

  // Dev mode: Toggle between viewing all chats or only user's chats
  const [viewAllChats, setViewAllChats] = useState(() => {
    // Check localStorage for saved preference (dev mode only)
    if (isDevelopment) {
      const saved = localStorage.getItem('viewAllChats');
      return saved === 'true';
    }
    return false; // Non-dev users always see only their chats
  });

  // Notify parent when viewAllChats changes
  useEffect(() => {
    if (onViewModeChange) {
      onViewModeChange(viewAllChats);
    }
  }, [viewAllChats, onViewModeChange]);

  // Apply dark mode class to body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    // Save preference
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const handleDarkModeToggle = () => {
    setIsDarkMode(prev => !prev);
  };

  const handleViewModeToggle = () => {
    const newValue = !viewAllChats;
    setViewAllChats(newValue);
    // Save preference to localStorage (dev mode only)
    if (isDevelopment) {
      localStorage.setItem('viewAllChats', newValue);
    }
  };
  
  const [chats, setChats] = useState([]);
  const [hoveredChatId, setHoveredChatId] = useState(null);

  // translation
  const { t } = useTranslation();

  // State for file counts
  const [chatFileCounts, setChatFileCounts] = useState({});

  // Track which chat IDs we've already loaded file counts for
  const loadedFileCountsRef = useRef(new Set());

  // Function to load file count for a specific chat using existing loadFilesForChat
  const loadFileCountForChat = async (chatId) => {
    try {
      const files = await loadFilesForChat(chatId);
      return files ? files.length : 0;
    } catch (error) {
      console.error("Error loading file count for chat:", chatId, error);
      return 0;
    }
  };

  // Load file counts only for NEW chats (not already loaded)
  const loadFileCountsForNewChats = async (chatList) => {
    // Find chats we haven't loaded yet
    const newChats = chatList.filter(chat => !loadedFileCountsRef.current.has(chat.id));

    if (newChats.length === 0) return;

    // Load counts for new chats only (batch of 3 at a time to avoid overwhelming browser)
    const batchSize = 3;
    for (let i = 0; i < newChats.length; i += batchSize) {
      const batch = newChats.slice(i, i + batchSize);
      const countPromises = batch.map(async (chat) => {
        const count = await loadFileCountForChat(chat.id);
        return { chatId: chat.id, count };
      });

      const results = await Promise.all(countPromises);

      // Update state and tracking
      setChatFileCounts(prev => {
        const updated = { ...prev };
        results.forEach(({ chatId, count }) => {
          updated[chatId] = count;
          loadedFileCountsRef.current.add(chatId);
        });
        return updated;
      });
    }
  };

  // Load all chats AND their file counts
  useEffect(() => {
    if (!user) return;

    const chatsRef = collection(db, "chats");

    // Build query based on view mode
    // In dev mode with viewAllChats=true: show all chats
    // Otherwise: show only user's chats
    const chatQuery = isDevelopment && viewAllChats
      ? query(
          chatsRef,
          orderBy("updatedAt", "desc")  // All chats, sorted by most recent
        )
      : query(
          chatsRef,
          where("userId", "==", user.uid), // Only user's chats
          orderBy("updatedAt", "desc")     // Sorted by most recent
        );

    const unsubscribe = onSnapshot(chatQuery, async (snapshot) => {
      const updatedChats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChats(updatedChats);

      // Only load file counts for NEW chats (prevents repeated Storage calls on every Firestore update)
      if (updatedChats.length > 0) {
        await loadFileCountsForNewChats(updatedChats);
      }
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
      // Clear the loaded tracking when dependencies change
      loadedFileCountsRef.current.clear();
    };
  }, [user, viewAllChats, isDevelopment]); // Re-run when viewAllChats changes
  

  const handleNewChat = async () => {
    const newChat = {
      userId: user.uid,
      title: "Chat ...",
      description: "New conversation started.",
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "chats"), newChat);
    const newChatId = docRef.id;

    setChats([{ id: newChatId, ...newChat }, ...chats]);

    // Initialize file count for new chat
    setChatFileCounts(prev => ({ ...prev, [newChatId]: 0 }));

    if (onChatSelected) onChatSelected(newChatId);
  };

  const handleSelectChat = (chatId) => {
    console.log("Clicked chat: " + chatId + " from SideBar");

    if (onChatSelected) {
      onChatSelected(chatId);
    }

    // Close sidebar after selecting a chat
    if (onCloseSidebar) {
      onCloseSidebar();
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation(); // Prevent chat selection

    if (!window.confirm("Supprimer ce chat? Cette action est irréversible.")) {
      return;
    }

    try {
      await DeleteChat(chatId);

      // If deleted chat was active, clear selection
      if (activeChatId === chatId) {
        if (onChatSelected) onChatSelected(null);
      }
    } catch (error) {
      alert("Échec de la suppression: " + error.message);
    }
  };

  const handleFeedbackSubmit = async (feedbackData) => {
    try {
      await SubmitFeedback(feedbackData);
      console.log("✅ Feedback submitted successfully");
    } catch (error) {
      console.error("❌ Error submitting feedback:", error);
      throw error;
    }
  };

  // Export all users' onboarding data to JSON (dev mode only)
  const handleExportOnboarding = async () => {
    setExportingOnboarding(true);
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      const onboardingData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Only extract onboarding data, exclude email and displayName
        return {
          odtOfUSer: doc.id,
          onboarding: data.onboarding || null
        };
      }).filter(item => item.onboarding !== null); // Only include users with onboarding data

      // Create and download JSON file
      const jsonString = JSON.stringify(onboardingData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `onboarding-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ Exported onboarding data for ${onboardingData.length} users`);
    } catch (error) {
      console.error("❌ Error exporting onboarding data:", error);
      alert("Failed to export onboarding data: " + error.message);
    } finally {
      setExportingOnboarding(false);
    }
  };

  // Assume 'chat' is a document retrieved from Firestore, 
// and 'updatedAt' is a Firebase Timestamp field.

const getchatDate = (timestamp) => {
    // 1. Check if the timestamp is null (e.g., if the document is still being created)
    if (!timestamp) {
        return "";
    }

    try{
       const date = timestamp.toDate(); 

    // 3. Check for an Invalid Date object (safety check)
    if (isNaN(date.getTime())) {
        return "Error Date"; 
    }
    
    // 4. Format and return the valid JavaScript Date
    const formattedDate = date.toLocaleDateString();
    return formattedDate;

    }catch(exception)
    {


    }
    // 2. Convert the Firebase Timestamp object to a JavaScript Date object
   
}

// In your React Component:
// <p>Last Updated: {getchatDate(chat.updatedAt)}</p>
  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-title">{t('side.chats')}</div>
      </div>

      <button className="new-chat-button" onClick={handleNewChat}>
        + {t('side.newChat')}
      </button>  

      <div className="conversations-list">
        {chats.map((chat) => (
         <div
              key={chat.id}
              className={`conversation-item ${activeChatId === chat.id ? "active" : ""} ${chat.isStudySession ? "study-session" : ""}`}
              onClick={() => handleSelectChat(chat.id)}
              onMouseEnter={() => setHoveredChatId(chat.id)}
              onMouseLeave={() => setHoveredChatId(null)}
              style={{ position: 'relative' }}
            >
              {/* Study session icon */}
              {chat.isStudySession && (
                <div className="study-session-icon" title={t('side.studySession', 'Study Session')}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3L2 9L12 15L22 9L12 3Z" fill="currentColor" opacity="0.9"/>
                    <path d="M6 12V17C6 17 9 20 12 20C15 20 18 17 18 17V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M20 10V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="20" cy="17.5" r="1.5" fill="currentColor"/>
                  </svg>
                </div>
              )}

              {/* File count badge - only show for non-study sessions */}
              {!chat.isStudySession && chatFileCounts[chat.id] > 0 && (
                <div className="file-count-badge">
                  <span className="paperclip-icon">📎</span>
                  <span className="file-count-number">{chatFileCounts[chat.id]}</span>
                </div>
              )}
              
              {/* Delete button - appears on hover (DEV MODE ONLY) */}
              {isDevelopment && hoveredChatId === chat.id && (
                <button
                  className="delete-chat-button"
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  title="Delete chat (messages, files, embeddings)"
                >
                  🗑️
                </button>
              )}
              
              <div className="conversation-details">
                {/* Header section - now stacked vertically */}
                <div className="conversation-header">
                  <span className="conversation-name">{chat.title}</span>
                  
                  {/* Metadata row: date + user info (only show in dev mode when viewing all chats) */}
                  <div className="conversation-metadata">
                    <span className="conversation-time">
                      {getchatDate(chat.updatedAt)}
                    </span>
                    {isDevelopment && viewAllChats && (
                      <>
                        <span className="conversation-metadata-separator">•</span>
                        <span className="conversation-user-id">
                          {chat.userId}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Last message preview */}
                <div className="conversation-message">
                  {chat.lastMessage?.length > 40
                    ? `${chat.lastMessage.substring(0, 40)}...`
                    : chat.lastMessage}
                </div>
              </div>
            </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <DarkModeToggle isDark={isDarkMode} onToggle={handleDarkModeToggle} />
        <FeedbackButton
          userId={user?.uid}
          userEmail={user?.email}
          activeChatId={activeChatId}
          onFeedbackSubmit={handleFeedbackSubmit}
        />
        {isDevelopment && (
          <>
            <div className="nav-item" onClick={() => setShowFeedbackViewer(true)}>
              🔍 View Feedbacks (Dev)
            </div>
            <div
              className="nav-item"
              onClick={handleExportOnboarding}
              style={{ opacity: exportingOnboarding ? 0.6 : 1 }}
            >
              {exportingOnboarding ? '⏳ Exporting...' : '📤 Export Onboarding (Dev)'}
            </div>
            {/* Dev Mode: View Toggle */}
            <div className="chat-view-toggle-container">
              <button
                className="chat-view-toggle"
                onClick={handleViewModeToggle}
                aria-label={viewAllChats ? 'Switch to my chats only' : 'Switch to all chats'}
              >
                <div className={`toggle-track ${viewAllChats ? 'all-chats' : 'my-chats'}`}>
                  <div className="toggle-thumb">
                    {viewAllChats ? '👥' : '👤'}
                  </div>
                </div>
                <span className="toggle-label">
                  {viewAllChats ? 'All Chats' : 'My Chats'}
                </span>
              </button>
            </div>
          </>
        )}
        <div className="nav-item logout-item" onClick={handleSignOut}>
          {t('side.logout')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
      </div>

      {/* Feedback Viewer Modal (Dev Mode Only) */}
      {showFeedbackViewer && (
        <FeedbackViewer onClose={() => setShowFeedbackViewer(false)} />
      )}
    </>
  );
};

export default SideBar;