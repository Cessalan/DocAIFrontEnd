/**
 * Sound Effects Utility for Study Mode
 * Premium quality synthesized sounds using Web Audio API
 * Features: Convolution reverb, filtering, compression, rich harmonics
 */

// Audio context singleton
let audioContext = null;
// Convolution reverb impulse response (cached)
let reverbBuffer = null;

/**
 * Get or create the audio context
 */
const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

/**
 * Create a simple reverb impulse response
 */
const createReverbImpulse = (ctx, duration = 1.5, decay = 2.5) => {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      // Exponential decay with random noise
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
};

/**
 * Get or create reverb buffer
 */
const getReverbBuffer = (ctx) => {
  if (!reverbBuffer) {
    reverbBuffer = createReverbImpulse(ctx, 1.2, 3);
  }
  return reverbBuffer;
};

/**
 * Create a master output chain with compression and limiting
 */
const createMasterChain = (ctx) => {
  // Compressor for punch and consistency
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  // Master gain
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.8;

  // Connect chain
  compressor.connect(masterGain);
  masterGain.connect(ctx.destination);

  return { input: compressor, output: masterGain };
};

/**
 * Create a rich tone with harmonics (like a bell/chime)
 */
const createRichTone = (ctx, frequency, startTime, duration, volume = 0.3) => {
  const masterChain = createMasterChain(ctx);

  // Fundamental + harmonics for richness
  const harmonics = [
    { ratio: 1, gain: 1 },      // Fundamental
    { ratio: 2, gain: 0.5 },    // Octave
    { ratio: 3, gain: 0.25 },   // Fifth
    { ratio: 4, gain: 0.125 },  // 2nd octave
    { ratio: 5, gain: 0.1 },    // Major 3rd
  ];

  // Mix gain for all oscillators
  const mixGain = ctx.createGain();
  mixGain.gain.value = volume;
  mixGain.connect(masterChain.input);

  // Reverb send
  const convolver = ctx.createConvolver();
  convolver.buffer = getReverbBuffer(ctx);
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0.3; // Reverb mix amount
  convolver.connect(reverbGain);
  reverbGain.connect(masterChain.input);

  // Dry/wet mixer
  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.7;
  dryGain.connect(mixGain);

  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.3;
  wetGain.connect(convolver);

  harmonics.forEach(({ ratio, gain }) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.frequency.value = frequency * ratio;
    osc.type = 'sine';

    // Envelope
    oscGain.gain.setValueAtTime(0, startTime);
    oscGain.gain.linearRampToValueAtTime(gain, startTime + 0.008); // Fast attack
    oscGain.gain.exponentialRampToValueAtTime(gain * 0.6, startTime + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(oscGain);
    oscGain.connect(dryGain);
    oscGain.connect(wetGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
  });

  return masterChain;
};

/**
 * Play a "correct/success" sound - Premium satisfying chime!
 * Rich harmonics, reverb tail, punchy attack - maximum dopamine
 */
export const playCorrectSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // === MAIN CHIME - Rich bell-like tone ===
    createRichTone(ctx, 880, now, 0.6, 0.35); // A5

    // === SPARKLE LAYER - High shimmer ===
    const sparkleFreqs = [1760, 2217.46, 2637.02]; // A6, C#7, E7 (A major triad high)
    sparkleFreqs.forEach((freq, i) => {
      const delay = 0.03 + (i * 0.025);
      createRichTone(ctx, freq, now + delay, 0.3, 0.12 - (i * 0.03));
    });

    // === BASS LAYER - Warm foundation ===
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    const bassFilter = ctx.createBiquadFilter();

    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 400;
    bassFilter.Q.value = 1;

    bassOsc.frequency.value = 220; // A3
    bassOsc.type = 'sine';

    bassGain.gain.setValueAtTime(0, now);
    bassGain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(ctx.destination);

    bassOsc.start(now);
    bassOsc.stop(now + 0.25);

    // === IMPACT TRANSIENT - The "pop" ===
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseData.length, 8);
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 2;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.15;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseSource.start(now);

    // === ASCENDING GRACE NOTES ===
    const graceNotes = [1318.51, 1567.98, 1760]; // E6, G6, A6
    graceNotes.forEach((freq, i) => {
      const startTime = now + 0.08 + (i * 0.05);
      createRichTone(ctx, freq, startTime, 0.25, 0.08 - (i * 0.015));
    });

  } catch (e) {
    console.warn('Could not play correct sound:', e);
  }
};

/**
 * Play an "incorrect/try again" sound - Gentle, not punishing
 * Soft descending tone with warmth
 */
export const playIncorrectSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const masterChain = createMasterChain(ctx);

    // Soft descending tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(400, now + 0.2);
    filter.Q.value = 1;

    osc.frequency.setValueAtTime(392, now); // G4
    osc.frequency.linearRampToValueAtTime(293.66, now + 0.18); // D4
    osc.type = 'triangle'; // Softer than sine

    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    oscGain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(masterChain.input);

    // Add subtle second voice
    const osc2 = ctx.createOscillator();
    const osc2Gain = ctx.createGain();

    osc2.frequency.setValueAtTime(293.66, now); // D4
    osc2.frequency.linearRampToValueAtTime(220, now + 0.18); // A3
    osc2.type = 'sine';

    osc2Gain.gain.setValueAtTime(0, now);
    osc2Gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
    osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc2.connect(osc2Gain);
    osc2Gain.connect(masterChain.input);

    osc.start(now);
    osc.stop(now + 0.3);
    osc2.start(now);
    osc2.stop(now + 0.25);

  } catch (e) {
    console.warn('Could not play incorrect sound:', e);
  }
};

/**
 * Play a "celebration/completion" sound - Triumphant fanfare!
 * Rich ascending arpeggio with full reverb
 */
export const playCelebrationSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Triumphant C major arpeggio with extensions
    const notes = [
      { freq: 523.25, time: 0, duration: 0.8 },      // C5
      { freq: 659.25, time: 0.1, duration: 0.7 },    // E5
      { freq: 783.99, time: 0.2, duration: 0.6 },    // G5
      { freq: 1046.50, time: 0.3, duration: 0.8 },   // C6
      { freq: 1318.51, time: 0.4, duration: 0.6 },   // E6
    ];

    notes.forEach(({ freq, time, duration }) => {
      createRichTone(ctx, freq, now + time, duration, 0.25);
    });

    // Final chord - full C major
    const chordNotes = [523.25, 659.25, 783.99, 1046.50];
    chordNotes.forEach((freq) => {
      createRichTone(ctx, freq, now + 0.5, 1.2, 0.15);
    });

    // Victory shimmer
    for (let i = 0; i < 5; i++) {
      const shimmerFreq = 2000 + (i * 200);
      const shimmerTime = now + 0.55 + (i * 0.03);
      createRichTone(ctx, shimmerFreq, shimmerTime, 0.4, 0.05);
    }

  } catch (e) {
    console.warn('Could not play celebration sound:', e);
  }
};

/**
 * Play a "flip" sound - Satisfying card flip click
 */
export const playFlipSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Soft click using filtered noise
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseData.length, 10);
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.value = 0.2;

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noiseSource.start(now);

    // Subtle tonal element
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.03);
    osc.type = 'sine';

    oscGain.gain.setValueAtTime(0.1, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);

  } catch (e) {
    console.warn('Could not play flip sound:', e);
  }
};

/**
 * Play a "milestone" sound - Encouraging achievement chime
 */
export const playMilestoneSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two-note rising chime (perfect 5th)
    createRichTone(ctx, 659.25, now, 0.5, 0.3);      // E5
    createRichTone(ctx, 987.77, now + 0.12, 0.6, 0.35); // B5

    // Sparkle accent
    createRichTone(ctx, 1975.53, now + 0.18, 0.3, 0.1); // B6

  } catch (e) {
    console.warn('Could not play milestone sound:', e);
  }
};

// Export all sounds
export default {
  playCorrectSound,
  playIncorrectSound,
  playCelebrationSound,
  playFlipSound,
  playMilestoneSound
};
