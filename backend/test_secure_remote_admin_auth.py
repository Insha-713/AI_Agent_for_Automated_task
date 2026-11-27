"""
AgentFlow - Secure Remote Administrative Authentication Test Suite
Verifies:
1. Localhost administrative operations succeed transparently without admin key.
2. Simulated non-local/remote requests without an admin key are blocked (HTTP 403).
3. Simulated non-local/remote requests with an invalid admin key are blocked (HTTP 403).
4. Simulated non-local/remote requests with a valid X-AgentFlow-Admin-Key are authorized (HTTP 200).
5. All 5 administrative mutation endpoints and /admin/verify are covered.
6. Read-only endpoints (/connections, /integrations/catalog) remain accessible without a key.
7. AGENTFLOW_ADMIN_KEY is registered in SENSITIVE_KEYS.
"""

import sys
import os
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient
from starlette.datastructures import Address
from backend.main import app
from backend.credentials import SENSITIVE_KEYS, set_credential, delete_credential

client = TestClient(app)

TEST_ADMIN_KEY = "test_agentflow_admin_secret_998877"

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

class TestRemoteAdminAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Configure test admin key in runtime environment
        set_credential("AGENTFLOW_ADMIN_KEY", TEST_ADMIN_KEY)
        os.environ["AGENTFLOW_ADMIN_KEY"] = TEST_ADMIN_KEY

    @classmethod
    def tearDownClass(cls):
        delete_credential("AGENTFLOW_ADMIN_KEY")
        os.environ.pop("AGENTFLOW_ADMIN_KEY", None)

    def test_01_sensitive_keys_registration(self):
        """Verify AGENTFLOW_ADMIN_KEY is protected in SENSITIVE_KEYS."""
        self.assertIn("AGENTFLOW_ADMIN_KEY", SENSITIVE_KEYS)
        log("Test 1 PASS: AGENTFLOW_ADMIN_KEY is registered in SENSITIVE_KEYS", "PASS")

    def test_02_localhost_unauthenticated_access_allowed(self):
        """Verify localhost / testclient requests succeed without an admin key."""
        # 1. /api/platform/admin/verify
        res = client.post("/api/platform/admin/verify")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get("authorized"))
        log("Test 2 PASS: Localhost/testclient administrative operations succeed without key", "PASS")

    def test_03_remote_client_without_key_rejected(self):
        """Verify non-local request without X-AgentFlow-Admin-Key is rejected with 403."""
        with patch("starlette.requests.Request.client", new=Address("76.76.21.21", 443)):
            res = client.post("/api/platform/admin/verify")
            self.assertEqual(res.status_code, 403)
            data = res.json()
            self.assertIn("Administrative operation prohibited", data.get("detail", ""))
            self.assertIn("X-AgentFlow-Admin-Key", data.get("detail", ""))
        log("Test 3 PASS: Remote request without X-AgentFlow-Admin-Key rejected with HTTP 403", "PASS")

    def test_04_remote_client_with_invalid_key_rejected(self):
        """Verify non-local request with wrong admin key is rejected with 403."""
        with patch("starlette.requests.Request.client", new=Address("76.76.21.21", 443)):
            res = client.post(
                "/api/platform/admin/verify",
                headers={"X-AgentFlow-Admin-Key": "wrong_key_xyz"}
            )
            self.assertEqual(res.status_code, 403)
            data = res.json()
            self.assertIn("Administrative operation prohibited", data.get("detail", ""))
        log("Test 4 PASS: Remote request with invalid X-AgentFlow-Admin-Key rejected with HTTP 403", "PASS")

    def test_05_remote_client_with_valid_key_authorized(self):
        """Verify non-local request with valid X-AgentFlow-Admin-Key succeeds (HTTP 200)."""
        with patch("starlette.requests.Request.client", new=Address("76.76.21.21", 443)):
            res = client.post(
                "/api/platform/admin/verify",
                headers={"X-AgentFlow-Admin-Key": TEST_ADMIN_KEY}
            )
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertTrue(data.get("authorized"))
        log("Test 5 PASS: Remote request with valid X-AgentFlow-Admin-Key authorized with HTTP 200", "PASS")

    def test_06_connections_save_remote_protection(self):
        """Verify /api/platform/connections/save blocks remote unauth and accepts valid key."""
        payload = {"TELEGRAM_CHAT_ID": "987654321"}
        with patch("starlette.requests.Request.client", new=Address("198.51.100.15", 443)):
            # 1. Without key -> 403
            res_denied = client.post("/api/platform/connections/save", json=payload)
            self.assertEqual(res_denied.status_code, 403)

            # 2. With valid key -> 200
            res_ok = client.post(
                "/api/platform/connections/save",
                json=payload,
                headers={"X-AgentFlow-Admin-Key": TEST_ADMIN_KEY}
            )
            self.assertEqual(res_ok.status_code, 200)
            self.assertEqual(res_ok.json().get("status"), "success")
        log("Test 6 PASS: /api/platform/connections/save verified under remote authentication", "PASS")

    def test_07_integrations_save_remote_protection(self):
        """Verify /api/platform/integrations/save blocks remote unauth and accepts valid key."""
        payload = {
            "integration_id": "telegram",
            "credentials": {"TELEGRAM_CHAT_ID": "987654321"}
        }
        with patch("starlette.requests.Request.client", new=Address("198.51.100.15", 443)):
            # 1. Without key -> 403
            res_denied = client.post("/api/platform/integrations/save", json=payload)
            self.assertEqual(res_denied.status_code, 403)

            # 2. With valid key -> 200
            res_ok = client.post(
                "/api/platform/integrations/save",
                json=payload,
                headers={"X-AgentFlow-Admin-Key": TEST_ADMIN_KEY}
            )
            self.assertEqual(res_ok.status_code, 200)
            self.assertEqual(res_ok.json().get("status"), "success")
        log("Test 7 PASS: /api/platform/integrations/save verified under remote authentication", "PASS")

    def test_08_connections_disconnect_remote_protection(self):
        """Verify /api/platform/connections/disconnect blocks remote unauth and accepts valid key."""
        payload = {"service_id": "telegram"}
        with patch("starlette.requests.Request.client", new=Address("198.51.100.15", 443)):
            # 1. Without key -> 403
            res_denied = client.post("/api/platform/connections/disconnect", json=payload)
            self.assertEqual(res_denied.status_code, 403)

            # 2. With valid key -> 200
            res_ok = client.post(
                "/api/platform/connections/disconnect",
                json=payload,
                headers={"X-AgentFlow-Admin-Key": TEST_ADMIN_KEY}
            )
            self.assertEqual(res_ok.status_code, 200)
            self.assertEqual(res_ok.json().get("status"), "success")
        log("Test 8 PASS: /api/platform/connections/disconnect verified under remote authentication", "PASS")

    def test_09_integrations_disconnect_remote_protection(self):
        """Verify /api/platform/integrations/disconnect blocks remote unauth and accepts valid key."""
        payload = {"service_id": "telegram"}
        with patch("starlette.requests.Request.client", new=Address("198.51.100.15", 443)):
            # 1. Without key -> 403
            res_denied = client.post("/api/platform/integrations/disconnect", json=payload)
            self.assertEqual(res_denied.status_code, 403)

            # 2. With valid key -> 200
            res_ok = client.post(
                "/api/platform/integrations/disconnect",
                json=payload,
                headers={"X-AgentFlow-Admin-Key": TEST_ADMIN_KEY}
            )
            self.assertEqual(res_ok.status_code, 200)
            self.assertEqual(res_ok.json().get("status"), "success")
        log("Test 9 PASS: /api/platform/integrations/disconnect verified under remote authentication", "PASS")

    def test_10_clear_demo_data_remote_protection(self):
        """Verify /api/platform/data/clear-demo blocks remote unauth and accepts valid key."""
        with patch("starlette.requests.Request.client", new=Address("198.51.100.15", 443)):
            # 1. Without key -> 403
            res_denied = client.post("/api/platform/data/clear-demo")
            self.assertEqual(res_denied.status_code, 403)

            # 2. With valid key -> 200
            res_ok = client.post(
                "/api/platform/data/clear-demo",
                headers={"X-AgentFlow-Admin-Key": TEST_ADMIN_KEY}
            )
            self.assertEqual(res_ok.status_code, 200)
            self.assertEqual(res_ok.json().get("status"), "success")
        log("Test 10 PASS: /api/platform/data/clear-demo verified under remote authentication", "PASS")

    def test_11_read_only_endpoints_accessible_without_key(self):
        """Verify read-only endpoints remain accessible from remote clients without a key."""
        with patch("starlette.requests.Request.client", new=Address("198.51.100.15", 443)):
            res_conn = client.get("/api/platform/connections")
            self.assertEqual(res_conn.status_code, 200)

            res_cat = client.get("/api/platform/integrations/catalog")
            self.assertEqual(res_cat.status_code, 200)
        log("Test 11 PASS: Read-only endpoints (/connections, /integrations/catalog) accessible without key", "PASS")


if __name__ == "__main__":
    print("=" * 75)
    print("AgentFlow Secure Remote Admin Authentication Test Suite")
    print("=" * 75)
    suite = unittest.TestLoader().loadTestsFromTestCase(TestRemoteAdminAuth)
    runner = unittest.TextTestRunner(verbosity=0)
    result = runner.run(suite)
    print("=" * 75)
    print(f"Summary: {result.testsRun - len(result.failures) - len(result.errors)}/{result.testsRun} Tests Passed")
    print("=" * 75)
    if not result.wasSuccessful():
        sys.exit(1)
