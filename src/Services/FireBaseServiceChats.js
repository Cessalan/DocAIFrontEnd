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
    quizData[quizIndex] = {
      ...quizData[quizIndex],
      userSelection: {
        selectedOption: userSelection.selectedOptionText,
        selectedIndex: userSelection.selectedOptionIndex,
        isCorrect: userSelection.isCorrect,
        timestamp: userSelection.timestamp,
        timeToAnswer: userSelection.timeToAnswer || null
      }
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


export const DeleteChat = async (chatId) => {
  try {
    console.log("🗑️ Deleting chat:", chatId);

    // 1. Delete messages subcollection
    const messagesRef = collection(db, "chats", chatId, "messages");
    const messagesSnapshot = await getDocs(messagesRef);

    const deletePromises = messagesSnapshot.docs.map(doc =>
      deleteDoc(doc.ref)
    );
    await Promise.all(deletePromises);
    console.log("✅ Deleted", messagesSnapshot.size, "messages");

    // 2. Delete chat document
    await deleteDoc(doc(db, "chats", chatId));
    console.log("✅ Deleted chat document");

    // 3. Delete uploaded files in Storage: /chats/{chatId}/
    const chatStorageRef = ref(storage, `chats/${chatId}`);
    await deleteFolder(chatStorageRef);
    console.log("✅ Deleted /chats folder");

    // 4. Delete vector store files: /FileVectorStore/{chatId}/
    const vectorStoreRef = ref(storage, `FileVectorStore/${chatId}`);
    await deleteFolder(vectorStoreRef);
    console.log("✅ Deleted /FileVectorStore folder");

    console.log("✅ Chat deleted successfully");
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
 * @returns {Promise<Array>} - Array of quiz feedback objects
 */
export const GetAllQuizFeedbacks = async () => {
  try {
    console.log("📥 Fetching all quiz feedbacks...");

    const chatsRef = collection(db, "chats");
    const chatsSnapshot = await getDocs(chatsRef);

    const allFeedbacks = [];

    // Iterate through each chat
    for (const chatDoc of chatsSnapshot.docs) {
      const chatId = chatDoc.id;
      const messagesRef = collection(db, "chats", chatId, "messages");
      const messagesSnapshot = await getDocs(messagesRef);

      // Find messages with feedbackData
      messagesSnapshot.docs.forEach(messageDoc => {
        const messageData = messageDoc.data();
        if (messageData.feedbackData) {
          allFeedbacks.push({
            id: messageDoc.id,
            chatId,
            messageId: messageData.id || messageDoc.id,
            feedbackData: messageData.feedbackData,
            timestamp: messageData.feedbackData.submittedAt,
            quizContent: messageData.content || messageData.text || 'N/A'
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

export { AppendToChat, SaveFileMetaData, GetFileMetadataByName };
