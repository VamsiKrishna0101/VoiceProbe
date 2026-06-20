"""Start the ARQ worker pool."""
import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import arq.cli

if __name__ == "__main__":
    concurrency = int(os.getenv("VOICEPROBE_MAX_CONCURRENT_CALLS", 5))
    print(f"Starting VoiceProbe worker (max {concurrency} concurrent calls)...")
    print("Waiting for jobs from Redis queue...")
    arq.cli.cli(["voiceprobe.core.worker.WorkerSettings"])
