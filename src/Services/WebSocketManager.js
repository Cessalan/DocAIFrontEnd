// WebSocketManager.js - Replace FastAPICall.js functions

import { WS_BASE_URL } from './config';
import { devLog } from './devLogger';

// ============================================================================
// WebSocket Connection Management
// - Opens connection on first message
// - Connection stays open for 5 minutes of inactivity (server-side timeout)
// - Enables rapid follow-up requests (quiz after upload, mindmap after chat)
// - Keepalive pings every 2 minutes to prevent premature closure
// ============================================================================

const KEEPALIVE_INTERVAL = 120000; // 2 minutes - send ping to keep connection alive

// ============================================================================
// SILENT-RESPONSE WATCHDOG
// ----------------------------------------------------------------------------
// ws.onclose already covers a *dropped* connection. This covers the worse case:
// the socket stays OPEN, the backend accepts the message, and then nothing ever
// comes back (LLM routing that picks no tool and emits no text). onclose never
// fires, so the chat sits on the typing indicator forever — the student retypes
// their question two or three times and then leaves. Measured in production:
// two of our most engaged students hit this 10 and 32 times respectively.
//
// Two windows, because "no answer yet" and "answer stalled" are different:
//
//   FIRST_RESPONSE_MS — from the request until the first sign of REAL work.
//       The backend acks with status:"processing" almost immediately (see
//       process_chat_message in NQBackEnd2/main.py), so that ack deliberately
//       does NOT count as progress — otherwise a request that dies right after
//       the ack would wait for the long window instead of this short one.
//
//   STALL_MS — max silence BETWEEN events once real output is flowing. Generous
//       on purpose: a research-grounded quiz legitimately runs 60-150s with
//       gaps between phases (intent analyzer -> web research -> generation).
//
// Both sit far below the server's 300s CONNECTION_IDLE_TIMEOUT, which was the
// only backstop before this and is far longer than anyone waits.
// ============================================================================
const FIRST_RESPONSE_MS = 45000; // 45s to the first substantive event
const STALL_MS = 90000;          // 90s of silence mid-stream

// Exported for tests — the app uses the shared `wsManager` instance below.
export class WebSocketManager {
  constructor() {
    this.connections = new Map(); // chat_id -> WebSocket
    this.keepaliveIntervals = new Map(); // chat_id -> interval ID
    // chat_id -> onStatusUpdate of the in-flight request. If the socket dies
    // mid-stream (Cloud Run restart, network drop), we notify the stream
    // instead of leaving the UI typing forever.
    this.activeStreams = new Map();
    // chat_id -> { timer, sawProgress } for the watchdog above.
    this.watchdogs = new Map();
  }

  setActiveStream(chatId, notify) {
    this.activeStreams.set(chatId, notify);
    this.armWatchdog(chatId, false);
  }

  clearActiveStream(chatId) {
    this.activeStreams.delete(chatId);
    this.clearWatchdog(chatId);
  }

  failActiveStream(chatId, message, code) {
    this.clearWatchdog(chatId);
    const notify = this.activeStreams.get(chatId);
    if (notify) {
      this.activeStreams.delete(chatId);
      try {
        notify({ status: 'error', code, message });
      } catch (e) {
        console.error('Failed to notify active stream of connection loss:', e);
      }
    }
  }

  /**
   * (Re)arm the watchdog for a chat. `sawProgress` selects the window: false
   * while we're still waiting for the first real event, true once output is
   * flowing and we're only guarding against a stall.
   */
  armWatchdog(chatId, sawProgress) {
    this.clearWatchdog(chatId);
    const ms = sawProgress ? STALL_MS : FIRST_RESPONSE_MS;
    const timer = setTimeout(() => {
      this.watchdogs.delete(chatId);
      console.warn(`⏰ Chat ${chatId} went silent for ${ms}ms — failing the stream`);

      // The answer might still be alive on the backend. We've already told the
      // student it failed, so let it go — otherwise text streams in underneath
      // an error bubble, which is worse than either outcome alone. Best effort:
      // only when the socket is actually open, and never reconnect just to
      // cancel. The backend honours {type: "cancel_stream"} (main.py:585).
      const ws = this.connections.get(chatId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'cancel_stream', chat_id: chatId }));
        } catch (e) {
          // Nothing useful to do — the error bubble is going up regardless.
        }
      }

      this.failActiveStream(
        chatId,
        `No response after ${Math.round(ms / 1000)}s.`,
        'timeout'
      );
    }, ms);
    this.watchdogs.set(chatId, { timer, sawProgress });
  }

  /**
   * Called for every inbound frame. Any frame proves the backend is alive and
   * pushes the deadline out; a substantive one also widens the window from
   * FIRST_RESPONSE_MS to STALL_MS. No-op when no request is in flight.
   */
  kickWatchdog(chatId, substantive) {
    const wd = this.watchdogs.get(chatId);
    if (!wd) return;
    this.armWatchdog(chatId, wd.sawProgress || Boolean(substantive));
  }

  clearWatchdog(chatId) {
    const wd = this.watchdogs.get(chatId);
    if (wd) {
      clearTimeout(wd.timer);
      this.watchdogs.delete(chatId);
    }
  }

  // Get or create WebSocket connection for a chat
  async getConnection(chatId) {
    if (this.connections.has(chatId)) {
      const ws = this.connections.get(chatId);
      if (ws.readyState === WebSocket.OPEN) {
        return ws;
      }
      // Clean up stale connection (CONNECTING, CLOSING, or CLOSED)
      devLog(`🧹 Cleaning up stale WebSocket for chat ${chatId} (readyState: ${ws.readyState})`);
      try {
        // Force close if still connecting or closing
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.CLOSING) {
          ws.close(1000, 'Cleaning up stale connection');
        }
      } catch (e) {
        // Ignore close errors
      }
      this.connections.delete(chatId);
    }

    return this.createConnection(chatId);
  }

  createConnection(chatId, retryCount = 0) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE_URL}/ws/${chatId}`);
      let connectionTimeout;

      // Set a connection timeout
      connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn(`⏰ WebSocket connection timeout for chat ${chatId}`);
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        devLog(`✅ WebSocket connected for chat ${chatId}`);
        this.connections.set(chatId, ws);

        // Start keepalive ping to maintain connection
        this.startKeepalive(chatId, ws);

        resolve(ws);
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error(`❌ WebSocket error for chat ${chatId}:`, error);

        // Retry once if this is the first attempt (handles race condition with closing connection)
        if (retryCount < 1) {
          devLog(`🔄 Retrying WebSocket connection for chat ${chatId}...`);
          setTimeout(() => {
            this.createConnection(chatId, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 500); // Wait 500ms before retry
        } else {
          reject(error);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        devLog(`🔌 WebSocket closed for chat ${chatId}:`, event.code, event.reason);
        this.stopKeepalive(chatId);
        this.connections.delete(chatId);
        // If a request was mid-flight, surface it as an error instead of
        // leaving the chat stuck on the typing indicator forever.
        this.failActiveStream(chatId, 'Connection lost while waiting for the response.');
        // Connection will be re-established on next message if needed
      };
    });
  }

  // Start keepalive ping to prevent server timeout
  startKeepalive(chatId, ws) {
    // Clear any existing interval
    this.stopKeepalive(chatId);

    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
          devLog(`🏓 Sent keepalive ping for chat ${chatId}`);
        } catch (e) {
          console.warn(`Failed to send keepalive ping for chat ${chatId}`);
          this.stopKeepalive(chatId);
        }
      } else {
        // Connection no longer open, stop pinging
        this.stopKeepalive(chatId);
      }
    }, KEEPALIVE_INTERVAL);

    this.keepaliveIntervals.set(chatId, interval);
  }

  // Stop keepalive ping
  stopKeepalive(chatId) {
    if (this.keepaliveIntervals.has(chatId)) {
      clearInterval(this.keepaliveIntervals.get(chatId));
      this.keepaliveIntervals.delete(chatId);
    }
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
    this.stopKeepalive(chatId);
    const ws = this.connections.get(chatId);
    if (ws) {
      ws.close(1000, 'Client closing connection');
      this.connections.delete(chatId);
    }
  }

  // Cancel ongoing streaming
  async cancelStream(chatId) {
    try {
      devLog(`🛑 Cancelling stream for chat ${chatId}`);
      const success = await this.sendMessage(chatId, {
        type: 'cancel_stream',
        chat_id: chatId
      });

      if (success) {
        devLog(`✅ Cancel request sent for chat ${chatId}`);
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
    devLog(`🚀 Starting WebSocket chat for ${chat_id}`);

    // Get WebSocket connection
    const ws = await wsManager.getConnection(chat_id);

    // Register this request as the chat's in-flight stream so a dropped
    // connection can notify it (see ws.onclose -> failActiveStream).
    wsManager.setActiveStream(chat_id, onStatusUpdate);

    // Set up message listener with chat_id for auto-close on complete
    wsManager.setupMessageListener(chat_id, (message) => {
      handleWebSocketMessage(message, onStatusUpdate, onTokenReceived, onStreamEnd, chat_id);
    });

    // Send chat message
    devLog('📤 Sending message to backend:', {
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

    devLog('✅ Message sent successfully to backend');

  } catch (error) {
    console.error('WebSocket chat error:', error);
    // Stop tracking before notifying, or the watchdog armed by setActiveStream
    // above keeps running and fires a second error 45s later.
    wsManager.clearActiveStream(chat_id);
    onStatusUpdate({ status: "error", message: "WebSocket connection failed: " + error.message });
  }
};

// Handle incoming WebSocket messages with full quiz streaming support
// COST OPTIMIZATION: Returns true when stream is complete (to trigger connection close)
function handleWebSocketMessage(message, onStatusUpdate, onTokenReceived, onStreamEnd, chatId) {
  const { type, data } = message;
  let streamComplete = false;

  // Feed the silent-response watchdog. `pong` is keepalive — it proves the
  // socket is up but says nothing about the request, so it must not count.
  // `status: processing` is the backend's immediate ack, which arrives before
  // any real work: it pushes the deadline out but does not earn the longer
  // stall window (see FIRST_RESPONSE_MS above).
  if (type !== 'pong') {
    const isAck = type === 'status' && message.status === 'processing';
    wsManager.kickWatchdog(chatId, !isAck);
  }

  switch (type) {
    case 'status':
      onStatusUpdate({
        status: message.status,
        message: message.message
      });
      break;

    case 'stream_chunk':
      // Handle all the streaming formats from your current implementation
      devLog('📦 Stream chunk received:', data?.status || 'no status', data);
      if (data.status) {
        // Handle status updates (quiz generation, study sheets, etc.)
        devLog('📦 Calling onStatusUpdate with status:', data.status);
        onStatusUpdate(data);
      }
      else if (data.type === 'error') {
        // Older backend error shape ({type: "error"} without status) —
        // previously this chunk was silently dropped and the UI hung.
        onStatusUpdate({ status: 'error', message: data.message || 'Processing failed' });
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
      // Handle mindmap generation
      else if (data.status === "mindmap_generating") {
        devLog("🧠 Mindmap generation started");
        onStatusUpdate({
          status: "mindmap_generating",
          message: data.message
        });
      }
      else if (data.status === "mindmap_complete") {
        devLog("✅ Mindmap complete received from backend");
        devLog("📦 Mindmap data:", data.mindmap_data ? `${data.mindmap_data.nodes?.length} nodes` : "NO DATA");
        onStatusUpdate({
          status: "mindmap_complete",
          mindmap_data: data.mindmap_data
        });
      }

      if (data.status === "suggested_prompts" && data.suggestions) {
        devLog("📝 Received suggestions:", data.suggestions);
        onStatusUpdate({
          status: "suggested_prompts",
          suggestions: data.suggestions,
        });
      }
      break;

    case 'stream_complete':
      streamComplete = true;
      wsManager.clearActiveStream(chatId);
      if (onStreamEnd) {
        onStreamEnd();
      }
      // Connection stays open for follow-up requests (5 min idle timeout)
      devLog(`✅ Stream complete for ${chatId} - connection stays open for follow-up requests`);
      break;

    case 'error':
      wsManager.clearActiveStream(chatId);
      onStatusUpdate({
        status: "error",
        // Pass the machine-readable code through (e.g. "quota_exceeded"
        // opens the upgrade modal instead of a retry bubble).
        code: message.code,
        message: message.message
      });
      break;

    case 'stream_cancelled':
      // User pressed stop — not an error; just stop tracking the request.
      wsManager.clearActiveStream(chatId);
      break;

    case 'pong':
      // Handle keepalive response - confirms connection is alive
      devLog('🏓 Received pong - connection alive');
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

// Keepalive is now handled automatically within WebSocketManager
// This function is kept for backward compatibility
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
 * @param {Array<string>} existingTopics - User's existing topics from progress tracking (for smart topic matching)
 * @returns {Promise<boolean>} - True if request sent successfully
 *
 * Message types you'll receive in onMessage:
 *   - game_initialized: { serumCollected, serumRequired }
 *   - game_generating: { current, total }
 *   - game_question_ready: { question: { index, question, options, answer, justification, topic, serumValue }, quizId, isFirst }
 *   - game_quiz_complete: { totalQuestions }
 */
export const sendGameQuizRequest = async (chatId, questionCount = 5, difficulty = "medium", onMessage = null, existingTopics = []) => {
  try {
    // Make sure we're connected
    await wsManager.getConnection(chatId);

    // Set up message listener if provided
    if (onMessage) {
      wsManager.setupMessageListener(chatId, onMessage);
    }

    // Send the game quiz request with existing topics for smart matching
    const success = await wsManager.sendMessage(chatId, {
      type: "game_quiz",
      questionCount,
      difficulty,
      existingTopics  // User's existing topics - backend will try to match questions to these
    });

    if (success) {
      devLog(`🎮 Game quiz request sent for chat ${chatId}`);
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
      devLog(`🧪 Delivery request sent: ${serumCollected}mL`);
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
      devLog(`🔄 Retry request sent for chat ${chatId}`);
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
        devLog("Unknown game status:", status);
    }
  });
};

