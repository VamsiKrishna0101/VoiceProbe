"""
Save the current final_report.json as the regression baseline.

Usage:
    venv\\Scripts\\python.exe tests\\save_baseline.py
    venv\\Scripts\\python.exe tests\\save_baseline.py --report recordings/final_report.json
"""
import sys
import os
import argparse

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from voiceprobe.evaluation.regression import save_baseline, context_to_baseline_name
import json

def main():
    parser = argparse.ArgumentParser(description="Save VoiceProbe regression baseline")
    parser.add_argument(
        "--report",
        default="recordings/final_report.json",
        help="Path to final_report.json (default: recordings/final_report.json)",
    )
    parser.add_argument(
        "--context",
        default=None,
        help="Override baseline name context (default: auto-derived from report's target_context)",
    )
    args = parser.parse_args()

    if not os.path.exists(args.report):
        print(f"ERROR: Report not found at '{args.report}'")
        print("  Run test_end_to_end.py first to generate a report.")
        sys.exit(1)

    # Show what context/name will be used
    with open(args.report, encoding="utf-8") as f:
        report = json.load(f)
    context = args.context or report.get("target_context", "default")
    baseline_name = context_to_baseline_name(context)

    print(f"Saving baseline...")
    print(f"  Report      : {args.report}")
    print(f"  Context     : {context}")
    print(f"  Baseline ID : {baseline_name}")

    try:
        out_path = save_baseline(args.report, context)
        print(f"  Saved to    : {out_path}")
        print()
        print("Baseline saved. Future runs of test_end_to_end.py will compare against this baseline.")
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
