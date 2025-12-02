// WebSocketManager.js - Replace FastAPICall.js functions

import { WS_BASE_URL } from './config';

// ============================================================================
// COST OPTIMIZATION: Connect-on-demand WebSocket pattern
// - Opens connection only when sending a message
// - Server closes connection after stream completes
// - No persistent connections = minimal Cloud Run billing
// - NO auto-reconnect - each message opens fresh connection
// ============================================================================

class WebSocketManager {
  constructor() {
    this.connections = new Map(); // chat_id -> WebSocket
  }

  // Get or create WebSocket connection for a chat
  async getConnection(chatId) {
    if (this.connections.has(chatId)) {
      const ws = this.connections.get(chatId);
      if (ws.readyState === WebSocket.OPEN) {
        return ws;
      }
      // Clean up stale connection
      this.connections.delete(chatId);
    }

    return this.createConnection(chatId);
  }

  createConnection(chatId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE_URL}/ws/${chatId}`);

      ws.onopen = () => {
        console.log(`✅ WebSocket connected for chat ${chatId}`);
        this.connections.set(chatId, ws);
        resolve(ws);
      };

      ws.onerror = (error) => {
        console.error(`❌ WebSocket error for chat ${chatId}:`, error);
        reject(error);
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed for chat ${chatId}:`, event.code, event.reason);
        this.connections.delete(chatId);
        // COST OPTIMIZATION: No reconnection - server closes after each stream
        // Next message will open a fresh connection
      };
    });
  }

  // Send message through WebSocket
  async sendMessage(chatId, message) {
    try {
      const ws = await this.getConnection(chatId);
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
      } else {
        throw new Error('WebSocket not ready');
      }
    } catch (error) {
      console.error(`Failed to send message to chat ${chatId}:`, error);
      return false;
    }
  }

  // Set up message listener
  setupMessageListener(chatId, onMessage) {
    const ws = this.connections.get(chatId);
    if (ws) {
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    }
  }

  // Close connection
  closeConnection(chatId) {
    const ws = this.connections.get(chatId);
    if (ws) {
      ws.close(1000, 'Client closing connection');
      this.connections.delete(chatId);
    }
  }

  // Cancel ongoing streaming
  async cancelStream(chatId) {
    try {
      console.log(`🛑 Cancelling stream for chat ${chatId}`);
      const success = await this.sendMessage(chatId, {
        type: 'cancel_stream',
        chat_id: chatId
      });

      if (success) {
        console.log(`✅ Cancel request sent for chat ${chatId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to cancel stream for chat ${chatId}:`, error);
      return false;
    }
  }
}

// Global instance
const wsManager = new WebSocketManager();

// New WebSocket-based function to replace ask_llm_stream
export const ask_llm_websocket = async (
  language,
  userPrompt,
  chatHistory,
  documents,
  chat_id,
  onStatusUpdate,
  onTokenReceived,
  onStreamEnd
) => {
  try {
    console.log(`🚀 Starting WebSocket chat for ${chat_id}`);

    // Get WebSocket connection
    const ws = await wsManager.getConnection(chat_id);

    // Set up message listener with chat_id for auto-close on complete
    wsManager.setupMessageListener(chat_id, (message) => {
      handleWebSocketMessage(message, onStatusUpdate, onTokenReceived, onStreamEnd, chat_id);
    });

    // Send chat message
    console.log('📤 Sending message to backend:', {
      type: 'chat_message',
      input: userPrompt.substring(0, 100) + '...',
      chat_id: chat_id
    });

    const success = await wsManager.sendMessage(chat_id, {
      type: 'chat_message',
      input: userPrompt,
      language: language,
      chat_history: chatHistory || [],
      documents: documents || []
    });

    if (!success) {
      console.error('❌ Failed to send message to backend');
      throw new Error('Failed to send message via WebSocket');
    }

    console.log('✅ Message sent successfully to backend');

  } catch (error) {
    console.error('WebSocket chat error:', error);
    onStatusUpdate({ status: "error", message: "WebSocket connection failed: " + error.message });
  }
};

// Handle incoming WebSocket messages with full quiz streaming support
// COST OPTIMIZATION: Returns true when stream is complete (to trigger connection close)
function handleWebSocketMessage(message, onStatusUpdate, onTokenReceived, onStreamEnd, chatId) {
  const { type, data } = message;
  let streamComplete = false;

  switch (type) {
    case 'status':
      onStatusUpdate({
        status: message.status,
        message: message.message
      });
      break;

    case 'stream_chunk':
      // Handle all the streaming formats from your current implementation
      if (data.status) {
        // Handle status updates (quiz generation, study sheets, etc.)
        onStatusUpdate(data);
      }
      else if (data.answer_chunk) {
        // Handle regular text streaming
        onTokenReceived(data.answer_chunk);
      }
      else if (data.html) {
        // Handle study sheet generation
        onStatusUpdate({
          status: "studysheet_generated",
          html: data.html
        });
      }
      else if (data.type === "study_guide_trigger") {
        // Handle study guide trigger
        onStatusUpdate({
          status: data.type,
          parameters: data
        });
      }
      // Handle quiz-specific streaming
      else if (data.status === "empathetic_message_start") {
        // Signal start of empathetic message streaming
        onStatusUpdate({
          status: "empathetic_message_start",
          message: data.message
        });
      }
      else if (data.status === "empathetic_message_chunk") {
        // Stream empathetic message chunks
        onTokenReceived(data.chunk);
      }
      else if (data.status === "empathetic_message_complete") {
        // Signal empathetic message complete
        onStatusUpdate({
          status: "empathetic_message_complete",
          full_message: data.full_message
        });
      }
      else if (data.status === "quiz_generating") {
        onStatusUpdate({
          status: "quiz_generating",
          current: data.current,
          total: data.total,
          message: data.message
        });
      }
      else if (data.status === "quiz_question") {
        onStatusUpdate({
          status: "quiz_question",
          question: data.question,
          index: data.index,
          total_so_far: data.total_so_far
        });
      }
      else if (data.status === "quiz_complete") {
        onStatusUpdate({
          status: "quiz_complete",
          quiz_data: data.quiz_data,
          total_generated: data.total_generated
        });
      }

      if (data.status === "suggested_prompts" && data.suggestions) {
        console.log("📝 Received suggestions:", data.suggestions);
        onStatusUpdate({
          status: "suggested_prompts",
          suggestions: data.suggestions,
        });
      }
      break;

    case 'stream_complete':
      streamComplete = true;
      if (onStreamEnd) {
        onStreamEnd();
      }
      // Server closes connection after stream - no client action needed
      console.log(`⚡ Stream complete for ${chatId} - server will close connection`);
      break;

    case 'error':
      onStatusUpdate({
        status: "error",
        message: message.message
      });
      break;

    case 'pong':
      // Handle keepalive response - but we shouldn't get these with auto-close
      console.log('🏓 Received pong');
      break;

    default:
      console.warn('Unknown WebSocket message type:', type);
  }

  return streamComplete;
}

// Utility functions
export const warmUpWebSocket = async (chatId) => {
  try {
    await wsManager.getConnection(chatId);
    return { status: 'ok', message: 'WebSocket connection established' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
};

export const closeWebSocketConnection = (chatId) => {
  wsManager.closeConnection(chatId);
};

// Keepalive disabled - server closes connection after each stream
// No need for keepalive with connect-on-demand pattern
export const setupWebSocketKeepalive = () => null;

// Cancel ongoing stream
export const cancelWebSocketStream = async (chatId) => {
  return await wsManager.cancelStream(chatId);
};


// ============================================================================
// GAME MODE FUNCTIONS
// These handle the gamified quiz flow where users collect serum
// by answering questions correctly to save a sick child.
//
// Usage Flow:
//   1. Call sendGameQuizRequest() to start streaming questions
//   2. Frontend validates answers client-side (answer included in question)
//   3. Track serum locally (20mL per correct answer)
//   4. Call sendGameDeliver() with total serum when quiz ends
//   5. If not enough, call sendGameRetry() for more questions
// ============================================================================

/**
 * Start a game quiz - streams questions via WebSocket
 *
 * @param {string} chatId - The chat/game session ID
 * @param {number} questionCount - Number of questions (default: 5)
 * @param {string} difficulty - Question difficulty: "easy", "medium", "hard" (default: "medium")
 * @param {function} onMessage - Callback for handling streamed messages
 * @returns {Promise<boolean>} - True if request sent successfully
 *
 * Message types you'll receive in onMessage:
 *   - game_initialized: { serumCollected, serumRequired }
 *   - game_generating: { current, total }
 *   - game_question_ready: { question: { index, question, options, answer, justification, topic, serumValue }, quizId, isFirst }
 *   - game_quiz_complete: { totalQuestions }
 */
export const sendGameQuizRequest = async (chatId, questionCount = 5, difficulty = "medium", onMessage = null) => {
  try {
    // Make sure we're connected
    await wsManager.getConnection(chatId);

    // Set up message listener if provided
    if (onMessage) {
      wsManager.setupMessageListener(chatId, onMessage);
    }

    // Send the game quiz request
    const success = await wsManager.sendMessage(chatId, {
      type: "game_quiz",
      questionCount,
      difficulty
    });

    if (success) {
      console.log(`🎮 Game quiz request sent for chat ${chatId}`);
    }

    return success;
  } catch (error) {
    console.error(`Failed to send game quiz request:`, error);
    return false;
  }
};

/**
 * Deliver serum after completing a quiz
 *
 * @param {string} chatId - The chat/game session ID
 * @param {number} serumCollected - Amount of serum collected THIS quiz (not cumulative)
 * @returns {Promise<boolean>} - True if request sent successfully
 *
 * Message types you'll receive:
 *   - game_child_saved: { serumDelivered, attempts, message } - SUCCESS!
 *   - game_need_more_serum: { serumCollected, serumRequired, serumNeeded, attempts, message } - Need retry
 */
export const sendGameDeliver = async (chatId, serumCollected) => {
  try {
    const success = await wsManager.sendMessage(chatId, {
      type: "game_deliver",
      serumCollected
    });

    if (success) {
      console.log(`🧪 Delivery request sent: ${serumCollected}mL`);
    }

    return success;
  } catch (error) {
    console.error(`Failed to send delivery request:`, error);
    return false;
  }
};

/**
 * Request a retry quiz (serum persists!)
 *
 * @param {string} chatId - The chat/game session ID
 * @param {number} questionCount - Number of questions for retry (default: 5)
 * @param {string} difficulty - Question difficulty (default: "medium")
 * @returns {Promise<boolean>} - True if request sent successfully
 *
 * Message types you'll receive:
 *   - game_retry_starting: { serumCollected, serumRequired, serumNeeded, message }
 *   - Then same as sendGameQuizRequest (game_initialized, game_question_ready, etc.)
 */
export const sendGameRetry = async (chatId, questionCount = 5, difficulty = "medium") => {
  try {
    const success = await wsManager.sendMessage(chatId, {
      type: "game_retry",
      questionCount,
      difficulty
    });

    if (success) {
      console.log(`🔄 Retry request sent for chat ${chatId}`);
    }

    return success;
  } catch (error) {
    console.error(`Failed to send retry request:`, error);
    return false;
  }
};

/**
 * Set up a listener specifically for game messages
 * Useful when you want to handle game events separately
 *
 * @param {string} chatId - The chat/game session ID
 * @param {object} handlers - Object with handler functions for each game status
 *
 * Example:
 * setupGameMessageListener(chatId, {
 *   onInitialized: ({ serumCollected, serumRequired }) => { ... },
 *   onQuestionReady: ({ question, quizId, isFirst }) => { ... },
 *   onQuizComplete: ({ totalQuestions }) => { ... },
 *   onChildSaved: ({ serumDelivered, attempts, message }) => { ... },
 *   onNeedMoreSerum: ({ serumCollected, serumRequired, serumNeeded }) => { ... },
 *   onError: (errorMessage) => { ... }
 * });
 */
export const setupGameMessageListener = (chatId, handlers = {}) => {
  wsManager.setupMessageListener(chatId, (message) => {
    const { type, data } = message;

    // Handle errors
    if (type === "error") {
      if (handlers.onError) {
        handlers.onError(message.message || "Unknown error");
      }
      return;
    }

    // Only process stream_chunk messages
    if (type !== "stream_chunk" || !data) return;

    const status = data.status;

    switch (status) {
      case "game_initialized":
        if (handlers.onInitialized) {
          handlers.onInitialized({
            serumCollected: data.serumCollected,
            serumRequired: data.serumRequired
          });
        }
        break;

      case "game_loading_documents":
        if (handlers.onGenerating) {
          // Reuse onGenerating to show "Loading documents..." message
          handlers.onGenerating({
            current: 0,
            total: 0,
            message: data.message || "Loading your documents..."
          });
        }
        break;

      case "game_generating":
        if (handlers.onGenerating) {
          handlers.onGenerating({
            current: data.current,
            total: data.total
          });
        }
        break;

      case "game_question_ready":
        if (handlers.onQuestionReady) {
          handlers.onQuestionReady({
            question: data.question,
            quizId: data.quizId,
            isFirst: data.isFirst
          });
        }
        break;

      case "game_quiz_complete":
        if (handlers.onQuizComplete) {
          handlers.onQuizComplete({
            totalQuestions: data.totalQuestions
          });
        }
        break;

      case "game_child_saved":
        if (handlers.onChildSaved) {
          handlers.onChildSaved({
            serumDelivered: data.serumDelivered,
            attempts: data.attempts,
            message: data.message
          });
        }
        break;

      case "game_need_more_serum":
        if (handlers.onNeedMoreSerum) {
          handlers.onNeedMoreSerum({
            serumCollected: data.serumCollected,
            serumRequired: data.serumRequired,
            serumNeeded: data.serumNeeded,
            attempts: data.attempts,
            message: data.message
          });
        }
        break;

      case "game_retry_starting":
        if (handlers.onRetryStarting) {
          handlers.onRetryStarting({
            serumCollected: data.serumCollected,
            serumRequired: data.serumRequired,
            serumNeeded: data.serumNeeded,
            message: data.message
          });
        }
        break;

      default:
        // Unknown game status - might be chat-related
        console.log("Unknown game status:", status);
    }
  });
};

