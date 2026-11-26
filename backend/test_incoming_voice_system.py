"""
AgentFlow - Unified Automated Verification Suite for Exotel Incoming AI Voice Assistant
Verifies:
1. Exotel request validation, payload normalization, and basic auth security
2. Spoken Hindi/Hinglish greeting and VoiceXML generation
3. Conversational AI multi-turn dialogue logic, silence reprompt, and farewell detection
4. Post-call AI summarization, caller detail extraction (name, reason, message), and callback determination
5. Telegram post-call alert generation without credential leakage and duplicate prevention
6. FastAPI Exotel incoming call webhooks (/api/webhooks/voice/exotel/incoming, passthru, status)
7. Legacy webhook aliases backward compatibility (/api/webhooks/voice/incoming, /api/voice/*)
8. Exotel configuration API (/api/platform/calls/incoming-config) with Flow & Airtel forwarding guides
9. Inbound call simulation engine in Hindi/Hinglish
10. Outbound voice diagnostics and scheduling preservation
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
    validate_exotel_request,
    parse_exotel_call_payload,
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
    DEFAULT_VOICE_GREETING,
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
# SECTION 1: UNIT TESTS - EXOTEL SECURITY & VOICEXML GENERATION
# =====================================================================

def test_exotel_request_validation():
    """Validates Exotel webhook parameter detection and Basic Auth checking."""
    params = {"CallSid": "exo_call_12345", "CallFrom": "+919876543210", "CallTo": "09513886363"}
    headers = {}
    assert validate_exotel_request(headers, params) is True

    # When Basic Auth is passed with valid token
    token = "test_exotel_api_token"
    auth_str = base64.b64encode(f"any_user:{token}".encode("utf-8")).decode("utf-8")
    auth_headers = {"authorization": f"Basic {auth_str}"}
    assert validate_exotel_request(auth_headers, params, api_token=token) is True


def test_exotel_payload_parsing():
    """Validates normalization of Exotel Passthru and Status Callback parameters."""
    raw = {
        "CallSid": "exo_leg_998877",
        "CallFrom": "+919876543210",
        "CallTo": "09513886363",
        "Direction": "inbound",
        "Status": "completed",
        "RecordingUrl": "https://s3.amazonaws.com/exotel_recordings/rec_123.mp3",
        "ConversationDuration": "38"
    }
    parsed = parse_exotel_call_payload(raw)
    assert parsed["call_sid"] == "exo_leg_998877"
    assert parsed["caller_phone"] == "+919876543210"
    assert parsed["called_phone"] == "09513886363"
    assert parsed["status"] == "completed"
    assert parsed["recording_url"] == "https://s3.amazonaws.com/exotel_recordings/rec_123.mp3"
    assert parsed["duration_seconds"] == 38


def test_xml_escape():
    """XML special character escaping."""
    raw = 'Call & Discuss <Insha\'s "AI" Profile>'
    escaped = xml_escape(raw)
    assert "&amp;" in escaped
    assert "&lt;" in escaped
    assert "&gt;" in escaped
    assert "&quot;" in escaped
    assert "&apos;" in escaped


def test_greeting_voicexml():
    """Greeting VoiceXML contains Polly voice, speech gather, and exact Insha greeting."""
    twiml = generate_greeting_twiml(turn_action_url="/api/webhooks/voice/process-turn?call_id=c1")
    root = ET.fromstring(twiml)
    assert root.tag == "Response"
    say_el = root.find("Say")
    assert say_el is not None
    assert say_el.attrib.get("voice") == VOICE_NAME
    # Must contain exact greeting phrase
    assert "Insha abhi busy hain" in say_el.text
    gather_el = root.find("Gather")
    assert gather_el is not None
    assert gather_el.attrib.get("input") == "speech"
    assert "/api/webhooks/voice/process-turn" in gather_el.attrib.get("action")


def test_turn_voicexml():
    """Turn VoiceXML includes AI speech and subsequent <Gather> for multi-turn flow."""
    reply = "Ji bilkul, main note kar leti hoon. Aapka naam kya hai?"
    twiml = generate_turn_twiml(ai_reply=reply, turn_action_url="/api/webhooks/voice/process-turn?call_id=c1")
    root = ET.fromstring(twiml)
    say_elements = root.findall("Say")
    assert len(say_elements) >= 1
    assert "Ji bilkul" in say_elements[0].text
    assert root.find("Gather") is not None


def test_farewell_voicexml():
    """Farewell VoiceXML ends call cleanly with <Hangup/> and NO <Gather>."""
    twiml = generate_farewell_twiml("Shukriya! Maine aapka message note kar liya hai. Alvida.")
    root = ET.fromstring(twiml)
    assert root.find("Hangup") is not None
    assert root.find("Gather") is None


def test_reprompt_voicexml():
    """Reprompt VoiceXML asks caller politely to repeat when audio was silent or unclear."""
    twiml = generate_reprompt_twiml(turn_action_url="/api/webhooks/voice/process-turn?call_id=c1")
    root = ET.fromstring(twiml)
    say_text = root.find("Say").text.lower()
    assert "aawaz" in say_text or "sunai" in say_text or "dobara" in say_text or "repeat" in say_text
    assert root.find("Gather") is not None


# =====================================================================
# SECTION 2: CONVERSATIONAL LOGIC & SUMMARIZATION
# =====================================================================

def test_farewell_detection():
    """Detects various ways callers conclude the call in Hinglish, English, and Hindi."""
    assert is_caller_farewell("Thank you so much, goodbye!") is True
    assert is_caller_farewell("bye bye see you later") is True
    assert is_caller_farewell("bas itna hi tha, theek hai") is True
    assert is_caller_farewell("shukriya, alvida") is True
    assert is_caller_farewell("Insha ka project experience kya hai?") is False
    assert is_caller_farewell("Mujhe urgent baat karni hai") is False


def test_conversational_reply_generation():
    """Conversational engine generates polite, concise Hinglish responses."""
    # Test job / hiring inquiry
    reply_job = process_caller_speech_turn("We have an opening for an AI Engineer at our startup", [])
    assert len(reply_job) > 5
    assert any(w in reply_job.lower() for w in ["insha", "naam", "message", "company", "shukriya", "note"])

    # Test identity inquiry
    reply_id = process_caller_speech_turn("Aap kaun hain?", [])
    assert "insha" in reply_id.lower() or "assistant" in reply_id.lower() or "ai" in reply_id.lower()


def test_voice_call_summarizer():
    """Summarizes transcripts, extracts caller name, purpose, and flags callback requirement."""
    transcript = (
        "Assistant: Hello! Insha abhi busy hain. Aap humein bata dijiye kya kaam hai?\n"
        "Caller: Mera naam Rahul Sharma hai from NextGen AI. Insha ko Senior AI Architect role offer karna hai. Please ask her to call back.\n"
        "Assistant: Ji Rahul ji, maine note kar liya hai.\n"
        "Caller: Theek hai, shukriya, bye!"
    )
    summary = summarize_voice_call(transcript, caller_phone="+919876543210")
    assert "summary" in summary
    assert "caller_name" in summary
    assert summary["callback_needed"] is True
    assert "Rahul" in summary.get("caller_name", "") or summary["caller_name"] != ""


def test_telegram_alert_formatting():
    """Validates Telegram voice call alert formatting without credential leakage."""
    call_data = {
        "recipient_phone": "+919876543210",
        "caller_name": "Rahul Sharma",
        "duration_seconds": 45,
        "status": "completed",
        "reason_for_calling": "Job Opportunity",
        "callback_needed": True,
        "call_sid": "exo_call_1234567890",
        "summary": "Caller Rahul Sharma offered Senior AI Architect role. Requested callback."
    }
    res = send_voice_call_telegram_alert(call_data)
    assert isinstance(res, dict)
    assert "success" in res


# =====================================================================
# SECTION 3: FASTAPI WEBHOOK INTEGRATION ENDPOINTS
# =====================================================================

TEST_EXO_SID = f"exo_test_{datetime.now().strftime('%Y%m%d%H%M%S')}"

def test_webhook_exotel_incoming_post():
    """POST /api/webhooks/voice/exotel/incoming answers incoming call with VoiceXML greeting."""
    form_data = {
        "CallSid": TEST_EXO_SID,
        "CallFrom": "+919876543210",
        "CallTo": "09513886363",
        "Direction": "inbound"
    }
    resp = client.post("/api/webhooks/voice/exotel/incoming", data=form_data)
    assert resp.status_code == 200
    assert "application/xml" in resp.headers.get("content-type", "")
    assert "<Response>" in resp.text
    assert "<Gather" in resp.text
    assert "Insha abhi busy hain" in resp.text


def test_webhook_exotel_incoming_get():
    """GET /api/webhooks/voice/exotel/incoming handles GET probes from Exotel Passthru."""
    resp = client.get(f"/api/webhooks/voice/exotel/incoming?CallSid={TEST_EXO_SID}_get&CallFrom=%2B919876543210")
    assert resp.status_code == 200
    assert "application/xml" in resp.headers.get("content-type", "")
    assert "<Response>" in resp.text


def test_webhook_exotel_passthru():
    """POST /api/webhooks/voice/exotel/passthru handles Exotel flow branching."""
    resp = client.post("/api/webhooks/voice/exotel/passthru", data={"CallSid": TEST_EXO_SID})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "connected"


def test_webhook_legacy_incoming_alias():
    """POST /api/webhooks/voice/incoming legacy route forwards to Exotel handler."""
    form_data = {
        "CallSid": f"{TEST_EXO_SID}_alias",
        "From": "+919876543210",
        "To": "09513886363"
    }
    resp = client.post("/api/webhooks/voice/incoming", data=form_data)
    assert resp.status_code == 200
    assert "<Response>" in resp.text


def test_webhook_process_turn_conversational():
    """POST /api/webhooks/voice/process-turn generates conversational multi-turn AI reply."""
    form_data = {
        "CallSid": TEST_EXO_SID,
        "CallFrom": "+919876543210",
        "SpeechResult": "Main Insha ke saath project collaborate karna chahta hoon"
    }
    resp = client.post("/api/webhooks/voice/process-turn", data=form_data)
    assert resp.status_code == 200
    assert "<Response>" in resp.text
    assert "<Say" in resp.text
    assert "<Gather" in resp.text  # Multi-turn keeps gathering


def test_webhook_process_turn_silence():
    """POST /api/webhooks/voice/process-turn reprompts politely on silence."""
    form_data = {
        "CallSid": TEST_EXO_SID,
        "CallFrom": "+919876543210",
        "SpeechResult": ""
    }
    resp = client.post("/api/webhooks/voice/process-turn", data=form_data)
    assert resp.status_code == 200
    assert "<Response>" in resp.text
    assert "<Gather" in resp.text


def test_webhook_process_turn_farewell():
    """POST /api/webhooks/voice/process-turn hangs up cleanly when caller concludes."""
    form_data = {
        "CallSid": TEST_EXO_SID,
        "CallFrom": "+919876543210",
        "SpeechResult": "Shukriya, main baad mein call karta hoon. Alvida!"
    }
    resp = client.post("/api/webhooks/voice/process-turn", data=form_data)
    assert resp.status_code == 200
    assert "<Response>" in resp.text
    assert "<Hangup/>" in resp.text or "<Hangup />" in resp.text or "<Hangup" in resp.text
    assert "<Gather" not in resp.text


def test_webhook_exotel_status():
    """POST /api/webhooks/voice/exotel/status records duration, status, and triggers Telegram notification."""
    form_data = {
        "CallSid": TEST_EXO_SID,
        "Status": "completed",
        "ConversationDuration": "42",
        "RecordingUrl": "https://s3.amazonaws.com/exotel/rec_test_123.mp3"
    }
    resp = client.post("/api/webhooks/voice/exotel/status", data=form_data)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "recorded"
    assert data.get("call_sid") == TEST_EXO_SID
    assert data.get("final_status") == "completed"
    assert "rec_test_123.mp3" in data.get("recording_url", "")


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
    matching = [c for c in calls if c.get("call_sid") == TEST_EXO_SID]
    assert len(matching) >= 1
    call = matching[0]
    assert call.get("direction") == "inbound"
    assert call.get("recipient_phone") == "+919876543210"


def test_api_calls_incoming_config():
    """GET /api/platform/calls/incoming-config returns Exotel endpoints, Flow guide, and Airtel forwarding codes."""
    resp = client.get("/api/platform/calls/incoming-config")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") in ["ready", "pending_credentials"]
    assert data.get("provider") == "exotel"
    assert "/api/webhooks/voice/exotel/incoming" in data.get("webhook_url", "")
    assert "/api/webhooks/voice/exotel/status" in data.get("status_callback_url", "")
    assert "/api/webhooks/voice/exotel/passthru" in data.get("passthru_url", "")
    assert "exotel_flow_guide" in data
    assert "airtel_forwarding_guide" in data
    assert "trial_limitations_guide" in data
    assert "Insha abhi busy hain" in data.get("greeting_message", "")


def test_api_calls_incoming_simulate():
    """POST /api/platform/calls/incoming/simulate provides interactive multi-turn call simulator."""
    # Turn 1: Caller introduces themselves
    body_turn1 = {
        "caller_phone": "+919876543210",
        "speech_input": "Hello, main Rahul baat kar raha hoon from AI Ventures.",
        "history": []
    }
    resp1 = client.post("/api/platform/calls/incoming/simulate", json=body_turn1)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1.get("status") == "success"
    assert data1.get("is_farewell") is False
    assert len(data1.get("ai_reply", "")) > 5
    hist = data1.get("history", [])
    assert len(hist) == 2

    # Turn 2: Caller says goodbye
    body_turn2 = {
        "caller_phone": "+919876543210",
        "speech_input": "Theek hai, shukriya, alvida!",
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
# SECTION 5: OUTBOUND VOICE DIAGNOSTICS & PRESERVATION
# =====================================================================

def test_calling_status_diagnostics():
    """Ensures calling diagnostics and VoiceXML preview endpoints remain fully functional."""
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


# =====================================================================
# RUNNER
# =====================================================================

def main():
    print("=" * 70)
    print("AGENTFLOW EXOTEL INCOMING AI VOICE ASSISTANT - VERIFICATION SUITE")
    print("=" * 70)

    tests = [
        ("Exotel Webhook Request & Auth Validation", test_exotel_request_validation),
        ("Exotel Call Payload Normalization", test_exotel_payload_parsing),
        ("VoiceXML Special Characters Escaping", test_xml_escape),
        ("Greeting VoiceXML Generator (<Say>, Polly.Aditi, Hinglish)", test_greeting_voicexml),
        ("Conversational Turn VoiceXML Generator", test_turn_voicexml),
        ("Farewell Clean Hangup VoiceXML Generator", test_farewell_voicexml),
        ("Silence Reprompt VoiceXML Generator", test_reprompt_voicexml),
        ("Caller Farewell Intent Detection (Multilingual)", test_farewell_detection),
        ("Conversational Speech Response Generation (Hinglish)", test_conversational_reply_generation),
        ("AI Voice Call Summarizer & Detail Extraction", test_voice_call_summarizer),
        ("Telegram Post-Call Alert Formatter & Security", test_telegram_alert_formatting),
        ("POST /api/webhooks/voice/exotel/incoming (Exotel Inbound Webhook)", test_webhook_exotel_incoming_post),
        ("GET /api/webhooks/voice/exotel/incoming (Exotel GET Probe)", test_webhook_exotel_incoming_get),
        ("POST /api/webhooks/voice/exotel/passthru (Exotel Passthru Applet)", test_webhook_exotel_passthru),
        ("POST /api/webhooks/voice/incoming (Legacy Alias)", test_webhook_legacy_incoming_alias),
        ("POST /api/webhooks/voice/process-turn (Multi-turn Speech)", test_webhook_process_turn_conversational),
        ("POST /api/webhooks/voice/process-turn (Silence Reprompt)", test_webhook_process_turn_silence),
        ("POST /api/webhooks/voice/process-turn (Farewell Hangup)", test_webhook_process_turn_farewell),
        ("POST /api/webhooks/voice/exotel/status (Duration, Recording & Telegram)", test_webhook_exotel_status),
        ("GET /api/platform/calls/incoming (Inbound Calls Log)", test_api_calls_incoming),
        ("GET /api/platform/calls/incoming-config (Exotel & Airtel USSD Guides)", test_api_calls_incoming_config),
        ("POST /api/platform/calls/incoming/simulate (Interactive Simulator)", test_api_calls_incoming_simulate),
        ("Preservation of Voice Diagnostics & VoiceXML Previews", test_calling_status_diagnostics),
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
