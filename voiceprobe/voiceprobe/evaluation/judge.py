import json
from voiceprobe.core.llm import call_llm
from voiceprobe.evaluation.evaluation_prompt import JUDGE_SYSTEM_PROMPT, JUDGE_USER_PROMPT


def format_transcript(transcript: list[dict]) -> str:
    lines = []
    for turn in transcript:
        speaker = turn["speaker"].upper()
        text = turn["text"]
        lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


async def judge_transcript(
    transcript: list[dict],
    persona_type: str,
    persona_goal: str,
    target_context: str,
) -> dict:
    formatted = format_transcript(transcript)
    total_turns = len(transcript)

    user_prompt = JUDGE_USER_PROMPT.format(
        persona_type=persona_type,
        persona_goal=persona_goal,
        target_context=target_context,
        total_turns=total_turns,
        transcript=formatted,
    )

    response = await call_llm(JUDGE_SYSTEM_PROMPT, user_prompt, temperature=0.1)

    clean = response.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        clean = "\n".join(lines).strip()

    try:
        data = json.loads(clean)
    except json.JSONDecodeError:
        return {
            "scores": {
                "task_completion": 0,
                "hallucination": 0,
                "persona_handling": 0,
                "response_quality": 0,
                "recovery": 0,
            },
            "overall_score": 0,
            "summary": "Evaluation failed because the judge returned invalid JSON.",
            "strengths": [],
            "weaknesses": ["Judge output could not be parsed."],
            "failed_at": "evaluation_parse_error",
            "persona_type": persona_type,
            "total_turns": total_turns,
        }

    scores = data.setdefault("scores", {})
    for key in ["task_completion", "hallucination", "persona_handling", "response_quality", "recovery"]:
        scores[key] = max(0, min(10, int(scores.get(key, 0))))
    data["overall_score"] = max(
        0,
        min(100, int(data.get("overall_score", round(sum(scores.values()) * 2)))),
    )
    data.setdefault("summary", "")
    data.setdefault("strengths", [])
    data.setdefault("weaknesses", [])
    data.setdefault("failed_at", None)
    data.setdefault("persona_type", persona_type)
    data.setdefault("total_turns", total_turns)
    return data
