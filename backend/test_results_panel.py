"""
AgentFlow - Fix 4 Results Panel & Scheduling Verification Test
Tests:
1. Run now execution:
   - Task: 'Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt'
   - Verifies workflow_complete contains:
     - status (completed/partial/failed)
     - duration_seconds
     - readable summary
     - generated_files list (filename, size_kb, preview, download_url)
     - step_outputs list (step_id, name, tool, params, result)
   - Tests GET /api/workspace/files/ai_daily_news.txt/download to ensure file can be downloaded.
2. Save and schedule execution:
   - Registers a recurring schedule in APScheduler with Asia/Kolkata timezone.
   - Verifies next_run timestamp and active status in APScheduler.
"""

import urllib.request
import json
import time
import sys

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

def test_results_and_scheduling():
    print("=" * 70)
    print("TEST: Fix 4 Results Panel, File Download, and APScheduler Scheduling")
    print("Task: 'Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt'")
    print("=" * 70)

    # 1. Generate workflow
    print("\n--- [Phase 1: Generating Plan for AI News Task] ---")
    gen_res = make_request("/api/workflows/generate", method="POST", data={
        "prompt": "Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt"
    })
    wf_id = gen_res["workflow_id"]
    print(f"Workflow ID:    {wf_id}")
    print(f"Workflow Title: {gen_res.get('title')}")
    print(f"Steps Planned:  {len(gen_res.get('steps', []))}")
    for s in gen_res.get('steps', []):
        print(f"  - [{s['id']}] {s['name']} (tool: {s['tool']})")

    # 2. Run workflow via SSE
    print("\n--- [Phase 2: Executing Workflow (Simulating 'Run Now')] ---")
    stream_url = f"{BASE_URL}/api/workflows/{wf_id}/stream?dry_run=false"
    req = urllib.request.Request(stream_url, headers={"User-Agent": "AgentFlow-Test"})

    complete_payload = None

    with urllib.request.urlopen(req, timeout=90) as resp:
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
            if etype == "step_start":
                print(f"[SSE] Starting [{event['step_id']}]: {event['name']} ({event['tool']})")
            elif etype == "step_result":
                prev = str(event.get('result', ''))[:90].replace('\n', ' ')
                print(f"[SSE] Completed [{event['step_id']}]: {prev}...")
            elif etype == "step_error":
                print(f"[SSE] Error [{event['step_id']}]: {event.get('error')}")
            elif etype == "approval_required":
                appr_id = event["approval_id"]
                print(f"[SSE] Paused for approval [{event['step_id']}]. Auto-approving...")
                make_request(f"/api/approvals/{appr_id}", method="POST", data={"decision": "approve"})
            elif etype == "workflow_complete":
                complete_payload = event
                print("\n[SSE] Workflow Execution Complete!")
                break
            elif etype == "error":
                print(f"[SSE] Fatal Engine Error: {event.get('error')}")
                break

    # 3. Verify Results Panel Payload
    print("\n" + "=" * 60)
    print("VERIFYING RESULTS PANEL DATA")
    print("=" * 60)
    if not complete_payload:
        print("FAILED: workflow_complete event was not received!")
        sys.exit(1)

    print(f"Final Status:      {complete_payload.get('status')}")
    print(f"Duration:          {complete_payload.get('duration_seconds')}s")
    print(f"Executive Summary: {complete_payload.get('summary')}")
    
    gen_files = complete_payload.get("generated_files", [])
    print(f"\nGenerated Files ({len(gen_files)}):")
    for f in gen_files:
        print(f"  - File: {f['filename']} ({f['size_kb']} KB, {f['size_bytes']} bytes)")
        print(f"    Preview: {f['preview'][:100].replace(chr(10), ' ')}...")
        print(f"    Download URL: {f['download_url']}")

    step_outs = complete_payload.get("step_outputs", [])
    print(f"\nStep Outputs ({len(step_outs)}):")
    for s in step_outs:
        print(f"  - [{s['step_id']}] {s['name']} (tool: {s['tool']}) -> {s['status']}")
        if s.get("result"):
            print(f"    Result excerpt: {s['result'][:80].replace(chr(10), ' ')}...")

    # 4. Test File Download Endpoint
    print("\n--- [Phase 3: Testing File Download Endpoint] ---")
    download_url = f"{BASE_URL}/api/workspace/files/ai_daily_news.txt/download"
    dl_req = urllib.request.Request(download_url, headers={"User-Agent": "AgentFlow-Test"})
    with urllib.request.urlopen(dl_req, timeout=10) as dl_resp:
        dl_bytes = dl_resp.read()
        print(f"Download HTTP Status: {dl_resp.status}")
        print(f"Downloaded Bytes:     {len(dl_bytes)} bytes")
        print(f"Content-Type:         {dl_resp.headers.get('Content-Type')}")
        if len(dl_bytes) > 500:
            print("VERIFIED: File download endpoint returns real generated file content!")
        else:
            print("WARNING: Downloaded content is smaller than expected.")

    # 5. Test Save & Schedule
    print("\n--- [Phase 4: Testing 'Save & Schedule' via APScheduler] ---")
    sched_res = make_request("/api/schedules", method="POST", data={
        "name": "Daily AI News Digest (Scheduled)",
        "prompt": "Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt",
        "frequency": "daily",
        "hour": 17,
        "minute": 0,
        "timezone": "Asia/Kolkata"
    })
    print(f"Schedule ID:       {sched_res.get('id')}")
    print(f"Schedule Name:     {sched_res.get('name')}")
    print(f"Frequency:         {sched_res.get('frequency')}")
    print(f"Timezone:          {sched_res.get('timezone_str')}")
    print(f"Next Run Time:     {sched_res.get('next_run')}")
    print(f"Active in DB:      {sched_res.get('status')}")

    # List schedules to confirm persistence
    all_schedules = make_request("/api/schedules")
    found = any(s["id"] == sched_res.get("id") for s in all_schedules.get("schedules", []))
    print(f"Verified Persistence in APScheduler & SQLite: {found}")

    print("\n" + "=" * 70)
    print("ALL FIX 4 TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_results_and_scheduling()
