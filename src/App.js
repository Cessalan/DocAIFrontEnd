import React, { useState, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";

import ChatInterface from "./Components/ChatInerface/ChatInterface";
import { ReactComponent as HeartLogo } from './assets/favicon.svg';
import SideBar from "./Components/ChatInerface/SideBar";
import CollapsedSidebarRail from "./Components/ChatInerface/CollapsedSidebarRail";
import Login from "./Components/Auth/Login";
import Signup from "./Components/Auth/SignUp";
import ForgotPassword from "./Components/Auth/ForgotPassword";
import ProtectedRoute from "./Components/Auth/ProtectedRoute";
import PublicQuizView from "./Components/PublicQuiz/PublicQuizView";
import QuizRoomLanding from "./Components/QuizRoom/QuizRoomLanding";
import DedicatedQuizPage from "./Components/QuizRoom/DedicatedQuizPage";
import BlogList from "./Components/Blog/BlogList";
import BlogPost from "./Components/Blog/BlogPost";
import NclexQuestionGenerator from "./Components/LandingPages/NclexQuestionGenerator";
import QuestionBankAdmin from "./Components/Admin/QuestionBankAdmin";
import './index.css';
import { auth } from "./Firebase/config";
import { warm_up_FASTAPI } from "./Services/FastAPICalls";
import OnboardingModal from "./Components/Onboarding/OnboardingModal";
import { useAuth } from "./Contexts/AuthContext/AuthContext";

function ChatLayout() {
  const { chatId: urlChatId } = useParams(); // Get chatId from URL
  const navigate = useNavigate();

  // Auth context for reactive auth state
  const { isUserLoggedIn } = useAuth() || {};

  // Get user FIRST - needed before any useEffects that depend on it
  const user = auth.currentUser;

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
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

  console.log("ChatLayout render. isProfileComplete:", isProfileComplete);

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
  // restore the files from sessionStorage and set them as pendingUploadFiles.
  // ChatInterface will then pick them up and process them normally.
  // ============================================
  useEffect(() => {
    // Only run if user is logged in
    if (!user) return;

    // Check for pending upload in sessionStorage
    const pendingUploadStateStr = sessionStorage.getItem('pendingUploadState');
    const pendingUploadFilesStr = sessionStorage.getItem('pendingUploadFiles');

    if (!pendingUploadStateStr || !pendingUploadFilesStr) return;

    try {
      const uploadState = JSON.parse(pendingUploadStateStr);

      // Check if the session is still valid (less than 30 minutes old)
      const isValid = Date.now() - uploadState.timestamp < 30 * 60 * 1000;

      if (!isValid) {
        console.log('⏰ Pending upload session expired');
        sessionStorage.removeItem('pendingUploadState');
        sessionStorage.removeItem('pendingUploadFiles');
        return;
      }

      // Parse the base64 files array
      const filesBase64 = JSON.parse(pendingUploadFilesStr);
      const fileInfos = uploadState.files || [];

      console.log(`🔄 Restoring ${fileInfos.length} pending file(s) after login`);

      // Convert each base64 back to File object
      const restoredFiles = filesBase64.map((base64Data, index) => {
        const fileInfo = fileInfos[index] || {};
        const byteString = atob(base64Data.split(',')[1]);
        const mimeType = fileInfo.fileType || 'application/octet-stream';
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeType });
        return new File([blob], fileInfo.fileName || `file_${index}`, { type: mimeType });
      });

      // Clear the session storage
      sessionStorage.removeItem('pendingUploadState');
      sessionStorage.removeItem('pendingUploadFiles');

      // Set the pending files - ChatInterface will handle the upload
      setPendingUploadFiles(restoredFiles);

      // Check if we should go to study mode after upload
      if (uploadState.goToStudyMode) {
        setGoToStudyMode(true);
      }

    } catch (error) {
      console.error('Failed to restore pending upload:', error);
      sessionStorage.removeItem('pendingUploadState');
      sessionStorage.removeItem('pendingUploadFiles');
    }
  }, [user]);

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
  }, []);

  // Function to check if we're on mobile
  const isMobile = () => {
    return window.innerWidth <= 768;
  };

  const onSelectChat = (chatId) => {
    console.log("Chat ID Selected From SideBar.js:" + chatId);

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

  // Handle files selected from onboarding modal
  // This sets up the files to be uploaded and triggers study mode
  const handleOnboardingFilesSelected = (files, actionType) => {
    console.log('📚 Onboarding files selected:', files.length, 'files, action:', actionType);

    // Set the pending files for ChatInterface to pick up
    setPendingUploadFiles(files);

    // If the action is studyjourney, trigger study mode
    if (actionType === 'studyjourney') {
      setGoToStudyMode(true);
    }

    // Navigate to a new chat (no chatId means new chat)
    navigate('/c');
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

      <div className={`main-content ${sidebarOpen ? 'shifted' : 'rail-shifted'}`} style={isDev && impersonatedUid ? { paddingTop: 32 } : {}}>
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
      </div>

      {!isProfileComplete && <OnboardingModal onFilesSelected={handleOnboardingFilesSelected} />}
    </div>
  );
}

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

function App() {
  console.log('App rendering');
  return (
    <Routes>
      <Route path="/start" element={<QuizRoomLanding />} />
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/quiz/:shareId" element={<PublicQuizView />} />

      {/* Blog Routes - Public for SEO */}
      <Route path="/blog" element={<BlogList />} />
      <Route path="/blog/:slug" element={<BlogPost />} />

      {/* SEO Landing Pages */}
      <Route path="/nclex-question-generator" element={<NclexQuestionGenerator />} />
      <Route path="/ai-nclex-question-generator" element={<NclexQuestionGenerator />} />

      {/* Admin Routes - DEV ONLY */}
      {isDev && (
        <Route path="/admin/question-bank" element={<QuestionBankAdmin />} />
      )}

      {/* Home - Redirect to chat */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        }
      />

      {/* QuizRoom routes - hidden for now, can be re-enabled later */}
      {/* <Route path="/start" element={<QuizRoomLanding />} /> */}
      {/* <Route path="/quiz-room" element={<DedicatedQuizPage />} /> */}
      {/* <Route path="/quiz/play" element={<DedicatedQuizPage />} /> */}

      {/* Protected Chat Layout - with chat ID in URL */}
      <Route
        path="/c/:chatId"
        element={
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        }
      />

      {/* Protected Chat Layout - without specific chat (new chat view) */}
      <Route
        path="/c"
        element={
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
