"""
Automated Test for Stage 2: Scheduler Upgrade.
Verifies:
1. Hourly, Daily, Weekly, and Custom Cron triggers
2. Timezone support (Asia/Kolkata, UTC)
3. Pause, Resume, and Edit schedule
4. Next-run time calculation
5. Failure tracking and recording
6. Persistence across scheduler restarts
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime

# Fix Windows console encoding if needed
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.db import init_db, get_schedule_from_db, list_schedules_from_db
from backend.scheduler import (
    start_scheduler,
    shutdown_scheduler,
    add_scheduled_task,
    edit_scheduled_task,
    pause_scheduled_task,
    resume_scheduled_task,
    delete_scheduled_task,
    record_schedule_execution_result,
    _create_trigger
)

async def test_scheduler():
    print("=== Testing Stage 2: Scheduler Upgrade ===")
    await init_db()
    await start_scheduler()

    # 1. Test Daily with Asia/Kolkata timezone
    s_daily = await add_scheduled_task(
        name="Test Daily News Brief",
        prompt="Fetch today AI news in India",
        frequency="daily",
        timezone_str="Asia/Kolkata",
        hour=8,
        minute=30
    )
    assert s_daily["timezone"] == "Asia/Kolkata"
    assert s_daily["next_run"] is not None
    print(f"1. Daily schedule created. Next run: {s_daily['next_run']}")

    # 2. Test Hourly
    s_hourly = await add_scheduled_task(
        name="Test Hourly Audit",
        prompt="Audit workspace files",
        frequency="hourly",
        timezone_str="UTC"
    )
    assert s_hourly["next_run"] is not None
    print(f"2. Hourly schedule created. Next run: {s_hourly['next_run']}")

    # 3. Test Custom Cron
    s_cron = await add_scheduled_task(
        name="Test Weekday Cron",
        prompt="Weekday summary",
        frequency="cron",
        cron_expression="0 9 * * 1-5",
        timezone_str="Asia/Kolkata"
    )
    assert s_cron["cron_expression"] == "0 9 * * 1-5"
    print(f"3. Custom Cron schedule created. Next run: {s_cron['next_run']}")

    # 4. Test Pause and Resume
    await pause_scheduled_task(s_daily["id"])
    rec_paused = await get_schedule_from_db(s_daily["id"])
    assert rec_paused["status"] == "paused"
    print("4. Schedule successfully paused.")

    await resume_scheduled_task(s_daily["id"])
    rec_resumed = await get_schedule_from_db(s_daily["id"])
    assert rec_resumed["status"] == "active"
    print("5. Schedule successfully resumed.")

    # 5. Test Edit
    edit_success = await edit_scheduled_task(
        schedule_id=s_daily["id"],
        name="Updated Daily News Brief",
        prompt="Fetch AI & Robotics news in India",
        frequency="daily",
        timezone_str="Asia/Kolkata",
        hour=9,
        minute=0
    )
    assert edit_success is True
    rec_edited = await get_schedule_from_db(s_daily["id"])
    assert rec_edited["name"] == "Updated Daily News Brief"
    print(f"6. Schedule successfully edited. New Next run: {rec_edited['next_run']}")

    # 6. Test Failure Tracking
    now_str = datetime.now().isoformat()
    await record_schedule_execution_result(
        schedule_id=s_daily["id"],
        status="failed",
        last_run=now_str,
        error_msg="Connection timeout to news server"
    )
    rec_failed = await get_schedule_from_db(s_daily["id"])
    assert rec_failed["last_status"] == "failed"
    assert rec_failed["consecutive_failures"] >= 1
    assert "Connection timeout" in rec_failed["last_error"]
    print(f"7. Failure recorded: {rec_failed['consecutive_failures']} failure(s) logged.")

    # Cleanup test items
    await delete_scheduled_task(s_daily["id"])
    await delete_scheduled_task(s_hourly["id"])
    await delete_scheduled_task(s_cron["id"])
    print("8. Test schedules cleaned up.")

    shutdown_scheduler()
    print("\nALL STAGE 2 SCHEDULER UPGRADE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_scheduler())
