import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from voiceprobe.calls.twilio_client import make_streaming_call

NGROK_URL = os.getenv("NGROK_URL")

if not NGROK_URL:
    print("ERROR: Set NGROK_URL in your .env file first")
    print("  Example: NGROK_URL=wss://abc123.ngrok-free.app")
    sys.exit(1)

websocket_url = f"{NGROK_URL}/media-stream"
print(f"Triggering streaming call to {os.getenv('MY_PHONE_NUMBER')}")
print(f"WebSocket target: {websocket_url}")

call_sid = make_streaming_call(os.getenv("MY_PHONE_NUMBER"), websocket_url)
print(f"Call SID: {call_sid}")
print("Answer your phone — watch the uvicorn terminal for events!")
