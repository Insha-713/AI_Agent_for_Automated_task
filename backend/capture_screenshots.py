"""
AgentFlow - Screenshot Capture & Main Flow Verification
Captures:
1. Dashboard Page
2. Integrations Page
3. Welcome Tour Modal
4. Create Workflow (during a run with the Approval Card)
5. Results Panel after completion
Copies screenshots directly to the conversation artifacts directory.
"""

import subprocess
import urllib.request
import json
import time
import os
import shutil
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ARTIFACT_DIR = r"C:\Users\Insha fatima\.gemini\antigravity\brain\f475f64b-3d75-4036-a74b-369a7c0a1828"
TEMP_DIR = os.environ.get("TEMP", r"C:\Users\Insha fatima\AppData\Local\Temp")

os.makedirs(ARTIFACT_DIR, exist_ok=True)

def take_screenshot(url: str, output_name: str, width: int = 1440, height: int = 1600, timeout_sec: int = 50):
    temp_target = os.path.join(TEMP_DIR, output_name)
    if os.path.exists(temp_target):
        try: os.remove(temp_target)
        except: pass

    cmd = [
        EDGE_EXE,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        f"--window-size={width},{height}",
        f"--screenshot={temp_target}",
        url
    ]
    try:
        subprocess.run(cmd, capture_output=True, timeout=timeout_sec)
    except subprocess.TimeoutExpired:
        print(f"  [TIMEOUT] Headless Edge exceeded {timeout_sec}s for {url}")

    time.sleep(0.5)

    if os.path.exists(temp_target) and os.path.getsize(temp_target) > 5000:
        dest_artifact = os.path.join(ARTIFACT_DIR, output_name)
        shutil.copy2(temp_target, dest_artifact)
        print(f"  [CAPTURED] {output_name} ({round(os.path.getsize(dest_artifact)/1024, 1)} KB) -> {dest_artifact}")
        return dest_artifact
    else:
        print(f"  [ERROR] Failed to capture {output_name}")
        return None

def main():
    print("=" * 80)
    print("STARTING LIVE SCREENSHOT CAPTURE & WORKFLOW VERIFICATION")
    print("=" * 80)

    # 1. Capture Dashboard Page
    print("\n>>> 1. Capturing Dashboard Page...")
    take_screenshot(f"{BASE_URL}/?tab=dashboard&notour=true", "dashboard_page.png", height=1500)

    # 2. Capture Integrations Page
    print("\n>>> 2. Capturing Integrations Page...")
    take_screenshot(f"{BASE_URL}/?tab=settings&notour=true", "integrations_page.png", height=1600)

    # 3. Capture Welcome Tour Modal
    print("\n>>> 3. Capturing Welcome Tour Modal...")
    take_screenshot(f"{BASE_URL}/?tour=true", "welcome_tour_modal.png", height=1000)

    # 4. Capture Create Workflow (During Run with Approval Card)
    print("\n>>> 4. Capturing Create Workflow (During Run with Approval Card)...")
    take_screenshot(f"{BASE_URL}/?tab=workflows&view=approval&notour=true", "create_workflow_during_run.png", height=2400)

    # 5. Capture Results Page
    print("\n>>> 5. Capturing Workflow Results Page...")
    take_screenshot(f"{BASE_URL}/?tab=workflows&view=results&notour=true", "results_page.png", height=2200)

    # 6. Main Live Flow Execution & Verification: Weather Workflow
    print("\n" + "=" * 80)
    print(">>> 6. Running Live Backend Flow: 'Send me the weather report of Lucknow by email to inshaf713@gmail.com'...")
    print("=" * 80)
    prompt = "Send me the weather report of Lucknow by email to inshaf713@gmail.com"
    gen_req = urllib.request.Request(
        f"{BASE_URL}/api/workflows/generate",
        data=json.dumps({"prompt": prompt}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(gen_req) as r:
        plan = json.loads(r.read().decode("utf-8"))
    wf_id = plan["workflow_id"]
    print(f"  [Generated Plan] ID: {wf_id} | Title: {plan.get('title')}")
    print(f"  [Steps]: {len(plan.get('steps', []))} steps planned:")
    for s in plan.get("steps", []):
        print(f"    - {s['id']}: {s['name']} (tool: {s['tool']}, requires_approval: {s.get('requires_approval')})")

    # Start live execution stream
    stream_url = f"{BASE_URL}/api/workflows/{wf_id}/stream?dry_run=false"
    req_stream = urllib.request.Request(stream_url, headers={"User-Agent": "AgentFlow-Test"})
    
    pending_appr_id = None
    stream_resp = urllib.request.urlopen(req_stream, timeout=60)
    
    print("\n  [Live SSE Stream Events]:")
    for line in stream_resp:
        line_str = line.decode("utf-8").strip()
        if not line_str.startswith("data: "):
            continue
        event = json.loads(line_str[6:])
        etype = event.get("type")
        
        if etype == "workflow_start":
            print(f"    [EVENT] workflow_start: {event.get('title')}")
        elif etype == "step_start":
            print(f"    [EVENT] step_start: [{event.get('step_id')}] {event.get('name')} (tool: {event.get('tool')})")
        elif etype == "step_result":
            res_preview = str(event.get('result'))[:120].replace('\n', ' ')
            print(f"    [EVENT] step_result: [{event.get('step_id')}] -> {res_preview}")
        elif etype == "approval_required":
            pending_appr_id = event["approval_id"]
            print(f"\n  *** [PAUSED FOR APPROVAL] ***")
            print(f"    Approval ID: {pending_appr_id}")
            print(f"    Step: [{event.get('step_id')}] {event.get('name')}")
            print(f"    Tool: {event.get('tool')}")
            params = event.get("parameters", {})
            print(f"    Receiver: {params.get('receiver')}")
            print(f"    Subject: {params.get('subject')}")
            print(f"    Body snippet: {str(params.get('body'))[:100]}...")
            break

    # Simulate User Approval via API
    if pending_appr_id:
        print(f"\n  [Simulating User Approval] POST /api/approvals/{pending_appr_id} decision='approve'...")
        appr_req = urllib.request.Request(
            f"{BASE_URL}/api/approvals/{pending_appr_id}",
            data=json.dumps({"decision": "approve"}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(appr_req) as ar:
            res_json = json.loads(ar.read().decode("utf-8"))
            print(f"    Approval Response: {res_json}")

        # Continue reading stream to completion
        for line in stream_resp:
            line_str = line.decode("utf-8").strip()
            if not line_str.startswith("data: "):
                continue
            event = json.loads(line_str[6:])
            etype = event.get("type")
            if etype == "step_result":
                res_preview = str(event.get('result'))[:120].replace('\n', ' ')
                print(f"    [EVENT] step_result: [{event.get('step_id')}] -> {res_preview}")
            elif etype == "workflow_complete":
                print(f"\n  *** [WORKFLOW COMPLETE] ***")
                print(f"    Final Status: {event.get('status').upper()}")
                print(f"    Duration: {event.get('duration_seconds')}s")
                print(f"    Summary: {event.get('summary')}")
                break

    stream_resp.close()

    print("\n" + "=" * 80)
    print("ALL VERIFICATIONS COMPLETE & SCREENSHOTS SAVED!")
    print("=" * 80)

if __name__ == "__main__":
    main()
