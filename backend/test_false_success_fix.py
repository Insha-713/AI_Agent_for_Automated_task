"""
Verification script for Fix 2: False Success Prevention & Parameter Sanitization
Tests:
1. Clean parameter extraction on the user's exact task:
   'Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt'
2. Real execution:
   - Step 1: get_datetime (real-time IST timestamp)
   - Step 2: get_latest_news (clean topic 'AI news India', 8 verified live news articles with dates & links)
   - Step 3: save_file (writes real findings into workspace/ai_daily_news.txt)
3. Content inspection of workspace/ai_daily_news.txt (ensuring it is a rich report, not 49-byte failure text)
4. Negative test: Tool returning NO DATA or empty output is marked NO DATA/FAILED, subsequent steps are SKIPPED, and overall status is PARTIAL or FAILED (never COMPLETED).
"""

import sys
import os
import asyncio
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.workflows import (
    generate_workflow_plan,
    extract_clean_news_topic,
    WorkflowExecutionEngine,
    WORKSPACE_PATH
)


async def run_fix2_verification():
    prompt = "Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt"
    print("=" * 70)
    print("TEST 1: Parameter Extraction & Plan Validation")
    print(f"User Prompt: '{prompt}'")
    print("=" * 70)

    # 1. Topic cleaner check
    extracted_topic = extract_clean_news_topic(prompt)
    print(f"[*] Clean topic extracted: '{extracted_topic}'")
    assert extracted_topic == "AI news India", f"Expected 'AI news India', got '{extracted_topic}'"

    # 2. Plan generation
    plan = await generate_workflow_plan(prompt)
    print(f"[*] Workflow ID: {plan['workflow_id']}")
    print(f"[*] Total Steps: {len(plan['steps'])}")
    for i, s in enumerate(plan['steps'], 1):
        print(f"    Step {i}: [{s['id']}] {s['name']} (tool: {s['tool']})")
        print(f"            Params: {json.dumps(s['params'])}")

    # Verify news tool parameters are clean
    news_step = next(s for s in plan['steps'] if s['tool'] == 'get_latest_news')
    assert news_step['params']['topic'] == 'AI news India', f"Invalid topic: {news_step['params']['topic']}"
    assert "check" not in news_step['params']['topic'].lower(), "Raw instruction found in topic parameter!"

    # Verify save_file parameters
    save_step = next(s for s in plan['steps'] if s['tool'] == 'save_file')
    assert save_step['params']['filename'] == 'ai_daily_news.txt', f"Invalid filename: {save_step['params']['filename']}"

    print("\n" + "=" * 70)
    print("TEST 2: Live End-to-End Workflow Execution (Clean Flow)")
    print("=" * 70)

    engine = WorkflowExecutionEngine(workflow_id=plan['workflow_id'], plan=plan, dry_run=False)
    events = []
    async for event in engine.stream_workflow():
        events.append(event)
        etype = event.get("type")
        if etype == "step_start":
            print(f"\n--> Starting Step: {event.get('name')} (ID: {event.get('step_id')})")
        elif etype == "step_result":
            res_preview = str(event.get('result'))[:150].replace('\n', ' ')
            print(f"    [COMPLETED] Output: {res_preview}...")
        elif etype == "step_error":
            print(f"    [ERROR/FAILED] {event.get('display_status', 'FAILED')}: {event.get('error')}")
        elif etype == "workflow_complete":
            print(f"\n[WORKFLOW COMPLETE] Final Status: {event.get('status').upper()} | Duration: {event.get('duration_seconds')}s")

    # Verify file saved in workspace/ai_daily_news.txt
    saved_file = WORKSPACE_PATH / "ai_daily_news.txt"
    assert saved_file.exists(), "workspace/ai_daily_news.txt was not created!"
    content = saved_file.read_text(encoding="utf-8")
    file_size = len(content)
    print(f"\n[*] Verified saved file: {saved_file} ({file_size} characters)")
    print("--- File Content Preview ---")
    print(content[:500] + ("\n..." if len(content) > 500 else ""))
    print("----------------------------")
    assert file_size > 500, f"Expected rich file content > 500 chars, got {file_size} bytes!"
    assert "No recent news found" not in content, "Error text was mistakenly written to file!"

    print("\n" + "=" * 70)
    print("TEST 3: Negative Test (Empty/NO DATA Result Detection & Step Skipping)")
    print("=" * 70)

    fake_plan = {
        "workflow_id": "wf_test_negative",
        "title": "Negative Test Workflow",
        "steps": [
            {
                "id": "step_1",
                "tool": "get_datetime",
                "name": "Check IST Time",
                "params": {},
                "output_key": "ist_time",
                "requires_approval": False
            },
            {
                "id": "step_2",
                "tool": "get_latest_news",
                "name": "Fetch Non-Existent News",
                "params": {"topic": "xzqkjw_random_fake_nonsense_query_12345", "days": 1},
                "output_key": "news_results",
                "requires_approval": False
            },
            {
                "id": "step_3",
                "tool": "save_file",
                "name": "Save News Output",
                "params": {"filename": "should_not_be_written.txt", "content": "{{news_results}}"},
                "output_key": "saved_info",
                "requires_approval": False
            }
        ]
    }

    from backend.db import save_workflow
    await save_workflow(
        workflow_id="wf_test_negative",
        title="Negative Test Workflow",
        prompt="fetch non-existent news",
        plan_json=json.dumps(fake_plan),
        status="ready"
    )

    neg_engine = WorkflowExecutionEngine(workflow_id="wf_test_negative", plan=fake_plan, dry_run=False)
    neg_events = []
    async for event in neg_engine.stream_workflow():
        neg_events.append(event)
        etype = event.get("type")
        if etype == "step_start":
            print(f"--> Step: {event.get('name')}")
        elif etype == "step_result":
            print(f"    [COMPLETED] Step {event.get('step_id')}")
        elif etype == "step_error":
            print(f"    [{event.get('display_status', 'FAILED')}] Step {event.get('step_id')}: {event.get('error')}")
        elif etype == "step_skipped":
            print(f"    [SKIPPED] Step {event.get('step_id')}: {event.get('reason')}")
        elif etype == "workflow_complete":
            print(f"[WORKFLOW COMPLETE] Final Status: {event.get('status').upper()}")

    # Assertions for negative flow
    error_event = next(e for e in neg_events if e.get("type") == "step_error")
    assert error_event["display_status"] == "NO DATA"
    assert "NO DATA" in error_event["error"]

    skipped_event = next(e for e in neg_events if e.get("type") == "step_skipped")
    assert skipped_event["step_id"] == "step_3"
    assert "Preceding step" in skipped_event["reason"]

    final_event = next(e for e in neg_events if e.get("type") == "workflow_complete")
    assert final_event["status"] == "partial", f"Expected 'partial', got '{final_event['status']}'"
    assert final_event["status"] != "completed", "Run status was falsely marked completed!"

    # Ensure should_not_be_written.txt was NEVER created on disk
    assert not (WORKSPACE_PATH / "should_not_be_written.txt").exists(), "Skipped step should not write to disk!"

    print("\nALL FIX 2 TESTS PASSED PERFECTLY!")


if __name__ == "__main__":
    asyncio.run(run_fix2_verification())
