/**
 * StudySessionService.js
 * Firestore operations for Study Session state management
 *
 * Study Sessions are special chat documents with isStudySession: true
 * They use the existing chats/{chatId} structure with additional study fields
 */

import { db, auth, storage } from '../Firebase/config';
import { applyConceptOutcome } from './conceptLedger';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
import { buildFirstBlock, extendWithReserve, isRealNode } from '../Components/StudyMode/firstBlock';
import { estimateMinutes } from '../Components/StudyMode/planFormatting';

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

    // Only the first block goes live; the rest waits on the shelf. A plan the
    // student can finish is the whole point — see firstBlock.js for the funnel
    // this comes from. The planner's full path is preserved, not discarded.
    const { block, reserve, blockCount, reserveCount, plannedTotal, estimatedMinutes } =
      buildFirstBlock(pathResult);

    // Banners are headers, so they carry 'banner' rather than a work status —
    // matching appendPhase2. Marking position 0 active blindly would hand the
    // active slot to a leading section header and leave no node open.
    const withIds = (node, isActive = false) => ({
      id: node.id || `node-${uuidv4().slice(0, 8)}`,
      type: node.type,
      label: node.label,
      tags: node.tags || [],
      difficulty: node.difficulty || 1,
      status: !isRealNode(node) ? 'banner' : (isActive ? 'active' : 'locked'),
      messageId: null // Will be set when content is generated
    });

    const firstRealIndex = block.findIndex(isRealNode);
    const nodesWithIds = block.map((node, index) => withIds(node, index === firstRealIndex));
    // Reserve nodes are shaped identically so extending is a straight append —
    // no second pass of id generation, no divergent node shape to reason about.
    // None start active: the student is still working the live block.
    const reserveWithIds = reserve.map((node) => withIds(node, false));

    devLog(
      `📦 First block: ${blockCount} of ${plannedTotal} planned nodes live, ` +
      `${reserveCount} held in reserve`
    );

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
          // Counts describe the LIVE block, so "done" is reachable and every
          // progress readout in the app is measured against something finishable.
          totalNodes: blockCount || nodesWithIds.filter(isRealNode).length,
          estimatedMinutes: estimatedMinutes || nodesWithIds.length * 3,
          activeNodeId: nodesWithIds.find(isRealNode)?.id || null,
          nodes: nodesWithIds
        },
        // What the planner produced beyond this block. Extending is a local
        // move: no regeneration, no plan-quota charge, nothing to re-fetch.
        reserve: {
          nodes: reserveWithIds,
          remaining: reserveCount,
          plannedTotal: plannedTotal
        },
        askedHashes: [], // Anti-repeat tracking
        lastActionAt: serverTimestamp(),
        // Day 1 of the dated plan. ISO string rather than serverTimestamp()
        // so buildStudySchedule can read it on this very render instead of
        // waiting for the write to round-trip. Plans created before this
        // field existed fall back to their earliest node completion.
        startedAt: new Date().toISOString()
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
      askedHashes: [],
      startedAt: studyData.study.startedAt
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
      // Nodes the planner produced beyond the live block. Sessions created
      // before the block cap simply have none.
      reserve: data.study?.reserve || { nodes: [], remaining: 0 },
      askedHashes: data.study?.askedHashes || [],
      currentPhase: data.study?.currentPhase || 1,
      totalPhases: data.study?.totalPhases || 1,
      startedAt: data.study?.startedAt || null // Day 1 anchor for the dated plan
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
      ...nodeUpdates,
      // Stamp the first transition to 'done' so the dated plan can tell
      // "finished today" from "finished last Tuesday". See stampCompletedAt.
      ...(nodeUpdates.status === 'done' && !nodes[nodeIndex].completedAt
        ? { completedAt: new Date().toISOString() }
        : {})
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

    // Mark current node as done.
    //
    // `completedAt` is an ISO STRING, not serverTimestamp() — Firestore
    // rejects sentinel values inside array elements, and the dated plan reads
    // it back client-side the moment it's written. Stamped only once, so a
    // replayed completion can't drag an old node into today's mission.
    nodes[currentIndex] = {
      ...nodes[currentIndex],
      status: 'done',
      completedAt: nodes[currentIndex].completedAt || new Date().toISOString()
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
 * Insert a dynamically-generated node into the path right after the current node,
 * mark the current node as done, and activate the inserted node.
 *
 * This is the core path-mutation operation for the adaptive transition feature.
 * The inserted node becomes the new active node; the originally-planned next node
 * stays in place (destination is fixed, only the path adapts).
 *
 * @param {string} chatId - Study session chat ID
 * @param {string} currentNodeId - The node the student just completed
 * @param {Object} newNodeDef - Node definition { type, label, tags, difficulty, adaptive }
 * @returns {Promise<Object>} - { insertedNode, updatedNodes }
 */
export const insertNodeAfterCurrent = async (chatId, currentNodeId, newNodeDef) => {
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

    // Mark current node as done.
    //
    // `completedAt` is an ISO STRING, not serverTimestamp() — Firestore
    // rejects sentinel values inside array elements, and the dated plan reads
    // it back client-side the moment it's written. Stamped only once, so a
    // replayed completion can't drag an old node into today's mission.
    nodes[currentIndex] = {
      ...nodes[currentIndex],
      status: 'done',
      completedAt: nodes[currentIndex].completedAt || new Date().toISOString()
    };

    // Build the new node with a unique ID and active status
    const insertedNode = {
      id: `adaptive-${uuidv4().slice(0, 8)}`,
      type: newNodeDef.type,
      label: newNodeDef.label,
      tags: newNodeDef.tags || [],
      difficulty: newNodeDef.difficulty || 1,
      adaptive: true,
      reason: newNodeDef.reason || '',
      status: 'active',
      messageId: null,
      // Carry phase from current node so it appears in the right section
      phase: nodes[currentIndex].phase || 1,
      // Node-specified length, omitted unless the caller asked for one. The
      // fields here are an explicit whitelist, so anything not listed is
      // silently dropped — which is how the single-question pattern
      // experiment quietly became a full-length quiz.
      ...(newNodeDef.num_questions ? { num_questions: newNodeDef.num_questions } : {}),
      // Pre-decided mini-test settings. Set by the post-node recommendation,
      // whose whole claim is that NurseQuiz already chose the format — a node
      // that arrives without this stops at the config modal and asks her to
      // choose it herself, which contradicts the copy that got her here.
      ...(newNodeDef.examConfig ? { examConfig: newNodeDef.examConfig } : {})
    };

    // Splice the new node right after the current one
    nodes.splice(currentIndex + 1, 0, insertedNode);

    // Update Firestore
    await updateDoc(docRef, {
      'study.path.nodes': nodes,
      'study.path.activeNodeId': insertedNode.id,
      'study.path.totalNodes': nodes.filter(n => n.type !== 'section_banner').length,
      'study.lastActionAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    devLog('✅ Adaptive node inserted after', currentNodeId, '→', insertedNode.id);

    return {
      insertedNode,
      updatedNodes: nodes
    };
  } catch (error) {
    console.error('❌ Error inserting adaptive node:', error);
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
      quizProgress: messageData.quizProgress || null,
      mindmapProgress: messageData.mindmapProgress || null
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
 * Upload generated audio to Firebase Storage and persist the URL to Firestore.
 * Called after the audio card auto-generates the audio, so that re-visiting
 * the node loads from Storage instead of regenerating.
 *
 * @param {string} chatId - Study session chat ID
 * @param {string} messageId - Message ID of the audio stub content
 * @param {string} audioBase64 - Base64 encoded audio (MP3)
 * @param {number} audioDuration - Duration in seconds
 * @returns {Promise<string|null>} - Firebase Storage download URL, or null on failure
 */
export const updateAudioData = async (chatId, messageId, audioBase64, audioDuration) => {
  try {
    if (!messageId || !audioBase64) {
      devLog('⚠️ Missing messageId or audioBase64, cannot save audio');
      return null;
    }

    // Convert base64 → bytes and upload to Firebase Storage
    const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    const storageRef = ref(storage, `chats/${chatId}/study_audio/${messageId}.mp3`);
    await uploadBytes(storageRef, audioBytes, { contentType: 'audio/mpeg' });
    const firebaseUrl = await getDownloadURL(storageRef);

    // Persist just the URL (not the large base64) to Firestore
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
      'studyContent.firebaseUrl': firebaseUrl,
      'studyContent.audioDuration': audioDuration,
      audioFirebaseUrl: firebaseUrl
    });

    devLog('✅ Audio uploaded and URL saved:', firebaseUrl);
    return firebaseUrl;
  } catch (error) {
    console.error('❌ Error saving audio data:', error);
    return null; // Non-critical — don't throw
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

    const progressData = {
      currentIndex: progress.currentIndex || 0,
      answeredQuestions: progress.answeredQuestions || [],
      scores: progress.scores || { correct: 0, incorrect: 0 },
      lastUpdated: serverTimestamp()
    };

    // Persist new fields if present (questionStatuses, firstAttemptStatuses, isReviewRound)
    if (progress.questionStatuses) progressData.questionStatuses = progress.questionStatuses;
    if (progress.firstAttemptStatuses) progressData.firstAttemptStatuses = progress.firstAttemptStatuses;
    if (progress.isReviewRound !== undefined) progressData.isReviewRound = progress.isReviewRound;
    if (progress.queueIndex !== undefined) progressData.queueIndex = progress.queueIndex;

    await updateDoc(messageRef, { quizProgress: progressData });

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
 * @param {string} [result.conceptKey] - Short concept label from the generator
 *        ("preload vs afterload"). Feeds the concept ledger. Pass it on EVERY
 *        answer, correct or not — see the ledger block below. Absent on older
 *        content, in which case that answer simply is not tracked.
 * @param {'mcq'|'sata'|'casestudy'} [result.format] - Question format, for the
 *        format breakdown. Stored at the DOC root (not per topic): a chat is
 *        one uploaded subject, so doc-level buckets already give subject ×
 *        format, and keeping it off the topic map avoids multiplying the
 *        number of counters by the number of node labels.
 */
/**
 * Find the best matching existing topic key, or return the input as-is.
 * Prevents near-duplicate entries like "Testostérone" vs "Sleep and Testosterone".
 */
export const findMatchingTopicKey = (newTopic, existingKeys) => {
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

/**
 * How many completed nodes we keep. Enough to see a trend across a plan
 * without letting one document grow unbounded.
 */
export const HISTORY_CAP = 40;

/**
 * Append one completed node to the session's history.
 *
 * WHY A TIMELINE AND NOT JUST THE RUNNING TOTALS
 * ──────────────────────────────────────────────
 * `topics` already holds cumulative correct/total, which can answer "how is
 * she doing on Cardiac". It cannot answer "is she getting BETTER at Cardiac",
 * because averages absorb the change: a student who went 2/5 then 5/5 and one
 * who went 4/5 twice both read as 70%, and only one of them has a story worth
 * telling her.
 *
 * The `conclusion` is stored alongside the score on purpose. It is what we
 * TOLD her last time, which lets later feedback refer back to it instead of
 * delivering the same observation twice as if it were new.
 *
 * Only scored nodes are recorded. A lesson has no result to trend.
 *
 * Timestamps are ISO strings, never serverTimestamp() — Firestore rejects
 * sentinel values inside array elements, and this is an array.
 */
export const appendStudyHistory = async (chatId, entry) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId || !chatId || !entry?.topic) return;

    const ref = doc(db, 'users', userId, 'studyPerformance', chatId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const history = Array.isArray(data.history) ? data.history : [];

    // Same node twice (a re-render, a back-and-forward) must not double-count
    // a result and invent a trend that never happened.
    const stamp = entry.at || new Date().toISOString();
    if (entry.nodeId && history.some((h) => h.nodeId === entry.nodeId)) {
      devLog('📜 History entry already recorded for node', entry.nodeId);
      return;
    }

    const row = {
      at: stamp,
      nodeId: entry.nodeId || null,
      type: entry.type || 'quiz',
      topic: entry.topic,
      correct: Number(entry.correct) || 0,
      total: Number(entry.total) || 0,
      pct: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0,
      missed: (entry.missed || []).filter(Boolean).slice(0, 5),
      conclusion: entry.conclusion || null,
    };

    await setDoc(
      ref,
      {
        history: [...history, row].slice(-HISTORY_CAP),
        chatId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    devLog('📜 History recorded:', row.topic, `${row.correct}/${row.total}`);
  } catch (error) {
    // Non-critical: losing a history row costs a nicer sentence later, never
    // the session itself.
    console.error('❌ Error appending study history:', error);
  }
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

    // Format bucket — only quizzes carry a format; flashcards have none.
    // Written even when the answer is right, because a breakdown needs the
    // denominator, not just the misses.
    if (result.type === 'quiz' && result.format) {
      const formats = data.formats || {};
      const bucket = formats[result.format] || { correct: 0, total: 0 };
      bucket.total++;
      if (result.correct) bucket.correct++;
      formats[result.format] = bucket;
      data.formats = formats;
    }

    /* ── Concept ledger ──────────────────────────────────────────────
       Separate from `missedConcepts` on purpose, and NOT a replacement for
       it. `missedConcepts` stores raw question TEXT because
       buildQuestionIndex joins on exactly that to recover each question's
       format; repointing it at concept labels would break that join
       silently and blank the format breakdown.

       This ledger keys on the short concept label instead, so a variant
       question on the same misconception lands on the same entry — which is
       what makes "you were confusing X, and now you aren't" computable.

       Written on EVERY answer, right or wrong. A ledger fed only failures
       can say what she got wrong but never that she fixed it, which is the
       whole reason this exists. */
    if (result.conceptKey) {
      data.concepts = applyConceptOutcome(data.concepts, {
        label: result.conceptKey,
        correct: result.type === 'flashcard' ? !!result.mastered : !!result.correct,
      });
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

/* ══════════════════════════════════════════════════════════════════════
   PERFORMANCE BREAKDOWN — accuracy ranked by subject and by question format.

   Reads every studyPerformance doc for the user and folds them two ways:
   by subject (one doc = one uploaded subject) and by question format
   (mcq / sata / casestudy, summed across subjects).

   Format is the one that earns its place. Measured on the first paying
   study-mode user: 89% on multiple choice, 21% on select-all-that-apply,
   40% on priority ordering — a 7x spread that neither she nor the product
   could see, because accuracy was only ever tracked per topic. A student
   who is "at 69%" is not weak on the material, she is weak on two formats,
   and those are the two the NCLEX leans on hardest.

   MIN_SAMPLE guards the headline: three questions is not a pattern, and
   "0% on select-all-that-apply" off a single item is a lie that reads as
   authoritative.
   ══════════════════════════════════════════════════════════════════════ */

/** Below this many answered questions a bucket is shown but never ranked. */
export const BREAKDOWN_MIN_SAMPLE = 5;

/** Display order / labels live in the UI; this is just the known set. */
const KNOWN_FORMATS = ['mcq', 'sata', 'casestudy'];

/**
 * Accuracy by topic and by question format for ONE study session.
 *
 * Scoped to a single chat on purpose: the breakdown is read next to the plan
 * it describes, where "you are weak on select-all-that-apply" is actionable
 * against the nodes still in front of you. A cross-session rollup answers a
 * question nobody asks mid-plan.
 *
 * Both lists are sorted WEAKEST FIRST — the point of the panel is what to
 * fix, so the thing needing work is never below the fold. Rows under
 * MIN_SAMPLE sort last regardless of accuracy, so a 1-of-1 miss can't
 * masquerade as the top priority.
 *
 * @param {string} chatId - the study session to summarize
 * @param {string} [userId] - defaults to the signed-in user
 * @returns {Promise<{
 *   formats: Array,        // per question type, weakest first
 *   topics: Array,         // per topic, weakest first
 *   missed: Array,         // every missed question, tagged with format + topic
 *   totalAnswered: number,
 *   derived: boolean       // true when format counts came from the fallback
 * }>}
 */
export const getSessionInsights = async (chatId, userId) => {
  const empty = { formats: [], missedMix: [], topics: [], missed: [], totalAnswered: 0, derived: false };
  try {
    const uid = userId || auth.currentUser?.uid;
    if (!uid || !chatId) return empty;

    // Reuse getStudyPerformance rather than reading the doc directly: it
    // carries the dev/viewAllChats fallback to the CHAT OWNER's record.
    // Reading users/{me}/studyPerformance/{chatId} straight left the panel
    // empty on any chat opened in view-all mode while the modal's own chips —
    // which do use this helper — showed data, so the same modal disagreed
    // with itself.
    const [data, index] = await Promise.all([
      getStudyPerformance(chatId),
      buildQuestionIndex(chatId),
    ]);
    if (!data) return empty;

    /* ── Topics ──────────────────────────────────────────────────────────
       Keyed on the topic name with the node-kind suffix stripped, so
       "X - Mini-Test" and "X - Drill" become one row instead of reading as
       two different subjects. */
    const topicTotals = {};
    let totalAnswered = 0;
    Object.entries(data.topics || {}).forEach(([key, tp]) => {
      const total = tp.questionsTotal || 0;
      if (!total) return;
      const name = baseTopicName(key);
      const acc = topicTotals[name] || { correct: 0, total: 0 };
      acc.correct += tp.questionsCorrect || 0;
      acc.total += total;
      topicTotals[name] = acc;
      totalAnswered += total;
    });

    /* ── Missed questions, tagged with the format they came from ─────────
       The doc stores only question TEXT, so the format comes from joining
       against the session's generated questions. Deduped: a question can be
       appended more than once across review rounds. */
    const seenText = new Set();
    const missed = [];
    Object.entries(data.topics || {}).forEach(([key, tp]) => {
      (tp.missedConcepts || []).forEach((text) => {
        const clean = String(text || '').trim();
        if (!clean || seenText.has(clean)) return;
        seenText.add(clean);
        missed.push({
          text: clean,
          topic: baseTopicName(key),
          format: index.get(clean)?.format || null,
        });
      });
    });

    /* ── Formats ─────────────────────────────────────────────────────────
       Only reported as ACCURACY when the per-answer counter exists, because
       only then is the denominator real.

       The fallback for older sessions used to derive one from the questions
       in the plan. Both attempts failed: counting every generated question
       inflated the denominator (88% multiple choice sitting next to a 75%
       topic row built from the same answers), and restricting it to completed
       nodes produced "missed 7 of 6" — misses accumulate from nodes that were
       answered but never marked done. There is no honest denominator to
       recover after the fact.

       So pre-counter sessions get `missedMix` instead: the COMPOSITION of
       their mistakes by format. "7 of your 13 mistakes were select-all-that-
       apply" is exact, needs no denominator, and still points at the thing
       worth fixing. */
    const stored = data.formats && Object.keys(data.formats).length > 0;
    const missedByFormat = {};
    missed.forEach((m) => {
      if (m.format) missedByFormat[m.format] = (missedByFormat[m.format] || 0) + 1;
    });
    const totalTagged = Object.values(missedByFormat).reduce((a, b) => a + b, 0);

    const formats = !stored ? [] : KNOWN_FORMATS.map((key) => {
      const seen = data.formats[key]?.total || 0;
      if (!seen) return null;
      const miss = Math.max(0, seen - (data.formats[key]?.correct || 0));
      return {
        key,
        seen,
        missed: miss,
        accuracy: Math.round(((seen - miss) / seen) * 100),
        ranked: seen >= BREAKDOWN_MIN_SAMPLE,
      };
    }).filter(Boolean);

    const missedMix = stored || !totalTagged ? [] : KNOWN_FORMATS
      .filter((key) => missedByFormat[key])
      .map((key) => ({
        key,
        count: missedByFormat[key],
        share: Math.round((missedByFormat[key] / totalTagged) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    /* Strictly weakest first — including thin rows.
       Sorting low-sample rows to the BOTTOM was worse than the problem it
       solved: a "0%, missed 4 of 4" landing underneath a 95% reads as the
       student's strongest area. Honesty about sample size is the row's own
       "too few to be sure" label, not its position. The risk headline still
       filters on `ranked`, so a 1-of-1 miss can never become the callout. */
    const weakestFirst = (a, b) => a.accuracy - b.accuracy;

    const topics = Object.entries(topicTotals)
      .map(([name, b]) => ({
        key: name,
        label: name,
        correct: b.correct,
        total: b.total,
        accuracy: Math.round((b.correct / b.total) * 100),
        ranked: b.total >= BREAKDOWN_MIN_SAMPLE,
      }))
      .sort(weakestFirst);

    return {
      formats: formats.sort(weakestFirst),
      missedMix,
      topics,
      missed,
      totalAnswered,
      derived: !stored,
    };
  } catch (error) {
    console.error('❌ Error building session insights:', error);
    return empty;
  }
};

/**
 * Build a question-text → { format, topic } index from a session's messages.
 *
 * Needed for two things the studyPerformance doc can't do alone:
 *   1. Tagging each stored `missedConcepts` string with the format it came
 *      from — the doc stores only the question text.
 *   2. Deriving format counts for sessions answered BEFORE the `formats`
 *      counter existed, so the panel is useful on existing data instead of
 *      staying blank until a migration runs.
 *
 * Keyed on normalized question text, which is exactly what missedConcepts
 * stores, so the join is exact rather than fuzzy.
 */
const buildQuestionIndex = async (chatId) => {
  const index = new Map();
  try {
    const msgs = await getDocs(collection(db, 'chats', chatId, 'messages'));
    msgs.forEach((m) => {
      const questions = m.data()?.studyContent?.questions;
      if (!Array.isArray(questions)) return;
      questions.forEach((q) => {
        const text = String(q?.question || '').trim();
        if (!text) return;
        index.set(text, {
          format: q?.questionType || q?.metadata?.questionType || 'mcq',
          topic: q?.topic || null,
        });
      });
    });
  } catch (error) {
    console.error('❌ Error indexing session questions:', error);
  }
  return index;
};

/**
 * Strip the node-kind suffix off a topic key.
 *
 * Keys are built as "<topic> - <node kind>" — "Smoking Cessation - Quick
 * Check", "… - Mini-Test", "… - Drill" — so the same topic lands under two
 * or three keys and looks like separate subjects. Taking the segment before
 * the first " - " merges them.
 *
 * A topic containing " - " itself would be truncated; accepted, because the
 * labels are model-generated topic names where that is rare, and the failure
 * mode is a shorter label rather than a wrong number.
 */
const baseTopicName = (key) => {
  const s = String(key || '').trim();
  const cut = s.split(' - ')[0].trim();
  return cut || s;
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

/**
 * Move the next block of the planner's path onto the live plan.
 *
 * Called when a student finishes their block and asks for more. The nodes were
 * planned in the original call and parked in `study.reserve`, so this is a
 * local move: no generation, no plan-quota charge, no round trip to the model.
 *
 * @param {string} chatId - Study session chat ID
 * @returns {Promise<{added: number, remaining: number, activeNodeId: string|null}>}
 */
export const extendStudyPath = async (chatId) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const docRef = doc(db, 'chats', chatId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Study session not found');

    const data = docSnap.data();
    const existingNodes = data.study?.path?.nodes || [];
    const reserveNodes = data.study?.reserve?.nodes || [];

    if (reserveNodes.length === 0) {
      devLog('📦 Nothing left in reserve — plan is fully extended');
      return { added: 0, remaining: 0, activeNodeId: data.study?.path?.activeNodeId || null };
    }

    const { nodes: merged, reserve: rest, addedCount, reserveCount } =
      extendWithReserve(existingNodes, reserveNodes);

    // The block that just ended left nothing active — open the first new node.
    const firstAdded = merged.slice(existingNodes.length).find(isRealNode) || null;
    const activeNodeId = firstAdded ? firstAdded.id : data.study?.path?.activeNodeId || null;
    const nodesWithActive = merged.map(n =>
      firstAdded && n.id === firstAdded.id ? { ...n, status: 'active' } : n
    );

    const liveCount = nodesWithActive.filter(isRealNode).length;

    await updateDoc(docRef, {
      'study.status': 'active',
      'study.path.nodes': nodesWithActive,
      'study.path.activeNodeId': activeNodeId,
      'study.path.totalNodes': liveCount,
      'study.path.estimatedMinutes': estimateMinutes(nodesWithActive.filter(isRealNode)),
      'study.reserve.nodes': rest,
      'study.reserve.remaining': reserveCount,
      'study.lastActionAt': serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    devLog(`✅ Extended plan by ${addedCount} nodes — ${reserveCount} still in reserve`);

    return { added: addedCount, remaining: reserveCount, activeNodeId };
  } catch (error) {
    console.error('❌ Error extending study path:', error);
    throw error;
  }
};

/**
 * Save mindmap traversal progress (which node the user is on, which are visited)
 * @param {string} chatId - Study session chat ID
 * @param {string} messageId - Message ID of the mindmap content
 * @param {Object} progress - { currentNodeIndex, visitedNodeIds }
 */
export const saveMindmapProgress = async (chatId, messageId, progress) => {
  try {
    if (!messageId) {
      devLog('⚠️ No messageId, cannot save mindmap progress');
      return;
    }

    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);

    await updateDoc(messageRef, {
      mindmapProgress: {
        currentNodeIndex: progress.currentNodeIndex || 0,
        visitedNodeIds: progress.visitedNodeIds || [],
        lastUpdated: serverTimestamp()
      }
    });

    devLog('✅ Mindmap progress saved');
  } catch (error) {
    console.error('❌ Error saving mindmap progress:', error);
    // Non-critical — don't throw
  }
};

export default {
  createStudySession,
  getActiveStudySession,
  getStudySession,
  updateStudyPath,
  updateNodeStatus,
  completeNodeAndAdvance,
  insertNodeAfterCurrent,
  addAskedHash,
  pauseStudySession,
  resumeStudySession,
  getStudyProgress,
  getNodeContent,
  saveNodeContent,
  updateMindmapData,
  updateAudioData,
  saveFlashcardProgress,
  saveQuizProgress,
  updateStudyPerformance,
  getStudyPerformance,
  appendPhase2,
  saveMindmapProgress
};
