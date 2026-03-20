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
import { devLog } from './devLogger';

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
      ? topics.slice(0, 2).join(', ')
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
    devLog('✅ Study session created for chat:', chatId);

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
      askedHashes: data.study?.askedHashes || [],
      currentPhase: data.study?.currentPhase || 1,
      totalPhases: data.study?.totalPhases || 1
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
    devLog('✅ Study path updated');
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

    devLog('✅ Node status updated:', nodeId, nodeUpdates);
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

    // Find next non-banner node (skip section_banner pseudo-nodes)
    let nextIndex = currentIndex + 1;
    while (nextIndex < nodes.length && nodes[nextIndex].type === 'section_banner') {
      nextIndex++;
    }
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

    devLog('✅ Node completed, advanced to:', nextNodeId || 'STUDY COMPLETE');

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

    devLog('✅ Added hash to anti-repeat list');
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

    devLog('✅ Study session paused');
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

    devLog('✅ Study session resumed');
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
      devLog('📭 No messageId provided, content needs to be generated');
      return null;
    }

    devLog('🔍 Fetching content for messageId:', messageId, 'in chat:', chatId);
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      devLog('📭 Message not found:', messageId);
      return null;
    }

    const messageData = messageSnap.data();
    devLog('📬 Retrieved saved content for message:', messageId);
    devLog('📊 flashcardProgress in Firestore:', messageData.flashcardProgress);
    devLog('📊 quizProgress in Firestore:', messageData.quizProgress);

    // Return the studyContent field (primary content storage)
    // Also include type-specific fields and progress data
    return {
      studyContent: messageData.studyContent,
      quizData: messageData.quizData,
      flashcardData: messageData.flashcardData,
      lessonData: messageData.lessonData,
      audioData: messageData.audioData,
      mindmapData: messageData.mindmapData || null,
      type: messageData.type,
      nodeId: messageData.nodeId,
      // Include progress data for resuming mid-session
      flashcardProgress: messageData.flashcardProgress || null,
      quizProgress: messageData.quizProgress || null
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

    devLog('✅ Node content saved:', messageId);
    return messageId;
  } catch (error) {
    console.error('❌ Error saving node content:', error);
    throw error;
  }
};

/**
 * Persist generated mindmap data back to the existing message document.
 * Called after the mindmap card auto-generates the visual map, so that
 * re-visiting the node loads the cached map instead of regenerating.
 *
 * @param {string} chatId - Study session chat ID
 * @param {string} messageId - Message ID of the mindmap stub content
 * @param {Object} mindmapData - Generated mindmap { nodes, edges, central_topic, ... }
 */
export const updateMindmapData = async (chatId, messageId, mindmapData) => {
  try {
    if (!messageId) {
      devLog('⚠️ No messageId, cannot save mindmap data');
      return;
    }

    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);

    await updateDoc(messageRef, {
      mindmapData: mindmapData,
      'studyContent.mindmapData': mindmapData
    });

    devLog('✅ Mindmap data saved to message:', messageId);
  } catch (error) {
    console.error('❌ Error saving mindmap data:', error);
    // Non-critical — don't throw
  }
};

/**
 * Save flashcard progress (which cards are mastered/review)
 * This allows resuming mid-session without losing progress.
 *
 * @param {string} chatId - Study session chat ID
 * @param {string} messageId - Message ID of the flashcard content
 * @param {Object} progress - Progress state { cardStatuses, queueIndex, isReviewRound }
 */
export const saveFlashcardProgress = async (chatId, messageId, progress) => {
  try {
    if (!messageId) {
      devLog('⚠️ No messageId, cannot save flashcard progress');
      return;
    }

    devLog('💾 Saving flashcard progress to messageId:', messageId);
    devLog('💾 Progress data:', JSON.stringify(progress, null, 2));

    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);

    await updateDoc(messageRef, {
      flashcardProgress: {
        cardStatuses: progress.cardStatuses || {},
        queueIndex: progress.queueIndex || 0,
        isReviewRound: progress.isReviewRound || false,
        lastUpdated: serverTimestamp()
      }
    });

    devLog('✅ Flashcard progress saved successfully');
  } catch (error) {
    console.error('❌ Error saving flashcard progress:', error);
    // Don't throw - this is non-critical
  }
};

/**
 * Save quiz progress (which questions answered, scores)
 * This allows resuming mid-session without losing progress.
 *
 * @param {string} chatId - Study session chat ID
 * @param {string} messageId - Message ID of the quiz content
 * @param {Object} progress - Progress state { currentIndex, answeredQuestions, scores }
 */
export const saveQuizProgress = async (chatId, messageId, progress) => {
  try {
    if (!messageId) {
      devLog('⚠️ No messageId, cannot save quiz progress');
      return;
    }

    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);

    await updateDoc(messageRef, {
      quizProgress: {
        currentIndex: progress.currentIndex || 0,
        answeredQuestions: progress.answeredQuestions || [],
        scores: progress.scores || { correct: 0, incorrect: 0 },
        lastUpdated: serverTimestamp()
      }
    });

    devLog('✅ Quiz progress saved');
  } catch (error) {
    console.error('❌ Error saving quiz progress:', error);
    // Don't throw - this is non-critical
  }
};

/**
 * Update study performance record incrementally.
 * Called on every first-attempt quiz answer and flashcard review.
 * Builds a per-topic strength/weakness profile for future plan tailoring.
 *
 * Firestore path: users/{uid}/studyPerformance/{chatId}
 *
 * @param {string} chatId - Study session chat ID
 * @param {Object} result - Performance result
 * @param {string} result.topic - Topic name from the question/card
 * @param {'quiz'|'flashcard'} result.type - Type of interaction
 * @param {boolean} [result.correct] - For quiz: was the answer correct
 * @param {boolean} [result.mastered] - For flashcard: was it mastered on first try
 * @param {string} [result.concept] - The question text or card front (what they missed)
 */
/**
 * Find the best matching existing topic key, or return the input as-is.
 * Prevents near-duplicate entries like "Testostérone" vs "Sleep and Testosterone".
 */
const findMatchingTopicKey = (newTopic, existingKeys) => {
  if (!newTopic || existingKeys.length === 0) return newTopic;

  // Exact match (case-insensitive)
  const exact = existingKeys.find(k => k.toLowerCase() === newTopic.toLowerCase());
  if (exact) return exact;

  // Strip accents for comparison
  const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const strippedNew = strip(newTopic);

  // Check if one contains the other (after accent stripping)
  for (const existing of existingKeys) {
    const strippedExisting = strip(existing);
    if (strippedExisting.includes(strippedNew) || strippedNew.includes(strippedExisting)) {
      return existing;
    }
  }

  // Check significant word overlap (words > 2 chars)
  const words = (s) => new Set(strip(s).split(/\s+/).filter(w => w.length > 2));
  const newWords = words(newTopic);
  if (newWords.size === 0) return newTopic;

  for (const existing of existingKeys) {
    const existingWords = words(existing);
    const overlap = [...newWords].filter(w => existingWords.has(w)).length;
    const threshold = Math.min(newWords.size, existingWords.size) * 0.5;
    if (overlap > 0 && overlap >= threshold) {
      return existing;
    }
  }

  return newTopic;
};

export const updateStudyPerformance = async (chatId, result) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId || !result.topic) return;

    const ref = doc(db, 'users', userId, 'studyPerformance', chatId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : { topics: {}, updatedAt: null };

    // Normalize topic key: merge into existing entry if similar enough
    const topicKey = findMatchingTopicKey(result.topic, Object.keys(data.topics));
    const topic = data.topics[topicKey] || {
      questionsCorrect: 0,
      questionsTotal: 0,
      flashcardsMastered: 0,
      flashcardsTotal: 0,
      missedConcepts: []
    };

    if (result.type === 'quiz') {
      topic.questionsTotal++;
      if (result.correct) {
        topic.questionsCorrect++;
      } else if (result.concept) {
        // Only keep last 20 missed concepts to avoid unbounded growth
        topic.missedConcepts = [...(topic.missedConcepts || []), result.concept].slice(-20);
      }
    }

    if (result.type === 'flashcard') {
      topic.flashcardsTotal++;
      if (result.mastered) {
        topic.flashcardsMastered++;
      } else if (result.concept) {
        topic.missedConcepts = [...(topic.missedConcepts || []), result.concept].slice(-20);
      }
    }

    // Compute strength level
    const quizAcc = topic.questionsTotal > 0 ? topic.questionsCorrect / topic.questionsTotal : null;
    const flashAcc = topic.flashcardsTotal > 0 ? topic.flashcardsMastered / topic.flashcardsTotal : null;
    const scores = [quizAcc, flashAcc].filter(s => s !== null);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    if (avg !== null) {
      topic.strengthLevel = avg >= 0.85 ? 'strong' : avg >= 0.6 ? 'developing' : 'weak';
    }

    data.topics[topicKey] = topic;
    data.updatedAt = serverTimestamp();
    data.chatId = chatId;

    await setDoc(ref, data, { merge: true });
    devLog('📊 Performance updated:', topicKey, topic.strengthLevel || 'n/a');

    return topic.strengthLevel || null;
  } catch (error) {
    console.error('❌ Error updating study performance:', error);
    // Non-critical — don't throw
    return null;
  }
};

/**
 * Get the study performance record for a session
 * @param {string} chatId - Study session chat ID
 * @returns {Promise<Object|null>} - Performance data or null
 */
export const getStudyPerformance = async (chatId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;

    const ref = doc(db, 'users', userId, 'studyPerformance', chatId);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();

    // Fallback for dev/viewAllChats mode: look up the chat owner's performance
    const chatSnap = await getDoc(doc(db, 'chats', chatId));
    const chatOwnerUserId = chatSnap.exists() ? chatSnap.data()?.userId : null;
    if (!chatOwnerUserId || chatOwnerUserId === userId) return null;

    const ownerRef = doc(db, 'users', chatOwnerUserId, 'studyPerformance', chatId);
    const ownerSnap = await getDoc(ownerRef);
    return ownerSnap.exists() ? ownerSnap.data() : null;
  } catch (error) {
    console.error('❌ Error fetching study performance:', error);
    return null;
  }
};

/**
 * Append Phase 2 review nodes to an existing study session.
 * Creates a section_banner pseudo-node between phases.
 *
 * @param {string} chatId - Study session chat ID
 * @param {Object} reviewPathResult - Result from /study/plan-review
 * @returns {Promise<Object>} - Updated study state
 */
export const appendPhase2 = async (chatId, reviewPathResult) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const docRef = doc(db, 'chats', chatId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Study session not found');
    }

    const data = docSnap.data();
    const existingNodes = data.study?.path?.nodes || [];

    // Create section banner pseudo-node
    const bannerLabel = reviewPathResult.topics?.length > 0
      ? reviewPathResult.topics.slice(0, 2).join(', ')
      : 'Based on Your Insights';

    const bannerNode = {
      id: 'section_banner_2',
      type: 'section_banner',
      label: bannerLabel,
      phase: 2,
      status: 'banner'
    };

    // Prepare phase 2 nodes with phase field
    const phase2Nodes = reviewPathResult.nodes.map((node, index) => ({
      id: node.id || `review-${uuidv4().slice(0, 8)}`,
      type: node.type,
      label: node.label,
      tags: [...(node.tags || []), 'review'],
      difficulty: node.difficulty || 1,
      phase: 2,
      status: index === 0 ? 'active' : 'locked',
      messageId: null
    }));

    // Tag existing nodes as phase 1 (backward compat)
    const taggedExistingNodes = existingNodes.map(n => ({
      ...n,
      phase: n.phase || 1
    }));

    // Combine: existing + banner + phase 2
    const allNodes = [...taggedExistingNodes, bannerNode, ...phase2Nodes];
    const newActiveNodeId = phase2Nodes[0]?.id || null;

    // Update Firestore
    await updateDoc(docRef, {
      'study.status': 'active',
      'study.currentPhase': 2,
      'study.totalPhases': 2,
      'study.path.nodes': allNodes,
      'study.path.activeNodeId': newActiveNodeId,
      'study.path.totalNodes': allNodes.filter(n => n.type !== 'section_banner').length,
      'study.lastActionAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    devLog('✅ Phase 2 appended with', phase2Nodes.length, 'review nodes');

    return {
      chatId,
      status: 'active',
      currentPhase: 2,
      totalPhases: 2,
      path: {
        topics: data.study?.path?.topics || [],
        nodes: allNodes,
        activeNodeId: newActiveNodeId,
        totalNodes: allNodes.filter(n => n.type !== 'section_banner').length
      },
      askedHashes: data.study?.askedHashes || []
    };
  } catch (error) {
    console.error('❌ Error appending Phase 2:', error);
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
  saveNodeContent,
  updateMindmapData,
  saveFlashcardProgress,
  saveQuizProgress,
  updateStudyPerformance,
  getStudyPerformance,
  appendPhase2
};
