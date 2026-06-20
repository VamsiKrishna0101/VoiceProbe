import os
import time
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
TWILIO_RETRY_ATTEMPTS = int(os.getenv("VOICEPROBE_TWILIO_RETRY_ATTEMPTS", 3))
TWILIO_RETRY_BASE_DELAY = float(os.getenv("VOICEPROBE_TWILIO_RETRY_BASE_DELAY", 1.5))


def retry_twilio(label, fn):
    last_error = None
    for attempt in range(1, TWILIO_RETRY_ATTEMPTS + 1):
        try:
            return fn()
        except Exception as exc:
            last_error = exc
            print(f"  [TWILIO RETRY] {label} failed attempt {attempt}/{TWILIO_RETRY_ATTEMPTS}: {exc}")
            if attempt < TWILIO_RETRY_ATTEMPTS:
                time.sleep(TWILIO_RETRY_BASE_DELAY * attempt)
    raise last_error

def make_call(to_number, message="Hello, this is a test call from VoiceProbe"):
    call = client.calls.create(
        to=to_number,
        from_=os.getenv("TWILIO_PHONE_NUMBER"),
        twiml=f'<Response><Say>{message}</Say><Pause length="60"/></Response>',
        record=True
    )
    return call.sid

def get_call_recording(call_sid):
    recordings = retry_twilio(
        f"recording lookup {call_sid}",
        lambda: client.recordings.list(call_sid=call_sid),
    )
    if recordings:
        return f"https://api.twilio.com{recordings[0].uri.replace('.json', '.mp3')}"
    return None

def get_call_status(call_sid):
    return retry_twilio(
        f"status lookup {call_sid}",
        lambda: client.calls(call_sid).fetch().status,
    )

def end_call(call_sid):
    """Terminate an in-progress call via Twilio REST API."""
    try:
        retry_twilio(
            f"hangup {call_sid}",
            lambda: client.calls(call_sid).update(status="completed"),
        )
        print(f"  [HANGUP] Call {call_sid} terminated.")
    except Exception as e:
        print(f"  [HANGUP ERROR] {e}")

def make_streaming_call(to_number, websocket_url, system_prompt=None, greeting=None, noise_profile=None, run_id=None, job_id=None, persona_name=None):
    import html
    params = ""
    if system_prompt:
        escaped_prompt = html.escape(system_prompt, quote=True)
        params += f'<Parameter name="system_prompt" value="{escaped_prompt}" />'
    if greeting:
        escaped_greeting = html.escape(greeting, quote=True)
        params += f'<Parameter name="greeting" value="{escaped_greeting}" />'
    if noise_profile:
        escaped_noise = html.escape(noise_profile, quote=True)
        params += f'<Parameter name="noise_profile" value="{escaped_noise}" />'
    if run_id:
        escaped_run_id = html.escape(run_id, quote=True)
        params += f'<Parameter name="run_id" value="{escaped_run_id}" />'
    if job_id:
        escaped_job_id = html.escape(job_id, quote=True)
        params += f'<Parameter name="job_id" value="{escaped_job_id}" />'
    if persona_name:
        escaped_persona_name = html.escape(persona_name, quote=True)
        params += f'<Parameter name="persona_name" value="{escaped_persona_name}" />'

    twiml = f'<Response><Connect><Stream url="{websocket_url}">{params}</Stream></Connect></Response>'

    call = client.calls.create(
        to=to_number,
        from_=os.getenv("TWILIO_PHONE_NUMBER"),
        twiml=twiml,
        record=True
    )
    return call.sid
