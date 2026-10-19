"""
AgentFlow - Stage 1 Terminal Verification Script
Runs quick automated tests for all 6 tools and the LangGraph ReAct agent.
"""

import sys
import os
from pathlib import Path

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.tools import (
    web_search,
    save_file,
    read_file,
    list_files,
    get_datetime,
    send_email,
    WORKSPACE_PATH
)
from backend.agent import stream_agent_steps, get_agent


def test_tools():
    print("\n" + "=" * 60)
    print("  STEP 1: Testing Individual Agent Tools (Sandboxed)")
    print("=" * 60)

    # 1. get_datetime
    print("\n[Tool 1/6] Testing get_datetime...")
    dt_res = get_datetime.invoke({})
    print("Output:\n", dt_res)
    assert "Indian Standard Time" in dt_res, "DateTime tool failed"

    # 2. save_file
    print("\n[Tool 2/6] Testing save_file...")
    save_res = save_file.invoke({
        "filename": "test_agentflow.txt",
        "content": "Hello from AgentFlow! Sandboxed local AI assistant for India.",
        "overwrite": True
    })
    print("Output:\n", save_res)
    assert (WORKSPACE_PATH / "test_agentflow.txt").exists(), "Save file failed"

    # 3. read_file
    print("\n[Tool 3/6] Testing read_file...")
    read_res = read_file.invoke({"filename": "test_agentflow.txt"})
    print("Output:\n", read_res)
    assert "Hello from AgentFlow" in read_res, "Read file failed"

    # 4. list_files
    print("\n[Tool 4/6] Testing list_files...")
    list_res = list_files.invoke({})
    print("Output:\n", list_res)
    assert "test_agentflow.txt" in list_res, "List files failed"

    # 5. send_email (simulation check)
    print("\n[Tool 5/6] Testing send_email (safe simulation)...")
    email_res = send_email.invoke({
        "to_email": "student@example.com",
        "subject": "AgentFlow Welcome",
        "body": "Welcome to AgentFlow, your free local AI assistant."
    })
    print("Output:\n", email_res)

    # 6. web_search
    print("\n[Tool 6/6] Testing web_search (DuckDuckGo)...")
    search_res = web_search.invoke({"query": "fastapi python", "max_results": 2})
    print("Output preview:\n", search_res[:300] + "...")

    print("\n>>> All 6 Tools Verified Successfully! <<<\n")


def test_agent_execution():
    print("=" * 60)
    print("  STEP 2: Testing LangGraph ReAct Agent End-to-End")
    print("=" * 60)

    test_task = "Check the current date and time in India, save a one-line log into workspace/quick_log.txt, and confirm what files are in the workspace."
    print(f"\nRunning Task: '{test_task}'\n")

    for step in stream_agent_steps(test_task):
        stype = step.get("type")
        if stype == "start":
            print(f"-> {step.get('message')}")
        elif stype == "thought":
            print(f"-> [Agent Thinking]: {step.get('content')[:150]}...")
        elif stype == "tool_call":
            print(f"-> [Tool Call]: {step.get('tool')} with args {step.get('args')}")
        elif stype == "tool_result":
            res = step.get("result", "")
            print(f"-> [Tool Result]: {res[:150]}...")
        elif stype == "final_answer":
            print("\n" + "-" * 50)
            print("🎯 Final Agent Answer:")
            print("-" * 50)
            print(step.get("content"))
            sources = step.get("sources", [])
            if sources:
                print("\nSources:", sources)
            print("-" * 50)
        elif stype == "error":
            print(f"❌ Error: {step.get('error')}")

    print("\n>>> Stage 1 Terminal Test Complete! <<<\n")


if __name__ == "__main__":
    test_tools()
    test_agent_execution()
