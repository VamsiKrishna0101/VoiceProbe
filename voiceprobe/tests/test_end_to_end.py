import sys
import os
import asyncio
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from voiceprobe.graph.call_graph import voice_probe_graph
from voiceprobe.evaluation.regression import compare_to_baseline, print_regression_report


async def main(config: dict = None, run_id: str = None):
    target_phone = os.getenv("MY_PHONE_NUMBER")
    ngrok_url = os.getenv("NGROK_URL", "").strip()

    if not target_phone:
        print("MY_PHONE_NUMBER not set in .env"); return
    if not ngrok_url:
        print("NGROK_URL not set in .env — run: venv\\Scripts\\python.exe tests\\start_ngrok.py"); return

    print("=" * 60)
    print("VoiceProbe — End-to-End Test")
    print("=" * 60)
    
    if not config:
        print("Starting in 5 seconds (CLI Mode)...")
        await asyncio.sleep(5)
        initial_state = {
            "target_phone_number": target_phone,
            "target_context": "DoorDash food delivery customer support agent",
            "noise_profile": "car",
            "runs_per_persona": 1,
            "personas": [
                {"type": "angry_customer"}
            ]
        }
    else:
        initial_state = config

    # Attach websocket URL
    initial_state["websocket_url"] = ngrok_url + "/media-stream"
    initial_state["run_id"] = run_id

    # Run the graph
    final_state = await voice_probe_graph.ainvoke(initial_state)

    print("\n" + "=" * 60)
    print("FINAL EVALUATION")
    print("=" * 60)
    print(f"Overall Score: {final_state.get('overall_score')}/100")

    # Metrics
    if final_state.get('latency_metrics'):
        print("\nLatency Metrics:")
        print(f"  Avg Turn   : {final_state['latency_metrics'].get('avg_latency_ms', 0)} ms")
        print(f"  P95 Turn   : {final_state['latency_metrics'].get('p95_latency_ms', 0)} ms")

    # Loop Detection
    if final_state.get("evaluations"):
        result = final_state["evaluations"][-1]
        loop_det = result.get("loop_detection")
        if loop_det and loop_det.get("has_loops"):
            print(f"  [WARNING] LOOP DETECTED (Severity: {loop_det['loop_severity'].upper()})")

    os.makedirs("recordings", exist_ok=True)
    out_path = f"recordings/final_report_{run_id}.json" if run_id else "recordings/final_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final_state, f, indent=2, ensure_ascii=False, default=str)
    
    if not config:
        print()
        regression = compare_to_baseline(out_path, final_state.get("target_context"))
        print_regression_report(regression)
        
    return final_state

if __name__ == "__main__":
    asyncio.run(main())
