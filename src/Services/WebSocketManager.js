// WebSocketManager.js - Replace FastAPICall.js functions

import { WS_BASE_URL } from './config';

class WebSocketManager {
  constructor() {
    this.connections = new Map(); // chat_id -> WebSocket
    this.reconnectAttempts = new Map(); // chat_id -> number
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
  }

  // Get or create WebSocket connection for a chat
  async getConnection(chatId) {
    if (this.connections.has(chatId)) {
      const ws = this.connections.get(chatId);
      if (ws.readyState === WebSocket.OPEN) {
        return ws;
      }
    }

    return this.createConnection(chatId);
  }

  createConnection(chatId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE_URL}/ws/${chatId}`);
      
      ws.onopen = () => {
        console.log(`✅ WebSocket connected for chat ${chatId}`);
        this.connections.set(chatId, ws);
        this.reconnectAttempts.set(chatId, 0);
        resolve(ws);
      };

      ws.onerror = (error) => {
        console.error(`❌ WebSocket error for chat ${chatId}:`, error);
        reject(error);
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed for chat ${chatId}:`, event.code, event.reason);
        this.connections.delete(chatId);
        
        // Attempt reconnection if not a clean close
        if (event.code !== 1000) {
          this.attemptReconnection(chatId);
        }
      };
    });
  }

  async attemptReconnection(chatId) {
    const attempts = this.reconnectAttempts.get(chatId) || 0;
    
    if (attempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, attempts); // Exponential backoff
      
      console.log(`🔄 Attempting reconnection ${attempts + 1}/${this.maxReconnectAttempts} for chat ${chatId} in ${delay}ms`);
      
      setTimeout(async () => {
        try {
          this.reconnectAttempts.set(chatId, attempts + 1);
          await this.createConnection(chatId);
        } catch (error) {
          console.error(`Failed reconnection attempt ${attempts + 1} for chat ${chatId}:`, error);
        }
      }, delay);
    } else {
      console.error(`❌ Max reconnection attempts reached for chat ${chatId}`);
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
    const ws = this.connections.get(chatId);
    if (ws) {
      ws.close(1000, 'Client closing connection');
      this.connections.delete(chatId);
    }
  }

  // Send keepalive ping
  sendPing(chatId) {
    this.sendMessage(chatId, { type: 'ping' });
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

    // Set up message listener
    wsManager.setupMessageListener(chat_id, (message) => {
      handleWebSocketMessage(message, onStatusUpdate, onTokenReceived, onStreamEnd);
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
function handleWebSocketMessage(message, onStatusUpdate, onTokenReceived, onStreamEnd) {
  const { type, data } = message;

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
      if (onStreamEnd) {
        onStreamEnd();
      }
      break;

    case 'error':
      onStatusUpdate({ 
        status: "error", 
        message: message.message 
      });
      break;

    case 'pong':
      // Handle keepalive response
      console.log('🏓 Received pong');
      break;

    default:
      console.warn('Unknown WebSocket message type:', type);
  }
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

// Setup periodic keepalive (call this when app starts)
export const setupWebSocketKeepalive = (chatId, intervalMs = 30000) => {
  return setInterval(() => {
    wsManager.sendPing(chatId);
  }, intervalMs);
};

// Cancel ongoing stream
export const cancelWebSocketStream = async (chatId) => {
  return await wsManager.cancelStream(chatId);
};

