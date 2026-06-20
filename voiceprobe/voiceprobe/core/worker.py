"""
ARQ async worker — processes CallJob items from the Redis queue.
Each worker instance:
  1. Makes a streaming call via Twilio
  2. Polls until call completes
  3. Reads transcript from Redis SID mapping
  4. Downloads recording
  5. Runs evaluation (score_call)
  6. Stores JobResult in Redis
"""
import asyncio
import json
import os
import glob
from dataclasses import asdict

from dotenv import load_dotenv
load_dotenv()

from voiceprobe.core.job_schema import CallJob, JobResult
from voiceprobe.core.redis_client import get_redis_settings
from voiceprobe.core.live_events import publish_live_event
from voiceprobe.calls.twilio_client import make_streaming_call, get_call_status, get_call_recording
from voiceprobe.calls.recorder import download_recording
from voiceprobe.evaluation.scorer import score_call
from voiceprobe.evaluation.loop_detector import detect_loops
from voiceprobe.storage import repositories as repo

MAX_CONCURRENT_CALLS = int(os.getenv("VOICEPROBE_MAX_CONCURRENT_CALLS", 5))
CALL_TIMEOUT_SECONDS = int(os.getenv("VOICEPROBE_CALL_TIMEOUT", 300))  # 5 min max per call
RETRY_ATTEMPTS = int(os.getenv("VOICEPROBE_RETRY_ATTEMPTS", 3))
RETRY_BASE_DELAY = float(os.getenv("VOICEPROBE_RETRY_BASE_DELAY", 1.5))


def db_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        print(f"[DB] {fn.__name__} failed: {exc}")
        return None


async def retry_async(label: str, fn, *args, attempts: int = RETRY_ATTEMPTS, **kwargs):
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            return await asyncio.to_thread(fn, *args, **kwargs)
        except Exception as exc:
            last_error = exc
            print(f"[RETRY] {label} failed attempt {attempt}/{attempts}: {exc}")
            if attempt < attempts:
                await asyncio.sleep(RETRY_BASE_DELAY * attempt)
    raise last_error


async def run_call_job(ctx, job_data: dict):
    """Main ARQ task. Receives job as dict (serializable), runs full call + eval pipeline."""
    r = ctx["redis"]
    job = CallJob(**job_data)

    print(f"[WORKER] Starting job {job.job_id} | {job.persona_name} run #{job.run_number}")
    db_call(
        repo.create_job,
        job.job_id,
        job.run_id,
        job.persona_name,
        job.persona_type,
        job.run_number,
        "running",
    )
    db_call(repo.update_job, job.job_id, status="running", increment_attempt=True)
    await publish_live_event(job.run_id, {
        "type": "job_started",
        "job_id": job.job_id,
        "persona_name": job.persona_name,
        "persona_type": job.persona_type,
        "run_number": job.run_number,
        "status": "starting",
    })

    result = JobResult(
        job_id=job.job_id,
        persona_name=job.persona_name,
        persona_type=job.persona_type,
        run_number=job.run_number,
        status="failed",
    )

    try:
        # 1. Make the streaming call
        call_sid = make_streaming_call(
            to_number=job.phone_number,
            websocket_url=job.websocket_url,
            system_prompt=job.system_prompt,
            greeting=job.greeting,
            noise_profile=job.noise_profile,
            run_id=job.run_id,
            job_id=job.job_id,
            persona_name=job.persona_name,
        )
        result.call_sid = call_sid
        print(f"[WORKER] {job.job_id} | Call SID: {call_sid}")
        db_call(repo.update_job, job.job_id, status="call_created", call_sid=call_sid)
        await publish_live_event(job.run_id, {
            "type": "call_created",
            "job_id": job.job_id,
            "persona_name": job.persona_name,
            "call_sid": call_sid,
        })

        # 2. Poll until call completes (or timeout)
        elapsed = 0
        status = "queued"
        while elapsed < CALL_TIMEOUT_SECONDS:
            status = await retry_async(f"fetch call status {call_sid}", get_call_status, call_sid)
            print(f"[WORKER] {job.job_id} | Call status: {status}")
            db_call(repo.update_job, job.job_id, status=status, call_sid=call_sid)
            await publish_live_event(job.run_id, {
                "type": "call_status",
                "job_id": job.job_id,
                "persona_name": job.persona_name,
                "call_sid": call_sid,
                "status": status,
            })
            if status in ("completed", "failed", "busy", "no-answer", "canceled"):
                break
            await asyncio.sleep(10)
            elapsed += 10

        # 3. Look up stream_sid from Redis (saved by call_manager on start event)
        # Use a dedicated client with decode_responses=True — ARQ's ctx["redis"] returns bytes
        from voiceprobe.core.redis_client import get_async_redis_client
        rdc = get_async_redis_client()
        stream_sid = None
        for attempt in range(12):  # up to 2 minutes maximum
            raw = await rdc.get(f"voiceprobe:sid:{call_sid}")
            if raw:
                stream_sid = raw if isinstance(raw, str) else raw.decode("utf-8")
                break
            
            # If the call is already over and we still don't have a stream SID after 30 seconds, give up
            if attempt >= 3 and status in ("completed", "failed", "busy", "no-answer", "canceled"):
                print(f"[WORKER] {job.job_id} | Call is {status} but no stream_sid found. Giving up.")
                break
                
            await asyncio.sleep(10)
        await rdc.aclose()


        result.stream_sid = stream_sid
        if stream_sid:
            db_call(repo.update_job, job.job_id, stream_sid=stream_sid)

        # 4. Read transcript
        transcript = None
        if stream_sid:
            transcript_path = os.path.join("recordings", stream_sid, "transcript.json")
            for attempt in range(12):  # Wait up to 60s for transcript to be written after call ends
                if os.path.exists(transcript_path):
                    with open(transcript_path, encoding="utf-8") as f:
                        transcript = json.load(f)
                    break
                await asyncio.sleep(5)

        result.transcript = transcript
        if transcript:
            db_call(repo.update_job, job.job_id, transcript=transcript)

        if not transcript or len(transcript) < 2:
            result.status = "no_transcript"
            print(f"[WORKER] {job.job_id} | No usable transcript")
            db_call(repo.update_job, job.job_id, status=result.status, error="No usable transcript")
            await publish_live_event(job.run_id, {
                "type": "job_finished",
                "job_id": job.job_id,
                "persona_name": job.persona_name,
                "status": result.status,
                "message": "No usable transcript",
            })
        else:
            # 5. Download recording
            recording_url = None
            for attempt in range(12):
                recording_url = await retry_async(f"fetch recording {call_sid}", get_call_recording, call_sid)
                if recording_url:
                    break
                await asyncio.sleep(10)

            if recording_url:
                safe_name = job.persona_name.replace(" ", "_")
                filename = f"recordings/{safe_name}_{call_sid}_run{job.run_number}.mp3"
                result.audio_path = download_recording(recording_url, filename)
                db_call(repo.update_job, job.job_id, audio_path=result.audio_path)

            # 6. Run loop detection
            loop_detection = detect_loops(transcript)
            result.loop_detection = loop_detection
            db_call(repo.update_job, job.job_id, loop_detection=loop_detection)
            if loop_detection["has_loops"]:
                print(f"[WORKER] {job.job_id} | Loop detected (severity: {loop_detection['loop_severity']})")

            # 7. Run evaluation
            evaluation = await score_call(
                transcript=transcript,
                persona_type=job.persona_type,
                persona_goal=job.persona_goal,
                target_context=job.target_context,
            )
            result.evaluation = evaluation
            result.status = "success"
            db_call(repo.update_job, job.job_id, status=result.status, evaluation=evaluation)
            print(f"[WORKER] {job.job_id} | Score: {evaluation['overall_score']}/100")
            await publish_live_event(job.run_id, {
                "type": "evaluation_completed",
                "job_id": job.job_id,
                "persona_name": job.persona_name,
                "status": result.status,
                "score": evaluation.get("overall_score"),
            })

    except Exception as e:
        result.error = str(e)
        result.status = "failed"
        print(f"[WORKER] {job.job_id} | ERROR: {e}")
        db_call(repo.update_job, job.job_id, status=result.status, error=str(e))
        await publish_live_event(job.run_id, {
            "type": "job_finished",
            "job_id": job.job_id,
            "persona_name": job.persona_name,
            "status": result.status,
            "error": str(e),
        })

    # Store result in Redis (TTL 24h)
    await r.set(
        f"voiceprobe:result:{job.job_id}",
        json.dumps(asdict(result), default=str),
        ex=86400,
    )
    db_call(
        repo.update_job,
        job.job_id,
        status=result.status,
        call_sid=result.call_sid,
        stream_sid=result.stream_sid,
        audio_path=result.audio_path,
        transcript=result.transcript,
        evaluation=result.evaluation,
        loop_detection=result.loop_detection,
        error=result.error,
    )
    print(f"[WORKER] {job.job_id} | Done — status: {result.status}")
    await publish_live_event(job.run_id, {
        "type": "job_finished",
        "job_id": job.job_id,
        "persona_name": job.persona_name,
        "status": result.status,
        "call_sid": result.call_sid,
        "stream_sid": result.stream_sid,
    })
    return result.status


class WorkerSettings:
    functions = [run_call_job]
    redis_settings = get_redis_settings()
    max_jobs = MAX_CONCURRENT_CALLS
    job_timeout = CALL_TIMEOUT_SECONDS + 120
    keep_result = 3600
