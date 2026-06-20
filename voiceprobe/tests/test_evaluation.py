import sys
import os
import asyncio
import glob
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from voiceprobe.evaluation.scorer import score_call
from voiceprobe.evaluation.failure_classifier import classify_failures

PERSONA_TYPE = "angry customer"
PERSONA_GOAL = "Get a refund for a late DoorDash order"
TARGET_CONTEXT = "DoorDash food delivery support agent"


async def main():
    transcript_files = sorted(glob.glob("recordings/*/transcript.json"))

    if not transcript_files:
        print("No transcripts found in recordings/*/transcript.json")
        print("Run a streaming call first with: venv\\Scripts\\python.exe tests\\test_streaming.py")
        return

    print(f"Found {len(transcript_files)} transcript(s)\n")

    all_evaluations = []

    for path in transcript_files:
        with open(path, encoding="utf-8") as f:
            transcript = json.load(f)

        print(f"Evaluating: {path} ({len(transcript)} turns)")

        if len(transcript) < 2:
            print("  Skipped — too short\n")
            continue

        result = await score_call(
            transcript=transcript,
            persona_type=PERSONA_TYPE,
            persona_goal=PERSONA_GOAL,
            target_context=TARGET_CONTEXT,
        )

        all_evaluations.append(result)

        print(f"\n  Overall Score : {result['overall_score']}/100  (raw: {result['raw_score']}, latency penalty: -{result['latency_penalty']})")
        print(f"  Summary       : {result['summary']}")
        print(f"  Strengths     : {result['strengths']}")
        print(f"  Weaknesses    : {result['weaknesses']}")
        print(f"  Failed at     : {result['failed_at']}")
        print(f"  Avg latency   : {result['latency']['avg_latency_ms']} ms")
        print(f"  Slow turns    : {result['latency']['slow_turn_count']}\n")

    if len(all_evaluations) > 1:
        print("=" * 60)
        print("Running failure classification across all calls...")
        analysis = await classify_failures(
            evaluation_results=all_evaluations,
            target_context=TARGET_CONTEXT,
        )
        print(f"\n  Reliability Score     : {analysis['overall_reliability_score']}/100")
        print(f"  Most Critical Failure : {analysis['most_critical_failure']}")
        print(f"  Patterns Found        : {len(analysis['patterns'])}")
        for p in analysis["patterns"]:
            print(f"    [{p['severity'].upper()}] {p['pattern']} ({p['frequency']} calls)")
        print(f"  Recommended Fixes     : {analysis['recommended_fixes']}")

asyncio.run(main())
