from datetime import datetime

def calculate_latency(transcript: list[dict]) -> dict:
    if len(transcript) < 2:
        return {"turns": [], "avg_latency_ms": 0, "p50_latency_ms": 0, "p95_latency_ms": 0, "p99_latency_ms": 0, "max_latency_ms": 0, "slow_turns": [], "slow_turn_count": 0}

    turns = []
    for i in range(1, len(transcript)):
        prev_time = datetime.fromisoformat(transcript[i - 1]["timestamp"])
        curr_time = datetime.fromisoformat(transcript[i]["timestamp"])
        latency_ms = (curr_time - prev_time).total_seconds() * 1000
        turns.append({
            "turn": i,
            "speaker": transcript[i]["speaker"],
            "text": transcript[i]["text"][:60],
            "latency_ms": round(latency_ms, 2)
        })

    latencies = sorted([t["latency_ms"] for t in turns])
    
    avg_latency = sum(latencies) / len(latencies)
    max_latency = latencies[-1]

    def get_percentile(data: list, percentile: float) -> float:
        idx = int(len(data) * percentile)
        return data[min(idx, len(data) - 1)]

    p50_latency = get_percentile(latencies, 0.50)
    p95_latency = get_percentile(latencies, 0.95)
    p99_latency = get_percentile(latencies, 0.99)

    slow_turns = [t for t in turns if t["latency_ms"] > 3000]

    return {
        "turns": turns,
        "avg_latency_ms": round(avg_latency, 2),
        "p50_latency_ms": round(p50_latency, 2),
        "p95_latency_ms": round(p95_latency, 2),
        "p99_latency_ms": round(p99_latency, 2),
        "max_latency_ms": round(max_latency, 2),
        "slow_turns": slow_turns,
        "slow_turn_count": len(slow_turns)
    }