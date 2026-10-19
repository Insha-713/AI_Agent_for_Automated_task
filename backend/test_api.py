"""
AgentFlow - Stage 2 Verification Test
Tests FastAPI REST endpoints, Server-Sent Events (SSE) streaming, and SQLite persistence.
"""

import os
import sys
import json
import asyncio
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
from backend.db import init_db


async def run_stage_2_tests():
    print("\n" + "=" * 65)
    print("  🚀 AGENTFLOW: Stage 2 Verification (FastAPI + SSE + SQLite)  ")
    print("=" * 65)

    # 1. Initialize SQLite
    print("\n[Test 1/6] Initializing SQLite database...")
    await init_db()
    print("✅ Database initialized successfully.")

    # Create ASGI test client
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=90.0) as client:

        # 2. Test Health Endpoint
        print("\n[Test 2/7] Testing GET /api/health...")
        health_resp = await client.get("/api/health")
        print("Status:", health_resp.status_code)
        health_data = health_resp.json()
        print("Response:", json.dumps(health_data, indent=2))
        assert health_resp.status_code == 200, "Health check failed"
        assert health_data["status"] == "healthy", "App unhealthy"
        print("✅ Health check endpoint verified.")

        # Test React SPA delivery
        print("\n[Test 3/7] Testing GET / (React SPA Delivery)...")
        spa_resp = await client.get("/")
        assert spa_resp.status_code == 200, "SPA delivery failed"
        assert "<title>AgentFlow" in spa_resp.text, "SPA HTML title not found"
        print("✅ React UI bundle successfully served at root /.")

        # 3. Test Create Task Endpoint
        print("\n[Test 3/6] Testing POST /api/tasks...")
        test_prompt = "Check current time in India, save a note to workspace/stage2_verified.txt, and confirm."
        create_resp = await client.post("/api/tasks", json={"prompt": test_prompt})
        print("Status:", create_resp.status_code)
        task_data = create_resp.json()
        print("Response:", task_data)
        assert create_resp.status_code == 200, "Create task failed"
        task_id = task_data["id"]
        assert task_id, "Missing task_id"
        print(f"✅ Task created with ID: {task_id}")

        # 4. Test SSE Streaming Endpoint
        print(f"\n[Test 4/6] Testing GET /api/tasks/{task_id}/stream (SSE Live Brain)...")
        received_events = []
        async with client.stream("GET", f"/api/tasks/{task_id}/stream") as stream_resp:
            assert stream_resp.status_code == 200, "SSE stream failed to open"
            print("Connected to SSE Stream (text/event-stream). Streaming live steps:")
            
            async for line in stream_resp.aiter_lines():
                if line.startswith("data: "):
                    raw_json = line[6:].strip()
                    if raw_json:
                        event = json.loads(raw_json)
                        received_events.append(event)
                        etype = event.get("type")
                        
                        if etype == "start":
                            print(f"  ⚡ [STREAM START]: Model = {event.get('model')}")
                        elif etype == "thought":
                            preview = event.get("content", "")[:100]
                            print(f"  🧠 [STREAM THOUGHT]: {preview}...")
                        elif etype == "tool_call":
                            print(f"  🔧 [STREAM TOOL CALL]: {event.get('tool')} {event.get('args')}")
                        elif etype == "tool_result":
                            res_preview = event.get("result", "")[:100]
                            print(f"  📥 [STREAM TOOL RESULT]: {event.get('tool')} -> {res_preview}...")
                        elif etype == "final_answer":
                            print(f"  🎯 [STREAM FINAL ANSWER]: {event.get('content')[:120]}...")
                        elif etype == "done":
                            print(f"  🏁 [STREAM DONE]: Finished in {event.get('duration_seconds')}s (Status: {event.get('status')})")
                            break
                        elif etype == "error":
                            print(f"  ❌ [STREAM ERROR]: {event.get('error')}")
                            break

        assert len(received_events) > 0, "No SSE events received"
        print(f"✅ Successfully received {len(received_events)} SSE live events over the stream.")

        # 5. Test SQLite Persistence Verification
        print(f"\n[Test 5/6] Testing GET /api/tasks/{task_id} (SQLite History Persistence)...")
        detail_resp = await client.get(f"/api/tasks/{task_id}")
        assert detail_resp.status_code == 200, "Get task details failed"
        detail_data = detail_resp.json()
        print(f"Persisted Status: {detail_data.get('status')}")
        print(f"Persisted Steps Count: {len(detail_data.get('steps', []))}")
        print(f"Final Answer Length: {len(detail_data.get('final_answer', ''))} chars")
        assert len(detail_data.get("steps", [])) > 0, "Steps were not persisted to SQLite"
        print("✅ SQLite step-by-step history persistence verified.")

        # 6. Test Dashboard Stats & Workspace Endpoints
        print("\n[Test 6/6] Testing Dashboard Stats & Settings Endpoints...")
        stats_resp = await client.get("/api/stats")
        assert stats_resp.status_code == 200
        stats = stats_resp.json()
        print("Dashboard Metrics:", stats)

        files_resp = await client.get("/api/workspace/files")
        assert files_resp.status_code == 200
        files_data = files_resp.json()
        print(f"Workspace Files ({files_data.get('count')} files): {[f['name'] for f in files_data.get('files', [])]}")

        settings_resp = await client.get("/api/settings")
        assert settings_resp.status_code == 200
        print("Settings:", settings_resp.json())

        print("\n" + "=" * 65)
        print("  🎉 STAGE 2 VERIFICATION COMPLETE: ALL TESTS PASSED!")
        print("=" * 65 + "\n")


if __name__ == "__main__":
    asyncio.run(run_stage_2_tests())
