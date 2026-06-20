from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CallJob:
    job_id: str
    persona_name: str
    persona_type: str
    persona_goal: str
    system_prompt: str
    greeting: str
    phone_number: str
    websocket_url: str
    target_context: str
    noise_profile: str = "none"
    run_number: int = 1
    run_id: Optional[str] = None


@dataclass
class JobResult:
    job_id: str
    persona_name: str
    persona_type: str
    run_number: int
    status: str                      # "success" | "failed" | "no_transcript"
    call_sid: Optional[str] = None
    stream_sid: Optional[str] = None
    audio_path: Optional[str] = None
    transcript: Optional[list] = None
    evaluation: Optional[dict] = None
    loop_detection: Optional[dict] = None
    error: Optional[str] = None
