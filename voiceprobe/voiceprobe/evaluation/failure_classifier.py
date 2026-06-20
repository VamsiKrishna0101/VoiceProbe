import json
from voiceprobe.core.llm import call_llm
from voiceprobe.evaluation.evaluation_prompt import FAILURE_SYSTEM_PROMPT, FAILURE_USER_PROMPT


async def classify_failures(
    evaluation_results: list[dict],
    target_context: str,
) -> dict:
    total_calls = len(evaluation_results)
    formatted = json.dumps(evaluation_results, indent=2)

    user_prompt = FAILURE_USER_PROMPT.format(
        total_calls=total_calls,
        target_context=target_context,
        results=formatted,
    )

    response = await call_llm(FAILURE_SYSTEM_PROMPT, user_prompt, temperature=0.1)

    clean = response.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        clean = "\n".join(lines).strip()

    return json.loads(clean)