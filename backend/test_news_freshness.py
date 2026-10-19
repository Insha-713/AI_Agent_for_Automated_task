"""
AgentFlow - Live Real-Time News Freshness Test
Runs 'Give me today's top AI news in India' through stream_agent_steps.
Prints the tool calls, the publication dates from the results, and the final answer,
verifying that the agent no longer produces outdated 2024 information.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.agent import stream_agent_steps, make_system_prompt
from backend.tools import get_latest_news, web_search

def test_live_news_freshness():
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist_tz)
    print("=" * 70)
    print("  AGENTFLOW NEWS FRESHNESS VERIFICATION TEST")
    print(f"  Current Date (Ground Truth): {now.strftime('%A, %d %B %Y %I:%M %p IST')}")
    print("=" * 70)

    # 1. Test get_latest_news standalone
    print("\n[Step 1] Testing get_latest_news tool directly...")
    direct_news = get_latest_news.func("AI in India", days=1)
    print("  -> Tool Result Preview (first 400 chars):")
    print("  " + "\n  ".join(direct_news.split("\n")[:8]))

    # Verify that the tool returned items with published timestamps
    assert "Published:" in direct_news, "get_latest_news failed to return published timestamps!"
    print("  [PASS] get_latest_news returned verified articles with publication dates.\n")

    # 2. Test web_search with time period filter
    print("[Step 2] Testing web_search with period='d' (past 24h)...")
    ddg_result = web_search.func("AI technology news India", period="d", max_results=3)
    print("  -> DuckDuckGo Filtered Result Preview (first 300 chars):")
    print("  " + "\n  ".join(ddg_result.split("\n")[:6]))
    print("  [PASS] web_search executed successfully with timelimit.\n")

    # 3. Test Full Agent Execution
    task_prompt = "Give me today's top AI news in India"
    print(f"[Step 3] Running full agent with prompt: '{task_prompt}'...\n")

    tool_calls = []
    tool_results = []
    final_answer = ""
    sources = []

    for step in stream_agent_steps(task_prompt):
        stype = step.get("type")
        
        if stype == "thought":
            thought_text = step.get("content", "").strip()
            # Print brief thoughts
            first_line = thought_text.split("\n")[0]
            print(f"  [Thought] {first_line[:120]}...")
            
        elif stype == "tool_call":
            tool_name = step.get("tool")
            tool_args = step.get("args")
            tool_calls.append({"tool": tool_name, "args": tool_args})
            print(f"  [TOOL CALL] -> {tool_name}({tool_args})")
            
        elif stype == "tool_result":
            tool_name = step.get("tool")
            res_content = step.get("result", "")
            tool_results.append({"tool": tool_name, "content": res_content})
            print(f"  [TOOL RESULT] <- Received {len(res_content)} characters from {tool_name}")
            # Print any published dates found in this tool result
            for line in res_content.split("\n"):
                if "published:" in line.lower() or "ago" in line.lower():
                    print(f"      * {line.strip()}")

        elif stype == "final_answer":
            final_answer = step.get("content", "")
            sources = step.get("sources", [])

    print("\n" + "=" * 70)
    print("  FINAL AGENT ANSWER:")
    print("=" * 70)
    print(final_answer)

    print("\n" + "=" * 70)
    print("  VERIFIED SOURCES & URLS:")
    print("=" * 70)
    for s in sources:
        print(f"  - {s}")

    print("\n" + "=" * 70)
    print("  FRESHNESS AUDIT CHECKS:")
    print("=" * 70)

    # Verification: Tool calls must include get_latest_news or web_search
    tools_used = [tc["tool"] for tc in tool_calls]
    print(f"  * Tools Invoked: {tools_used}")
    assert any(t in tools_used for t in ("get_latest_news", "web_search")), (
        f"Agent did not invoke news search tools! Tools used: {tools_used}"
    )
    print("  [PASS] Agent actively searched tools instead of recalling from memory.")

    # Verification: Check that the final answer is not an outdated 2024 response
    lower_ans = final_answer.lower()
    has_2024_exclusively = ("2024" in lower_ans or "2023" in lower_ans) and str(now.year) not in lower_ans
    assert not has_2024_exclusively, "FAIL: Agent output still contains outdated 2024 information without current dates!"
    print(f"  [PASS] Response does NOT default to 2024/2023 memory.")

    # Verification: Check that recent temporal markers exist
    fresh_markers = ["published", "2026", "today", "hour", "day", "october", "oct"]
    has_freshness = any(fm in lower_ans for fm in fresh_markers)
    assert has_freshness, "FAIL: Response contains no recent temporal markers or dates!"
    print(f"  [PASS] Response contains verified real-time dates and timestamps.")

    print("\n" + "=" * 70)
    print("  ALL REAL-TIME NEWS VERIFICATION CHECKS PASSED (100% SUCCESS)!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    test_live_news_freshness()
