import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../Firebase/config';
import { useAuth } from '../../Contexts/AuthContext/AuthContext';
import SideBar from '../ChatInerface/SideBar';
import CollapsedSidebarRail from '../ChatInerface/CollapsedSidebarRail';
import HomeDashboard from './HomeDashboard';
import OnboardingModal from '../Onboarding/OnboardingModal';
import { warm_up_FASTAPI } from '../../Services/FastAPICalls';
import '../../index.css';

/**
 * DashboardLayout - Layout wrapper for the home dashboard
 * Includes sidebar, collapsed rail, and the main dashboard content
 */
function DashboardLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Dark mode state for collapsed rail
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  // Listen for dark mode changes
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.body.classList.contains('dark-mode'));
    };

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // Auth context
  const authContext = useAuth();
  const isProfileComplete = authContext ? authContext.isProfileComplete : false;

  // Warm up FastAPI server when dashboard loads
  useEffect(() => {
    const warmUpServer = async () => {
      try {
        console.log("Warming up FastAPI server...");
        const response = await warm_up_FASTAPI();
        if (response.ok) {
          console.log("FastAPI server warmed up successfully");
        }
      } catch (error) {
        console.error("Failed to warm up FastAPI server:", error);
      }
    };

    warmUpServer();
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

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

  const isMobile = () => {
    return window.innerWidth <= 768;
  };

  // When user selects a chat from sidebar, navigate to it
  const onSelectChat = (chatId) => {
    if (chatId) {
      navigate(`/c/${chatId}`);
    }
    if (isMobile()) {
      toggleSidebar();
    }
  };

  // Handle new chat from collapsed rail
  const handleNewChatFromRail = async () => {
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('../../Firebase/config');

    if (!user) return;

    const newChat = {
      userId: user.uid,
      title: "Chat ...",
      description: "New conversation started.",
      updatedAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, "chats"), newChat);
      navigate(`/c/${docRef.id}`);
    } catch (error) {
      console.error("Error creating new chat from rail:", error);
    }
  };

  // Dashboard action handlers
  const handleStartChat = () => {
    navigate('/c');
  };

  const handleStartQuiz = () => {
    // Navigate to chat and could pass state to pre-fill quiz prompt
    navigate('/c', { state: { prefillPrompt: 'Generate a practice quiz for me' } });
  };

  return (
    <div className="app-wrapper">
      {/* Toggle button */}
      {(isMobile() || sidebarOpen) && (
        <div>
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            {sidebarOpen ? '×' : '☰'}
          </button>
        </div>
      )}

      {/* Collapsed sidebar rail */}
      {!sidebarOpen && !isMobile() && (
        <CollapsedSidebarRail
          onExpandSidebar={() => setSidebarOpen(true)}
          onNewChat={handleNewChatFromRail}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <SideBar
          user={user}
          onChatSelected={onSelectChat}
          onCloseSidebar={onCloseSidebar}
        />
      </div>

      {/* Main Content - Dashboard */}
      <div className={`main-content ${sidebarOpen ? 'shifted' : 'rail-shifted'}`}>
        <div className="dashboard-page">
          <HomeDashboard
            onStartChat={handleStartChat}
            onStartQuiz={handleStartQuiz}
          />
        </div>
      </div>

      {!isProfileComplete && <OnboardingModal />}
    </div>
  );
}

export default DashboardLayout;
