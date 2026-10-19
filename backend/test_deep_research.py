"""
AgentFlow - Deep Multi-Source Research Test Suite
Tests 3 realistic user tasks:
1. Live News Task: "Today's top AI news in India"
2. Software Version Task: "What is the latest release version of FastAPI?"
3. Product Comparison Task: "Compare iPhone 16 Pro vs Samsung Galaxy S25 Ultra"

Prints the planned queries, sources searched, pages read, and dates with freshness badges
to verify answers are 100% current and grounded in real-time data.
"""

import sys
import time
from pathlib import Path

# Ensure backend can be imported
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.agent import stream_agent_steps

TEST_TASKS = [
    {
        "name": "Live News Task",
        "prompt": "Give me today's top AI news in India with latest developments",
        "deep": False
    },
    {
        "name": "Software Version Task",
        "prompt": "What is the latest release version of FastAPI?",
        "deep": False
    },
    {
        "name": "Product Comparison Task",
        "prompt": "Compare iPhone 16 Pro vs Samsung Galaxy S25 Ultra key differences",
        "deep": False
    }
]


def run_single_test(task_info: dict, index: int, total: int):
    name = task_info["name"]
    prompt = task_info["prompt"]
    deep = task_info["deep"]

    print("\n" + "=" * 70)
    print(f"  🧪 TEST [{index}/{total}]: {name.upper()}")
    print(f"  Prompt: \"{prompt}\"")
    print(f"  Mode: {'Deep Research' if deep else 'Quick Research'}")
    print("=" * 70)

    start_time = time.time()
    planned_queries = []
    sources_searched = []
    pages_read = []
    final_answer = ""
    verified_sources = []

    for step in stream_agent_steps(prompt, deep_research=deep):
        stype = step.get("type")

        if stype == "start":
            print(f"⚡ [INIT] {step.get('message')}")

        elif stype == "research_progress":
            queries = step.get("queries", [])
            if queries and not planned_queries:
                planned_queries = queries
                print(f"📋 [PLANNED QUERIES ({len(queries)})]:")
                for q in queries:
                    print(f"   • {q}")

            searched = step.get("sources_searched", [])
            if len(searched) > len(sources_searched):
                sources_searched = searched

            read = step.get("pages_read", [])
            if len(read) > len(pages_read):
                new_pages = read[len(pages_read):]
                for p in new_pages:
                    print(f"📖 [PAGE READ]: {p.get('title', 'Article')} | {p.get('domain')} | Date: {p.get('date')}")
                pages_read = read

        elif stype == "tool_call":
            tool_name = step.get("tool")
            args = step.get("args", {})
            args_preview = str(args)[:80] + ("..." if len(str(args)) > 80 else "")
            print(f"🔧 [TOOL CALL]: {tool_name}({args_preview})")

        elif stype == "final_answer":
            final_answer = step.get("content", "")
            verified_sources = step.get("sources", [])

    duration = round(time.time() - start_time, 2)

    print("\n" + "-" * 70)
    print("🎯 [FINAL SYNTHESIZED ANSWER]:")
    print("-" * 70)
    print(final_answer)

    print("\n" + "-" * 70)
    print(f"🔗 [VERIFIED SOURCES & FRESHNESS BADGES ({len(verified_sources)})]:")
    print("-" * 70)
    for s in verified_sources:
        if isinstance(s, dict):
            badge = s.get("freshness", "Older")
            print(f"  [{badge:<9}] {s.get('title')} ({s.get('domain')})")
            print(f"             Published: {s.get('date')} | URL: {s.get('url')}")
        else:
            print(f"  [Link]     {s}")

    print(f"\n⏱️  Execution Duration: {duration}s")
    print("=" * 70 + "\n")


def main():
    print("\n" + "#" * 70)
    print("  🚀 AGENTFLOW DEEP MULTI-SOURCE RESEARCH VERIFICATION TEST")
    print("  Zero Paid APIs | 100% Local & Free | Real-time Web & RSS")
    print("#" * 70)

    for i, t in enumerate(TEST_TASKS, start=1):
        run_single_test(t, i, len(TEST_TASKS))

    print("\n" + "#" * 70)
    print("  ✅ ALL 3 RESEARCH TASKS COMPLETED SUCCESSFULLY")
    print("#" * 70 + "\n")


if __name__ == "__main__":
    main()
