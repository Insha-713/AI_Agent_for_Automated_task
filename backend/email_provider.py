"""
AgentFlow - Multi-Provider Email Service Layer
Supports:
  1. "smtp": Direct Gmail SMTP connection (ports 587/465) - Default for local use.
     Enforces a fast 5s connection timeout so blocked cloud hosting ports (Render free tier) fail fast.
  2. "brevo": Brevo Transactional Email REST API via HTTPS (port 443) using BREVO_API_KEY and EMAIL_FROM.
  3. "resend": Resend Email REST API via HTTPS (port 443) using RESEND_API_KEY and EMAIL_FROM.

Never logs secrets or API keys.
"""

import os
import json
import socket
import smtplib
import urllib.request
import urllib.error
from typing import Tuple, Dict, Any, Optional

def get_email_provider() -> str:
    """Reads EMAIL_PROVIDER from environment or DB credentials (fallback to 'smtp')."""
    from backend.credentials import get_credential
    prov = (os.getenv("EMAIL_PROVIDER") or get_credential("EMAIL_PROVIDER") or "smtp").strip().lower()
    if prov in ("brevo", "resend", "smtp"):
        return prov
    return "smtp"

def get_email_credentials() -> Dict[str, str]:
    """Returns email credentials safely resolved from os.environ or persistent DB."""
    from backend.credentials import get_credential
    return {
        "provider": get_email_provider(),
        "email_user": (os.getenv("EMAIL_USER") or get_credential("EMAIL_USER") or get_credential("GMAIL_EMAIL") or "").strip(),
        "email_pass": (os.getenv("EMAIL_PASS") or get_credential("EMAIL_PASS") or get_credential("GMAIL_APP_PASSWORD") or "").strip().replace(" ", ""),
        "email_from": (os.getenv("EMAIL_FROM") or get_credential("EMAIL_FROM") or os.getenv("EMAIL_USER") or get_credential("EMAIL_USER") or "").strip(),
        "brevo_api_key": (os.getenv("BREVO_API_KEY") or get_credential("BREVO_API_KEY") or "").strip(),
        "resend_api_key": (os.getenv("RESEND_API_KEY") or get_credential("RESEND_API_KEY") or "").strip()
    }

def is_email_configured(provider: Optional[str] = None) -> bool:
    """Checks whether the chosen or active email provider has all required credentials configured."""
    creds = get_email_credentials()
    prov = (provider or creds["provider"]).strip().lower()

    if prov == "brevo":
        return bool(creds["brevo_api_key"])
    elif prov == "resend":
        return bool(creds["resend_api_key"])
    else:  # smtp
        return bool(creds["email_user"] and creds["email_pass"])

def test_email_connection(provider: Optional[str] = None) -> Tuple[bool, str]:
    """
    Validates email provider connectivity and credentials WITHOUT sending any email.
    Returns (success: bool, message: str).
    """
    creds = get_email_credentials()
    prov = (provider or creds["provider"]).strip().lower()

    if prov == "brevo":
        api_key = creds["brevo_api_key"]
        if not api_key:
            return False, "Brevo is not configured. Set BREVO_API_KEY in environment or Integrations settings."
        try:
            req = urllib.request.Request(
                "https://api.brevo.com/v3/account",
                headers={
                    "api-key": api_key,
                    "Accept": "application/json",
                    "User-Agent": "AgentFlow/1.0"
                },
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    email = data.get("email", "")
                    return True, f"Brevo API verified successfully (Account: {email or 'active'}). Port 443 HTTPS connected."
                return True, "Brevo API connection successful."
        except urllib.error.HTTPError as he:
            if he.code in (401, 403):
                return False, "Brevo authentication failed: Invalid BREVO_API_KEY. Please verify your Brevo API key."
            return False, f"Brevo API error: HTTP {he.code} {he.reason}"
        except Exception as e:
            return False, f"Brevo connection error: {str(e)}"

    elif prov == "resend":
        api_key = creds["resend_api_key"]
        if not api_key:
            return False, "Resend is not configured. Set RESEND_API_KEY in environment or Integrations settings."
        try:
            req = urllib.request.Request(
                "https://api.resend.com/api-keys",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Accept": "application/json",
                    "User-Agent": "AgentFlow/1.0"
                },
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                if resp.status == 200:
                    return True, "Resend API verified successfully. Port 443 HTTPS connected."
                return True, "Resend API connection successful."
        except urllib.error.HTTPError as he:
            if he.code in (401, 403):
                return False, "Resend authentication failed: Invalid RESEND_API_KEY. Please verify your Resend API key."
            return False, f"Resend API error: HTTP {he.code} {he.reason}"
        except Exception as e:
            return False, f"Resend connection error: {str(e)}"

    else:  # smtp
        email_user = creds["email_user"]
        email_pass = creds["email_pass"]
        if not email_user or not email_pass:
            return False, "SMTP is not configured. Set EMAIL_USER and EMAIL_PASS in server settings."

        from backend.tools import connect_gmail_smtp
        try:
            server, port = connect_gmail_smtp(email_user, email_pass, timeout=5)
            try:
                server.quit()
            except Exception:
                pass
            return True, f"Gmail SMTP verified successfully on port {port}. Connection and credentials valid."
        except smtplib.SMTPAuthenticationError:
            return False, f"Authentication failed for '{email_user}'. Invalid Google App Password."
        except (smtplib.SMTPConnectError, socket.timeout, TimeoutError, ConnectionRefusedError, OSError):
            return False, "SMTP is blocked on this host (for example Render free plan). Set EMAIL_PROVIDER=brevo or resend and an API key."
        except Exception as e:
            err_str = str(e)
            if "timeout" in err_str.lower() or "blocked" in err_str.lower() or "101" in err_str or "unreachable" in err_str.lower():
                return False, "SMTP is blocked on this host (for example Render free plan). Set EMAIL_PROVIDER=brevo or resend and an API key."
            return False, f"SMTP connection error: {err_str}"

def send_email_via_provider(to_email: str, subject: str, body: str) -> str:
    """
    Sends an email using the active EMAIL_PROVIDER ('smtp', 'brevo', or 'resend').
    Provides clear, accurate error diagnostics (blocked port, auth failed, unverified sender, rejected recipient).
    """
    clean_to = to_email.strip()
    creds = get_email_credentials()
    prov = creds["provider"]

    if prov == "brevo":
        api_key = creds["brevo_api_key"]
        if not api_key:
            return "Failed to send email: Brevo provider is not configured. Set BREVO_API_KEY in environment or Integrations settings."

        sender_email = creds["email_from"] or creds["email_user"] or "AgentFlow <no-reply@agentflow.app>"
        sender_name = "AgentFlow"
        if "<" in sender_email and ">" in sender_email:
            parts = sender_email.split("<")
            sender_name = parts[0].strip() or "AgentFlow"
            sender_email = parts[1].replace(">", "").strip()

        payload = {
            "sender": {
                "name": sender_name,
                "email": sender_email
            },
            "to": [
                {"email": clean_to}
            ],
            "subject": subject,
            "textContent": body,
            "htmlContent": f"<pre style='font-family: sans-serif; white-space: pre-wrap;'>{body}</pre>"
        }

        try:
            req = urllib.request.Request(
                "https://api.brevo.com/v3/smtp/email",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "api-key": api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "AgentFlow/1.0"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12.0) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                msg_id = resp_data.get("messageId", "sent")
                return f"Email successfully sent to '{clean_to}' with subject '{subject}' (via Brevo API, message ID: {msg_id})."

        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="ignore")
            try:
                err_json = json.loads(err_body)
                err_msg = err_json.get("message", err_body)
            except Exception:
                err_msg = err_body or str(he)

            if he.code in (401, 403):
                return f"Failed to send email to '{clean_to}': Brevo authentication failed. Invalid BREVO_API_KEY."
            elif "unverified" in err_msg.lower() or "sender" in err_msg.lower():
                return f"Failed to send email to '{clean_to}': Brevo sender '{sender_email}' is not verified. Please verify your sender email in Brevo."
            elif "recipient" in err_msg.lower():
                return f"Failed to send email to '{clean_to}': Brevo rejected recipient address '{clean_to}'."
            return f"Failed to send email to '{clean_to}' via Brevo (HTTP {he.code}): {err_msg}"

        except (socket.timeout, TimeoutError):
            return f"Failed to send email to '{clean_to}': Brevo API request timed out after 12 seconds."
        except Exception as e:
            return f"Failed to send email to '{clean_to}' via Brevo: {str(e)}"

    elif prov == "resend":
        api_key = creds["resend_api_key"]
        if not api_key:
            return "Failed to send email: Resend provider is not configured. Set RESEND_API_KEY in environment or Integrations settings."

        sender = creds["email_from"] or "onboarding@resend.dev"
        if not sender or "@" not in sender:
            sender = "onboarding@resend.dev"

        payload = {
            "from": sender if "<" in sender else f"AgentFlow <{sender}>",
            "to": [clean_to],
            "subject": subject,
            "text": body,
            "html": f"<pre style='font-family: sans-serif; white-space: pre-wrap;'>{body}</pre>"
        }

        try:
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "AgentFlow/1.0"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12.0) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                email_id = resp_data.get("id", "sent")
                return f"Email successfully sent to '{clean_to}' with subject '{subject}' (via Resend API, ID: {email_id})."

        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="ignore")
            try:
                err_json = json.loads(err_body)
                err_msg = err_json.get("message", err_body)
            except Exception:
                err_msg = err_body or str(he)

            if he.code in (401, 403):
                return f"Failed to send email to '{clean_to}': Resend authentication failed. Invalid RESEND_API_KEY."
            elif "domain" in err_msg.lower() or "verify" in err_msg.lower():
                return f"Failed to send email to '{clean_to}': Resend sender domain is unverified. Note: Unverified accounts can only send from 'onboarding@resend.dev' to your registered email."
            return f"Failed to send email to '{clean_to}' via Resend (HTTP {he.code}): {err_msg}"

        except (socket.timeout, TimeoutError):
            return f"Failed to send email to '{clean_to}': Resend API request timed out after 12 seconds."
        except Exception as e:
            return f"Failed to send email to '{clean_to}' via Resend: {str(e)}"

    else:  # smtp
        email_user = creds["email_user"]
        email_pass = creds["email_pass"]

        if not email_user or not email_pass:
            return (
                f"[SIMULATION MODE - EMAIL NOT SENT (APPROVED)]\n"
                f"Notice: EMAIL_USER / EMAIL_PASS not configured in server settings.\n"
                f"To: {clean_to}\n"
                f"Subject: {subject}\n"
                f"Body preview:\n{body[:300]}..."
            )

        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from backend.tools import connect_gmail_smtp

        try:
            msg = MIMEMultipart()
            msg["From"] = email_user
            msg["To"] = clean_to
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain", "utf-8"))

            # Enforce 5s connect timeout so blocked ports fail quickly
            server, port_used = connect_gmail_smtp(email_user, email_pass, timeout=5)
            try:
                server.send_message(msg)
            finally:
                try:
                    server.quit()
                except Exception:
                    pass

            return f"Email successfully sent to '{clean_to}' with subject '{subject}' (via Gmail SMTP port {port_used})."

        except smtplib.SMTPAuthenticationError:
            return (
                f"Failed to send email to '{clean_to}': Authentication failed for '{email_user}'. "
                f"Invalid Google App Password. Please generate a 16-character App Password at "
                f"https://myaccount.google.com/apppasswords and update your server settings."
            )
        except smtplib.SMTPRecipientsRefused:
            return (
                f"Failed to send email to '{clean_to}': Recipient rejected. "
                f"Gmail SMTP rejected destination address '{clean_to}'. Please verify the recipient address."
            )
        except (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError, socket.timeout, TimeoutError, ConnectionRefusedError, OSError):
            return (
                f"Failed to send email to '{clean_to}': SMTP is blocked on this host (for example Render free plan). "
                f"Set EMAIL_PROVIDER=brevo or resend and an API key."
            )
        except Exception as e:
            err_str = str(e)
            if "timeout" in err_str.lower() or "blocked" in err_str.lower() or "101" in err_str or "unreachable" in err_str.lower():
                return (
                    f"Failed to send email to '{clean_to}': SMTP is blocked on this host (for example Render free plan). "
                    f"Set EMAIL_PROVIDER=brevo or resend and an API key."
                )
            return f"Failed to send email to '{clean_to}': {err_str}"
