import json
import base64
import asyncio
import os
import datetime
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from voiceprobe.calls.tts import mulaw_to_pcm, process_turn, text_to_speech
from voiceprobe.calls.twilio_client import end_call
from voiceprobe.core.llm import call_llm
from voiceprobe.api.dashboard_routes import router as dashboard_router
from voiceprobe.core.live_events import publish_live_event
from voiceprobe.storage.database import init_db

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router)


@app.on_event("startup")
async def startup():
    init_db()

SAMPLE_RATE = 8000
BYTES_PER_SAMPLE = 2

SILENCE_RMS_THRESHOLD = 400
SILENCE_WINDOW_SEC = 0.8
MIN_SPEECH_SEC = 1.5
MAX_BUFFER_SEC = 10

SILENCE_WINDOW = int(SAMPLE_RATE * BYTES_PER_SAMPLE * SILENCE_WINDOW_SEC)
MIN_SPEECH_SIZE = int(SAMPLE_RATE * BYTES_PER_SAMPLE * MIN_SPEECH_SEC)
MAX_BUFFER_SIZE = int(SAMPLE_RATE * BYTES_PER_SAMPLE * MAX_BUFFER_SEC)

DEFAULT_SYSTEM_PROMPT = os.getenv(
    "DEFAULT_SYSTEM_PROMPT",
    "You are a customer calling support. Keep responses short — 1-2 sentences max. Speak naturally."
)


async def send_audio_to_twilio(websocket: WebSocket, stream_sid: str, mulaw_bytes: bytes):
    chunk_size = 8000
    for i in range(0, len(mulaw_bytes), chunk_size):
        chunk = mulaw_bytes[i:i + chunk_size]
        payload = base64.b64encode(chunk).decode("utf-8")
        try:
            await websocket.send_text(json.dumps({
                "event": "media",
                "streamSid": stream_sid,
                "media": {"payload": payload}
            }))
            await asyncio.sleep(0)
        except Exception:
            break

    playback_duration = len(mulaw_bytes) / 8000
    await asyncio.sleep(playback_duration)


def is_silence(pcm_bytes: bytes) -> bool:
    import audioop
    if len(pcm_bytes) < SILENCE_WINDOW:
        return False
    recent = pcm_bytes[-SILENCE_WINDOW:]
    rms = audioop.rms(recent, 2)
    return rms < SILENCE_RMS_THRESHOLD


def save_sid_to_redis(call_sid: str, stream_sid: str):
    """Store call_sid → stream_sid mapping in Redis so worker can find transcript."""
    try:
        import redis as redis_lib
        r = redis_lib.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            password=os.getenv("REDIS_PASSWORD"),
            decode_responses=True,
            socket_connect_timeout=3,
        )
        r.set(f"voiceprobe:sid:{call_sid}", stream_sid, ex=86400)
    except Exception as e:
        print(f"  [REDIS] Could not save SID mapping: {e}")


@app.websocket("/media-stream")
async def media_stream(websocket: WebSocket):
    await websocket.accept()
    print("twilio connected")

    stream_sid = None
    call_sid = None
    pcm_buffer = b""
    conversation_history = []
    system_prompt = DEFAULT_SYSTEM_PROMPT
    pre_generated_greeting = None
    noise_profile = "none"
    is_processing = False
    transcript_log = []
    recording_dir = None
    turn_count = 0
    run_id = None
    job_id = None
    persona_name = None

    async def publish_transcript(speaker: str, text: str):
        if not text:
            return
        await publish_live_event(run_id, {
            "type": "transcript",
            "job_id": job_id,
            "persona_name": persona_name,
            "call_sid": call_sid,
            "stream_sid": stream_sid,
            "speaker": speaker,
            "text": text,
            "turn": len(transcript_log),
        })

    async def handle_turn(buffer: bytes, sid: str):
        nonlocal is_processing, turn_count
        try:
            transcript, audio_mulaw, should_hangup = await process_turn(
                buffer, system_prompt, conversation_history, turn_count, noise_profile
            )
            turn_count += 1

            if transcript:
                transcript_log.append({
                    "speaker": "agent",
                    "text": transcript,
                    "timestamp": datetime.datetime.utcnow().isoformat()
                })
                await publish_transcript("agent", transcript)

            if audio_mulaw and sid:
                await send_audio_to_twilio(websocket, sid, audio_mulaw)

                llm_response = conversation_history[-1]["content"] if conversation_history else ""
                if llm_response:
                    transcript_log.append({
                        "speaker": "persona",
                        "text": llm_response,
                        "timestamp": datetime.datetime.utcnow().isoformat()
                    })
                    await publish_transcript("persona", llm_response)

            if should_hangup and call_sid:
                print(f"  [HANGUP] Persona goal resolved at turn {turn_count}. Ending call.")
                await asyncio.sleep(0.5)
                end_call(call_sid)

        except Exception as e:
            print(f"  [ERROR] Turn processing failed: {e}")
        finally:
            is_processing = False

    async def handle_greeting(sid: str):
        nonlocal is_processing
        try:
            greeting_text = pre_generated_greeting or "Hello, I need help with an issue with my order."
            print(f"  [GREETING] {greeting_text}")

            audio_mulaw = await asyncio.to_thread(text_to_speech, greeting_text)
            conversation_history.append({"role": "assistant", "content": greeting_text})
            transcript_log.append({
                "speaker": "persona",
                "text": greeting_text,
                "timestamp": datetime.datetime.utcnow().isoformat()
            })
            await publish_transcript("persona", greeting_text)
            await send_audio_to_twilio(websocket, sid, audio_mulaw)
        except Exception as e:
            print(f"  [ERROR] Greeting failed: {e}")
        finally:
            is_processing = False

    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                continue

            data = json.loads(message)
            event = data.get("event")

            if event == "connected":
                print("Event: connected")

            elif event == "start":
                stream_sid = data["start"]["streamSid"]
                call_sid = data["start"].get("callSid")
                print(f"Event: start | StreamSid: {stream_sid} | CallSid: {call_sid}")

                custom_params = data["start"].get("customParameters", {})
                if custom_params.get("system_prompt"):
                    system_prompt = custom_params["system_prompt"]
                if custom_params.get("greeting"):
                    pre_generated_greeting = custom_params["greeting"]
                if custom_params.get("noise_profile"):
                    noise_profile = custom_params["noise_profile"]
                if custom_params.get("run_id"):
                    run_id = custom_params["run_id"]
                if custom_params.get("job_id"):
                    job_id = custom_params["job_id"]
                if custom_params.get("persona_name"):
                    persona_name = custom_params["persona_name"]
                print(f"Persona system prompt loaded ({len(system_prompt)} chars)")
                print(f"Noise Profile: {noise_profile}")

                recording_dir = os.path.join("recordings", stream_sid)
                os.makedirs(recording_dir, exist_ok=True)
                print(f"Recording folder: {recording_dir}")

                # Save call_sid → stream_sid mapping to Redis for worker lookup
                if call_sid:
                    save_sid_to_redis(call_sid, stream_sid)

                await publish_live_event(run_id, {
                    "type": "call_started",
                    "job_id": job_id,
                    "persona_name": persona_name,
                    "call_sid": call_sid,
                    "stream_sid": stream_sid,
                    "noise_profile": noise_profile,
                })

                is_processing = True
                asyncio.create_task(handle_greeting(stream_sid))

            elif event == "media":
                if is_processing:
                    continue

                payload = data["media"]["payload"]
                mulaw_bytes = base64.b64decode(payload)
                pcm_bytes = mulaw_to_pcm(mulaw_bytes)
                pcm_buffer += pcm_bytes

                has_speech = len(pcm_buffer) >= MIN_SPEECH_SIZE
                silent_now = is_silence(pcm_buffer)
                too_large = len(pcm_buffer) >= MAX_BUFFER_SIZE

                if (has_speech and silent_now) or too_large:
                    buffer_to_process = pcm_buffer
                    pcm_buffer = b""
                    is_processing = True
                    dur = len(buffer_to_process) / SAMPLE_RATE / BYTES_PER_SAMPLE
                    print(f"Processing {dur:.1f}s of audio...")
                    asyncio.create_task(handle_turn(buffer_to_process, stream_sid))

            elif event == "stop":
                print("Event: stop")
                await publish_live_event(run_id, {
                    "type": "call_stopped",
                    "job_id": job_id,
                    "persona_name": persona_name,
                    "call_sid": call_sid,
                    "stream_sid": stream_sid,
                })
                if pcm_buffer and stream_sid and not is_processing:
                    print("Processing final audio buffer...")
                    await handle_turn(pcm_buffer, stream_sid)

                if recording_dir and transcript_log:
                    transcript_path = os.path.join(recording_dir, "transcript.json")
                    with open(transcript_path, "w", encoding="utf-8") as f:
                        json.dump(transcript_log, f, indent=2, ensure_ascii=False)
                    print(f"Transcript saved: {transcript_path} ({len(transcript_log)} turns)")

                break

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        print("Connection closed")
