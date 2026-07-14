import io
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydub import AudioSegment
import numpy as np

# Note: To run this backend, you need to install the following packages:
# pip install fastapi uvicorn pydub pedalboard soundfile numpy

try:
    from pedalboard import Pedalboard, Reverb
    import soundfile as sf
    PEDALBOARD_AVAILABLE = True
except ImportError:
    PEDALBOARD_AVAILABLE = False
    print("Warning: 'pedalboard' or 'soundfile' not installed. Reverb will be bypassed in the standalone script.")

app = FastAPI(
    title="Buddhist Monk Group Chanting Generator API",
    description="An advanced DSP API that takes a single chanter and processes it into a multi-voice monks ensemble chanting in a temple hall."
)

def shift_pitch(sound: AudioSegment, semitones: float) -> AudioSegment:
    """
    Shifts the pitch of an AudioSegment by a specific number of semitones
    by adjusting the playback sample rate. This behaves like organic voice variations.
    """
    # Calculate new sample rate corresponding to the semitone shift
    new_sample_rate = int(sound.frame_rate * (2.0 ** (semitones / 12.0)))
    # Spawn a new audio segment with the modified frame rate, then restore standard sample rate
    shifted = sound._spawn(sound.raw_data, overrides={'frame_rate': new_sample_rate})
    return shifted.set_frame_rate(sound.frame_rate)

@app.post("/api/process-chanting")
async def process_chanting(
    file: UploadFile = File(...),
    reverb_room_size: float = 0.8,
    reverb_damping: float = 0.4,
    reverb_wet_level: float = 0.4,
    reverb_dry_level: float = 0.7
):
    """
    Accepts an MP3/WAV/audio file of a single person chanting, duplicates it, 
    applies panning, micro-delays, and pitch-shifting to simulate a group of monks,
    applies a large hall reverb, and returns the processed group chanting MP3.
    """
    # Check file extension
    filename = file.filename or "chanting.mp3"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".mp3", ".wav", ".m4a", ".ogg", ".aac"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a supported audio format (MP3, WAV, M4A, OGG).")

    try:
        # Read file contents into memory
        file_bytes = await file.read()
        audio_in = io.BytesIO(file_bytes)
        
        # Load audio using pydub
        # If input is MP3, pydub will parse it (requires ffmpeg installed on system)
        original = AudioSegment.from_file(audio_in)
        
        # Ensure stereo output for realistic spatial panning
        original = original.set_channels(2)
        
        print(f"Loaded original audio: {len(original)}ms, {original.frame_rate}Hz")

        # Create the 5 different vocal layers to simulate a cohesive group:
        
        # Layer 1: The original chanter, centered, full volume, no delay
        layer1 = original
        
        # Layer 2: Deeper monk voice, panned left, 15ms micro-delay
        layer2_pitch = -1.8  # semitones down
        layer2_delay_ms = 15
        layer2 = shift_pitch(original, layer2_pitch).pan(-0.4)
        # Prepend silent delay
        layer2 = AudioSegment.silent(duration=layer2_delay_ms) + layer2
        
        # Layer 3: Slightly higher/average chanter, panned right, 25ms micro-delay
        layer3_pitch = -0.6  # slightly lower to maintain monks warmth
        layer3_delay_ms = 25
        layer3 = shift_pitch(original, layer3_pitch).pan(0.4)
        layer3 = AudioSegment.silent(duration=layer3_delay_ms) + layer3
        
        # Layer 4: Deep baritone monk voice, panned slightly left, 32ms micro-delay
        layer4_pitch = -2.5  # deep resonant chest voice
        layer4_delay_ms = 32
        layer4 = shift_pitch(original, layer4_pitch).pan(-0.18)
        layer4 = AudioSegment.silent(duration=layer4_delay_ms) + layer4
        
        # Layer 5: Medium monk voice, panned slightly right, 40ms micro-delay
        layer5_pitch = -1.2  # robust chanting pitch
        layer5_delay_ms = 40
        layer5 = shift_pitch(original, layer5_pitch).pan(0.18)
        layer5 = AudioSegment.silent(duration=layer5_delay_ms) + layer5

        # Overlay/mix all layers together
        # We adjust volume offsets on individual layers if necessary
        mixed = layer1.overlay(layer2)
        mixed = mixed.overlay(layer3)
        mixed = mixed.overlay(layer4)
        mixed = mixed.overlay(layer5)
        
        # Reduce global volume slightly to avoid digital clipping/saturation
        mixed = mixed - 4.5  # -4.5dB headroom

        # Export mixed audio to standard WAV format in memory for Reverb processing
        wav_io = io.BytesIO()
        mixed.export(wav_io, format="wav")
        wav_io.seek(0)

        # Apply Reverb (Dhamma Hall/Temple Acoustics simulation)
        if PEDALBOARD_AVAILABLE:
            # Load WAV bytes into a numpy array via soundfile
            audio_data, sample_rate = sf.read(wav_io)
            
            # Create Spotify Pedalboard with Reverb effect
            board = Pedalboard([
                Reverb(
                    room_size=reverb_room_size,
                    damping=reverb_damping,
                    wet_level=reverb_wet_level,
                    dry_level=reverb_dry_level
                )
            ])
            
            # Apply reverb DSP
            effected_audio = board(audio_data, sample_rate)
            
            # Write effected audio back into a bytes stream
            reverb_wav_io = io.BytesIO()
            sf.write(reverb_wav_io, effected_audio, sample_rate, format='wav')
            reverb_wav_io.seek(0)
            
            # Load back into pydub to convert to high-quality MP3 output
            final_audio = AudioSegment.from_wav(reverb_wav_io)
        else:
            print("Skipping pedalboard reverb as library is missing. Exporting direct mix.")
            final_audio = mixed

        # Export to high-quality MP3 (192kbps)
        output_mp3 = io.BytesIO()
        final_audio.export(output_mp3, format="mp3", bitrate="192k")
        output_mp3.seek(0)

        # Return file streaming response
        return StreamingResponse(
            output_mp3,
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename=monks_group_chant_{filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio processing engine failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Start the local FastAPI server
    uvicorn.run(app, host="0.0.0.0", port=8000)
