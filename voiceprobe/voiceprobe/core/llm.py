import os
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(
    base_url="https://bedrock-mantle.us-east-1.api.aws/v1",
    api_key=os.getenv("AWS_BEARER_TOKEN_BEDROCK", "missing-key"),
    default_headers={"OpenAI-Project": "default"},
)

MODEL_ID = "moonshotai.kimi-k2.5"
LLM_RETRY_ATTEMPTS = int(os.getenv("VOICEPROBE_LLM_RETRY_ATTEMPTS", 3))
LLM_RETRY_BASE_DELAY = float(os.getenv("VOICEPROBE_LLM_RETRY_BASE_DELAY", 1.5))

async def call_llm(system_prompt, user_prompt, temperature=0.3, max_tokens=8192):
    last_error = None
    for attempt in range(1, LLM_RETRY_ATTEMPTS + 1):
        try:
            response = await client.chat.completions.create(
                model=MODEL_ID,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content.strip()
        except Exception as exc:
            last_error = exc
            print(f"[LLM] attempt {attempt}/{LLM_RETRY_ATTEMPTS} failed: {exc}")
            if attempt < LLM_RETRY_ATTEMPTS:
                await asyncio.sleep(LLM_RETRY_BASE_DELAY * attempt)
    raise last_error
