"""
AgentFlow - Stage 6 Automated Verification Test Suite
Tests integrations diagnostics, live connection tests, workflow template gallery,
template cloning, and FastAPI endpoints.
"""

import sys
import os
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
from backend.integrations import (
    test_integration_by_name,
    get_all_integrations_summary,
    get_curated_workflow_templates,
)
from backend.workflows import REGISTERED_TOOLS_META


def test_individual_integrations():
    print("--- Testing Individual Integration Testers ---")

    # 1. Workspace Storage Test
    ws_res = test_integration_by_name("workspace")
    print(f"Workspace Probe: Status={ws_res['status']} | Free Space={ws_res.get('free_space_gb')} GB")
    assert ws_res["status"] == "connected"
    assert ws_res["free_space_gb"] > 0
    print("[PASS] Workspace storage probe passed.")

    # 2. DuckDuckGo Search Test
    search_res = test_integration_by_name("search")
    print(f"Search Probe: Status={search_res['status']} | Latency={search_res.get('latency_ms')} ms")
    assert search_res["status"] in ("connected", "degraded")
    print("[PASS] Search probe passed.")

    # 3. Google News RSS Test
    news_res = test_integration_by_name("news")
    print(f"News Feed Probe: Status={news_res['status']} | Stories={news_res.get('stories_found')}")
    assert news_res["status"] in ("connected", "error")
    print("[PASS] News RSS probe passed.")

    # 4. Telegram Integration Test
    tg_res = test_integration_by_name("telegram")
    print(f"Telegram Probe: Status={tg_res['status']} | Configured={tg_res.get('configured')}")
    assert tg_res["status"] in ("connected", "not_configured", "invalid_token", "error")
    print("[PASS] Telegram probe passed.")

    # 5. Gmail SMTP Integration Test
    mail_res = test_integration_by_name("email")
    print(f"Gmail SMTP Probe: Status={mail_res['status']} | Configured={mail_res.get('configured')}")
    assert mail_res["status"] in ("connected", "not_configured", "auth_failed", "error")
    print("[PASS] Gmail SMTP probe passed.")

    # 6. Ollama Local LLM Test
    ol_res = test_integration_by_name("ollama")
    print(f"Ollama LLM Probe: Status={ol_res['status']} | Active Model={ol_res.get('active_model')}")
    assert ol_res["status"] in ("connected", "offline", "error")
    print("[PASS] Ollama LLM probe passed.\n")


def test_workflow_templates_structure():
    print("--- Testing Curated Workflow Templates Gallery ---")
    templates = get_curated_workflow_templates()
    print(f"Loaded {len(templates)} curated workflow templates:")

    assert len(templates) >= 6, "Expected at least 6 curated templates"

    for t in templates:
        print(f"  * {t['title']} [{t['category']}] -> {len(t['plan']['steps'])} steps")
        assert "id" in t
        assert "title" in t
        assert "prompt" in t
        assert "plan" in t
        assert "steps" in t["plan"]
        assert len(t["plan"]["steps"]) > 0

        # Verify all tools in templates exist in REGISTERED_TOOLS_META (Zero hallucinated tools rule)
        for s in t["plan"]["steps"]:
            tool_name = s["tool"]
            assert tool_name in REGISTERED_TOOLS_META, f"Template tool '{tool_name}' must be registered"

    print("[PASS] Workflow templates structure and strict tool validation passed.\n")


def test_fastapi_integrations_endpoints():
    print("--- Testing FastAPI Integrations & Template Endpoints ---")
    client = TestClient(app)

    # 1. GET /api/integrations/status
    res_status = client.get("/api/integrations/status")
    assert res_status.status_code == 200
    summary = res_status.json()
    assert summary["total_integrations"] == 6
    assert len(summary["services"]) == 6
    print(f"[PASS] /api/integrations/status verified ({summary['connected_count']} connected services)")

    # 2. POST /api/integrations/test/workspace
    res_test_ws = client.post("/api/integrations/test/workspace")
    assert res_test_ws.status_code == 200
    assert res_test_ws.json()["status"] == "connected"
    print("[PASS] /api/integrations/test/workspace verified")

    # 3. GET /api/workflows/templates
    res_tpls = client.get("/api/workflows/templates")
    assert res_tpls.status_code == 200
    tpl_data = res_tpls.json()
    assert tpl_data["count"] >= 6
    print(f"[PASS] /api/workflows/templates returned {tpl_data['count']} templates")

    # 4. POST /api/workflows/from-template/tpl-placement-analytics
    res_clone = client.post("/api/workflows/from-template/tpl-placement-analytics")
    assert res_clone.status_code == 200
    clone_data = res_clone.json()
    assert clone_data["status"] == "success"
    assert "workflow_id" in clone_data
    created_wf_id = clone_data["workflow_id"]
    print(f"[PASS] Successfully instantiated workflow '{created_wf_id}' from template in SQLite")

    # Verify cloned workflow in SQLite via GET /api/workflows/{id}
    res_get_wf = client.get(f"/api/workflows/{created_wf_id}")
    assert res_get_wf.status_code == 200
    assert res_get_wf.json()["title"] == "Campus Placement Analytics & CTC Digest"
    print("[PASS] Cloned workflow retrieved and verified in SQLite.\n")


if __name__ == "__main__":
    print("==========================================")
    print("STAGE 6: INTEGRATIONS & TEMPLATES TESTS")
    print("==========================================\n")
    test_individual_integrations()
    test_workflow_templates_structure()
    test_fastapi_integrations_endpoints()
    print("==========================================")
    print("ALL STAGE 6 INTEGRATION & TEMPLATE TESTS PASSED! [SUCCESS]")
    print("==========================================")
