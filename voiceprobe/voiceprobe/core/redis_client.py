import os
from dotenv import load_dotenv

load_dotenv()


def get_redis_settings():
    """Return ARQ-compatible Redis settings."""
    from arq.connections import RedisSettings
    return RedisSettings(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        password=os.getenv("REDIS_PASSWORD"),
    )


def get_redis_client():
    """Return a synchronous redis.Redis client."""
    import redis
    return redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        password=os.getenv("REDIS_PASSWORD"),
        decode_responses=True,
        socket_connect_timeout=5,
    )


def get_async_redis_client():
    """Return an async redis.asyncio.Redis client."""
    import redis.asyncio as aioredis
    return aioredis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        password=os.getenv("REDIS_PASSWORD"),
        decode_responses=True,
        socket_connect_timeout=5,
    )
