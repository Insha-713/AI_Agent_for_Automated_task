"""
AgentFlow - Stage 5 Automated Verification Test Suite
Tests website uptime, HTTP status, latency measurement, repeated-failure detection,
incident alerting, agent tool execution, and FastAPI endpoints.
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

import asyncio
from fastapi.testclient import TestClient
from backend.db import (
    init_db,
    list_all_monitors,
    create_monitor,
    get_monitor_by_id,
    delete_monitor_by_id,
    toggle_monitor_active,
    get_monitor_logs,
)
from backend.monitors import (
    perform_health_check,
    execute_monitor_check,
    check_all_monitors_now,
    compute_monitoring_kpis,
)
from backend.tools import ALL_TOOLS, check_website_health
from backend.workflows import REGISTERED_TOOLS_META
from backend.main import app


def test_network_probe():
    print("--- Testing Network Health Check Probes ---")
    # Probe known reliable service
    res_up = perform_health_check("https://pypi.org", timeout=8)
    print(f"pypi.org Probe: Status={res_up['status']} | HTTP={res_up['status_code']} | Latency={res_up['latency_ms']}ms")
    assert res_up["status"] in ("up", "degraded")
    assert res_up["status_code"] in (200, 301, 302)
    assert res_up["latency_ms"] > 0

    # Probe unreachable invalid endpoint (refused connection)
    res_down = perform_health_check("http://127.0.0.1:59999", timeout=2)
    print(f"Refused Probe: Status={res_down['status']} | HTTP={res_down['status_code']} | Error={res_down['error_message']}")
    assert res_down["status"] == "down"
    assert len(res_down["error_message"]) > 0
    print("[PASS] Network health check probes passed.\n")


async def test_database_and_alerting():
    print("--- Testing Database Operations & Repeated Failure Alerts ---")
    await init_db()

    # Verify default monitors seeded
    monitors = await list_all_monitors()
    print(f"Total monitors in SQLite: {len(monitors)}")
    assert len(monitors) >= 4, "Expected at least 4 default monitors seeded"

    # Create a test monitor with threshold 2
    test_id = "mon-test-unit"
    await create_monitor(
        monitor_id=test_id,
        name="Unit Test Down Monitor",
        url="http://127.0.0.1:59999",
        failure_threshold=2
    )

    mon = await get_monitor_by_id(test_id)
    assert mon is not None
    assert mon["consecutive_failures"] == 0

    # Probe 1: First failure (consecutive_failures = 1, threshold not met)
    check1 = await execute_monitor_check(mon)
    assert check1["status"] == "down"
    assert check1["consecutive_failures"] == 1
    assert check1["alert_dispatched"] is False
    print("Probe 1: Failure 1 recorded (alert not yet triggered).")

    # Probe 2: Second failure (consecutive_failures = 2, threshold met -> alert dispatched)
    fresh_mon = await get_monitor_by_id(test_id)
    check2 = await execute_monitor_check(fresh_mon)
    assert check2["status"] == "down"
    assert check2["consecutive_failures"] == 2
    assert check2["alert_dispatched"] is True
    print("Probe 2: Consecutive failure threshold reached -> Alert triggered successfully.")

    # Check logs
    logs = await get_monitor_logs(test_id)
    assert len(logs) >= 2
    print(f"Historical check logs persisted: {len(logs)} logs.")

    # Cleanup test monitor
    await delete_monitor_by_id(test_id)
    print("[PASS] Database operations and repeated-failure alerting passed.\n")


def test_agent_tool_registration():
    print("--- Testing check_website_health Tool ---")
    assert check_website_health in ALL_TOOLS
    assert "check_website_health" in REGISTERED_TOOLS_META

    # Direct tool invocation
    tool_out = check_website_health.invoke({"url": "https://www.google.co.in"})
    print(f"Tool Result Preview:\n{tool_out}")
    assert "Website Health Check" in tool_out
    assert "Status: UP" in tool_out or "HTTP 200" in tool_out
    print("[PASS] check_website_health tool verified.\n")


def test_api_endpoints():
    print("--- Testing FastAPI Monitoring Endpoints ---")
    client = TestClient(app)

    # 1. GET /api/monitors
    res_list = client.get("/api/monitors")
    assert res_list.status_code == 200
    data = res_list.json()
    assert "monitors" in data
    assert "kpis" in data
    print(f"[PASS] /api/monitors returned {len(data['monitors'])} monitors (Uptime KPI: {data['kpis']['uptime_percentage']}%)")

    # 2. POST /api/monitors (create custom)
    res_create = client.post("/api/monitors", json={
        "name": "API Test Service",
        "url": "https://pypi.org",
        "expected_status": 200,
        "interval_minutes": 15,
        "failure_threshold": 3
    })
    assert res_create.status_code == 200
    created_id = res_create.json()["monitor"]["id"]
    print(f"[PASS] /api/monitors created monitor '{created_id}' with instant initial check")

    # 3. POST /api/monitors/{id}/check
    res_check = client.post(f"/api/monitors/{created_id}/check")
    assert res_check.status_code == 200
    assert res_check.json()["status"] == "success"
    print(f"[PASS] /api/monitors/{created_id}/check triggered on-demand probe")

    # 4. POST /api/monitors/{id}/toggle
    res_toggle = client.post(f"/api/monitors/{created_id}/toggle")
    assert res_toggle.status_code == 200
    assert res_toggle.json()["is_active"] == 0
    print(f"[PASS] /api/monitors/{created_id}/toggle paused monitor")

    # 5. GET /api/monitors/{id}/logs
    res_logs = client.get(f"/api/monitors/{created_id}/logs")
    assert res_logs.status_code == 200
    assert len(res_logs.json()["logs"]) >= 1
    print(f"[PASS] /api/monitors/{created_id}/logs retrieved historical logs")

    # 6. DELETE /api/monitors/{id}
    res_del = client.delete(f"/api/monitors/{created_id}")
    assert res_del.status_code == 200
    print(f"[PASS] /api/monitors/{created_id} deleted successfully.\n")


if __name__ == "__main__":
    print("==========================================")
    print("STAGE 5: WEBSITE MONITORING MODULE TESTS")
    print("==========================================\n")
    test_network_probe()
    asyncio.run(test_database_and_alerting())
    test_agent_tool_registration()
    test_api_endpoints()
    print("==========================================")
    print("ALL STAGE 5 MONITORING TESTS PASSED! [SUCCESS]")
    print("==========================================")
