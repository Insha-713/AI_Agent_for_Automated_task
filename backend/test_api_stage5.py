"""
AgentFlow - Stage 5 REST API Endpoints Verification Test
Tests all new FastAPI endpoints:
1. /api/settings (GET, POST bulk update)
2. /api/workspace/upload (Multipart upload), /api/workspace/files, preview, delete
3. /api/schedules (GET, POST, pause, resume, run-now, DELETE)
"""

import os
import sys
import io
from pathlib import Path

# Ensure UTF-8 console output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.main import app

def test_stage5_api():
    print("=" * 60)
    print("Testing Stage 5 REST API Endpoints with TestClient")
    print("=" * 60)

    with TestClient(app) as client:
        # 1. Health check
        r = client.get("/api/health")
        assert r.status_code == 200, f"Health check failed: {r.text}"
        print("[1/5] Health check OK:", r.json()["active_model"])

        # 2. Settings Endpoints
        print("\n[2/5] Testing Settings API Endpoints...")
        save_resp = client.post("/api/settings", json={
            "settings": {
                "user_name": "Insha Fatima",
                "default_email": "insha.fatima@example.com",
                "writing_style": "Friendly and concise",
                "user_role": "AI Engineer",
                "custom_instructions": "Sign off with 'Best, Insha'"
            }
        })
        assert save_resp.status_code == 200, f"Failed to save settings: {save_resp.text}"
        
        get_resp = client.get("/api/settings")
        assert get_resp.status_code == 200
        settings = get_resp.json().get("settings", {})
        assert settings.get("user_name") == "Insha Fatima"
        assert settings.get("default_email") == "insha.fatima@example.com"
        print("  -> POST & GET /api/settings verified successfully.")

        # 3. Workspace File Upload, List, Preview & Delete
        print("\n[3/5] Testing Workspace File Management API...")
        file_content = b"Candidate Name: Insha Fatima\nRole: Lead AI Engineer\nTech: Python, FastAPI, React"
        files = {"file": ("test_resume.txt", io.BytesIO(file_content), "text/plain")}
        
        upload_resp = client.post("/api/workspace/upload", files=files)
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        up_data = upload_resp.json()
        assert up_data.get("filename") == "test_resume.txt"
        print(f"  -> Uploaded '{up_data.get('filename')}' ({up_data.get('size_bytes')} bytes).")

        # List files
        list_resp = client.get("/api/workspace/files")
        assert list_resp.status_code == 200
        file_names = [f["name"] for f in list_resp.json().get("files", [])]
        assert "test_resume.txt" in file_names
        print("  -> File verified in GET /api/workspace/files.")

        # Preview file
        prev_resp = client.get("/api/workspace/files/test_resume.txt/preview")
        assert prev_resp.status_code == 200
        assert "Insha Fatima" in prev_resp.json().get("content", "")
        print("  -> File preview verified in GET /api/workspace/files/.../preview.")

        # Delete file
        del_resp = client.delete("/api/workspace/files/test_resume.txt")
        assert del_resp.status_code == 200
        print("  -> File deleted via DELETE /api/workspace/files/test_resume.txt.")

        # 4. Schedules API Endpoints
        print("\n[4/5] Testing Schedules API Endpoints...")
        create_sched = client.post("/api/schedules", json={
            "name": "Hourly Tech Monitor",
            "prompt": "Search top AI developments in India and summarize",
            "frequency": "interval_60m"
        })
        assert create_sched.status_code == 200, f"Create schedule failed: {create_sched.text}"
        sched_data = create_sched.json()
        sched_id = sched_data["id"]
        print(f"  -> Created schedule ID: {sched_id}")

        # List schedules
        list_sched = client.get("/api/schedules")
        assert list_sched.status_code == 200
        all_ids = [s["id"] for s in list_sched.json().get("schedules", [])]
        assert sched_id in all_ids
        print("  -> Verified schedule in GET /api/schedules.")

        # Pause schedule
        pause_resp = client.post(f"/api/schedules/{sched_id}/pause")
        assert pause_resp.status_code == 200
        print("  -> Paused schedule via POST /api/schedules/{id}/pause.")

        # Resume schedule
        resume_resp = client.post(f"/api/schedules/{sched_id}/resume")
        assert resume_resp.status_code == 200
        print("  -> Resumed schedule via POST /api/schedules/{id}/resume.")

        # Trigger run-now (mock background execution to prevent slow LLM invocation during unit test)
        from unittest.mock import patch
        with patch("backend.main.run_scheduled_task_now", return_value=True):
            run_resp = client.post(f"/api/schedules/{sched_id}/run-now")
            assert run_resp.status_code == 200
            print("  -> Triggered run-now via POST /api/schedules/{id}/run-now.", flush=True)

        # Delete schedule
        del_sched = client.delete(f"/api/schedules/{sched_id}")
        assert del_sched.status_code == 200
        print("  -> Deleted schedule via DELETE /api/schedules/{id}.")

        print("\n[5/5] All Stage 5 API tests finished successfully!")
        print("=" * 60)
        print("STAGE 5 API VERIFICATION COMPLETE (100% PASS)")
        print("=" * 60)

if __name__ == "__main__":
    test_stage5_api()
