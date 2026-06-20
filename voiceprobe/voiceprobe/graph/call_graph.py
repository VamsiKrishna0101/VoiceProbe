from langgraph.graph import StateGraph, END

from voiceprobe.graph.state import VoiceProbeState
from voiceprobe.graph.nodes import (
    generate_personas_node,
    submit_jobs_node,
    wait_for_results_node,
    classify_failures_node,
)


def build_graph() -> StateGraph:
    graph = StateGraph(VoiceProbeState)

    graph.add_node("generate_personas", generate_personas_node)
    graph.add_node("submit_jobs", submit_jobs_node)
    graph.add_node("wait_for_results", wait_for_results_node)
    graph.add_node("classify_failures", classify_failures_node)

    graph.set_entry_point("generate_personas")

    graph.add_edge("generate_personas", "submit_jobs")
    graph.add_edge("submit_jobs", "wait_for_results")
    graph.add_edge("wait_for_results", "classify_failures")
    graph.add_edge("classify_failures", END)

    return graph.compile()


voice_probe_graph = build_graph()
