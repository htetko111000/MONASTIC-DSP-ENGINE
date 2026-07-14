/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Play, 
  Pause, 
  Square, 
  Download, 
  Volume2, 
  Sliders, 
  Music, 
  Check, 
  Copy, 
  RefreshCw, 
  Layers, 
  Sparkles, 
  HelpCircle,
  Code,
  FileCode,
  Compass,
  ArrowRight
} from "lucide-react";
import AudioVisualizer from "./components/AudioVisualizer";
import { 
  DEFAULT_LAYERS, 
  REVERB_PRESETS, 
  VoiceLayer, 
  createReverbImpulseResponse, 
  generateSyntheticChant, 
  renderGroupChant, 
  bufferToWav 
} from "./utils/audioProcessor";

export default function App() {
  // Tabs: 'studio' or 'api'
  const [activeTab, setActiveTab] = useState<"studio" | "api">("studio");

  // Audio State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isSynthesized, setIsSynthesized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Real-time Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [masterVolume, setMasterVolume] = useState<number>(0.8);
  
  // Live Node References for Sliders
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  // Live effect nodes references (for real-time slider changes)
  const liveNodesRef = useRef<{
    gainNodes: GainNode[];
    pannerNodes: StereoPannerNode[];
    delayNodes: DelayNode[];
    lowpassFilter: BiquadFilterNode | null;
    highpassFilter: BiquadFilterNode | null;
    masterGainNode: GainNode | null;
    dryGainNode: GainNode | null;
    wetGainNode: GainNode | null;
  } | null>(null);

  // FX Parameters State
  const [layers, setLayers] = useState<VoiceLayer[]>(DEFAULT_LAYERS);
  const [selectedReverb, setSelectedReverb] = useState<string>("dhamma_hall");
  const [reverbDecay, setReverbDecay] = useState<number>(3.5);
  const [reverbWet, setReverbWet] = useState<number>(0.45);
  const [reverbDry, setReverbDry] = useState<number>(0.85);
  const [lowPassCutoff, setLowPassCutoff] = useState<number>(2500); // 2.5kHz warm cutoff
  const [highPassCutoff, setHighPassCutoff] = useState<number>(85);   // 85Hz sub-rumble cutoff

  // Rendering State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string>("");

  // Copy python code state
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Synchronize Reverb State with Preset
  useEffect(() => {
    const preset = REVERB_PRESETS[selectedReverb];
    if (preset) {
      setReverbDecay(preset.decayTime);
      setReverbWet(preset.wet);
      setReverbDry(preset.dry);
    }
  }, [selectedReverb]);

  // Handle live Web Audio parameter changes in real-time
  useEffect(() => {
    if (!audioCtxRef.current || !liveNodesRef.current) return;
    const ctx = audioCtxRef.current;
    const nodes = liveNodesRef.current;

    // Update filters
    if (nodes.lowpassFilter) {
      nodes.lowpassFilter.frequency.setValueAtTime(lowPassCutoff, ctx.currentTime);
    }
    if (nodes.highpassFilter) {
      nodes.highpassFilter.frequency.setValueAtTime(highPassCutoff, ctx.currentTime);
    }

    // Update master dry/wet gain
    if (nodes.masterGainNode) {
      nodes.masterGainNode.gain.setValueAtTime(masterVolume, ctx.currentTime);
    }
    if (nodes.dryGainNode) {
      nodes.dryGainNode.gain.setValueAtTime(reverbDry, ctx.currentTime);
    }
    if (nodes.wetGainNode) {
      nodes.wetGainNode.gain.setValueAtTime(reverbWet, ctx.currentTime);
    }

    // Update individual voice layers
    layers.forEach((layer, idx) => {
      if (idx < nodes.gainNodes.length) {
        nodes.gainNodes[idx].gain.setValueAtTime(
          layer.enabled ? layer.gain : 0, 
          ctx.currentTime
        );
      }
      if (idx < nodes.pannerNodes.length) {
        nodes.pannerNodes[idx].pan.setValueAtTime(layer.pan, ctx.currentTime);
      }
      if (idx < nodes.delayNodes.length) {
        nodes.delayNodes[idx].delayTime.setValueAtTime(layer.delayMs / 1000, ctx.currentTime);
      }
    });
  }, [layers, reverbDry, reverbWet, lowPassCutoff, highPassCutoff, masterVolume]);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  // Preset quick triggers
  const applyPreset = (presetName: string) => {
    if (presetName === "saffron") {
      setLayers([
        { id: 1, name: "Monk 1 (Original Center)", enabled: true, pitchShift: 0, delayMs: 0, pan: 0, gain: 1.0, driftSpeed: 100 },
        { id: 2, name: "Monk 2 (Deeper Left)", enabled: true, pitchShift: -2.0, delayMs: 18, pan: -0.5, gain: 0.95, driftSpeed: 98.2 },
        { id: 3, name: "Monk 3 (Warm Right)", enabled: true, pitchShift: -1.0, delayMs: 28, pan: 0.5, gain: 0.95, driftSpeed: 99.0 },
        { id: 4, name: "Monk 4 (Deep Left-Center)", enabled: true, pitchShift: -3.0, delayMs: 36, pan: -0.22, gain: 0.9, driftSpeed: 97.4 },
        { id: 5, name: "Monk 5 (Resonant Right-Center)", enabled: true, pitchShift: -1.5, delayMs: 44, pan: 0.22, gain: 0.92, driftSpeed: 98.7 }
      ]);
      setSelectedReverb("dhamma_hall");
      setLowPassCutoff(2200); // warm low chant filter
    } else if (presetName === "duet") {
      setLayers([
        { id: 1, name: "Monk 1 (Original Center)", enabled: true, pitchShift: 0, delayMs: 0, pan: -0.35, gain: 1.0, driftSpeed: 100 },
        { id: 2, name: "Monk 2 (Deeper Left)", enabled: true, pitchShift: 0, delayMs: 20, pan: 0.35, gain: 1.0, driftSpeed: 100 },
        { id: 3, name: "Monk 3 (Warm Right)", enabled: false, pitchShift: -0.8, delayMs: 25, pan: 0.45, gain: 0, driftSpeed: 99.2 },
        { id: 4, name: "Monk 4 (Deep Left-Center)", enabled: false, pitchShift: -2.6, delayMs: 32, pan: -0.2, gain: 0, driftSpeed: 97.8 },
        { id: 5, name: "Monk 5 (Resonant Right-Center)", enabled: false, pitchShift: -1.2, delayMs: 40, pan: 0.2, gain: 0, driftSpeed: 98.9 }
      ]);
      setSelectedReverb("monastery");
      setLowPassCutoff(3000);
    } else if (presetName === "trio") {
      setLayers([
        { id: 1, name: "Monk 1 (Original Center)", enabled: true, pitchShift: 0, delayMs: 0, pan: -0.4, gain: 1.0, driftSpeed: 100 },
        { id: 2, name: "Monk 2 (Deeper Left)", enabled: true, pitchShift: 0, delayMs: 20, pan: 0, gain: 1.0, driftSpeed: 100 },
        { id: 3, name: "Monk 3 (Warm Right)", enabled: true, pitchShift: 0, delayMs: 40, pan: 0.4, gain: 1.0, driftSpeed: 100 },
        { id: 4, name: "Monk 4 (Deep Left-Center)", enabled: false, pitchShift: -2.6, delayMs: 32, pan: -0.2, gain: 0, driftSpeed: 97.8 },
        { id: 5, name: "Monk 5 (Resonant Right-Center)", enabled: false, pitchShift: -1.2, delayMs: 40, pan: 0.2, gain: 0, driftSpeed: 98.9 }
      ]);
      setSelectedReverb("monastery");
      setLowPassCutoff(2800);
    } else if (presetName === "cave") {
      setLayers([
        { id: 1, name: "Monk 1 (Original Center)", enabled: true, pitchShift: 0, delayMs: 0, pan: 0, gain: 0.9, driftSpeed: 100 },
        { id: 2, name: "Monk 2 (Deeper Left)", enabled: true, pitchShift: -2.5, delayMs: 25, pan: -0.6, gain: 0.9, driftSpeed: 97.5 },
        { id: 3, name: "Monk 3 (Warm Right)", enabled: true, pitchShift: -1.2, delayMs: 35, pan: 0.6, gain: 0.9, driftSpeed: 99.1 },
        { id: 4, name: "Monk 4 (Deep Left-Center)", enabled: true, pitchShift: -3.5, delayMs: 48, pan: -0.3, gain: 0.85, driftSpeed: 96.8 },
        { id: 5, name: "Monk 5 (Resonant Right-Center)", enabled: true, pitchShift: -2.0, delayMs: 55, pan: 0.3, gain: 0.85, driftSpeed: 98.2 }
      ]);
      setSelectedReverb("cave_temple");
      setLowPassCutoff(1800); // very deep dark resonant cave acoustics
    } else {
      setLayers(DEFAULT_LAYERS);
      setSelectedReverb("dhamma_hall");
      setLowPassCutoff(2500);
    }
    // Clear any previous exported blob to encourage re-rendering with new preset
    setExportedBlob(null);
  };

  // Web Audio File Loader
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopPlayback();
    setAudioFile(file);
    setIsSynthesized(false);
    setIsLoading(true);
    setExportedBlob(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Initialize an AudioContext for decoding
      const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
      
      setAudioBuffer(decodedBuffer);
      setTotalDuration(decodedBuffer.duration);
      setCurrentTime(0);
      pausedTimeRef.current = 0;
    } catch (error) {
      console.error("Error decoding audio file:", error);
      alert("Failed to decode audio file. Please upload a standard MP3 or WAV file.");
    } finally {
      setIsLoading(false);
    }
  };

  // Synthesize Meditation throat chant for direct testing
  const handleSynthesizeChant = () => {
    stopPlayback();
    setIsLoading(true);
    setIsSynthesized(true);
    setAudioFile(null);
    setExportedBlob(null);

    setTimeout(() => {
      try {
        const sampleRate = 44100;
        const duration = 12.0; // 12 seconds high-quality demo drone
        const buffer = generateSyntheticChant(sampleRate, duration);
        
        setAudioBuffer(buffer);
        setTotalDuration(duration);
        setCurrentTime(0);
        pausedTimeRef.current = 0;
      } catch (err) {
        console.error("Synthesizer failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 600);
  };

  // Real-time Playback Play/Pause Toggle
  const togglePlayback = async () => {
    if (!audioBuffer) return;

    if (isPlaying) {
      pausePlayback();
    } else {
      await startPlayback();
    }
  };

  const startPlayback = async () => {
    // Instantiate persistent AudioContext if not present
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Stop existing nodes just in case
    stopActiveNodes();

    // Setup Analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Master Gain & Tone Filters
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(lowPassCutoff, ctx.currentTime);

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(highPassCutoff, ctx.currentTime);

    // Reverb Convolver setup
    const convolver = ctx.createConvolver();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();

    const activePreset = REVERB_PRESETS[selectedReverb];
    if (activePreset && activePreset.wet > 0) {
      const impulse = createReverbImpulseResponse(ctx.sampleRate, reverbDecay, activePreset.damping);
      convolver.buffer = impulse;
      wetGain.gain.setValueAtTime(reverbWet, ctx.currentTime);
      dryGain.gain.setValueAtTime(reverbDry, ctx.currentTime);
    } else {
      wetGain.gain.setValueAtTime(0, ctx.currentTime);
      dryGain.gain.setValueAtTime(reverbDry, ctx.currentTime);
    }

    // Node Connections for spatial mix
    // Layers -> Lowpass -> Highpass -> MasterGain -> Split (Dry/Wet)
    // Dry -> Analyser -> Output
    // Wet -> Convolver -> WetGain -> Analyser -> Output
    highpass.connect(lowpass);
    lowpass.connect(masterGain);

    masterGain.connect(dryGain);
    dryGain.connect(analyser);

    if (activePreset && activePreset.wet > 0) {
      masterGain.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(analyser);
    }

    analyser.connect(ctx.destination);

    // Create tracking nodes
    const liveGainNodes: GainNode[] = [];
    const livePannerNodes: StereoPannerNode[] = [];
    const liveDelayNodes: DelayNode[] = [];
    const sourceNodes: AudioBufferSourceNode[] = [];

    // Play layers starting from paused offset
    const offset = pausedTimeRef.current;
    const startTime = ctx.currentTime + 0.05; // 50ms in the future for sample-accurate sync across all nodes
    playbackStartTimeRef.current = startTime - offset;

    layers.forEach((layer) => {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Unison drift playbackRate adjustments
      const speedRatio = layer.driftSpeed / 100;
      source.playbackRate.setValueAtTime(speedRatio, startTime);

      const delayNode = ctx.createDelay(3.0);
      delayNode.delayTime.setValueAtTime(layer.delayMs / 1000, startTime);

      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(layer.pan, startTime);

      const layerGain = ctx.createGain();
      layerGain.gain.setValueAtTime(layer.enabled ? layer.gain : 0, startTime);

      // Routing: Source -> Delay -> Panner -> Gain -> Highpass Filter
      source.connect(delayNode);
      delayNode.connect(panner);
      panner.connect(layerGain);
      layerGain.connect(highpass);

      // Start play at adjusted offset to prevent sync drift on resume
      const adjustedOffset = offset * speedRatio;
      source.start(startTime, adjustedOffset);
      
      sourceNodes.push(source);
      liveGainNodes.push(layerGain);
      livePannerNodes.push(panner);
      liveDelayNodes.push(delayNode);
    });

    activeSourceNodesRef.current = sourceNodes;
    liveNodesRef.current = {
      gainNodes: liveGainNodes,
      pannerNodes: livePannerNodes,
      delayNodes: liveDelayNodes,
      lowpassFilter: lowpass,
      highpassFilter: highpass,
      masterGainNode: masterGain,
      dryGainNode: dryGain,
      wetGainNode: wetGain,
    };

    setIsPlaying(true);

    // Periodic UI Time Update
    timerRef.current = window.setInterval(() => {
      if (!audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - playbackStartTimeRef.current;
      if (elapsed >= totalDuration) {
        stopPlayback();
      } else {
        setCurrentTime(elapsed);
      }
    }, 50);
  };

  const pausePlayback = () => {
    if (!isPlaying) return;
    
    if (audioCtxRef.current) {
      pausedTimeRef.current = audioCtxRef.current.currentTime - playbackStartTimeRef.current;
    }
    stopActiveNodes();
    setIsPlaying(false);
  };

  const stopPlayback = () => {
    pausedTimeRef.current = 0;
    setCurrentTime(0);
    stopActiveNodes();
    setIsPlaying(false);
  };

  const stopActiveNodes = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    activeSourceNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch (e) {}
    });
    activeSourceNodesRef.current = [];
    analyserRef.current = null;
    liveNodesRef.current = null;
  };

  // Drag and Drop Zone triggers
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.includes("audio") || file.name.endsWith(".mp3") || file.name.endsWith(".wav")) {
        stopPlayback();
        setAudioFile(file);
        setIsSynthesized(false);
        setIsLoading(true);
        setExportedBlob(null);

        try {
          const arrayBuffer = await file.arrayBuffer();
          const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
          setAudioBuffer(decodedBuffer);
          setTotalDuration(decodedBuffer.duration);
          setCurrentTime(0);
          pausedTimeRef.current = 0;
        } catch (error) {
          alert("Error decoding file. Please make sure it is a valid audio MP3 or WAV file.");
        } finally {
          setIsLoading(false);
        }
      } else {
        alert("Please drop a valid audio file (MP3, WAV, etc.).");
      }
    }
  };

  // Offline Audio Context Exporter
  const handleExport = async () => {
    if (!audioBuffer) return;
    
    stopPlayback();
    setIsExporting(true);
    setExportProgress(10);
    setExportedBlob(null);

    try {
      setExportProgress(30);
      const activePreset = REVERB_PRESETS[selectedReverb];
      
      // Render
      const renderedBuffer = await renderGroupChant(
        audioBuffer,
        layers,
        activePreset,
        lowPassCutoff,
        highPassCutoff,
        (prog) => setExportProgress(prog)
      );
      
      setExportProgress(80);
      
      // Convert to WAV
      const wavBlob = bufferToWav(renderedBuffer);
      
      setExportProgress(95);
      
      const url = URL.createObjectURL(wavBlob);
      setExportedBlob(wavBlob);
      setExportedUrl(url);
      setExportProgress(100);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to render the group chanting. Please try again.");
    } finally {
      setTimeout(() => {
        setIsExporting(false);
      }, 500);
    }
  };

  const handleCopyCode = () => {
    const codeText = document.getElementById("python-code-block")?.innerText || "";
    navigator.clipboard.writeText(codeText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Convert seconds to clean display MM:SS
  const formatTime = (timeInSecs: number) => {
    const minutes = Math.floor(timeInSecs / 60);
    const seconds = Math.floor(timeInSecs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // standalone python script to display
  const pythonScriptCode = `import io
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydub import AudioSegment
from pedalboard import Pedalboard, Reverb
import soundfile as sf
import uvicorn

app = FastAPI(title="Buddhist Monk Group Chanting Generator API")

def shift_pitch(sound: AudioSegment, semitones: float) -> AudioSegment:
    # Shift pitch using sample-rate speed scaling (sounds highly organic for group chorus)
    new_sample_rate = int(sound.frame_rate * (2.0 ** (semitones / 12.0)))
    shifted = sound._spawn(sound.raw_data, overrides={'frame_rate': new_sample_rate})
    return shifted.set_frame_rate(sound.frame_rate)

@app.post("/api/process-chanting")
async def process_chanting(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.mp3', '.wav', '.m4a')):
        raise HTTPException(status_code=400, detail="Invalid audio format.")
    
    # 1. Load original chanter audio
    contents = await file.read()
    original = AudioSegment.from_file(io.BytesIO(contents)).set_channels(2)
    
    # 2. Duplicate and process layers with panning, delay, and pitch offsets
    # Layer 1: Original Center
    layer1 = original
    
    # Layer 2: Deeper Monk Voice, Panned Left, 15ms Delay
    layer2 = shift_pitch(original, -1.8).pan(-0.45)
    layer2 = AudioSegment.silent(duration=15) + layer2
    
    # Layer 3: Warm Monk Voice, Panned Right, 25ms Delay
    layer3 = shift_pitch(original, -0.8).pan(0.45)
    layer3 = AudioSegment.silent(duration=25) + layer3
    
    # Layer 4: Deep Baritone Monk Voice, Panned Left-Center, 32ms Delay
    layer4 = shift_pitch(original, -2.6).pan(-0.2)
    layer4 = AudioSegment.silent(duration=32) + layer4
    
    # Layer 5: Resonant Monk Voice, Panned Right-Center, 40ms Delay
    layer5 = shift_pitch(original, -1.2).pan(0.2)
    layer5 = AudioSegment.silent(duration=40) + layer5
    
    # 3. Sum layers & headroom offset
    mixed = layer1.overlay(layer2).overlay(layer3).overlay(layer4).overlay(layer5) - 4.5
    
    # 4. Export mix to memory & Apply Temple Reverb
    wav_io = io.BytesIO()
    mixed.export(wav_io, format="wav")
    wav_io.seek(0)
    
    audio_data, sample_rate = sf.read(wav_io)
    board = Pedalboard([
        Reverb(room_size=0.8, damping=0.35, wet_level=0.45, dry_level=0.85)
    ])
    effected = board(audio_data, sample_rate)
    
    # 5. Export back to high-quality MP3 for user download
    reverb_wav_io = io.BytesIO()
    sf.write(reverb_wav_io, effected, sample_rate, format='wav')
    reverb_wav_io.seek(0)
    
    final_audio = AudioSegment.from_wav(reverb_wav_io)
    output_mp3 = io.BytesIO()
    final_audio.export(output_mp3, format="mp3", bitrate="192k")
    output_mp3.seek(0)
    
    return StreamingResponse(
        output_mp3, 
        media_type="audio/mpeg", 
        headers={"Content-Disposition": f"attachment; filename=group_chanting.mp3"}
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)`;

  return (
    <div className="min-h-screen bg-[#0F1113] text-[#E0E0E0] flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Visual Header */}
      <header className="h-20 md:h-16 border-b border-white/10 bg-[#16181D] px-4 md:px-8 flex flex-col md:flex-row md:justify-between md:items-center justify-center gap-2 md:gap-0 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] font-mono text-amber-500 uppercase tracking-widest leading-none mb-1">
              သံဃသာမဂ္ဂီ ညီညီညာညာ ရွတ်ဆိုသံ / MONASTIC DSP ENGINE v1.1
            </span>
            <span className="text-xs md:text-sm font-bold uppercase tracking-widest leading-none text-white font-display">
              သံဃာတော်များ စုပေါင်းရွတ်ဆိုသံ ဖန်တီးစက်
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            id="tab-studio-btn"
            onClick={() => setActiveTab("studio")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all duration-200 border ${
              activeTab === "studio" 
                ? "bg-indigo-600/25 border-indigo-500/40 text-indigo-400 font-bold" 
                : "bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Compass size={13} />
            အပြန်အလှန်သုံး စတူဒီယို
          </button>
          <button 
            id="tab-api-btn"
            onClick={() => setActiveTab("api")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all duration-200 border ${
              activeTab === "api" 
                ? "bg-indigo-600/25 border-indigo-500/40 text-indigo-400 font-bold" 
                : "bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Code size={13} />
            Python API လမ်းညွှန်
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        
        {activeTab === "studio" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: SOURCE UPLOADER & AUDIO MASTER PLAYER */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              
              {/* Box 1: Audio Source Upload Zone */}
              <div id="source-upload-card" className="bg-[#16181D] p-6 rounded-xl border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2 font-display">
                  <Music size={14} />
                  ၁။ အသံဖိုင် တင်သွင်းရန်
                </h2>
                
                {/* Drag and Drop Box */}
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 relative ${
                    isDragActive ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 hover:border-indigo-500/40 bg-black/20"
                  }`}
                >
                  <input 
                    type="file" 
                    id="audio-file-input" 
                    accept="audio/mp3,audio/wav,audio/m4a,audio/mpeg" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-indigo-600/15 flex items-center justify-center text-indigo-400 mb-3 border border-indigo-500/20">
                      <Upload size={20} />
                    </div>
                    <p className="text-xs font-bold text-gray-200 mb-1 tracking-wide">
                      MP3 သို့မဟုတ် WAV ဖိုင်ကို ဆွဲထည့်ပါ
                    </p>
                    <p className="text-[10px] text-gray-400 mb-3">
                      သို့မဟုတ် ဤနေရာကိုနှိပ်၍ ရှာဖွေပါ
                    </p>
                    <div className="inline-block bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[9px] font-mono font-medium px-2 py-0.5 rounded">
                      ဗုဒ္ဓဘာသာ ပရိတ်တော် / သုတ်တော် အသံရင်းမြစ်
                    </div>
                  </div>
                </div>

                {/* Instant Meditative Throat Chant Synthesizer Demo Trigger */}
                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-[11px]">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Sparkles size={12} className="text-amber-500" />
                    ဖိုင်မရှိပါက ရင်ခေါင်းသံ ညည်းသံကို တိုက်ရိုက်ဖန်တီးပါ -
                  </span>
                  <button 
                    id="synth-demo-btn"
                    onClick={handleSynthesizeChant}
                    disabled={isLoading}
                    className="text-indigo-400 font-bold hover:text-indigo-300 flex items-center gap-1 font-mono transition-all duration-150 disabled:opacity-50"
                  >
                    {isLoading ? "ဖန်တီးနေပါသည်..." : "စမ်းသပ်ရွတ်ဆိုသံ စတင်ရန်"}
                    <ArrowRight size={11} />
                  </button>
                </div>

                {/* Current Source File Stats */}
                {audioBuffer && (
                  <div className="mt-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3.5 text-xs flex items-center justify-between animate-fade-in">
                    <div className="overflow-hidden pr-3">
                      <p className="font-bold text-gray-200 truncate">
                        {audioFile ? audioFile.name : "🧘 ဖန်တီးထားသော သံဃာတော်ရင်ခေါင်းသံညည်းသံ (Drone)"}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">
                        {formatTime(totalDuration)} | {audioBuffer.sampleRate}Hz | {audioBuffer.numberOfChannels} {audioBuffer.numberOfChannels === 1 ? "မိုနို" : "စတီရီယို"} အသံရင်းမြစ်
                      </p>
                    </div>
                    <span className="bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 font-mono text-[9px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
                      အဆင်သင့်ဖြစ်ပါပြီ
                    </span>
                  </div>
                )}
              </div>

              {/* Box 2: Master Audio Studio & Visualizer */}
              <div id="master-player-card" className="bg-[#16181D] p-6 rounded-xl border border-white/10 relative overflow-hidden flex-grow flex flex-col justify-between">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2 font-display">
                    <Sliders size={14} />
                    ၂။ ဓမ္မအသံနှင့် ဖွင့်စက် ဆက်တင်
                  </h2>

                  {/* Real-time Waveform Canvas */}
                  <div className="mb-4">
                    <AudioVisualizer analyser={analyserRef.current} isPlaying={isPlaying} />
                  </div>

                  {/* Playback Progress Scrubber */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1.5">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(totalDuration)}</span>
                    </div>
                    <div className="relative w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="absolute h-full bg-indigo-500 transition-all duration-100" 
                        style={{ width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Player Trigger Buttons */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2.5">
                      <button 
                        id="play-pause-btn"
                        onClick={togglePlayback}
                        disabled={!audioBuffer}
                        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all duration-200 ${
                          !audioBuffer 
                            ? "bg-gray-800 text-gray-600 cursor-not-allowed" 
                            : isPlaying 
                              ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/10" 
                              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
                        }`}
                        title={isPlaying ? "ရပ်ရန်" : "စုပေါင်းရွတ်ဆိုသံ ဖွင့်ရန်"}
                      >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-1" />}
                      </button>
                      
                      <button 
                        id="stop-btn"
                        onClick={stopPlayback}
                        disabled={!audioBuffer}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                          !audioBuffer 
                            ? "bg-gray-800/50 text-gray-600 cursor-not-allowed" 
                            : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5"
                        }`}
                        title="ရပ်တန့်ရန်"
                      >
                        <Square size={12} />
                      </button>
                    </div>

                    {/* Master Volume Gain */}
                    <div className="flex items-center space-x-2 w-1/2">
                      <Volume2 size={14} className="text-gray-400 shrink-0" />
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={masterVolume}
                        onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                        disabled={!audioBuffer}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
                      />
                      <span className="font-mono text-[10px] text-gray-400 w-6 text-right shrink-0">
                        {Math.round(masterVolume * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tone controls (High/Low pass filtering to simulate acoustic wall damping) */}
                <div className="border-t border-white/5 pt-4 mt-3">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-3 font-bold font-display">
                    နွေးထွေးသော သံဃာ့အသံ စစ်ထုတ်မှုစနစ်
                  </span>
                  
                  <div className="space-y-3.5">
                    {/* Low-pass cutoff */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-gray-300 flex items-center gap-1">
                          နွေးထွေးသော အသံနိမ့် စစ်ထုတ်မှု (Low-Pass Filter)
                          <span className="text-[10px] text-gray-500 font-mono">(စူးရှသော အသံမြင့်ဆူညံသံများကို လျှော့ချပေးသည်)</span>
                        </span>
                        <span className="font-mono text-gray-400">{lowPassCutoff} Hz</span>
                      </div>
                      <input 
                        type="range"
                        min="1000"
                        max="8000"
                        step="100"
                        value={lowPassCutoff}
                        onChange={(e) => setLowPassCutoff(parseInt(e.target.value))}
                        disabled={!audioBuffer}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
                      />
                    </div>

                    {/* High-pass cutoff */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-gray-300 flex items-center gap-1">
                          ကြည်လင်သော အသံမြင့် စစ်ထုတ်မှု (High-Pass Filter)
                          <span className="text-[10px] text-gray-500 font-mono">(ဝေဝါးသော အသံနောက်ခံများကို ဖယ်ရှားပေးသည်)</span>
                        </span>
                        <span className="font-mono text-gray-400">{highPassCutoff} Hz</span>
                      </div>
                      <input 
                        type="range"
                        min="40"
                        max="200"
                        step="5"
                        value={highPassCutoff}
                        onChange={(e) => setHighPassCutoff(parseInt(e.target.value))}
                        disabled={!audioBuffer}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 3: Studio Export & Download Section */}
              <div id="export-card" className="bg-[#16181D] p-6 rounded-xl border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2 font-display">
                  <Download size={14} />
                  ၃။ စုပေါင်းရွတ်ဆိုသံ ထုတ်ယူရန်
                </h2>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  သံဃာတော် ၅ ပါး၏ ရွတ်ဆိုသံနှင့် ဓမ္မာရုံ ပဲ့တင်သံများကို အရည်အသွေးမြင့် စတီရီယို ၁၆-ဘစ် WAV ဖိုင်အဖြစ် ပေါင်းစပ်ထုတ်ယူပါ။
                </p>

                {isExporting ? (
                  <div className="space-y-2 py-2">
                    <div className="flex justify-between text-xs text-gray-200 font-medium">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw size={13} className="animate-spin text-indigo-400" />
                        နောက်ခံစနစ်တွင် သံဃာတော်များ၏ အသံများကို စုပေါင်းပေါင်းစပ်နေပါသည်...
                      </span>
                      <span className="font-mono text-indigo-400">{exportProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-150" 
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </div>
                ) : exportedBlob ? (
                  <div className="space-y-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-lg text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold flex items-center gap-1">
                          <Check size={14} /> ထုတ်ယူခြင်း အောင်မြင်ပါသည်!
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1 font-mono">
                          ဖိုင်ဆိုဒ်: {Math.round(exportedBlob.size / 1024 / 1024 * 100) / 100} MB | PCM စတီရီယို ၁၆-ဘစ်
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          setExportedBlob(null);
                        }}
                        className="text-[10px] uppercase font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        ပြန်စရန်
                      </button>
                    </div>
                    <a 
                      id="download-chant-link"
                      href={exportedUrl}
                      download={audioFile ? `group_chanting_${audioFile.name.replace(/\.[^/.]+$/, "")}.wav` : "monks_group_chanting_studio.wav"}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Download size={14} />
                      အရည်အသွေးမြင့် စုပေါင်းရွတ်ဆိုသံကို ဒေါင်းလုဒ်လုပ်ရန်
                    </a>
                  </div>
                ) : (
                  <button 
                    id="export-chant-btn"
                    onClick={handleExport}
                    disabled={!audioBuffer}
                    className={`w-full py-3.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
                      !audioBuffer 
                        ? "bg-gray-800 text-gray-600 cursor-not-allowed" 
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10"
                    }`}
                  >
                    <Sliders size={14} />
                    အသံများကို ပေါင်းစပ်ပြီး ထုတ်ယူရန်
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: 5 VOICE LAYERS & REVERB CONFIGURATION */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              
              {/* Box 4: The Vocal Ensemble Layer Controls (The 5 Monks) */}
              <div id="monk-ensemble-card" className="bg-[#16181D] p-6 rounded-xl border border-white/10 relative">
                <div className="absolute top-5 right-5 flex flex-wrap gap-1.5 justify-end z-10">
                  <button 
                    id="preset-saffron-btn"
                    onClick={() => applyPreset("saffron")}
                    className="text-[10px] font-bold bg-black/40 hover:bg-black/60 border border-amber-500/20 text-amber-400 px-2.5 py-1 rounded transition-colors"
                  >
                    သံဃာတော်အသံပုံစံ
                  </button>
                  <button 
                    id="preset-cave-btn"
                    onClick={() => applyPreset("cave")}
                    className="text-[10px] font-bold bg-black/40 hover:bg-black/60 border border-red-500/20 text-red-400 px-2.5 py-1 rounded transition-colors"
                  >
                    ဂူအတွင်းရွတ်ဆိုသံ
                  </button>
                  <button 
                    id="preset-duet-btn"
                    onClick={() => applyPreset("duet")}
                    className="text-[10px] font-bold bg-black/40 hover:bg-black/60 border border-white/10 text-gray-300 px-2.5 py-1 rounded transition-colors"
                  >
                    နှစ်ပါးတွဲရွတ်ဆိုသံ
                  </button>
                  <button 
                    id="preset-trio-btn"
                    onClick={() => applyPreset("trio")}
                    className="text-[10px] font-bold bg-black/40 hover:bg-black/60 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded transition-colors"
                  >
                    သုံးပါးရွတ်ဆိုသံ
                  </button>
                </div>
 
                <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2 font-display pt-1">
                  <Layers size={14} />
                  ၄။ သံဃာတော်များ စုပေါင်းရွတ်ဆိုသံ အသံလွှာများ
                </h2>
 
                <p className="text-xs text-gray-400 mb-5 leading-relaxed">
                  ရွတ်ဆိုသံ တစ်ခုတည်းကို လွတ်လပ်သော အသံလွှာ ၅ ခုအဖြစ် ခွဲထုတ်ပါသည်။ သက်ကြီး၊ သက်ငယ် သံဃာတော်များ အတူတကွ ရွတ်ဆိုနေသကဲ့သို့ ဖြစ်စေရန် အသံတည်နေရာ၊ အချိန်ဆိုင်းငံ့မှု (ms) နှင့် အသံအနိမ့်အမြင့်များကို ချိန်ညှိပေးသည်။
                </p>
 
                {/* Layers Loop */}
                <div className="space-y-4">
                  {layers.map((layer, idx) => {
                    const leftBorderColor = idx === 0 
                      ? "border-l-indigo-500" 
                      : (idx === 1 || idx === 2) 
                        ? "border-l-amber-500" 
                        : "border-l-emerald-500";
                    const accentColor = idx === 0 
                      ? "accent-indigo-500" 
                      : (idx === 1 || idx === 2) 
                        ? "accent-amber-500" 
                        : "accent-emerald-500";
                    const badgeTextColor = idx === 0 
                      ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/25" 
                      : (idx === 1 || idx === 2) 
                        ? "text-amber-400 bg-amber-500/10 border-amber-500/25" 
                        : "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";

                    return (
                      <div 
                        key={layer.id} 
                        className={`p-4 rounded-xl border border-l-4 transition-all duration-200 ${leftBorderColor} ${
                          layer.enabled 
                            ? "bg-white/[0.02] border-white/10" 
                            : "bg-black/10 border-white/5 opacity-50"
                        }`}
                      >
                        {/* Top Header: Toggle state & Layer Identifier */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2.5">
                            <input 
                              type="checkbox"
                              checked={layer.enabled}
                              onChange={(e) => {
                                const newLayers = [...layers];
                                newLayers[idx].enabled = e.target.checked;
                                setLayers(newLayers);
                                setExportedBlob(null);
                              }}
                              className="w-4 h-4 text-indigo-600 border-white/10 bg-black/40 rounded focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                              {layer.name}
                              {idx === 0 && (
                                <span className="bg-white/5 border border-white/10 text-gray-400 text-[8px] font-mono font-medium px-1.5 py-0.5 rounded">
                                  ပင်မရွတ်ဆိုသံ (Core Chant)
                                </span>
                              )}
                            </span>
                          </div>
                          
                          {layer.enabled && (
                            <div className="flex items-center space-x-1.5 text-[9px] font-mono text-gray-400">
                              <span>အသံအနိမ့်အမြင့် (Pitch Shift): </span>
                              <span className={`font-bold ${badgeTextColor.split(" ")[0]}`}>
                                {layer.pitchShift > 0 ? "+" : ""}{layer.pitchShift} ဆီမီတုန်း
                              </span>
                            </div>
                          )}
                        </div>
 
                        {layer.enabled && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                            {/* Gain / Volume */}
                            <div className="md:col-span-1">
                              <label className="text-[10px] text-gray-400 font-medium block mb-1">အသံအတိုးအကျယ်</label>
                              <div className="flex items-center space-x-1.5">
                                <input 
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={layer.gain}
                                  onChange={(e) => {
                                    const newLayers = [...layers];
                                    newLayers[idx].gain = parseFloat(e.target.value);
                                    setLayers(newLayers);
                                    setExportedBlob(null);
                                  }}
                                  className={`w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer ${accentColor}`}
                                />
                                <span className="text-[10px] font-mono text-gray-400 shrink-0 w-8 text-right">
                                  {Math.round(layer.gain * 100)}%
                                </span>
                              </div>
                            </div>
 
                            {/* Delay ms */}
                            <div className="md:col-span-1">
                              <label className="text-[10px] text-gray-400 font-medium block mb-1">အသံတုန့်ပြန်မှု ကြာချိန်</label>
                              <div className="flex items-center space-x-1.5">
                                <input 
                                  type="range"
                                  min="0"
                                  max="2000"
                                  step="10"
                                  value={layer.delayMs}
                                  onChange={(e) => {
                                    const newLayers = [...layers];
                                    newLayers[idx].delayMs = parseInt(e.target.value);
                                    setLayers(newLayers);
                                    setExportedBlob(null);
                                  }}
                                  className={`w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer ${accentColor}`}
                                />
                                <span className="text-[10px] font-mono text-gray-400 shrink-0 w-12 text-right">
                                  {(layer.delayMs / 1000).toFixed(2)}s
                                </span>
                              </div>
                            </div>
 
                            {/* Stereo Panning */}
                            <div className="md:col-span-1">
                              <label className="text-[10px] text-gray-400 font-medium block mb-1">စတီရီယို ဘယ်/ညာ တည်နေရာ</label>
                              <div className="flex items-center space-x-1.5">
                                <input 
                                  type="range"
                                  min="-1"
                                  max="1"
                                  step="0.05"
                                  value={layer.pan}
                                  onChange={(e) => {
                                    const newLayers = [...layers];
                                    newLayers[idx].pan = parseFloat(e.target.value);
                                    setLayers(newLayers);
                                    setExportedBlob(null);
                                  }}
                                  className={`w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer ${accentColor}`}
                                />
                                <span className="text-[10px] font-mono text-gray-400 shrink-0 w-8 text-center font-bold">
                                  {layer.pan === 0 ? "C" : layer.pan < 0 ? `L${Math.round(Math.abs(layer.pan) * 10)}` : `R${Math.round(layer.pan * 10)}`}
                                </span>
                              </div>
                            </div>
 
                            {/* Pitch Speed Drift (Chorus Drift) */}
                            <div className="md:col-span-1">
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-gray-400 font-medium block">အသံနှုန်း လွင့်မျောမှု</label>
                                <span className={`text-[8px] font-mono font-medium px-1 rounded border ${badgeTextColor}`}>
                                  {layer.driftSpeed}% အမြန်နှုန်း
                                </span>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <input 
                                  type="range"
                                  min="95"
                                  max="105"
                                  step="0.1"
                                  value={layer.driftSpeed}
                                  onChange={(e) => {
                                    const newLayers = [...layers];
                                    newLayers[idx].driftSpeed = parseFloat(e.target.value);
                                    const shiftedRatio = newLayers[idx].driftSpeed / 100;
                                    newLayers[idx].pitchShift = Math.round(12 * Math.log2(shiftedRatio) * 10) / 10;
                                    setLayers(newLayers);
                                    setExportedBlob(null);
                                  }}
                                  className={`w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer ${accentColor}`}
                                />
                                <span className="text-[9px] font-mono text-gray-400 shrink-0">
                                  {layer.pitchShift > 0 ? "+" : ""}{layer.pitchShift}st
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Box 5: Reverb Aesthetics (Dhamma Hall Simulation) */}
              <div id="temple-reverb-card" className="bg-[#16181D] p-6 rounded-xl border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2 font-display">
                  <Sparkles size={14} className="text-amber-500 animate-pulse" />
                  ၅။ ဓမ္မာရုံ ပဲ့တင်သံ ဆက်တင်
                </h2>

                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  ဗုဒ္ဓဘာသာ ပရိတ်တော်များကို အမိုးမြင့်သော သိမ်တော်များ၊ ဓမ္မာရုံများ သို့မဟုတ် ကျောက်ဂူများအတွင်း ရွတ်ဆိုလေ့ရှိပြီး ပဲ့တင်သံများ ဖြစ်ပေါ်စေပါသည်။ အသံပဲ့တင်ထပ်မှုကို စိတ်ကြိုက်ပြင်ဆင်ရန် အောက်ပါ ဆက်တင်များကို ချိန်ညှိပါ။
                </p>

                {/* Reverb Presets Select Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {Object.entries(REVERB_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedReverb(key);
                        setExportedBlob(null);
                      }}
                      className={`p-3 rounded-lg border text-center transition-all duration-200 flex flex-col justify-between h-20 ${
                        selectedReverb === key 
                          ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-400 shadow-sm font-bold" 
                          : "bg-black/30 border-white/5 hover:bg-black/45 hover:border-white/10 text-gray-300"
                      }`}
                    >
                      <span className="text-xs font-bold block">{preset.name.split(" (")[0]}</span>
                      <span className="text-[9px] text-gray-500 mt-1 block leading-tight font-mono">
                        RT60: {preset.decayTime}s
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom Reverb sliders */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-white/5 pt-4">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1 font-display">
                      ပဲ့တင်သံ ပျောက်ကွယ်ချိန် (RT60)
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <input 
                        type="range"
                        min="0.2"
                        max="8.0"
                        step="0.1"
                        value={reverbDecay}
                        onChange={(e) => {
                          setReverbDecay(parseFloat(e.target.value));
                          setSelectedReverb("custom");
                          setExportedBlob(null);
                        }}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-xs font-mono text-gray-400 shrink-0 w-8 text-right">{reverbDecay}s</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1 font-display">
                      ပဲ့တင်သံ အနက်အရှိုင်း
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <input 
                        type="range"
                        min="0 animate-pulse"
                        max="0.8"
                        step="0.02"
                        value={reverbWet}
                        onChange={(e) => {
                          setReverbWet(parseFloat(e.target.value));
                          setSelectedReverb("custom");
                          setExportedBlob(null);
                        }}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-xs font-mono text-gray-400 shrink-0 w-8 text-right">{Math.round(reverbWet * 100)}%</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1 font-display">
                      ပင်မအသံ ပမာဏ
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <input 
                        type="range"
                        min="0.2"
                        max="1.0"
                        step="0.02"
                        value={reverbDry}
                        onChange={(e) => {
                          setReverbDry(parseFloat(e.target.value));
                          setSelectedReverb("custom");
                          setExportedBlob(null);
                        }}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-xs font-mono text-gray-400 shrink-0 w-8 text-right">{Math.round(reverbDry * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* DEVELOPER API GUIDE TAB */
          <div className="bg-[#16181D] p-6 md:p-8 rounded-xl border border-white/10 max-w-4xl mx-auto relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2 font-display">
              <FileCode className="text-indigo-400" size={14} />
              သံဃာ့အသံ စုပေါင်းရွတ်ဆိုမှု API ဆက်တင် (API Setup)
            </h2>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              အောက်ပါတို့သည် တစ်ပါးတည်း ရွတ်ဆိုထားသော ပရိတ်တရားတော်များကို သံဃာတော်များ ညီညီညာညာ ရွတ်ဆိုသည့်ပုံစံအဖြစ် ပြောင်းလဲပေးသည့် API ကုဒ်စနစ် ဖြစ်ပါသည်။ ၎င်းကို <strong>FastAPI</strong>၊ Spotify ၏ <strong>Pedalboard</strong>၊ <strong>Pydub</strong> နှင့် <strong>Soundfile</strong> စနစ်များဖြင့် ရေးသားထားပါသည်။
            </p>

            <div className="bg-indigo-950/15 border border-indigo-500/20 p-5 rounded-lg mb-6">
              <h3 className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-2 font-display">ဤကုဒ်ကို သင်၏ ကွန်ပျူတာပေါ်တွင် ထည့်သွင်းပြီး အသုံးပြုနည်း:</h3>
              <ol className="list-decimal list-inside text-xs text-gray-300 space-y-2">
                <li>
                  ကွန်ပျူတာတွင် <strong>FFmpeg</strong> ထည့်သွင်းပါ (Pydub ဖြင့် MP3 ဖိုင်များကို ပြုပြင်ရန် လိုအပ်သည်):
                  <ul className="list-disc list-inside ml-4 mt-1 text-gray-400 space-y-1">
                    <li>Mac: <code className="bg-black/30 px-1.5 py-0.5 border border-white/5 text-amber-400 rounded text-[10px] font-mono">brew install ffmpeg</code></li>
                    <li>Linux: <code className="bg-black/30 px-1.5 py-0.5 border border-white/5 text-amber-400 rounded text-[10px] font-mono">sudo apt install ffmpeg</code></li>
                    <li>Windows: တရားဝင်ဝဘ်ဆိုဒ်မှ ဒေါင်းလုဒ်ဆွဲပြီး PATH တွင် ထည့်သွင်းပါ</li>
                  </ul>
                </li>
                <li className="mt-2">
                  လိုအပ်သော Python လိုင်ဘရီများကို pip ဖြင့် ထည့်သွင်းပါ:
                  <div className="bg-black/30 border border-white/5 text-amber-400 p-2.5 rounded font-mono text-[10px] mt-1 overflow-x-auto">
                    pip install fastapi uvicorn pydub pedalboard soundfile numpy
                  </div>
                </li>
                <li className="mt-2">
                  FastAPI ဆာဗာကို စတင်ပတ်မောင်းပါ:
                  <div className="bg-black/30 border border-white/5 text-amber-400 p-2.5 rounded font-mono text-[10px] mt-1 overflow-x-auto">
                    python group_chanting_processor.py
                  </div>
                </li>
                <li className="mt-2">
                  အပြန်အလှန်အကျိုးပြု Swagger စာမျက်နှာကို ဤနေရာတွင် ကြည့်ရှုနိုင်သည်: <code className="text-indigo-400 font-mono font-bold hover:underline">http://localhost:8000/docs</code>
                </li>
              </ol>
            </div>

            {/* Code container */}
            <div className="relative border border-white/10 rounded-lg overflow-hidden shadow-inner bg-black/40">
              <div className="bg-[#1C1E24] px-4 py-2 flex items-center justify-between border-b border-white/10">
                <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1.5">
                  <FileCode size={13} className="text-indigo-400" />
                  group_chanting_processor.py
                </span>
                <button 
                  onClick={handleCopyCode}
                  className="text-gray-400 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                >
                  {isCopied ? (
                    <span className="text-emerald-400 flex items-center gap-1"><Check size={12} /> ကူးယူပြီးပါပြီ!</span>
                  ) : (
                    <span className="flex items-center gap-1"><Copy size={12} /> ကုဒ်ကို ကူးယူရန်</span>
                  )}
                </button>
              </div>

              {/* Code text block */}
              <pre className="p-4 text-amber-100/90 font-mono text-[11px] overflow-auto max-h-[500px]">
                <code id="python-code-block">{pythonScriptCode}</code>
              </pre>
            </div>

            <div className="mt-6 border-t border-white/5 pt-5">
              <h4 className="text-[11px] font-bold text-gray-300 uppercase tracking-widest mb-2 font-display">နည်းပညာဆိုင်ရာ အထူးပြုချက်များ (DSP Architectural Highlights):</h4>
              <ul className="list-disc list-inside text-xs text-gray-400 space-y-2">
                <li>
                  <strong>အမြန်နှုန်းနှင့် အသံအနိမ့်အမြင့် ချိန်ညှိမှု (Speed-Pitch Resampling):</strong> သံဃာတော်များ၏ ရွတ်ဆိုသံသည် အသံနက်ပြီး ရင်ဘတ်သံ ပါလေ့ရှိသည်။ သမရိုးကျ အသံပြောင်းလဲမှုများသည် စက်ရုပ်အသံကဲ့သို့ ဖြစ်စေတတ်သည်။ ကျွန်ုပ်တို့၏စနစ်သည် အသံနှုန်းနှင့် အသံအနိမ့်အမြင့်ကို မျှတစွာ ပြောင်းလဲပေးပြီး ပိုမိုသဘာဝကျသော သံဃာ့အသံများကို ထွက်ပေါ်စေသည်။
                </li>
                <li>
                  <strong>စုပေါင်းရွတ်ဆိုသံ ကြာချိန်နှင့် တည်နေရာ (Ensemble Delay & Pan):</strong> အသံတစ်ခုနှင့်တစ်ခုအကြား ၁၅ မီလီစက္ကန့်မှ ၄၀ မီလီစက္ကန့်အထိ အနည်းငယ်စီ ခြားပေးခြင်းဖြင့် သံဃာတော်များ ဘေးချင်းယှဉ် ရွတ်ဆိုနေသကဲ့သို့ ခံစားရစေသည်။ ဘယ်ညာ တည်နေရာများကို ခွဲခြားပေးခြင်းဖြင့် ပိုမိုကျယ်ဝန်းသော ခန်းမအတွင်း ရွတ်ဆိုသံကဲ့သို့ ဖြစ်စေသည်။
                </li>
                <li>
                  <strong>အသံပမာဏ တည်ငြိမ်စေမှု (Master Leveling & Dynamics):</strong> အသံလွှာများစွာ ပေါင်းစပ်သောအခါ အသံကွဲအက်ခြင်း ဖြစ်ပေါ်နိုင်သည်။ ထို့ကြောင့် အသံအရည်အသွေး ကောင်းမွန်စေရန်အတွက် အသံပမာဏကို -4.5dB ထိန်းညှိပြီးမှ ပဲ့တင်သံကို ထည့်သွင်းပါသည်။
                </li>
              </ul>
            </div>
          </div>
        )}

      </main>

      {/* Latency & Telemetry Footer Status Bar */}
      <footer className="h-10 border-t border-white/10 bg-[#0F1113] flex items-center px-4 md:px-8 justify-between text-[9px] font-mono text-gray-500 shrink-0">
        <div className="flex items-center gap-4">
          <span>အသံတုံ့ပြန်မှု ကြာချိန်: ၁၄ မီလီစက္ကန့် (14ms)</span>
          <span>နမူနာနှုန်း: ၄၄.၁ ကီလိုဟတ်ဇ် (44.1kHz)</span>
          <span>ဘာဖာ: ၅၁၂ ပမာဏ (512 Samples)</span>
          <span className="hidden sm:inline">ဘစ်အနက်: PCM ၁၆-ဘစ် (PCM 16-BIT)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>ဆာဗာနှင့် ချိတ်ဆက်ထားသည်</span>
        </div>
      </footer>

      {/* Main Bottom Footer */}
      <footer className="bg-[#16181D] text-gray-500 text-center py-6 border-t border-white/5 text-[11px]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between">
          <p>
            © ၂၀၂၆ သံဃာတော်များ စုပေါင်းရွတ်ဆိုသံ နည်းပညာစနစ်။ ကြည်ညိုသပ္ပာယ်ဖွယ်ရာ အသံအရည်အသွေးမြင့်မားစွာဖြင့် ထုတ်လုပ်ထားသည်။
          </p>
          <p className="mt-2 md:mt-0 font-mono text-[9px] text-gray-600">
            Acoustic Ref: သံဃသာမဂ္ဂီ ညီညီညာညာ ရွတ်ဆိုသည့်ပုံစံ
          </p>
        </div>
      </footer>
    </div>
  );
}
