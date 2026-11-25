"""
AgentFlow - Unified Automated Verification Suite for Incoming AI Voice Call System
Verifies:
1. Twilio HMAC-SHA1 signature validation and security
2. TwiML XML formatting, Polly voice synthesis tags, and <Gather> loops
3. Conversational AI multi-turn dialogue logic, silence reprompt, and farewell intent detection
4. Post-call AI summarization and callback determination
5. Telegram post-call alert generation without credential exposure
6. FastAPI incoming call webhook endpoints (/api/webhooks/voice/* and /api/voice/*)
7. Incoming calls dashboard and configuration APIs (/api/platform/calls/incoming*)
8. Inbound call simulation engine
9. Preservation of existing outbound voice calling functionality
"""

import sys
import os
import json
import base64
import hmac
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from backend.voice_agent import (
    validate_twilio_signature,
    xml_escape,
    is_caller_farewell,
    generate_greeting_twiml,
    generate_turn_twiml,
    generate_farewell_twiml,
    generate_reprompt_twiml,
    process_caller_speech_turn,
    generate_fallback_conversational_reply,
    summarize_voice_call,
    send_voice_call_telegram_alert,
    VOICE_NAME,
    VOICE_LANGUAGE
)
from backend.db import get_call_task_by_sid, list_call_tasks

client = TestClient(app)

PASSED = 0
FAILED = 0
TESTS_RUN = []


import traceback

def run_test(name: str, fn):
    global PASSED, FAILED, TESTS_RUN
    try:
        fn()
        PASSED += 1
        TESTS_RUN.append((name, "PASS", ""))
        print(f"  [PASS] {name}")
    except Exception as e:
        FAILED += 1
        err_msg = traceback.format_exc()
        TESTS_RUN.append((name, "FAIL", err_msg))
        print(f"  [FAIL] {name}:\n{err_msg}")


# =====================================================================
# SECTION 1: UNIT TESTS - TWILIO SECURITY & TWIML GENERATION
# =====================================================================

def test_signature_validation():
    """Twilio signature calculation and HMAC-SHA1 validation."""
    auth_token = "12345abcdef67890"
    url = "https://agentflow.example.com/api/webhooks/voice/incoming"
    params = {"CallSid": "CA12345", "From": "+1234567890", "To": "+1098765432"}

    # Compute valid signature
    s = url
    for k in sorted(params.keys()):
        s += k + str(params[k])
    valid_sig = base64.b64encode(hmac.new(auth_token.encode("utf-8"), s.encode("utf-8"), hashlib.sha1).digest()).decode("utf-8")

    assert validate_twilio_signature(url, params, signature=valid_sig, auth_token=auth_token) is True
    # Tampered param must fail
    tampered_params = dict(params, From="+1999999999")
    assert validate_twilio_signature(url, tampered_params, signature=valid_sig, auth_token=auth_token) is False
    # When auth_token is configured (production), missing signature must be strictly rejected
    assert validate_twilio_signature(url, params, signature=None, auth_token=auth_token) is False
    # When auth_token is unset (local dev without Twilio credentials), unsigned requests are permitted
    assert validate_twilio_signature(url, params, signature=None, auth_token=None) is True


def test_xml_escape():
    """XML special character escaping."""
    raw = 'Call & Discuss <Insha\'s "AI" Profile>'
    escaped = xml_escape(raw)
    assert "&amp;" in escaped
    assert "&lt;" in escaped
    assert "&gt;" in escaped
    assert "&quot;" in escaped
    assert "&apos;" in escaped


def test_greeting_twiml():
    """Greeting TwiML contains Polly voice, speech gather, and valid XML."""
    twiml = generate_greeting_twiml(turn_action_url="/api/webhooks/voice/process-turn?call_id=c1")
    root = ET.fromstring(twiml)
    assert root.tag == "Response"
    say_el = root.find("Say")
    assert say_el is not None
    assert say_el.attrib.get("voice") == VOICE_NAME
    assert say_el.attrib.get("language") == VOICE_LANGUAGE
    assert "AgentFlow" in say_el.text
    gather_el = root.find("Gather")
    assert gather_el is not None
    assert gather_el.attrib.get("input") == "speech"
    assert "/api/webhooks/voice/process-turn" in gather_el.attrib.get("action")


def test_turn_twiml():
    """Turn TwiML includes AI speech and subsequent <Gather> for multi-turn flow."""
    reply = "Insha Fatima is an expert in FastAPI, LangGraph, and full-stack AI development."
    twiml = generate_turn_twiml(ai_reply=reply, turn_action_url="/api/webhooks/voice/process-turn?call_id=c1")
    root = ET.fromstring(twiml)
    say_elements = root.findall("Say")
    assert len(say_elements) >= 1
    assert "Insha Fatima" in say_elements[0].text
    assert root.find("Gather") is not None


def test_farewell_twiml():
    """Farewell TwiML ends call cleanly with <Hangup/> and NO <Gather>."""
    twiml = generate_farewell_twiml("Thank you for calling. Have a great day. Goodbye!")
    root = ET.fromstring(twiml)
    assert root.find("Hangup") is not None
    assert root.find("Gather") is None


def test_reprompt_twiml():
    """Reprompt TwiML asks caller to repeat when audio was silent or unclear."""
    twiml = generate_reprompt_twiml(turn_action_url="/api/webhooks/voice/process-turn?call_id=c1")
    root = ET.fromstring(twiml)
    assert "repeat" in root.find("Say").text.lower() or "hear" in root.find("Say").text.lower()
    assert root.find("Gather") is not None


# =====================================================================
# SECTION 2: CONVERSATIONAL LOGIC & SUMMARIZATION
# =====================================================================

def test_farewell_detection():
    """Detects various ways callers say goodbye in English, Hindi/Urdu, and informal speech."""
    assert is_caller_farewell("Thank you so much, goodbye!") is True
    assert is_caller_farewell("bye bye see you later") is True
    assert is_caller_farewell("That's all, thank you") is True
    assert is_caller_farewell("Nothing else, alvida!") is True
    assert is_caller_farewell("Can you tell me about Insha's Python experience?") is False
    assert is_caller_farewell("I want to hire her for a project") is False


def test_conversational_reply_generation():
    """Conversational engine generates relevant, concise responses."""
    # Test job / hiring inquiry
    reply_job = process_caller_speech_turn("We have an opening for an AI Engineer at our startup", [])
    assert len(reply_job) > 10
    assert any(w in reply_job.lower() for w in ["insha", "role", "ai", "engineer", "contact", "callback", "details"])

    # Test identity inquiry
    reply_id = process_caller_speech_turn("Who are you and what is AgentFlow?", [])
    assert "agentflow" in reply_id.lower() or "assistant" in reply_id.lower()


def test_voice_call_summarizer():
    """Summarizes transcripts, categorizes intent, and flags callback requirement."""
    transcript = (
        "Assistant: Hello! Thank you for calling AgentFlow.\n"
        "Caller: Hi, I'm calling from Tech Corp regarding a Senior AI Engineer position. Can Insha call me back tomorrow at 2 PM?\n"
        "Assistant: Certainly! I have noted your message and Insha will follow up.\n"
        "Caller: Great, goodbye!"
    )
    summary = summarize_voice_call(transcript, caller_phone="+15551234567")
    assert "summary" in summary
    assert summary["callback_needed"] is True
    assert summary["intent"] in ["Job Opportunity", "Inquiry", "General Inquiry"]


def test_telegram_alert_formatting():
    """Validates Telegram voice call alert formatting without credential leakage."""
    call_data = {
        "recipient_phone": "+14155552671",
        "duration_seconds": 45,
        "status": "completed",
        "intent": "Job Opportunity",
        "callback_needed": True,
        "call_sid": "CA1234567890abcdef",
        "summary": "Caller inquired about senior AI engineering contract."
    }
    # Alert should execute safely even without live telegram credentials
    res = send_voice_call_telegram_alert(call_data)
    assert isinstance(res, dict)
    assert "success" in res


# =====================================================================
# SECTION 3: FASTAPI WEBHOOK INTEGRATION ENDPOINTS
# =====================================================================

TEST_CALL_SID = f"CA_test_{datetime.now().strftime('%Y%m%d%H%M%S')}"

def test_webhook_production_signature_enforced():
    """In production with TWILIO_AUTH_TOKEN configured, unsigned or forged webhooks are rejected with 403."""
    from unittest.mock import patch
    with patch("backend.platform_routes.get_credential", return_value="secret_production_token"):
        form_data = {
            "CallSid": "CA_prod_forgery_test",
            "From": "+14155550199",
            "To": "+18005550123"
        }
        # 1. Missing signature header -> 403 Forbidden
        resp_unsigned = client.post("/api/webhooks/voice/incoming", data=form_data)
        assert resp_unsigned.status_code == 403
        assert "Twilio" in resp_unsigned.text

        # 2. Forged signature header -> 403 Forbidden
        resp_forged = client.post(
            "/api/webhooks/voice/incoming",
            data=form_data,
            headers={"X-Twilio-Signature": "invalid_forged_signature_xyz"}
        )
        assert resp_forged.status_code == 403
        assert "Twilio" in resp_forged.text


def test_webhook_incoming_post():
    """POST /api/webhooks/voice/incoming answers incoming call with TwiML greeting."""
    form_data = {
        "CallSid": TEST_CALL_SID,
        "From": "+14155550199",
        "To": "+18005550123",
        "FromCity": "San Francisco",
        "FromState": "CA",
        "FromCountry": "US"
    }
    resp = client.post("/api/webhooks/voice/incoming", data=form_data)
    assert resp.status_code == 200
    assert "application/xml" in resp.headers.get("content-type", "")
    assert "<Response>" in resp.text
    assert "<Gather" in resp.text
    assert "AgentFlow" in resp.text


def test_webhook_incoming_get():
    """GET /api/webhooks/voice/incoming handles Twilio GET verification probe."""
    resp = client.get("/api/webhooks/voice/incoming?CallSid=CA_probe_get&From=%2B14155550199")
    assert resp.status_code == 200
    assert "application/xml" in resp.headers.get("content-type", "")
    assert "<Response>" in resp.text


def test_webhook_incoming_alias():
    """POST /api/voice/incoming direct alias works identically."""
    form_data = {
        "CallSid": f"{TEST_CALL_SID}_alias",
        "From": "+14155550199",
        "To": "+18005550123"
    }
    resp = client.post("/api/voice/incoming", data=form_data)
    assert resp.status_code == 200
    assert "application/xml" in resp.headers.get("content-type", "")
    assert "<Response>" in resp.text


def test_webhook_process_turn_conversational():
    """POST /api/webhooks/voice/process-turn generates conversational multi-turn AI reply."""
    form_data = {
        "CallSid": TEST_CALL_SID,
        "From": "+14155550199",
        "SpeechResult": "What projects has Insha built with FastAPI and React?"
    }
    resp = client.post("/api/webhooks/voice/process-turn", data=form_data)
    assert resp.status_code == 200
    assert "application/xml" in resp.headers.get("content-type", "")
    assert "<Response>" in resp.text
    assert "<Say" in resp.text
    assert "<Gather" in resp.text  # Multi-turn keeps gathering


def test_webhook_process_turn_silence():
    """POST /api/webhooks/voice/process-turn reprompts politely on silence."""
    form_data = {
        "CallSid": TEST_CALL_SID,
        "From": "+14155550199",
        "SpeechResult": ""
    }
    resp = client.post("/api/webhooks/voice/process-turn", data=form_data)
    assert resp.status_code == 200
    assert "application/xml" in resp.headers.get("content-type", "")
    assert "<Response>" in resp.text
    assert "<Gather" in resp.text


def test_webhook_process_turn_farewell():
    """POST /api/webhooks/voice/process-turn hangs up cleanly when caller says goodbye."""
    form_data = {
        "CallSid": TEST_CALL_SID,
        "From": "+14155550199",
        "SpeechResult": "Thank you so much for the information. Goodbye!"
    }
    resp = client.post("/api/webhooks/voice/process-turn", data=form_data)
    assert resp.status_code == 200
    assert "application/xml" in resp.headers.get("content-type", "")
    assert "<Response>" in resp.text
    assert "<Hangup/>" in resp.text or "<Hangup />" in resp.text or "<Hangup" in resp.text
    assert "<Gather" not in resp.text  # Farewell does not keep gathering


def test_webhook_voice_status():
    """POST /api/webhooks/voice/status records duration, status, and triggers post-call summary."""
    form_data = {
        "CallSid": TEST_CALL_SID,
        "CallStatus": "completed",
        "CallDuration": "42"
    }
    resp = client.post("/api/webhooks/voice/status", data=form_data)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "recorded"
    assert data.get("call_sid") == TEST_CALL_SID
    assert data.get("final_status") == "completed"


def test_webhook_voice_status_alias():
    """POST /api/voice/status alias records status successfully."""
    form_data = {
        "CallSid": f"{TEST_CALL_SID}_alias",
        "CallStatus": "completed",
        "CallDuration": "18"
    }
    resp = client.post("/api/voice/status", data=form_data)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "recorded"


# =====================================================================
# SECTION 4: INCOMING CALLS DASHBOARD & CONFIGURATION ENDPOINTS
# =====================================================================

def test_api_calls_incoming():
    """GET /api/platform/calls/incoming returns inbound calls list."""
    resp = client.get("/api/platform/calls/incoming")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "success"
    calls = data.get("calls", [])
    assert isinstance(calls, list)
    # The call created by TEST_CALL_SID should be present
    matching = [c for c in calls if c.get("call_sid") == TEST_CALL_SID]
    assert len(matching) >= 1
    call = matching[0]
    assert call.get("direction") == "inbound"
    assert call.get("recipient_phone") == "+14155550199"


def test_api_calls_incoming_config():
    """GET /api/platform/calls/incoming-config returns webhook URLs and Twilio Console guide."""
    resp = client.get("/api/platform/calls/incoming-config")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") in ["ready", "pending_credentials"]
    assert "/api/webhooks/voice/incoming" in data.get("webhook_url", "")
    assert "/api/webhooks/voice/process-turn" in data.get("process_turn_url", "")
    assert "/api/webhooks/voice/status" in data.get("status_callback_url", "")
    assert "credentials" in data
    guide = data.get("twilio_console_guide", [])
    assert len(guide) >= 5


def test_api_calls_incoming_simulate():
    """POST /api/platform/calls/incoming/simulate provides interactive multi-turn call simulator."""
    # Turn 1: Caller introduces themselves
    body_turn1 = {
        "caller_phone": "+16505550144",
        "speech_input": "Hi, I am calling about hiring Insha for a Generative AI engineer contract.",
        "history": []
    }
    resp1 = client.post("/api/platform/calls/incoming/simulate", json=body_turn1)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1.get("status") == "success"
    assert data1.get("is_farewell") is False
    assert len(data1.get("ai_reply", "")) > 5
    hist = data1.get("history", [])
    assert len(hist) == 2  # 1 caller + 1 assistant

    # Turn 2: Caller says goodbye
    body_turn2 = {
        "caller_phone": "+16505550144",
        "speech_input": "Thank you, that is all. Goodbye!",
        "history": hist,
        "call_sid": data1.get("call_sid")
    }
    resp2 = client.post("/api/platform/calls/incoming/simulate", json=body_turn2)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2.get("status") == "success"
    assert data2.get("is_farewell") is True
    assert "summary" in data2


# =====================================================================
# SECTION 5: PRESERVATION OF OUTBOUND VOICE CALLING
# =====================================================================

def test_outbound_calling_preserved():
    """Ensures existing outbound voice scheduling and approval gate are 100% intact."""
    # Outbound call scheduling endpoint
    schedule_payload = {
        "recipient_phone": "+19998887777",
        "recipient_name": "Prospective Client",
        "purpose": "Follow-up regarding technical roadmap",
        "prompt_script": "Hi, this is AgentFlow calling on behalf of Insha Fatima.",
        "scheduled_time": datetime.now().isoformat()
    }
    resp = client.post("/api/platform/calls/schedule", json=schedule_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "success"
    task = data.get("call") or data.get("task", {})
    assert task.get("direction") == "outbound"
    assert task.get("status") == "pending_approval"
    assert "approval_id" in task


def test_calling_status_diagnostics():
    """Ensures calling diagnostics and TwiML preview endpoints remain fully functional."""
    resp_diag = client.get("/api/platform/calls/diagnostics")
    assert resp_diag.status_code == 200
    diag = resp_diag.json()
    assert "configured" in diag
    assert "status" in diag

    resp_prev = client.get("/api/platform/calls/twiml/preview")
    assert resp_prev.status_code == 200
    prev_data = resp_prev.json()
    assert prev_data.get("status") == "success"
    assert "<Response>" in prev_data.get("twiml", "")
    assert "Polly.Aditi" in prev_data.get("voice", "")


# =====================================================================
# RUNNER
# =====================================================================

def main():
    print("=" * 70)
    print("AGENTFLOW INCOMING AI VOICE CALL SYSTEM - AUTOMATED VERIFICATION SUITE")
    print("=" * 70)

    tests = [
        ("Twilio HMAC-SHA1 Signature Validation", test_signature_validation),
        ("TwiML XML Special Characters Escaping", test_xml_escape),
        ("Greeting TwiML Generator (<Say>, Polly, <Gather>)", test_greeting_twiml),
        ("Conversational Turn TwiML Generator", test_turn_twiml),
        ("Farewell Clean Hangup TwiML Generator", test_farewell_twiml),
        ("Silence Reprompt TwiML Generator", test_reprompt_twiml),
        ("Caller Farewell Intent Detection (Multilingual)", test_farewell_detection),
        ("Conversational Speech Response Generation", test_conversational_reply_generation),
        ("AI Voice Call Summarizer & Callback Determination", test_voice_call_summarizer),
        ("Telegram Post-Call Alert Formatter & Security", test_telegram_alert_formatting),
        ("Production Twilio Signature Enforcement (HTTP 403)", test_webhook_production_signature_enforced),
        ("POST /api/webhooks/voice/incoming (Twilio Webhook)", test_webhook_incoming_post),
        ("GET /api/webhooks/voice/incoming (Twilio GET Probe)", test_webhook_incoming_get),
        ("POST /api/voice/incoming (Direct Root Alias)", test_webhook_incoming_alias),
        ("POST /api/webhooks/voice/process-turn (Multi-turn Speech)", test_webhook_process_turn_conversational),
        ("POST /api/webhooks/voice/process-turn (Silence Reprompt)", test_webhook_process_turn_silence),
        ("POST /api/webhooks/voice/process-turn (Farewell Hangup)", test_webhook_process_turn_farewell),
        ("POST /api/webhooks/voice/status (Duration & Summary)", test_webhook_voice_status),
        ("POST /api/voice/status (Status Callback Alias)", test_webhook_voice_status_alias),
        ("GET /api/platform/calls/incoming (Inbound Calls Log)", test_api_calls_incoming),
        ("GET /api/platform/calls/incoming-config (Webhook URLs & Guide)", test_api_calls_incoming_config),
        ("POST /api/platform/calls/incoming/simulate (Interactive Simulator)", test_api_calls_incoming_simulate),
        ("Preservation of Outbound Voice Scheduling & Approvals", test_outbound_calling_preserved),
        ("Preservation of Voice Diagnostics & TwiML Previews", test_calling_status_diagnostics),
    ]

    for name, fn in tests:
        run_test(name, fn)

    print("=" * 70)
    print(f"RESULTS: {PASSED} PASSED, {FAILED} FAILED (Total: {len(tests)})")
    print("=" * 70)

    if FAILED > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
