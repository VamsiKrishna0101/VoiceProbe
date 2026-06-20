import whisper
import os

model = None

def load_model():
    global model
    if model is None:
        model = whisper.load_model("base")
    return model

def transcribe_audio(audio_path: str) -> list[dict]:
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    m = load_model()
    result = m.transcribe(audio_path)

    turns = []
    for segment in result.get("segments", []):
        turns.append({
            "speaker": "unknown",
            "text": segment["text"].strip(),
            "timestamp": segment["start"]
        })

    return turns