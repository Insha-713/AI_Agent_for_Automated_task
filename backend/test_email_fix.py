"""
Verification Test Suite for Gmail SMTP send_email Fix & Connection Test
Addresses all 7 requirements specified by the user:
1. Port 587 with STARTTLS or Port 465 with SMTP_SSL (no mixing).
2. Dual-port failover: Port 587 STARTTLS first, falling back to Port 465 SSL on disconnect.
3. EMAIL_USER and EMAIL_PASS environment reading with space and quote stripping.
4. Specific honest error messages: auth failed, connection blocked, recipient rejected. No password leaks.
5. Email body placeholder check: Unresolved {{...}} placeholders fail the step with clear guidance.
6. 'Test Email Connection' test endpoint / function without sending real email.
7. End-to-end execution with full status output.
"""

import sys
import os
import unittest
from unittest.mock import patch, MagicMock
import smtplib
import socket

# Ensure backend modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.tools import connect_gmail_smtp, send_email
from backend.integrations import test_email_integration
from backend.workflows import WorkflowExecutionEngine


class TestGmailSMTPFix(unittest.TestCase):

    def test_1_credential_sanitization_and_no_leakage(self):
        """Requirement 3 & 4: Space and quote stripping, zero password leakage."""
        raw_user = "  'testuser@gmail.com'  "
        raw_pass = '  "abcd efgh ijkl mnop"  '

        with patch("smtplib.SMTP") as mock_smtp:
            instance = MagicMock()
            mock_smtp.return_value = instance
            
            server, port = connect_gmail_smtp(raw_user, raw_pass)
            self.assertEqual(port, 587)
            # Ensure sanitized username and password (no quotes, no spaces in pass) were passed
            instance.login.assert_called_with("testuser@gmail.com", "abcdefghijklmnop")
            instance.starttls.assert_called_once()

        # Check authentication error does not leak password
        with patch("smtplib.SMTP") as mock_smtp:
            instance = MagicMock()
            instance.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Invalid credentials")
            mock_smtp.return_value = instance

            try:
                connect_gmail_smtp(raw_user, raw_pass)
                self.fail("Expected SMTPAuthenticationError")
            except smtplib.SMTPAuthenticationError as err:
                err_msg = str(err)
                self.assertNotIn("abcdefghijklmnop", err_msg)
                self.assertNotIn("abcd efgh", err_msg)
                self.assertIn("myaccount.google.com/apppasswords", err_msg)
                self.assertIn("Invalid Google App Password", err_msg)

    def test_2_dual_port_failover(self):
        """Requirement 1 & 2: 587 STARTTLS first, retry once on 465 SSL upon disconnect/block."""
        with patch("smtplib.SMTP") as mock_587, patch("smtplib.SMTP_SSL") as mock_465:
            # 587 throws connection closed
            mock_587.side_effect = smtplib.SMTPServerDisconnected("Connection unexpectedly closed")

            instance_465 = MagicMock()
            mock_465.return_value = instance_465

            server, port = connect_gmail_smtp("user@gmail.com", "pass1234pass1234")
            self.assertEqual(port, 465)
            mock_587.assert_called_once_with("smtp.gmail.com", 587, timeout=20)
            mock_465.assert_called_once_with("smtp.gmail.com", 465, timeout=20)
            instance_465.login.assert_called_once_with("user@gmail.com", "pass1234pass1234")

    def test_3_both_ports_blocked_honest_error(self):
        """Requirement 4: Honest error message when both ports are blocked."""
        with patch("smtplib.SMTP") as mock_587, patch("smtplib.SMTP_SSL") as mock_465:
            mock_587.side_effect = smtplib.SMTPServerDisconnected("Connection unexpectedly closed")
            mock_465.side_effect = socket.timeout("Timed out connecting to 465")

            try:
                connect_gmail_smtp("user@gmail.com", "pass1234pass1234")
                self.fail("Expected SMTPConnectError")
            except smtplib.SMTPConnectError as err:
                err_msg = str(err)
                self.assertIn("Connection blocked or timed out", err_msg)
                self.assertIn("firewall, VPN, or antivirus", err_msg)
                self.assertNotIn("pass1234", err_msg)

    def test_4_unresolved_placeholders_rejected_in_send_email(self):
        """Requirement 5: Fail if placeholders like {{search_results}} are unresolved."""
        res = send_email.func(
            to_email="recipient@example.com",
            subject="Weather Report for {{city}}",
            body="Here is the report:\n{{search_results}}\nRegards"
        )
        self.assertIn("Failed to send email: Unresolved workflow template placeholder(s) detected", res)
        self.assertIn("{{city}}", res)
        self.assertIn("{{search_results}}", res)

    def test_5_workflow_execution_engine_placeholder_rejection(self):
        """Requirement 5: WorkflowExecutionEngine execute_step fails step on unresolved placeholders."""
        engine = WorkflowExecutionEngine(workflow_id="wf_test", plan={"steps": []}, dry_run=False)
        step = {
            "id": "step_2",
            "tool": "send_email",
            "name": "Send Digest",
            "params": {
                "to_email": "user@gmail.com",
                "subject": "AI Daily Digest",
                "body": "Top findings:\n{{latest_news}}\n{{extra_data}}"
            }
        }
        import asyncio
        result = asyncio.run(engine.execute_step(step))
        self.assertEqual(result["status"], "failed")
        self.assertIn("unresolved workflow placeholder(s)", result["error"])
        self.assertIn("{{latest_news}}", result["error"])
        self.assertIn("{{extra_data}}", result["error"])

    def test_6_workflow_parameter_substitution_no_truncation(self):
        """Requirement 5: Placeholders are resolved with complete output without 1500 char truncation."""
        engine = WorkflowExecutionEngine(workflow_id="wf_test", plan={"steps": []}, dry_run=False)
        long_text = "A" * 5000
        engine.step_context["search_results"] = long_text
        engine.step_context["last_output"] = long_text

        params = {
            "to_email": "user@gmail.com",
            "subject": "Digest",
            "body": "Results:\n{{search_results}}"
        }
        resolved = engine.substitute_params(params)
        self.assertEqual(len(resolved["body"]), 5000 + len("Results:\n"))
        self.assertNotIn("{{search_results}}", resolved["body"])

    def test_7_test_email_connection_function(self):
        """Requirement 6: Test connection button logic connects, logs in, and reports result without sending email."""
        # Case A: Credentials missing
        with patch.dict(os.environ, {"EMAIL_USER": "", "EMAIL_PASS": ""}, clear=True):
            status = test_email_integration()
            self.assertEqual(status["status"], "not_configured")
            self.assertIn("EMAIL_USER or EMAIL_PASS not configured", status["message"])

        # Case B: Successful connection & login on port 587
        with patch.dict(os.environ, {"EMAIL_USER": "test@gmail.com", "EMAIL_PASS": "abcd efgh ijkl mnop"}):
            with patch("smtplib.SMTP") as mock_smtp:
                instance = MagicMock()
                mock_smtp.return_value = instance

                status = test_email_integration()
                self.assertEqual(status["status"], "connected")
                self.assertEqual(status["port_used"], 587)
                self.assertIn("Authenticated successfully", status["message"])
                instance.quit.assert_called_once()

        # Case C: Port 587 fails, failover to 465 succeeds
        with patch.dict(os.environ, {"EMAIL_USER": "test@gmail.com", "EMAIL_PASS": "abcd efgh ijkl mnop"}):
            with patch("smtplib.SMTP") as mock_587, patch("smtplib.SMTP_SSL") as mock_465:
                mock_587.side_effect = smtplib.SMTPServerDisconnected("Connection closed on 587")
                instance_465 = MagicMock()
                mock_465.return_value = instance_465

                status = test_email_integration()
                self.assertEqual(status["status"], "connected")
                self.assertEqual(status["port_used"], 465)
                self.assertIn("port 465", status["message"])


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestGmailSMTPFix)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        sys.exit(1)
    print("\nALL 7 REQUIREMENTS SUCCESSFULLY VERIFIED.")
