import datetime
import json
from typing import Any, Dict, List, Optional

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from voiceprobe.storage.database import get_connection


def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def create_run(
    run_id: str,
    run_type: str,
    status: str,
    config: Dict[str, Any],
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO voiceprobe_runs (
                    run_id, run_type, status, target_phone_number, target_context, config, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (run_id) DO UPDATE SET
                    run_type = EXCLUDED.run_type,
                    status = EXCLUDED.status,
                    target_phone_number = EXCLUDED.target_phone_number,
                    target_context = EXCLUDED.target_context,
                    config = EXCLUDED.config,
                    updated_at = NOW()
                """,
                (
                    run_id,
                    run_type,
                    status,
                    config.get("target_phone_number"),
                    config.get("target_context"),
                    Jsonb(config),
                ),
            )


def update_run_status(
    run_id: str,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    report_path: Optional[str] = None,
) -> None:
    completed = status in {"completed", "failed", "inconclusive"}
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE voiceprobe_runs
                SET status = %s,
                    result = COALESCE(%s, result),
                    error = %s,
                    report_path = COALESCE(%s, report_path),
                    updated_at = NOW(),
                    completed_at = CASE WHEN %s THEN NOW() ELSE completed_at END
                WHERE run_id = %s
                """,
                (
                    status,
                    Jsonb(result) if result is not None else None,
                    error,
                    report_path,
                    completed,
                    run_id,
                ),
            )


def get_run(run_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT * FROM voiceprobe_runs WHERE run_id = %s", (run_id,))
            row = cur.fetchone()
            return dict(row) if row else None


def list_runs(limit: int = 100) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT *
                FROM voiceprobe_runs
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(row) for row in cur.fetchall()]


def create_job(
    job_id: str,
    run_id: Optional[str],
    persona_name: str,
    persona_type: str,
    run_number: int,
    status: str = "queued",
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO voiceprobe_jobs (
                    job_id, run_id, persona_name, persona_type, run_number, status, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (job_id) DO UPDATE SET
                    run_id = EXCLUDED.run_id,
                    persona_name = EXCLUDED.persona_name,
                    persona_type = EXCLUDED.persona_type,
                    run_number = EXCLUDED.run_number,
                    status = EXCLUDED.status,
                    updated_at = NOW()
                """,
                (job_id, run_id, persona_name, persona_type, run_number, status),
            )


def update_job(
    job_id: str,
    status: Optional[str] = None,
    call_sid: Optional[str] = None,
    stream_sid: Optional[str] = None,
    audio_path: Optional[str] = None,
    transcript: Optional[list] = None,
    evaluation: Optional[dict] = None,
    loop_detection: Optional[dict] = None,
    error: Optional[str] = None,
    increment_attempt: bool = False,
) -> None:
    completed_statuses = {"success", "failed", "no_transcript", "canceled", "busy", "no-answer"}
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE voiceprobe_jobs
                SET status = COALESCE(%s, status),
                    call_sid = COALESCE(%s, call_sid),
                    stream_sid = COALESCE(%s, stream_sid),
                    audio_path = COALESCE(%s, audio_path),
                    transcript = COALESCE(%s, transcript),
                    evaluation = COALESCE(%s, evaluation),
                    loop_detection = COALESCE(%s, loop_detection),
                    error = %s,
                    attempt_count = attempt_count + %s,
                    updated_at = NOW(),
                    completed_at = CASE WHEN %s THEN NOW() ELSE completed_at END
                WHERE job_id = %s
                """,
                (
                    status,
                    call_sid,
                    stream_sid,
                    audio_path,
                    Jsonb(transcript) if transcript is not None else None,
                    Jsonb(evaluation) if evaluation is not None else None,
                    Jsonb(loop_detection) if loop_detection is not None else None,
                    error,
                    1 if increment_attempt else 0,
                    status in completed_statuses if status else False,
                    job_id,
                ),
            )


def get_jobs_for_run(run_id: str) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT *
                FROM voiceprobe_jobs
                WHERE run_id = %s
                ORDER BY created_at ASC
                """,
                (run_id,),
            )
            return [dict(row) for row in cur.fetchall()]
