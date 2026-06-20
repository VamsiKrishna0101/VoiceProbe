import re
import string


def clean_text(text: str) -> set:
    """Normalize text and return a set of unique words."""
    # Convert to lowercase
    text = text.lower()
    # Remove punctuation
    text = text.translate(str.maketrans('', '', string.punctuation))
    # Basic tokenization
    words = set(text.split())
    
    # Optional: remove very common stop words that might inflate similarity
    stop_words = {"a", "an", "the", "and", "or", "but", "is", "are", "was", "were", "to", "in", "for", "with", "on", "at", "by", "this", "that", "it", "i", "you", "we", "they"}
    return words - stop_words


def jaccard_similarity(set1: set, set2: set) -> float:
    """Calculate the Jaccard similarity between two sets of words."""
    if not set1 and not set2:
        return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union


def detect_loops(transcript: list, similarity_threshold: float = 0.8) -> dict:
    """
    Detect loops or repetitions in the agent's turns within a transcript.
    
    Args:
        transcript: List of dicts, e.g., [{"speaker": "agent", "text": "..."}]
        similarity_threshold: Jaccard similarity threshold to consider turns as repeating.
        
    Returns:
        dict: Summary of loop detection.
    """
    if not transcript:
        return {"has_loops": False, "loop_severity": "none", "detected_loops": []}

    # Extract only agent turns, keep track of original turn indexes (1-indexed based on whole transcript)
    agent_turns = []
    for i, turn in enumerate(transcript):
        if turn.get("speaker") == "agent":
            text = turn.get("text", "")
            if text:
                agent_turns.append({
                    "turn_index": i + 1,
                    "text": text,
                    "word_set": clean_text(text)
                })

    detected_loops = []
    processed_indexes = set()

    # Compare each agent turn to subsequent agent turns
    for i in range(len(agent_turns)):
        if i in processed_indexes:
            continue
            
        current_turn = agent_turns[i]
        
        # We only care about turns with enough substantive words to be compared meaningfully
        if len(current_turn["word_set"]) < 3:
            continue

        loop_group = [current_turn]
        
        for j in range(i + 1, len(agent_turns)):
            compare_turn = agent_turns[j]
            
            similarity = jaccard_similarity(current_turn["word_set"], compare_turn["word_set"])
            if similarity >= similarity_threshold:
                loop_group.append(compare_turn)
                processed_indexes.add(j)

        if len(loop_group) >= 2:
            occurrences = len(loop_group)
            turn_indexes = [t["turn_index"] for t in loop_group]
            
            # Check if it's a consecutive loop (agent turns happen back-to-back without user turns)
            # Or if it's just consecutive *agent* turns without the agent saying anything else in between.
            # We'll define consecutive as the agent's indexes in the `agent_turns` list being adjacent.
            agent_list_indexes = [agent_turns.index(t) for t in loop_group]
            is_consecutive = False
            for k in range(len(agent_list_indexes) - 1):
                if agent_list_indexes[k + 1] - agent_list_indexes[k] == 1:
                    is_consecutive = True
                    break

            detected_loops.append({
                "phrase": current_turn["text"],
                "occurrences": occurrences,
                "turn_indexes": turn_indexes,
                "is_consecutive": is_consecutive
            })

    # Determine overall severity
    loop_severity = "none"
    has_loops = len(detected_loops) > 0
    
    if has_loops:
        loop_severity = "low"
        for loop in detected_loops:
            if loop["occurrences"] >= 3 or loop["is_consecutive"]:
                loop_severity = "high"
                break
            elif loop["occurrences"] == 2:
                # If there are any loops but none are severe, it's medium
                if loop_severity == "low":
                    loop_severity = "medium"

    return {
        "has_loops": has_loops,
        "loop_severity": loop_severity,
        "detected_loops": detected_loops
    }
