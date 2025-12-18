import { createStorageRef, db, user, auth, storage } from "../Firebase/config";
import { listAll, getMetadata, getDownloadURL, ref, deleteObject } from "firebase/storage";
import {
  query,
  orderBy,
  onSnapshot,
  collection,
  serverTimestamp,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";

import { generate_title } from '../Services/FastAPICalls.js';

const CreateNewChatWithMessage = async (messageObject) => {
  try {
    const userId = auth.currentUser.uid;

    // Step 1: Create a custom chat ID (optional — or use addDoc for auto ID)
    const chatRef = doc(collection(db, "chats")); // creates a doc ref with random ID

    // Step 2: Create a title for the chat based on the content of the message
    // make a request to FAST API to generate title using AI
    let chat_title_promise = await generate_title(messageObject.content);
    let chat_title = chat_title_promise.title;

    console.log("chat title created: ", chat_title);

    // create a new chat document
    const newChat = {
      userId,
      title: chat_title,
      description: "New conversation started.",
      updatedAt: serverTimestamp(),
    };

    // add document to firebase
    await setDoc(chatRef, newChat);

    // inside the chat docucument add a collection of messages
    await addDoc(collection(chatRef, "messages"), {
      // add a document inside the collection
      ...messageObject,
      timestamp: serverTimestamp(),
    });

    // log that it was successful
    console.log("✅ New chat created and message added to:", chatRef.id);

    return chatRef.id;

  } catch (error) {
    console.error("❌ Error creating chat with message message:", error);
  }
};

const ChatHasMessages = async (chatId) => {
  try {

    // query all the messages in a chat using ID
    const messagesRef = collection(db, "chats", chatId, "messages");
    const snapshot = await getDocs(messagesRef);

    // check if there is a message
    return !snapshot.empty; // true if there is at least one message

  } catch (error) {
    console.error("❌ Error checking if chat has messages:", error);
    return false;
  }
};

const AppendToChat = async (chatId, messageObject) => {

  // if there is no chatID, create a new chat and insert the first message
  // this will also generate a chat title
  if (!chatId) {
    chatId = await CreateNewChatWithMessage(messageObject);
    return chatId;
  }

  try {
    console.log("Attempting to upload to chatID:" + chatId);
    console.log("message object: ", messageObject);

    // check if there has been messages
    const chatHasMessages = await ChatHasMessages(chatId);

    if (!chatHasMessages) {
      // if chat doesnt have a message generate a title using AI
      let chat_title_promise = await generate_title(messageObject.content);
      let chat_title = chat_title_promise.title;

      try {
        // query the chat i want to update
        const chatRef = doc(db, "chats", chatId);

        // update the chat doc by adding the title generated
        await updateDoc(chatRef, {
          title: chat_title,
          updatedAt: serverTimestamp()  // Optional: update timestamp
        });

        // show that the update was successful
        console.log("✅ Chat title updated");

      } catch (error) {
        console.error("❌ Error updating chat title:", error);
      }
    }

    console.log("Adding message do addDoc: ", messageObject)

    // add a message in the collection inside chat
    await addDoc(collection(db, "chats", chatId, "messages"), {
      ...messageObject,
      timestamp: serverTimestamp() // Firebase server time
    });



    // Step 2: Update the parent chat's updatedAt
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error("❌ Error uploading user message to Chat:", chatId, error);
  }

  return chatId;
}

const SaveFileMetaData = async (chatId, newFileMetaData, downloadURL, wordCount) => {
  const fileDocRef = doc(db, "chats", chatId, "uploads", newFileMetaData.id);
  await setDoc(fileDocRef, {
    ...newFileMetaData,
    downloadURL,
    wordCount: wordCount || 0,
    uploadedAt: serverTimestamp()
  });
}

// Function to get metadata by filename
const GetFileMetadataByName = async (chatId, filename) => {
  const uploadsRef = collection(db, "chats", chatId, "uploads");
  const q = query(uploadsRef, where("name", "==", filename));

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log("No matching document found.");
    return null;
  }

  const result = snapshot.docs[0].data(); // Get first match (you can loop if needed)
  console.log("Found file metadata:", result);
  return result;
};

export const UpdateQuizAnswer = async (chatId, messageId, questionText, userSelection) => {
  try {
    console.log("Attempting to update quiz answer:", { chatId, messageId, questionText });

    let messageRef;
    let messageDoc;
    let actualDocId;

    // STEP 1: Try direct access using messageId as Firebase document ID
    try {
      messageRef = doc(db, "chats", chatId, "messages", messageId);
      messageDoc = await getDoc(messageRef);

      if (messageDoc.exists()) {
        console.log("Found message via direct access");
        actualDocId = messageId;
      }
    } catch (directAccessError) {
      console.log("Direct access failed, will try query approach");
    }

    // STEP 2: If direct access failed, query for document with matching id field
    if (!messageDoc || !messageDoc.exists()) {
      console.log("Querying for message with id field:", messageId);

      const messagesRef = collection(db, "chats", chatId, "messages");
      const q = query(messagesRef, where("id", "==", messageId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error(`Message not found: ${messageId} in chat: ${chatId}`);
      }

      // Get the first (should be only) matching document
      messageDoc = querySnapshot.docs[0];
      actualDocId = messageDoc.id;
      messageRef = doc(db, "chats", chatId, "messages", actualDocId);

      console.log("Found message via query, Firebase doc ID:", actualDocId);
    }

    console.log("Message found, data:", messageDoc.data());

    const messageData = messageDoc.data();
    const quizData = [...messageData.quizData];

    // Find the quiz question by matching the question text
    const quizIndex = quizData.findIndex(quiz => quiz.question === questionText);

    if (quizIndex === -1) {
      throw new Error(`Quiz question not found with text: ${questionText}`);
    }

    // Update the specific quiz question with user selection
    // Handle both MCQ and SATA question types
    const questionType = userSelection.questionType || quizData[quizIndex].questionType || 'mcq';

    let userSelectionData;

    if (questionType === 'sata') {
      // SATA question: multiple selections with partial scoring
      userSelectionData = {
        questionType: 'sata',
        selectedOptions: userSelection.selectedOptions || [],
        correctOptions: userSelection.correctOptions || [],
        isCorrect: userSelection.isCorrect,
        score: userSelection.score || 0,
        maxScore: userSelection.maxScore || 0,
        percentage: userSelection.percentage || 0,
        scoreResult: userSelection.scoreResult || null,
        timestamp: userSelection.timestamp,
        timeToAnswer: userSelection.timeToAnswer || null
      };
    } else {
      // MCQ question: single selection
      userSelectionData = {
        questionType: 'mcq',
        selectedOption: userSelection.selectedOptionText,
        selectedIndex: userSelection.selectedOptionIndex,
        isCorrect: userSelection.isCorrect,
        timestamp: userSelection.timestamp,
        timeToAnswer: userSelection.timeToAnswer || null
      };
    }

    quizData[quizIndex] = {
      ...quizData[quizIndex],
      userSelection: userSelectionData
    };

    // Update the message document using the correct Firebase document reference
    await updateDoc(messageRef, {
      quizData: quizData,
      updatedAt: new Date()
    });

    console.log("Quiz answer saved successfully to document:", actualDocId);
    return { success: true, docId: actualDocId };

  } catch (error) {
    console.error("Error saving quiz answer:", error);
    throw error;
  }
};

export const UpdateFlashcardReview = async (chatId, messageId, cardIndex, reviewData) => {
  try {
    console.log("Attempting to update flashcard review:", { chatId, messageId, cardIndex });

    let messageRef;
    let messageDoc;
    let actualDocId;

    // STEP 1: Try direct access using messageId as Firebase document ID
    try {
      messageRef = doc(db, "chats", chatId, "messages", messageId);
      messageDoc = await getDoc(messageRef);

      if (messageDoc.exists()) {
        console.log("Found message via direct access");
        actualDocId = messageId;
      }
    } catch (directAccessError) {
      console.log("Direct access failed, will try query approach");
    }

    // STEP 2: If direct access failed, query for document with matching id field
    if (!messageDoc || !messageDoc.exists()) {
      console.log("Querying for message with id field:", messageId);

      const messagesRef = collection(db, "chats", chatId, "messages");
      const q = query(messagesRef, where("id", "==", messageId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error(`Message not found: ${messageId} in chat: ${chatId}`);
      }

      messageDoc = querySnapshot.docs[0];
      actualDocId = messageDoc.id;
      messageRef = doc(db, "chats", chatId, "messages", actualDocId);

      console.log("Found message via query, Firebase doc ID:", actualDocId);
    }

    console.log("Message found, data:", messageDoc.data());

    const messageData = messageDoc.data();
    const flashcardData = [...messageData.flashcardData];

    if (cardIndex < 0 || cardIndex >= flashcardData.length) {
      throw new Error(`Invalid card index: ${cardIndex}`);
    }

    // Update the specific flashcard with review data
    flashcardData[cardIndex] = {
      ...flashcardData[cardIndex],
      userReview: reviewData.userReview,
      status: reviewData.status,
      reviewCount: reviewData.reviewCount,
      lastReviewed: reviewData.lastReviewed
    };

    // Update the message document
    await updateDoc(messageRef, {
      flashcardData: flashcardData,
      updatedAt: new Date()
    });

    console.log("Flashcard review saved successfully to document:", actualDocId);
    return { success: true, docId: actualDocId };

  } catch (error) {
    console.error("Error saving flashcard review:", error);
    throw error;
  }
};


export const DeleteChat = async (chatId) => {
  try {
    console.log("🗑️ Deleting chat:", chatId);

    // 1. Delete messages subcollection
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messagesSnapshot = await getDocs(messagesRef);

    const messageDeletePromises = messagesSnapshot.docs.map(docSnap =>
      deleteDoc(docSnap.ref)
    );
    await Promise.all(messageDeletePromises);
    console.log("✅ Deleted", messagesSnapshot.size, "messages");

    // 2. Delete uploads subcollection (file metadata)
    const uploadsRef = collection(db, "chats", chatId, "uploads");
    const uploadsSnapshot = await getDocs(uploadsRef);

    const uploadsDeletePromises = uploadsSnapshot.docs.map(docSnap =>
      deleteDoc(docSnap.ref)
    );
    await Promise.all(uploadsDeletePromises);
    console.log("✅ Deleted", uploadsSnapshot.size, "upload metadata documents");

    // 3. Delete chat document
    await deleteDoc(doc(db, "chats", chatId));
    console.log("✅ Deleted chat document");

    // 4. Delete uploaded files in Storage: /chats/{chatId}/
    const chatStorageRef = ref(storage, `chats/${chatId}`);
    await deleteFolder(chatStorageRef);
    console.log("✅ Deleted /chats/{chatId} folder (uploads, audio)");

    // 5. Delete per-file vector store files: /FileVectorStore/{chatId}/
    const fileVectorStoreRef = ref(storage, `FileVectorStore/${chatId}`);
    await deleteFolder(fileVectorStoreRef);
    console.log("✅ Deleted /FileVectorStore/{chatId} folder");

    // 6. Delete combined vector store: /vectorstores/{chatId}/
    const combinedVectorStoreRef = ref(storage, `vectorstores/${chatId}`);
    await deleteFolder(combinedVectorStoreRef);
    console.log("✅ Deleted /vectorstores/{chatId} folder");

    console.log("✅ Chat fully deleted: messages, uploads, files, and embeddings");
    return { success: true };

  } catch (error) {
    console.error("❌ Error deleting chat:", error);
    throw error;
  }
};

// Helper function to recursively delete a Storage folder
async function deleteFolder(folderRef) {
  try {
    const listResult = await listAll(folderRef);

    // Delete all files in this folder
    const fileDeletePromises = listResult.items.map(item =>
      deleteObject(item)
    );
    await Promise.all(fileDeletePromises);

    // Recursively delete all subfolders
    const folderDeletePromises = listResult.prefixes.map(prefix =>
      deleteFolder(prefix)
    );
    await Promise.all(folderDeletePromises);

  } catch (error) {
    // Folder might not exist, that's okay
    if (error.code !== 'storage/object-not-found') {
      console.warn("Error deleting folder:", error);
    }
  }
}
// Function to save quiz feedback
export const SaveQuizFeedback = async (chatId, messageId, feedbackData) => {
  try {
    console.log("Attempting to save quiz feedback:", { chatId, messageId, feedbackData });

    let messageRef;
    let messageDoc;
    let actualDocId;

    // STEP 1: Try direct access using messageId as Firebase document ID
    try {
      messageRef = doc(db, "chats", chatId, "messages", messageId);
      messageDoc = await getDoc(messageRef);

      if (messageDoc.exists()) {
        console.log("Found message via direct access");
        actualDocId = messageId;
      }
    } catch (directAccessError) {
      console.log("Direct access failed, will try query approach");
    }

    // STEP 2: If direct access failed, query for document with matching id field
    if (!messageDoc || !messageDoc.exists()) {
      console.log("Querying for message with id field:", messageId);

      const messagesRef = collection(db, "chats", chatId, "messages");
      const q = query(messagesRef, where("id", "==", messageId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error(`Message not found: ${messageId} in chat: ${chatId}`);
      }

      // Get the first (should be only) matching document
      messageDoc = querySnapshot.docs[0];
      actualDocId = messageDoc.id;
      messageRef = doc(db, "chats", chatId, "messages", actualDocId);

      console.log("Found message via query, Firebase doc ID:", actualDocId);
    }

    // Update the message document with feedback data
    await updateDoc(messageRef, {
      feedbackData: {
        ...feedbackData,
        submittedAt: new Date()
      },
      updatedAt: new Date()
    });

    console.log("Quiz feedback saved successfully to document:", actualDocId);
    return { success: true, docId: actualDocId };

  } catch (error) {
    console.error("Error saving quiz feedback:", error);
    throw error;
  }
};

/**
 * Get all quiz feedbacks from all chats (DEV MODE ONLY)
 * @returns {Promise<Array>} - Array of quiz feedback objects with full context
 */
export const GetAllQuizFeedbacks = async () => {
  try {
    console.log("📥 Fetching all quiz feedbacks...");

    const userId = auth.currentUser?.uid;
    const chatsRef = collection(db, "chats");
    const chatsSnapshot = await getDocs(chatsRef);

    const allFeedbacks = [];

    // Iterate through each chat
    for (const chatDoc of chatsSnapshot.docs) {
      const chatId = chatDoc.id;
      const chatData = chatDoc.data();

      const messagesRef = collection(db, "chats", chatId, "messages");
      const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));
      const messagesSnapshot = await getDocs(messagesQuery);

      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Find messages with feedbackData and quizData
      messages.forEach((messageData, index) => {
        if (messageData.feedbackData && messageData.quizData) {
          // Get previous and next messages
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

          allFeedbacks.push({
            id: messageData.id,
            chatId,
            messageId: messageData.id,
            userEmail: chatData.userEmail || auth.currentUser?.email || 'Unknown',
            userId: chatData.userId || userId,
            feedbackData: messageData.feedbackData,
            timestamp: messageData.feedbackData.submittedAt,
            // Quiz content
            quizData: messageData.quizData,
            totalQuestions: Array.isArray(messageData.quizData) ? messageData.quizData.length : 0,
            // Context messages
            previousMessage: previousMessage ? {
              content: previousMessage.content || previousMessage.text,
              type: previousMessage.type,
              sender: previousMessage.sender,
              timestamp: previousMessage.timestamp
            } : null,
            nextMessage: nextMessage ? {
              content: nextMessage.content || nextMessage.text,
              type: nextMessage.type,
              sender: nextMessage.sender,
              timestamp: nextMessage.timestamp
            } : null
          });
        }
      });
    }

    // Sort by timestamp descending (newest first)
    allFeedbacks.sort((a, b) => {
      const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp) || new Date(0);
      const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp) || new Date(0);
      return timeB - timeA;
    });

    console.log(`✅ Fetched ${allFeedbacks.length} quiz feedbacks`);
    return allFeedbacks;

  } catch (error) {
    console.error("❌ Error fetching quiz feedbacks:", error);
    throw error;
  }
};

/**
 * Get ALL quizzes from all chats (DEV MODE ONLY)
 * Unlike GetAllQuizFeedbacks, this returns ALL quizzes regardless of feedback
 * @returns {Promise<Array>} - Array of quiz objects with full context
 */
export const GetAllQuizzes = async () => {
  try {
    console.log("📥 Fetching all quizzes...");

    const chatsRef = collection(db, "chats");
    const chatsSnapshot = await getDocs(chatsRef);

    const allQuizzes = [];

    // Iterate through each chat
    for (const chatDoc of chatsSnapshot.docs) {
      const chatId = chatDoc.id;
      const chatData = chatDoc.data();

      const messagesRef = collection(db, "chats", chatId, "messages");
      const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));
      const messagesSnapshot = await getDocs(messagesQuery);

      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Find ALL messages with quizData (regardless of feedback)
      messages.forEach((messageData, index) => {
        if (messageData.quizData && Array.isArray(messageData.quizData) && messageData.quizData.length > 0) {
          // Get previous message for context (usually the user's request)
          const previousMessage = index > 0 ? messages[index - 1] : null;

          allQuizzes.push({
            id: messageData.id,
            chatId,
            messageId: messageData.id,
            userEmail: chatData.userEmail || 'Anonymous',
            userId: chatData.userId || 'Unknown',
            timestamp: messageData.timestamp,
            // Quiz content
            quizData: messageData.quizData,
            totalQuestions: messageData.quizData.length,
            // Has feedback?
            hasFeedback: !!messageData.feedbackData,
            feedbackData: messageData.feedbackData || null,
            // User's answers if available
            userAnswers: messageData.userAnswers || null,
            // Context - what prompted this quiz
            previousMessage: previousMessage ? {
              content: previousMessage.content || previousMessage.text,
              type: previousMessage.type,
              sender: previousMessage.sender,
              timestamp: previousMessage.timestamp
            } : null
          });
        }
      });
    }

    // Sort by timestamp descending (newest first)
    allQuizzes.sort((a, b) => {
      const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp) || new Date(0);
      const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp) || new Date(0);
      return timeB - timeA;
    });

    console.log(`✅ Fetched ${allQuizzes.length} total quizzes`);
    return allQuizzes;

  } catch (error) {
    console.error("❌ Error fetching all quizzes:", error);
    throw error;
  }
};

/**
 * Get all flashcard feedbacks from all chats (DEV MODE ONLY)
 * @returns {Promise<Array>} - Array of flashcard feedback objects with full context
 */
export const GetAllFlashcardFeedbacks = async () => {
  try {
    console.log("📥 Fetching all flashcard feedbacks...");

    const userId = auth.currentUser?.uid;
    const chatsRef = collection(db, "chats");
    const chatsSnapshot = await getDocs(chatsRef);

    const allFeedbacks = [];

    // Iterate through each chat
    for (const chatDoc of chatsSnapshot.docs) {
      const chatId = chatDoc.id;
      const chatData = chatDoc.data();

      const messagesRef = collection(db, "chats", chatId, "messages");
      const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));
      const messagesSnapshot = await getDocs(messagesQuery);

      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Find messages with feedbackData and flashcardData
      messages.forEach((messageData, index) => {
        if (messageData.feedbackData && messageData.flashcardData) {
          // Get previous and next messages
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

          allFeedbacks.push({
            id: messageData.id,
            chatId,
            messageId: messageData.id,
            userEmail: chatData.userEmail || auth.currentUser?.email || 'Unknown',
            userId: chatData.userId || userId,
            feedbackData: messageData.feedbackData,
            timestamp: messageData.feedbackData.submittedAt,
            // Flashcard content
            flashcardData: messageData.flashcardData,
            totalCards: Array.isArray(messageData.flashcardData) ? messageData.flashcardData.length : 0,
            // Context messages
            previousMessage: previousMessage ? {
              content: previousMessage.content || previousMessage.text,
              type: previousMessage.type,
              sender: previousMessage.sender,
              timestamp: previousMessage.timestamp
            } : null,
            nextMessage: nextMessage ? {
              content: nextMessage.content || nextMessage.text,
              type: nextMessage.type,
              sender: nextMessage.sender,
              timestamp: nextMessage.timestamp
            } : null
          });
        }
      });
    }

    // Sort by timestamp descending (newest first)
    allFeedbacks.sort((a, b) => {
      const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp) || new Date(0);
      const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp) || new Date(0);
      return timeB - timeA;
    });

    console.log(`✅ Fetched ${allFeedbacks.length} flashcard feedbacks`);
    return allFeedbacks;

  } catch (error) {
    console.error("❌ Error fetching flashcard feedbacks:", error);
    throw error;
  }
};

/**
 * Delete a single message from a chat
 * @param {string} chatId - The chat ID
 * @param {string} messageId - The message ID to delete
 * @returns {Promise<Object>} - Success status
 */
export const DeleteMessage = async (chatId, messageId) => {
  try {
    console.log("🗑️ Deleting message:", messageId, "from chat:", chatId);

    let messageRef;
    let messageDoc;
    let actualDocId;

    // STEP 1: Try direct access using messageId as Firebase document ID
    try {
      messageRef = doc(db, "chats", chatId, "messages", messageId);
      messageDoc = await getDoc(messageRef);

      if (messageDoc.exists()) {
        console.log("Found message via direct access");
        actualDocId = messageId;
      }
    } catch (directAccessError) {
      console.log("Direct access failed, will try query approach");
    }

    // STEP 2: If direct access failed, query for document with matching id field
    if (!messageDoc || !messageDoc.exists()) {
      console.log("Querying for message with id field:", messageId);

      const messagesRef = collection(db, "chats", chatId, "messages");
      const q = query(messagesRef, where("id", "==", messageId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error(`Message not found: ${messageId} in chat: ${chatId}`);
      }

      messageDoc = querySnapshot.docs[0];
      actualDocId = messageDoc.id;
      messageRef = doc(db, "chats", chatId, "messages", actualDocId);

      console.log("Found message via query, Firebase doc ID:", actualDocId);
    }

    // Delete the message
    await deleteDoc(messageRef);
    console.log("✅ Message deleted successfully:", actualDocId);

    return { success: true, docId: actualDocId };

  } catch (error) {
    console.error("❌ Error deleting message:", error);
    throw error;
  }
};

/**
 * Increment the completed sessions count for a chat
 * Used to track user progress through momentum milestones
 * @param {string} chatId - The chat ID
 * @returns {Promise<number>} - The new session count
 */
export const IncrementCompletedSessions = async (chatId) => {
  try {
    if (!chatId) {
      console.warn("No chatId provided for session increment");
      return 0;
    }

    const chatRef = doc(db, "chats", chatId);
    const chatDoc = await getDoc(chatRef);

    if (!chatDoc.exists()) {
      console.warn("Chat not found:", chatId);
      return 0;
    }

    const currentCount = chatDoc.data().completedSessions || 0;
    const newCount = currentCount + 1;

    await updateDoc(chatRef, {
      completedSessions: newCount,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ Session count incremented: ${currentCount} → ${newCount}`);
    return newCount;

  } catch (error) {
    console.error("❌ Error incrementing session count:", error);
    return 0;
  }
};

/**
 * Get the completed sessions count for a chat
 * @param {string} chatId - The chat ID
 * @returns {Promise<number>} - The current session count
 */
export const GetCompletedSessions = async (chatId) => {
  try {
    if (!chatId) return 0;

    const chatRef = doc(db, "chats", chatId);
    const chatDoc = await getDoc(chatRef);

    if (!chatDoc.exists()) return 0;

    return chatDoc.data().completedSessions || 0;

  } catch (error) {
    console.error("❌ Error getting session count:", error);
    return 0;
  }
};

export { AppendToChat, SaveFileMetaData, GetFileMetadataByName };
