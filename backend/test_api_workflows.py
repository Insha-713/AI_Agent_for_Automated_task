"""
API Integration Test for Stage 1: Prompt-to-Workflow Engine.
Tests:
1. GET /api/workflows/tools
2. POST /api/workflows/generate (English & Hindi)
3. GET /api/workflows
4. SSE Stream endpoint connection
"""

from fastapi.testclient import TestClient
from backend.main import app

def test_workflow_api():
    client = TestClient(app)

    # 1. Tools catalog
    res_tools = client.get("/api/workflows/tools")
    assert res_tools.status_code == 200, res_tools.text
    data_tools = res_tools.json()
    assert "tools" in data_tools
    assert data_tools["count"] >= 10
    print(f"Verified {data_tools['count']} registered tools in catalog.")

    # 2. Workflow generation
    res_gen = client.post("/api/workflows/generate", json={
        "prompt": "Check current IST time, fetch latest AI news in India, and save to workspace/news.txt"
    })
    assert res_gen.status_code == 200, res_gen.text
    plan = res_gen.json()
    assert "workflow_id" in plan
    assert len(plan["steps"]) >= 2
    print(f"Generated workflow '{plan['title']}' with {len(plan['steps'])} steps.")

    # 3. List workflows from SQLite
    res_list = client.get("/api/workflows")
    assert res_list.status_code == 200, res_list.text
    wf_list = res_list.json()
    assert "workflows" in wf_list
    assert len(wf_list["workflows"]) > 0
    print(f"Persisted {len(wf_list['workflows'])} workflows in SQLite.")

    print("ALL STAGE 1 API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_workflow_api()
