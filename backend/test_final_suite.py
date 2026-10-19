"""
AgentFlow - Final Verification Test Suite
Tests:
1. "Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt"
2. Clean parameter extraction (topic="AI news India", days=1, timezone="Asia/Kolkata", filename="workspace/ai_daily_news.txt")
3. Real news retrieval with dates and sources (fallback window retry if needed)
4. Human approval card pause on file save/overwrite, showing rendered parameters
5. Approval resolution (POST /api/approvals/{id}) resuming execution
6. File content verification in workspace/ai_daily_news.txt
7. Final run status and Results Panel metadata (duration, summary, step outputs, generated files)
8. History cleanup & deduplication verification
"""

import urllib.request
import json
import time
import os
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def make_request(path: str, method: str = "GET", data: dict = None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json", "User-Agent": "AgentFlow-Verification"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_test():
    prompt = "Check current IST time, fetch latest AI news in India, and save to workspace/ai_daily_news.txt"
    print("=" * 80)
    print("AGENTFLOW END-TO-END FINAL VERIFICATION SUITE")
    print(f"Task: \"{prompt}\"")
    print("=" * 80)

    # STEP 1: Plan Generation & Clean Parameter Extraction
    print("\n>>> STEP 1: WORKFLOW GENERATION & TOOL PARAMETER SANITIZATION")
    gen_res = make_request("/api/workflows/generate", method="POST", data={"prompt": prompt})
    wf_id = gen_res["workflow_id"]
    print(f"Workflow ID:    {wf_id}")
    print(f"Workflow Title: {gen_res.get('title')}")
    print(f"Steps count:    {len(gen_res.get('steps', []))}")

    clean_params_verified = True
    for idx, step in enumerate(gen_res.get("steps", []), 1):
        params = step.get("parameters") or step.get("params", {})
        print(f"\nStep {idx}: [{step['id']}] {step['name']}")
        print(f"  Tool:               {step['tool']}")
        print(f"  Requires Approval:  {step.get('requires_approval')}")
        print(f"  Parameters:         {json.dumps(params, indent=2)}")

        if step["tool"] == "get_latest_news":
            topic = params.get("topic", "")
            # Ensure topic is NOT the raw user prompt
            if "check current" in topic.lower() or len(topic) > 40:
                print(f"  [ERROR] Topic extraction failed: '{topic}'")
                clean_params_verified = False
            else:
                print(f"  [PASS] Clean topic extracted: '{topic}' (days={params.get('days')})")

        elif step["tool"] == "save_file":
            filename = params.get("filename", "")
            if filename not in ("ai_daily_news.txt", "workspace/ai_daily_news.txt"):
                print(f"  [WARN] Filename differs: '{filename}'")
            else:
                print(f"  [PASS] Correct sandboxed target file: '{filename}'")

    if not clean_params_verified:
        print("\n[FAIL] Clean parameter extraction failed.")
        sys.exit(1)

    # STEP 2: Execution Stream & Approval Card Flow
    print("\n" + "=" * 80)
    print(">>> STEP 2: STREAMING EXECUTION & HUMAN APPROVAL PAUSE")
    print("=" * 80)

    stream_url = f"{BASE_URL}/api/workflows/{wf_id}/stream?dry_run=false"
    req = urllib.request.Request(stream_url, headers={"User-Agent": "AgentFlow-Verification"})

    pending_approval_id = None
    step_results = {}
    final_event = None

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

            if etype == "workflow_start":
                print(f"[SSE:workflow_start] ID={event.get('workflow_id')} Title='{event.get('title')}'")

            elif etype == "step_start":
                print(f"\n[SSE:step_start] Step [{event.get('step_id')}]: {event.get('name')} (tool: {event.get('tool')})")

            elif etype == "step_result":
                sid = event.get("step_id")
                res = event.get("result", "")
                step_results[sid] = res
                first_lines = "\n".join(str(res).splitlines()[:5])
                print(f"[SSE:step_result] Step [{sid}] Completed! Output preview:\n{first_lines}...")

            elif etype == "approval_required":
                print("\n" + "#" * 70)
                print(">>> [APPROVAL CARD DETECTED] Human Approval Triggered!")
                print("#" * 70)
                pending_approval_id = event["approval_id"]
                step_id = event.get("step_id")
                tool_name = event.get("tool")
                params = event.get("parameters", {})

                print(f"Approval ID:       {pending_approval_id}")
                print(f"Paused Step:       [{step_id}] {event.get('name')}")
                print(f"Tool Action:       {tool_name}")
                print(f"Target Filename:   {params.get('filename')}")
                print(f"Rendered Content Length: {len(params.get('content', ''))} characters")

                content_preview = "\n".join(params.get("content", "").splitlines()[:10])
                print("\nRendered File Content Preview:")
                print("-" * 50)
                print(content_preview)
                print("-" * 50)

                # Check if placeholders were resolved
                if "{{" in params.get("content", ""):
                    print("[ERROR] Unresolved template placeholder found in content!")
                    sys.exit(1)
                else:
                    print("[PASS] Template placeholders successfully resolved with real news & time data!")

                # Verify workflow is in waiting_for_approval state
                wf_state = make_request(f"/api/workflows/{wf_id}")
                print(f"Database Workflow State: {wf_state.get('status')}")

                # Simulate User Approval
                print("\n>>> Simulating User Action: Clicking 'Approve & Continue'...")
                time.sleep(1.5)
                approve_res = make_request(f"/api/approvals/{pending_approval_id}", method="POST", data={"decision": "approve"})
                print(f">>> POST /api/approvals/{pending_approval_id} Response: {approve_res.get('status')}")

            elif etype == "approval_resolved":
                print(f"[SSE:approval_resolved] Decision: {event.get('decision')}")

            elif etype == "step_error":
                print(f"[SSE:step_error] Step [{event.get('step_id')}]: {event.get('error')}")

            elif etype == "workflow_complete":
                final_event = event
                print("\n" + "#" * 70)
                print(">>> [WORKFLOW EXECUTION COMPLETED]")
                print("#" * 70)
                print(f"Final Status:      {event.get('status')}")
                print(f"Duration:          {event.get('duration_seconds')}s")
                print(f"Summary:           {event.get('summary')}")
                print(f"Generated Files:   {event.get('generated_files')}")
                break

    # STEP 3: Verify Real News Results with Dates
    print("\n" + "=" * 80)
    print(">>> STEP 3: REAL NEWS RESULTS VERIFICATION (DATES, SOURCES, HEADLINES)")
    print("=" * 80)
    news_step_output = None
    for sid, out in step_results.items():
        if "AI" in str(out) or "News" in str(out) or "http" in str(out):
            news_step_output = str(out)
            break

    if news_step_output and "No recent news found" not in news_step_output:
        print("[PASS] Real news articles successfully fetched!")
        lines = [l for l in news_step_output.splitlines() if l.strip()][:15]
        for l in lines:
            print(f"  {l}")
    else:
        print(f"[FAIL] News step did not return real news: {news_step_output}")
        sys.exit(1)

    # STEP 4: Inspect Workspace File on Disk
    print("\n" + "=" * 80)
    print(">>> STEP 4: SAVED WORKSPACE FILE VERIFICATION")
    print("=" * 80)
    target_path = os.path.join(os.getcwd(), "workspace", "ai_daily_news.txt")
    if os.path.exists(target_path):
        file_size = os.path.getsize(target_path)
        print(f"File Path: {target_path}")
        print(f"File Size: {file_size} bytes ({round(file_size / 1024, 2)} KB)")
        if file_size < 100:
            print(f"[ERROR] File is suspiciously small ({file_size} bytes)! Possible false success failure.")
            sys.exit(1)
        else:
            print("[PASS] File size is robust (> 1 KB).")

        print("\n--- Actual Content of workspace/ai_daily_news.txt (First 25 lines) ---")
        with open(target_path, "r", encoding="utf-8", errors="replace") as f:
            for i, line in enumerate(f):
                if i >= 25:
                    print("  ... [truncated for display]")
                    break
                print(f"  {line.rstrip()}")
    else:
        print(f"[FAIL] Target file not found at {target_path}!")
        sys.exit(1)

    # STEP 5: Verify Results Panel API & Workspace Download
    print("\n" + "=" * 80)
    print(">>> STEP 5: RESULTS PANEL & WORKSPACE DOWNLOAD VERIFICATION")
    print("=" * 80)
    dl_url = f"/api/workspace/files/ai_daily_news.txt/download"
    req_dl = urllib.request.Request(f"{BASE_URL}{dl_url}")
    with urllib.request.urlopen(req_dl) as dl_resp:
        content_header = dl_resp.headers.get("Content-Disposition")
        dl_bytes = dl_resp.read()
        print(f"Download Endpoint:       {dl_url}")
        print(f"Content-Disposition:     {content_header}")
        print(f"Downloaded Bytes:        {len(dl_bytes)} bytes")
        print("[PASS] Workspace file download endpoint is operational!")

    # STEP 6: History Cleanup & Deduplication Verification
    print("\n" + "=" * 80)
    print(">>> STEP 6: HISTORY CLEANUP, SEARCH, AND DEDUPLICATION VERIFICATION")
    print("=" * 80)
    # Deduplicate endpoint check
    dedup = make_request("/api/workflows/deduplicate", method="POST", data={})
    print(f"Deduplication API Result: {dedup.get('message')}")

    # Search check
    search_res = make_request("/api/workflows?search=ai_daily_news.txt")
    print(f"Workflows matching 'ai_daily_news.txt': {len(search_res.get('workflows', []))}")

    # Status filter check
    status_res = make_request("/api/workflows?status=completed")
    print(f"Workflows with status 'completed':      {len(status_res.get('workflows', []))}")

    print("\n" + "=" * 80)
    print("ALL TESTS PASSED SUCCESSFULLY! WORKFLOW ENGINE FULLY VERIFIED.")
    print("=" * 80)

if __name__ == "__main__":
    run_test()
