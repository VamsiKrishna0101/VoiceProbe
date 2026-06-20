import datetime
import json
from typing import Any, Dict, Optional

from voiceprobe.core.redis_client import get_async_redis_client


def live_channel(run_id: str) -> str:
    return f"voiceprobe:events:{run_id}"


def live_history_key(run_id: str) -> str:
    return f"voiceprobe:events:{run_id}:history"


async def publish_live_event(run_id: Optional[str], event: Dict[str, Any]) -> None:
    if not run_id:
        return

    payload = {
        "run_id": run_id,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        **event,
    }
    encoded = json.dumps(payload, ensure_ascii=False, default=str)
    redis = get_async_redis_client()
    try:
        await redis.publish(live_channel(run_id), encoded)
        await redis.rpush(live_history_key(run_id), encoded)
        await redis.ltrim(live_history_key(run_id), -200, -1)
        await redis.expire(live_history_key(run_id), 86400)
    except Exception as exc:
        print(f"[LIVE] publish failed: {exc}")
    finally:
        await redis.aclose()
