/**
 * StudySessionService.js
 * Firestore operations for Study Session state management
 *
 * Study Sessions are special chat documents with isStudySession: true
 * They use the existing chats/{chatId} structure with additional study fields
 */

import { db, auth } from '../Firebase/config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new study session from the existing chat
 *
 * This updates the current chat to become a study session rather than
 * creating a new document. This keeps all context (uploads, vectorstore) intact.
 *
 * @param {string} chatId - The chat ID where documents were uploaded
 * @param {Object} pathResult - AI-generated study path from /study/plan endpoint
 * @param {string[]} uploadIds - IDs of uploads being studied
 * @returns {Promise<Object>} - Study state for the frontend
 */
export const createStudySession = async (chatId, pathResult, uploadIds = []) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    // Validate pathResult
    if (!pathResult || !pathResult.nodes || pathResult.nodes.length === 0) {
      throw new Error('Invalid study path: no nodes found');
    }

    // Generate unique IDs for each node (backend may not provide them)
    const nodesWithIds = pathResult.nodes.map((node, index) => ({
      id: node.id || `node-${uuidv4().slice(0, 8)}`,
      type: node.type,
      label: node.label,
      tags: node.tags || [],
      difficulty: node.difficulty || 1,
      status: index === 0 ? 'active' : 'locked',
      messageId: null // Will be set when content is generated
    }));

    // Build the study session data
    // We UPDATE the existing chat rather than creating a new one
    const chatRef = doc(db, 'chats', chatId);

    // Create a title from topics if available
    const topics = pathResult.topics || [];
    const title = topics.length > 0
      ? `Study: ${topics.slice(0, 2).join(', ')}`
      : 'Study Session';

    const studyData = {
      // Update chat metadata
      title: title,
      updatedAt: serverTimestamp(),

      // Mark as study session
      isStudySession: true,

      // Study-specific data
      study: {
        status: 'active', // 'active' | 'paused' | 'completed'
        source: {
          uploadIds: uploadIds,
          chatId: chatId // Same chat
        },
        path: {
          topics: topics,
          totalNodes: pathResult.total_nodes || nodesWithIds.length,
          estimatedMinutes: pathResult.estimated_time_minutes || nodesWithIds.length * 3,
          activeNodeId: nodesWithIds[0]?.id || null,
          nodes: nodesWithIds
        },
        askedHashes: [], // Anti-repeat tracking
        lastActionAt: serverTimestamp()
      }
    };

    await updateDoc(chatRef, studyData);
    console.log('✅ Study session created for chat:', chatId);

    // Return the study state for the frontend
    return {
      chatId: chatId,
      status: 'active',
      path: {
        topics: topics,
        nodes: nodesWithIds,
        activeNodeId: nodesWithIds[0]?.id || null,
        totalNodes: nodesWithIds.length,
        estimatedMinutes: studyData.study.path.estimatedMinutes
      },
      askedHashes: []
    };
  } catch (error) {
    console.error('❌ Error creating study session:', error);
    throw error;
  }
};

/**
 * Get the user's active study session (if any)
 * @param {string} chatId - Optional specific chat ID to check
 * @returns {Promise<Object|null>} - Active study session state or null
 */
export const getActiveStudySession = async (chatId = null) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;

    // If chatId provided, check that specific chat
    if (chatId) {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) return null;

      const data = chatSnap.data();
      if (!data.isStudySession || data.study?.status !== 'active') {
        return null;
      }

      // Return in the same format as createStudySession
      return {
        chatId: chatSnap.id,
        status: data.study.status,
        path: data.study.path,
        askedHashes: data.study.askedHashes || []
      };
    }

    // Otherwise, find the most recent active study session
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId),
      where('isStudySession', '==', true),
      orderBy('updatedAt', 'desc'),
      limit(5) // Get a few and filter in JS (avoids complex index)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    // Find the first active one
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.study?.status === 'active') {
        return {
          chatId: docSnap.id,
          status: data.study.status,
          path: data.study.path,
          askedHashes: data.study.askedHashes || []
        };
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching active study session:', error);
    return null;
  }
};

/**
 * Get a specific study session by ID
 * @param {string} chatId - Study session chat ID
 * @returns {Promise<Object|null>} - Study session state or null
 */
export const getStudySession = async (chatId) => {
  try {
    const docRef = doc(db, 'chats', chatId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || !docSnap.data().isStudySession) {
      return null;
    }

    const data = docSnap.data();

    // Return in the same format as createStudySession
    return {
      chatId: docSnap.id,
      status: data.study?.status || 'active',
      path: data.study?.path || { nodes: [], activeNodeId: null },
      askedHashes: data.study?.askedHashes || []
    };
  } catch (error) {
    console.error('❌ Error fetching study session:', error);
    return null;
  }
};

/**
 * Update the study path (nodes, active node, etc.)
 * @param {string} chatId - Study session chat ID
 * @param {Object} pathUpdates - Partial path updates
 */
export const updateStudyPath = async (chatId, pathUpdates) => {
  try {
    const chatRef = doc(db, 'chats', chatId);

    // Build update object with nested path fields
    const updates = {
      updatedAt: serverTimestamp(),
      'study.lastActionAt': serverTimestamp()
    };

    // Add each path update with proper nesting
    Object.entries(pathUpdates).forEach(([key, value]) => {
      updates[`study.path.${key}`] = value;
    });

    await updateDoc(chatRef, updates);
    console.log('✅ Study path updated');
  } catch (error) {
    console.error('❌ Error updating study path:', error);
    throw error;
  }
};

/**
 * Update a specific node's status and messageId
 * @param {string} chatId - Study session chat ID
 * @param {string} nodeId - Node ID to update
 * @param {Object} nodeUpdates - { status, messageId }
 */
export const updateNodeStatus = async (chatId, nodeId, nodeUpdates) => {
  try {
    // First get the current document
    const docRef = doc(db, 'chats', chatId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Study session not found');
    }

    const data = docSnap.data();
    const nodes = [...data.study.path.nodes];

    // Find and update the specific node
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) {
      throw new Error(`Node ${nodeId} not found`);
    }

    nodes[nodeIndex] = {
      ...nodes[nodeIndex],
      ...nodeUpdates
    };

    // Update the document
    await updateDoc(docRef, {
      'study.path.nodes': nodes,
      'study.lastActionAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Node status updated:', nodeId, nodeUpdates);
  } catch (error) {
    console.error('❌ Error updating node status:', error);
    throw error;
  }
};

/**
 * Mark current node as done and unlock/activate the next node
 * @param {string} chatId - Study session chat ID
 * @param {string} currentNodeId - Current node ID to mark as done
 * @returns {Promise<Object>} - { nextNodeId, isComplete }
 */
export const completeNodeAndAdvance = async (chatId, currentNodeId) => {
  try {
    const docRef = doc(db, 'chats', chatId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Study session not found');
    }

    const data = docSnap.data();
    const nodes = [...data.study.path.nodes];

    // Find current node index
    const currentIndex = nodes.findIndex(n => n.id === currentNodeId);
    if (currentIndex === -1) {
      throw new Error(`Node ${currentNodeId} not found`);
    }

    // Mark current node as done
    nodes[currentIndex] = {
      ...nodes[currentIndex],
      status: 'done'
    };

    // Check if there's a next node
    const nextIndex = currentIndex + 1;
    const hasNextNode = nextIndex < nodes.length;
    let nextNodeId = null;

    if (hasNextNode) {
      // Unlock and activate next node
      nodes[nextIndex] = {
        ...nodes[nextIndex],
        status: 'active'
      };
      nextNodeId = nodes[nextIndex].id;
    }

    // Check if study is complete
    const isComplete = !hasNextNode;
    const newStatus = isComplete ? 'completed' : 'active';

    // Update document
    await updateDoc(docRef, {
      'study.path.nodes': nodes,
      'study.path.activeNodeId': nextNodeId,
      'study.status': newStatus,
      'study.lastActionAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Node completed, advanced to:', nextNodeId || 'STUDY COMPLETE');

    return {
      nextNodeId,
      isComplete,
      currentProgress: currentIndex + 1,
      totalNodes: nodes.length
    };
  } catch (error) {
    console.error('❌ Error completing node:', error);
    throw error;
  }
};

/**
 * Add a hash to the askedHashes array (anti-repeat)
 * @param {string} chatId - Study session chat ID
 * @param {string} hash - Content hash to add
 */
export const addAskedHash = async (chatId, hash) => {
  try {
    const chatRef = doc(db, 'chats', chatId);

    await updateDoc(chatRef, {
      'study.askedHashes': arrayUnion(hash),
      'study.lastActionAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Added hash to anti-repeat list');
  } catch (error) {
    console.error('❌ Error adding hash:', error);
    throw error;
  }
};

/**
 * Pause the study session
 * @param {string} chatId - Study session chat ID
 */
export const pauseStudySession = async (chatId) => {
  try {
    const chatRef = doc(db, 'chats', chatId);

    await updateDoc(chatRef, {
      'study.status': 'paused',
      'study.lastActionAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Study session paused');
  } catch (error) {
    console.error('❌ Error pausing study session:', error);
    throw error;
  }
};

/**
 * Resume a paused study session
 * @param {string} chatId - Study session chat ID
 */
export const resumeStudySession = async (chatId) => {
  try {
    const chatRef = doc(db, 'chats', chatId);

    await updateDoc(chatRef, {
      'study.status': 'active',
      'study.lastActionAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Study session resumed');
  } catch (error) {
    console.error('❌ Error resuming study session:', error);
    throw error;
  }
};

/**
 * Get study session progress stats
 * @param {string} chatId - Study session chat ID
 * @returns {Promise<Object>} - Progress stats
 */
export const getStudyProgress = async (chatId) => {
  try {
    const session = await getStudySession(chatId);
    if (!session) {
      throw new Error('Study session not found');
    }

    // Use the new structure (session.path.nodes instead of session.study.path.nodes)
    const nodes = session.path?.nodes || [];
    const completedNodes = nodes.filter(n => n.status === 'done').length;
    const activeNode = nodes.find(n => n.status === 'active');
    const currentIndex = nodes.findIndex(n => n.status === 'active');

    return {
      currentStep: currentIndex + 1,
      totalSteps: nodes.length,
      completedSteps: completedNodes,
      progressPercent: nodes.length > 0 ? Math.round((completedNodes / nodes.length) * 100) : 0,
      activeNodeId: activeNode?.id || null,
      activeNodeType: activeNode?.type || null,
      isComplete: session.status === 'completed'
    };
  } catch (error) {
    console.error('❌ Error getting study progress:', error);
    throw error;
  }
};

/**
 * Get saved content for a node by its message ID
 * This prevents regenerating content for nodes the user has already visited.
 *
 * @param {string} chatId - Study session chat ID
 * @param {string} messageId - Message ID stored on the node
 * @returns {Promise<Object|null>} - Saved content or null if not found
 */
export const getNodeContent = async (chatId, messageId) => {
  try {
    if (!messageId) {
      console.log('📭 No messageId provided, content needs to be generated');
      return null;
    }

    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      console.log('📭 Message not found:', messageId);
      return null;
    }

    const messageData = messageSnap.data();
    console.log('📬 Retrieved saved content for message:', messageId);

    // Return the studyContent field (primary content storage)
    // Also include type-specific fields as fallback
    return {
      studyContent: messageData.studyContent,
      quizData: messageData.quizData,
      flashcardData: messageData.flashcardData,
      lessonData: messageData.lessonData,
      audioData: messageData.audioData,
      type: messageData.type,
      nodeId: messageData.nodeId
    };
  } catch (error) {
    console.error('❌ Error retrieving node content:', error);
    return null;
  }
};

/**
 * Save generated content as a message and link it to a node
 * @param {string} chatId - Study session chat ID
 * @param {string} nodeId - Node ID to link the message to
 * @param {Object} content - Generated content
 * @param {string} type - Content type ('lesson', 'quiz', 'flashcard', 'audio')
 * @returns {Promise<string>} - Message ID
 */
export const saveNodeContent = async (chatId, nodeId, content, type) => {
  try {
    const messageId = uuidv4();

    // Create message in the messages subcollection
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messageDoc = doc(messagesRef, messageId);

    const messageData = {
      id: messageId,
      role: 'assistant',
      type: `study_${type}`, // 'study_lesson', 'study_quiz', etc.
      content: content.title || content.question || '',
      timestamp: serverTimestamp(),
      nodeId: nodeId,
      studyContent: content
    };

    // Add type-specific fields
    if (type === 'quiz') {
      messageData.quizData = [content]; // Wrap in array for consistency
    } else if (type === 'flashcard') {
      messageData.flashcardData = [content];
    } else if (type === 'lesson') {
      messageData.lessonData = content;
    } else if (type === 'audio') {
      messageData.audioData = content;
    }

    await setDoc(messageDoc, messageData);

    // Update the node with the message ID
    await updateNodeStatus(chatId, nodeId, { messageId });

    console.log('✅ Node content saved:', messageId);
    return messageId;
  } catch (error) {
    console.error('❌ Error saving node content:', error);
    throw error;
  }
};

export default {
  createStudySession,
  getActiveStudySession,
  getStudySession,
  updateStudyPath,
  updateNodeStatus,
  completeNodeAndAdvance,
  addAskedHash,
  pauseStudySession,
  resumeStudySession,
  getStudyProgress,
  getNodeContent,
  saveNodeContent
};
