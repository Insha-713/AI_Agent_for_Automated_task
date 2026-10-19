"""
AgentFlow - Stage 1 Conversational Workflow Builder Automated Tests
Verifies:
1. Requirement extraction (Goal, Trigger/Schedule, Tools needed, Known vs Missing inputs)
2. Strict registered tool verification (Zero hallucinated tools)
3. Deduplication of questions (AI must not ask for anything already provided)
4. ONE-at-a-time interactive question answering and progress tracking
5. English, Hindi, and multi-lingual prompt parsing
6. FastAPI endpoints: /extract-requirements, /answer-question, /chat-help
"""

import sys
import os
import json
import asyncio
from pathlib import Path

# Fix Windows console encoding if needed
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from backend.main import app
from backend.workflows import (
    REGISTERED_TOOLS_META,
    parse_time_and_schedule,
    extract_known_entities,
    extract_workflow_requirements,
    process_question_answer,
    handle_chat_help_query,
)


def test_time_and_schedule_parsing():
    print("--- Test 1: Time & Schedule Parsing (IST Timezone) ---")
    
    # 1. Daily 5 PM English
    s1 = parse_time_and_schedule("Send me the weather report every day at 5 PM by email")
    assert s1["is_scheduled"] is True
    assert s1["time"] == "17:00"
    assert s1["time_display"] == "5:00 PM IST"
    assert s1["timezone"] == "Asia/Kolkata"
    print("  [PASS] 5 PM parsed correctly as 17:00 IST")

    # 2. Morning 9 AM
    s2 = parse_time_and_schedule("Send my important unread emails to Telegram every morning at 9")
    assert s2["is_scheduled"] is True
    assert s2["time"] == "09:00"
    assert s2["time_display"] == "9:00 AM IST"
    print("  [PASS] 9 AM parsed correctly as 09:00 IST")

    # 3. Hindi 8 AM ("subah 8 baje")
    s3 = parse_time_and_schedule("Roz subah 8 baje top AI news mere Gmail par bhejo")
    assert s3["is_scheduled"] is True
    assert s3["time"] == "08:00"
    assert s3["time_display"] == "8:00 AM IST"
    print("  [PASS] Hindi 'subah 8 baje' parsed correctly as 08:00 IST\n")


def test_requirement_extraction_with_missing_inputs():
    print("--- Test 2: Requirement Extraction with Missing Inputs ---")
    prompt = "Send me the weather report every day at 5 PM by email"
    reqs = asyncio.run(extract_workflow_requirements(prompt))

    print(f"Goal: {reqs['goal']}")
    print(f"Trigger: {reqs['trigger']['time_display']}")
    print(f"Tools Needed: {reqs['tools_needed']}")
    print(f"Total Questions: {reqs['total_questions']}")

    # Strict Registered Tools Validation
    for tool_name in reqs["tools_needed"]:
        assert tool_name in REGISTERED_TOOLS_META, f"Invalid tool: {tool_name}"
    print("  [PASS] Zero hallucinated tools verified.")

    assert "get_weather" in reqs["tools_needed"], "get_weather should be identified"
    assert "send_email" in reqs["tools_needed"], "send_email should be identified"

    # City was NOT provided in the prompt, so a question for city MUST be asked
    question_fields = [q["field"] for q in reqs["questions"]]
    assert "city" in question_fields, "Must ask for city since it was omitted"
    
    # Check ONE question at a time structure
    first_q = reqs["current_question"]
    assert first_q is not None
    assert first_q["field"] == "city"
    assert len(first_q["quick_replies"]) > 0
    print(f"  [PASS] First question: '{first_q['question']}' with quick replies {first_q['quick_replies']}\n")


def test_deduplication_of_known_inputs():
    print("--- Test 3: Deduplication (Must NOT ask for already provided info) ---")
    prompt_with_city = "Send me the weather of Lucknow daily at 5 PM by email"
    reqs = asyncio.run(extract_workflow_requirements(prompt_with_city))

    print(f"Prompt: '{prompt_with_city}'")
    print(f"Known inputs: {reqs['known_inputs']}")

    assert reqs["known_inputs"].get("city") == "Lucknow", "City 'Lucknow' should be recognized"
    assert reqs["known_inputs"].get("schedule_time") == "17:00", "Schedule time '17:00' should be recognized"

    # Crucial Rule: The AI must NOT ask for anything it already has!
    question_fields = [q["field"] for q in reqs["questions"]]
    assert "city" not in question_fields, "AI must NOT ask for city because it was already given as Lucknow!"
    assert "schedule_time" not in question_fields, "AI must NOT ask for schedule_time because it was already given as 5 PM!"
    print("  [PASS] City and schedule_time were NOT asked redundantly.\n")


def test_important_emails_to_telegram_task():
    print("--- Test 4: Important Emails to Telegram Task ---")
    prompt = "Send my important unread emails to Telegram every morning at 9"
    reqs = asyncio.run(extract_workflow_requirements(prompt))

    print(f"Goal: {reqs['goal']}")
    print(f"Tools Needed: {reqs['tools_needed']}")

    assert "read_important_emails" in reqs["tools_needed"]
    assert "send_telegram_message" in reqs["tools_needed"]
    assert reqs["trigger"]["time"] == "09:00"

    for tool_name in reqs["tools_needed"]:
        assert tool_name in REGISTERED_TOOLS_META, f"Invalid tool: {tool_name}"

    # Verify that important email criteria question is generated
    question_fields = [q["field"] for q in reqs["questions"]]
    assert "important_criteria" in question_fields or "important_criteria" in reqs["known_inputs"]
    print("  [PASS] read_important_emails and send_telegram_message requirements verified.\n")


def test_step_by_step_question_flow():
    print("--- Test 5: Step-by-Step Question Flow & Progress Indicator ---")
    prompt = "Send me the weather report every day at 5 PM by email"
    session = asyncio.run(extract_workflow_requirements(prompt))

    total_q = session["total_questions"]
    assert total_q >= 1
    assert session["answered_count"] == 0
    assert session["current_question_index"] == 0
    print(f"Initial State: 0 of {total_q} answered. Progress: 0%")

    # Answer Question 1 (city)
    active_field = session["current_question"]["field"]
    session = process_question_answer(session, active_field, "Lucknow")

    assert session["known_inputs"]["city"] == "Lucknow"
    assert session["answered_count"] == 1
    assert session["current_question_index"] == 1
    print(f"After answering '{active_field}': 1 of {total_q} answered.")

    # Answer remaining questions until complete
    while not session["is_complete"]:
        curr_q = session["current_question"]
        field_to_answer = curr_q["field"]
        dummy_answer = "test@example.com" if "email" in field_to_answer else "dummy_value"
        session = process_question_answer(session, field_to_answer, dummy_answer)
        print(f"Answered '{field_to_answer}' -> Progress: {session['answered_count']} of {total_q}")

    assert session["is_complete"] is True
    assert session["status"] == "ready"
    assert session["answered_count"] == total_q
    print("  [PASS] All questions answered sequentially. Progress reached 100%.\n")


def test_chat_help_guidance():
    print("--- Test 6: Chat Help & Non-Disruptive Guidance ---")
    
    # 1. App Password help
    help_app_pass = handle_chat_help_query("how do I get an app password?")
    assert "Google App Passwords" in help_app_pass
    print("  [PASS] App Password setup guidance verified.")

    # 2. Telegram Bot help
    help_tg = handle_chat_help_query("how do I get the telegram bot token?")
    assert "@BotFather" in help_tg
    print("  [PASS] Telegram BotFather guidance verified.")

    # 3. Weather help
    help_weather = handle_chat_help_query("is weather API free?")
    assert "Open-Meteo" in help_weather
    print("  [PASS] Open-Meteo free API guidance verified.\n")


def test_fastapi_endpoints():
    print("--- Test 7: FastAPI REST Endpoints Verification ---")
    client = TestClient(app)

    # 1. POST /api/workflows/extract-requirements
    res1 = client.post("/api/workflows/extract-requirements", json={
        "prompt": "Send me the weather report every day at 5 PM by email"
    })
    assert res1.status_code == 200, res1.text
    session = res1.json()
    assert "tools_needed" in session
    assert "questions" in session
    assert "trigger" in session
    print(f"  [PASS] POST /api/workflows/extract-requirements returned {session['total_questions']} questions.")

    # 2. POST /api/workflows/answer-question
    res2 = client.post("/api/workflows/answer-question", json={
        "session": session,
        "field": "city",
        "answer": "Lucknow"
    })
    assert res2.status_code == 200, res2.text
    updated_session = res2.json()
    assert updated_session["answered_count"] == 1
    assert updated_session["known_inputs"]["city"] == "Lucknow"
    print("  [PASS] POST /api/workflows/answer-question recorded answer 'Lucknow'.")

    # 3. POST /api/workflows/chat-help
    res3 = client.post("/api/workflows/chat-help", json={
        "query": "how do I get the telegram bot token?",
        "current_question": session.get("current_question")
    })
    assert res3.status_code == 200, res3.text
    reply = res3.json()
    assert "@BotFather" in reply["reply"]
    print("  [PASS] POST /api/workflows/chat-help returned accurate setup guide.\n")


if __name__ == "__main__":
    print("==================================================")
    print("STAGE 1: CONVERSATIONAL WORKFLOW BUILDER TEST")
    print("==================================================\n")
    test_time_and_schedule_parsing()
    test_requirement_extraction_with_missing_inputs()
    test_deduplication_of_known_inputs()
    test_important_emails_to_telegram_task()
    test_step_by_step_question_flow()
    test_chat_help_guidance()
    test_fastapi_endpoints()
    print("==================================================")
    print("ALL STAGE 1 CONVERSATIONAL BUILDER TESTS PASSED! [SUCCESS]")
    print("==================================================")
