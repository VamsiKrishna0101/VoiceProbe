"""
A/B Prompt Comparison Engine for VoiceProbe.

Compares two agents (Version A vs Version B) by running the exact same
persona scripts against both phone numbers in parallel. Produces a
structured report with per-persona breakdown, aggregate scores, and
an LLM-generated recommendation.
"""
import datetime
from typing import Optional
from voiceprobe.evaluation.regression import extract_scores


# ─────────────────────────────────────────────────────────────
# Math helpers
# ─────────────────────────────────────────────────────────────

def _mean(values: list) -> Optional[float]:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def _per_persona_scores(call_results: list) -> dict:
    """
    Returns {persona_type -> {run_number -> overall_score}} from a list of call_results.
    Uses (persona_type, run_number) as the key so A and B can be matched.
    """
    lookup = {}
    for r in call_results:
        if not r.get("evaluation"):
            continue
        key = (r["persona_type"], r.get("run_number", 1))
        lookup[key] = {
            "persona_name":  r["persona_name"],
            "overall_score": r["evaluation"].get("overall_score"),
            "summary":       r["evaluation"].get("summary", ""),
            "scores":        r["evaluation"].get("scores", {}),
        }
    return lookup


def _aggregate_metrics(call_results: list) -> dict:
    """Flatten and average every evaluation metric across all results."""
    report = {"call_results": call_results}
    return extract_scores(report)


# ─────────────────────────────────────────────────────────────
# Per-persona comparison
# ─────────────────────────────────────────────────────────────

def _compare_per_persona(results_a: list, results_b: list) -> list:
    """
    Match A and B results by (persona_type, run_number) and build a
    side-by-side comparison row per pair.
    """
    lookup_a = _per_persona_scores(results_a)
    lookup_b = _per_persona_scores(results_b)

    all_keys = sorted(set(list(lookup_a.keys()) + list(lookup_b.keys())))

    rows = []
    for key in all_keys:
        entry_a = lookup_a.get(key)
        entry_b = lookup_b.get(key)
        score_a = entry_a["overall_score"] if entry_a else None
        score_b = entry_b["overall_score"] if entry_b else None
        persona_name = (entry_a or entry_b)["persona_name"]

        if score_a is not None and score_b is not None:
            diff = round(score_b - score_a, 1)
            if diff > 2:
                winner = "B"
            elif diff < -2:
                winner = "A"
            else:
                winner = "TIE"
        elif score_a is not None:
            diff = None
            winner = "A (B missing)"
        elif score_b is not None:
            diff = None
            winner = "B (A missing)"
        else:
            diff = None
            winner = "N/A"

        rows.append({
            "persona_type": key[0],
            "persona_name": persona_name,
            "run_number":   key[1],
            "score_a":      score_a,
            "score_b":      score_b,
            "diff":         diff,
            "winner":       winner,
        })

    return rows


# ─────────────────────────────────────────────────────────────
# Aggregate metric diff
# ─────────────────────────────────────────────────────────────

def _compare_aggregate(metrics_a: dict, metrics_b: dict) -> list:
    all_keys = sorted(set(list(metrics_a.keys()) + list(metrics_b.keys())))
    rows = []
    for key in all_keys:
        val_a = metrics_a.get(key)
        val_b = metrics_b.get(key)
        if val_a is not None and val_b is not None:
            diff = round(val_b - val_a, 2)
            diff_pct = round(((val_b - val_a) / abs(val_a)) * 100, 1) if val_a != 0 else None
            if diff_pct is not None:
                # If metric is latency, LOWER is better. So positive diff means B is slower (A wins)
                if "latency" in key:
                    winner = "A" if diff_pct > 2 else ("B" if diff_pct < -2 else "TIE")
                else:
                    winner = "B" if diff_pct > 2 else ("A" if diff_pct < -2 else "TIE")
            else:
                winner = "TIE"
        else:
            diff = None
            diff_pct = None
            winner = "N/A"

        rows.append({
            "metric":    key,
            "value_a":   val_a,
            "value_b":   val_b,
            "diff":      diff,
            "diff_pct":  diff_pct,
            "winner":    winner,
        })
    return rows


# ─────────────────────────────────────────────────────────────
# Overall winner logic
# ─────────────────────────────────────────────────────────────

def _determine_overall_winner(aggregate_rows: list) -> str:
    a_wins = sum(1 for r in aggregate_rows if r["winner"] == "A")
    b_wins = sum(1 for r in aggregate_rows if r["winner"] == "B")
    # Weight the overall_score metric double
    for r in aggregate_rows:
        if r["metric"] == "overall_score":
            if r["winner"] == "A":
                a_wins += 1
            elif r["winner"] == "B":
                b_wins += 1
    if b_wins > a_wins:
        return "B"
    elif a_wins > b_wins:
        return "A"
    return "TIE"


# ─────────────────────────────────────────────────────────────
# LLM recommendation
# ─────────────────────────────────────────────────────────────

async def _generate_recommendation(
    label_a: str,
    label_b: str,
    overall_winner: str,
    per_persona: list,
    aggregate: list,
) -> str:
    from voiceprobe.core.llm import call_llm

    # Build a compact summary for the LLM
    persona_lines = "\n".join(
        f"  {r['persona_name']} (run {r['run_number']}): A={r['score_a']} B={r['score_b']} → winner={r['winner']}"
        for r in per_persona
    )
    metric_lines = "\n".join(
        f"  {r['metric']}: A={r['value_a']} B={r['value_b']} ({r['diff_pct']:+.1f}% → {r['winner']})"
        if r["diff_pct"] is not None else
        f"  {r['metric']}: A={r['value_a']} B={r['value_b']}"
        for r in aggregate
    )

    system = "You are a senior voice AI evaluation expert who writes concise, actionable deployment recommendations."
    user = f"""You are analyzing an A/B test between two voice AI agent prompts.

Agent A: {label_a}
Agent B: {label_b}
Overall winner: {overall_winner}

PER-PERSONA SCORES:
{persona_lines}

AGGREGATE METRICS:
{metric_lines}

Write a concise 4-6 sentence recommendation covering:
1. Which version wins and by how much overall.
2. The biggest strength of the winning version.
3. Any persona or metric where the losing version performed better (watch out for edge cases).
4. A clear deployment recommendation (deploy B / stay on A / investigate further).

Be specific with numbers. Be direct. No fluff."""

    try:
        return await call_llm(system, user, temperature=0.2, max_tokens=512)
    except Exception as e:
        return f"LLM recommendation unavailable: {e}"


# ─────────────────────────────────────────────────────────────
# Main public API
# ─────────────────────────────────────────────────────────────

async def generate_ab_report(
    report_a: dict,
    report_b: dict,
    label_a: str = "Agent A",
    label_b: str = "Agent B",
) -> dict:
    """
    Generate a full A/B comparison report from two final_report dicts.

    Args:
        report_a: Loaded final_report dict for Agent A
        report_b: Loaded final_report dict for Agent B
        label_a:  Human-readable name for Agent A
        label_b:  Human-readable name for Agent B

    Returns:
        dict: Full comparison report ready to be saved as ab_report.json
    """
    results_a = report_a.get("call_results", [])
    results_b = report_b.get("call_results", [])

    metrics_a = _aggregate_metrics(results_a)
    metrics_b = _aggregate_metrics(results_b)

    per_persona   = _compare_per_persona(results_a, results_b)
    aggregate     = _compare_aggregate(metrics_a, metrics_b)
    overall_winner = _determine_overall_winner(aggregate)

    print("  Generating LLM recommendation...")
    recommendation = await _generate_recommendation(
        label_a, label_b, overall_winner, per_persona, aggregate
    )

    return {
        "generated_at":    datetime.datetime.utcnow().isoformat(),
        "label_a":         label_a,
        "label_b":         label_b,
        "phone_a":         report_a.get("target_phone_number"),
        "phone_b":         report_b.get("target_phone_number"),
        "target_context":  report_a.get("target_context"),
        "overall_winner":  overall_winner,
        "recommendation":  recommendation,
        "per_persona":     per_persona,
        "aggregate":       aggregate,
        "raw_metrics_a":   metrics_a,
        "raw_metrics_b":   metrics_b,
    }


# ─────────────────────────────────────────────────────────────
# Console printer
# ─────────────────────────────────────────────────────────────

def print_ab_report(report: dict):
    """Pretty-print the A/B comparison report to the terminal."""
    W = 70
    label_a = report["label_a"]
    label_b = report["label_b"]
    winner  = report["overall_winner"]

    print("\n" + "═" * W)
    print("  VoiceProbe A/B Comparison Report".center(W))
    print("═" * W)
    print(f"  Agent A : {label_a}  ({report['phone_a']})")
    print(f"  Agent B : {label_b}  ({report['phone_b']})")
    print(f"  Context : {report['target_context']}")
    print(f"  Run at  : {report['generated_at'][:19]}")
    print()

    # Per-persona table
    print(f"  {'PERSONA':<30} {'Agent A':>8} {'Agent B':>8} {'Diff':>7}  Winner")
    print("  " + "─" * (W - 2))
    for r in report["per_persona"]:
        score_a_str = f"{r['score_a']}/100" if r["score_a"] is not None else "   N/A"
        score_b_str = f"{r['score_b']}/100" if r["score_b"] is not None else "   N/A"
        diff_str    = f"{r['diff']:+.0f}" if r["diff"] is not None else "  N/A"
        run_label   = f"{r['persona_name']} (run {r['run_number']})"

        if r["winner"] == "B":
            win_icon = "✅ B"
        elif r["winner"] == "A":
            win_icon = "✅ A"
        elif r["winner"] == "TIE":
            win_icon = "⚖️  TIE"
        else:
            win_icon = r["winner"]

        print(f"  {run_label:<30} {score_a_str:>8} {score_b_str:>8} {diff_str:>7}  {win_icon}")

    print()

    # Aggregate metrics table
    print(f"  {'METRIC':<28} {'Agent A':>8} {'Agent B':>8} {'Δ %':>7}  Winner")
    print("  " + "─" * (W - 2))
    for r in report["aggregate"]:
        val_a_str   = f"{r['value_a']}" if r["value_a"] is not None else " N/A"
        val_b_str   = f"{r['value_b']}" if r["value_b"] is not None else " N/A"
        diff_str    = f"{r['diff_pct']:+.1f}%" if r["diff_pct"] is not None else "  N/A"

        if r["winner"] == "B":
            win_icon = "📈 B"
        elif r["winner"] == "A":
            win_icon = "📈 A"
        else:
            win_icon = "⚖️  TIE"

        print(f"  {r['metric']:<28} {val_a_str:>8} {val_b_str:>8} {diff_str:>7}  {win_icon}")

    print()

    # Overall banner
    if winner == "B":
        banner = f"🏆  WINNER: {label_b} (Agent B)"
    elif winner == "A":
        banner = f"🏆  WINNER: {label_a} (Agent A)"
    else:
        banner = "🏆  RESULT: TIE"

    print("  " + "═" * (W - 2))
    print(f"  {banner}")
    print("  " + "═" * (W - 2))

    # LLM recommendation
    print()
    print("  RECOMMENDATION")
    print("  " + "─" * (W - 2))
    for line in report["recommendation"].strip().split("\n"):
        print(f"  {line}")
    print()
