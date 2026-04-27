import { auth } from '../Firebase/config';
import { API_BASE_URL } from './config';
import { devLog } from './devLogger';

const FAST_API_BASE = API_BASE_URL;
const header = {"Content-Type": "application/json"};

// not used
export const ask_llm = async(userPrompt,chatHistory,documents,chat_id) => 
{
    const requestBody = JSON.stringify({
        question: userPrompt,
        chat_history: chatHistory,
        documents:documents || [],
        chat_id:chat_id
    });
    
    devLog("Request sent to Fast API:",requestBody);
    
    try
    {
        const result = await fetch(`${FAST_API_BASE}/chat`,{
             method:"POST",
             headers:header,
             body: requestBody});


        if(!result.ok)
        {
            const errorData = await result.json();
            console.error("FastAPI returned an error:", errorData);
            throw new Error(errorData.detail || "Unknown server error");
        }

        const llm_response = await result.json();

        return llm_response;
        
    }catch(error)
    {
        console.error("Error calling FAST API", error);
    }
    
}

// warm up server so its not slow asf
export const warm_up_FASTAPI=async()=>{
   const response = await fetch(`${FAST_API_BASE}/warm_up`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
    });

    return response;
}

// new function for streaming
export const ask_llm_stream = async (language,
                                    userPrompt,
                                    chatHistory,
                                    documents,
                                    chat_id,
                                    onStatusUpdate,
                                    onTokenReceived,
                                    onStreamEnd) => {
  // Construct the request body with all the necessary data for the backend.
  const requestBody = JSON.stringify({
    language:language,
    input: userPrompt,
    chat_history: chatHistory || [],
    documents: documents || [],
    chat_id: chat_id
  });

  devLog("Request sent to FastAPI /chat/stream:", requestBody);

  try {
    // Initiate the fetch request to the streaming endpoint.
    // The browser will now wait for a stream of data, not a single response.
    const response = await fetch(`${FAST_API_BASE}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed with status ${response.status}: ${errorText}`);
    }

    // Get a reader from the response body to read the stream chunk by chunk.
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let receivedData = "";
    
    // Begin the asynchronous loop to read from the stream.
    while (true) {
      // Read a single chunk from the stream. 'done' is true when the stream ends.
      const { done, value } = await reader.read();
      if (done) {
          devLog("Stream complete.");
          break;
      }

      // Decode the binary data chunk into a string.
      const chunk = decoder.decode(value, { stream: true });
      receivedData += chunk;

      // The backend sends a JSON object on each line.
      // We split the received data by newline to process each full JSON chunk.
      const lines = receivedData.split('\n');
      // Keep the last line, as it might be an incomplete JSON object.
      receivedData = lines.pop(); 

      // In your ask_llm_stream function, make sure you're handling answer_chunk:
      for (const line of lines) {
          if (!line.trim()) continue;
          try {
              const jsonChunk = JSON.parse(line);
              
              if (jsonChunk.status) {
                  onStatusUpdate(jsonChunk);
              }
              // HANDLE NORMAL TEXT DURING CONVO
              else if (jsonChunk.answer_chunk) {
                  // This is what makes it stream!
                    // devLog(' Received chunk:', jsonChunk);
                    // devLog(' Timestamp:', Date.now());
                  onTokenReceived(jsonChunk.answer_chunk);
              }
              else if(jsonChunk.html)
              {
                devLog("I GOT THE HTML",jsonChunk.html);
                onStatusUpdate
                ({
                  status: "studysheet_generated",
                  html: jsonChunk.html
                })

              }
              else if(jsonChunk.type){
                if(jsonChunk.type === "study_guide_trigger")
                onStatusUpdate({
                  status: jsonChunk.type,
                  parameters: jsonChunk
              })
              }

              // // Quiz generation progress
              // if (jsonChunk.status === "quiz_generating") {
              //   onStatusUpdate({
              //     status: "quiz_generating",
              //     current: jsonChunk.current,
              //     total: jsonChunk.total,
              //     message: jsonChunk.message
              //   });
              // }           
              // // Individual question ready
              // else if (jsonChunk.status === "quiz_question") {
              //   onStatusUpdate({
              //     status: "quiz_question",
              //     question: jsonChunk.question,
              //     index: jsonChunk.index,
              //     total_so_far: jsonChunk.total_so_far
              //   });
              // }             
              // // Quiz complete (all questions)
              // else if (jsonChunk.status === "quiz_complete") {
              //   onStatusUpdate({
              //     status: "quiz_complete",
              //     quiz_data: jsonChunk.quiz_data,
              //     total_generated: jsonChunk.total_generated
              //   });
              // }

              // else if (jsonChunk.answer) {
              //     // This only happens at the very end
              //     onTokenReceived(jsonChunk.answer);
              // }
          } catch (e) {
              console.error("Failed to parse JSON chunk:", e);
          }
      }
    }
    
    // Call the final callback once the entire stream has been read.
    if (onStreamEnd) {
        onStreamEnd();
    }

  } catch (error) {
    console.error("Error during streaming LLM call:", error);
    onStatusUpdate({ status: "error", message: "Error: " + error.message });
  }
};


export const embed_docs = async (documents,chatId) => {
    const requestBody = JSON.stringify({
        chatId : chatId,
        documents:documents || []
    });

    const result = await fetch(`${FAST_API_BASE}/chat/embed`,{
        method:"POST",
        headers:header,
        body: requestBody});

    const vectors = result.json();

    devLog("EMBED RESULT " + vectors);

    return vectors;
}


/**
 * Upload multiple files with streaming progress updates
 * @param {File[]} files - Array of File objects from input
 * @param {string} chatId - Current chat ID
 * @param {Function} onProgress - Callback for progress updates (update) => {}
 * @returns {Promise<Object>} Final results with all file metadata
 */
export const upload_files_with_progress = async (files, chatId, onProgress,language) => {
  try {
    // Normalize language to base code (e.g., 'fr-FR' -> 'fr')
    const normalizedLang = language ? language.split('-')[0].toLowerCase() : 'en';
    devLog('📤 Upload language:', language, '-> normalized:', normalizedLang);

    // Prepare FormData
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file); // 'files' plural matches backend
    });
    formData.append('chat_id', chatId);
    formData.append('user_id', auth.currentUser?.uid || 'anonymous');
    formData.append('language', normalizedLang)

    // Send request
    const response = await fetch(`${FAST_API_BASE}/chat/upload-files`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }

    const results = {
      files: new Map(),
      totalWords: 0,
      completed: 0,
      total: files.length
    };

    // Helper: process a single NDJSON line
    const processLine = (line) => {
      if (!line.trim()) return;
      try {
        const update = JSON.parse(line);
        if (onProgress) onProgress(update);
        if (update.type === 'file_complete') {
          results.files.set(update.file_id, update);
          results.totalWords += update.word_count || 0;
          results.completed += 1;
        }
        if (update.type === 'error') {
          throw new Error(update.message);
        }
      } catch (parseError) {
        // Re-throw upload errors, ignore JSON parse failures
        if (parseError.message && !parseError.message.includes('JSON')) throw parseError;
        console.error('Failed to parse upload update:', line, parseError);
      }
    };

    // iOS Safari (especially < 16.4) may not support ReadableStream on response.body.
    // Fall back to reading the full response text when streaming is unavailable.
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          processLine(line);
        }
      }
      // Process any remaining data in buffer
      if (buffer.trim()) processLine(buffer);
    } else {
      // Fallback: read full response as text (no streaming progress, but it works)
      const text = await response.text();
      for (const line of text.split('\n')) {
        processLine(line);
      }
    }

    return results;

  } catch (error) {
    console.error('Upload error in FastAPICalls:', error);
    throw error;
  }
};
export const generate_title = async(message, language = 'en') => {
  // Normalize language to base code (e.g., 'fr-FR' -> 'fr')
  const normalizedLang = language ? language.split('-')[0].toLowerCase() : 'en';

  const requestBody = JSON.stringify({
    message: message || "",
    language: normalizedLang
  });
  try {
    const response = await fetch(`${FAST_API_BASE}/chat/generate-title`, {
      method: "POST",
      headers: header,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Title Generation request failed with status ${response.status}: ${errorText}`);
    }

    const title_response = await response.json();
    return title_response;

  } catch(error) {
    console.error("Error during title generation:", error);
    throw error;
  }
}

export const generate_summary = async(chat_id, file_name, language) => {
  const requestBody = JSON.stringify({
    chat_id:chat_id,
    filename:file_name,
    language:language
  });

   try{

    devLog("generate_summary API Request started");
    const response = await fetch(`${FAST_API_BASE}/chat/generate-summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody
    });

     if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Summary Generation request failed with status ${response.status}: ${errorText}`);
    }

    const summary_json = await response.json();
    devLog("Fast API response quiz generation: ", summary_json)
    return summary_json;

  }catch(error)
  {
       console.error("Error during quiz generation:", error);
      throw error;
  }
}

// --- New dedicated streaming function for summary ---
export const stream_summary = async(chat_id, file_name, language, onTokenReceived, onStreamEnd) => {
    // Construct the request body for the summary endpoint.
    const requestBody = JSON.stringify({
      chat_id: chat_id,
      filename: file_name,
      language: language
    });
  
    devLog("Request sent to FastAPI /chat/generate-summary (STREAMING):", requestBody);
  
    try {
      const response = await fetch(`${FAST_API_BASE}/chat/generate-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: requestBody
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Summary Streaming request failed with status ${response.status}: ${errorText}`);
      }
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
  
      let receivedData = "";
      let fullResponse = ""; // Accumulator for the whole response
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
            devLog("Summary stream complete.");
            break;
        }
  
        const chunk = decoder.decode(value, { stream: true });
        receivedData += chunk;
  
        const lines = receivedData.split('\n');
        receivedData = lines.pop(); // Keep the last, potentially incomplete line
  
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const jsonChunk = JSON.parse(line);
                
                // The backend sends text chunks with the key "answer_chunk"
                if (jsonChunk.answer_chunk) {
                    fullResponse += jsonChunk.answer_chunk;
                    // Pass the new chunk and the total accumulated text to the handler
                    onTokenReceived(jsonChunk.answer_chunk, fullResponse); 
                }
  
            } catch (e) {
                console.error("Failed to parse JSON chunk in summary stream:", e);
            }
        }
      }
      
      // Call the final callback once the entire stream has been read.
      if (onStreamEnd) {
          onStreamEnd(fullResponse); // Pass the final complete text
      }
  
    } catch (error) {
      console.error("Error during streaming summary call:", error);
      // Propagate error to onStreamEnd for final message handling
      onStreamEnd("Error: Failed to generate summary due to a connection or server error.");
    }
};

/**
 * Generates a quiz from uploaded content
 *
 * @param {string} chat_id - The chat/session ID
 * @param {string} file_name - Name of the uploaded file to generate quiz from
 * @param {string} currentLanguage - Language for the quiz ('english' or 'french')
 * @param {Object} options - Optional configuration
 * @param {number} options.num_questions - Number of questions to generate (default: 15)
 * @param {string[]} options.question_types - Types of questions to include (default: ['mcq'])
 *   Supported types: 'mcq' (multiple choice), 'sata' (select all that apply)
 * @returns {Promise<Object[]>} Array of question objects
 *
 * @example
 * // Generate MCQ-only quiz (default)
 * const quiz = await generate_quiz(chatId, filename, 'english');
 *
 * @example
 * // Generate mixed quiz with SATA questions
 * const quiz = await generate_quiz(chatId, filename, 'english', {
 *   num_questions: 10,
 *   question_types: ['mcq', 'sata']
 * });
 */
export const generate_quiz = async(chat_id, file_name, currentLanguage, options = {}) => {
  // Destructure options with defaults
  const {
    num_questions = 15,
    question_types = ['mcq']  // Default to MCQ only for backward compatibility
  } = options;

  const requestBody = JSON.stringify({
    chat_id: chat_id,
    filename: file_name,
    quiz_type: question_types.length === 1 ? question_types[0] : 'mixed',
    question_types: question_types,  // Array of types to generate
    num_questions: num_questions,
    language: currentLanguage
  });

  try {
    const response = await fetch(`${FAST_API_BASE}/chat/generate-quiz`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Quiz Generation request failed with status ${response.status}: ${errorText}`);
    }

    const quiz_json = await response.json();
    devLog("Fast API response quiz generation: ", quiz_json);
    return quiz_json;

  } catch(error) {
    console.error("Error during quiz generation:", error);
    throw error;
  }
}

export const generate_flashcards = async(chat_id, file_name, currentLanguage, num_cards = 15) => {

  const requestBody = JSON.stringify({
    chat_id: chat_id,
    filename: file_name,
    num_cards: num_cards,
    language: currentLanguage
  });

  try {
    const response = await fetch(`${FAST_API_BASE}/chat/generate-flashcards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Flashcard Generation request failed with status ${response.status}: ${errorText}`);
    }

    const flashcard_json = await response.json();
    devLog("Fast API response flashcard generation: ", flashcard_json);
    return flashcard_json;

  } catch(error) {
    console.error("Error during flashcard generation:", error);
    throw error;
  }
}

export const generate_scenario = async(chat_id,file_name)=> {
  const requestBody = JSON.stringify({
    chat_id:chat_id,
    filename:file_name
  });

   try{

    devLog("generate_scenario API Request started");
    const response = await fetch(`${FAST_API_BASE}/chat/generate-scenario`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody
    });

     if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scenario Generation request failed with status ${response.status}: ${errorText}`);
    }

    const scenario_json = await response.json();
    devLog("Fast API response scenario generation: ", scenario_json)
    return scenario_json;

  }catch(error)
  {
       console.error("Error during scenario generation:", error);
      throw error;
  }
}


export const generate_study_guide_plan = async (topic, chatId, numSections = 6) => {
  try {
    const response = await fetch(`${FAST_API_BASE}/plan`, {
      method: "POST",
      headers: header,
      body: JSON.stringify({
        topic: topic,
        chat_id: chatId,
        num_sections: numSections
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Plan generation failed: ${response.status} - ${errorText}`);
    }

    return await response.json(); // Returns { sections: [...], context: "..." }
  } catch (error) {
    console.error("Error generating study guide plan:", error);
    throw error;
  }
}


export const search_for_study_guide = async (query, chatId) => {
  try {
    const response = await fetch(`${FAST_API_BASE}/search`, {
      method: "POST",
      headers: header,
      body: JSON.stringify({
        query: query,
        chat_id: chatId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Search failed: ${response.status} - ${errorText}`);
    }

    return await response.json(); // Returns { context: "..." }
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
};

export const generate_study_guide_section = async (sectionTitle, topic, chatId, context) => {
  try {
    const response = await fetch(`${FAST_API_BASE}/generate-section`, {
      method: "POST",
      headers: header,
      body: JSON.stringify({
        section_title: sectionTitle,
        topic: topic,
        chat_id: chatId,
        context: context
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Section generation failed: ${response.status} - ${errorText}`);
    }

    return await response.json(); // Returns { content: "<html>..." }
  } catch (error) {
    console.error("Error generating section:", error);
    throw error;
  }
};

/**
 * Speech-to-Text using OpenAI Whisper
 * @param {Blob} audioBlob - Audio blob from MediaRecorder
 * @returns {Promise<{success: boolean, text: string}>}
 */
export const speech_to_text = async (audioBlob) => {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(`${FAST_API_BASE}/speech-to-text`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Speech-to-text failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
};

// ============================================
// STUDY SESSION API CALLS
// ============================================

/**
 * Plan a study path based on uploaded documents
 * AI analyzes document complexity and generates appropriate number of nodes
 *
 * @param {string} chat_id - Chat ID where documents are uploaded
 * @param {string[]} upload_ids - IDs of uploads to study from
 * @param {string} language - Language for content generation
 * @returns {Promise<Object>} - AI-generated study path
 *
 * Expected response:
 * {
 *   unitTitle: "Cardiovascular Pharmacology",
 *   unitSubtitle: "Heart Medications & Mechanisms",
 *   complexity: "intermediate",
 *   estimatedMinutes: 30,
 *   nodes: [
 *     { type: "lesson", label: "Introduction", difficulty: 1, tags: ["intro"] },
 *     { type: "flashcard", label: "Key Terms", difficulty: 1, tags: ["vocab"] },
 *     ...
 *   ]
 * }
 */
export const plan_study_path = async (chat_id, upload_ids, user_preferences = {}, language = 'en') => {
  const requestBody = JSON.stringify({
    chat_id: chat_id,
    upload_ids: upload_ids,
    language: language,
    userPreferences: user_preferences
  });

  try {
    devLog("📚 Requesting AI study path plan...");

    const response = await fetch(`${FAST_API_BASE}/study/plan`, {
      method: "POST",
      headers: header,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Study path planning failed: ${response.status} - ${errorText}`);
    }

    const pathData = await response.json();
    devLog("✅ Study path planned:", pathData);
    return pathData;

  } catch (error) {
    console.error("❌ Error planning study path:", error);
    throw error;
  }
};

/**
 * Generate 5 breadth-first diagnostic questions before the study plan is shown.
 * One question per major topic, easy→hard. Used to seed initial insight data.
 *
 * @param {string} chat_id - Chat ID where documents were uploaded
 * @param {string[]} upload_ids - Upload IDs to focus on
 * @param {string} language - Language for questions
 * @returns {Promise<Object>} - { questions: [{ question, options, correctIndex, rationale, topic }] }
 */
export const plan_diagnostic_quiz = async (chat_id, upload_ids, language = 'en', user_preferences = {}) => {
  try {
    devLog("🔬 Requesting diagnostic quiz...");
    const response = await fetch(`${FAST_API_BASE}/study/diagnostic-quiz`, {
      method: "POST",
      headers: header,
      body: JSON.stringify({ chat_id, upload_ids, language, userPreferences: user_preferences })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Diagnostic quiz failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    devLog("✅ Diagnostic quiz ready:", data.questions?.length, "questions");
    return data;
  } catch (error) {
    console.error("❌ Error generating diagnostic quiz:", error);
    throw error;
  }
};

/**
 * Generate a Phase 2 review study path based on performance data
 *
 * @param {string} chat_id - Study session chat ID
 * @param {Object} performance - Performance data from Firestore (studyPerformance doc)
 * @param {string[]} original_topics - Topics from phase 1
 * @param {string} language - Language for content generation
 * @returns {Promise<Object>} - { nodes, topics, total_nodes, estimated_time_minutes }
 */
export const plan_review_path = async (chat_id, performance, original_topics = [], language = 'en', user_preferences = {}) => {
  const requestBody = JSON.stringify({
    chat_id,
    performance,
    original_topics,
    language,
    userPreferences: user_preferences
  });

  try {
    devLog("📚 Requesting review study path...");

    const response = await fetch(`${FAST_API_BASE}/study/plan-review`, {
      method: "POST",
      headers: header,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Review path planning failed: ${response.status} - ${errorText}`);
    }

    const pathData = await response.json();
    devLog("✅ Review path planned:", pathData);
    return pathData;

  } catch (error) {
    console.error("❌ Error planning review path:", error);
    throw error;
  }
};

/**
 * Interpret a student's free-text request during a study session.
 * Returns an echo message (what the system understood) and a node definition.
 *
 * @param {string} chat_id - Study session chat ID
 * @param {string} user_text - What the student typed
 * @param {string} current_topic - Topic of the node she just completed
 * @param {string} current_node_type - Type of the node she just completed
 * @param {string} language - Language for the response
 * @returns {Promise<Object>} - { understood: bool, echo: string, node: {...} | null }
 */
/**
 * Generate a mixed-format NCLEX-style exam for a study session.
 *
 * @param {string} chat_id - Study session chat ID
 * @param {string} topic - Topic this exam covers
 * @param {string[]} question_types - Types to include: ["mcq", "sata", "casestudy"]
 * @param {number} question_count - Number of questions (5-20)
 * @param {string|null} custom_instructions - Student's custom instructions
 * @param {string} language - Language
 * @returns {Promise<Object>} - { questions: [...], hash, examConfig }
 */
export const generate_exam = async (chat_id, topic, question_types = ['mcq', 'sata', 'casestudy'], question_count = 10, custom_instructions = null, language = 'en') => {
  try {
    devLog("📝 Generating exam:", { topic, question_types, question_count });

    const response = await fetch(`${FAST_API_BASE}/study/generate-exam`, {
      method: "POST",
      headers: header,
      body: JSON.stringify({
        chat_id,
        topic,
        question_types,
        question_count,
        custom_instructions,
        language
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Exam generation failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    devLog("✅ Exam generated:", result.questions?.length, "questions");
    return result;

  } catch (error) {
    console.error("❌ Error generating exam:", error);
    throw error;
  }
};

export const interpret_study_request = async (chat_id, user_text, current_topic, current_node_type, language = 'en', missed_items = [], score_percent = null) => {
  try {
    devLog("💬 Interpreting student request:", user_text);

    const response = await fetch(`${FAST_API_BASE}/study/interpret-request`, {
      method: "POST",
      headers: header,
      body: JSON.stringify({
        chat_id,
        user_text,
        current_topic,
        current_node_type,
        language,
        missed_items,
        score_percent
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Interpret request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    devLog("✅ Interpreted request:", result);
    return result;

  } catch (error) {
    console.error("❌ Error interpreting study request:", error);
    throw error;
  }
};

/**
 * Generate a single study item (lesson, flashcard, quiz, or audio config)
 *
 * @param {string} chat_id - Study session chat ID
 * @param {string} node_type - Type of content: 'lesson' | 'flashcard' | 'quiz' | 'audio'
 * @param {string} node_label - Label/topic for the node
 * @param {string[]} context_tags - Tags for context
 * @param {string[]} asked_hashes - Previously asked content hashes (anti-repeat)
 * @param {string} language - Language for content
 * @returns {Promise<Object>} - Generated content with hash
 *
 * Expected responses by type:
 *
 * Quiz:
 * {
 *   type: "quiz",
 *   content: {
 *     question: "What is...?",
 *     options: ["A. ...", "B. ...", "C. ...", "D. ..."],
 *     correctIndex: 1,
 *     rationale: "Because..."
 *   },
 *   hash: "content-hash"
 * }
 *
 * Lesson:
 * {
 *   type: "lesson",
 *   content: {
 *     title: "Introduction to...",
 *     body: "Content here (5-8 lines)",
 *     keyPoints: ["Point 1", "Point 2", "Point 3"]
 *   },
 *   hash: "content-hash"
 * }
 *
 * Flashcard:
 * {
 *   type: "flashcard",
 *   content: {
 *     front: "Question or term",
 *     back: "Answer or definition"
 *   },
 *   hash: "content-hash"
 * }
 *
 * Audio:
 * {
 *   type: "audio",
 *   content: {
 *     topic: "Topic for audio",
 *     intent: "teach",
 *     suggestedDuration: 2
 *   },
 *   hash: "content-hash"
 * }
 */
export const generate_study_item = async (
  chat_id,
  node_type,
  node_label,
  context_tags = [],
  asked_hashes = [],
  language = 'en'
) => {
  const requestBody = JSON.stringify({
    chat_id: chat_id,
    node_type: node_type,
    node_label: node_label,
    context_tags: context_tags,
    asked_hashes: asked_hashes,
    language: language
  });

  try {
    devLog(`📝 Generating study ${node_type}:`, node_label);

    const response = await fetch(`${FAST_API_BASE}/study/generate-item`, {
      method: "POST",
      headers: header,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Study item generation failed: ${response.status} - ${errorText}`);
    }

    const itemData = await response.json();
    devLog(`✅ Study ${node_type} generated`);
    return itemData;

  } catch (error) {
    console.error(`❌ Error generating study ${node_type}:`, error);
    throw error;
  }
};

/**
 * Generate study content with streaming progress updates (optional enhancement)
 *
 * This provides real-time feedback during generation. Use this when you want
 * to show progress updates to the user (e.g., "Generating question 2 of 5...").
 *
 * @param {string} chat_id - Study session chat ID
 * @param {string} node_type - Type of node: "lesson" | "flashcard" | "quiz" | "audio"
 * @param {string} node_label - Topic/label for this node
 * @param {Array} context_tags - Tags for better context
 * @param {Array} asked_hashes - Previously shown content hashes
 * @param {string} language - Language for content
 * @param {Function} onProgress - Callback for progress updates (optional)
 * @returns {Promise<Object>} - { type, content, hash }
 */
export const generate_study_item_stream = async (
  chat_id,
  node_type,
  node_label,
  context_tags = [],
  asked_hashes = [],
  language = 'en',
  onProgress = null
) => {
  const requestBody = JSON.stringify({
    chat_id: chat_id,
    node_type: node_type,
    node_label: node_label,
    context_tags: context_tags,
    asked_hashes: asked_hashes,
    language: language
  });

  try {
    devLog(`🌊 Streaming study ${node_type}:`, node_label);

    const response = await fetch(`${FAST_API_BASE}/study/generate-item-stream`, {
      method: "POST",
      headers: header,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Study item streaming failed: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            // Call progress callback if provided
            if (onProgress && data.status !== 'complete' && data.status !== 'error') {
              onProgress(data);
            }

            // Capture final result
            if (data.status === 'complete') {
              result = {
                type: data.type,
                content: data.content,
                hash: data.hash
              };
            }

            // Handle errors
            if (data.status === 'error') {
              throw new Error(data.message || 'Streaming generation failed');
            }
          } catch (parseError) {
            // Ignore parse errors for incomplete chunks
            if (parseError.message !== 'Streaming generation failed') {
              console.warn('Failed to parse SSE chunk:', line);
            } else {
              throw parseError;
            }
          }
        }
      }
    }

    devLog(`✅ Study ${node_type} streamed successfully`);
    return result;

  } catch (error) {
    console.error(`❌ Error streaming study ${node_type}:`, error);
    throw error;
  }
};

/**
 * Generate audio for a study mode node
 *
 * This is a streaming endpoint that returns progress updates and finally
 * the audio data (base64 encoded).
 *
 * @param {string} chat_id - Study session chat ID
 * @param {string} topic - Topic for the audio lesson
 * @param {string} intent - Intent type: "teach" | "summarize" | "deep_dive" | "simplify"
 * @param {number} duration - Duration in minutes (default: 2)
 * @param {string} language - Language for audio generation
 * @param {Function} onProgress - Callback for progress updates (optional)
 * @returns {Promise<Object>} - { audioBase64, topic, intent, script }
 */
export const generate_study_audio = async (
  chat_id,
  topic,
  intent = 'teach',
  duration = 2,
  language = 'en',
  onProgress = null
) => {
  const requestBody = JSON.stringify({
    chat_id: chat_id,
    topic: topic,
    intent: intent,
    duration: duration,
    language: language
  });

  try {
    devLog(`🎵 Generating study audio: ${topic}`);

    const response = await fetch(`${FAST_API_BASE}/study/generate-audio`, {
      method: "POST",
      headers: header,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Study audio generation failed: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = null;
    let buffer = ''; // Buffer to accumulate partial chunks

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Accumulate chunks in buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages (end with \n\n)
      const messages = buffer.split('\n\n');

      // Keep the last incomplete message in the buffer
      buffer = messages.pop() || '';

      for (const message of messages) {
        const lines = message.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);

              // Call progress callback if provided
              if (onProgress) {
                onProgress(data);
              }

              // Capture final result when audio is ready
              if (data.status === 'audio_ready') {
                devLog('🎵 Received audio_ready, audio size:', data.audio_base64?.length || 0);
                result = {
                  audioBase64: data.audio_base64,
                  audioDuration: data.audio_duration,
                  topic: data.topic,
                  intent: data.intent,
                  script: data.script
                };
              }

              // Handle errors
              if (data.status === 'audio_error') {
                throw new Error(data.message || 'Audio generation failed');
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete chunks unless it's our thrown error
              if (parseError.message && parseError.message.includes('generation failed')) {
                throw parseError;
              }
              // Only warn for non-empty lines
              if (line.trim().length > 10) {
                console.warn('Failed to parse SSE chunk (may be incomplete):', line.substring(0, 100) + '...');
              }
            }
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.status === 'audio_ready') {
              devLog('🎵 Received audio_ready from buffer, audio size:', data.audio_base64?.length || 0);
              result = {
                audioBase64: data.audio_base64,
                audioDuration: data.audio_duration,
                topic: data.topic,
                intent: data.intent,
                script: data.script
              };
            }
          } catch (e) {
            console.warn('Failed to parse final buffer');
          }
        }
      }
    }

    devLog(`✅ Study audio generated successfully, result:`, result ? 'has data' : 'no data');
    return result;

  } catch (error) {
    console.error(`❌ Error generating study audio:`, error);
    throw error;
  }
};

/**
 * Generate a concept map for a study mode node (streaming)
 *
 * @param {string} chat_id - Study session chat ID
 * @param {string} topic - Topic for the concept map
 * @param {string} depth - "shallow" | "medium" | "deep"
 * @param {string} language - Language for content
 * @param {Function} onProgress - Callback for progress updates (optional)
 * @returns {Promise<Object>} - { central_topic, nodes, edges }
 */
export const generate_study_mindmap = async (
  chat_id,
  topic,
  depth = 'medium',
  language = 'en',
  onProgress = null
) => {
  const requestBody = JSON.stringify({ chat_id, topic, depth, language });

  try {
    devLog(`🧠 Generating study mindmap: ${topic}`);

    const response = await fetch(`${FAST_API_BASE}/study/generate-mindmap`, {
      method: 'POST',
      headers: header,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Study mindmap generation failed: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = null;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split('\n\n');
      buffer = messages.pop() || '';

      for (const message of messages) {
        for (const line of message.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (onProgress) onProgress(data);

            if (data.status === 'mindmap_complete') {
              result = data.mindmap_data;
            }
            if (data.status === 'error') {
              throw new Error(data.message || 'Mindmap generation failed');
            }
          } catch (parseError) {
            if (parseError.message?.includes('generation failed')) throw parseError;
          }
        }
      }
    }

    devLog(`✅ Study mindmap generated successfully`);
    return result;

  } catch (error) {
    console.error(`❌ Error generating study mindmap:`, error);
    throw error;
  }
};

/**
 * Submit an answer for a study quiz question
 *
 * @param {string} chat_id - Study session chat ID
 * @param {string} node_id - Node ID of the quiz
 * @param {Object} answer - User's answer { selectedIndex: number }
 * @param {Object} question - The question data for validation
 * @returns {Promise<Object>} - Feedback { isCorrect, rationale, xpEarned }
 */
export const submit_study_answer = async (chat_id, node_id, answer, question) => {
  const requestBody = JSON.stringify({
    chat_id: chat_id,
    node_id: node_id,
    answer: answer,
    question: question
  });

  try {
    devLog("📤 Submitting study answer...");

    const response = await fetch(`${FAST_API_BASE}/study/submit-answer`, {
      method: "POST",
      headers: header,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Answer submission failed: ${response.status} - ${errorText}`);
    }

    const feedback = await response.json();
    devLog("✅ Answer feedback received");
    return feedback;

  } catch (error) {
    console.error("❌ Error submitting answer:", error);
    throw error;
  }
};