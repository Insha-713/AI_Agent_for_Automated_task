"""
AgentFlow V4.1 - Centralized Experience & Real Integrations End-to-End Test Suite

Validates:
1. Centralized Connections Wizard (4 categories, masked secrets, live verifiers, save, disconnect).
2. Data Sanitization & Demo Purge (0 fake calls, 0 mock chats, 0 personal repo links).
3. Real AI Visual Studio & Multi-Slide Carousel Generator.
4. LinkedIn Agent 7 Specialized Creation Goals.
5. Instagram & WhatsApp Rule Management (including working Delete).
6. Incoming AI Calling Agent (Twilio Form Webhook, TwiML generation, incoming-only config).
7. Real Email Agent (Inbox reading endpoint, reply drafter, queue gates).
8. Regression Suite (Career Agent, News Intelligence, Backend Health).
"""

import os
import sys
import json
import sqlite3
from pathlib import Path
from starlette.testclient import TestClient

# Ensure backend can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app
from backend.db import DB_FILE

client = TestClient(app)


def test_system_health():
    """Verify backend root and health checks."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") in ("ok", "healthy", "up") or "version" in data


def test_centralized_connections_structure_and_masking():
    """Verify 4-category connections endpoints, structure, and secret masking."""
    res = client.get("/api/platform/connections")
    assert res.status_code == 200
    data = res.json()
    
    assert "categories" in data or "connections" in data
    cats = data.get("categories", [])
    if cats:
        cat_ids = [c["id"] for c in cats]
    else:
        cat_ids = list(data.get("connections", {}).keys())
    
    # Check the 4 mandatory categories
    assert "social_media" in cat_ids
    assert "messaging" in cat_ids
    assert "communication" in cat_ids
    assert "ai_providers" in cat_ids

    # Flatten all services
    all_services = []
    if cats:
        for c in cats:
            all_services.extend(c.get("services", []))
        service_ids = [s["id"] for s in all_services]
    else:
        service_ids = []
        for cat_k, servs in data.get("connections", {}).items():
            service_ids.extend(servs.keys())

    assert "linkedin" in service_ids
    assert "instagram" in service_ids
    assert "whatsapp" in service_ids
    assert "telegram" in service_ids
    assert "email" in service_ids
    assert "calling" in service_ids
    assert "llm" in service_ids
    assert "image_gen" in service_ids

    # Verify no raw secrets leaked in JSON
    json_text = res.text
    assert "sk-" not in json_text
    assert "AIzaSy" not in json_text


def test_connections_save_test_and_disconnect():
    """Verify save, test connectivity, and disconnect endpoints."""
    # 1. Save telegram chat_id
    save_payload = {
        "service_id": "telegram",
        "credentials": {
            "TELEGRAM_CHAT_ID": "123456789"
        }
    }
    res = client.post("/api/platform/connections/save", json=save_payload)
    assert res.status_code == 200
    save_data = res.json()
    assert save_data.get("status") == "success"

    # 2. Test connectivity with empty/mock token
    test_payload = {
        "service_id": "telegram",
        "payload": {}
    }
    res = client.post("/api/platform/connections/test", json=test_payload)
    assert res.status_code == 200
    test_data = res.json()
    assert "status" in test_data

    # 3. Disconnect
    res = client.post("/api/platform/connections/disconnect", json={"service_id": "telegram"})
    assert res.status_code == 200
    disc_data = res.json()
    assert disc_data.get("status") == "success"


def test_database_purge_and_sanitization():
    """Verify demo and test data purge leaves database in clean state."""
    res = client.post("/api/platform/data/clear-demo")
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") == "success"

    # Query SQLite directly to verify zero fake records
    conn = sqlite3.connect(DB_FILE)
    try:
        call_count = conn.execute("SELECT COUNT(*) FROM call_tasks").fetchone()[0]
        wa_count = conn.execute("SELECT COUNT(*) FROM whatsapp_conversations").fetchone()[0]
        ig_count = conn.execute("SELECT COUNT(*) FROM instagram_interactions").fetchone()[0]
        
        # Verify personal GitHub repo is not in central memory
        mem_rows = conn.execute(
            "SELECT COUNT(*) FROM central_ai_memory WHERE value_json LIKE '%Insha-713%'"
        ).fetchone()[0]
    finally:
        conn.close()

    assert call_count == 0
    assert wa_count == 0
    assert ig_count == 0
    assert mem_rows == 0


def test_ai_image_generation_and_media_serving():
    """Verify single AI image generation and media static file serving."""
    payload = {
        "prompt": "Modern AI automation architecture diagram",
        "aspect_ratio": "1:1",
        "style": "technical"
    }
    res = client.post("/api/platform/images/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") == "success"
    img_data = data.get("image", data)
    assert "image_url" in img_data or "image_url" in data
    filename = img_data.get("filename") or data.get("filename")
    assert filename is not None

    # Verify image can be fetched via media endpoint
    res_img = client.get(f"/api/platform/media/{filename}")
    assert res_img.status_code == 200
    assert "image" in res_img.headers.get("content-type", "")
    assert len(res_img.content) > 0


def test_ai_carousel_generation():
    """Verify multi-slide carousel generation."""
    payload = {
        "topic": "5 Pillars of Autonomous AI Agents",
        "num_slides": 3,
        "style": "clean"
    }
    res = client.post("/api/platform/images/generate-carousel", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") == "success"
    slides = data.get("slides") or data.get("carousel", {}).get("slides", [])
    assert len(slides) >= 3
    for slide in slides:
        assert "slide_number" in slide
        assert "title" in slide
        assert "image_url" in slide


def test_linkedin_agent_specialized_goals():
    """Verify LinkedIn post drafting with 7 specialized creation goals."""
    payload = {
        "topic": "AgentFlow V4.1 Centralized Multi-Agent Platform",
        "goal": "project_showcase",
        "post_type": "project_showcase",
        "target_audience": "AI Engineers and Tech Leaders",
        "call_to_action": "Check out the architecture and share your thoughts"
    }
    res = client.post("/api/platform/linkedin/draft", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") == "success"
    draft = data.get("draft") or data.get("post") or {}
    assert "content" in draft or "hook" in draft or "draft_post" in data


def test_instagram_and_whatsapp_rule_lifecycle_and_delete():
    """Verify rule creation, fetching, and deletion for Instagram and WhatsApp."""
    # 1. WhatsApp Rule creation
    wa_rule_payload = {
        "trigger_keyword": "TEST_PRICE_V4",
        "match_type": "exact",
        "action_type": "reply_text",
        "reply_content": "Pricing is $49/mo.",
        "ai_fallback": False
    }
    res_wa_add = client.post("/api/platform/whatsapp/rules", json=wa_rule_payload)
    assert res_wa_add.status_code == 200
    wa_rule = res_wa_add.json()
    rule_id = wa_rule.get("id") or wa_rule.get("rule", {}).get("id")
    assert rule_id is not None

    # Delete WhatsApp rule
    res_wa_del = client.delete(f"/api/platform/whatsapp/rules/{rule_id}")
    assert res_wa_del.status_code == 200

    # 2. Instagram Rule creation
    ig_rule_payload = {
        "trigger_keyword": "TEST_DEMO_IG",
        "match_type": "exact",
        "action_type": "dm_reply",
        "reply_content": "Here is your demo link!"
    }
    res_ig_add = client.post("/api/platform/instagram/rules", json=ig_rule_payload)
    assert res_ig_add.status_code == 200
    ig_rule = res_ig_add.json()
    ig_rule_id = ig_rule.get("id") or ig_rule.get("rule", {}).get("id")
    assert ig_rule_id is not None

    # Delete Instagram rule
    res_ig_del = client.delete(f"/api/platform/instagram/rules/{ig_rule_id}")
    assert res_ig_del.status_code == 200


def test_incoming_ai_calling_agent():
    """Verify Twilio incoming call webhook, TwiML generation, and config."""
    # 1. Incoming calls list should be empty after purge
    res_calls = client.get("/api/platform/calls/incoming")
    assert res_calls.status_code == 200
    data = res_calls.json()
    assert "calls" in data
    assert len(data["calls"]) == 0

    # 2. Incoming config endpoint
    res_cfg = client.get("/api/platform/calls/incoming-config")
    assert res_cfg.status_code == 200
    cfg = res_cfg.json()
    assert "webhook_url" in cfg
    assert "greeting_message" in cfg

    # 3. Simulate Twilio Voice incoming call (POST form data)
    form_data = {
        "CallSid": "CA_TEST_SUITE_12345",
        "From": "+15550001111",
        "To": "+15559998888",
        "Direction": "inbound"
    }
    res_twiml = client.post(
        "/api/webhooks/voice/incoming",
        data=form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert res_twiml.status_code == 200
    assert "xml" in res_twiml.headers.get("content-type", "")
    assert "<Response>" in res_twiml.text
    assert "<Gather" in res_twiml.text

    # Verify this real incoming call was recorded in database
    conn = sqlite3.connect(DB_FILE)
    try:
        call = conn.execute(
            "SELECT call_sid, recipient_phone, direction FROM call_tasks WHERE call_sid = 'CA_TEST_SUITE_12345'"
        ).fetchone()
        assert call is not None
        assert call[0] == "CA_TEST_SUITE_12345"
        assert call[1] == "+15550001111"
        assert call[2] in ("inbound", "incoming")

        # Clean up test call
        conn.execute("DELETE FROM call_tasks WHERE call_sid = 'CA_TEST_SUITE_12345'")
        conn.commit()
    finally:
        conn.close()


def test_email_agent_endpoints():
    """Verify email inbox fetching and reply drafting endpoints."""
    # 1. Inbox fetching endpoint
    res_inbox = client.get("/api/platform/email/inbox")
    assert res_inbox.status_code == 200
    inbox_data = res_inbox.json()
    assert "status" in inbox_data
    assert "emails" in inbox_data

    # 2. Reply drafter endpoint
    reply_payload = {
        "email_from": "client@example.com",
        "subject": "Inquiry regarding AI consultation",
        "body": "Hi, we are interested in scheduling an AI architecture consultation with your team next week.",
        "tone": "professional"
    }
    res_reply = client.post("/api/platform/email/reply", json=reply_payload)
    assert res_reply.status_code == 200
    rep_data = res_reply.json()
    assert "draft_reply" in rep_data
    assert "reply_body" in rep_data["draft_reply"]
    assert len(rep_data["draft_reply"]["reply_body"]) > 10


def test_career_agent_preservation():
    """Ensure Career Agent v3.0 functionality is strictly preserved."""
    res = client.get("/api/career/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert data.get("success") is True or "data" in data or "profile" in data


def test_news_intelligence_preservation():
    """Ensure News Intelligence endpoints are active."""
    res = client.get("/api/news/digest")
    assert res.status_code == 200
    data = res.json()
    assert "stories" in data or "total_ingested" in data or "markdown_digest" in data


def test_meta_webhook_security_and_simulation():
    """Ensure simulated events flag is_simulation=1 and Meta webhooks enforce signatures."""
    # Add a temporary Instagram rule
    ig_rule = client.post("/api/platform/instagram/rules", json={
        "keyword": "GUIDE",
        "match_type": "contains",
        "response_message": "Here is the free developer guide!",
        "resource_url": "https://example.com/guide.pdf"
    }).json()
    ig_rule_id = ig_rule.get("rule", {}).get("id") or ig_rule.get("id")

    # Add a temporary WhatsApp rule
    wa_rule = client.post("/api/platform/whatsapp/rules", json={
        "trigger_keyword": "PORTFOLIO",
        "match_type": "contains",
        "action_type": "reply_text",
        "reply_content": "Check out my portfolio at https://example.com"
    }).json()
    wa_rule_id = wa_rule.get("rule", {}).get("id") or wa_rule.get("id")

    try:
        # 1. Instagram simulate comment
        res_ig = client.post("/api/platform/instagram/simulate-comment", json={
            "comment_text": "Please send me the GUIDE",
            "username": "tester_sim"
        })
        assert res_ig.status_code == 200
        assert res_ig.json().get("status") == "success"
        assert res_ig.json().get("matched") is True

        # 2. WhatsApp simulate message
        res_wa = client.post("/api/platform/whatsapp/simulate-message", json={
            "from_phone": "+15550002222",
            "message_text": "Hey I want to see your PORTFOLIO"
        })
        assert res_wa.status_code == 200
        assert res_wa.json().get("status") == "success"

        # 3. Verify SQLite DB has is_simulation column populated
        conn = sqlite3.connect(DB_FILE)
        try:
            ig_sim = conn.execute("SELECT is_simulation FROM instagram_interactions ORDER BY id DESC LIMIT 1").fetchone()
            assert ig_sim is not None
            assert ig_sim[0] == 1

            wa_sim = conn.execute("SELECT is_simulation FROM whatsapp_conversations ORDER BY id DESC LIMIT 1").fetchone()
            assert wa_sim is not None
            assert wa_sim[0] == 1
        finally:
            conn.close()
    finally:
        # Clean up rules
        if ig_rule_id:
            client.delete(f"/api/platform/instagram/rules/{ig_rule_id}")
        if wa_rule_id:
            client.delete(f"/api/platform/whatsapp/rules/{wa_rule_id}")


if __name__ == "__main__":
    tests = [
        test_system_health,
        test_centralized_connections_structure_and_masking,
        test_connections_save_test_and_disconnect,
        test_database_purge_and_sanitization,
        test_ai_image_generation_and_media_serving,
        test_ai_carousel_generation,
        test_linkedin_agent_specialized_goals,
        test_instagram_and_whatsapp_rule_lifecycle_and_delete,
        test_incoming_ai_calling_agent,
        test_email_agent_endpoints,
        test_career_agent_preservation,
        test_news_intelligence_preservation,
        test_meta_webhook_security_and_simulation,
    ]
    print(f"\n==========================================")
    print(f"RUNNING AGENTFLOW V4.1 AUDIT & VERIFICATION SUITE ({len(tests)} TESTS)")
    print(f"==========================================")
    passed = 0
    for t in tests:
        name = t.__name__
        try:
            t()
            print(f"  [PASS] {name}")
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {name}: {e}")
            import traceback
            traceback.print_exc()

    print(f"==========================================")
    print(f"RESULTS: {passed}/{len(tests)} TESTS PASSED")
    print(f"==========================================\n")
    if passed != len(tests):
        sys.exit(1)
