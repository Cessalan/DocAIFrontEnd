import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";

import ChatInterface from "./Components/ChatInerface/ChatInterface";
import SideBar from "./Components/ChatInerface/SideBar";
import Login from "./Components/Auth/Login";
import Signup from "./Components/Auth/SignUp";
import ForgotPassword from "./Components/Auth/ForgotPassword";
import ProtectedRoute from "./Components/Auth/ProtectedRoute"; // Make sure this exists
import './index.css';
import { auth} from "./Firebase/config";
import { warm_up_FASTAPI } from "./Services/FastAPICalls";

function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [selectedChatId, setSelectedChatId] = useState(null);

  console.log("Chat ID in state in App.js:  " + selectedChatId);
  
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

 const user=auth.currentUser;

  // Function to check if we're on mobile
  const isMobile = () => {
    return window.innerWidth <= 768;
  };

 const onSelectChat = (chatId) => 
  { 
    console.log("Chat ID Selected From SideBar.js:" + chatId);

    setSelectedChatId(chatId);

    if(isMobile())
    {
      toggleSidebar();
    }
  };


  return (
    <div className="app-wrapper">
      
      <div >
        <button className="sidebar-toggle"  onClick={toggleSidebar}>
          {sidebarOpen ? '×' : '☰'}
        </button>
      </div>
      

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <SideBar user={user} onChatSelected={onSelectChat} onCloseSidebar={onCloseSidebar} />    
      </div>

      <div className={`main-content ${sidebarOpen ? 'shifted' : ''}`}>
        <ChatInterface chatId={selectedChatId} onChatSelected={onSelectChat} onCloseSidebar={onCloseSidebar} />
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />


      {/* Protected Chat Layout */}
      <Route 
        path="/*" 
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
