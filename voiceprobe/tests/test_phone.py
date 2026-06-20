import os
import sys
import time
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from voiceprobe.calls.twilio_client import make_call, get_call_recording
from voiceprobe.calls.recorder import download_recording

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

call_sid = make_call(os.getenv("MY_PHONE_NUMBER"))
print("Call SID:", call_sid)

time.sleep(40)

recording_url = get_call_recording(call_sid)
print("Recording URL:", recording_url)

if recording_url:
    download_recording(recording_url, "test_call.mp3")
    print("Saved to test_call.mp3")