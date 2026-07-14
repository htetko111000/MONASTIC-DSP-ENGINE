/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VoiceLayer {
  id: number;
  name: string;
  enabled: boolean;
  pitchShift: number; // semitones (e.g., -1.5)
  delayMs: number;    // delay in milliseconds
  pan: number;        // -1 (left) to +1 (right)
  gain: number;       // 0 to 1
  driftSpeed: number; // minor speed adjustment for unison chorus effect (%)
}

export const DEFAULT_LAYERS: VoiceLayer[] = [
  {
    id: 1,
    name: "Monk 1 (Original Center)",
    enabled: true,
    pitchShift: 0,
    delayMs: 0,
    pan: 0,
    gain: 1.0,
    driftSpeed: 100, // 100% speed
  },
  {
    id: 2,
    name: "Monk 2 (Deeper Left)",
    enabled: true,
    pitchShift: -1.8,
    delayMs: 15,
    pan: -0.45,
    gain: 0.9,
    driftSpeed: 98.5, // 98.5% speed
  },
  {
    id: 3,
    name: "Monk 3 (Warm Right)",
    enabled: true,
    pitchShift: -0.8,
    delayMs: 25,
    pan: 0.45,
    gain: 0.95,
    driftSpeed: 99.2, // 99.2% speed
  },
  {
    id: 4,
    name: "Monk 4 (Deep Left-Center)",
    enabled: true,
    pitchShift: -2.6,
    delayMs: 32,
    pan: -0.2,
    gain: 0.85,
    driftSpeed: 97.8, // 97.8% speed
  },
  {
    id: 5,
    name: "Monk 5 (Resonant Right-Center)",
    enabled: true,
    pitchShift: -1.2,
    delayMs: 40,
    pan: 0.2,
    gain: 0.88,
    driftSpeed: 98.9, // 98.9% speed
  }
];

export interface ReverbPreset {
  name: string;
  decayTime: number;
  damping: number;
  wet: number;
  dry: number;
}

export const REVERB_PRESETS: Record<string, ReverbPreset> = {
  dhamma_hall: {
    name: "Dhamma Hall (Large & Majestic)",
    decayTime: 3.5,
    damping: 0.35,
    wet: 0.45,
    dry: 0.85,
  },
  cave_temple: {
    name: "Sacred Cave Temple (Deep & Stone)",
    decayTime: 5.5,
    damping: 0.2,
    wet: 0.55,
    dry: 0.75,
  },
  monastery: {
    name: "Monastery Chanting Room (Medium)",
    decayTime: 1.8,
    damping: 0.45,
    wet: 0.35,
    dry: 0.9,
  },
  dry: {
    name: "No Reverb (Dry Studio)",
    decayTime: 0.1,
    damping: 0.9,
    wet: 0.0,
    dry: 1.0,
  }
};

/**
 * Generates an algorithmic stereo impulse response for realistic reverb simulation.
 * Avoids loading heavy external audio assets.
 */
export function createReverbImpulseResponse(
  sampleRate: number,
  decayTime: number,
  damping: number
): AudioBuffer {
  const length = Math.floor(sampleRate * decayTime);
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  
  // exponential decay envelope
  for (let i = 0; i < length; i++) {
    const pct = i / length;
    // Exponential decay (RT60: sound decays by 60dB)
    const decay = Math.exp(-pct * 7); 
    
    // White noise for left/right to create wider stereo image
    const noiseL = Math.random() * 2 - 1;
    const noiseR = Math.random() * 2 - 1;
    
    left[i] = noiseL * decay;
    right[i] = noiseR * decay;
  }
  
  // High-frequency absorption simulation (1-pole lowpass filter damping)
  let prevL = 0;
  let prevR = 0;
  for (let i = 0; i < length; i++) {
    const pct = i / length;
    // As the reverb tails off, higher frequencies are absorbed more rapidly
    const currentDamping = damping + (1.0 - damping) * pct * 0.5;
    
    left[i] = left[i] * (1 - currentDamping) + prevL * currentDamping;
    right[i] = right[i] * (1 - currentDamping) + prevR * currentDamping;
    
    prevL = left[i];
    prevR = right[i];
  }
  
  return impulse;
}

/**
 * Creates a beautiful, deep meditative throat chanting hum/drone
 * to allow instant client-side testing without uploading a file.
 */
export function generateSyntheticChant(sampleRate: number, duration: number): AudioBuffer {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buffer = audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  
  // Base frequency G2 (approx 98Hz) - classic deep Buddhist chant fundamental
  const baseFreq = 98.0;
  
  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    
    // Fine-grained natural frequency wobble (throat micro-modulations)
    const microWobble = Math.sin(2 * Math.PI * 5.2 * t) * 0.003 + Math.sin(2 * Math.PI * 1.5 * t) * 0.002;
    const currentBase = baseFreq * (1 + microWobble);
    
    // Sum multiple resonant harmonics to build a rich vocal throat texture ('u' / 'o' format)
    const f1 = Math.sin(2 * Math.PI * currentBase * t);                // Fundamental
    const f2 = Math.sin(2 * Math.PI * (currentBase * 2) * t) * 0.6;     // Octave (Throat baritone)
    const f3 = Math.sin(2 * Math.PI * (currentBase * 3) * t) * 0.45;    // Fifth/harmonic (Resonant throat ring)
    const f4 = Math.sin(2 * Math.PI * (currentBase * 4) * t) * 0.25;    // Double octave
    const f5 = Math.sin(2 * Math.PI * (currentBase * 5) * t) * 0.15;    // Formant overtones
    const f6 = Math.sin(2 * Math.PI * (currentBase * 6) * t) * 0.08;    // Breath whistle
    
    // Blend throat frequencies
    let sample = f1 + f2 + f3 + f4 + f5 + f6;
    
    // Add an ultra-low sub-harmonic for chest resonance (G1, approx 49Hz)
    sample += Math.sin(2 * Math.PI * (currentBase / 2) * t) * 0.2;
    
    // Buddhist dynamic chanting swell (simulating rhythmic deep breathing - 4s cycle)
    const swell = 0.5 * Math.sin(2 * Math.PI * 0.25 * t) + 0.5;
    sample *= (0.45 + swell * 0.55);
    
    // Apply micro-noise for vocal breathiness/air friction
    const breathNoise = (Math.random() * 2 - 1) * 0.015;
    sample += breathNoise;
    
    // Fade in and fade out
    if (t < 1.0) {
      sample *= t; // Linear fade in over 1s
    } else if (t > duration - 1.5) {
      sample *= (duration - t) / 1.5; // Linear fade out over 1.5s
    }
    
    data[i] = sample * 0.22; // Scale volume to prevent clipping
  }
  
  return buffer;
}

/**
 * Renders the processed multi-voice group audio in-memory at high speed using OfflineAudioContext.
 */
export async function renderGroupChant(
  inputBuffer: AudioBuffer,
  layers: VoiceLayer[],
  reverbPreset: ReverbPreset,
  lowPassCutoff: number,
  highPassCutoff: number,
  onProgress?: (progress: number) => void
): Promise<AudioBuffer> {
  const sampleRate = inputBuffer.sampleRate;
  const duration = inputBuffer.duration;
  
  // Calculate maximum offset to avoid cutting off delayed layers
  const maxDelayS = Math.max(...layers.map(l => l.delayMs)) / 1000;
  // Include reverb tail in rendering time to prevent abrupt cutoff
  const tailS = reverbPreset.decayTime;
  const renderDuration = duration + maxDelayS + tailS;
  
  const offlineCtx = new OfflineAudioContext(
    2, // Stereo output
    Math.ceil(sampleRate * renderDuration),
    sampleRate
  );
  
  // Create master node structures
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.48, 0); // 48% scaling to leave headroom for summing layers
  
  // Equalizer Filters (High Pass & Low Pass) to warm the chanting
  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(lowPassCutoff, 0);
  lowpass.Q.setValueAtTime(0.7, 0);
  
  const highpass = offlineCtx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(highPassCutoff, 0);
  
  // Reverb Convolver Node
  const convolver = offlineCtx.createConvolver();
  const dryGain = offlineCtx.createGain();
  const wetGain = offlineCtx.createGain();
  
  if (reverbPreset.wet > 0) {
    const impulse = createReverbImpulseResponse(sampleRate, reverbPreset.decayTime, reverbPreset.damping);
    convolver.buffer = impulse;
    
    wetGain.gain.setValueAtTime(reverbPreset.wet, 0);
    dryGain.gain.setValueAtTime(reverbPreset.dry, 0);
  } else {
    wetGain.gain.setValueAtTime(0, 0);
    dryGain.gain.setValueAtTime(reverbPreset.dry, 0);
  }
  
  // Routing path:
  // Layers -> Lowpass -> Highpass -> MasterGain -> Split (Dry/Wet)
  // Dry -> Offline Output
  // Wet -> Convolver -> Offline Output
  
  highpass.connect(lowpass);
  lowpass.connect(masterGain);
  
  masterGain.connect(dryGain);
  dryGain.connect(offlineCtx.destination);
  
  if (reverbPreset.wet > 0) {
    masterGain.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(offlineCtx.destination);
  }
  
  // Setup and feed individual voice layers
  layers.forEach((layer) => {
    if (!layer.enabled) return;
    
    // Buffer Source
    const source = offlineCtx.createBufferSource();
    source.buffer = inputBuffer;
    
    // Apply organic chorus drift or lock-step
    // driftSpeed adjusts speed: slower = lower pitch, faster = higher pitch
    const speedRatio = layer.driftSpeed / 100;
    source.playbackRate.setValueAtTime(speedRatio, 0);
    
    // Apply static micro-delay
    const delayNode = offlineCtx.createDelay(3.0);
    delayNode.delayTime.setValueAtTime(layer.delayMs / 1000, 0);
    
    // Apply Panning
    const panner = offlineCtx.createStereoPanner();
    panner.pan.setValueAtTime(layer.pan, 0);
    
    // Apply Layer volume gain
    const layerGain = offlineCtx.createGain();
    layerGain.gain.setValueAtTime(layer.gain, 0);
    
    // Route layer: Source -> Delay -> Panner -> LayerGain -> Highpass Filter
    source.connect(delayNode);
    delayNode.connect(panner);
    panner.connect(layerGain);
    layerGain.connect(highpass);
    
    // Start playback (accounting for speed-stretching duration)
    source.start(0);
  });
  
  // Track rendering progress
  if (onProgress) {
    const progressInterval = setInterval(() => {
      // OfflineAudioContext has no native progress event, so we approximate
      // based on typical fast rendering times or simple timers.
      // But OfflineAudioContext rendering is so fast that we can simulate it quickly
      // or just rely on a completion callback.
    }, 100);
    
    offlineCtx.oncomplete = () => {
      clearInterval(progressInterval);
      onProgress(100);
    };
  }
  
  // Render
  return await offlineCtx.startRendering();
}

/**
 * Encodes an AudioBuffer into a high-quality stereo 16-bit PCM WAV blob.
 */
export function bufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = PCM
  const bitDepth = 16;
  
  let result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferLength = result.length * 2;
  const fileLength = bufferLength + 44;
  const arrayBuffer = new ArrayBuffer(fileLength);
  const view = new DataView(arrayBuffer);
  
  // RIFF identifier
  writeString(view, 0, "RIFF");
  // file length
  view.setUint32(4, fileLength - 8, true);
  // RIFF type
  writeString(view, 8, "WAVE");
  // format chunk identifier
  writeString(view, 12, "fmt ");
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, "data");
  // data chunk length
  view.setUint32(40, bufferLength, true);
  
  // Write the actual audio samples
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
