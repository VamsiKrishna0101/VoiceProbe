import os
import requests
from dotenv import load_dotenv

load_dotenv()

def download_recording(recording_url, save_path):
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")

    response = requests.get(recording_url, auth=(sid, token))
    response.raise_for_status()

    with open(save_path, "wb") as f:
        f.write(response.content)

    return save_path