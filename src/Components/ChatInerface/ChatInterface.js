import { useState, useRef, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// Firebase imports
import { createStorageRef, db, auth } from '../../Firebase/config';
import { uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  collection,
  getDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  where
} from "firebase/firestore";

// Components
import ChatMessage from './ChatMessage';

// SVG Components
import SvgFileUpload from '../Svg/SvgFileUpload';
import SvgFileIcon from '../Svg/SvgFileIcon';
import SvgImageIcon from '../Svg/SvgImageIcon';

// Emoji Components
import ReadingEmoji from './Emojis/ReadingEmoji.jsx';
import GraduationEmoji from './Emojis/GraduationEmoji.js';
import PencilEmoji from './Emojis/PencilEmoji.js';
import CookingEmoji from './Emojis/CookingEmoji.js';
import GearEmoji from './Emojis/GearEmoji.js';
import ThinkingEmoji from './Emojis/ThinkingEmoji.js';

// Servicess
import { formatDate, formatFileSize } from '../../Services/Formatting.js';
import { 
  AppendToChat, 
  SaveFileMetaData, 
  GetFileMetadataByName,
  UpdateQuizAnswer
} from '../../Services/FireBaseServiceChats.js';

import { loadFilesForChat } from '../../Services/FireBaseFiles.js';
import {
  ask_llm_stream,
  embed_docs,
  generate_summary,
  stream_summary,
  generate_scenario
} from '../../Services/FastAPICalls.js';

// Styles
import './ChatInterface.css';

// translation
import { useTranslation } from 'react-i18next';
import StudyGuideGenerator from './StudyGuideGenerator.js';



/**
 * ChatInterface Component - A messenger-like interface for AI chat
 * Features: Text messaging with AI, File uploads, Quiz/Summary/Scenario generation
 */
const ChatInterface = ({ chatId ,onChatSelected, onCloseSidebar}) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  // Core chat state
  const [currentChatID, setChatId] = useState(chatId);
  const [currentChatTitle,setChatTitle] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [userInputText, setUserInputText] = useState('');
  const [uploadedFilesList, setUploadedFilesList] = useState([]);
  
  // UI state
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState(null);
  const [isFilesModalVisible, setIsFilesModalVisible] = useState(false);
  
  const [activeStudyGuide, setActiveStudyGuide] = useState(null);

  // Loading states
  const [loadingStates, setLoadingStates] = useState({
    quiz: false,
    summary: false,
    scenario: false,
    fileUpload: false,
    fileEmbedding: false
  });


  // in case the user answers quiz while its being loaded and streamed
  const pendingQuizAnswersRef = useRef({});

  // ============================================
  // REFS
  // ============================================
  const messagesEndRef = useRef(null);
  const documentFileInputRef = useRef(null);
  const isQuizGeneratingRef = useRef(false);
 
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const scrollToLatestMessage = useCallback(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const setLoadingState = useCallback((key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const isSystemBusy = () => {
    return (
      isAiTyping ||
      loadingStates.quiz ||
      loadingStates.summary ||
      loadingStates.scenario ||
      loadingStates.fileUpload ||
      loadingStates.fileEmbedding
    );
  };


  const formatChatHistory = useCallback((messages) => {
    return messages
      .filter(msg => msg.role && msg.content && typeof msg.content === 'string' &&  msg.content.trim())
      .map(msg => {
        if (msg.quizData) {
          let quizText = "Quiz:\n";
          msg.quizData.forEach((q, index) => {
            quizText += `Question ${index + 1}: ${q.question}\n`;
            quizText += `Options: ${q.options.join(', ')}\n`;
            quizText += `Answer: ${q.answer}\n`;
            quizText += `Justification: ${q.justification}\n\n`;
          });
          return { role: msg.role, content: quizText };
        }

         if (msg.summaryData) {
          let summaryText = `DOCUMENT SUMMARY:\n`;
          summaryText += `Summmary Title: ${msg.summaryData.title}\n`;
          summaryText += `Reading Time: ${msg.summaryData.reading_time}\n`;
          summaryText += `Type: ${msg.summaryData.document_analysis?.type || 'N/A'}\n`;
          summaryText += `Purpose: ${msg.summaryData.document_analysis?.purpose || 'N/A'}\n\n`;
          summaryText += `filename: ${msg.summaryData.document_analysis?.filename|| 'N/A'}\n\n`;
          
          msg.summaryData.sections?.forEach((section, index) => {
            summaryText += `${section.heading}:\n`;
            section.bullets?.forEach(bullet => {
              summaryText += `• ${bullet}\n`;
            });
            summaryText += '\n';
          }); 
          return { role: msg.role, content: summaryText };
      }

        
        if (msg.scenarioData) {
          const scenarioText = `
            SCENARIO: ${msg.scenarioData.scenario}
            QUESTION: ${msg.scenarioData.question}
            OPTIONS: ${msg.scenarioData.options.join('\n')}
            CORRECT ANSWER: ${msg.scenarioData.options[msg.scenarioData.correctAnswer]}
            JUSTIFICATION: ${msg.scenarioData.explanation}
          `;
          return { role: msg.role, content: scenarioText };
        }
       
        return { role: msg.role, content: msg.content };
      }
    );
  }, []);
  
  const formatFilesForAPI = useCallback((files) => {
    return files.map(file => ({
      filename: file.name,
      source: file.downloadURL
    }));
  }, []);

  // ============================================
  // EFFECTS
  // ============================================

  // Sync with parent chatId prop
  useEffect(() => {
  if (chatId) {
    setChatId(chatId);
    const chatDocRef = doc(db, "chats", chatId);
    
    // get the title of the chat
    getDoc(chatDocRef).then((docSnapshot) => {
      if (docSnapshot.exists()) {
        const chatData = docSnapshot.data();
        setChatTitle(chatData.title);
      }
    });
  }
}, [chatId]);

  // Load messages from Firebase
  useEffect(() => {
    if (!currentChatID) {
      console.warn("No chat ID available");
      return;
    }

    const messagesRef = collection(db, "chats", currentChatID, "messages");
    const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const loadedMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatMessages(loadedMessages);
    });

    return () => unsubscribe();
  }, [currentChatID]);

  // Load files for chat
  useEffect(() => {
    if (!currentChatID) return;

    const fetchFiles = async () => {
      const filesFromFireStore = await loadFilesForChat(currentChatID);
      setUploadedFilesList(filesFromFireStore);
    };

    fetchFiles();
  }, [currentChatID]);

  // Auto-scroll on new messages (but not during streaming)
  useEffect(() => {
    if (!isAiTyping) {
      var lastMessage = chatMessages[chatMessages.length-1];
      if(lastMessage && lastMessage.type !=="quiz")
      {
        scrollToLatestMessage();
      }
      
    }
  }, [chatMessages.length, isAiTyping]); // scroll down only if a new message is added at the bottom and once the AI finishes typing


  const { t , i18n} = useTranslation();

   const currentLanguage = i18n .language;

  // ============================================
  // MESSAGE HANDLING
  // ============================================
  const handleSendNewUserMessage = async (e = null, customPrompt = null) => {
    if (e) e.preventDefault();
    
    const messageToSend = customPrompt ?? userInputText;
    if (messageToSend.trim() === '') return;

    // Prepare for streaming
    setIsAiTyping(true);
    setStreamingStatus(null);

    // Add user message
    const newUserMessage = {
      id: uuidv4(),
      role: 'user',
      content: messageToSend,
    };
    
    setChatMessages(prev => [...prev, newUserMessage]);
    setUserInputText('');

    // Save to Firebase
    const updatedChatId = await AppendToChat(currentChatID, newUserMessage);
    if (updatedChatId && updatedChatId !== currentChatID) {
      setChatId(updatedChatId);
    }

  
    const streamingMessageId = `streaming-${Date.now()}`;    
   
    // ADD PLACEHOLDER MESSAGE FOR TEXT RESPONSES
    const placeholderMessage = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, placeholderMessage]);
  
    //  WAIT FOR REACT TO PROCESS THE STATE UPDATE
    await new Promise(resolve => setTimeout(resolve, 0));

     let fullResponse = "";
    
    try {
      // will be used to build the context
      const chatHistory = formatChatHistory(chatMessages);
      const filesList = formatFilesForAPI(uploadedFilesList)
      
      await ask_llm_stream(
        currentLanguage,
        messageToSend,
        chatHistory,
        filesList,
        updatedChatId || currentChatID,

      // check status
      (statusUpdate) => {

        if(statusUpdate.status == "studysheet_generated")
        {
          // Handle study sheet response
          handleStudySheetResponse(statusUpdate.html, streamingMessageId, updatedChatId);
          return;
        }

        if(statusUpdate.status == "study_guide_trigger")
        {
            if(statusUpdate.parameters)
            {
               // need to implement the logic to open the studyguidegenerator.js and make api calls to complete it
                setActiveStudyGuide({
                topic: statusUpdate.parameters.topic,
                num_sections: statusUpdate.parameters.num_sections,
                chatId: currentChatID
              });

              // close side bar when we open the study sheet generator
              onCloseSidebar();
            }
        }

        // start quiz generation
        if (statusUpdate.status === "quiz_generating") {

          console.log("generating quiz streaming");
          isQuizGeneratingRef.current = true;
          setChatMessages(prev => {
            const existingQuiz = prev.find(msg => 
              msg.id === streamingMessageId && msg.type === 'quiz'
            );
            
            if (existingQuiz) {
              // Update existing
              return prev.map(msg =>
                msg.id === streamingMessageId && msg.type === 'quiz'
                  ? { ...msg, content: statusUpdate.message }
                  : msg
              );
            }
            
            // Create new quiz message (first time)
            return [...prev, {
              id: streamingMessageId,
              role: 'assistant',
              type: 'quiz',
              content: statusUpdate.message,
              quizData: [],
              isStreaming: true,
              timestamp: new Date()
            }];
          });
          
          setStreamingStatus({
            status: 'generating_quiz',
            message: statusUpdate.message
          });
          return;
        }

        // Individual question ready - ADD THIS
        if (statusUpdate.status === "quiz_question") {
          console.log("📝 Quiz question received:", statusUpdate.total_so_far);
          
          setChatMessages(prev =>
            prev.map(msg => {
              if (msg.id === streamingMessageId && msg.type === 'quiz') {
                const newQuizData = [...(msg.quizData || []), statusUpdate.question];
                console.log("✅ Appended question, total:", newQuizData.length);
                
                return {
                  ...msg,
                  quizData: newQuizData,
                  content: `Quiz - ${statusUpdate.total_so_far} questions générées`,
                  isStreaming: true
                };
              }
              return msg;
            })
          );
          return;
        }
          
        // Quiz complete
        if (statusUpdate.status === "quiz_complete") {

            console.log("quiz completed");

            handleQuizComplete(statusUpdate.quiz_data, streamingMessageId, updatedChatId);
            setStreamingStatus(null);
            return;
          }

        setStreamingStatus(statusUpdate);
      },
        
      // Chunk callback
      (chunk) => {
         
          console.log('📦 Chunk received In chatInterface:', chunk);
          fullResponse = (fullResponse + chunk); 
          
           console.log('📏 fullResponse length:', fullResponse.length);
           console.log('🆔 streamingMessageId:', streamingMessageId);

          if (fullResponse.length > 0 && streamingStatus) {
            setStreamingStatus(null);
          }
          
           setChatMessages(prev => {
            console.log('🔍 Total messages:', prev.length);
            
            const found = prev.find(m => m.id === streamingMessageId);
            console.log('✅ Found message:', !!found, 'Type:', found?.type);
            
            const updated = prev.map(msg => {
              if (msg.id === streamingMessageId && msg.type !== 'quiz') {
                console.log('🎨 UPDATING MESSAGE with content length:', fullResponse.length);
                return { ...msg, content: fullResponse, isStreaming: true };
              }
              return msg;
            });
            
            return updated;
          });
          
        },
        
        // Complete callback
        async () => {
            setStreamingStatus(null);

             
            // Check the ref
            if (isQuizGeneratingRef.current) {
              console.log("⏭️ Skipping complete callback - was a quiz");
              isQuizGeneratingRef.current = false;  // Reset
              setIsAiTyping(false);
              return;
            }
            
            // Only save text responses
            const finalMessage = {
              id: uuidv4(),
              role: "assistant",
              content: fullResponse,
              timestamp: new Date(),
              isStreaming: false
            };
            
            await AppendToChat(updatedChatId || currentChatID, finalMessage);
            
            setChatMessages(prev =>
              prev.map(msg =>
                msg.id === streamingMessageId ? finalMessage : msg
              )
            );
            
            setIsAiTyping(false);
          }
      );
    } catch (error) {
      console.error("Streaming error:", error);
      setStreamingStatus(null);
      
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === streamingMessageId
            ? {
                ...msg,
                content: "Une erreur est survenue. Veuillez réessayer.",
                error: true,
                isStreaming: false
              }
            : msg
        )
      );
      
      setIsAiTyping(false);
    }
  };

  const handleQuizResponse = async (quizData, messageId, chatId) => {
    setStreamingStatus(null);
    
    const quizMessage = {
      id: uuidv4(),
      role: "assistant",
      content: "Voici votre quiz",
      quizData: quizData, // Array of quiz questions
      type: "quiz",
      timestamp: new Date(),
      isStreaming: false
    };

    await AppendToChat(chatId, quizMessage);

    setChatMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? quizMessage : msg
      )
    );

    setIsAiTyping(false);
};

const handleStudySheetResponse = async (htmlStudySheet,messageId,chatId)=>{
   const studySheetMessage = {
      id: uuidv4(),
      role: "assistant",
      content: `${t("chat.studysheetgenerated")}`,
      // html generate by anthropic to create the study sheet that will be didplayed in an iframe
      html: htmlStudySheet, 
      type: "studysheet",
      timestamp: new Date(),
      isStreaming: false
    };

    await AppendToChat(chatId, studySheetMessage);

    setChatMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? studySheetMessage : msg
      )
    );

    setIsAiTyping(false);
}


// ✅ FIXED: Use ref instead of state for synchronous updates
const handleQuizAnswerSelect = async (answerData) => {
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📝 Quiz answer received:");
    console.log("  Message ID:", answerData.messageId);
    console.log("  Question Index:", answerData.quizIndex);
    console.log("  Selected:", answerData.selectedOptionText);
    console.log("  Correct?", answerData.isCorrect ? "✓" : "✗");
    
    // ✅ Find the message to check if it's still streaming
    const quizMessage = chatMessages.find(msg => msg.id === answerData.messageId);
    const isStreaming = quizMessage?.isStreaming;
    
    console.log("  Quiz streaming?", isStreaming ? "YES ⏳" : "NO ✓");
    console.log("  Current quiz questions:", quizMessage?.quizData?.length || 0);
    
    // ✅ Update UI immediately (optimistic update)
    setChatMessages(prev =>
      prev.map(msg => {
        if (msg.id !== answerData.messageId || msg.type !== 'quiz') return msg;
        
        const updatedQuizData = (msg.quizData || []).map((q, idx) => 
          idx === answerData.quizIndex
            ? { 
                ...q, 
                userSelection: {
                  selectedIndex: answerData.selectedOptionIndex,
                  selectedOptionText: answerData.selectedOptionText,
                  isCorrect: answerData.isCorrect,
                  timestamp: answerData.timestamp
                }
              }
            : q
        );
        
        console.log("  ✓ Updated UI state for Q" + (answerData.quizIndex + 1));
        return { ...msg, quizData: updatedQuizData };
      })
    );
    
    // ✅ FIX: If still streaming, store in REF (synchronous!)
    if (isStreaming) {
      console.log("  ⏳ Storing in pendingQuizAnswersRef (will save when quiz completes)");
      
      // ✅ Direct ref mutation - happens IMMEDIATELY (no async delay)
      if (!pendingQuizAnswersRef.current[answerData.messageId]) {
        pendingQuizAnswersRef.current[answerData.messageId] = {};
      }
      pendingQuizAnswersRef.current[answerData.messageId][answerData.quizIndex] = answerData;
      
      console.log("  📦 Pending answers now:", 
        Object.keys(pendingQuizAnswersRef.current[answerData.messageId]).length
      );
      console.log("  📦 Full pending object:", pendingQuizAnswersRef.current);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return; // Don't save to Firebase yet
    }
    
    // ✅ If NOT streaming, save immediately to Firebase
    console.log("  💾 Quiz is finalized - saving to Firebase immediately");
    await UpdateQuizAnswer(
      currentChatID,
      answerData.messageId,
      answerData.questionText,
      answerData
    );
    
    console.log("  ✅ Saved to Firebase successfully");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  } catch (error) {
    console.error("❌ Failed to save quiz answer:", error);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }
};

const handleQuizComplete = async (quizData, messageId, chatId) => {
  console.log("✅ Quiz complete, finalizing message");
  console.log("Backend sent", quizData?.length, "questions");
  setStreamingStatus(null);
  
  // ✅ Get pending answers from ref
  const pendingAnswers = pendingQuizAnswersRef.current[messageId] || {};
  console.log("📦 Pending answers from REF:", pendingAnswers);
  console.log("📦 Number of pending answers:", Object.keys(pendingAnswers).length);
  
  // ✅ FIX: Get current message from state SYNCHRONOUSLY
  const currentMessage = chatMessages.find(msg => msg.id === messageId);
  
  console.log("📝 Current message quizData:", currentMessage?.quizData?.length, "questions");
  console.log("📝 Questions with answers in state:", 
    currentMessage?.quizData?.filter(q => q.userSelection).length || 0
  );
  
  // ✅ FIX: Build merged data BEFORE any async operations
  const mergedQuizData = quizData.map((question, idx) => {
    const pendingAnswer = pendingAnswers[idx];
    const stateAnswer = currentMessage?.quizData?.[idx]?.userSelection;
    
    if (pendingAnswer) {
      console.log(`✓ Q${idx + 1}: Using pending answer (from ref)`);
      return {
        ...question,
        userSelection: {
          selectedIndex: pendingAnswer.selectedOptionIndex,
          selectedOptionText: pendingAnswer.selectedOptionText,
          isCorrect: pendingAnswer.isCorrect,
          timestamp: pendingAnswer.timestamp
        }
      };
    } else if (stateAnswer) {
      console.log(`✓ Q${idx + 1}: Using state answer`);
      return { ...question, userSelection: stateAnswer };
    }
    
    console.log(`- Q${idx + 1}: No answer`);
    return question;
  });
  
  console.log("📊 Final merge result:", 
    mergedQuizData.filter(q => q.userSelection).length,
    "answered questions out of",
    mergedQuizData.length
  );
  
  // ✅ Update UI state
  setChatMessages(prev =>
    prev.map(msg => {
      if (msg.id === messageId && msg.type === 'quiz') {
        return {
          ...msg,
          quizData: mergedQuizData,
          content: `Voici votre quiz (${quizData.length} questions)`,
          isStreaming: false,
          timestamp: new Date()
        };
      }
      return msg;
    })
  );

  // ✅ Save to Firebase with merged data
  console.log("💾 Saving to Firebase:", 
    mergedQuizData.filter(q => q.userSelection).length,
    "answered questions"
  );
  
  console.log("🔍 DEBUG - mergedQuizData contents:", mergedQuizData);
  
  mergedQuizData.forEach((q, idx) => {
    if (q.userSelection) {
      console.log(`  Q${idx + 1}: ${q.userSelection.isCorrect ? '✓' : '✗'} - ${q.userSelection.selectedOptionText}`);
    }
  });
  
  const messageToSave = {
    id: messageId,
    role: 'assistant',
    type: 'quiz',
    quizData: mergedQuizData,
    content: `Votre quiz (${quizData.length} questions)`,
    isStreaming: false,
    timestamp: new Date()
  };
  
  console.log("🔍 DEBUG - messageToSave.quizData:", messageToSave.quizData);
  console.log("🔍 DEBUG - messageToSave.quizData length:", messageToSave.quizData.length);
  
  await AppendToChat(chatId, messageToSave);
  
  // ✅ Clear ref
  if (pendingQuizAnswersRef.current[messageId]) {
    delete pendingQuizAnswersRef.current[messageId];
    console.log("🧹 Cleared pending answers from ref");
  }
  
  setIsAiTyping(false);
  console.log("✅ Quiz save complete!");
};
  // ============================================
  // FILE HANDLING
  // ============================================
  const ensureChatExists = async (chatId, user) => {
    if (chatId) {
      const chatRef = doc(db, "chats", chatId);
      const chatSnapshot = await getDoc(chatRef);
      if (chatSnapshot.exists()) {
        return chatId;
      }
    }

    const newChat = {
      userId: user.uid,
      title: "Nouveau Chat",
      description: "Nouvelle conversation",
      updatedAt: serverTimestamp()
    };

    const newChatRef = await addDoc(collection(db, "chats"), newChat);
    return newChatRef.id;
  };

  const handleDocumentUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    
    const user = auth.currentUser;
    if (!user?.uid) {
      console.log("User not found");
      return <Navigate to="/login" replace />;
    }

    setLoadingState('fileUpload', true);

    const newFileMetadata = {
      id: uuidv4(),
      name: uploadedFile.name,
      size: formatFileSize(uploadedFile.size),
      type: uploadedFile.type,
      uploadedAt: Date.now(),
      status: 'uploading'
    };
    
    setUploadedFilesList(prev => [...prev, newFileMetadata]);
    
    const fileUploadMessage = {
      id: uuidv4(),
      role: 'user',
      content: `${t("upload.started")}: ${uploadedFile.name}...`,
      timestamp: new Date(),
      file: {
        id: newFileMetadata.id,
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: uploadedFile.type,
        uploadedAt: Date.now(),
        status: 'uploading',
      }
    };
    
    setChatMessages(prev => [...prev, fileUploadMessage]);

    const resolvedChatId = await ensureChatExists(currentChatID, user);
    if (resolvedChatId !== currentChatID) {
      setChatId(resolvedChatId);
    }
    
    const firebaseUserUploadLink = `chats/${resolvedChatId}/uploads/${uploadedFile.name}`;
    const storageRef = createStorageRef(firebaseUserUploadLink);
    const uploadTask = uploadBytesResumable(storageRef, uploadedFile);
    
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        
        setUploadedFilesList(prev =>
          prev.map(file =>
            file.id === newFileMetadata.id
              ? { ...file, progress, status: 'uploading' }
              : file
          )
        );
      },
      
      (error) => {
        console.error( `${t("upload.failed")} : `, error);
        setLoadingState('fileUpload', false);
        
        setUploadedFilesList(prev =>
          prev.map(file =>
            file.id === newFileMetadata.id
              ? { ...file, status: 'error', errorMessage: error.message }
              : file
          )
        );
      },
      
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
          const newFile = {
            ...newFileMetadata,
            status: 'completed',
            progress: 100,
            downloadURL
          };

          setUploadedFilesList(prev =>
            prev.map(file =>
              file.id === newFileMetadata.id ? newFile : file
            )
          );

          const finalFileUploadMessage = {
            ...fileUploadMessage,
            content: `${t("upload.uploaded")}: ${uploadedFile.name}`,
            file: {
              ...fileUploadMessage.file,
              status: 'completed',
              progress: 100,
              downloadURL
            }
          };

          const updatedChatId = await AppendToChat(resolvedChatId, finalFileUploadMessage);

          const completedFiles = [
            ...uploadedFilesList.filter(f => f.id !== newFileMetadata.id && f.status === 'completed'),
            newFile
          ];

          const filesList = formatFilesForAPI(completedFiles);
          
          if (filesList.length >= 1) {
            setLoadingState('fileUpload', false);
            setLoadingState('fileEmbedding', true);

            const embedResult = await embed_docs(filesList, updatedChatId);

            if (embedResult !== null) {
              const wordCount = embedResult["word-count"];
              setLoadingState('fileEmbedding', false);
              
              await SaveFileMetaData(updatedChatId, newFileMetadata, downloadURL, wordCount);
            }
          }
          
          if (updatedChatId !== resolvedChatId) {
            setChatId(updatedChatId);
          }
          
          simulateAiFileResponse(uploadedFile, resolvedChatId, downloadURL);
        });
      }
    );
    
    e.target.value = null;
  };

  const simulateAiFileResponse = async (file, updatedChatId) => {
    setIsAiTyping(true);
    
    try {
      const aiResponse = {
        id: uuidv4(),
        role: 'assistant',
        content: ` ${t('upload.received')} "" ${file.name} " ${t('upload.question')}`,
        // options: ["Résumé", "Quiz", "Mise en situation"],
        options: ["Résumé", "Quiz"],
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: Date.now(),
          status: 'completed',
        }
      };

      setChatMessages(prev => [...prev, aiResponse]);
      await AppendToChat(updatedChatId, aiResponse);

    } catch (error) {
      console.error("Error in AI response:", error);
    } finally {
      setIsAiTyping(false);
    }
  };

  // ============================================
  // DOCUMENT OPTIONS HANDLING
  // ============================================
  const handlePostDocumentUploadOption = async (option, fileName) => {
    setIsFilesModalVisible(false);
    scrollToLatestMessage();

    const optionHandlers = {
      // "Résumé": handleSummaryStream,
      // "Quiz": handleQuiz,
      // "Mise en situation": handleScenario
    };

    const handler = optionHandlers[option];
    if (handler) {
      await handler(fileName);
    }
  };



  // --- Updated handleSummary function using streaming logic ---
const handleSummaryStream = async (fileName) => {
    // Set loading state for the specific summary action
    setLoadingState('summary', true);
    
    // 1. Prepare for streaming
    const streamingMessageId = `summary-${Date.now()}`;
    let fullResponse = "";

    const placeholderMessage = {
        id: streamingMessageId,
        role: 'assistant',
        // Show an initial message before content starts streaming
        content: `Génération d'un résumé pour ${fileName}...`, 
        isStreaming: true,
        timestamp: new Date()
    };
    
    // Add placeholder message to chat to start the stream display
    setChatMessages(prev => [...prev, placeholderMessage]);
    
    try {
        // 2. Call the new streaming function
        await stream_summary(
            currentChatID, 
            fileName, 
            currentLanguage,
            
            // onTokenReceived (Chunk callback)
            (chunk, accumulatedText) => {
                // Update the state with the accumulating streaming content
                fullResponse = accumulatedText;
                setChatMessages(prev =>
                    prev.map(msg =>
                        msg.id === streamingMessageId
                            ? { ...msg, content: fullResponse, isStreaming: true }
                            : msg
                    )
                );
            },
            
            // onStreamEnd (Complete callback)
            async (finalContent) => {
                if (finalContent.startsWith("Error:")) {
                    // Handle API errors or connection issues by displaying the error message
                    const errorMessage = {
                        id: streamingMessageId,
                        role: "assistant",
                        content: finalContent,
                        error: true,
                        isStreaming: false,
                        timestamp: new Date()
                    };
                    
                    setChatMessages(prev =>
                        prev.map(msg => msg.id === streamingMessageId ? errorMessage : msg)
                    );
                } else {
                    // Create the final message object with the complete streamed text
                    const finalMessage = {
                        id: uuidv4(),
                        role: "assistant",
                        // The entire formatted summary is now in the content field
                        content: finalContent, 
                        // It is no longer a structured summary object (summaryData, type)
                        timestamp: new Date(),
                        isStreaming: false
                    };
                    
                    // Update the placeholder with the final message and save it to Firebase
                    setChatMessages(prev =>
                        prev.map(msg => msg.id === streamingMessageId ? finalMessage : msg)
                    );
                    await AppendToChat(currentChatID, finalMessage);
                }
                // Stop loading state regardless of success/failure
                setLoadingState('summary', false);
            }
        );
        
    } catch (error) {
        console.error("Summary streaming error:", error);
        
        // Handle critical error that occurred outside the stream reader
        const errorMessage = {
            id: streamingMessageId,
            role: "assistant",
            content: "Une erreur critique est survenue lors du lancement de la génération du résumé.",
            error: true,
            isStreaming: false,
            timestamp: new Date()
        };

        setChatMessages(prev =>
            prev.map(msg => msg.id === streamingMessageId ? errorMessage : msg)
        );
        
        setLoadingState('summary', false);
    }
};

  const handleScenario = async (fileName) => {

    setLoadingState('scenario', true);
    
    try {
      const scenarioResult = await generate_scenario(currentChatID, fileName);

      const newMessage = {
        id: uuidv4(),
        role: "assistant",
        type: "scenario",
        content: "Voici votre mise en situation",
        scenarioData: scenarioResult.scenario,
        file: { name: fileName },
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, newMessage]);
      
      const updatedChatId = await AppendToChat(currentChatID, newMessage);
      if (updatedChatId) {
        setChatId(updatedChatId);
      }
    } catch (error) {
      console.error("Error generating scenario:", error);
    } finally {
      setLoadingState('scenario', false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  const hasMessages = chatMessages.length > 0;
  const openFileUploadDialog = () => documentFileInputRef.current?.click();

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div className="chat-container" style={{ 
          width: activeStudyGuide ? '300px' : '100%',
          height:'100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: activeStudyGuide ? '1px solid #e5e7eb' : 'none'
        }}>
        {/* Header */}
        <div className="chat-header">
          <h2 className="chat-header-title" onClick={() => setIsFilesModalVisible(true)}>
              {currentChatTitle}
          </h2>
        </div>

        {/* Empty State */}
        {!hasMessages && (
          <div className="empty-chat-upload" onClick={openFileUploadDialog}>
            <SvgFileUpload />
            <p className="empty-upload-text">{t('chat.uploadFile')}</p>
            <button className="empty-upload-btn">{t('chat.uploadDocument')} ☁️⬆️</button>
          </div>
        )}

        {/* Messages */}
        <div className="messages-container">
          {chatMessages
            .filter(msg =>typeof msg.content === 'string' && 
                    msg.content.trim())
            .map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onOptionClick={handlePostDocumentUploadOption}
                onQuizAnswerSelect={handleQuizAnswerSelect}
                uploadedFilesList={uploadedFilesList}
              />
            ))}

          {/* Loading Spinners */}
          {loadingStates.quiz && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                  <span className="blinking-dots">
                    <h4>
                        <strong>
                          <GraduationEmoji/> {t("loading.generatingQuiz")}
                        </strong>                    

                    </h4>                
                  </span>
              </div>
            </div>
          )}

          {loadingStates.fileUpload && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                  <span className="blinking-dots">
                    <h4>
                        <strong>
                          📁 {t("loading.savingFile")}
                        </strong>
                      
                    </h4>                
                  </span>
              </div>
            </div>
          )}

          {loadingStates.fileEmbedding && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                  <span className="blinking-dots">
                    <h4>                      
                        <ReadingEmoji size={40} />
                        <strong>{t("loading.analyzingContent")}</strong>
                        <span></span>
                    <span></span>
                    <span></span>
                    </h4>                
                  </span>
              </div>
            </div>
          )}

          {loadingStates.summary && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                  <span className="blinking-dots">
                    <h4>                    
                        <PencilEmoji size={40} />
                        <strong>{t("loading.writingSummary")}</strong>
                        <span></span>
                        <span></span>
                        <span></span>
                    </h4>                
                  </span>
              </div>
            </div>
          )}

          {loadingStates.scenario && (
            <div className="chat-spinner">
              <div className="typing-indicator">
                  <span className="blinking-dots">
                    <h4>                    
                        <CookingEmoji size={40} />
                        {"  "}
                        <strong>Entrain de te concocter une mise en situation</strong>
                      <span></span>
                    <span></span>
                    <span></span>
                    </h4>                
                  </span>
              </div>
            </div>
          )}

          {/* AI Typing Indicator */}
        {isAiTyping && (
          <div className="message ai-message">
            <div>
              <img src="/LogoSimple.png" alt="Logo" width="65" />
            </div>
            <div className="chat-spinner">
              <div className="typing-indicator">
                {streamingStatus?.status === 'processing' &&  (
                  <>
                        <GearEmoji size={20}/> {"  "}
                  </>)
                }
                {streamingStatus?.status === 'thinking' && (
                  <>
                        <ThinkingEmoji size={20}/> {"  "}
                        
                  </>)
                }
                {streamingStatus?.status === 'retrieving' &&  (
                  <>
                        <ReadingEmoji size={20}/> {"  "}
                        <strong>Entrain de lire tes documents</strong>
                  </>)
                }
                {streamingStatus?.status === 'generating' &&  <PencilEmoji size={20} /> }
                {streamingStatus?.status === 'complete' && '✅'}
                {streamingStatus?.status === 'error' && '❌ une erreur est survenue'}

                {(streamingStatus?.status !== 'complete' && streamingStatus?.status !== 'error') && (
                  <span className="blinking-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  // <GhostLoader/>
                )}
              </div>
            </div>
          </div>
        )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form className="input-area" onSubmit={handleSendNewUserMessage}>
          <input
            type="file"
            ref={documentFileInputRef}
            onChange={handleDocumentUpload}
            style={{ display: 'none' }}
          />

          <div className="input-wrapper">
            <textarea
              placeholder="Message..."
              value={userInputText}
              onChange={(e) => setUserInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // submit form when user presses enter
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '24px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: '16px',
                lineHeight: '1.5',
                minHeight: '48px',
                maxHeight: '200px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}
            />

            <div className="input-actions">
              <button
                type="button"
                className="upload-button file-button"
                onClick={openFileUploadDialog}
                title="Ajouter un fichier"
              >
                <SvgFileUpload />
              </button>


            <button 
    type="button" 
    className="upload-button photo-button" 
    onClick={() => setIsFilesModalVisible(true)} 
    title={t('chat.filesInMemory')}
    style={{ position: 'relative' }}
  >
    📁 
    {uploadedFilesList.length > 0 && (
      <span style={{
        position: 'absolute',
        top: uploadedFilesList.length >= 10 ? '-10px' : '-8px',
        right: uploadedFilesList.length >= 10 ? '-10px' : '-8px',
        backgroundColor: '#a5d567',
        color: 'white',
        borderRadius: '50%',
        minWidth: uploadedFilesList.length >= 10 ? '24px' : '20px',
        height: uploadedFilesList.length >= 10 ? '24px' : '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: uploadedFilesList.length >= 10 ? '11px' : '12px',
        fontWeight: '600',
        border: '2px solid white',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        lineHeight: '1'
      }}>
        {uploadedFilesList.length} 
      </span>
    )}
  </button>
            </div>
          </div>

          <button
            type="submit"
            className={`send-button ${isSystemBusy() ? 'send-button-busy' : ''}`}
            disabled={!userInputText.trim() || isSystemBusy()}
          >
            {isSystemBusy() ? (
              <div className="pulsing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              t('chat.send')
            )}
          </button>

        </form>

        {/* Files Modal */}
        {isFilesModalVisible && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{t('chat.files')} 📁</h3>
                <button
                  className="close-button"
                  onClick={() => setIsFilesModalVisible(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                {uploadedFilesList.length === 0 ? (
                  <p className="no-files">{t('chat.noFiles')}</p>
                ) : (
                  <ul className="files-list">
                    {uploadedFilesList.map(file => (
                      <li key={file.id} className="file-item">
                        <div className="file-info">
                          <div className="file-icon">
                            {file.isImage ? <SvgImageIcon /> : <SvgFileIcon />}
                          </div>
                          <div className="file-details">
                            <div className="file-name">{file.name}</div>
                            <div className="file-meta">
                              <span className="file-size">{file.size}</span>
                              <span className="file-date">{formatDate(file.uploadedAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="file-actions">
                          {/* <button
                            className="file-action-btn"
                            onClick={() => handlePostDocumentUploadOption("Résumé", file.name)}
                            title={t('file.summarize')}
                          >
                            📝 {t('file.summary')}
                          </button>
                          <button
                            className="file-action-btn"
                            onClick={() => handlePostDocumentUploadOption("Quiz", file.name)}
                            title={t('file.generateQuiz')}
                          >
                            🧠 Quiz
                          </button> */}
                          {/* <button
                            className="file-action-btn"
                            onClick={() => handlePostDocumentUploadOption("Mise en situation", file.name)}
                            title={t('file.createScenario')}
                          >
                            🎭 {t('file.scenario')}
                          </button> */}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
       {/* Study Guide Panel */}
      {activeStudyGuide && (
        <div className="study-guide-panel">
          <div className="study-guide-header">
            <h2>📚 Guide</h2>
            <button className="study-guide-close-btn" onClick={() => setActiveStudyGuide(null)}>
             x
            </button>
          </div>
          <div className="study-guide-content">
               <StudyGuideGenerator
                  topic={activeStudyGuide.topic}
                  chatId={activeStudyGuide.chatId}
                  numSections={activeStudyGuide.num_sections}
                />      
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;