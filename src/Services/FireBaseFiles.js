import { getStorage, ref, listAll, getDownloadURL, uploadBytes, deleteObject } from "firebase/storage";

export const loadFilesForChat = async (chatId) => {

  //console.log("ATTEMPTING to fetch all files for CHAT: "+ chatId);
  const storage = getStorage();
  const uploadsPath = `chats/${chatId}/uploads`;
  const folderRef = ref(storage, uploadsPath);

  try {
    const result = await listAll(folderRef);

    const fileInfos = await Promise.all(
      result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          path: itemRef.fullPath,
          downloadURL: url
        };
      })
    );

    return fileInfos;

  } catch (error) {
    console.error("Failed to list files:", error);
    return [];
  }
};

/**
 * Save generated audio to Firebase Storage
 * @param {string} chatId - The chat ID
 * @param {string} audioBase64 - Base64 encoded audio data
 * @param {object} metadata - Audio metadata (topic, intent, duration, etc.)
 * @returns {Promise<object>} - Object with downloadURL and path
 */
export const saveAudioToStorage = async (chatId, audioBase64, metadata = {}) => {
  const storage = getStorage();

  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedTopic = (metadata.topic || 'audio').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  const filename = `${sanitizedTopic}_${metadata.intent || 'lesson'}_${timestamp}.mp3`;

  const audioPath = `chats/${chatId}/audio/${filename}`;
  const audioRef = ref(storage, audioPath);

  try {
    // Convert base64 to blob
    const byteCharacters = atob(audioBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'audio/mpeg' });

    // Upload with metadata
    const uploadMetadata = {
      contentType: 'audio/mpeg',
      customMetadata: {
        topic: metadata.topic || '',
        intent: metadata.intent || '',
        duration: metadata.duration || '',
        createdAt: new Date().toISOString()
      }
    };

    await uploadBytes(audioRef, blob, uploadMetadata);
    const downloadURL = await getDownloadURL(audioRef);

    return {
      success: true,
      downloadURL,
      path: audioPath,
      filename
    };
  } catch (error) {
    console.error("Failed to save audio:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Load all audio files for a chat
 * @param {string} chatId - The chat ID
 * @returns {Promise<Array>} - Array of audio file info
 */
export const loadAudioForChat = async (chatId) => {
  const storage = getStorage();
  const audioPath = `chats/${chatId}/audio`;
  const folderRef = ref(storage, audioPath);

  try {
    const result = await listAll(folderRef);

    const audioFiles = await Promise.all(
      result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          path: itemRef.fullPath,
          downloadURL: url
        };
      })
    );

    return audioFiles;
  } catch (error) {
    console.error("Failed to list audio files:", error);
    return [];
  }
};

/**
 * Delete an audio file from storage
 * @param {string} audioPath - Full path to the audio file
 * @returns {Promise<boolean>} - Success status
 */
export const deleteAudioFromStorage = async (audioPath) => {
  const storage = getStorage();
  const audioRef = ref(storage, audioPath);

  try {
    await deleteObject(audioRef);
    return true;
  } catch (error) {
    console.error("Failed to delete audio:", error);
    return false;
  }
};

