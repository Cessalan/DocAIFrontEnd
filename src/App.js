import React, { useState, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";

import ChatInterface from "./Components/ChatInerface/ChatInterface";
import SideBar from "./Components/ChatInerface/SideBar";
import CollapsedSidebarRail from "./Components/ChatInerface/CollapsedSidebarRail";
import Login from "./Components/Auth/Login";
import Signup from "./Components/Auth/SignUp";
import ForgotPassword from "./Components/Auth/ForgotPassword";
import ProtectedRoute from "./Components/Auth/ProtectedRoute";
import PublicQuizView from "./Components/PublicQuiz/PublicQuizView";
import QuizRoomLanding from "./Components/QuizRoom/QuizRoomLanding";
import DedicatedQuizPage from "./Components/QuizRoom/DedicatedQuizPage";
import QuestionBankAdmin from "./Components/Admin/QuestionBankAdmin";
import './index.css';
import { auth } from "./Firebase/config";
import { warm_up_FASTAPI } from "./Services/FastAPICalls";
import OnboardingModal from "./Components/Onboarding/OnboardingModal";
import { useAuth } from "./Contexts/AuthContext/AuthContext";

function ChatLayout() {
  const { chatId: urlChatId } = useParams(); // Get chatId from URL
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [selectedChatId, setSelectedChatId] = useState(urlChatId || null);
  const [viewAllChatsMode, setViewAllChatsMode] = useState(false);

  // Sync selectedChatId with URL param when it changes
  useEffect(() => {
    if (urlChatId && urlChatId !== selectedChatId) {
      setSelectedChatId(urlChatId);
    }
  }, [urlChatId, selectedChatId]);

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

  const user = auth.currentUser;

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

  return (
    <div className="app-wrapper">

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

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <SideBar
          user={user}
          onChatSelected={onSelectChat}
          onCloseSidebar={onCloseSidebar}
          onViewModeChange={setViewAllChatsMode}
        />
      </div>

      <div className={`main-content ${sidebarOpen ? 'shifted' : 'rail-shifted'}`}>
        <ChatInterface
          chatId={selectedChatId}
          onChatSelected={onSelectChat}
          onCloseSidebar={onCloseSidebar}
          viewAllChatsMode={viewAllChatsMode}
        />
      </div>

      {!isProfileComplete && <OnboardingModal />}
    </div>
  );
}

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/quiz/:shareId" element={<PublicQuizView />} />

      {/* Admin Routes - DEV ONLY */}
      {isDev && (
        <Route path="/admin/question-bank" element={<QuestionBankAdmin />} />
      )}

      {/* Home / Landing Page - Public */}
      <Route path="/" element={<QuizRoomLanding />} />
      <Route path="/start" element={<QuizRoomLanding />} />

      {/* Dedicated Quiz Page - Public (can be accessed with quiz data) */}
      <Route path="/quiz-room" element={<DedicatedQuizPage />} />
      <Route path="/quiz/play" element={<DedicatedQuizPage />} />

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
