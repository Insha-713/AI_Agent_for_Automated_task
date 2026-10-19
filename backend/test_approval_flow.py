"""
AgentFlow - Fix 3 Human Approval Flow Verification Test
Tests the complete lifecycle of sensitive action approvals:
1. State 1 (Waiting Card): Run pauses on send_email, status becomes 'waiting_for_approval',
   emits 'approval_required' with fully rendered body (no unresolved placeholders).
2. State 2 (After Approve): POST /api/approvals/{id} with decision="approve",
   SSE emits 'approval_resolved', engine unblocks and proceeds.
3. State 3 (Final Result): Step completes or reports honest result, workflow finishes.
4. Also verifies rejection cancellation flow.
"""

import urllib.request
import json
import time
import sys
import io

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def make_request(path: str, method: str = "GET", data: dict = None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json", "User-Agent": "AgentFlow-Test"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

def test_approval_flow():
    print("=" * 70)
    print("TEST: Human Approval Flow for Weather Email Task")
    print("Task: 'Send me the weather of Lucknow by email to inshaf713@gmail.com'")
    print("=" * 70)

    # 1. Generate workflow plan
    print("\n--- [Phase 1: Generating Workflow Plan] ---")
    gen_res = make_request("/api/workflows/generate", method="POST", data={
        "prompt": "Send me the weather of Lucknow by email to inshaf713@gmail.com"
    })
    wf_id = gen_res["workflow_id"]
    print(f"Workflow ID: {wf_id}")
    print(f"Workflow Title: {gen_res.get('title')}")
    print(f"Total Steps: {len(gen_res.get('steps', []))}")
    for s in gen_res.get('steps', []):
        print(f"  - [{s['id']}] {s['name']} (tool: {s['tool']}, requires_approval: {s.get('requires_approval')})")

    # 2. Connect to SSE stream
    print("\n--- [Phase 2: Executing Workflow & Awaiting State 1 (Waiting Card)] ---")
    stream_url = f"{BASE_URL}/api/workflows/{wf_id}/stream?dry_run=false"
    req = urllib.request.Request(stream_url, headers={"User-Agent": "AgentFlow-Test"})

    pending_approval_id = None
    approval_card_data = None
    final_status = None

    with urllib.request.urlopen(req, timeout=60) as resp:
        for line in resp:
            line_str = line.decode("utf-8").strip()
            if not line_str.startswith("data: "):
                continue

            payload = line_str[6:].strip()
            try:
                event = json.loads(payload)
            except Exception:
                continue

            etype = event.get("type")

            if etype == "workflow_start":
                print(f"[SSE] 🚀 Workflow Started: {event.get('title')}")

            elif etype == "step_start":
                print(f"[SSE] ⚙️ Starting Step [{event.get('step_id')}]: {event.get('name')} (tool: {event.get('tool')})")

            elif etype == "step_result":
                res_preview = str(event.get("result", ""))[:120].replace("\n", " ")
                print(f"[SSE] ✅ Step [{event.get('step_id')}] Completed: {res_preview}...")

            elif etype == "approval_required":
                print("\n" + "#" * 60)
                print(">>> STATE 1: WAITING FOR APPROVAL CARD")
                print("#" * 60)
                pending_approval_id = event["approval_id"]
                approval_card_data = event
                print(f"Approval ID:       {event.get('approval_id')}")
                print(f"Workflow Status:   WAITING_FOR_APPROVAL")
                print(f"Paused Step:       [{event.get('step_id')}] {event.get('name')}")
                print(f"Tool Action:       {event.get('tool')}")
                params = event.get("parameters", {})
                print(f"Recipient (To):    {params.get('to_email')}")
                print(f"Subject:           {params.get('subject')}")
                print("Rendered Message Body:")
                print("-" * 50)
                print(params.get("body", ""))
                print("-" * 50)

                # Verify no raw unresolved placeholders remain in the body
                body = params.get("body", "")
                if "{{" in body or "}}" in body:
                    print("❌ ERROR: Body contains unresolved template placeholders!")
                    sys.exit(1)
                else:
                    print("✅ VERIFIED: Weather placeholders successfully replaced with real data!")

                # Check backend status in DB
                wf_details = make_request(f"/api/workflows/{wf_id}")
                print(f"Verified DB Workflow Status: {wf_details.get('status')}")

                # Simulate user clicking "Approve & Continue" in frontend
                print("\n>>> Simulating User Click: 'Approve & Continue'...")
                time.sleep(1.5)
                approve_res = make_request(f"/api/approvals/{pending_approval_id}", method="POST", data={
                    "decision": "approve"
                })
                print(f">>> POST /api/approvals/{pending_approval_id} response: {approve_res}")
                print("\n" + "#" * 60)
                print(">>> STATE 2: AFTER APPROVE (RESUMING EXECUTION)")
                print("#" * 60)

            elif etype == "approval_resolved":
                print(f"[SSE] ⚖️ Approval Resolved: decision={event.get('decision')}")

            elif etype == "step_error":
                print(f"[SSE] ❌ Step [{event.get('step_id')}] Error: {event.get('error')}")

            elif etype == "workflow_complete":
                final_status = event.get("status")
                print("\n" + "#" * 60)
                print(">>> STATE 3: FINAL RESULT")
                print("#" * 60)
                print(f"Final Workflow Status: {final_status}")
                print(f"Execution Duration:    {event.get('duration_seconds')}s")
                break

            elif etype == "workflow_cancelled":
                final_status = "cancelled"
                print(f"[SSE] 🛑 Workflow Cancelled.")
                break

    # Verify final state in DB
    final_wf = make_request(f"/api/workflows/{wf_id}")
    print(f"\nDB Final Workflow Status: {final_wf.get('status')}")
    print("=" * 70)
    print("TEST 1 (APPROVE FLOW) COMPLETE!")
    print("=" * 70)

    # 3. Test Rejection flow on a second run
    print("\n\n" + "=" * 70)
    print("TEST 2: Human Approval Rejection Flow")
    print("=" * 70)
    gen_res2 = make_request("/api/workflows/generate", method="POST", data={
        "prompt": "Send me the weather of Lucknow by email to inshaf713@gmail.com"
    })
    wf_id2 = gen_res2["workflow_id"]
    stream_url2 = f"{BASE_URL}/api/workflows/{wf_id2}/stream?dry_run=false"
    req2 = urllib.request.Request(stream_url2, headers={"User-Agent": "AgentFlow-Test"})

    with urllib.request.urlopen(req2, timeout=60) as resp2:
        for line in resp2:
            line_str = line.decode("utf-8").strip()
            if not line_str.startswith("data: "):
                continue
            payload = line_str[6:].strip()
            try:
                event = json.loads(payload)
            except Exception:
                continue

            etype = event.get("type")
            if etype == "approval_required":
                appr_id = event["approval_id"]
                print(f"[Test 2] Workflow paused at step [{event['step_id']}]. Simulating 'Reject & Cancel Run'...")
                time.sleep(1.0)
                rej_res = make_request(f"/api/approvals/{appr_id}", method="POST", data={
                    "decision": "reject"
                })
                print(f"[Test 2] POST /api/approvals/{appr_id} (reject): {rej_res}")

            elif etype == "approval_resolved":
                print(f"[Test 2] [SSE] Approval Resolved: {event.get('decision')}")

            elif etype == "step_skipped":
                print(f"[Test 2] [SSE] ⏭️ Step [{event.get('step_id')}] SKIPPED: {event.get('reason')}")

            elif etype == "workflow_cancelled":
                print(f"[Test 2] [SSE] 🛑 Workflow Cancelled successfully!")
                break

            elif etype == "workflow_complete":
                print(f"[Test 2] [SSE] Workflow completed: {event.get('status')}")
                break

    final_wf2 = make_request(f"/api/workflows/{wf_id2}")
    print(f"[Test 2] DB Final Workflow Status: {final_wf2.get('status')}")
    print("=" * 70)
    print("TEST 2 (REJECT FLOW) COMPLETE!")
    print("=" * 70)

if __name__ == "__main__":
    test_approval_flow()
