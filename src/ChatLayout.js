import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import ChatInterface from "./Components/ChatInerface/ChatInterface";
import ExamDrillPage from "./Components/ExamDrill/ExamDrillPage";
import { ReactComponent as HeartLogo } from './assets/favicon.svg';
import SideBar from "./Components/ChatInerface/SideBar";
import CollapsedSidebarRail from "./Components/ChatInerface/CollapsedSidebarRail";
import { auth } from "./Firebase/config";
import { warm_up_FASTAPI } from "./Services/FastAPICalls";
import OnboardingModal from "./Components/Onboarding/OnboardingModal";
import ExamDebriefPrompt from "./Components/ExamDebrief/ExamDebriefPrompt";
import DevExamDebriefPill from "./Components/ExamDebrief/DevExamDebriefPill";
import SelectionProvider from "./Components/Selection/useTextSelection";
import { useAuth } from "./Contexts/AuthContext/AuthContext";
import { getPendingFiles, clearPendingFiles } from "./utils/pendingUploadStore";

function ChatLayout() {
  const { chatId: urlChatId } = useParams(); // Get chatId from URL
  const navigate = useNavigate();
  const location = useLocation();

  /* Exam Drill renders INSIDE this shell rather than as its own route.
   *
   * It used to be a sibling route, which meant leaving a drill unmounted the
   * whole layout and remounted it: the sidebar's chat listener re-subscribed,
   * the lazy chunk re-resolved and the chat re-fetched, so "close the drill"
   * cost a full app boot. Study mode never had that problem because it lives
   * in here, and the drill should not be the odd one out.
   *
   * The sidebar stays mounted throughout and simply collapses to its rail,
   * so exiting is a state change rather than a reload. */
  const isDrillMode = location.pathname.startsWith('/drill/');

  // Auth context for reactive auth state
  const { isUserLoggedIn } = useAuth() || {};

  // Get user FIRST - needed before any useEffects that depend on it
  const user = auth.currentUser;

  const [sidebarOpen, setSidebarOpenState] = useState(window.innerWidth > 768);
  // Drilling forces the rail. The exam surface wants the width, and an open
  // sidebar over it is an invitation to stop answering questions.
  // Memoised because the resize effect depends on it; a fresh function every
  // render would re-subscribe that listener on every render.
  const setSidebarOpen = useCallback(
    (v) => setSidebarOpenState(isDrillMode ? false : v),
    [isDrillMode]
  );
  const [selectedChatId, setSelectedChatId] = useState(urlChatId || null);
  const [viewAllChatsMode, setViewAllChatsMode] = useState(false);

  // Dev-only: impersonate a user by their UID to see their interface
  const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
  const [impersonatedUid, setImpersonatedUid] = useState(null);
  const handleStopImpersonating = () => {
    setImpersonatedUid(null);
    setSelectedChatId(null);
    navigate('/c');
  };

  // Pending files state - when user uploads from landing page, this gets set
  // and ChatInterface will pick it up and process it as a normal upload
  const [pendingUploadFiles, setPendingUploadFiles] = useState([]);
  // Flag to trigger study mode automatically after upload from landing page
  const [goToStudyMode, setGoToStudyMode] = useState(false);

  // Sync selectedChatId with URL param when it changes
  // This ensures navigation from dashboard (which only uses navigate()) works correctly
  useEffect(() => {
    // Always sync state with URL - this handles navigation from anywhere
    setSelectedChatId(urlChatId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlChatId]);

  // Dark mode state for collapsed rail
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  // Listen for dark mode changes from SideBar
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.body.classList.contains('dark-mode'));
    };

    // Create observer to watch for class changes on body
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // Destructure isProfileComplete from useAuth
  const authContext = useAuth();
  const isProfileComplete = authContext ? authContext.isProfileComplete : false;
  const authUid = authContext?.currentUser?.uid || null;

  // Warm up FastAPI server when interface loads
  useEffect(() => {
    const warmUpServer = async () => {
      try {
        console.log("Warming up FastAPI server...");
        const response = await warm_up_FASTAPI();
        console.log(response)
        if (response.ok) {
          console.log("FastAPI server warmed up successfully");
        } else {
          console.log("FastAPI warm-up response not OK:", response.status);
        }
      } catch (error) {
        console.error("Failed to warm up FastAPI server:", error);
      }
    };

    warmUpServer();
  }, []); // Empty dependency array - runs once on mount

  // Redirect to home if the user disconnects/signs out while on chat routes
  useEffect(() => {
    if (isUserLoggedIn === false) {
      navigate('/');
    }
  }, [isUserLoggedIn, navigate]);

  // ============================================
  // RESTORE PENDING UPLOAD AFTER LOGIN
  // ============================================
  // When user returns from login after trying to upload files,
  // restore the files from the in-memory store and set them as pendingUploadFiles.
  // ChatInterface will then pick them up and process them normally.
  // ============================================
  useEffect(() => {
    if (!user) return;

    const { files, meta } = getPendingFiles();
    if (!files || files.length === 0) return;

    // Check if the session is still valid (less than 30 minutes old)
    const isValid = meta && (Date.now() - meta.timestamp < 30 * 60 * 1000);
    if (!isValid) {
      clearPendingFiles();
      return;
    }

    setPendingUploadFiles(files);

    if (meta.goToStudyMode) {
      setGoToStudyMode(true);
    }
  }, [user]);

  // Entering a drill collapses an already-open sidebar. The guard on
  // setSidebarOpen only stops it being opened; this closes it on the way in.
  useEffect(() => {
    if (isDrillMode) setSidebarOpenState(false);
  }, [isDrillMode]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Function to close sidebar (for mobile)
  const onCloseSidebar = () => {
    setSidebarOpen(false);
  };

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarOpen]);

  // Function to check if we're on mobile
  const isMobile = () => {
    return window.innerWidth <= 768;
  };

  const onSelectChat = (chatId) => {
    setSelectedChatId(chatId);

    // Update URL to reflect the selected chat
    if (chatId) {
      navigate(`/c/${chatId}`);
    } else {
      // No chat selected - navigate to dashboard
      navigate('/');
    }

    if (isMobile()) {
      toggleSidebar();
    }
  };

  // Handle new chat from collapsed rail
  const handleNewChatFromRail = async () => {
    // Import Firestore functions inline to create a new chat
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('./Firebase/config');

    if (!user) return;

    const newChat = {
      userId: user.uid,
      title: "Chat ...",
      description: "New conversation started.",
      updatedAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, "chats"), newChat);
      setSelectedChatId(docRef.id);
      // Navigate to the new chat URL
      navigate(`/c/${docRef.id}`);
      // Optionally open the sidebar to show the new chat
      setSidebarOpen(true);
    } catch (error) {
      console.error("Error creating new chat from rail:", error);
    }
  };

  // Callback to clear the pending upload after ChatInterface processes it
  const clearPendingUpload = () => {
    setPendingUploadFiles([]);
  };

  return (
    <div className="app-wrapper">
      {/* Global NurseQuizAI branding - positioned next to sidebar */}
      <div className={`app-global-brand ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <HeartLogo className="app-brand-logo" />
        <span className="app-brand-name">NurseQuizAI</span>
      </div>

      {/* Toggle button - show on mobile always, or on desktop when sidebar is open */}
      {(isMobile() || sidebarOpen) && (
        <div>
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            {sidebarOpen ? '×' : '☰'}
          </button>
        </div>
      )}

      {/* Collapsed sidebar rail - shown when sidebar is closed (desktop only) */}
      {!sidebarOpen && !isMobile() && (
        <CollapsedSidebarRail
          onExpandSidebar={() => setSidebarOpen(true)}
          onNewChat={handleNewChatFromRail}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Dev impersonation banner */}
      {isDev && impersonatedUid && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#ff6b35', color: '#fff',
          padding: '6px 16px', fontSize: '13px', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          <span>👁 DEV — Viewing as: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 6px', borderRadius: 3 }}>{impersonatedUid}</code></span>
          <button
            onClick={handleStopImpersonating}
            style={{
              background: 'rgba(0,0,0,0.25)', border: 'none', color: '#fff',
              padding: '3px 12px', borderRadius: 4, cursor: 'pointer',
              fontWeight: 700, fontSize: '12px'
            }}
          >
            ✕ Exit Impersonation
          </button>
        </div>
      )}

      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={onCloseSidebar} aria-hidden="true" />
      )}

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={isDev && impersonatedUid ? { paddingTop: 32 } : {}}>
        <SideBar
          user={user}
          activeChatId={selectedChatId}
          onChatSelected={onSelectChat}
          onCloseSidebar={onCloseSidebar}
          onViewModeChange={setViewAllChatsMode}
          impersonatedUid={impersonatedUid}
          onImpersonateUser={setImpersonatedUid}
          onStopImpersonating={handleStopImpersonating}
        />
      </div>

      <div
        className={`main-content ${sidebarOpen ? 'shifted' : 'rail-shifted'}`}
        style={isDev && impersonatedUid ? { paddingTop: 32 } : {}}
        onClickCapture={sidebarOpen ? onCloseSidebar : undefined}
      >
        {isDrillMode ? (
          <ExamDrillPage />
        ) : (
          <SelectionProvider>
            <ChatInterface
              chatId={selectedChatId}
              onChatSelected={onSelectChat}
              onCloseSidebar={onCloseSidebar}
              viewAllChatsMode={viewAllChatsMode}
              pendingUploadFiles={pendingUploadFiles}
              onPendingUploadProcessed={clearPendingUpload}
              sidebarOpen={sidebarOpen}
              goToStudyMode={goToStudyMode}
              onStudyModeTriggered={() => setGoToStudyMode(false)}
            />
          </SelectionProvider>
        )}
      </div>

      {!isProfileComplete && <OnboardingModal />}

      {/* Post-exam debrief. Mounted at the shell rather than inside the chat
          because it belongs to the session, not to whichever chat is open —
          and it must not be able to fire while onboarding is still on screen,
          which is a student who has no exam behind her yet. */}
      {isProfileComplete && authUid && <ExamDebriefPrompt uid={authUid} />}

      {/* Dev-only: opens that conversation on demand. Renders null in a
          production build. */}
      {authUid && <DevExamDebriefPill />}
    </div>
  );
}

export default ChatLayout;
