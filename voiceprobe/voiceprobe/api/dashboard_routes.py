import os
import sys
import json
import uuid
import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# Ensure parent directory is in path to import tests
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from tests.test_end_to_end import main as run_end_to_end
from test_ab_compare import main as run_ab_compare
from test_security import main as run_security
from voiceprobe.core.live_events import live_channel, live_history_key, publish_live_event
from voiceprobe.core.redis_client import get_async_redis_client
from voiceprobe.storage import repositories as repo

router = APIRouter(prefix="/api")

active_runs: Dict[str, Dict[str, Any]] = {}
SECURITY_PERSONAS = {"prompt_injector", "social_engineer", "policy_bypasser"}


def db_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        print(f"[DB] {fn.__name__} failed: {exc}")
        return None

class EndToEndConfig(BaseModel):
    target_phone_number: str
    target_context: str
    noise_profile: str = "none"
    runs_per_persona: int = 1
    personas: List[Dict[str, str]]

class AgentConfig(BaseModel):
    label: str
    phone: str

class ABCompareConfig(BaseModel):
    agent_a: AgentConfig
    agent_b: AgentConfig
    target_context: str
    noise_profile: str = "none"
    runs_per_persona: int = 1
    persona_types: List[str]
    call_timeout: int = 300

class SecurityConfig(BaseModel):
    target_phone_number: str
    target_context: str
    persona_types: List[str]
    attack_prompts: Dict[str, str] = Field(default_factory=dict)
    runs_per_persona: int = 1
    call_timeout: int = 300

def validate_security_prompts(personas: List[Dict[str, str]]):
    missing = [
        persona["type"]
        for persona in personas
        if persona.get("type") in SECURITY_PERSONAS and not (persona.get("attack_prompt") or "").strip()
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Custom attack instruction required for: {', '.join(missing)}",
        )

async def execute_task_in_background(run_id: str, task_func, config_dict: dict, task_type: str):
    try:
        active_runs[run_id] = {"status": "running", "type": task_type}
        db_call(repo.update_run_status, run_id, "running")
        await publish_live_event(run_id, {"type": "run_status", "status": "running", "test_type": task_type})
        result = await task_func(config=config_dict, run_id=run_id)
        active_runs[run_id] = {"status": "completed", "type": task_type, "result": result}
        db_call(repo.update_run_status, run_id, "completed", result=result)
        await publish_live_event(run_id, {"type": "run_status", "status": "completed", "test_type": task_type})
    except Exception as e:
        active_runs[run_id] = {"status": "failed", "type": task_type, "error": str(e)}
        db_call(repo.update_run_status, run_id, "failed", error=str(e))
        await publish_live_event(run_id, {"type": "run_status", "status": "failed", "test_type": task_type, "error": str(e)})

@router.post("/tests/run")
async def start_end_to_end(config: EndToEndConfig, background_tasks: BackgroundTasks):
    validate_security_prompts(config.personas)
    run_id = str(uuid.uuid4())
    active_runs[run_id] = {"status": "queued", "type": "end_to_end"}
    db_call(repo.create_run, run_id, "end_to_end", "queued", config.model_dump())
    background_tasks.add_task(execute_task_in_background, run_id, run_end_to_end, config.model_dump(), "end_to_end")
    return {"run_id": run_id, "status": "started"}

@router.post("/tests/ab")
async def start_ab_compare(config: ABCompareConfig, background_tasks: BackgroundTasks):
    run_id = str(uuid.uuid4())
    active_runs[run_id] = {"status": "queued", "type": "ab_compare"}
    db_call(repo.create_run, run_id, "ab_compare", "queued", config.model_dump())
    background_tasks.add_task(execute_task_in_background, run_id, run_ab_compare, config.model_dump(), "ab_compare")
    return {"run_id": run_id, "status": "started"}

@router.post("/tests/security")
async def start_security(config: SecurityConfig, background_tasks: BackgroundTasks):
    missing = [
        persona_type for persona_type in config.persona_types
        if persona_type in SECURITY_PERSONAS and not (config.attack_prompts.get(persona_type) or "").strip()
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Custom attack instruction required for: {', '.join(missing)}",
        )
    run_id = str(uuid.uuid4())
    active_runs[run_id] = {"status": "queued", "type": "security"}
    db_call(repo.create_run, run_id, "security", "queued", config.model_dump())
    background_tasks.add_task(execute_task_in_background, run_id, run_security, config.model_dump(), "security")
    return {"run_id": run_id, "status": "started"}

@router.websocket("/tests/ws/{run_id}")
async def stream_test_events(websocket: WebSocket, run_id: str):
    await websocket.accept()
    redis = get_async_redis_client()
    pubsub = redis.pubsub()
    try:
        history = await redis.lrange(live_history_key(run_id), 0, -1)
        for item in history:
            await websocket.send_text(item if isinstance(item, str) else item.decode("utf-8"))

        await pubsub.subscribe(live_channel(run_id))
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("type") == "message":
                data = message.get("data")
                await websocket.send_text(data if isinstance(data, str) else data.decode("utf-8"))
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await pubsub.unsubscribe(live_channel(run_id))
            await pubsub.aclose()
        finally:
            await redis.aclose()

@router.get("/tests/status/{run_id}")
async def get_test_status(run_id: str):
    if run_id in active_runs:
        return active_runs[run_id]
    db_run = db_call(repo.get_run, run_id)
    if db_run:
        response = {
            "status": db_run["status"],
            "type": db_run["run_type"],
        }
        if db_run.get("result") is not None:
            response["result"] = db_run["result"]
        if db_run.get("error"):
            response["error"] = db_run["error"]
        return response
    raise HTTPException(status_code=404, detail="Run ID not found")

@router.get("/reports")
async def list_reports():
    db_runs = db_call(repo.list_runs, 100)
    if db_runs:
        return [
            {
                "id": row["run_id"],
                "type": row["run_type"],
                "status": row["status"],
                "timestamp": row["created_at"].timestamp(),
                "data": row.get("result"),
            }
            for row in db_runs
            if row["status"] in {"completed", "failed", "inconclusive"}
        ]

    recordings_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "recordings")
    if not os.path.exists(recordings_dir):
        return []
    
    reports = []
    for filename in os.listdir(recordings_dir):
        if filename.endswith(".json"):
            filepath = os.path.join(recordings_dir, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                    rtype = "end_to_end"
                    if "ab_comparison" in data:
                        rtype = "ab_compare"
                    elif "jailbreaks" in data:
                        rtype = "security"

                    reports.append({
                        "id": filename,
                        "type": rtype,
                        "timestamp": os.path.getmtime(filepath)
                    })
            except Exception:
                pass
    
    reports.sort(key=lambda x: x["timestamp"], reverse=True)
    return reports

@router.get("/reports/{report_id}")
async def get_report_details(report_id: str):
    db_run = db_call(repo.get_run, report_id)
    if db_run:
        if db_run.get("result") is not None:
            return db_run["result"]
        return {
            "run_id": db_run["run_id"],
            "type": db_run["run_type"],
            "status": db_run["status"],
            "error": db_run.get("error"),
            "config": db_run.get("config"),
            "jobs": db_call(repo.get_jobs_for_run, report_id) or [],
        }

    recordings_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "recordings")
    filepath = os.path.join(recordings_dir, report_id)
    
    if not os.path.exists(filepath) or not report_id.endswith(".json"):
        raise HTTPException(status_code=404, detail="Report not found")
        
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)
