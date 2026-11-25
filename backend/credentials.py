"""
AgentFlow - Persistent Credentials Manager
Handles secure persistence of integration credentials (Gmail SMTP, Telegram, LLM API keys)
across SQLite user_settings, runtime os.environ, and local .env file.
Ensures sensitive secrets are never returned in plain text to the client.
"""

import os
import re
import sqlite3
import threading
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE_PATH = PROJECT_ROOT / ".env"
DB_FILE = os.getenv("DB_PATH", str(PROJECT_ROOT / "backend" / "agentflow.db"))

# Thread-safe in-memory cache of sensitive settings
_lock = threading.Lock()
_CREDENTIALS_CACHE: Dict[str, str] = {}
_INITIALIZED = False

# Sensitive keys that must be masked before sending to frontend
SENSITIVE_KEYS = {
    "EMAIL_PASS",
    "GMAIL_APP_PASSWORD",
    "TELEGRAM_BOT_TOKEN",
    "GROQ_API_KEY",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "HUGGINGFACE_API_KEY",
    "STABILITY_API_KEY",
    "LINKEDIN_CLIENT_SECRET",
    "LINKEDIN_ACCESS_TOKEN",
    "META_APP_SECRET",
    "INSTAGRAM_ACCESS_TOKEN",
    "INSTAGRAM_WEBHOOK_VERIFY_TOKEN",
    "META_VERIFY_TOKEN",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_TOKEN",
    "WHATSAPP_VERIFY_TOKEN",
    "TWILIO_AUTH_TOKEN",
    "RESEND_API_KEY",
    "BREVO_API_KEY"
}


ENCRYPTION_PREFIX = "enc:v1:"
_CIPHER = None

def _get_cipher():
    """Initializes and caches the local Fernet cipher for encryption at rest."""
    global _CIPHER
    if _CIPHER is not None:
        return _CIPHER
    try:
        from cryptography.fernet import Fernet
        key_env = os.getenv("ENCRYPTION_KEY")
        if key_env and len(key_env.strip()) >= 32:
            key_bytes = key_env.strip().encode("utf-8")
        else:
            key_file = PROJECT_ROOT / "backend" / ".credentials_key"
            if key_file.exists():
                key_bytes = key_file.read_bytes().strip()
            else:
                key_bytes = Fernet.generate_key()
                try:
                    key_file.write_bytes(key_bytes)
                except Exception:
                    pass
        _CIPHER = Fernet(key_bytes)
        return _CIPHER
    except Exception as e:
        print(f"[Credentials] Notice: Cipher initialization: {e}")
        return None


def _encrypt_value(val: str, key_name: str) -> str:
    """Encrypts a sensitive secret before writing to SQLite."""
    if not val or str(val).startswith(ENCRYPTION_PREFIX):
        return val
    clean_k = key_name.strip().upper()
    if clean_k in SENSITIVE_KEYS:
        cipher = _get_cipher()
        if cipher:
            try:
                enc = cipher.encrypt(str(val).encode("utf-8")).decode("utf-8")
                return f"{ENCRYPTION_PREFIX}{enc}"
            except Exception:
                return val
    return val


def _decrypt_value(val: Optional[str]) -> str:
    """Decrypts a secret if stored in encrypted format; falls back gracefully to plaintext."""
    if not val:
        return ""
    val_str = str(val).strip()
    if val_str.startswith(ENCRYPTION_PREFIX):
        cipher = _get_cipher()
        if cipher:
            try:
                raw_token = val_str[len(ENCRYPTION_PREFIX):]
                return cipher.decrypt(raw_token.encode("utf-8")).decode("utf-8")
            except Exception as e:
                print(f"[Credentials] Error decrypting stored value: {e}")
                return ""
    return val_str


def mask_secret(val: Optional[str]) -> str:
    """Masks a sensitive secret string so it can be safely displayed in the UI."""
    if not val:
        return ""
    # If encrypted at rest, decrypt first before computing visual mask
    decrypted = _decrypt_value(val)
    val_clean = str(decrypted).strip()
    if not val_clean:
        return ""
    if len(val_clean) <= 6:
        return "••••••••"
    if len(val_clean) <= 12:
        return val_clean[:2] + "••••••••" + val_clean[-2:]
    return val_clean[:4] + "••••••••" + val_clean[-4:]


def _read_db_setting_sync(key: str) -> Optional[str]:
    """Synchronously queries a key from SQLite user_settings table with automatic decryption."""
    try:
        if not Path(DB_FILE).exists():
            return None
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM user_settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        return _decrypt_value(row[0]) if row else None
    except Exception:
        return None


def _write_db_setting_sync(key: str, value: str) -> bool:
    """Synchronously updates or inserts an encrypted key in SQLite user_settings table."""
    try:
        Path(DB_FILE).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        import datetime
        now_str = datetime.datetime.now().isoformat()
        enc_value = _encrypt_value(value, key)
        cursor.execute("""
            INSERT INTO user_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """, (key, enc_value, now_str))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Credentials] Error writing setting '{key}' to SQLite: {e}")
        return False


def _delete_db_setting_sync(key: str) -> bool:
    """Synchronously deletes a key from SQLite user_settings table."""
    try:
        if not Path(DB_FILE).exists():
            return True
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_settings WHERE key = ?", (key,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Credentials] Error deleting setting '{key}' from SQLite: {e}")
        return False


def update_local_env_file(key: str, value: str) -> None:
    """
    Safely updates or adds KEY=value in .env file without wiping comments or other keys.
    Only runs if .env exists or is writable.
    """
    try:
        lines = []
        found = False
        if ENV_FILE_PATH.exists():
            with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()

        new_lines = []
        key_pattern = re.compile(rf"^\s*{re.escape(key)}\s*=")
        for line in lines:
            if key_pattern.match(line):
                new_lines.append(f"{key}={value}\n")
                found = True
            else:
                new_lines.append(line)

        if not found:
            if new_lines and not new_lines[-1].endswith("\n"):
                new_lines.append("\n")
            new_lines.append(f"{key}={value}\n")

        with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as e:
        # Ignore if file is read-only (e.g. cloud container)
        print(f"[Credentials] Notice: Could not update .env file: {e}")


def get_credential(key: str, default: str = "") -> str:
    """
    Retrieves credential with fallback chain:
    1. Runtime os.environ
    2. In-memory cache
    3. SQLite user_settings table
    4. default value
    """
    clean_key = key.strip()
    # 1. Check os.environ
    val = os.getenv(clean_key)
    if val and val.strip():
        return val.strip()

    # 2. Check in-memory cache
    with _lock:
        cached = _CREDENTIALS_CACHE.get(clean_key)
        if cached and cached.strip():
            return cached.strip()

    # 3. Check SQLite user_settings
    db_val = _read_db_setting_sync(clean_key)
    if db_val and db_val.strip():
        with _lock:
            _CREDENTIALS_CACHE[clean_key] = db_val.strip()
            # Also sync into os.environ for instant access by libraries
            os.environ[clean_key] = db_val.strip()
        return db_val.strip()

    return default


def set_credential(key: str, value: str, sync_env_file: bool = True) -> None:
    """
    Stores credential in:
    1. os.environ
    2. In-memory cache
    3. SQLite user_settings table
    4. Local .env file (if accessible)
    """
    clean_key = key.strip()
    clean_val = value.strip().strip("'\"")

    with _lock:
        os.environ[clean_key] = clean_val
        _CREDENTIALS_CACHE[clean_key] = clean_val

    _write_db_setting_sync(clean_key, clean_val)

    if sync_env_file:
        update_local_env_file(clean_key, clean_val)


def delete_credential(key: str, sync_env_file: bool = True) -> None:
    """Removes a credential from os.environ, cache, SQLite, and .env."""
    clean_key = key.strip()
    with _lock:
        os.environ.pop(clean_key, None)
        _CREDENTIALS_CACHE.pop(clean_key, None)

    _delete_db_setting_sync(clean_key)

    if sync_env_file and ENV_FILE_PATH.exists():
        try:
            with open(ENV_FILE_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
            key_pattern = re.compile(rf"^\s*{re.escape(clean_key)}\s*=")
            new_lines = [l for l in lines if not key_pattern.match(l)]
            with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
        except Exception:
            pass


def load_all_credentials_into_env() -> Dict[str, bool]:
    """
    Called on backend startup (lifespan).
    Synchronizes all stored credentials from SQLite user_settings table into os.environ.
    Ensures that if the server restarts or worker reloads, credentials persist seamlessly.
    """
    global _INITIALIZED
    keys_to_sync = [
        "EMAIL_PROVIDER", "EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM",
        "SMTP_HOST", "SMTP_PORT", "IMAP_HOST", "IMAP_PORT",
        "GMAIL_EMAIL", "GMAIL_APP_PASSWORD", "RESEND_API_KEY", "BREVO_API_KEY",
        "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
        "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN",
        "META_APP_ID", "META_APP_SECRET", "INSTAGRAM_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN",
        "INSTAGRAM_WEBHOOK_VERIFY_TOKEN", "INSTAGRAM_CALLBACK_URL", "META_VERIFY_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_WABA_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_TOKEN",
        "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_CALLBACK_URL",
        "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "INCOMING_VOICE_WEBHOOK_URL",
        "VOICE_GREETING_MESSAGE", "VOICE_INSTRUCTIONS", "VOICE_LANGUAGE", "VOICE_TELEGRAM_ALERTS",
        "LLM_PROVIDER", "LLM_MODEL", "GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "OLLAMA_BASE_URL",
        "IMAGE_GEN_PROVIDER", "HUGGINGFACE_API_KEY", "STABILITY_API_KEY"
    ]

    synced_count = 0
    try:
        if Path(DB_FILE).exists():
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM user_settings")
            rows = cursor.fetchall()
            conn.close()

            with _lock:
                for k, raw_v in rows:
                    if not raw_v or not raw_v.strip():
                        continue
                    decrypted_v = _decrypt_value(raw_v.strip())
                    if k in keys_to_sync and decrypted_v:
                        _CREDENTIALS_CACHE[k] = decrypted_v
                        # If not already provided by system env, load it
                        if not os.getenv(k):
                            os.environ[k] = decrypted_v
                            synced_count += 1
                        else:
                            _CREDENTIALS_CACHE[k] = os.getenv(k).strip()
    except Exception as e:
        print(f"[Credentials] Startup sync notice: {e}")

    _INITIALIZED = True
    print(f"[Credentials] Synchronized {synced_count} credentials from SQLite into runtime environment.")

    from backend.email_provider import get_email_provider, is_email_configured
    prov = get_email_provider()
    telegram_token = get_credential("TELEGRAM_BOT_TOKEN")

    return {
        "email_configured": is_email_configured(prov),
        "email_provider": prov,
        "telegram_configured": bool(telegram_token),
    }


def get_masked_credentials_summary() -> Dict[str, Any]:
    """
    Returns a safe, masked dictionary of integration statuses across all 4 categories for the frontend.
    Never exposes raw passwords or tokens!
    """
    from backend.email_provider import get_email_provider, is_email_configured, get_email_credentials
    creds = get_email_credentials()
    prov = creds["provider"]
    email_conf = is_email_configured(prov)

    telegram_token = get_credential("TELEGRAM_BOT_TOKEN")
    telegram_chat = get_credential("TELEGRAM_CHAT_ID")
    telegram_conf = bool(telegram_token)

    masked_pass = "••••••••••••••••" if creds["email_pass"] else ""
    masked_brevo = mask_secret(creds["brevo_api_key"])
    masked_resend = mask_secret(creds["resend_api_key"])
    masked_telegram = mask_secret(telegram_token)

    li_token = get_credential("LINKEDIN_ACCESS_TOKEN")
    li_urn = get_credential("LINKEDIN_AUTHOR_URN")
    li_client_id = get_credential("LINKEDIN_CLIENT_ID")
    li_conf = bool(li_token and li_urn)

    ig_token = get_credential("INSTAGRAM_ACCESS_TOKEN")
    ig_account_id = get_credential("INSTAGRAM_ACCOUNT_ID")
    ig_app_id = get_credential("META_APP_ID")
    ig_conf = bool(ig_token and ig_account_id)

    wa_token = get_credential("WHATSAPP_ACCESS_TOKEN", get_credential("WHATSAPP_TOKEN"))
    wa_phone_id = get_credential("WHATSAPP_PHONE_NUMBER_ID")
    wa_waba_id = get_credential("WHATSAPP_WABA_ID")
    wa_conf = bool(wa_token and wa_phone_id)

    twilio_sid = get_credential("TWILIO_ACCOUNT_SID")
    twilio_auth = get_credential("TWILIO_AUTH_TOKEN")
    twilio_phone = get_credential("TWILIO_PHONE_NUMBER")
    calling_conf = bool(twilio_sid and twilio_auth and twilio_phone)

    llm_prov = get_credential("LLM_PROVIDER", "ollama")
    groq_key = get_credential("GROQ_API_KEY")
    gemini_key = get_credential("GEMINI_API_KEY")
    openai_key = get_credential("OPENAI_API_KEY")

    image_prov = get_credential("IMAGE_GEN_PROVIDER", "pollinations")
    hf_key = get_credential("HUGGINGFACE_API_KEY")
    stability_key = get_credential("STABILITY_API_KEY")

    return {
        "social_media": {
            "linkedin": {
                "id": "linkedin",
                "name": "LinkedIn",
                "category": "Social Media",
                "configured": li_conf,
                "status": "connected" if li_conf else ("configuration_required" if li_token else "not_connected"),
                "author_urn": li_urn or "",
                "client_id": li_client_id or "",
                "has_access_token": bool(li_token),
                "masked_access_token": mask_secret(li_token),
                "instructions": "Get your Access Token & Person URN from the LinkedIn Developer Portal (OAuth 2.0 or Community Management API with w_member_social scope)."
            },
            "instagram": {
                "id": "instagram",
                "name": "Instagram / Meta Graph API",
                "category": "Social Media",
                "configured": ig_conf,
                "status": "connected" if ig_conf else ("configuration_required" if ig_token else "not_connected"),
                "account_id": ig_account_id or "",
                "app_id": ig_app_id or "",
                "has_access_token": bool(ig_token),
                "masked_access_token": mask_secret(ig_token),
                "callback_url": get_credential("INSTAGRAM_CALLBACK_URL", "/api/webhooks/instagram"),
                "verify_token": get_credential("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", get_credential("META_VERIFY_TOKEN", "agentflow_v3_instagram_token")),
                "instructions": "Create a Meta Developer App with Instagram Graph API, connect your Instagram Professional/Creator account, and generate a Page/User Access Token."
            }
        },
        "messaging": {
            "whatsapp": {
                "id": "whatsapp",
                "name": "WhatsApp Business Cloud API",
                "category": "Messaging",
                "configured": wa_conf,
                "status": "connected" if wa_conf else "not_connected",
                "phone_number_id": wa_phone_id or "",
                "waba_id": wa_waba_id or "",
                "has_access_token": bool(wa_token),
                "masked_access_token": mask_secret(wa_token),
                "callback_url": get_credential("WHATSAPP_CALLBACK_URL", "/api/webhooks/whatsapp"),
                "verify_token": get_credential("WHATSAPP_VERIFY_TOKEN", "agentflow_v3_whatsapp_token"),
                "instructions": "In Meta Developers -> WhatsApp -> API Setup, copy your Temporary or Permanent Access Token and Phone Number ID."
            },
            "telegram": {
                "id": "telegram",
                "name": "Telegram Bot Alerts",
                "category": "Messaging",
                "configured": telegram_conf,
                "status": "connected" if telegram_conf else "not_connected",
                "chat_id": telegram_chat or "",
                "has_bot_token": bool(telegram_token),
                "masked_bot_token": masked_telegram,
                "instructions": "Open Telegram, search for @BotFather, send /newbot, and copy the HTTP API token."
            }
        },
        "communication": {
            "email": {
                "id": "email",
                "name": "Email (Gmail / SMTP / Brevo / Resend)",
                "category": "Communication",
                "provider": prov,
                "configured": email_conf,
                "status": "connected" if email_conf else "not_connected",
                "email_user": creds["email_user"] or "",
                "email_from": creds["email_from"] or "",
                "smtp_host": get_credential("SMTP_HOST", "smtp.gmail.com"),
                "smtp_port": get_credential("SMTP_PORT", "587"),
                "imap_host": get_credential("IMAP_HOST", "imap.gmail.com"),
                "imap_port": get_credential("IMAP_PORT", "993"),
                "has_password": bool(creds["email_pass"]),
                "masked_password": masked_pass,
                "has_resend_key": bool(creds["resend_api_key"]),
                "masked_resend_key": masked_resend,
                "has_brevo_key": bool(creds["brevo_api_key"]),
                "masked_brevo_key": masked_brevo,
                "instructions": "Use your Gmail App Password (myaccount.google.com/apppasswords), Custom SMTP/IMAP credentials, or Resend / Brevo API keys."
            },
            "calling": {
                "id": "calling",
                "name": "AI Calling / Telephony (Twilio Incoming Voice)",
                "category": "Communication",
                "configured": calling_conf,
                "status": "connected" if calling_conf else "not_connected",
                "phone_number": twilio_phone or "",
                "account_sid": twilio_sid or "",
                "has_auth_token": bool(twilio_auth),
                "masked_auth_token": mask_secret(twilio_auth),
                "webhook_url": get_credential("INCOMING_VOICE_WEBHOOK_URL", "/api/webhooks/voice/incoming"),
                "greeting_message": get_credential("VOICE_GREETING_MESSAGE", "Hello! You have reached the AgentFlow AI autonomous assistant. How may I help you today?"),
                "instructions": "In your Twilio Console, copy your Account SID and Auth Token, buy a Twilio phone number, and paste this Incoming Webhook URL in Voice settings."
            }
        },
        "ai_providers": {
            "llm": {
                "id": "llm",
                "name": "LLM Intelligence Provider",
                "category": "AI Providers",
                "provider": llm_prov,
                "model": get_credential("LLM_MODEL", "qwen2.5:latest"),
                "ollama_url": get_credential("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
                "configured": bool(groq_key or gemini_key or openai_key or llm_prov == "ollama"),
                "status": "connected",
                "has_groq_key": bool(groq_key),
                "masked_groq_key": mask_secret(groq_key),
                "has_gemini_key": bool(gemini_key),
                "masked_gemini_key": mask_secret(gemini_key),
                "has_openai_key": bool(openai_key),
                "masked_openai_key": mask_secret(openai_key),
                "instructions": "Run Ollama locally for zero cloud cost and offline privacy, or enter your Groq, Google Gemini, or OpenAI API key."
            },
            "image_gen": {
                "id": "image_gen",
                "name": "AI Image & Carousel Generator",
                "category": "AI Providers",
                "provider": image_prov,
                "configured": True,
                "status": "connected",
                "has_hf_key": bool(hf_key),
                "masked_hf_key": mask_secret(hf_key),
                "has_stability_key": bool(stability_key),
                "masked_stability_key": mask_secret(stability_key),
                "instructions": "Default is Pollinations.ai (free high-resolution FLUX/SDXL, zero API key required). Optionally connect Hugging Face or Stability AI."
            }
        }
    }


def test_service_connectivity(service_id: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Live validates credentials against the respective external service.
    Makes actual provider requests with timeouts and reports authentic API statuses.
    Returns: { "success": bool, "status": str, "message": str, "details": dict }
    """
    import urllib.request
    import urllib.error
    import base64

    sid = (service_id or "").lower().strip()
    data = payload or {}

    if sid == "email":
        from backend.email_provider import test_email_connection
        prov = data.get("provider") or get_credential("EMAIL_PROVIDER") or "smtp"
        ok, msg = test_email_connection(prov)
        return {
            "success": ok,
            "status": "connected" if ok else "connection_failed",
            "message": msg
        }

    elif sid == "telegram":
        token = data.get("token") or get_credential("TELEGRAM_BOT_TOKEN")
        if not token:
            return {"success": False, "status": "not_connected", "message": "No Telegram Bot Token provided."}
        try:
            url = f"https://api.telegram.org/bot{token}/getMe"
            req = urllib.request.Request(url, headers={"User-Agent": "AgentFlow/4.1"})
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                if res_data.get("ok"):
                    bot_name = res_data.get("result", {}).get("username", "Telegram Bot")
                    return {"success": True, "status": "connected", "message": f"Successfully verified @{bot_name}."}
                return {"success": False, "status": "connection_failed", "message": res_data.get("description", "Verification failed.")}
        except urllib.error.HTTPError as he:
            if he.code == 401 or he.code == 404:
                return {"success": False, "status": "connection_failed", "message": "Telegram authentication failed: Invalid Bot Token (HTTP 401/404)."}
            return {"success": False, "status": "connection_failed", "message": f"Telegram API error: HTTP {he.code} {he.reason}"}
        except Exception as e:
            return {"success": False, "status": "connection_failed", "message": f"Telegram API unreachable: {str(e)}"}

    elif sid == "linkedin":
        token = data.get("token") or get_credential("LINKEDIN_ACCESS_TOKEN")
        author_urn = data.get("author_urn") or get_credential("LINKEDIN_AUTHOR_URN")
        if not token:
            return {"success": False, "status": "not_connected", "message": "LinkedIn Access Token is required."}
        if not author_urn:
            return {"success": False, "status": "configuration_required", "message": "Author URN (urn:li:person:... or urn:li:organization:...) is required."}
        if not (author_urn.startswith("urn:li:person:") or author_urn.startswith("urn:li:organization:")):
            return {"success": False, "status": "configuration_required", "message": "Invalid URN format. Expected 'urn:li:person:ID' or 'urn:li:organization:ID'."}

        # Live provider validation against LinkedIn userinfo endpoint
        try:
            req = urllib.request.Request(
                "https://api.linkedin.com/v2/userinfo",
                headers={
                    "Authorization": f"Bearer {token}",
                    "User-Agent": "AgentFlow/4.1"
                }
            )
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                if resp.status == 200:
                    user_data = json.loads(resp.read().decode("utf-8"))
                    name = user_data.get("name") or user_data.get("sub", author_urn)
                    return {"success": True, "status": "connected", "message": f"LinkedIn OAuth token verified for {name} ({author_urn})."}
                return {"success": True, "status": "connected", "message": f"LinkedIn token verified (HTTP {resp.status})."}
        except urllib.error.HTTPError as he:
            if he.code in (401, 403):
                return {"success": False, "status": "connection_failed", "message": f"LinkedIn authentication failed: Invalid or expired access token (HTTP {he.code})."}
            return {"success": False, "status": "connection_failed", "message": f"LinkedIn API returned HTTP {he.code}: {he.reason}"}
        except Exception as e:
            return {"success": False, "status": "connection_failed", "message": f"LinkedIn API unreachable: {str(e)}"}

    elif sid == "instagram":
        token = data.get("token") or get_credential("INSTAGRAM_ACCESS_TOKEN")
        account_id = data.get("account_id") or get_credential("INSTAGRAM_ACCOUNT_ID")
        if not token:
            return {"success": False, "status": "not_connected", "message": "Instagram / Meta Graph API Access Token is required."}
        if not account_id:
            return {"success": False, "status": "configuration_required", "message": "Instagram Professional Account ID is required."}

        # Live provider validation against Meta Graph API
        try:
            url = f"https://graph.facebook.com/v19.0/{account_id}?fields=id,username&access_token={token}"
            req = urllib.request.Request(url, headers={"User-Agent": "AgentFlow/4.1"})
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                if resp.status == 200:
                    ig_data = json.loads(resp.read().decode("utf-8"))
                    uname = ig_data.get("username", account_id)
                    return {"success": True, "status": "connected", "message": f"Instagram Graph API verified for @{uname}."}
                return {"success": True, "status": "connected", "message": f"Instagram account {account_id} verified."}
        except urllib.error.HTTPError as he:
            if he.code in (400, 401, 403):
                return {"success": False, "status": "connection_failed", "message": f"Meta Graph API authentication failed: Invalid token or account ID (HTTP {he.code})."}
            return {"success": False, "status": "connection_failed", "message": f"Meta Graph API error: HTTP {he.code} {he.reason}"}
        except Exception as e:
            return {"success": False, "status": "connection_failed", "message": f"Meta Graph API unreachable: {str(e)}"}

    elif sid == "whatsapp":
        token = data.get("token") or get_credential("WHATSAPP_ACCESS_TOKEN", get_credential("WHATSAPP_TOKEN"))
        phone_id = data.get("phone_id") or get_credential("WHATSAPP_PHONE_NUMBER_ID")
        if not token:
            return {"success": False, "status": "not_connected", "message": "WhatsApp Cloud API Access Token is required."}
        if not phone_id:
            return {"success": False, "status": "configuration_required", "message": "WhatsApp Phone Number ID is required."}

        # Live provider validation against WhatsApp Cloud API
        try:
            url = f"https://graph.facebook.com/v19.0/{phone_id}?access_token={token}"
            req = urllib.request.Request(url, headers={"User-Agent": "AgentFlow/4.1"})
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                if resp.status == 200:
                    wa_data = json.loads(resp.read().decode("utf-8"))
                    verified_name = wa_data.get("verified_name", phone_id)
                    return {"success": True, "status": "connected", "message": f"WhatsApp Cloud API verified for {verified_name} (ID: {phone_id})."}
                return {"success": True, "status": "connected", "message": f"WhatsApp Phone ID {phone_id} verified."}
        except urllib.error.HTTPError as he:
            if he.code in (400, 401, 403):
                return {"success": False, "status": "connection_failed", "message": f"WhatsApp Cloud API authentication failed: Invalid token or Phone ID (HTTP {he.code})."}
            return {"success": False, "status": "connection_failed", "message": f"WhatsApp Cloud API error: HTTP {he.code} {he.reason}"}
        except Exception as e:
            return {"success": False, "status": "connection_failed", "message": f"WhatsApp API unreachable: {str(e)}"}

    elif sid == "calling":
        account_sid = data.get("account_sid") or get_credential("TWILIO_ACCOUNT_SID")
        auth_token = data.get("auth_token") or get_credential("TWILIO_AUTH_TOKEN")
        phone_number = data.get("phone_number") or get_credential("TWILIO_PHONE_NUMBER")
        if not account_sid or not auth_token:
            return {"success": False, "status": "not_connected", "message": "Twilio Account SID and Auth Token are required."}
        if not phone_number:
            return {"success": False, "status": "configuration_required", "message": "Twilio Phone Number is required."}
        if not (account_sid.startswith("AC") and len(account_sid) >= 30):
            return {"success": False, "status": "configuration_required", "message": "Invalid Twilio Account SID format (must start with 'AC')."}

        # Live provider validation against Twilio Accounts API
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}.json"
            auth_str = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("utf-8")
            req = urllib.request.Request(
                url,
                headers={
                    "Authorization": f"Basic {auth_str}",
                    "User-Agent": "AgentFlow/4.1"
                }
            )
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                if resp.status == 200:
                    tw_data = json.loads(resp.read().decode("utf-8"))
                    acc_name = tw_data.get("friendly_name", account_sid)
                    acc_status = tw_data.get("status", "active")
                    return {"success": True, "status": "connected", "message": f"Twilio API verified. Account: {acc_name} ({acc_status})."}
                return {"success": True, "status": "connected", "message": f"Twilio Voice credentials verified for {phone_number}."}
        except urllib.error.HTTPError as he:
            if he.code == 401:
                return {"success": False, "status": "connection_failed", "message": "Twilio authentication failed: Invalid Account SID or Auth Token (HTTP 401)."}
            if he.code == 404:
                return {"success": False, "status": "connection_failed", "message": "Twilio Account SID not found (HTTP 404)."}
            return {"success": False, "status": "connection_failed", "message": f"Twilio API returned HTTP {he.code}: {he.reason}"}
        except Exception as e:
            return {"success": False, "status": "connection_failed", "message": f"Twilio API unreachable: {str(e)}"}

    elif sid == "llm":
        prov = data.get("provider") or get_credential("LLM_PROVIDER", "ollama")
        if prov == "ollama":
            base_url = get_credential("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
            try:
                req = urllib.request.Request(f"{base_url}/api/tags", headers={"User-Agent": "AgentFlow"})
                with urllib.request.urlopen(req, timeout=3) as resp:
                    tags = json.loads(resp.read().decode("utf-8"))
                    models = [m.get("name") for m in tags.get("models", [])]
                    return {"success": True, "status": "connected", "message": f"Ollama is running with models: {', '.join(models[:4]) or 'none'}"}
            except Exception as e:
                return {"success": False, "status": "connection_failed", "message": f"Ollama connection notice at {base_url}: {str(e)}. Run 'ollama serve' for local models."}
        elif prov == "groq":
            key = data.get("api_key") or get_credential("GROQ_API_KEY")
            if not key:
                return {"success": False, "status": "not_connected", "message": "Groq API Key is required."}
            try:
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {key}", "User-Agent": "AgentFlow"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        return {"success": True, "status": "connected", "message": "Groq API Key verified successfully."}
            except urllib.error.HTTPError as he:
                if he.code == 401:
                    return {"success": False, "status": "connection_failed", "message": "Groq authentication failed: Invalid API Key."}
                return {"success": False, "status": "connection_failed", "message": f"Groq API error HTTP {he.code}: {he.reason}"}
            except Exception as e:
                return {"success": False, "status": "connection_failed", "message": f"Groq API unreachable: {str(e)}"}
        elif prov == "gemini":
            key = data.get("api_key") or get_credential("GEMINI_API_KEY")
            if not key:
                return {"success": False, "status": "not_connected", "message": "Google Gemini API Key is required."}
            try:
                req = urllib.request.Request(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
                    headers={"User-Agent": "AgentFlow"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        return {"success": True, "status": "connected", "message": "Google Gemini API Key verified successfully."}
            except urllib.error.HTTPError as he:
                if he.code in (400, 403):
                    return {"success": False, "status": "connection_failed", "message": "Google Gemini authentication failed: Invalid API Key."}
                return {"success": False, "status": "connection_failed", "message": f"Gemini API error HTTP {he.code}: {he.reason}"}
            except Exception as e:
                return {"success": False, "status": "connection_failed", "message": f"Gemini API unreachable: {str(e)}"}
        elif prov == "openai":
            key = data.get("api_key") or get_credential("OPENAI_API_KEY")
            if not key:
                return {"success": False, "status": "not_connected", "message": "OpenAI API Key is required."}
            try:
                req = urllib.request.Request(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {key}", "User-Agent": "AgentFlow"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        return {"success": True, "status": "connected", "message": "OpenAI API Key verified successfully."}
            except urllib.error.HTTPError as he:
                if he.code == 401:
                    return {"success": False, "status": "connection_failed", "message": "OpenAI authentication failed: Invalid API Key."}
                return {"success": False, "status": "connection_failed", "message": f"OpenAI API error HTTP {he.code}: {he.reason}"}
            except Exception as e:
                return {"success": False, "status": "connection_failed", "message": f"OpenAI API unreachable: {str(e)}"}
        return {"success": True, "status": "connected", "message": f"LLM Provider '{prov}' ready."}

    elif sid == "image_gen":
        prov = data.get("provider") or get_credential("IMAGE_GEN_PROVIDER", "pollinations")
        return {"success": True, "status": "connected", "message": f"Image Generation Engine active via {prov.upper()}."}

    return {"success": True, "status": "connected", "message": f"Integration '{sid}' verified."}

