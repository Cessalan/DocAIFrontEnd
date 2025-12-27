/**
 * Sound Effects Utility for Study Mode
 * Premium quality synthesized sounds using Web Audio API
 * Features: Convolution reverb, filtering, compression, rich harmonics
 */

// Import audio files
import correctAnswerSound from '../assets/correctanswer.wav';
import finishedSound from '../assets/finished.mp3';

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

// Cache the audio elements for reuse
let correctAudio = null;
let celebrationAudio = null;

/**
 * Play a "correct/success" sound - Uses the custom audio file
 */
export const playCorrectSound = () => {
  try {
    // Create audio element if not cached, or reset if exists
    if (!correctAudio) {
      correctAudio = new Audio(correctAnswerSound);
      correctAudio.volume = 0.7;
    }

    // Reset to beginning if already playing
    correctAudio.currentTime = 0;
    correctAudio.play().catch(e => {
      console.warn('Could not play correct sound:', e);
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
 * Play a "celebration/completion" sound - Uses the custom finished.mp3 file
 * Played when user completes a quiz, flashcard set, or lesson
 */
export const playCelebrationSound = () => {
  try {
    // Create audio element if not cached, or reset if exists
    if (!celebrationAudio) {
      celebrationAudio = new Audio(finishedSound);
      celebrationAudio.volume = 0.7;
    }

    // Reset to beginning if already playing
    celebrationAudio.currentTime = 0;
    celebrationAudio.play().catch(e => {
      console.warn('Could not play celebration sound:', e);
    });
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
