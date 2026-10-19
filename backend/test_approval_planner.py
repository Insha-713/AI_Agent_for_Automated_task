"""
AgentFlow - Stage 4 Verification Test (Approval Flow + Planner)
Validates human-in-the-loop approval coordination and dynamic planner checklist extraction.
"""

import os
import sys
import json
import time
import asyncio
import threading
from pathlib import Path

# Configure UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import httpx
from httpx import ASGITransport
from backend.main import app
from backend.db import init_db, get_approval_by_id, resolve_approval_record
from backend.approvals import approval_manager
from backend.agent import extract_plan_items


def test_planner_extraction():
    print("\n" + "=" * 65)
    print("  STEP 1: Testing Dynamic Planner Checklist Extraction")
    print("=" * 65)

    sample_thought = """
    Plan:
    1. Search DuckDuckGo for top AI engineer salaries in India.
    2. Analyze junior vs senior compensation ranges.
    3. Save executive summary to workspace/salaries.txt.
    """

    plan_items = extract_plan_items(sample_thought)
    print(f"Extracted {len(plan_items)} plan checklist items:")
    for item in plan_items:
        print(f"  [{item['id']}] {item['text']} (Status: {item['status']})")

    assert len(plan_items) == 3, "Failed to extract 3 plan items"
    assert "Search DuckDuckGo" in plan_items[0]["text"], "Step 1 text mismatch"
    assert "Save executive summary" in plan_items[2]["text"], "Step 3 text mismatch"
    print("✅ Planner checklist extraction verified.")


async def test_approval_flow_async():
    print("\n" + "=" * 65)
    print("  STEP 2: Testing Human-in-the-Loop Approval End-to-End")
    print("=" * 65)

    await init_db()
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:

        # Test Case A: Approval (User clicks 'Approve')
        print("\n[Case A] Testing Approval: User authorizes action...")
        received_approval_events = []

        def mock_listener(evt):
            if evt.get("type") == "approval_required":
                received_approval_events.append(evt)

        approval_manager.register_listener(mock_listener)

        # Launch request_approval in thread
        decision_result = []
        def run_approval_thread():
            approved = approval_manager.request_approval(
                task_id="test-task-1",
                action_type="send_email",
                tool_name="send_email",
                parameters={"to_email": "client@example.com", "subject": "Project Proposal"},
                details="Send formal business proposal email to client@example.com."
            )
            decision_result.append(approved)

        t1 = threading.Thread(target=run_approval_thread, daemon=True)
        t1.start()

        # Wait a moment for event emission
        await asyncio.sleep(0.5)
        assert len(received_approval_events) == 1, "Approval event not broadcast"
        approval_event = received_approval_events[0]
        approval_id = approval_event["approval_id"]
        print(f"Broadcast Approval Card: ID={approval_id}, Tool={approval_event['tool']}")

        # Resolve via REST endpoint /api/approvals/{approval_id}
        resolve_resp = await client.post(f"/api/approvals/{approval_id}", json={"decision": "approve"})
        assert resolve_resp.status_code == 200, "Approval resolution failed"
        print("API Decision Sent: 'approve' -> Status:", resolve_resp.status_code)

        # Wait for thread to unblock
        t1.join(timeout=2.0)
        assert len(decision_result) == 1 and decision_result[0] is True, "Approval thread did not receive True"
        print("✅ Case A Verified: Agent paused and resumed with approval granted.")

        # Test Case B: Rejection (User clicks 'Reject')
        print("\n[Case B] Testing Rejection: User cancels action...")
        received_approval_events.clear()
        decision_result.clear()

        def run_reject_thread():
            approved = approval_manager.request_approval(
                task_id="test-task-2",
                action_type="overwrite_file",
                tool_name="save_file",
                parameters={"filename": "important_notes.txt"},
                details="Overwrite existing important_notes.txt."
            )
            decision_result.append(approved)

        t2 = threading.Thread(target=run_reject_thread, daemon=True)
        t2.start()

        await asyncio.sleep(0.5)
        assert len(received_approval_events) == 1, "Rejection event not broadcast"
        reject_id = received_approval_events[0]["approval_id"]
        print(f"Broadcast Approval Card: ID={reject_id}, Action={received_approval_events[0]['action_type']}")

        # Resolve via REST endpoint with 'reject'
        reject_resp = await client.post(f"/api/approvals/{reject_id}", json={"decision": "reject"})
        assert reject_resp.status_code == 200, "Rejection resolution failed"
        print("API Decision Sent: 'reject' -> Status:", reject_resp.status_code)

        t2.join(timeout=2.0)
        assert len(decision_result) == 1 and decision_result[0] is False, "Rejection thread did not receive False"
        print("✅ Case B Verified: Agent paused and aborted action upon user rejection.")

        approval_manager.unregister_listener(mock_listener)

        print("\n" + "=" * 65)
        print("  🎉 STAGE 4 VERIFICATION COMPLETE: ALL TESTS PASSED!")
        print("=" * 65 + "\n")


if __name__ == "__main__":
    test_planner_extraction()
    asyncio.run(test_approval_flow_async())
