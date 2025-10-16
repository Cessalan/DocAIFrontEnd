// VoiceCallButton.js - Complete rewrite of audio handling
import React, { useState, useRef } from 'react';
import './VoiceCallButton.css';
const VoiceCallButton = ({ chatId, language }) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Refs
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioWorkletNodeRef = useRef(null);
  const pcmBufferRef = useRef([]);
  
  const startCall = async () => {
    try {
      setIsConnecting(true);
      
      // 1. Create AudioContext
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000 // Match backend PCM rate
      });
      
      // 2. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      mediaStreamRef.current = stream;
      
      // 3. Connect to WebSocket
      const wsUrl = `ws://localhost:8000/voice/stream/${chatId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        
        // Send start message
        ws.send(JSON.stringify({
          type: "start",
          language: language || "en"
        }));
        
        // Start capturing microphone audio
        startMicrophoneCapture(stream, ws);
      };
      
      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          // Handle JSON messages (transcripts, status)
          const message = JSON.parse(event.data);
          console.log('📨 Message:', message);
          
          if (message.type === "ready") {
            setIsConnecting(false);
            setIsCallActive(true);
            console.log('✅ Voice session ready');
          } else if (message.type === "transcript") {
            console.log('📝 Transcript:', message.text);
            // Display transcript in UI
          } else if (message.type === "error") {
            console.error('❌ Error:', message.message);
            endCall();
          }
        } else if (event.data instanceof Blob) {
          // Handle audio data (raw PCM from Gemini)
          console.log('🔊 Received audio blob:', event.data.size, 'bytes');
          await playPCMAudio(event.data);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnecting(false);
        endCall();
      };
      
      ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        endCall();
      };
      
    } catch (error) {
      console.error('❌ Failed to start call:', error);
      setIsConnecting(false);
      endCall();
    }
  };
  
  const startMicrophoneCapture = (stream, ws) => {
    const audioContext = audioContextRef.current;
    const source = audioContext.createMediaStreamSource(stream);
    
    // Use ScriptProcessorNode (will replace with AudioWorklet later)
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      if (ws.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (PCM 16-bit)
        const pcmData = float32ToInt16(inputData);
        
        // Send to backend
        ws.send(pcmData.buffer);
      }
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
    audioWorkletNodeRef.current = processor;
  };
  
  const playPCMAudio = async (blob) => {
    try {
      const audioContext = audioContextRef.current;
      if (!audioContext || audioContext.state === 'closed') {
        console.error('AudioContext not available');
        return;
      }
      
      // Read blob as ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      
      // ⚠️ CRITICAL: Gemini sends raw PCM, not encoded audio
      // We need to create AudioBuffer directly from PCM data
      
      // Assume 16-bit PCM mono at 16kHz (check your backend!)
      const pcmData = new Int16Array(arrayBuffer);
      
      // Convert Int16 PCM to Float32 for Web Audio API
      const float32Data = int16ToFloat32(pcmData);
      
      // Create AudioBuffer
      const audioBuffer = audioContext.createBuffer(
        1, // mono
        float32Data.length,
        16000 // sample rate (must match backend)
      );
      
      // Copy data to buffer
      audioBuffer.getChannelData(0).set(float32Data);
      
      // Play the buffer
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
      
      console.log('✅ Playing audio chunk:', audioBuffer.duration.toFixed(2), 'seconds');
      
    } catch (error) {
      console.error('❌ Error playing audio:', error);
    }
  };
  
  const endCall = () => {
    console.log('🔚 Ending call...');
    
    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "end" }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Disconnect audio nodes
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    
    // Close AudioContext (with guard)
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsCallActive(false);
    setIsConnecting(false);
  };
  
  // Helper: Convert Float32 to Int16 PCM
  const float32ToInt16 = (float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  };
  
  // Helper: Convert Int16 PCM to Float32
  const int16ToFloat32 = (int16Array) => {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
    }
    return float32Array;
  };
  
  return (
    <div>
      {!isCallActive && !isConnecting && (
        <button onClick={startCall} className="voice-call-btn">
          🎤 Start Voice Call
        </button>
      )}
      
      {isConnecting && (
        <div className="connecting-indicator">
          🔄 Connecting...
        </div>
      )}
      
      {isCallActive && (
        <div className="active-call">
          <div className="call-status">
            🟢 Call Active
          </div>
          <button onClick={endCall} className="end-call-btn">
            ❌ End Call
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceCallButton;