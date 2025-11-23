import { auth } from '../Firebase/config';
import { API_BASE_URL } from './config';

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
    
    console.log("Request sent to Fast API:",requestBody);
    
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

  console.log("Request sent to FastAPI /chat/stream:", requestBody);

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
          console.log("Stream complete.");
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
                    // console.log(' Received chunk:', jsonChunk);
                    // console.log(' Timestamp:', Date.now());
                  onTokenReceived(jsonChunk.answer_chunk);
              }
              else if(jsonChunk.html)
              {
                console.log("I GOT THE HTML",jsonChunk.html);
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

    console.log("EMBED RESULT " + vectors);

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
    
    // Prepare FormData
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file); // 'files' plural matches backend
    });
    formData.append('chat_id', chatId);
    formData.append('user_id', auth.currentUser?.uid || '');
    formData.append('language',language)

    // Send request
    const response = await fetch(`${FAST_API_BASE}/chat/upload-files`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }

    // Read streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    const results = {
      files: new Map(), // file_id -> file data
      totalWords: 0,
      completed: 0,
      total: files.length
    };

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const update = JSON.parse(line);
          
          // Call progress callback
          if (onProgress) {
            onProgress(update);
          }
          
          // Track completions
          if (update.type === 'file_complete') {
            results.files.set(update.file_id, update);
            results.totalWords += update.word_count || 0;
            results.completed += 1;
          }
          
          // Handle errors
          if (update.type === 'error') {
            throw new Error(update.message);
          }
          
        } catch (parseError) {
          console.error('Failed to parse upload update:', line, parseError);
        }
      }
    }

    return results;

  } catch (error) {
    console.error('Upload error in FastAPICalls:', error);
    throw error;
  }
};
export const generate_title = async(message) => {

  const requestBody = JSON.stringify({
    message:message || ""
  });
  try{

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

  }catch(error)
  {
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

    console.log("generate_summary API Request started");
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
    console.log("Fast API response quiz generation: ", summary_json)
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
  
    console.log("Request sent to FastAPI /chat/generate-summary (STREAMING):", requestBody);
  
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
            console.log("Summary stream complete.");
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

export const generate_quiz = async(chat_id, file_name,currentLanguage) => {

   const requestBody = JSON.stringify({
    chat_id:chat_id,
    filename:file_name,
    quiz_type: "mcq",
    num_questions :15,
    language:currentLanguage
  });

  try{
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
    console.log("Fast API response quiz generation: ", quiz_json)
    return quiz_json;

  }catch(error)
  {
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
    console.log("Fast API response flashcard generation: ", flashcard_json);
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

    console.log("generate_scenario API Request started");
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
    console.log("Fast API response scenario generation: ", scenario_json)
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