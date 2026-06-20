import asyncio
import json
import os
import uuid

from voiceprobe.personas.generator import generate_persona_variations
from voiceprobe.graph.state import VoiceProbeState
from voiceprobe.evaluation.failure_classifier import classify_failures
from voiceprobe.core.redis_client import get_redis_settings
from voiceprobe.storage import repositories as repo


def db_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        print(f"[DB] {fn.__name__} failed: {exc}")
        return None


async def generate_personas_node(state: VoiceProbeState) -> VoiceProbeState:
    """
    For each persona type, generate `runs_per_persona` distinct system prompt variations.
    Also pre-generates a greeting for each variation to avoid LLM latency on call connect.
    """
    from voiceprobe.core.llm import call_llm

    runs = state.get("runs_per_persona", 1)
    target_context = state["target_context"]

    all_variations = []
    for persona_config in state["personas"]:
        ptype = persona_config["type"]
        attack_instruction = persona_config.get("attack_prompt") or persona_config.get("attack_instruction")
        print(f"  Generating {runs} variation(s) for [{ptype}]...")
        variations = await generate_persona_variations(ptype, target_context, runs, attack_instruction)
        all_variations.extend(variations)

    # Pre-generate opening greeting for each variation
    greeting_tasks = [
        call_llm(
            v["system_prompt"],
            "Generate ONE natural sentence you would say when a customer support agent picks up your call. Just the spoken sentence, no quotes.",
            temperature=0.9,
        )
        for v in all_variations
    ]
    greetings = await asyncio.gather(*greeting_tasks)
    for variation, greeting in zip(all_variations, greetings):
        variation["greeting"] = greeting.strip().strip('"')

    print(f"  Total personas generated: {len(all_variations)}")
    return {**state, "personas": all_variations}


async def submit_jobs_node(state: VoiceProbeState) -> VoiceProbeState:
    """
    Submit one ARQ job per persona variation. Returns immediately — workers process async.
    """
    from arq import create_pool

    websocket_url = os.getenv("NGROK_URL", "").strip() + "/media-stream"
    redis_pool = await create_pool(get_redis_settings())

    job_ids = []
    run_id = state.get("run_id")
    for persona in state["personas"]:
        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "run_id": run_id,
            "persona_name": persona["name"],
            "persona_type": persona["type"],
            "persona_goal": persona["goal"],
            "system_prompt": persona["system_prompt"],
            "greeting": persona.get("greeting", "Hello, I need help with my order."),
            "phone_number": state["target_phone_number"],
            "websocket_url": websocket_url,
            "target_context": state["target_context"],
            "noise_profile": state.get("noise_profile", "none"),
            "run_number": persona.get("run_number", 1),
        }
        await redis_pool.enqueue_job("run_call_job", job_data, _job_id=job_id)
        db_call(
            repo.create_job,
            job_id,
            run_id,
            persona["name"],
            persona["type"],
            persona.get("run_number", 1),
            "queued",
        )
        job_ids.append(job_id)
        print(f"  Queued job {job_id[:8]}... [{persona['name']} run #{persona.get('run_number', 1)}]")
        await asyncio.sleep(1)  # Stagger submissions slightly

    await redis_pool.aclose()
    print(f"  {len(job_ids)} jobs submitted to queue.")
    return {**state, "job_ids": job_ids}


async def wait_for_results_node(state: VoiceProbeState) -> VoiceProbeState:
    """
    Poll Redis until all submitted jobs have results. Shows live progress.
    """
    import redis.asyncio as aioredis
    from voiceprobe.core.redis_client import get_async_redis_client

    job_ids = state["job_ids"]
    total = len(job_ids)
    print(f"  Waiting for {total} jobs to complete...")

    r = get_async_redis_client()
    timeout = int(os.getenv("VOICEPROBE_CALL_TIMEOUT", 300)) + 120
    elapsed = 0
    results_by_id = {}

    while elapsed < timeout * total:
        done = 0
        for jid in job_ids:
            if jid in results_by_id:
                done += 1
                continue
            raw = await r.get(f"voiceprobe:result:{jid}")
            if raw:
                results_by_id[jid] = json.loads(raw)
                done += 1

        bar_filled = int((done / total) * 20)
        bar = "█" * bar_filled + "░" * (20 - bar_filled)
        print(f"  Progress: [{bar}] {done}/{total}", end="\r")

        if done >= total:
            break
        await asyncio.sleep(10)
        elapsed += 10

    await r.aclose()
    print(f"\n  All {len(results_by_id)} results collected.")

    # Build call_results list in submission order
    call_results = []
    for jid in job_ids:
        res = results_by_id.get(jid, {})
        call_results.append({
            "persona_name": res.get("persona_name", ""),
            "persona_type": res.get("persona_type", ""),
            "run_number": res.get("run_number", 1),
            "job_id": jid,
            "call_sid": res.get("call_sid"),
            "recording_url": None,
            "audio_path": res.get("audio_path"),
            "transcript": res.get("transcript"),
            "evaluation": res.get("evaluation"),
            "loop_detection": res.get("loop_detection"),
        })

    return {**state, "call_results": call_results}


async def classify_failures_node(state: VoiceProbeState) -> VoiceProbeState:
    evaluation_results = [
        r["evaluation"] for r in state["call_results"]
        if r.get("evaluation") is not None
    ]

    failure_analysis = None
    if evaluation_results:
        print(f"  Classifying failures across {len(evaluation_results)} calls...")
        failure_analysis = await classify_failures(
            evaluation_results=evaluation_results,
            target_context=state["target_context"],
        )
        print(f"  Reliability score: {failure_analysis.get('overall_reliability_score', 'N/A')}/100")
    else:
        print("  No evaluations available for failure classification")

    return {**state, "failure_analysis": failure_analysis}
