import os
import sys
import time
import json
import threading
import urllib.request
import uvicorn
from backend.main import app

def run_server():
    config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="warning")
    server = uvicorn.Server(config)
    server.run()

# Start server in daemon thread
t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(2.0)  # wait for startup

base = "http://127.0.0.1:8000"

endpoints = [
    "/api/health",
    "/api/showcase/overview",
    "/api/showcase/check/health",
    "/api/showcase/check/llm",
    "/api/showcase/check/news",
    "/api/showcase/check/telegram",
    "/api/showcase/check/scheduler",
    "/api/showcase/check/database",
    "/api/showcase/check/frontend-connectivity",
]

print("--- Testing GET Endpoints ---")
failed = 0
for ep in endpoints:
    url = base + ep
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ShowcaseTester"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
            status = data.get("status", "ok")
            print(f"[PASS 200] {ep:42} -> status={status}")
    except Exception as e:
        print(f"[FAIL]     {ep:42} -> {e}")
        failed += 1

print("\n--- Testing POST /api/showcase/preview-digest ---")
try:
    preview_req = urllib.request.Request(
        base + "/api/showcase/preview-digest",
        data=b"{}",
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(preview_req, timeout=12) as resp:
        data = json.loads(resp.read().decode())
        count = data.get("stories_count", 0)
        preview_len = len(data.get("markdown_digest", ""))
        print(f"[PASS 200] /api/showcase/preview-digest -> stories={count}, chars={preview_len}")
except Exception as e:
    print(f"[FAIL]     /api/showcase/preview-digest -> {e}")
    failed += 1

print("\n--- Testing Frontend SPA Routing ---")
try:
    spa_req = urllib.request.Request(base + "/?tab=showcase", headers={"User-Agent": "ShowcaseTester"})
    with urllib.request.urlopen(spa_req, timeout=5) as resp:
        html = resp.read().decode()
        assert "<div id=\"root\">" in html or "AgentFlow" in html
        print(f"[PASS 200] SPA Index served successfully ({len(html)} bytes)")
except Exception as e:
    print(f"[FAIL]     SPA Index -> {e}")
    failed += 1

if failed == 0:
    print("\nALL SHOWCASE LIVE PROBES PASSED (100% SUCCESS)")
    sys.exit(0)
else:
    print(f"\n{failed} PROBES FAILED")
    sys.exit(1)
