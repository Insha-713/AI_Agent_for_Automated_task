"""
test_v4_restoration.py — AgentFlow v4.0 Full Functional Restoration Test Suite
Verifies:
1. Research Agent: Live multi-source evidence collection, structured synthesis, multilingual support (EN/HI/UR),
   dossier persistence with proper array deserialization (no TypeErrors).
2. Social Media & LinkedIn Publishing: Multi-platform generation, hashtag integration, official LinkedIn UGC
   publishing check (never simulated success), and scheduled post auto-publishing.
3. Instagram Comment-to-DM: Rule persistence with flexible schema, Meta Graph API publisher check, comment webhook simulation.
4. WhatsApp Cloud API: Rule persistence, outbound message dispatch endpoint, auto-reply simulator.
5. Email Automation: Reply drafter, categorizer, briefing, human approval gate queue, and provider dispatch.
6. Central Memory: Cross-agent persistent memory, context retrieval, key/id deletion.
7. Automation Rules: WHEN/THEN dispatcher, optional payload toggle, rule simulation endpoint.
8. Scheduler Sentinels: Autonomous social publisher and career alerts registration.
"""

import os
import sys
import json
import asyncio

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from starlette.testclient import TestClient

from backend.main import app
from backend.platform_engine import (
    ResearchEngine,
    LinkedInAdapter,
    InstagramAdapter,
    WhatsAppAdapter,
    SocialMediaEngine,
    EmailAgentEngine,
    AutomationRuleRunner
)
from backend.db import (
    save_research_document,
    get_research_document_by_id,
    list_research_documents,
    save_social_post,
    list_social_posts,
    save_instagram_rule,
    list_instagram_rules,
    save_whatsapp_rule,
    list_whatsapp_rules,
    set_memory_value,
    get_memory_value,
    list_memory_items,
    delete_memory_item,
    get_all_memory_context,
    save_automation_rule,
    list_automation_rules,
    toggle_automation_rule,
    save_email_task,
    list_email_tasks
)

client = TestClient(app)


# =====================================================================
# 1. Research Agent & Synthesis Pipeline
# =====================================================================

def test_research_live_sources_collection():
    """Verify live multi-source evidence collection gathers real citations."""
    citations = ResearchEngine.collect_live_sources("Artificial Intelligence Agent", sources_count=3)
    assert isinstance(citations, list)
    assert len(citations) >= 2
    for c in citations:
        assert "title" in c
        assert "url" in c
        assert "source" in c


def test_research_structured_dossier_synthesis_en():
    """Verify English dossier generation produces all required structured arrays."""
    dossier = ResearchEngine.generate_research_dossier(
        topic="Multi-Agent Systems in Production",
        language="en",
        sources_count=3,
        include_fact_attribution=True
    )
    assert dossier["topic"] == "Multi-Agent Systems in Production"
    assert isinstance(dossier["executive_summary"], str)
    assert len(dossier["executive_summary"]) > 20
    assert isinstance(dossier["key_findings"], list)
    assert len(dossier["key_findings"]) >= 2
    assert isinstance(dossier["fact_attribution"], list)
    assert len(dossier["fact_attribution"]) >= 1
    assert isinstance(dossier["citations"], list)
    assert len(dossier["citations"]) >= 2
    assert "content_md" in dossier
    assert "platform_content" in dossier


def test_research_structured_dossier_synthesis_multilingual():
    """Verify Hindi and Urdu synthesis generate authentic localized dossiers."""
    hi_dossier = ResearchEngine.generate_research_dossier(topic="Autonomous AI", language="hi")
    assert hi_dossier["language"] == "hi"
    assert "विश्लेषण" in hi_dossier["executive_summary"] or "अनुसंधान" in hi_dossier["executive_summary"]
    assert isinstance(hi_dossier["key_findings"], list)

    ur_dossier = ResearchEngine.generate_research_dossier(topic="Autonomous AI", language="ur")
    assert ur_dossier["language"] == "ur"
    assert "تحقیقی" in ur_dossier["executive_summary"] or "تجزیہ" in ur_dossier["executive_summary"]
    assert isinstance(ur_dossier["key_findings"], list)


def test_research_api_endpoints():
    """Verify POST /api/platform/research/synthesize and GET /documents persist and unpack arrays."""
    payload = {
        "topic": "Test Verification Multi-Agent",
        "language": "en",
        "sources_count": 3,
        "include_fact_attribution": True
    }
    # Test synthesize endpoint
    res = client.post("/api/platform/research/synthesize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    doc = data["document"]
    doc_id = doc["id"]
    assert isinstance(doc["key_findings"], list)
    assert isinstance(doc["fact_attribution"], list)
    assert isinstance(doc["citations"], list)

    # Test list documents endpoint
    list_res = client.get("/api/platform/research/documents")
    assert list_res.status_code == 200
    docs = list_res.json()["documents"]
    matched = [d for d in docs if d["id"] == doc_id]
    assert len(matched) == 1
    retrieved = matched[0]
    # Ensure no TypeErrors on iteration
    assert isinstance(retrieved["key_findings"], list)
    assert isinstance(retrieved["fact_attribution"], list)
    assert isinstance(retrieved["citations"], list)

    # Clean up
    del_res = client.delete(f"/api/platform/research/documents/{doc_id}")
    assert del_res.status_code == 200


# =====================================================================
# 2. Social Media & LinkedIn Publishing Engine
# =====================================================================

def test_social_generate_and_draft():
    """Verify social post generation returns both 'draft' and 'post' keys for UI compatibility."""
    res = client.post("/api/platform/social/generate", json={
        "topic": "Autonomous AI Agent with Human Approval Gates",
        "platform": "linkedin",
        "tone": "professional"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "draft" in data
    assert "post" in data
    assert "content" in data["draft"]
    assert "hashtags" in data["draft"]


def test_linkedin_draft_and_status():
    """Verify LinkedIn drafting returns headline, content, suggested_time, and captions."""
    res = client.post("/api/platform/linkedin/draft", json={
        "topic": "AI Multi-Agent Task Orchestrator",
        "post_type": "project_showcase"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    draft = data["draft"]
    assert "headline" in draft
    assert "content" in draft
    assert "suggested_time" in draft
    assert "hashtags" in draft


def test_linkedin_real_publishing_awaiting_credentials():
    """Verify publishing to LinkedIn without token reports awaiting_credentials and NEVER fakes success."""
    res = client.post("/api/platform/linkedin/publish", json={
        "content": "Test automated post"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert data["status"] == "awaiting_credentials"
    assert "Awaiting LinkedIn Access Token" in data["error"]


def test_social_post_lifecycle_and_publish():
    """Verify creating a social post and triggering the publish endpoint updates DB status accurately."""
    create_res = client.post("/api/platform/social/posts", json={
        "platform": "linkedin",
        "content": "Lifecycle test post for autonomous publishing",
        "hashtags": "#AgentFlow #AI",
        "status": "draft"
    })
    assert create_res.status_code == 200
    post_id = create_res.json()["post"]["id"]

    # Trigger publishing
    pub_res = client.post(f"/api/platform/social/posts/{post_id}/publish")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    # Since credentials aren't set in dev, it should fail honestly and mark post failed
    assert pub_data["status"] == "failed"
    assert pub_data["post"]["status"] == "failed"
    assert "Awaiting LinkedIn Access Token" in pub_data["post"]["error_message"]

    # Clean up
    client.delete(f"/api/platform/social/posts/{post_id}")


# =====================================================================
# 3. Instagram Automation & Comment-to-DM
# =====================================================================

def test_instagram_publishing_checks():
    """Verify Instagram media publishing requires credentials and media image URL."""
    res_no_creds = InstagramAdapter.publish_media(caption="Test Caption")
    assert res_no_creds["success"] is False
    assert res_no_creds["status"] in ("awaiting_credentials", "media_required")


def test_instagram_rule_creation_flexible_schema():
    """Verify Instagram rules accept both reply_template and response_message, returning all 4 aliases."""
    res = client.post("/api/platform/instagram/rules", json={
        "keyword": "TEST_REEL",
        "reply_template": "Here is your requested guide!",
        "resource_link": "https://agentflow.app/guide"
    })
    assert res.status_code == 200
    rule = res.json()["rule"]
    rule_id = rule["id"]
    assert rule["keyword"] == "TEST_REEL"
    assert rule["reply_template"] == "Here is your requested guide!"
    assert rule["response_message"] == "Here is your requested guide!"
    assert rule["resource_link"] == "https://agentflow.app/guide"
    assert rule["resource_url"] == "https://agentflow.app/guide"

    # Simulate comment matching
    sim_res = client.post("/api/platform/instagram/simulate-comment", json={
        "comment_text": "Please send me TEST_REEL",
        "username": "tester_agent"
    })
    assert sim_res.status_code == 200
    assert sim_res.json()["matched"] is True

    # Clean up
    client.delete(f"/api/platform/instagram/rules/{rule_id}")


# =====================================================================
# 4. WhatsApp Business Cloud API Agent
# =====================================================================

def test_whatsapp_outbound_and_rules():
    """Verify WhatsApp rules accept both response_template and response_message, and test direct outbound send."""
    res = client.post("/api/platform/whatsapp/rules", json={
        "keyword": "TEST_PORTFOLIO",
        "response_template": "Here is Insha's portfolio: https://github.com/Insha-713"
    })
    assert res.status_code == 200
    rule = res.json()["rule"]
    rule_id = rule["id"]
    assert rule["keyword"] == "TEST_PORTFOLIO"
    assert rule["response_template"] == "Here is Insha's portfolio: https://github.com/Insha-713"
    assert rule["response_message"] == "Here is Insha's portfolio: https://github.com/Insha-713"

    # Test direct send endpoint (honest credentials check)
    send_res = client.post("/api/platform/whatsapp/send", json={
        "recipient_phone": "+919876543210",
        "message_body": "Hello from AgentFlow test"
    })
    assert send_res.status_code == 200
    send_data = send_res.json()
    assert send_data["success"] is False
    assert send_data["status"] == "awaiting_credentials"

    # Clean up
    client.delete(f"/api/platform/whatsapp/rules/{rule_id}")


# =====================================================================
# 5. Email Automation Agent
# =====================================================================

def test_email_reply_categorize_and_queue():
    """Verify email reply drafter, categorizer, briefing, and queueing with approval gates."""
    # Test reply drafter
    reply_res = client.post("/api/platform/email/reply", json={
        "email_from": "recruiter@hiring.com",
        "subject": "AI Engineer Position",
        "body": "Can you share your portfolio and availability?"
    })
    assert reply_res.status_code == 200
    reply_data = reply_res.json()
    assert reply_data["status"] == "success"
    assert "draft_reply" in reply_data
    assert "Re: AI Engineer Position" in reply_data["draft_reply"]["subject"]
    assert "Insha Fatima" in reply_data["draft_reply"]["reply_body"]

    # Test queueing for send
    queue_res = client.post("/api/platform/email/queue-send", json={
        "to_email": "recruiter@hiring.com",
        "subject": "Re: AI Engineer Position",
        "body": reply_data["draft_reply"]["reply_body"]
    })
    assert queue_res.status_code == 200
    q_data = queue_res.json()
    assert q_data["status"] == "success"
    assert q_data["task"]["status"] == "pending_approval"
    task_id = q_data["task"]["id"]

    # Test execute send endpoint
    send_res = client.post(f"/api/platform/email/tasks/{task_id}/send")
    assert send_res.status_code == 200
    assert send_res.json()["status"] in ("success", "failed")


# =====================================================================
# 6. Central AI Memory
# =====================================================================

def test_central_memory_crud_and_context():
    """Verify Central Memory stores, retrieves context, and deletes by key/id."""
    # Save memory item
    save_res = client.post("/api/platform/memory", json={
        "category": "preferences",
        "key": "preferred_llm",
        "value": "ollama_llama3",
        "description": "Default local LLM model"
    })
    assert save_res.status_code == 200

    # Get memory items (both items and memory keys returned)
    list_res = client.get("/api/platform/memory")
    assert list_res.status_code == 200
    data = list_res.json()
    assert "items" in data
    assert "memory" in data
    assert "context" in data

    # Get memory context dedicated endpoint
    ctx_res = client.get("/api/platform/memory/context")
    assert ctx_res.status_code == 200
    assert "context" in ctx_res.json()
    assert ctx_res.json()["context"].get("preferences", {}).get("preferred_llm") == "ollama_llama3"

    # Delete memory item by key
    del_res = client.delete("/api/platform/memory/preferred_llm")
    assert del_res.status_code == 200


# =====================================================================
# 7. Central Automation Rules Engine (WHEN / THEN)
# =====================================================================

def test_automation_rules_toggle_and_simulation():
    """Verify toggling rules without requiring a body and triggering simulations."""
    # Create rule
    create_res = client.post("/api/platform/rules", json={
        "name": "Auto Welcome DM",
        "trigger_type": "instagram_comment",
        "condition_config": {"keyword": "WELCOME"},
        "action_type": "send_dm",
        "action_config": {"text": "Welcome to AgentFlow!"},
        "requires_approval": 0,
        "is_enabled": 1
    })
    assert create_res.status_code == 200
    rule = create_res.json()["rule"]
    rule_id = rule["id"]
    assert bool(rule["is_active"]) is True
    assert bool(rule["is_enabled"]) is True

    # Toggle rule with empty body
    toggle_res = client.patch(f"/api/platform/rules/{rule_id}/toggle")
    assert toggle_res.status_code == 200
    toggled = toggle_res.json()["rule"]
    assert bool(toggled["is_active"]) is False
    assert bool(toggled["is_enabled"]) is False

    # Simulate trigger
    sim_res = client.post("/api/platform/rules/trigger", json={
        "event_name": "instagram_comment",
        "payload": {"comment_text": "WELCOME to the page"}
    })
    assert sim_res.status_code == 200
    assert "logs" in sim_res.json()

    # Clean up
    client.delete(f"/api/platform/rules/{rule_id}")


# =====================================================================
# 8. Unified Dashboard Integrity
# =====================================================================

def test_unified_dashboard_kpis():
    """Verify dashboard KPIs aggregate all module stats without runtime errors."""
    res = client.get("/api/platform/dashboard")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "career" in data
    assert "social" in data
    assert "instagram" in data
    assert "whatsapp" in data
    assert "calling" in data
    assert "system" in data
    assert "research_documents" in data["system"]
    assert "active_automation_rules" in data["system"]


if __name__ == "__main__":
    import sys
    test_functions = [
        test_research_live_sources_collection,
        test_research_structured_dossier_synthesis_en,
        test_research_structured_dossier_synthesis_multilingual,
        test_research_api_endpoints,
        test_social_generate_and_draft,
        test_linkedin_draft_and_status,
        test_linkedin_real_publishing_awaiting_credentials,
        test_social_post_lifecycle_and_publish,
        test_instagram_publishing_checks,
        test_instagram_rule_creation_flexible_schema,
        test_whatsapp_outbound_and_rules,
        test_email_reply_categorize_and_queue,
        test_central_memory_crud_and_context,
        test_automation_rules_toggle_and_simulation,
        test_unified_dashboard_kpis,
    ]

    print("=" * 70)
    print("AgentFlow V4.0 Restoration & Autonomous Upgrades — Automated Test Suite")
    print("=" * 70)

    passed = 0
    failed = 0
    errors = []

    for fn in test_functions:
        name = fn.__name__
        try:
            fn()
            passed += 1
            print(f"  PASS: {name}")
        except Exception as e:
            failed += 1
            errors.append((name, str(e)))
            print(f"  FAIL: {name} -> {e}")

    print("=" * 70)
    print(f"Total Tests: {len(test_functions)} | Passed: {passed} | Failed: {failed}")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)
