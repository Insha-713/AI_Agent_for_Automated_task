"""
AgentFlow - Stage 5 Verification Test
Tests:
1. APScheduler integration (create, pause, resume, delete)
2. Persistent user memory (SQLite settings storage & system prompt injection)
3. Sandboxed file upload & workspace management
"""

import os
import sys
from pathlib import Path

# Ensure UTF-8 console output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import asyncio
from backend.db import (
    init_db,
    update_setting,
    get_all_settings,
    list_schedules_from_db,
    get_schedule_from_db,
)
from backend.agent import build_system_prompt
from backend.tools import WORKSPACE_PATH, read_file
from backend.scheduler import (
    start_scheduler,
    shutdown_scheduler,
    add_scheduled_task,
    pause_scheduled_task,
    resume_scheduled_task,
    delete_scheduled_task,
    scheduler,
)


async def test_stage5():
    print("=" * 60)
    print("AgentFlow Stage 5 Verification: Scheduler, Memory & Upload")
    print("=" * 60)

    # 1. Initialize DB and Scheduler
    await init_db()
    await start_scheduler()
    print("[1/4] SQLite DB and APScheduler initialized.")

    # 2. Test User Memory & System Prompt Injection
    print("\n[2/4] Testing User Memory & Profile Injection...")
    test_prefs = {
        "user_name": "Insha Fatima",
        "default_email": "insha@example.com",
        "writing_style": "Professional, concise, and courteous Indian business English",
        "target_audience": "Tech recruiters and small business clients in India",
        "currency_preference": "INR (Rs.)",
    }

    for key, val in test_prefs.items():
        await update_setting(key, val)

    loaded_prefs = await get_all_settings()
    assert loaded_prefs.get("user_name") == "Insha Fatima", "User name not stored correctly!"
    assert loaded_prefs.get("default_email") == "insha@example.com", "Email not stored correctly!"
    print("  -> Stored and retrieved user memory in SQLite successfully.")

    system_prompt = build_system_prompt(preferences=loaded_prefs)
    assert "Insha Fatima" in system_prompt, "System prompt missing user_name!"
    assert "INR (Rs.)" in system_prompt, "System prompt missing currency preference!"
    assert "Persistent User Memory & Profile" in system_prompt, "Memory section missing!"
    print("  -> Injected user memory seamlessly into LLM system prompt.")

    # 3. Test APScheduler recurring jobs
    print("\n[3/4] Testing Recurring Autonomous Schedules...")
    sched_record = await add_scheduled_task(
        name="Daily Morning Tech News",
        prompt="Search for top 3 AI and tech news in India today and summarize them.",
        frequency="daily_8am"
    )
    sched_id = sched_record["id"]
    print(f"  -> Created schedule '{sched_record['name']}' (ID: {sched_id})")

    # Verify job is present in APScheduler
    job = scheduler.get_job(sched_id)
    assert job is not None, "APScheduler job not found in scheduler instance!"
    print("  -> Job successfully registered in APScheduler instance.")

    # Test pause
    await pause_scheduled_task(sched_id)
    rec_paused = await get_schedule_from_db(sched_id)
    assert rec_paused["status"] == "paused", f"Expected 'paused', got {rec_paused['status']}"
    print("  -> Paused schedule successfully.")

    # Test resume
    await resume_scheduled_task(sched_id)
    rec_active = await get_schedule_from_db(sched_id)
    assert rec_active["status"] == "active", f"Expected 'active', got {rec_active['status']}"
    print("  -> Resumed schedule successfully.")

    # Test delete
    await delete_scheduled_task(sched_id)
    rec_deleted = await get_schedule_from_db(sched_id)
    assert rec_deleted is None, "Schedule was not deleted from database!"
    assert scheduler.get_job(sched_id) is None, "Job still in APScheduler after deletion!"
    print("  -> Deleted schedule from APScheduler and SQLite cleanly.")

    # 4. Test Sandboxed Workspace File Upload & Preview
    print("\n[4/4] Testing Sandboxed Workspace File Upload & Preview...")
    sample_file = WORKSPACE_PATH / "test_stage5_resume.txt"
    sample_content = (
        "Name: Insha Fatima\n"
        "Role: AI Solutions Architect\n"
        "Skills: Python, FastAPI, LangGraph, React, Ollama Local LLMs\n"
        "Location: India\n"
        "Projects: Built AgentFlow - A private local AI agent for students and businesses."
    )
    sample_file.write_text(sample_content, encoding="utf-8")

    assert sample_file.exists(), "Sample file was not created in workspace!"
    
    # Read tool check
    preview = read_file.func("test_stage5_resume.txt")
    assert "AgentFlow" in preview, "File tool failed to read uploaded workspace document!"
    print(f"  -> File created in workspace ({sample_file.name}, {len(sample_content)} bytes).")
    print("  -> Read file tool successfully parsed uploaded document contents.")

    # Clean up test file
    sample_file.unlink()
    print("  -> Cleaned up temporary test file.")

    shutdown_scheduler()
    print("\n" + "=" * 60)
    print("ALL STAGE 5 VERIFICATION CHECKS PASSED (100% SUCCESS)!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_stage5())
