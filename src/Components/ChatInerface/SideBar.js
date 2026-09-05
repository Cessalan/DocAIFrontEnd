import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../../Firebase/config";
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  limit
} from "firebase/firestore";
import { loadFilesForChat } from '../../Services/FireBaseFiles.js';
import { DeleteChat, RenameChat } from "../../Services/FireBaseServiceChats.js";
import DarkModeToggle from './DarkModeToggle';
import FeedbackButton from './FeedbackButton';
import DrillTargetIcon from '../ExamDrill/DrillTargetIcon';
import OnboardingViewer from './OnboardingViewer';
import ProMembersViewer from './ProMembersViewer';
import { SubmitFeedback } from '../../Services/FeedbackService';
import { fetchSignals } from '../../Services/SatisfactionQueries';
import { normalizeRow } from '../Admin/satisfactionRollup';
import AccountModal from '../Common/AccountModal';
import AccountRow from '../Common/AccountRow';
import '../../index.css';

// translation
import { useTranslation } from 'react-i18next';
import { examCountdown } from './examCountdown';

const SideBar = ({ user, activeChatId, onChatSelected, onCloseSidebar, onViewModeChange, impersonatedUid, onImpersonateUser, onStopImpersonating }) => {
  const navigate = useNavigate();

  // Development mode detection
  const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  // Onboarding viewer state (dev mode only)
  const [showOnboardingViewer, setShowOnboardingViewer] = useState(false);

  // Pro members viewer state (dev mode only)
  const [showProMembers, setShowProMembers] = useState(false);

  /* Satisfaction at a glance (dev mode only).
     The dashboard answers everything; this badge only has to make it worth
     opening. It shows negatives in the last 7 days, so silence reads as "ok"
     rather than as an empty screen nobody bothered to check. Failures leave the
     badge off — a wrong count here is worse than no count. */
  const [satisfactionBadge, setSatisfactionBadge] = useState(null);

  useEffect(() => {
    if (!isDevelopment) return;
    let cancelled = false;
    fetchSignals({ days: 7, max: 500 })
      .then((rows) => {
        if (cancelled) return;
        const negatives = rows
          .map(normalizeRow)
          .filter((r) => r.sentiment < 0).length;
        setSatisfactionBadge(negatives);
      })
      .catch(() => { /* badge stays hidden */ });
    return () => { cancelled = true; };
  }, [isDevelopment]);

  // Account modal (profile + subscription status)
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Dev mode: impersonate any user by UID or email
  const [viewAsInput, setViewAsInput] = useState("");
  const [viewAsError, setViewAsError] = useState(null);

  const handleViewAsSubmit = async (e) => {
    e.preventDefault();
    const input = viewAsInput.trim();
    if (!input) return;
    setViewAsError(null);

    let uid = input;
    if (input.includes("@")) {
      // Resolve email -> uid via the userEmail field on chat docs
      try {
        const chatsRef = collection(db, "chats");
        let snap = await getDocs(query(chatsRef, where("userEmail", "==", input), limit(1)));
        if (snap.empty && input !== input.toLowerCase()) {
          snap = await getDocs(query(chatsRef, where("userEmail", "==", input.toLowerCase()), limit(1)));
        }
        if (snap.empty) {
          setViewAsError("No chats found for that email");
          return;
        }
        uid = snap.docs[0].data().userId;
        if (!uid) {
          setViewAsError("Chat found but it has no userId");
          return;
        }
      } catch (err) {
        console.error("View-as email lookup failed:", err);
        setViewAsError("Email lookup failed");
        return;
      }
    }

    if (onImpersonateUser) onImpersonateUser(uid);
    setViewAsInput("");
  };

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

  // Dev mode: filter the "All Chats" list down to one user's chats
  const [userIdFilterInput, setUserIdFilterInput] = useState("");
  const [userIdFilter, setUserIdFilter] = useState(null);

  // 3-dot menu state
  const [menuOpenChatId, setMenuOpenChatId] = useState(null);
  const [renamingChatId, setRenamingChatId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteModalChatId, setDeleteModalChatId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef(null);
  const renameInputRef = useRef(null);

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

    // Build query based on view mode:
    // 1. Impersonating a user → show only that user's chats
    // 2. Dev "view all" mode → every chat, or one user's if a userId filter is set
    // 3. Normal mode → show only the signed-in user's chats
    const chatQuery = isDevelopment && impersonatedUid
      ? query(chatsRef, where("userId", "==", impersonatedUid), orderBy("updatedAt", "desc"))
      : isDevelopment && viewAllChats
      ? (userIdFilter
          ? query(chatsRef, where("userId", "==", userIdFilter), orderBy("updatedAt", "desc"))
          : query(chatsRef, orderBy("updatedAt", "desc")))
      : query(chatsRef, where("userId", "==", user.uid), orderBy("updatedAt", "desc"));

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
  }, [user, viewAllChats, isDevelopment, impersonatedUid, userIdFilter]); // Re-run when impersonation, view mode, or user filter changes
  

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

  const handleDeleteChat = async () => {
    if (!deleteModalChatId) return;
    setIsDeleting(true);
    try {
      await DeleteChat(deleteModalChatId);
      if (activeChatId === deleteModalChatId) {
        if (onChatSelected) onChatSelected(null);
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
    setIsDeleting(false);
    setDeleteModalChatId(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Ignore clicks on the trigger button itself (toggle handler manages that)
      if (e.target.closest('.chat-menu-trigger')) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenChatId(null);
      }
    };
    if (menuOpenChatId) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuOpenChatId]);

  // Auto-focus rename input when entering rename mode
  useEffect(() => {
    if (renamingChatId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingChatId]);

  const handleMenuToggle = (e, chatId) => {
    e.stopPropagation();
    setMenuOpenChatId(prev => prev === chatId ? null : chatId);
  };

  const handleStartRename = (e, chat) => {
    e.stopPropagation();
    setMenuOpenChatId(null);
    setRenamingChatId(chat.id);
    setRenameValue(chat.title || "");
  };

  const handleConfirmRename = async (chatId) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === chats.find(c => c.id === chatId)?.title) {
      setRenamingChatId(null);
      return;
    }
    try {
      await RenameChat(chatId, trimmed);
    } catch (error) {
      console.error("Rename failed:", error);
    }
    setRenamingChatId(null);
  };

  const handleRenameKeyDown = (e, chatId) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmRename(chatId);
    } else if (e.key === "Escape") {
      setRenamingChatId(null);
    }
  };

  const handleMenuDelete = (e, chatId) => {
    e.stopPropagation();
    setMenuOpenChatId(null);
    setDeleteModalChatId(chatId);
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

      <div className="sidebar-actions-row">
        <button className="new-chat-button" onClick={handleNewChat}>
          + {t('side.newChat')}
        </button>
      </div>

      {isDevelopment && viewAllChats && !impersonatedUid && (
        <div style={{ padding: '0 12px 8px' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setUserIdFilter(userIdFilterInput.trim() || null);
            }}
            style={{ display: 'flex', gap: 4, alignItems: 'center' }}
          >
            <input
              type="text"
              value={userIdFilterInput}
              onChange={(e) => setUserIdFilterInput(e.target.value)}
              placeholder="Filter by user ID…"
              spellCheck={false}
              style={{
                flex: 1,
                minWidth: 0,
                boxSizing: 'border-box',
                background: 'rgba(255,107,53,0.08)',
                border: '1px solid rgba(255,107,53,0.4)',
                borderRadius: 6,
                padding: '5px 8px',
                fontSize: '12px',
                color: 'inherit',
                outline: 'none'
              }}
              title="Dev only: press Enter to show only this user's chats"
            />
            {userIdFilter && (
              <button
                type="button"
                onClick={() => { setUserIdFilter(null); setUserIdFilterInput(""); }}
                title="Clear user filter"
                style={{
                  background: 'rgba(255,107,53,0.15)',
                  border: '1px solid rgba(255,107,53,0.4)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: '12px',
                  color: '#ff6b35',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
          </form>
          {userIdFilter && (
            <div style={{ fontSize: '11px', color: '#ff6b35', marginTop: 3 }}>
              Showing chats of {userIdFilter.slice(0, 14)}… ({chats.length})
            </div>
          )}
        </div>
      )}
      <div className="conversations-list">
        {chats.map((chat) => (
         <div
              key={chat.id}
              className={`conversation-item ${activeChatId === chat.id ? "active" : ""} ${chat.isStudySession ? "study-session" : ""} ${chat.drill ? "drill-chat" : ""}`}
              onClick={() => { if (!renamingChatId) handleSelectChat(chat.id); }}
              onMouseEnter={() => setHoveredChatId(chat.id)}
              onMouseLeave={() => setHoveredChatId(null)}
              style={{ position: 'relative' }}
            >
              {/* Top-right action row: badge/icon + 3-dot menu */}
              <div className="chat-actions-row">
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

                {/* Drill icon. A target rather than another cap: the drill is
                    aimed at what she is weak on, and it has to be tellable
                    from a study plan at a glance.

                    Shown for any chat that HAS a drill, not one that has been
                    answered: `drill` is written the moment the examiner opens,
                    and a student who left on question one still has a drill
                    waiting. It is the same drawing the path chooser offers, so
                    the mark on the chat matches the door she came through. */}
                {chat.drill && (
                  <div className="drill-chat-icon" title={t('side.drillSession', 'Exam drill')}>
                    <DrillTargetIcon />
                  </div>
                )}

                {/* File count badge — suppressed once the chat carries a
                    plan or a drill, so the row keeps one marker, not three. */}
                {!chat.isStudySession && !chat.drill && chatFileCounts[chat.id] > 0 && (
                  <div className="file-count-badge">
                    <span className="paperclip-icon">📎</span>
                    <span className="file-count-number">{chatFileCounts[chat.id]}</span>
                  </div>
                )}

                {/* 3-dot menu button */}
                <button
                  className={`chat-menu-trigger ${menuOpenChatId === chat.id ? 'active' : ''}`}
                  onClick={(e) => handleMenuToggle(e, chat.id)}
                  aria-label="Chat options"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="8" cy="3" r="1.5"/>
                    <circle cx="8" cy="8" r="1.5"/>
                    <circle cx="8" cy="13" r="1.5"/>
                  </svg>
                </button>
              </div>

              {/* Dropdown menu */}
              {menuOpenChatId === chat.id && (
                <div className="chat-menu-dropdown" ref={menuRef}>
                  <button
                    className="chat-menu-item"
                    onClick={(e) => handleStartRename(e, chat)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    </svg>
                    <span>{t('side.rename')}</span>
                  </button>
                  <div className="chat-menu-divider" />
                  <button
                    className="chat-menu-item delete"
                    onClick={(e) => handleMenuDelete(e, chat.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                    <span>{t('side.delete')}</span>
                  </button>
                </div>
              )}

              <div className="conversation-details">
                {/* Header section */}
                <div className="conversation-header">
                  {/* Inline rename input OR title */}
                  {renamingChatId === chat.id ? (
                    <input
                      ref={renameInputRef}
                      className="chat-rename-input"
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, chat.id)}
                      onBlur={() => handleConfirmRename(chat.id)}
                      onClick={(e) => e.stopPropagation()}
                      maxLength={100}
                    />
                  ) : (
                    <span className="conversation-name">{chat.title}</span>
                  )}

                  {/* Metadata row */}
                  <div className="conversation-metadata">
                    <span className="conversation-time">
                      {getchatDate(chat.updatedAt)}
                    </span>
                    {/* Exam timing, so the list can be read for urgency rather
                        than just recency. Past exams are shown too — knowing a
                        chat can be skipped is half of prioritising. */}
                    {(() => {
                      const exam = examCountdown(chat.examDate);
                      if (!exam) return null;
                      return (
                        <>
                          <span className="conversation-metadata-separator">•</span>
                          <span className={`conversation-exam conversation-exam--${exam.tone}`}>
                            {t(exam.key, exam.fallback, exam.params)}
                          </span>
                        </>
                      );
                    })()}
                    {isDevelopment && viewAllChats && !impersonatedUid && (
                      <>
                        <span className="conversation-metadata-separator">•</span>
                        <span
                          className="conversation-user-id"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onImpersonateUser) onImpersonateUser(chat.userId);
                          }}
                          title="Click to view as this user"
                          style={{
                            cursor: 'pointer',
                            background: 'rgba(255,107,53,0.15)',
                            borderRadius: 3,
                            padding: '1px 5px',
                            border: '1px solid rgba(255,107,53,0.4)',
                            fontSize: '11px'
                          }}
                        >
                          👁 {chat.userId?.slice(0, 8)}…
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
        {isDevelopment && impersonatedUid && (
          <div
            onClick={onStopImpersonating}
            style={{
              background: 'rgba(255,107,53,0.15)',
              border: '1px solid rgba(255,107,53,0.5)',
              borderRadius: 6,
              padding: '6px 10px',
              marginBottom: 8,
              cursor: 'pointer',
              fontSize: '12px',
              color: '#ff6b35',
              fontWeight: 600,
              textAlign: 'center'
            }}
            title="Click to stop impersonating"
          >
            👁 Viewing as {impersonatedUid.slice(0, 10)}…<br />
            <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.8 }}>Click to exit</span>
          </div>
        )}
        {isDevelopment && !impersonatedUid && (
          <form onSubmit={handleViewAsSubmit} style={{ marginBottom: 8 }}>
            <input
              type="text"
              value={viewAsInput}
              onChange={(e) => { setViewAsInput(e.target.value); setViewAsError(null); }}
              placeholder="👁 View as: UID or email…"
              spellCheck={false}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(255,107,53,0.08)',
                border: '1px solid rgba(255,107,53,0.4)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: '12px',
                color: 'inherit',
                outline: 'none'
              }}
              title="Dev only: press Enter to view the app as this user"
            />
            {viewAsError && (
              <div style={{ fontSize: '11px', color: '#ff6b35', marginTop: 3 }}>
                {viewAsError}
              </div>
            )}
          </form>
        )}
        <div className="sidebar-footer-toggles">
          <DarkModeToggle isDark={isDarkMode} onToggle={handleDarkModeToggle} />
          {isDevelopment && (
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
          )}
        </div>
        <FeedbackButton
          userId={user?.uid}
          userEmail={user?.email}
          activeChatId={activeChatId}
          onFeedbackSubmit={handleFeedbackSubmit}
        />
        {isDevelopment && (
          <div className="nav-item" onClick={() => setShowOnboardingViewer(true)}>
            👁 View Onboarding (Dev)
          </div>
        )}
        {isDevelopment && (
          <div className="nav-item" onClick={() => setShowProMembers(true)}>
            💎 Pro Members (Dev)
          </div>
        )}
        {isDevelopment && (
          <div className="nav-item" onClick={() => navigate('/admin/satisfaction')}>
            📊 Satisfaction (Dev)
            {satisfactionBadge !== null && (
              <span className={`nav-item-badge${satisfactionBadge > 0 ? ' alert' : ''}`}>
                {satisfactionBadge > 0 ? `${satisfactionBadge} 👎` : 'ok'}
              </span>
            )}
          </div>
        )}
        <AccountRow
          user={{
            uid: user?.uid,
            email: user?.email,
            displayName: user?.displayName,
            photoURL: user?.photoURL
          }}
          onOpenAccount={() => setShowAccountModal(true)}
        />
      </div>

      {/* Account modal (profile + subscription status) */}
      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        user={{
          uid: user?.uid,
          email: user?.email,
          displayName: user?.displayName,
          photoURL: user?.photoURL
        }}
      />

      {/* Onboarding Viewer Modal (Dev Mode Only) */}
      {showOnboardingViewer && (
        <OnboardingViewer onClose={() => setShowOnboardingViewer(false)} />
      )}

      {/* Pro Members Viewer Modal (Dev Mode Only) */}
      {showProMembers && (
        <ProMembersViewer
          onClose={() => setShowProMembers(false)}
          onImpersonateUser={onImpersonateUser}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteModalChatId && (
        <div className="delete-modal-overlay" onClick={() => !isDeleting && setDeleteModalChatId(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </div>
            <h3 className="delete-modal-title">{t('side.deleteTitle')}</h3>
            <p className="delete-modal-body">{t('side.deleteBody')}</p>
            <div className="delete-modal-actions">
              <button
                className="delete-modal-btn cancel"
                onClick={() => setDeleteModalChatId(null)}
                disabled={isDeleting}
              >
                {t('side.deleteCancel')}
              </button>
              <button
                className="delete-modal-btn confirm"
                onClick={handleDeleteChat}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="delete-spinner" />
                ) : (
                  t('side.deleteConfirm')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(SideBar);