"""
AgentFlow V4.0 - LinkedIn Scheduling & Autonomous Sentinel Test Suite
Validates all requirements from user audit:
1. Schedule a post for 5 minutes from now.
2. Schedule a post for tomorrow at 10:00 AM Asia/Kolkata.
3. Create a daily recurring schedule.
4. Create a weekly recurring schedule.
5. Verify approval-required posts are not published before approval.
6. Restart the backend and verify schedules remain intact.
7. Verify duplicate posts are not published.
8. Verify missing LinkedIn credentials produce awaiting_credentials, not fake success.
"""

import os
import sys
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from backend.db import (
    init_db,
    save_social_post,
    get_social_post_by_id,
    list_social_posts,
    update_social_post_status,
    claim_scheduled_social_post,
    delete_social_post
)
from backend.platform_engine import (
    LinkedInAdapter,
    calculate_schedule_times,
    compute_next_occurrence,
    get_safe_timezone
)
from backend.scheduler import run_social_publishing_cycle

client = TestClient(app)

PASSED = 0
FAILED = 0

def record_test(name: str, passed: bool, details: str = ""):
    global PASSED, FAILED
    if passed:
        PASSED += 1
        print(f"[PASS] {name} - {details}")
    else:
        FAILED += 1
        print(f"[FAIL] {name} - {details}", file=sys.stderr)


async def main_tests():
    global PASSED, FAILED
    print("=" * 65)
    print("AgentFlow V4.0 - LinkedIn Post Scheduling & Sentinel Test Suite")
    print("=" * 65)

    await init_db()

    # -------------------------------------------------------------
    # Test 1: Schedule a post for 5 minutes from now
    # -------------------------------------------------------------
    try:
        tz = get_safe_timezone("Asia/Kolkata")
        now_local = datetime.now(tz)
        target_local = now_local + timedelta(minutes=5)
        d_str = target_local.strftime("%Y-%m-%d")
        t_str = target_local.strftime("%H:%M")

        res = client.post("/api/platform/social/schedule", json={
            "platform": "linkedin",
            "content": "Test automated LinkedIn schedule for 5 minutes from now #AgentFlow",
            "headline": "Autonomous Engineering Alert",
            "hashtags": ["#AI", "#Python", "#AgentFlow"],
            "date": d_str,
            "time": t_str,
            "timezone": "Asia/Kolkata",
            "frequency": "one_time",
            "approval_required": False,
            "auto_publish": True
        })

        data = res.json()
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        assert data.get("status") == "success"
        post = data.get("post", {})
        post_id_1 = post.get("id")
        assert post_id_1, "Missing post id"
        assert post.get("status") == "scheduled"
        assert post.get("auto_publish") is True
        assert post.get("frequency") == "one_time"
        assert post.get("timezone") == "Asia/Kolkata"

        # Verify in DB
        db_post = await get_social_post_by_id(post_id_1)
        assert db_post is not None
        assert db_post["status"] == "scheduled"
        record_test("1. Schedule Post 5 Minutes from Now", True, f"Post ID: {post_id_1}, Next Run (UTC): {db_post['next_run_at']}")
    except Exception as e:
        record_test("1. Schedule Post 5 Minutes from Now", False, str(e))

    # -------------------------------------------------------------
    # Test 2: Schedule a post for tomorrow at 10:00 AM Asia/Kolkata
    # -------------------------------------------------------------
    try:
        tomorrow_local = datetime.now(tz) + timedelta(days=1)
        d_str_2 = tomorrow_local.strftime("%Y-%m-%d")
        t_str_2 = "10:00"

        res = client.post("/api/platform/social/schedule", json={
            "platform": "linkedin",
            "content": "Tomorrow morning architectural insights: Multi-agent orchestration with SQLite state persistence.",
            "headline": "Engineering Architecture Deep Dive",
            "hashtags": ["#SoftwareEngineering", "#FastAPI", "#React"],
            "date": d_str_2,
            "time": t_str_2,
            "timezone": "Asia/Kolkata",
            "frequency": "one_time",
            "approval_required": True,
            "auto_publish": True
        })

        data = res.json()
        assert res.status_code == 200
        post = data.get("post", {})
        post_id_2 = post.get("id")
        # Since approval_required is True, status must be pending_approval
        assert post.get("status") == "pending_approval", f"Expected pending_approval, got {post.get('status')}"
        assert post.get("approval_required") is True

        # Check UTC conversion: 10:00 AM IST (UTC+5:30) is 04:30 AM UTC
        utc_iso = post.get("next_run_at", "")
        utc_dt = datetime.fromisoformat(utc_iso.replace("Z", "+00:00"))
        assert utc_dt.hour == 4 and utc_dt.minute == 30, f"Expected UTC 04:30, got {utc_dt.hour}:{utc_dt.minute}"
        record_test("2. Schedule Post for Tomorrow 10:00 AM Asia/Kolkata", True, f"Post ID: {post_id_2}, Local: 10:00 IST -> UTC: {utc_iso}")
    except Exception as e:
        record_test("2. Schedule Post for Tomorrow 10:00 AM Asia/Kolkata", False, str(e))

    # -------------------------------------------------------------
    # Test 3: Create a daily recurring schedule
    # -------------------------------------------------------------
    try:
        today_str = datetime.now().strftime("%Y-%m-%d")
        res = client.post("/api/platform/social/schedule", json={
            "platform": "linkedin",
            "content": "Daily Tech Digest: Autonomous AI pipelines and deterministic tool use.",
            "date": today_str,
            "time": "09:00",
            "timezone": "Asia/Kolkata",
            "frequency": "daily",
            "start_date": today_str,
            "end_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "approval_required": False,
            "auto_publish": True
        })

        data = res.json()
        assert res.status_code == 200
        post = data.get("post", {})
        post_id_3 = post.get("id")
        assert post.get("frequency") == "daily"
        assert post.get("status") == "scheduled"

        # Verify next occurrence calculation for daily
        sched_time_str = post.get("next_run_at")
        next_occ = compute_next_occurrence(sched_time_str, "daily", "Asia/Kolkata")
        assert next_occ is not None
        dt_curr = datetime.fromisoformat(sched_time_str.replace("Z", "+00:00"))
        dt_next = datetime.fromisoformat(next_occ.replace("Z", "+00:00"))
        diff = (dt_next - dt_curr).total_seconds()
        assert abs(diff - 86400) < 60, f"Expected 86400s (1 day) difference, got {diff}"

        record_test("3. Daily Recurring Schedule & Recurrence Calculation", True, f"Next daily occurrence: {next_occ}")
    except Exception as e:
        record_test("3. Daily Recurring Schedule & Recurrence Calculation", False, str(e))

    # -------------------------------------------------------------
    # Test 4: Create a weekly recurring schedule
    # -------------------------------------------------------------
    try:
        today_str = datetime.now().strftime("%Y-%m-%d")
        res = client.post("/api/platform/social/schedule", json={
            "platform": "linkedin",
            "content": "Weekly Engineering Retrospective: Key learnings and open-source releases.",
            "date": today_str,
            "time": "11:00",
            "timezone": "Asia/Kolkata",
            "frequency": "weekly",
            "approval_required": False,
            "auto_publish": True
        })

        data = res.json()
        assert res.status_code == 200
        post = data.get("post", {})
        post_id_4 = post.get("id")
        assert post.get("frequency") == "weekly"

        # Verify next occurrence calculation for weekly
        sched_time_str = post.get("next_run_at")
        next_occ = compute_next_occurrence(sched_time_str, "weekly", "Asia/Kolkata")
        assert next_occ is not None
        dt_curr = datetime.fromisoformat(sched_time_str.replace("Z", "+00:00"))
        dt_next = datetime.fromisoformat(next_occ.replace("Z", "+00:00"))
        diff = (dt_next - dt_curr).total_seconds()
        assert abs(diff - (7 * 86400)) < 60, f"Expected 7 days difference, got {diff}"

        record_test("4. Weekly Recurring Schedule & Recurrence Calculation", True, f"Next weekly occurrence (+7d): {next_occ}")
    except Exception as e:
        record_test("4. Weekly Recurring Schedule & Recurrence Calculation", False, str(e))

    # -------------------------------------------------------------
    # Test 5: Verify approval-required posts are NEVER published before approval
    # -------------------------------------------------------------
    try:
        past_utc = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        unapproved_post = await save_social_post({
            "platform": "linkedin",
            "content": "Sensitive milestone: Unapproved draft should remain locked in pending_approval.",
            "status": "pending_approval",
            "scheduled_for": past_utc,
            "next_run_at": past_utc,
            "approval_required": True,
            "approved_at": "",
            "auto_publish": True
        })
        unapproved_id = unapproved_post["id"]

        # Run scheduler cycle
        with patch.object(LinkedInAdapter, "publish_ugc_post") as mock_publish:
            mock_publish.return_value = {"success": True, "status": "published", "post_id": "test_id"}
            await run_social_publishing_cycle()
            # Must NOT be called because post is unapproved
            assert mock_publish.call_count == 0, "publish_ugc_post was called on unapproved post!"

        # Check DB status
        check_post = await get_social_post_by_id(unapproved_id)
        assert check_post["status"] == "pending_approval", f"Status changed illegally to {check_post['status']}"

        # Now approve it
        with patch.object(LinkedInAdapter, "publish_ugc_post") as mock_publish:
            mock_publish.return_value = {"success": True, "status": "published", "post_id": "ugc_mock_123", "post_url": "https://linkedin.com/mock"}
            res_approve = client.post(f"/api/platform/social/posts/{unapproved_id}/approve")
            assert res_approve.status_code == 200
            appr_data = res_approve.json()
            assert appr_data.get("action") == "published", f"Expected immediate publish since time passed, got {appr_data.get('action')}"
            assert mock_publish.call_count == 1

        approved_post = await get_social_post_by_id(unapproved_id)
        assert approved_post["status"] == "published"
        record_test("5. Approval Gate Security & Due Dispatch on Approval", True, "Unapproved post stayed locked; published immediately upon approval")
    except Exception as e:
        record_test("5. Approval Gate Security & Due Dispatch on Approval", False, str(e))

    # -------------------------------------------------------------
    # Test 6: Restart the backend and verify schedules remain intact
    # -------------------------------------------------------------
    try:
        # Save a distinctive schedule
        restart_post = await save_social_post({
            "platform": "linkedin",
            "content": "Post persisting across backend restarts and database rehydration.",
            "status": "scheduled",
            "scheduled_for": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "next_run_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "timezone": "Asia/Kolkata",
            "frequency": "weekly",
            "approval_required": True,
            "auto_publish": True
        })
        restart_id = restart_post["id"]

        # Simulate backend restart by calling init_db() anew
        await init_db()

        # Fetch post from SQLite
        reloaded = await get_social_post_by_id(restart_id)
        assert reloaded is not None, "Post lost after backend restart!"
        assert reloaded["status"] == "scheduled"
        assert reloaded["frequency"] == "weekly"
        assert reloaded["timezone"] == "Asia/Kolkata"
        assert reloaded["approval_required"] is True
        assert reloaded["auto_publish"] is True

        record_test("6. Schedule Persistence Across Backend Restarts", True, f"Verified post {restart_id} fully intact in SQLite")
    except Exception as e:
        record_test("6. Schedule Persistence Across Backend Restarts", False, str(e))

    # -------------------------------------------------------------
    # Test 7: Verify duplicate posts are not published (Atomic Claim)
    # -------------------------------------------------------------
    try:
        dup_post = await save_social_post({
            "platform": "linkedin",
            "content": "Testing race-condition avoidance and duplicate prevention.",
            "status": "scheduled",
            "auto_publish": True
        })
        dup_id = dup_post["id"]

        # First claim should succeed
        claim_1 = await claim_scheduled_social_post(dup_id)
        assert claim_1 is True, "First atomic claim should return True"

        # Second simultaneous or consecutive claim must fail
        claim_2 = await claim_scheduled_social_post(dup_id)
        assert claim_2 is False, "Second atomic claim must return False (already claimed)"

        claimed_post = await get_social_post_by_id(dup_id)
        assert claimed_post["status"] == "publishing"
        assert claimed_post["publish_attempts"] == 1

        record_test("7. Duplicate Publishing Prevention & Atomic Claim", True, "Claim 1: True, Claim 2: False (status: publishing, attempts: 1)")
    except Exception as e:
        record_test("7. Duplicate Publishing Prevention & Atomic Claim", False, str(e))

    # -------------------------------------------------------------
    # Test 8: Verify missing LinkedIn credentials produce awaiting_credentials
    # -------------------------------------------------------------
    try:
        # Clear or mock unconfigured credentials
        with patch("backend.platform_engine.get_credential", return_value=None):
            status = LinkedInAdapter.get_status()
            assert status.get("status") == "awaiting_credentials"
            assert status.get("configured") is False

            res_direct = client.post("/api/platform/linkedin/publish", json={
                "content": "Publishing attempt without credentials must return awaiting_credentials"
            })
            data = res_direct.json()
            assert data.get("success") is False
            assert data.get("status") == "awaiting_credentials"
            assert "Awaiting LinkedIn Access Token" in data.get("error", "")

        record_test("8. Missing Credentials Transparent Error Guard", True, "Returned status: awaiting_credentials with clear setup guidance (zero fake success)")
    except Exception as e:
        record_test("8. Missing Credentials Transparent Error Guard", False, str(e))

    # -------------------------------------------------------------
    # Additional: Edit, Pause, Resume, and Cancel Lifecycle
    # -------------------------------------------------------------
    try:
        lifecycle_post = await save_social_post({
            "platform": "linkedin",
            "content": "Lifecycle test schedule",
            "status": "scheduled",
            "frequency": "daily",
            "auto_publish": True
        })
        lc_id = lifecycle_post["id"]

        # Pause
        p_res = client.post(f"/api/platform/social/posts/{lc_id}/pause")
        assert p_res.status_code == 200
        assert p_res.json()["post"]["status"] == "paused"

        # Resume
        r_res = client.post(f"/api/platform/social/posts/{lc_id}/resume")
        assert r_res.status_code == 200
        assert r_res.json()["post"]["status"] == "scheduled"

        # Edit
        e_res = client.put(f"/api/platform/social/posts/{lc_id}", json={
            "content": "Updated content via schedule edit",
            "frequency": "weekly"
        })
        assert e_res.status_code == 200
        assert e_res.json()["post"]["content"] == "Updated content via schedule edit"
        assert e_res.json()["post"]["frequency"] == "weekly"

        # Cancel
        c_res = client.post(f"/api/platform/social/posts/{lc_id}/cancel")
        assert c_res.status_code == 200
        assert c_res.json()["post"]["status"] == "cancelled"

        record_test("9. Schedule Edit, Pause, Resume, and Cancel Lifecycle", True, "All lifecycle state transitions verified")
    except Exception as e:
        record_test("9. Schedule Edit, Pause, Resume, and Cancel Lifecycle", False, str(e))

    print("\n" + "=" * 65)
    print(f"TEST SUMMARY: {PASSED} Passed, {FAILED} Failed")
    print("=" * 65)
    if FAILED > 0:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main_tests())
