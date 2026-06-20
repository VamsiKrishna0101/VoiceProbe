from typing import TypedDict, List, Optional


class CallResult(TypedDict):
    persona_name: str
    persona_type: str
    run_number: int
    job_id: str
    call_sid: Optional[str]
    recording_url: Optional[str]
    audio_path: Optional[str]
    transcript: Optional[List[dict]]
    evaluation: Optional[dict]
    loop_detection: Optional[dict]


class VoiceProbeState(TypedDict):
    run_id: Optional[str]
    target_phone_number: str
    target_context: str
    runs_per_persona: int
    personas: List[dict]           # enriched persona dicts with system_prompt + greeting
    job_ids: List[str]             # submitted ARQ job IDs
    call_results: List[CallResult] # populated after all jobs complete
    failure_analysis: Optional[dict]
