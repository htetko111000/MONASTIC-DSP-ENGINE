# Buddhist Group Chanting Acoustics Generator
### သံဃာတော်များ စုပေါင်းရွတ်ဆိုသံ နည်းပညာစနစ်

A high-fidelity digital signal processing (DSP) application designed to transform a single-person Paritta/chanting audio file (or a synthetic baseline drone) into a harmonious, majestic, and immersive ensemble of monks chanting together in a sacred hall.

သီခြားတစ်ပါးတည်း ရွတ်ဆိုထားသော ပရိတ်တရားတော်များကို သံဃာတော်များ ညီညီညာညာ စုပေါင်းရွတ်ဆိုသည့်ပုံစံအဖြစ် ပြောင်းလဲပေးသည့် အသံနည်းပညာစနစ် ဖြစ်ပါသည်။

---

## 🌟 Key Features & Workflow

The application operates as a full bilingual full-stack workspace split into two primary operational modules:

### 1. Web Audio Studio (စတူဒီယိုစနစ်)
Powered entirely by client-side **Web Audio API** in React with absolute real-time control:
* **Audio Import & Synthesis**: Supports drag-and-drop file imports (MP3, WAV, M4A, OGG) or direct generation of a synthetic deep monastic chant drone using warm oscillators.
* **5-Voice Monk Ensemble Control Grid**: 
  * Turn layers on/off dynamically.
  * Adjust independent volume (Gain), stereo panning (Spatial Left/Right), and precise time delays.
* **Sample-Accurate Phase Synchronization**:
  * Employs precise Web Audio scheduler timing (`startTime = ctx.currentTime + 0.05`) to launch all layers.
  * Bypasses standard browser latency and enforces complete unison, preventing phase separation or timeline drift when starting or resuming playback.
* **Built-in Acoustics Presets**:
  * **Saffron Choir (ရွှေဝါရောင် သံဃာတော်များ)**: Default 5-monk ensemble.
  * **Forest Hermit (တောရသံဃာတော်များ)**: Warm low-chant filter configuration.
  * **Duet (နှစ်ပါးတွဲရွတ်ဆိုသံ)**: Monk 1 & Monk 2 with highly calibrated ~20ms delays and wider left-right panning for standard double-voice stereophonic unison.
  * **Trio (သုံးပါးရွတ်ဆိုသံ)**: Monk 1, 2, and 3 with tight 20ms and 40ms delays and immersive panoramic panning.
  * **Cave Chanting (လှိုဏ်ဂူတော်အတွင်း ရွတ်ဆိုသံ)**: Enriched with deep cave reverbs.
* **Master Filters & Reverb Spaces**:
  * Dual BiquadFilters (High-Pass to filter sub-bass room rumbles and Low-Pass for monastic warmth).
  * ConvolverNode reverb impulse responses simulating sacred locations: *Dhamma Hall, Monastery, Ancient Pagoda, and Mystic Cave*.
* **Live HTML5 Waveform & Frequency Visualizer**: Displays beautiful dynamic spectrum analyses during playback.
* **In-Browser Audio Export**: High-speed offline context rendering to export and download the processed choir as a stereo WAV file directly.

### 2. Standalone Production Python API (ဆာဗာ API စနစ်)
A high-performance standalone server script designed for production environments using **FastAPI**:
* **Spotify's Pedalboard Integration**: Utilizes high-fidelity algorithms for realistic acoustic reverb.
* **Dynamic Overlays & Resampling**: Organically pitches down voices and layers them with sub-millisecond panning and silences without creating robotic metallic buzzing.
* **Headroom Safety**: Strict `-4.5dB` buffer limits to guarantee clean signal paths and eliminate digital clipping during dynamic mixing.

---

## 🛠️ Architecture & DSP Pipeline

```
[Single Input File / Synth] 
       │
       ├─► Monk Layer 1 (Original Center / No delay)
       ├─► Monk Layer 2 (Pitch Shifted Left / 20ms delay)
       ├─► Monk Layer 3 (Pitch Shifted Right / 40ms delay)
       ├─► Monk Layer 4 (Deep Baritone / Spatial)
       ├─► Monk Layer 5 (Medium Resonant / Spatial)
       │
       ▼ (Summed with -4.5dB Headroom Guard)
[Biquad Filters (HPF/LPF)] 
       │
       ▼
[Convolver Reverb (Sacred Impulse Spaces)]
       │
       ├─► [Real-time Web Audio API Output + Visualizer]
       └─► [Offline Audio Renderer -> High-Quality WAV Download]
```

---

## 💻 Local Setup & Development

### Frontend App
1. Ensure you have Node.js installed.
2. Install client dependencies:
   ```bash
   npm install
   ```
3. Boot up the Vite developer environment:
   ```bash
   npm run dev
   ```
4. Access the web app at `http://localhost:3000`.

### Standalone Python API Setup
The backend script resides in `/python/group_chanting_processor.py`.

1. **Install FFmpeg** (Required for converting/saving MP3 and audio formats):
   * **macOS**: `brew install ffmpeg`
   * **Linux**: `sudo apt install ffmpeg`
   * **Windows**: Download from the official page and add to your system Environment variables.

2. **Install Python Libraries**:
   ```bash
   pip install fastapi uvicorn pydub pedalboard soundfile numpy
   ```

3. **Start the FastAPI Dev Server**:
   ```bash
   python python/group_chanting_processor.py
   ```

4. **Access Swagger Interactive API Documents**:
   Open `http://localhost:8000/docs` in your browser to test and execute your API endpoints directly.

---

## ⚙️ Technical Highlights

* **Resampling Pitch Shifts**: Natural human chanting depth is preserved by adjusting playback rate scales rather than introducing artificial DSP phase vocoders.
* **Spatial Depth Mapping**: Simulates physical choir positioning on an actual temple floor using panning boundaries between `-0.45` and `+0.45`.
* **Zero Phase Latency**: Scheduled AudioContext start coordinates prevent layer desynchronization upon pausing and play loops.
* **Clean Code Aesthetics**: Modular, type-safe React setup adhering to modern clean architectural standards.
