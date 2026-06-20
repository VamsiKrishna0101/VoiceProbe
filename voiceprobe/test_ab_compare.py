"""
VoiceProbe A/B Prompt Comparison Test

Runs the exact same personas against two different agents (phone numbers)
in parallel, then produces a side-by-side score report.

Usage:
    venv\\Scripts\\python.exe test_ab_compare.py

Configuration: edit the AB_CONFIG section below.
"""
import sys
import os
import asyncio
import json
import uuid
import copy

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from voiceprobe.personas.generator import generate_persona_variations
from voiceprobe.core.redis_client import get_redis_settings, get_async_redis_client
from voiceprobe.evaluation.ab_compare import generate_ab_report, print_ab_report
from voiceprobe.core.llm import call_llm
from voiceprobe.storage import repositories as repo


def db_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        print(f"[DB] {fn.__name__} failed: {exc}")
        return None

# ─────────────────────────────────────────────────────────────
# AB_CONFIG — edit this section before running
# ─────────────────────────────────────────────────────────────
AB_CONFIG = {
    # Agent A: the current / baseline version
    "agent_a": {
        "label":  "Agent A (Current Prompt)",
        "phone":  os.getenv("MY_PHONE_NUMBER", "+917337047903"),
    },
    "agent_b": {
        "label":  "Agent B (New Prompt)",
        "phone":  os.getenv("AGENT_B_PHONE", os.getenv("MY_PHONE_NUMBER", "+917337047903")),
    },
    "target_context":  "DoorDash food delivery customer support agent",
    "noise_profile":   "none",  # Try: 'car', 'street', 'static', 'cafe', or 'none'
    "persona_types":   ["angry_customer"],     # Add more types to broaden coverage
    "runs_per_persona": 1,                     # How many times each persona runs per agent
    "call_timeout":    int(os.getenv("VOICEPROBE_CALL_TIMEOUT", 300)),
}


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

async def _generate_personas(persona_types: list, target_context: str, runs: int) -> list:
    """Generate persona variations with pre-generated greetings."""
    all_variations = []
    for ptype in persona_types:
        print(f"  Generating {runs} variation(s) for [{ptype}]...")
        variations = await generate_persona_variations(ptype, target_context, runs)
        all_variations.extend(variations)

    print(f"  Pre-generating {len(all_variations)} greeting(s)...")
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

    return all_variations


async def _submit_jobs(personas: list, phone: str, agent_tag: str, run_id: str = None) -> list:
    """Submit all persona jobs for one agent to the Redis queue. Returns list of job_ids."""
    from arq import create_pool
    websocket_url = os.getenv("NGROK_URL", "").strip() + "/media-stream"
    redis_pool = await create_pool(get_redis_settings())

    job_ids = []
    for persona in personas:
        job_id = str(uuid.uuid4())
        job_data = {
            "job_id":       job_id,
            "run_id":       run_id,
            "persona_name": persona["name"],
            "persona_type": persona["type"],
            "persona_goal": persona["goal"],
            "system_prompt": persona["system_prompt"],
            "greeting":     persona.get("greeting", "Hello, I need some help."),
            "phone_number": phone,
            "websocket_url": websocket_url,
            "target_context": AB_CONFIG["target_context"],
            "noise_profile": AB_CONFIG.get("noise_profile", "none"),
            "run_number":   persona.get("run_number", 1),
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
        print(f"  [{agent_tag}] Queued: {persona['name']} run #{persona.get('run_number',1)} → {job_id[:8]}...")
        await asyncio.sleep(1)  # slight stagger to avoid Twilio burst

    await redis_pool.aclose()
    return job_ids


async def _wait_for_jobs(job_ids: list, label: str, timeout: int) -> dict:
    """Poll Redis until all jobs in the list have results. Returns {job_id: result_dict}."""
    r = get_async_redis_client()
    results = {}
    elapsed = 0
    total = len(job_ids)

    while elapsed < timeout * total:
        done = 0
        for jid in job_ids:
            if jid in results:
                done += 1
                continue
            raw = await r.get(f"voiceprobe:result:{jid}")
            if raw:
                results[jid] = json.loads(raw)
                done += 1

        bar_filled = int((done / total) * 20)
        bar = "█" * bar_filled + "░" * (20 - bar_filled)
        print(f"  [{label}] Progress: [{bar}] {done}/{total}", end="\r")

        if done >= total:
            break
        await asyncio.sleep(10)
        elapsed += 10

    await r.aclose()
    print(f"\n  [{label}] All {len(results)} results collected.")
    return results


def _build_call_results(job_ids: list, results_by_id: dict) -> list:
    """Convert Redis result dicts into call_results list format."""
    call_results = []
    for jid in job_ids:
        res = results_by_id.get(jid, {})
        call_results.append({
            "job_id":        jid,
            "persona_name":  res.get("persona_name", ""),
            "persona_type":  res.get("persona_type", ""),
            "run_number":    res.get("run_number", 1),
            "call_sid":      res.get("call_sid"),
            "audio_path":    res.get("audio_path"),
            "transcript":    res.get("transcript"),
            "evaluation":    res.get("evaluation"),
            "loop_detection": res.get("loop_detection"),
        })
    return call_results


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

async def main(config: dict = None, run_id: str = None):
    ngrok_url = os.getenv("NGROK_URL", "").strip()
    if not ngrok_url:
        print("ERROR: NGROK_URL not set in .env — run: venv\\Scripts\\python.exe tests\\start_ngrok.py")
        return

    cfg = config if config else AB_CONFIG
    label_a = cfg["agent_a"]["label"]
    label_b = cfg["agent_b"]["label"]
    phone_a = cfg["agent_a"]["phone"]
    phone_b = cfg["agent_b"]["phone"]

    print("═" * 65)
    print("  VoiceProbe — A/B Prompt Comparison".center(65))
    print("═" * 65)
    print(f"  Agent A : {label_a}")
    print(f"  Phone A : {phone_a}")
    print(f"  Agent B : {label_b}")
    print(f"  Phone B : {phone_b}")
    print(f"  Context : {cfg['target_context']}")
    print(f"  Personas: {', '.join(cfg['persona_types'])}")
    print(f"  Runs/persona: {cfg['runs_per_persona']}")
    total_calls = len(cfg["persona_types"]) * cfg["runs_per_persona"] * 2
    print(f"  Total calls: {total_calls} ({total_calls // 2} per agent)")
    print()
    print("  Required:")
    print("  T1: venv\\Scripts\\uvicorn.exe voiceprobe.calls.call_manager:app --reload --port 8000")
    print("  T2: venv\\Scripts\\python.exe start_worker.py")
    print("═" * 65)
    print("Starting in 5 seconds...")
    await asyncio.sleep(5)

    # Step 1: Generate personas ONCE — used identically by both agents
    print("\n[1/4] Generating personas (shared by both agents)...")
    personas = await _generate_personas(
        cfg["persona_types"], cfg["target_context"], cfg["runs_per_persona"]
    )
    print(f"  {len(personas)} persona(s) ready.")

    # Detect if same phone number — must run sequentially to avoid call collision
    same_phone = (phone_a.strip() == phone_b.strip())

    # Step 2: Submit and wait
    if same_phone:
        print(f"\n⚠️  Same phone number detected — running SEQUENTIALLY (A then B)")
        print("   (Set different phone numbers for true parallel execution)\n")

        print("[2/4] Submitting Agent A jobs...")
        job_ids_a = await _submit_jobs(personas, phone_a, label_a, run_id)
        print(f"  {len(job_ids_a)} jobs queued for Agent A")

        print(f"\n[3a/4] Waiting for Agent A ({len(job_ids_a)} calls) to complete...")
        results_a = await _wait_for_jobs(job_ids_a, label_a, cfg["call_timeout"])

        # Wait a few seconds between agents so the line clears
        print("\n  Pausing 10s before Agent B starts...")
        await asyncio.sleep(10)

        print("\n[3b/4] Submitting Agent B jobs...")
        job_ids_b = await _submit_jobs(personas, phone_b, label_b, run_id)
        print(f"  {len(job_ids_b)} jobs queued for Agent B")

        print(f"\n[3c/4] Waiting for Agent B ({len(job_ids_b)} calls) to complete...")
        results_b = await _wait_for_jobs(job_ids_b, label_b, cfg["call_timeout"])

    else:
        # Different phone numbers — submit and wait in parallel
        print("\n[2/4] Submitting jobs to Redis queue (parallel — different phone numbers)...")
        job_ids_a, job_ids_b = await asyncio.gather(
            _submit_jobs(personas, phone_a, label_a, run_id),
            _submit_jobs(personas, phone_b, label_b, run_id),
        )
        print(f"\n  {len(job_ids_a)} jobs queued for Agent A")
        print(f"  {len(job_ids_b)} jobs queued for Agent B")

        print(f"\n[3/4] Waiting for {len(job_ids_a) + len(job_ids_b)} calls to complete...")
        results_a, results_b = await asyncio.gather(
            _wait_for_jobs(job_ids_a, label_a, cfg["call_timeout"]),
            _wait_for_jobs(job_ids_b, label_b, cfg["call_timeout"]),
        )


    # Step 4: Build reports and compare
    print("\n[4/4] Generating A/B comparison report...")
    call_results_a = _build_call_results(job_ids_a, results_a)
    call_results_b = _build_call_results(job_ids_b, results_b)

    report_a = {
        "target_phone_number": phone_a,
        "target_context":      cfg["target_context"],
        "call_results":        call_results_a,
    }
    report_b = {
        "target_phone_number": phone_b,
        "target_context":      cfg["target_context"],
        "call_results":        call_results_b,
    }

    ab_report = await generate_ab_report(report_a, report_b, label_a, label_b)

    # Print the beautiful table
    print_ab_report(ab_report)

    # Save to disk
    os.makedirs("recordings", exist_ok=True)
    out_path = f"recordings/ab_report_{run_id}.json" if run_id else "recordings/ab_report.json"
    full_output = {
        "ab_comparison": ab_report,
        "raw_report_a":  report_a,
        "raw_report_b":  report_b,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(full_output, f, indent=2, ensure_ascii=False, default=str)
    
    if not config:
        print(f"  Full A/B report saved: {out_path}")

    return full_output

if __name__ == "__main__":
    asyncio.run(main())
