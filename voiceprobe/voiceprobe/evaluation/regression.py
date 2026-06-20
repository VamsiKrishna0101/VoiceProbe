"""
Regression testing for VoiceProbe.

Workflow:
  1. Run test_end_to_end.py -> good results -> run save_baseline.py to save baseline
  2. Agent prompt changes -> run test_end_to_end.py again
  3. Auto-comparison flags any metric that dropped >5%
"""
import json
import os
import re
import datetime
from typing import Optional

BASELINE_DIR = os.path.join("recordings", "baselines")
REGRESSION_THRESHOLD = float(os.getenv("VOICEPROBE_REGRESSION_THRESHOLD", 5.0))


def context_to_baseline_name(target_context: str) -> str:
    """
    Derive a filesystem-safe baseline name from the target_context string.
    e.g. "DoorDash food delivery customer support agent" -> "doordash"
    """
    # Take the first meaningful word, lowercase, strip non-alphanumeric
    first_word = target_context.strip().split()[0]
    safe = re.sub(r'[^a-z0-9]', '', first_word.lower())
    return safe or "default"


def extract_scores(report: dict) -> dict:
    """
    Aggregate scores from all call_results that have an evaluation.
    Returns a flat dict of metric -> mean value.
    """
    call_results = report.get("call_results", [])
    evaluations = [r["evaluation"] for r in call_results if r.get("evaluation")]

    if not evaluations:
        return {}

    count = len(evaluations)
    aggregated = {}

    # Top-level numeric metrics
    for key in ("overall_score", "raw_score", "latency_penalty"):
        values = [e[key] for e in evaluations if key in e and isinstance(e[key], (int, float))]
        if values:
            aggregated[key] = round(sum(values) / len(values), 2)

    # Latency metrics
    for key in ("avg_latency_ms", "p95_latency_ms"):
        values = [e["latency"][key] for e in evaluations if isinstance(e.get("latency"), dict) and key in e["latency"]]
        if values:
            aggregated[key] = round(sum(values) / len(values), 2)

    # Sub-scores (nested dict)
    all_sub_keys = set()
    for e in evaluations:
        if isinstance(e.get("scores"), dict):
            all_sub_keys.update(e["scores"].keys())

    for sub_key in all_sub_keys:
        values = [
            e["scores"][sub_key]
            for e in evaluations
            if isinstance(e.get("scores"), dict)
            and sub_key in e["scores"]
            and isinstance(e["scores"][sub_key], (int, float))
        ]
        if values:
            aggregated[sub_key] = round(sum(values) / len(values), 2)

    # Loop stats
    loop_results = [r.get("loop_detection") for r in call_results if r.get("loop_detection")]
    if loop_results:
        loop_rate = sum(1 for l in loop_results if l.get("has_loops")) / len(loop_results)
        aggregated["loop_rate"] = round(loop_rate, 3)

    return aggregated


def save_baseline(report_path: str, target_context: Optional[str] = None) -> str:
    """
    Read a final_report.json and save its aggregated scores as a baseline.
    Returns the path to the saved baseline file.
    """
    with open(report_path, encoding="utf-8") as f:
        report = json.load(f)

    if target_context is None:
        target_context = report.get("target_context", "default")

    baseline_name = context_to_baseline_name(target_context)
    scores = extract_scores(report)

    if not scores:
        raise ValueError("No evaluation scores found in report. Run at least one call with evaluation first.")

    baseline = {
        "baseline_name": baseline_name,
        "target_context": target_context,
        "saved_at": datetime.datetime.utcnow().isoformat(),
        "source_report": os.path.abspath(report_path),
        "num_calls": len([r for r in report.get("call_results", []) if r.get("evaluation")]),
        "scores": scores,
    }

    os.makedirs(BASELINE_DIR, exist_ok=True)
    out_path = os.path.join(BASELINE_DIR, f"{baseline_name}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(baseline, f, indent=2)

    return out_path


def compare_to_baseline(
    report_path: str,
    target_context: Optional[str] = None,
    threshold_pct: float = REGRESSION_THRESHOLD,
) -> Optional[dict]:
    """
    Compare current report scores against the saved baseline.
    Returns a regression report dict, or None if no baseline exists.
    """
    with open(report_path, encoding="utf-8") as f:
        report = json.load(f)

    if target_context is None:
        target_context = report.get("target_context", "default")

    baseline_name = context_to_baseline_name(target_context)
    baseline_path = os.path.join(BASELINE_DIR, f"{baseline_name}.json")

    if not os.path.exists(baseline_path):
        return None

    with open(baseline_path, encoding="utf-8") as f:
        baseline = json.load(f)

    current_scores = extract_scores(report)
    baseline_scores = baseline.get("scores", {})

    # Compare all metrics present in the baseline
    metric_results = []
    regression_count = 0

    for metric, baseline_val in baseline_scores.items():
        current_val = current_scores.get(metric)
        if current_val is None or baseline_val == 0:
            continue

        change_pct = ((current_val - baseline_val) / abs(baseline_val)) * 100

        if change_pct < -threshold_pct:
            status = "regressed"
            regression_count += 1
        elif change_pct > threshold_pct:
            status = "improved"
        else:
            status = "ok"

        metric_results.append({
            "metric": metric,
            "baseline": baseline_val,
            "current": current_val,
            "change_pct": round(change_pct, 1),
            "status": status,
        })

    # Sort: regressions first, then improved, then ok
    order = {"regressed": 0, "improved": 1, "ok": 2}
    metric_results.sort(key=lambda x: order[x["status"]])

    return {
        "regression_detected": regression_count > 0,
        "regression_count": regression_count,
        "baseline_name": baseline_name,
        "baseline_date": baseline.get("saved_at", "unknown"),
        "current_date": datetime.datetime.utcnow().isoformat(),
        "summary": f"{regression_count} metric(s) regressed" if regression_count > 0 else "All metrics within threshold",
        "threshold_pct": threshold_pct,
        "metrics": metric_results,
    }


def print_regression_report(regression: Optional[dict]):
    """Pretty-print a regression report to console."""
    if regression is None:
        print("[BASELINE] No baseline found. Run: venv\\Scripts\\python.exe save_baseline.py")
        return

    baseline_date = regression["baseline_date"][:10] if regression["baseline_date"] != "unknown" else "unknown"

    if regression["regression_detected"]:
        print(f"\n[REGRESSION] ⚠️  {regression['regression_count']} METRIC(S) REGRESSED vs baseline '{regression['baseline_name']}' ({baseline_date})")
    else:
        print(f"\n[REGRESSION] ✅ All metrics within threshold vs baseline '{regression['baseline_name']}' ({baseline_date})")

    for m in regression["metrics"]:
        if m["status"] == "regressed":
            icon = "❌"
        elif m["status"] == "improved":
            icon = "📈"
        else:
            icon = "✅"

        change_str = f"{m['change_pct']:+.1f}%"
        print(f"  {m['metric']:<25} {m['baseline']:>6} → {m['current']:<6} ({change_str:>8})  {icon} {m['status']}")
