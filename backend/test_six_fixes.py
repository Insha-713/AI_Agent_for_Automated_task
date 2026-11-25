"""
Comprehensive Test Suite for Six Verified Fixes:
1. APScheduler daily schedule re-hydration and hourly frequency.
2. Direct routing of scheduled AI news digests through news generation and Telegram pipeline.
3. Accurate publisher name extraction from Google News RSS.
4. Telegram delivery success reported only on actual successful delivery.
5. LLM diagnostic and cloud fallback configuration.
6. Target schedule validation and activation readiness for 'Daily AI News Telegram Delivery'.
"""

import os
import sys
import json
import sqlite3
import asyncio
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ensure UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.scheduler import (
    _create_trigger,
    parse_schedule_time_params,
    execute_scheduled_agent_task,
    scheduler
)
from backend.tools import extract_publisher_and_clean_title, get_latest_news
from backend.news_module import (
    fetch_google_news,
    deliver_news_to_telegram,
    generate_daily_ai_news_digest
)
from backend.llm_provider import (
    get_llm_provider,
    is_llm_available,
    test_llm_connection
)
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger


def test_1_apscheduler_rehydration_and_hourly():
    print("\n--- Test 1: APScheduler Hourly Frequency & Daily Re-hydration ---")

    # 1a. Test hourly frequency creates 1-hour interval, not 8-hour
    hourly_trigger = _create_trigger(frequency="hourly", timezone_str="Asia/Kolkata")
    assert isinstance(hourly_trigger, IntervalTrigger), f"Expected IntervalTrigger, got {type(hourly_trigger)}"
    # IntervalTrigger.interval_length is float in seconds
    assert hourly_trigger.interval_length == 3600.0 or str(hourly_trigger) == "interval[1:00:00]", (
        f"Expected 3600s (1 hour) interval, got {hourly_trigger.interval_length}"
    )
    print("  [PASS] Hourly frequency creates exact 1-hour interval (3600s).")

    # 1b. Test parsing hour, minute, and day_of_week from cron_or_interval
    coi_17 = "cron[hour='17', minute='0']"
    params_17 = parse_schedule_time_params(coi_17)
    assert params_17["hour"] == 17, f"Expected hour 17, got {params_17['hour']}"
    assert params_17["minute"] == 0, f"Expected minute 0, got {params_17['minute']}"

    coi_08_30 = "cron[day_of_week='wed', hour='8', minute='30']"
    params_08_30 = parse_schedule_time_params(coi_08_30)
    assert params_08_30["hour"] == 8 and params_08_30["minute"] == 30 and params_08_30["day_of_week"] == "wed"

    # 1c. Test crontab 5-field expression parsing
    params_cron = parse_schedule_time_params("", "45 14 * * 5")
    assert params_cron["minute"] == 45 and params_cron["hour"] == 14 and params_cron["day_of_week"] == "5"

    # 1d. Test trigger recreation with parsed params preserves custom daily time (17:00)
    trigger_17 = _create_trigger(
        frequency="daily",
        timezone_str="Asia/Kolkata",
        hour=params_17["hour"],
        minute=params_17["minute"]
    )
    assert isinstance(trigger_17, CronTrigger)
    assert str(trigger_17) == "cron[hour='17', minute='0']"
    print("  [PASS] Schedule re-hydration correctly preserves custom hour (17:00) and crontab parameters.")


def test_2_accurate_publisher_extraction():
    print("\n--- Test 2: Accurate Publisher Extraction from Google News RSS ---")

    # 2a. Mock entry with entry.source.title
    class MockSource:
        title = "The Hindu"
    class MockEntrySource:
        title = "India AI Mission receives major government boost - The Hindu"
        source = MockSource()

    clean_t, pub = extract_publisher_and_clean_title(MockEntrySource(), MockEntrySource.title)
    assert clean_t == "India AI Mission receives major government boost", f"Got '{clean_t}'"
    assert pub == "The Hindu", f"Got '{pub}'"
    print("  [PASS] Extracted publisher from entry.source.title and stripped suffix from title.")

    # 2b. Mock entry without source object, using hyphen delimiter
    class MockEntryHyphen:
        title = "DeepSeek unveils novel open model - TechCrunch"
    clean_t2, pub2 = extract_publisher_and_clean_title(MockEntryHyphen(), MockEntryHyphen.title)
    assert clean_t2 == "DeepSeek unveils novel open model"
    assert pub2 == "TechCrunch"
    print("  [PASS] Extracted publisher from title hyphen suffix ('TechCrunch').")

    # 2c. Mock entry with pipe delimiter
    class MockEntryPipe:
        title = "AI compute capacity doubles in 2026 | Reuters"
    clean_t3, pub3 = extract_publisher_and_clean_title(MockEntryPipe(), MockEntryPipe.title)
    assert clean_t3 == "AI compute capacity doubles in 2026"
    assert pub3 == "Reuters"
    print("  [PASS] Extracted publisher from pipe suffix ('Reuters').")

    # 2d. Mock entry without delimiters
    class MockEntryPlain:
        title = "Autonomous AI agents achieve breakthrough"
    clean_t4, pub4 = extract_publisher_and_clean_title(MockEntryPlain(), MockEntryPlain.title)
    assert clean_t4 == "Autonomous AI agents achieve breakthrough"
    assert pub4 == "news.google.com"
    print("  [PASS] Clean fallback to 'news.google.com' when no publisher is detectable.")


def test_3_telegram_delivery_status_accuracy():
    print("\n--- Test 3: Telegram Delivery Reports Success Only on Actual Delivery ---")

    # 3a. Test simulation mode (no bot token configured)
    with patch("backend.news_module.send_telegram_message.func") as mock_tg:
        mock_tg.return_value = (
            "[SIMULATION MODE - TELEGRAM NOT SENT (APPROVED)]\n"
            "Notice: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in settings"
        )
        res = deliver_news_to_telegram("Test digest")
        assert res["mock"] is True, "Expected mock=True"
        assert res["simulated"] is True, "Expected simulated=True"
        assert res["success"] is False, f"Expected success=False in simulation, got {res['success']}"
        assert res["delivered"] is False, "Expected delivered=False"
        print("  [PASS] Simulation mode safely reports mock=True and success=False.")

    # 3b. Test actual live delivery success
    with patch("backend.news_module.send_telegram_message.func") as mock_tg:
        mock_tg.return_value = "Telegram message successfully delivered to chat '987654321'."
        res = deliver_news_to_telegram("Live digest")
        assert res["success"] is True, "Expected success=True"
        assert res["delivered"] is True, "Expected delivered=True"
        assert res["mock"] is False, "Expected mock=False"
        assert res["error"] is None
        print("  [PASS] Live delivery correctly reports success=True and mock=False.")

    # 3c. Test rejection by user
    with patch("backend.news_module.send_telegram_message.func") as mock_tg:
        mock_tg.return_value = "[ACTION REJECTED BY USER] Sending Telegram message was rejected by user."
        res = deliver_news_to_telegram("Rejected digest")
        assert res["success"] is False
        assert res["rejected"] is True
        print("  [PASS] User rejection correctly reports success=False and rejected=True.")


def test_4_scheduled_news_pipeline_routing():
    print("\n--- Test 4: Direct Pipeline Routing for Scheduled AI News Tasks ---")

    mock_digest = {
        "date": "Sunday, 22 November 2026",
        "time": "08:00 AM IST",
        "total_ingested": 10,
        "duplicates_removed": 2,
        "stories_count": 4,
        "stories": [
            {"title": "India AI Hub Established", "domain": "The Hindu", "link": "https://example.com/1"},
            {"title": "Open Source LLMs Progress", "domain": "TechCrunch", "link": "https://example.com/2"}
        ],
        "markdown_digest": "🤖 *AgentFlow Daily AI Brief*\n1. India AI Hub Established\n2. Open Source LLMs Progress"
    }

    test_sched_id = "test-sched-news-uuid"
    test_prompt = "Generate daily AI news digest on 'AI artificial intelligence India developments' and send to Telegram, save to workspace/ai_daily_news.txt"
    test_name = "Daily AI News Telegram Delivery"

    with patch("backend.news_module.generate_daily_ai_news_digest", return_value=mock_digest) as mock_gen, \
         patch("backend.news_module.deliver_news_to_telegram", return_value={"result": "Simulated", "mock": True, "success": False, "delivered": False}) as mock_deliv, \
         patch("backend.scheduler.get_schedule_from_db", return_value={"id": test_sched_id, "consecutive_failures": 0}), \
         patch("backend.scheduler.create_task") as mock_create_t, \
         patch("backend.scheduler.record_task_step") as mock_rec_step, \
         patch("backend.scheduler.complete_task") as mock_comp_t, \
         patch("backend.scheduler.record_schedule_execution_result") as mock_rec_res:

        # Run execute_scheduled_agent_task
        asyncio.run(execute_scheduled_agent_task(test_sched_id, test_prompt, test_name))

        # Verify news generator was called with extracted topic
        mock_gen.assert_called_once()
        assert "AI artificial intelligence India developments" in mock_gen.call_args[1].get("topic", "")

        # Verify telegram delivery was called with the generated markdown
        mock_deliv.assert_called_once_with(mock_digest["markdown_digest"])

        # Verify task completion was recorded
        mock_comp_t.assert_called_once()
        status_arg = mock_comp_t.call_args[0][1]
        assert status_arg == "completed", f"Expected status completed, got {status_arg}"

        # Verify workspace file was written
        workspace_file = Path("workspace/ai_daily_news.txt")
        assert workspace_file.exists(), "Expected workspace/ai_daily_news.txt to be created"
        content = workspace_file.read_text(encoding="utf-8")
        assert "AgentFlow Daily AI Brief" in content
        print("  [PASS] Scheduled AI news digest routed directly through news generation and Telegram pipeline.")
        print("  [PASS] File workspace/ai_daily_news.txt saved successfully.")


def test_5_llm_diagnostics_and_cloud_fallback():
    print("\n--- Test 5: LLM Diagnostics and Safe Cloud Key Detection ---")

    # 5a. When LLM_PROVIDER is unset and GROQ_API_KEY is present
    with patch.dict(os.environ, {"LLM_PROVIDER": "", "GROQ_API_KEY": "gsk_test_mock_key_12345"}, clear=False):
        prov = get_llm_provider()
        assert prov == "groq", f"Expected 'groq' when GROQ_API_KEY is present, got {prov}"
        print("  [PASS] Auto-detected 'groq' provider from environment key.")

    # 5b. When LLM_PROVIDER is unset and GEMINI_API_KEY is present
    with patch.dict(os.environ, {"LLM_PROVIDER": "", "GROQ_API_KEY": "", "GEMINI_API_KEY": "AIzaSy_mock_key_12345"}, clear=False):
        prov = get_llm_provider()
        assert prov == "gemini", f"Expected 'gemini' when GEMINI_API_KEY is present, got {prov}"
        print("  [PASS] Auto-detected 'gemini' provider from environment key.")

    # 5c. When LLM_PROVIDER is 'ollama' and Ollama is offline
    with patch.dict(os.environ, {"LLM_PROVIDER": "ollama", "OLLAMA_BASE_URL": "http://127.0.0.1:54321"}, clear=False):
        prov = get_llm_provider()
        assert prov == "ollama"
        avail, reason = is_llm_available()
        assert avail is False, "Expected Ollama to report offline"
        assert "No LLM available on this server" in reason

        diag = test_llm_connection()
        assert diag["status"] == "offline"
        assert diag["configured"] is False
        assert "ollama serve" in diag["guidance"].lower() or "groq" in diag["guidance"].lower()
        print("  [PASS] Offline Ollama diagnosed cleanly with actionable user guidance.")


def test_6_target_schedule_validation():
    print("\n--- Test 6: Validate and Prepare 'Daily AI News Telegram Delivery' Schedule ---")

    conn = sqlite3.connect("backend/agentflow.db")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM schedules WHERE id = '04b16da0-0dc5-4428-a979-53308a348e36'")
    row = cur.fetchone()
    conn.close()

    assert row is not None, "Target schedule '04b16da0-0dc5-4428-a979-53308a348e36' not found in SQLite"
    rec = dict(row)

    assert rec["name"] == "Daily AI News Telegram Delivery"
    assert rec["frequency"] == "daily"
    assert rec["timezone"] == "Asia/Kolkata"
    assert "cron[hour='8', minute='0']" in rec["cron_or_interval"]
    assert "Telegram" in rec["prompt"]

    # Verify that parse_schedule_time_params extracts hour=8, minute=0
    params = parse_schedule_time_params(rec["cron_or_interval"])
    assert params["hour"] == 8 and params["minute"] == 0

    # Verify trigger creation
    trigger = _create_trigger(
        frequency=rec["frequency"],
        timezone_str=rec["timezone"],
        hour=params["hour"],
        minute=params["minute"]
    )
    assert str(trigger) == "cron[hour='8', minute='0']"

    print(f"  Schedule ID: {rec['id']}")
    print(f"  Schedule Name: {rec['name']}")
    print(f"  Configured Trigger: {trigger} ({rec['timezone']})")
    print(f"  Current Status: {rec['status']} (Ready for activation)")
    print(f"  Prompt: {rec['prompt']}")
    print("  [PASS] Schedule configuration verified and 100% prepared for activation.")


if __name__ == "__main__":
    print("==================================================================")
    print("Running Full Verification Suite for Six Fixes in AgentFlow")
    print("==================================================================")

    test_1_apscheduler_rehydration_and_hourly()
    test_2_accurate_publisher_extraction()
    test_3_telegram_delivery_status_accuracy()
    test_4_scheduled_news_pipeline_routing()
    test_5_llm_diagnostics_and_cloud_fallback()
    test_6_target_schedule_validation()

    print("\n==================================================================")
    print("ALL SIX FIXES VERIFIED SUCCESSFULLY WITH 100% PASS RATE!")
    print("==================================================================")
