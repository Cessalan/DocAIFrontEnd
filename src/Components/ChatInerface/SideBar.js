import { useState, useEffect } from "react";
import { handleSignOut } from "../../Firebase/auth";
import { db } from "../../Firebase/config";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { loadFilesForChat } from '../../Services/FireBaseFiles.js';
import { DeleteChat } from "../../Services/FireBaseServiceChats.js";
import '../../index.css';

// translation
import { useTranslation } from 'react-i18next';

const SideBar = ({ user, onChatSelected, onCloseSidebar }) => {
  
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [hoveredChatId, setHoveredChatId] = useState(null);
  
  // translation
  const { t } = useTranslation();

  // State for file counts
  const [chatFileCounts, setChatFileCounts] = useState({});

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

  // Load file counts for all chats
  const loadFileCountsForAllChats = async (chatList) => {
    const counts = {};
    
    // Use Promise.all to load counts concurrently
    const countPromises = chatList.map(async (chat) => {
      const count = await loadFileCountForChat(chat.id);
      counts[chat.id] = count;
      return { chatId: chat.id, count };
    });

    await Promise.all(countPromises);
    setChatFileCounts(counts);
  };

  // Load all chats AND their file counts
  useEffect(() => {
    if (!user) return;
  
    const chatsRef = collection(db, "chats");

    const chatQuery = query(
      chatsRef,
      //where("userId", "==", user.uid), // get only chats for current user
      orderBy("updatedAt", "desc")     // sort by most recent
    );
  
    const unsubscribe = onSnapshot(chatQuery, async (snapshot) => {
      const updatedChats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChats(updatedChats);
      
      // Load file counts for all chats
      if (updatedChats.length > 0) {
        await loadFileCountsForAllChats(updatedChats);
      }
    });
  
    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [user]);
  

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
    setActiveChatId(newChatId);
    
    // Initialize file count for new chat
    setChatFileCounts(prev => ({ ...prev, [newChatId]: 0 }));
    
    if (onChatSelected) onChatSelected(newChatId);
  };

  const handleSelectChat = (chatId) => {
    console.log("Clicked chat: " + chatId + " from SideBar");
    setActiveChatId(chatId);
    
    if (onChatSelected) {
      onChatSelected(chatId);
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
        setActiveChatId(null);
        if (onChatSelected) onChatSelected(null);
      }
    } catch (error) {
      alert("Échec de la suppression: " + error.message);
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
              className={`conversation-item ${activeChatId === chat.id ? "active" : ""}`}
              onClick={() => handleSelectChat(chat.id)}
              onMouseEnter={() => setHoveredChatId(chat.id)}
              onMouseLeave={() => setHoveredChatId(null)}
              style={{ position: 'relative' }}
            >
              {/* File count badge */}
              {chatFileCounts[chat.id] > 0 && (
                <div className="file-count-badge">
                  <span className="paperclip-icon">📎</span>
                  <span className="file-count-number">{chatFileCounts[chat.id]}</span>
                </div>
              )}
              
              {/* Delete button - appears on hover */}
               {/* {hoveredChatId === chat.id && (
                <button
                  className="delete-chat-button"
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  title="Supprimer ce chat"
                >
                  🗑️
                </button>
              )}  */}
              
              <div className="conversation-details">
                {/* Header section - now stacked vertically */}
                <div className="conversation-header">
                  <span className="conversation-name">{chat.title}</span>
                  
                  {/* Metadata row: date + userId */}
                  <div className="conversation-metadata">
                    <span className="conversation-time">
                      {getchatDate(chat.updatedAt)}
                    </span>
                    <span className="conversation-metadata-separator">•</span>
                    <span className="conversation-user-id">
                      {chat.userId}
                    </span>
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
        <div className="nav-item" onClick={handleSignOut}>
          {t('side.logout')} ⏻
        </div>
      </div>
    </>
  );
};

export default SideBar;