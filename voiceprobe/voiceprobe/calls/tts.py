import audioop
import base64
import os
import re
import asyncio
import httpx
import io
import math
from dotenv import load_dotenv
from voiceprobe.core.llm import call_llm
try:
    from pydub import AudioSegment
except ImportError:
    AudioSegment = None

load_dotenv()

MAX_TURNS = 12  # Auto hang-up after this many turns
HTTP_RETRY_ATTEMPTS = int(os.getenv("VOICEPROBE_HTTP_RETRY_ATTEMPTS", 3))
HTTP_RETRY_BASE_DELAY = float(os.getenv("VOICEPROBE_HTTP_RETRY_BASE_DELAY", 1.5))


async def retry_http_async(label: str, fn):
    last_error = None
    for attempt in range(1, HTTP_RETRY_ATTEMPTS + 1):
        try:
            return await fn()
        except Exception as exc:
            last_error = exc
            print(f"  [HTTP RETRY] {label} failed attempt {attempt}/{HTTP_RETRY_ATTEMPTS}: {exc}")
            if attempt < HTTP_RETRY_ATTEMPTS:
                await asyncio.sleep(HTTP_RETRY_BASE_DELAY * attempt)
    raise last_error


def retry_http_sync(label: str, fn):
    import time

    last_error = None
    for attempt in range(1, HTTP_RETRY_ATTEMPTS + 1):
        try:
            return fn()
        except Exception as exc:
            last_error = exc
            print(f"  [HTTP RETRY] {label} failed attempt {attempt}/{HTTP_RETRY_ATTEMPTS}: {exc}")
            if attempt < HTTP_RETRY_ATTEMPTS:
                time.sleep(HTTP_RETRY_BASE_DELAY * attempt)
    raise last_error


def mulaw_to_pcm(mulaw_bytes: bytes) -> bytes:
    return audioop.ulaw2lin(mulaw_bytes, 2)


def pcm_to_mulaw(pcm_bytes: bytes) -> bytes:
    return audioop.lin2ulaw(pcm_bytes, 2)


def clean_for_tts(text: str) -> str:
    text = re.sub(r'\*[^*]+\*', '', text)        # Remove *stage directions*
    text = re.sub(r'\[HANG_UP\]', '', text)       # Remove hang-up token
    text = re.sub(r'\n+', ' ', text)
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()


async def transcribe_audio(pcm_bytes: bytes) -> str:
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        raise ValueError("DEEPGRAM_API_KEY missing from .env")

    async def request():
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=8000&channels=1&model=nova-2",
                headers={
                    "Authorization": f"Token {api_key}",
                    "Content-Type": "audio/raw",
                },
                content=pcm_bytes,
                timeout=30,
            )
            response.raise_for_status()
            return response.json()

    result = await retry_http_async("deepgram transcription", request)

    try:
        transcript = result["results"]["channels"][0]["alternatives"][0]["transcript"]
        return transcript.strip()
    except (KeyError, IndexError):
        return ""


def text_to_speech(text: str) -> bytes:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")

    def request():
        return httpx.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=ulaw_8000",
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": "eleven_turbo_v2",
            },
            timeout=30,
        )

    response = retry_http_sync("elevenlabs tts", request)
    response.raise_for_status()
    return response.content


def apply_noise(pcm_bytes: bytes, noise_profile: str) -> bytes:
    if not noise_profile or noise_profile == "none" or not AudioSegment:
        return pcm_bytes
        
    noise_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'assets', 'noise', f'{noise_profile}.wav')
    if not os.path.exists(noise_path):
        print(f"  [TTS] Warning: Noise profile {noise_profile} not found at {noise_path}")
        return pcm_bytes

    speech_seg = AudioSegment.from_raw(
        io.BytesIO(pcm_bytes), 
        sample_width=2, 
        frame_rate=8000, 
        channels=1
    )
    
    try:
        noise_seg = AudioSegment.from_wav(noise_path)
    except Exception as e:
        print(f"  [TTS] Error loading noise file: {e}")
        return pcm_bytes

    # Convert noise to 8kHz mono 16-bit to match speech
    noise_seg = noise_seg.set_frame_rate(8000).set_channels(1).set_sample_width(2)
    
    # Loop noise to match speech length
    if len(noise_seg) < len(speech_seg):
        repeats = math.ceil(len(speech_seg) / len(noise_seg))
        noise_seg = noise_seg * repeats
    
    # Trim noise to exact length
    noise_seg = noise_seg[:len(speech_seg)]
    
    # Reduce noise volume so speech is intelligible
    noise_seg = noise_seg - 15  # -15 dB
    
    # Mix them
    mixed = speech_seg.overlay(noise_seg)
    
    # Export back to raw PCM
    return mixed.raw_data


async def process_turn(
    pcm_buffer: bytes,
    system_prompt: str,
    conversation_history: list,
    turn_count: int = 0,
    noise_profile: str = "none"
) -> tuple[str, bytes, bool]:
    """Returns (transcript, audio_mulaw, should_hangup)"""
    transcript = await transcribe_audio(pcm_buffer)

    if not transcript:
        print("  [STT] No speech detected in buffer")
        return "", b"", False

    print(f"  [STT] Transcript: {transcript}")

    conversation_history.append({"role": "user", "content": transcript})

    history_text = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in conversation_history
    )

    hangup_instruction = ""
    if turn_count >= MAX_TURNS - 2:
        hangup_instruction = " If you feel this conversation has reached its natural end or your goal is resolved, append [HANG_UP] at the very end of your response."
    else:
        hangup_instruction = " If your goal is fully resolved and you're satisfied, append [HANG_UP] at the very end of your response."

    brevity_note = (
        f"\n\n[IMPORTANT: Respond in 1-2 short spoken sentences only. "
        f"No stage directions, no asterisks, no bullet points. Speak like a real person on a phone call.{hangup_instruction}]"
    )

    response_text = await call_llm(system_prompt + brevity_note, history_text, temperature=0.7)

    should_hangup = "[HANG_UP]" in response_text or turn_count >= MAX_TURNS
    clean_response = clean_for_tts(response_text)
    print(f"  [LLM] Response: {clean_response}" + (" [HANG_UP]" if should_hangup else ""))

    conversation_history.append({"role": "assistant", "content": clean_response})

    audio_mulaw = await asyncio.to_thread(text_to_speech, clean_response)
    
    if noise_profile and noise_profile != "none":
        pcm_bytes = mulaw_to_pcm(audio_mulaw)
        mixed_pcm = await asyncio.to_thread(apply_noise, pcm_bytes, noise_profile)
        audio_mulaw = pcm_to_mulaw(mixed_pcm)

    return transcript, audio_mulaw, should_hangup
