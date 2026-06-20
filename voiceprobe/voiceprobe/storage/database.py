import os
from contextlib import contextmanager
from typing import Iterator

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://voiceprobe:voiceprobe@127.0.0.1:5433/voiceprobe",
)


def database_available() -> bool:
    try:
        import psycopg  # noqa: F401
        return True
    except ImportError:
        return False


@contextmanager
def get_connection() -> Iterator["psycopg.Connection"]:
    import psycopg

    conn = psycopg.connect(DATABASE_URL, autocommit=True, connect_timeout=1)
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> bool:
    if not database_available():
        print("[DB] psycopg is not installed; PostgreSQL persistence disabled.")
        return False

    statements = [
        """
        CREATE TABLE IF NOT EXISTS voiceprobe_runs (
            run_id TEXT PRIMARY KEY,
            run_type TEXT NOT NULL,
            status TEXT NOT NULL,
            target_phone_number TEXT,
            target_context TEXT,
            config JSONB NOT NULL DEFAULT '{}'::jsonb,
            result JSONB,
            error TEXT,
            report_path TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS voiceprobe_jobs (
            job_id TEXT PRIMARY KEY,
            run_id TEXT REFERENCES voiceprobe_runs(run_id) ON DELETE SET NULL,
            persona_name TEXT,
            persona_type TEXT,
            run_number INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL,
            call_sid TEXT,
            stream_sid TEXT,
            audio_path TEXT,
            transcript JSONB,
            evaluation JSONB,
            loop_detection JSONB,
            error TEXT,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_voiceprobe_runs_created_at ON voiceprobe_runs(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_voiceprobe_runs_status ON voiceprobe_runs(status)",
        "CREATE INDEX IF NOT EXISTS idx_voiceprobe_jobs_run_id ON voiceprobe_jobs(run_id)",
        "CREATE INDEX IF NOT EXISTS idx_voiceprobe_jobs_status ON voiceprobe_jobs(status)",
    ]

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                for statement in statements:
                    cur.execute(statement)
        print("[DB] PostgreSQL persistence ready.")
        return True
    except Exception as exc:
        print(f"[DB] PostgreSQL unavailable: {exc}")
        return False
