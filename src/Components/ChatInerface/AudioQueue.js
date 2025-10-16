/**
 * AudioQueue - Smooth, gap-free audio playback for streaming voice
 * 
 * Problem: Playing audio chunks immediately causes gaps/stutters
 * Solution: Queue chunks and schedule them precisely end-to-end
 */

class AudioQueue {
  constructor(audioContext, sampleRate = 24000) {
    this.audioContext = audioContext;
    this.sampleRate = sampleRate;
    this.queue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
    this.sourceNodes = []; // Track active sources for cleanup
    
    console.log(`🎵 AudioQueue initialized (${sampleRate}Hz)`);
  }

  /**
   * Add audio chunk to playback queue
   * @param {Blob} pcmBlob - Raw PCM audio data from backend
   */
  async addChunk(pcmBlob) {
    try {
      const arrayBuffer = await pcmBlob.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        console.warn('⚠️ Received empty audio chunk');
        return;
      }
      
      // Convert raw PCM bytes to Int16Array
      const pcmData = new Int16Array(arrayBuffer);
      
      // Convert Int16 PCM to Float32 (Web Audio API format)
      const float32Data = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        const sample = pcmData[i];
        // Proper normalization: -32768 to 32767 → -1.0 to 1.0
        float32Data[i] = sample < 0 ? sample / 32768 : sample / 32767;
      }
      
      // Create AudioBuffer
      const audioBuffer = this.audioContext.createBuffer(
        1,  // mono
        float32Data.length,
        this.sampleRate
      );
      audioBuffer.getChannelData(0).set(float32Data);
      
      const durationMs = (audioBuffer.duration * 1000).toFixed(0);
      console.log(`🎵 Queued audio: ${durationMs}ms (${pcmData.length} samples)`);
      
      // Add to queue
      this.queue.push(audioBuffer);
      
      // Start playback if not already playing
      if (!this.isPlaying) {
        this.playNext();
      }
      
    } catch (error) {
      console.error('❌ Error adding audio chunk:', error);
    }
  }

  /**
   * Play next chunk in queue (called automatically)
   */
  playNext() {
    // Check if queue is empty
    if (this.queue.length === 0) {
      this.isPlaying = false;
      console.log('🎵 Playback queue empty');
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.queue.shift();
    
    // Create audio source
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    // Calculate precise start time (no gaps!)
    const now = this.audioContext.currentTime;
    const startTime = Math.max(now, this.nextStartTime);
    
    // Schedule playback
    source.start(startTime);
    
    // Update next start time for seamless transition
    this.nextStartTime = startTime + audioBuffer.duration;
    
    // Track active source for cleanup
    this.sourceNodes.push(source);
    
    // Play next chunk when this one ends
    source.onended = () => {
      // Remove from active sources
      const index = this.sourceNodes.indexOf(source);
      if (index > -1) {
        this.sourceNodes.splice(index, 1);
      }
      
      // Continue playback
      this.playNext();
    };
    
    const queueLength = this.queue.length;
    const bufferDuration = (audioBuffer.duration * 1000).toFixed(0);
    console.log(`▶️ Playing chunk (${bufferDuration}ms) | Queue: ${queueLength} chunks`);
  }

  /**
   * Clear queue and stop playback
   */
  clear() {
    console.log('🛑 Clearing audio queue');
    
    // Stop all active sources
    this.sourceNodes.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    
    this.sourceNodes = [];
    this.queue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
  }

  /**
   * Get current queue state (for debugging)
   */
  getStats() {
    const bufferedDuration = this.queue.reduce((sum, buffer) => {
      return sum + buffer.duration;
    }, 0);
    
    return {
      queueLength: this.queue.length,
      bufferedSeconds: bufferedDuration.toFixed(2),
      isPlaying: this.isPlaying,
      activeSources: this.sourceNodes.length
    };
  }
}

export default AudioQueue;