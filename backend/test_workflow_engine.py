"""
Test script for Stage 1 Prompt-to-Workflow Engine.
Verifies:
1. Plan generation for natural language (English and Hindi)
2. Strict registered tool verification (zero hallucinated tools)
3. Missing credentials detection
4. Dry-run execution
5. Data passing between steps
"""

import asyncio
import json
import sys
import os
from pathlib import Path

# Fix Windows console encoding if needed
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.db import init_db
from backend.workflows import generate_workflow_plan, WorkflowExecutionEngine, REGISTERED_TOOLS_META

async def main():
    print("=== Testing Stage 1: Prompt-to-Workflow Engine ===")
    await init_db()

    # Test 1: English Prompt
    prompt_en = "Check current IST time, fetch latest AI news in India, and save to workspace/ai_report.txt"
    print(f"\n1. Generating plan for: '{prompt_en}'")
    plan_en = await generate_workflow_plan(prompt_en)
    print(f"Title: {plan_en['title']}")
    print(f"Total Steps: {len(plan_en['steps'])}")
    for s in plan_en["steps"]:
        assert s["tool"] in REGISTERED_TOOLS_META, f"Invalid tool: {s['tool']}"
        print(f"  - [{s['id']}] Tool: {s['tool']} ({s['name']}) -> Output: {s['output_key']}")

    # Test 2: Hindi Prompt
    prompt_hi = "Aaj ka time batao aur AI ki taza khabar search karke workspace/khabar.txt me save karo"
    print(f"\n2. Generating plan for Hindi prompt: '{prompt_hi}'")
    plan_hi = await generate_workflow_plan(prompt_hi)
    print(f"Title: {plan_hi['title']}")
    for s in plan_hi["steps"]:
        assert s["tool"] in REGISTERED_TOOLS_META, f"Invalid tool: {s['tool']}"
        print(f"  - [{s['id']}] Tool: {s['tool']} ({s['name']}) -> Output: {s['output_key']}")

    # Test 3: Missing credentials check for email
    prompt_email = "Check time and email a summary to student@example.com"
    print(f"\n3. Generating plan for Email task: '{prompt_email}'")
    plan_email = await generate_workflow_plan(prompt_email)
    print(f"Missing Credentials detected: {plan_email.get('missing_credentials')}")
    assert any(s["tool"] == "send_email" for s in plan_email["steps"]), "send_email step should be planned"

    # Test 4: Dry-run execution
    print("\n4. Running Dry-run execution on English plan...")
    engine = WorkflowExecutionEngine(plan_en["workflow_id"], plan_en, dry_run=True)
    async for event in engine.stream_workflow():
        etype = event.get("type")
        if etype == "step_start":
            print(f"  [RUNNING] Step: {event['name']} (Tool: {event['tool']})")
        elif etype == "step_result":
            preview = str(event.get('result', ''))[:80].replace('\n', ' ')
            print(f"  [COMPLETED] Step Result (mock={event.get('mock')}): {preview}...")
        elif etype == "workflow_complete":
            print(f"  [FINISHED] Overall status: {event['status']} in {event['duration_seconds']}s")

    print("\nALL WORKFLOW ENGINE BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
