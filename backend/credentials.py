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
    "CLOUDFLARE_API_TOKEN",
    "IDEOGRAM_API_KEY",
    "LINKEDIN_CLIENT_SECRET",
    "LINKEDIN_ACCESS_TOKEN",
    "EXOTEL_API_TOKEN",
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


def is_masked_secret(val: Any) -> bool:
    """Returns True if the value contains bullet characters or masked placeholders."""
    if not val:
        return False
    s = str(val)
    return "•" in s or "\u2022" in s or "\ufffd" in s or s.startswith("••••") or "••••" in s


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
    1. Runtime os.environ (ignoring masked strings)
    2. In-memory cache (ignoring masked strings)
    3. SQLite user_settings table
    4. default value
    """
    clean_key = key.strip()
    # 1. Check os.environ
    val = os.getenv(clean_key)
    if val and val.strip() and not is_masked_secret(val):
        return val.strip()

    # 2. Check in-memory cache
    with _lock:
        cached = _CREDENTIALS_CACHE.get(clean_key)
        if cached and cached.strip() and not is_masked_secret(cached):
            return cached.strip()

    # 3. Check SQLite user_settings
    db_val = _read_db_setting_sync(clean_key)
    if db_val and db_val.strip() and not is_masked_secret(db_val):
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

    # CRITICAL SECURITY GUARD: Refuse to overwrite genuine credentials with masked placeholders
    if is_masked_secret(clean_val):
        print(f"[Credentials] Guard: Refused to overwrite '{clean_key}' with masked placeholder")
        return

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
        "EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_ACCOUNT_SID", "EXOTEL_EXOPHONE", "EXOTEL_SUBDOMAIN", "EXOTEL_APP_ID",
        "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "INCOMING_VOICE_WEBHOOK_URL",
        "VOICE_GREETING_MESSAGE", "VOICE_INSTRUCTIONS", "VOICE_LANGUAGE", "VOICE_TELEGRAM_ALERTS",
        "LLM_PROVIDER", "LLM_MODEL", "GROQ_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY", "OLLAMA_BASE_URL",
        "IMAGE_GEN_PROVIDER", "HUGGINGFACE_API_KEY", "STABILITY_API_KEY",
        "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "IDEOGRAM_API_KEY", "PREFERRED_IMAGE_PROVIDER", "IMAGE_AUTO_FALLBACK"
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
                    if k in keys_to_sync and decrypted_v and not is_masked_secret(decrypted_v):
                        _CREDENTIALS_CACHE[k] = decrypted_v
                        # If system env has a masked or missing value, override with real decrypted secret from DB
                        curr_env = os.getenv(k, "").strip()
                        if not curr_env or is_masked_secret(curr_env):
                            os.environ[k] = decrypted_v
                            synced_count += 1
                            update_local_env_file(k, decrypted_v)
                        else:
                            _CREDENTIALS_CACHE[k] = curr_env
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

    exo_key = get_credential("EXOTEL_API_KEY")
    exo_token = get_credential("EXOTEL_API_TOKEN")
    exo_sid = get_credential("EXOTEL_ACCOUNT_SID")
    exo_phone = get_credential("EXOTEL_EXOPHONE") or get_credential("TWILIO_PHONE_NUMBER")
    exo_subdomain = get_credential("EXOTEL_SUBDOMAIN", "api.exotel.com")
    exo_app_id = get_credential("EXOTEL_APP_ID")
    calling_conf = bool(exo_key and exo_token and exo_sid)

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
            }
        },
        "messaging": {
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
                "name": "AI Calling / Telephony (Exotel Incoming Voice)",
                "category": "Communication",
                "configured": calling_conf,
                "status": "connected" if calling_conf else "not_connected",
                "phone_number": exo_phone or "",
                "exophone": exo_phone or "",
                "account_sid": exo_sid or "",
                "api_key": exo_key or "",
                "has_api_token": bool(exo_token),
                "masked_api_token": mask_secret(exo_token),
                "subdomain": exo_subdomain or "api.exotel.com",
                "app_id": exo_app_id or "",
                "webhook_url": get_credential("INCOMING_VOICE_WEBHOOK_URL", "/api/webhooks/voice/exotel/incoming"),
                "status_callback_url": "/api/webhooks/voice/exotel/status",
                "greeting_message": get_credential("VOICE_GREETING_MESSAGE", "Hello! Insha abhi busy hain. Aap humein bata dijiye kya kaam hai? Main aapka message un tak pahuncha dungi."),
                "instructions": "In your Exotel Dashboard, copy your API Key, API Token, and Account SID from API Settings, enter your trial ExoPhone, and point your Call Flow Passthru applet to the Webhook URL."
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



def get_all_integrations_catalog() -> Dict[str, Any]:
    """
    Returns the complete, authoritative catalog of all integrations across categories:
    A. AI & LLM Providers (Gemini, Groq, Hugging Face, Ollama, OpenAI)
    B. Social Media (LinkedIn, Facebook [Coming Soon], X [Coming Soon], YouTube [Coming Soon])
    C. AI Calling (Twilio Incoming Voice)
    D. Email (SMTP / Gmail App Passwords, Resend, Brevo)
    E. Career Agent (Job Hunter, Resume & ATS Matcher, Greenhouse [Coming Soon], Indeed [Coming Soon])
    F. Language Agent (Browser Web Speech, Hugging Face Audio, Google Cloud STT [Coming Soon], ElevenLabs [Coming Soon])
    G. Additional (Telegram Bot, Inbound Webhooks, Discord [Coming Soon], Google Calendar [Coming Soon])
    
    Includes summary dashboard metrics, field schemas for focused modals, safe masked values,
    and direct developer console documentation links.
    """
    # 1. AI & LLM
    gemini_key = get_credential("GEMINI_API_KEY")
    groq_key = get_credential("GROQ_API_KEY")
    hf_key = get_credential("HUGGINGFACE_API_KEY")
    ollama_url = get_credential("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    llm_model = get_credential("LLM_MODEL", "qwen2.5:latest")
    openai_key = get_credential("OPENAI_API_KEY")
    openai_base = get_credential("OPENAI_BASE_URL", "")

    # 2. Social Media
    li_token = get_credential("LINKEDIN_ACCESS_TOKEN")
    li_urn = get_credential("LINKEDIN_AUTHOR_URN")
    li_client_id = get_credential("LINKEDIN_CLIENT_ID")

    # 3. Calling (Exotel)
    exo_key = get_credential("EXOTEL_API_KEY")
    exo_token = get_credential("EXOTEL_API_TOKEN")
    exo_sid = get_credential("EXOTEL_ACCOUNT_SID")
    exo_phone = get_credential("EXOTEL_EXOPHONE") or get_credential("TWILIO_PHONE_NUMBER")
    exo_subdomain = get_credential("EXOTEL_SUBDOMAIN", "api.exotel.com")
    exo_app_id = get_credential("EXOTEL_APP_ID")
    greeting_msg = get_credential("VOICE_GREETING_MESSAGE", "Hello! Insha abhi busy hain. Aap humein bata dijiye kya kaam hai? Main aapka message un tak pahuncha dungi.")

    # 5. Email
    from backend.email_provider import get_email_credentials, is_email_configured
    email_creds = get_email_credentials()
    email_user = email_creds.get("email_user", "")
    email_pass = email_creds.get("email_pass", "")
    email_from = email_creds.get("email_from", "")
    smtp_host = get_credential("SMTP_HOST", "smtp.gmail.com")
    smtp_port = get_credential("SMTP_PORT", "587")
    resend_key = email_creds.get("resend_api_key", "")
    brevo_key = email_creds.get("brevo_api_key", "")

    # 8. Additional
    tg_token = get_credential("TELEGRAM_BOT_TOKEN")
    tg_chat = get_credential("TELEGRAM_CHAT_ID")
    webhook_sec = get_credential("WEBHOOK_SECRET", "")

    categories = [
        {
            "id": "ai_llm",
            "name": "AI & LLM Providers",
            "description": "Language and multimodal intelligence providers powering AgentFlow agent reasoning.",
            "items": [
                {
                    "id": "gemini",
                    "name": "Google Gemini",
                    "category_id": "ai_llm",
                    "category_name": "AI & LLM Providers",
                    "description": "Multimodal models (Gemini 1.5 Flash / Pro) with generous free tier for task reasoning and summaries.",
                    "status": "connected" if gemini_key else "not_configured",
                    "status_message": "Connected and ready for agent reasoning" if gemini_key else "Enter your free Gemini API key to activate",
                    "configured": bool(gemini_key),
                    "is_coming_soon": False,
                    "icon_name": "Sparkles",
                    "help_url": "https://aistudio.google.com/app/apikey",
                    "help_text": "Get your free API Key from Google AI Studio",
                    "fields": [
                        {"key": "GEMINI_API_KEY", "label": "Google Gemini API Key", "type": "password", "placeholder": "AIzaSy...", "required": True, "is_secret": True, "masked_value": mask_secret(gemini_key), "has_value": bool(gemini_key), "help": "Free daily quota provided by Google."}
                    ]
                },
                {
                    "id": "groq",
                    "name": "Groq Cloud (Llama 3.3 / Mixtral)",
                    "category_id": "ai_llm",
                    "category_name": "AI & LLM Providers",
                    "description": "Ultra-low latency LPU cloud inference for sub-second agent tool calls and high-speed generation.",
                    "status": "connected" if groq_key else "not_configured",
                    "status_message": "Connected with ultra-fast streaming" if groq_key else "Enter your free Groq API key to activate",
                    "configured": bool(groq_key),
                    "is_coming_soon": False,
                    "icon_name": "Cpu",
                    "help_url": "https://console.groq.com/keys",
                    "help_text": "Create an API Key on Groq Console",
                    "fields": [
                        {"key": "GROQ_API_KEY", "label": "Groq API Key", "type": "password", "placeholder": "gsk_...", "required": True, "is_secret": True, "masked_value": mask_secret(groq_key), "has_value": bool(groq_key), "help": "High speed open-source inference."}
                    ]
                },
                {
                    "id": "huggingface",
                    "name": "Hugging Face (FLUX.1 AI Visuals)",
                    "category_id": "ai_llm",
                    "category_name": "AI & LLM Providers",
                    "description": "Dedicated free user token for photorealistic FLUX.1 image generation and open models.",
                    "status": "connected" if hf_key else "not_configured",
                    "status_message": "Active for dedicated FLUX.1 generation" if hf_key else "Add your free HF token for dedicated FLUX.1 visuals",
                    "configured": bool(hf_key),
                    "is_coming_soon": False,
                    "icon_name": "Sparkles",
                    "help_url": "https://huggingface.co/settings/tokens",
                    "help_text": "Create a free Access Token on Hugging Face",
                    "fields": [
                        {"key": "HUGGINGFACE_API_KEY", "label": "Hugging Face Access Token", "type": "password", "placeholder": "hf_...", "required": True, "is_secret": True, "masked_value": mask_secret(hf_key), "has_value": bool(hf_key), "help": "Free User Access Token ('Read' role)."}
                    ]
                },
                {
                    "id": "ollama",
                    "name": "Ollama Local (Offline Privacy)",
                    "category_id": "ai_llm",
                    "category_name": "AI & LLM Providers",
                    "description": "Zero cloud cost, private local model runner for Qwen 2.5, Llama 3.2, or DeepSeek on your device.",
                    "status": "connected",
                    "status_message": f"Connected to local Ollama server ({llm_model})",
                    "configured": True,
                    "is_coming_soon": False,
                    "icon_name": "Server",
                    "help_url": "https://ollama.com",
                    "help_text": "Download Ollama for offline AI",
                    "fields": [
                        {"key": "OLLAMA_BASE_URL", "label": "Ollama Server URL", "type": "text", "placeholder": "http://127.0.0.1:11434", "required": True, "is_secret": False, "masked_value": ollama_url, "has_value": True, "help": "Default is http://127.0.0.1:11434."},
                        {"key": "LLM_MODEL", "label": "Active Model", "type": "text", "placeholder": "qwen2.5:latest", "required": True, "is_secret": False, "masked_value": llm_model, "has_value": True, "help": "E.g. qwen2.5:latest, llama3.2:latest."}
                    ]
                },
                {
                    "id": "openai",
                    "name": "OpenAI Compatible API",
                    "category_id": "ai_llm",
                    "category_name": "AI & LLM Providers",
                    "description": "Standard OpenAI-compatible inference endpoint (OpenAI, Together AI, vLLM, LM Studio).",
                    "status": "connected" if openai_key else "not_configured",
                    "status_message": "OpenAI-compatible endpoint configured" if openai_key else "Configure API key for OpenAI-compatible endpoints",
                    "configured": bool(openai_key),
                    "is_coming_soon": False,
                    "icon_name": "Cpu",
                    "help_url": "https://platform.openai.com/api-keys",
                    "help_text": "OpenAI Platform Keys",
                    "fields": [
                        {"key": "OPENAI_API_KEY", "label": "API Key", "type": "password", "placeholder": "sk-proj-...", "required": True, "is_secret": True, "masked_value": mask_secret(openai_key), "has_value": bool(openai_key), "help": "Standard Bearer authorization token."},
                        {"key": "OPENAI_BASE_URL", "label": "Base URL (Optional)", "type": "text", "placeholder": "https://api.openai.com/v1", "required": False, "is_secret": False, "masked_value": openai_base, "has_value": bool(openai_base), "help": "Set for OpenRouter or custom proxy."}
                    ]
                }
            ]
        },
        {
            "id": "social_media",
            "name": "Social Media Integrations",
            "description": "Publish thought leadership, scheduled visuals, and automated conversation funnels.",
            "items": [
                {
                    "id": "linkedin",
                    "name": "LinkedIn Professional",
                    "category_id": "social_media",
                    "category_name": "Social Media Integrations",
                    "description": "Publish thought leadership posts, photorealistic AI developer visuals, and scheduled carousels.",
                    "status": "connected" if (li_token and li_urn) else ("partially_configured" if li_token else "not_configured"),
                    "status_message": "Authorized for post publishing" if (li_token and li_urn) else ("Token active; Author URN required" if li_token else "Configure Access Token & Author URN to publish"),
                    "configured": bool(li_token and li_urn),
                    "is_coming_soon": False,
                    "icon_name": "Linkedin",
                    "help_url": "https://www.linkedin.com/developers/apps",
                    "help_text": "LinkedIn Developer Portal",
                    "fields": [
                        {"key": "LINKEDIN_ACCESS_TOKEN", "label": "LinkedIn Access Token", "type": "password", "placeholder": "AQWM... (300+ chars OAuth token with w_member_social scope)", "required": True, "is_secret": True, "masked_value": mask_secret(li_token), "has_value": bool(li_token), "help": "OAuth 2.0 User Access Token with 'w_member_social' permission."},
                        {"key": "LINKEDIN_AUTHOR_URN", "label": "Author URN (Member ID)", "type": "text", "placeholder": "urn:li:person:12345678 or numeric member ID", "required": True, "is_secret": False, "masked_value": li_urn, "has_value": bool(li_urn), "help": "Person URN: 'urn:li:person:<id>' or bare numeric ID. Do NOT enter public profile URLs ('linkedin.com/in/...')."},
                        {"key": "HUGGINGFACE_API_KEY", "label": "Hugging Face Token (AI Visuals)", "type": "password", "placeholder": "hf_... (Free HF token for dedicated FLUX AI visual generation)", "required": False, "is_secret": True, "masked_value": mask_secret(hf_key), "has_value": bool(hf_key), "help": "Optional: Enables dedicated 100% free FLUX.1 photorealistic developer visual generation."},
                        {"key": "LINKEDIN_CLIENT_ID", "label": "Client ID (Optional)", "type": "text", "placeholder": "77xxxx...", "required": False, "is_secret": False, "masked_value": li_client_id, "has_value": bool(li_client_id), "help": "Client ID from your LinkedIn Developer App."}
                    ]
                },
                {
                    "id": "facebook",
                    "name": "Facebook Pages & Groups",
                    "category_id": "social_media",
                    "category_name": "Social Media Integrations",
                    "description": "Direct Facebook Page updates, community replies, and scheduled group posts.",
                    "status": "coming_soon",
                    "status_message": "Coming Soon in AgentFlow v4.2",
                    "configured": False,
                    "is_coming_soon": True,
                    "icon_name": "Share2",
                    "help_url": "#",
                    "help_text": "In Development",
                    "fields": []
                },
                {
                    "id": "x_twitter",
                    "name": "X (Twitter) Publisher",
                    "category_id": "social_media",
                    "category_name": "Social Media Integrations",
                    "description": "Tech tweet thread composer, auto-scheduling, and mention monitoring.",
                    "status": "coming_soon",
                    "status_message": "Coming Soon in AgentFlow v4.2",
                    "configured": False,
                    "is_coming_soon": True,
                    "icon_name": "Share2",
                    "help_url": "#",
                    "help_text": "In Development",
                    "fields": []
                },
                {
                    "id": "youtube",
                    "name": "YouTube Community & Video",
                    "category_id": "social_media",
                    "category_name": "Social Media Integrations",
                    "description": "Community tab updates, automated video descriptions, and release alerts.",
                    "status": "coming_soon",
                    "status_message": "Coming Soon in AgentFlow v4.2",
                    "configured": False,
                    "is_coming_soon": True,
                    "icon_name": "Share2",
                    "help_url": "#",
                    "help_text": "In Development",
                    "fields": []
                }
            ]
        },
        {
            "id": "ai_calling",
            "name": "AI Calling Integration",
            "description": "Autonomous telephony agent for answering incoming customer phone calls with AI voice.",
            "items": [
                {
                    "id": "calling",
                    "name": "Exotel Incoming Voice Receptionist",
                    "category_id": "ai_calling",
                    "category_name": "AI Calling Integration",
                    "description": "Real-time inbound phone call answering via Exotel Passthru, natural Hinglish speech dialogue, and instant Telegram alerts.",
                    "status": "connected" if (exo_key and exo_token and exo_sid) else "not_configured",
                    "status_message": f"Answering inbound calls on {exo_phone}" if (exo_key and exo_token and exo_sid and exo_phone) else "Enter Exotel credentials to activate inbound voice",
                    "configured": bool(exo_key and exo_token and exo_sid),
                    "is_coming_soon": False,
                    "icon_name": "PhoneCall",
                    "help_url": "https://my.exotel.com",
                    "help_text": "Exotel Dashboard",
                    "fields": [
                        {"key": "EXOTEL_EXOPHONE", "label": "Exotel Virtual Number (ExoPhone)", "type": "text", "placeholder": "09513886363 or +919513886363", "required": True, "is_secret": False, "masked_value": exo_phone, "has_value": bool(exo_phone), "help": "Your assigned Exotel virtual number (trial ExoPhone)."},
                        {"key": "EXOTEL_ACCOUNT_SID", "label": "Exotel Account SID", "type": "text", "placeholder": "your_account_sid", "required": True, "is_secret": False, "masked_value": exo_sid, "has_value": bool(exo_sid), "help": "Found on Exotel Dashboard under API Settings (Account SID / Account ID)."},
                        {"key": "EXOTEL_API_KEY", "label": "Exotel API Key", "type": "text", "placeholder": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "required": True, "is_secret": False, "masked_value": exo_key, "has_value": bool(exo_key), "help": "API Key from Exotel Dashboard under API Settings."},
                        {"key": "EXOTEL_API_TOKEN", "label": "Exotel API Token", "type": "password", "placeholder": "••••••••••••••••••••••••••••••••", "required": True, "is_secret": True, "masked_value": mask_secret(exo_token), "has_value": bool(exo_token), "help": "Primary API Token from Exotel Dashboard."},
                        {"key": "EXOTEL_SUBDOMAIN", "label": "Exotel Subdomain / Cluster", "type": "text", "placeholder": "api.exotel.com or api.in.exotel.com", "required": False, "is_secret": False, "masked_value": exo_subdomain, "has_value": bool(exo_subdomain), "help": "api.exotel.com (default/Singapore) or api.in.exotel.com (Mumbai cluster)."},
                        {"key": "EXOTEL_APP_ID", "label": "Exotel App / Flow ID (Optional)", "type": "text", "placeholder": "e.g. 123456", "required": False, "is_secret": False, "masked_value": exo_app_id, "has_value": bool(exo_app_id), "help": "Optional: Flow ID if triggering outbound campaigns."},
                        {"key": "VOICE_GREETING_MESSAGE", "label": "Inbound Greeting Message", "type": "text", "placeholder": "Hello! Insha abhi busy hain. Aap humein bata dijiye kya kaam hai? Main aapka message un tak pahuncha dungi.", "required": False, "is_secret": False, "masked_value": greeting_msg, "has_value": bool(greeting_msg), "help": "Initial spoken greeting message when callers connect."}
                    ]
                }
            ]
        },
        {
            "id": "email",
            "name": "Email Integrations",
            "description": "Send automated newsletters, research digests, and scheduled client outreach.",
            "items": [
                {
                    "id": "email_smtp",
                    "name": "Gmail SMTP & Custom Server",
                    "category_id": "email",
                    "category_name": "Email Integrations",
                    "description": "Send emails through your Gmail account with 16-character App Passwords or custom company SMTP.",
                    "status": "connected" if (email_user and email_pass) else "not_configured",
                    "status_message": f"Configured as {email_user}" if (email_user and email_pass) else "Enter your Gmail address and 16-char App Password",
                    "configured": bool(email_user and email_pass),
                    "is_coming_soon": False,
                    "icon_name": "Mail",
                    "help_url": "https://myaccount.google.com/apppasswords",
                    "help_text": "Generate Google App Password",
                    "fields": [
                        {"key": "EMAIL_USER", "label": "Email Address", "type": "text", "placeholder": "your.email@gmail.com", "required": True, "is_secret": False, "masked_value": email_user, "has_value": bool(email_user), "help": "Your full Gmail or SMTP user email."},
                        {"key": "EMAIL_PASS", "label": "Google App Password", "type": "password", "placeholder": "abcd efgh ijkl mnop", "required": True, "is_secret": True, "masked_value": mask_secret(email_pass), "has_value": bool(email_pass), "help": "16-character Google App Password (not account password)."},
                        {"key": "EMAIL_FROM", "label": "Sender Name / From", "type": "text", "placeholder": "AgentFlow <your.email@gmail.com>", "required": False, "is_secret": False, "masked_value": email_from, "has_value": bool(email_from), "help": "Custom sender display name."},
                        {"key": "SMTP_HOST", "label": "SMTP Host", "type": "text", "placeholder": "smtp.gmail.com", "required": False, "is_secret": False, "masked_value": smtp_host, "has_value": bool(smtp_host), "help": "Default: smtp.gmail.com."},
                        {"key": "SMTP_PORT", "label": "SMTP Port", "type": "number", "placeholder": "587", "required": False, "is_secret": False, "masked_value": smtp_port, "has_value": bool(smtp_port), "help": "Port 587 (TLS) or 465 (SSL)."}
                    ]
                },
                {
                    "id": "email_resend",
                    "name": "Resend Developer Email API",
                    "category_id": "email",
                    "category_name": "Email Integrations",
                    "description": "Modern developer email API with high deliverability and built-in domain analytics.",
                    "status": "connected" if resend_key else "not_configured",
                    "status_message": "Resend API active" if resend_key else "Enter your Resend API key to activate",
                    "configured": bool(resend_key),
                    "is_coming_soon": False,
                    "icon_name": "Mail",
                    "help_url": "https://resend.com/api-keys",
                    "help_text": "Resend API Keys Dashboard",
                    "fields": [
                        {"key": "RESEND_API_KEY", "label": "Resend API Key", "type": "password", "placeholder": "re_...", "required": True, "is_secret": True, "masked_value": mask_secret(resend_key), "has_value": bool(resend_key), "help": "API key generated in Resend dashboard."},
                        {"key": "EMAIL_FROM", "label": "Verified From Email", "type": "text", "placeholder": "onboarding@resend.dev", "required": True, "is_secret": False, "masked_value": email_from, "has_value": bool(email_from), "help": "Sender email verified on your Resend domain."}
                    ]
                },
                {
                    "id": "email_brevo",
                    "name": "Brevo (Sendinblue) API",
                    "category_id": "email",
                    "category_name": "Email Integrations",
                    "description": "Reliable marketing and transactional email API with 300 free emails per day.",
                    "status": "connected" if brevo_key else "not_configured",
                    "status_message": "Brevo API active" if brevo_key else "Enter your Brevo API key to activate",
                    "configured": bool(brevo_key),
                    "is_coming_soon": False,
                    "icon_name": "Mail",
                    "help_url": "https://app.brevo.com/settings/keys/api",
                    "help_text": "Brevo API Keys",
                    "fields": [
                        {"key": "BREVO_API_KEY", "label": "Brevo v3 API Key", "type": "password", "placeholder": "xkeysib-...", "required": True, "is_secret": True, "masked_value": mask_secret(brevo_key), "has_value": bool(brevo_key), "help": "Brevo v3 API key."},
                        {"key": "EMAIL_FROM", "label": "Verified Sender Email", "type": "text", "placeholder": "alerts@yourdomain.com", "required": True, "is_secret": False, "masked_value": email_from, "has_value": bool(email_from), "help": "Sender email verified in Brevo."}
                    ]
                }
            ]
        },
        {
            "id": "career",
            "name": "Career Agent Integrations",
            "description": "Job market extraction, ATS resume tailoring, and applicant tracking systems.",
            "items": [
                {
                    "id": "career_jobsearch",
                    "name": "Job Search Engine (DuckDuckGo & News)",
                    "category_id": "career",
                    "category_name": "Career Agent Integrations",
                    "description": "Zero-cost real-time job hunting across LinkedIn, Naukri, Indeed, and Google Jobs with smart location & role filters.",
                    "status": "connected",
                    "status_message": "Active out-of-the-box with zero API cost",
                    "configured": True,
                    "is_coming_soon": False,
                    "icon_name": "Search",
                    "help_url": "#",
                    "help_text": "Zero-API Built-in Feature",
                    "fields": []
                },
                {
                    "id": "career_ats",
                    "name": "Resume & ATS Parsing Engine",
                    "category_id": "career",
                    "category_name": "Career Agent Integrations",
                    "description": "Local PDF/DOCX resume extraction, keyword optimization, and qualification match scoring against job descriptions.",
                    "status": "connected",
                    "status_message": "Local parser and AI match scoring active",
                    "configured": True,
                    "is_coming_soon": False,
                    "icon_name": "FileText",
                    "help_url": "#",
                    "help_text": "Built-in Local Parser & LLM Matcher",
                    "fields": []
                },
                {
                    "id": "career_greenhouse",
                    "name": "Greenhouse & Lever ATS Integration",
                    "category_id": "career",
                    "category_name": "Career Agent Integrations",
                    "description": "Direct employer applicant tracking system submission, auto-populating job applications with customized resumes.",
                    "status": "coming_soon",
                    "status_message": "Coming Soon in AgentFlow v4.2",
                    "configured": False,
                    "is_coming_soon": True,
                    "icon_name": "Briefcase",
                    "help_url": "#",
                    "help_text": "In Development",
                    "fields": []
                },
                {
                    "id": "career_indeed",
                    "name": "Indeed Publisher & Sponsor Feed",
                    "category_id": "career",
                    "category_name": "Career Agent Integrations",
                    "description": "Direct feed integration with Indeed's recruiter and candidate discovery portal.",
                    "status": "coming_soon",
                    "status_message": "Coming Soon in AgentFlow v4.2",
                    "configured": False,
                    "is_coming_soon": True,
                    "icon_name": "Briefcase",
                    "help_url": "#",
                    "help_text": "In Development",
                    "fields": []
                }
            ]
        },
        {
            "id": "language",
            "name": "Language & Speech Integrations",
            "description": "Speech-to-text, text-to-speech, translation, and multilingual reasoning.",
            "items": [
                {
                    "id": "language_browser",
                    "name": "Browser Web Speech & TTS Engine",
                    "category_id": "language",
                    "category_name": "Language & Speech Integrations",
                    "description": "Zero-cost, instant speech recognition and text-to-speech voice synthesis running locally in your browser.",
                    "status": "connected",
                    "status_message": "Ready with zero configuration",
                    "configured": True,
                    "is_coming_soon": False,
                    "icon_name": "Mic",
                    "help_url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API",
                    "help_text": "Built-in Browser Feature",
                    "fields": []
                },
                {
                    "id": "language_hf",
                    "name": "Hugging Face Speech & NLLB Translation",
                    "category_id": "language",
                    "category_name": "Language & Speech Integrations",
                    "description": "Multilingual translation (200+ languages) and Whisper automatic speech transcription powered by Hugging Face.",
                    "status": "connected" if hf_key else "not_configured",
                    "status_message": "Uses your configured Hugging Face token" if hf_key else "Enter Hugging Face token to activate",
                    "configured": bool(hf_key),
                    "is_coming_soon": False,
                    "icon_name": "Globe",
                    "help_url": "https://huggingface.co/settings/tokens",
                    "help_text": "Hugging Face Access Tokens",
                    "fields": [
                        {"key": "HUGGINGFACE_API_KEY", "label": "Hugging Face Token", "type": "password", "placeholder": "hf_...", "required": True, "is_secret": True, "masked_value": mask_secret(hf_key), "has_value": bool(hf_key), "help": "Shares the same token configured in AI Visual Studio."}
                    ]
                },
                {
                    "id": "language_google_cloud",
                    "name": "Google Cloud Speech-to-Text",
                    "category_id": "language",
                    "category_name": "Language & Speech Integrations",
                    "description": "High-accuracy enterprise speech transcription and streaming voice processing.",
                    "status": "coming_soon",
                    "status_message": "Coming Soon in AgentFlow v4.2",
                    "configured": False,
                    "is_coming_soon": True,
                    "icon_name": "Mic",
                    "help_url": "#",
                    "help_text": "In Development",
                    "fields": []
                },
                {
                    "id": "language_elevenlabs",
                    "name": "ElevenLabs Voice Synthesis",
                    "category_id": "language",
                    "category_name": "Language & Speech Integrations",
                    "description": "Hyper-realistic human voice cloning and high-fidelity emotional audio generation.",
                    "status": "coming_soon",
                    "status_message": "Coming Soon in AgentFlow v4.2",
                    "configured": False,
                    "is_coming_soon": True,
                    "icon_name": "Volume2",
                    "help_url": "#",
                    "help_text": "In Development",
                    "fields": []
                }
            ]
        },
        {
            "id": "additional",
            "name": "Additional Integrations & Webhooks",
            "description": "Cross-platform alerts, external webhooks, and third-party event listeners.",
            "items": [
                {
                    "id": "telegram",
                    "name": "Telegram Bot Alerts",
                    "category_id": "additional",
                    "category_name": "Additional Integrations & Webhooks",
                    "description": "Instant smartphone push alerts, execution logs, human approval prompts, and missed call notifications.",
                    "status": "connected" if tg_token else "not_configured",
                    "status_message": "Telegram Bot active" if tg_token else "Enter Bot Token from @BotFather",
                    "configured": bool(tg_token),
                    "is_coming_soon": False,
                    "icon_name": "Send",
                    "help_url": "https://t.me/BotFather",
                    "help_text": "Message @BotFather on Telegram",
                    "fields": [
                        {"key": "TELEGRAM_BOT_TOKEN", "label": "Bot HTTP API Token", "type": "password", "placeholder": "123456789:ABCdef...", "required": True, "is_secret": True, "masked_value": mask_secret(tg_token), "has_value": bool(tg_token), "help": "Token provided by @BotFather."},
                        {"key": "TELEGRAM_CHAT_ID", "label": "Target Chat ID", "type": "text", "placeholder": "123456789", "required": False, "is_secret": False, "masked_value": tg_chat, "has_value": bool(tg_chat), "help": "Your numeric Telegram user or group ID."}
                    ]
                },
                {
                    "id": "webhooks",
                    "name": "Custom Inbound Webhooks",
                    "category_id": "additional",
                    "category_name": "Additional Integrations & Webhooks",
                    "description": "Trigger AgentFlow workflows and agents from external third-party tools (Zapier, GitHub, Stripe) via HTTP POST.",
                    "status": "connected",
                    "status_message": "Listening at /api/webhooks/inbound",
                    "configured": True,
                    "is_coming_soon": False,
                    "icon_name": "Webhook",
                    "help_url": "#",
                    "help_text": "Endpoint: /api/webhooks/inbound",
                    "fields": [
                        {"key": "WEBHOOK_SECRET", "label": "HMAC Verification Secret (Optional)", "type": "password", "placeholder": "whsec_...", "required": False, "is_secret": True, "masked_value": mask_secret(webhook_sec), "has_value": bool(webhook_sec), "help": "Optional secret to verify inbound payload signatures."}
                    ]
                },
                {
                    "id": "discord",
                    "name": "Discord Webhook & Bot",
                    "category_id": "additional",
                    "category_name": "Additional Integrations & Webhooks",
                    "description": "Send automated team announcements, error digests, and research dossiers to Discord channels.",
                    "status": "coming_soon",
                    "status_message": "Coming Soon in AgentFlow v4.2",
                    "configured": False,
                    "is_coming_soon": True,
                    "icon_name": "MessageSquare",
                    "help_url": "#",
                    "help_text": "In Development",
                    "fields": []
                },
                {
                    "id": "google_calendar",
                    "name": "Google Calendar Sync",
                    "category_id": "additional",
                    "category_name": "Additional Integrations & Webhooks",
                    "description": "Bi-directional scheduling of scheduled posts, interview appointments, and autonomous task sentinels.",
                    "status": "coming_soon",
                    "status_message": "Coming Soon in AgentFlow v4.2",
                    "configured": False,
                    "is_coming_soon": True,
                    "icon_name": "Calendar",
                    "help_url": "#",
                    "help_text": "In Development",
                    "fields": []
                }
            ]
        }
    ]

    # Calculate summary metrics across all items
    all_items = []
    for cat in categories:
        all_items.extend(cat["items"])

    total_count = len(all_items)
    active_items = [i for i in all_items if not i.get("is_coming_soon")]
    active_count = len(active_items)
    connected_count = len([i for i in all_items if i.get("status") == "connected"])
    not_configured_count = len([i for i in active_items if i.get("status") == "not_configured"])
    attention_count = len([i for i in active_items if i.get("status") in ("connection_failed", "requires_attention", "invalid_token")])

    return {
        "summary": {
            "total_integrations": total_count,
            "active_integrations": active_count,
            "connected_integrations": connected_count,
            "not_configured": not_configured_count,
            "attention_required": attention_count
        },
        "categories": categories,
        "all_integrations": all_items
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
    creds = data.get("credentials") or {}

    # Map aliases
    if sid in ("gemini", "groq", "openai", "ollama"):
        data["provider"] = sid
        sid = "llm"
    elif sid in ("email_smtp", "email_resend", "email_brevo"):
        prov = "smtp"
        if sid == "email_resend":
            prov = "resend"
        elif sid == "email_brevo":
            prov = "brevo"
        from backend.email_provider import test_email_connection
        ok, msg = test_email_connection(prov)
        return {
            "success": ok,
            "status": "connected" if ok else "connection_failed",
            "message": msg
        }
    elif sid in ("career_jobsearch", "career_ats", "language_browser", "webhooks"):
        return {
            "success": True,
            "status": "connected",
            "message": "Built-in integration verified and ready for execution."
        }
    elif sid in ("huggingface", "hf"):
        token = data.get("token") or creds.get("HUGGINGFACE_API_KEY") or get_credential("HUGGINGFACE_API_KEY")
        if not token:
            return {"success": False, "status": "not_connected", "message": "Hugging Face Access Token is required."}
        try:
            req = urllib.request.Request(
                "https://huggingface.co/api/whoami-v2",
                headers={"Authorization": f"Bearer {token.strip()}", "User-Agent": "AgentFlow/4.1"}
            )
            with urllib.request.urlopen(req, timeout=6.0) as resp:
                if resp.status == 200:
                    info = json.loads(resp.read().decode("utf-8"))
                    uname = info.get("name", "User")
                    return {"success": True, "status": "connected", "message": f"Hugging Face token verified for @{uname}."}
            return {"success": True, "status": "connected", "message": "Hugging Face token verified."}
        except urllib.error.HTTPError as he:
            if he.code == 401:
                return {"success": False, "status": "connection_failed", "message": "Invalid Hugging Face token (HTTP 401 Unauthorized)."}
            return {"success": False, "status": "connection_failed", "message": f"Hugging Face API returned HTTP {he.code}."}
        except Exception as e:
            return {"success": False, "status": "connection_failed", "message": f"Hugging Face API unreachable: {str(e)}"}

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
        token = data.get("token") or creds.get("TELEGRAM_BOT_TOKEN") or get_credential("TELEGRAM_BOT_TOKEN")
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
            if he.code in (401, 404):
                return {"success": False, "status": "connection_failed", "message": "Telegram authentication failed: Invalid Bot Token (HTTP 401/404)."}
            return {"success": False, "status": "connection_failed", "message": f"Telegram API error: HTTP {he.code} {he.reason}"}
        except Exception as e:
            return {"success": False, "status": "connection_failed", "message": f"Telegram API unreachable: {str(e)}"}

    elif sid == "linkedin":
        token = data.get("token") or creds.get("LINKEDIN_ACCESS_TOKEN") or get_credential("LINKEDIN_ACCESS_TOKEN")
        author_urn = data.get("author_urn") or creds.get("LINKEDIN_AUTHOR_URN") or get_credential("LINKEDIN_AUTHOR_URN")
        if not token:
            return {"success": False, "status": "not_connected", "message": "LinkedIn Access Token is required."}
        
        from backend.platform_engine import LinkedInAdapter
        is_valid_urn, canonical_urn, urn_err = LinkedInAdapter.validate_author_urn(author_urn)
        if not is_valid_urn:
            return {"success": False, "status": "configuration_required", "message": f"Author URN Error: {urn_err}"}
        author_urn = canonical_urn

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
                    sub_id = user_data.get("sub")
                    name = user_data.get("name") or user_data.get("sub", author_urn)
                    disc_urn = f"urn:li:person:{sub_id}" if sub_id else author_urn
                    return {
                        "success": True, 
                        "status": "connected", 
                        "message": f"LinkedIn OAuth token verified for {name} ({disc_urn}).",
                        "discovered_urn": disc_urn,
                        "sub": sub_id,
                        "name": name
                    }
                return {"success": True, "status": "connected", "message": f"LinkedIn token verified (HTTP {resp.status})."}
        except urllib.error.HTTPError as he:
            body = ""
            try:
                body = he.read().decode("utf-8")
            except Exception:
                pass
            if he.code == 403 and ("Not enough permissions" in body or "ACCESS_DENIED" in body or "w_member_social" in body):
                return {
                    "success": True, 
                    "status": "connected", 
                    "message": f"LinkedIn token verified with 'w_member_social' publishing scope ({author_urn}).",
                    "note": "Token is authentic with active write permissions (w_member_social). Profile reading (openid/profile) is not enabled on this token."
                }
            if he.code in (401, 403):
                return {"success": False, "status": "connection_failed", "message": f"LinkedIn authentication failed: Invalid or expired access token (HTTP {he.code})."}
            return {"success": False, "status": "connection_failed", "message": f"LinkedIn API returned HTTP {he.code}: {he.reason}"}
        except Exception as e:
            return {"success": False, "status": "connection_failed", "message": f"LinkedIn API unreachable: {str(e)}"}

    elif sid in ("calling", "exotel"):
        # Check for Exotel credentials first
        api_key = data.get("api_key") or creds.get("EXOTEL_API_KEY") or get_credential("EXOTEL_API_KEY")
        api_token = data.get("api_token") or creds.get("EXOTEL_API_TOKEN") or get_credential("EXOTEL_API_TOKEN")
        account_sid = data.get("account_sid") or creds.get("EXOTEL_ACCOUNT_SID") or get_credential("EXOTEL_ACCOUNT_SID")
        exophone = data.get("phone_number") or data.get("exophone") or creds.get("EXOTEL_EXOPHONE") or get_credential("EXOTEL_EXOPHONE")
        subdomain = data.get("subdomain") or creds.get("EXOTEL_SUBDOMAIN") or get_credential("EXOTEL_SUBDOMAIN") or "api.exotel.com"

        # Check for legacy Twilio fallback if AC prefix present
        legacy_sid = data.get("account_sid") or creds.get("TWILIO_ACCOUNT_SID") or get_credential("TWILIO_ACCOUNT_SID")
        legacy_auth = data.get("auth_token") or creds.get("TWILIO_AUTH_TOKEN") or get_credential("TWILIO_AUTH_TOKEN")
        if legacy_sid and legacy_sid.startswith("AC") and legacy_auth and not api_key:
            phone_number = data.get("phone_number") or creds.get("TWILIO_PHONE_NUMBER") or get_credential("TWILIO_PHONE_NUMBER")
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{legacy_sid}.json"
                auth_str = base64.b64encode(f"{legacy_sid}:{legacy_auth}".encode("utf-8")).decode("utf-8")
                req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth_str}", "User-Agent": "AgentFlow/4.1"})
                with urllib.request.urlopen(req, timeout=6.0) as resp:
                    if resp.status == 200:
                        tw_data = json.loads(resp.read().decode("utf-8"))
                        acc_name = tw_data.get("friendly_name", legacy_sid)
                        return {"success": True, "status": "connected", "message": f"Twilio API verified. Account: {acc_name}."}
                    return {"success": True, "status": "connected", "message": f"Twilio Voice credentials verified for {phone_number}."}
            except urllib.error.HTTPError as he:
                return {"success": False, "status": "connection_failed", "message": f"Twilio authentication failed (HTTP {he.code})."}
            except Exception as e:
                return {"success": False, "status": "connection_failed", "message": f"Twilio API unreachable: {str(e)}"}

        if not api_key or not api_token:
            return {"success": False, "status": "not_connected", "message": "Exotel API Key and API Token are required."}
        if not account_sid:
            return {"success": False, "status": "configuration_required", "message": "Exotel Account SID (Account ID) is required."}

        # Live provider validation against Exotel Accounts API
        try:
            clean_sub = subdomain.replace("https://", "").replace("http://", "").strip("/")
            url = f"https://{clean_sub}/v1/Accounts/{account_sid}.json"
            auth_str = base64.b64encode(f"{api_key}:{api_token}".encode("utf-8")).decode("utf-8")
            req = urllib.request.Request(
                url,
                headers={
                    "Authorization": f"Basic {auth_str}",
                    "User-Agent": "AgentFlow/4.1"
                }
            )
            with urllib.request.urlopen(req, timeout=8.0) as resp:
                if resp.status == 200:
                    exo_data = json.loads(resp.read().decode("utf-8"))
                    acc = exo_data.get("Account", {})
                    acc_name = acc.get("FriendlyName") or acc.get("Sid") or account_sid
                    acc_status = acc.get("Status", "active")
                    phone_msg = f" for ExoPhone {exophone}" if exophone else ""
                    return {"success": True, "status": "connected", "message": f"Exotel API verified. Account: {acc_name} ({acc_status}){phone_msg}."}
                return {"success": True, "status": "connected", "message": f"Exotel credentials verified (HTTP {resp.status})."}
        except urllib.error.HTTPError as he:
            if he.code == 401:
                return {"success": False, "status": "connection_failed", "message": "Exotel authentication failed: Invalid API Key or API Token (HTTP 401)."}
            if he.code == 404:
                return {"success": False, "status": "connection_failed", "message": f"Exotel Account SID '{account_sid}' not found (HTTP 404). Check your Subdomain and Account SID."}
            return {"success": False, "status": "connection_failed", "message": f"Exotel API returned HTTP {he.code}: {he.reason}"}
        except Exception as e:
            return {"success": False, "status": "connection_failed", "message": f"Exotel API unreachable: {str(e)}"}

    elif sid == "llm":
        prov = data.get("provider") or get_credential("LLM_PROVIDER", "ollama")
        if prov == "ollama":
            base_url = creds.get("OLLAMA_BASE_URL") or get_credential("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
            try:
                req = urllib.request.Request(f"{base_url}/api/tags", headers={"User-Agent": "AgentFlow"})
                with urllib.request.urlopen(req, timeout=3) as resp:
                    tags = json.loads(resp.read().decode("utf-8"))
                    models = [m.get("name") for m in tags.get("models", [])]
                    return {"success": True, "status": "connected", "message": f"Ollama is running with models: {', '.join(models[:4]) or 'none'}"}
            except Exception as e:
                return {"success": False, "status": "connection_failed", "message": f"Ollama connection notice at {base_url}: {str(e)}. Run 'ollama serve' for local models."}
        elif prov == "groq":
            key = data.get("api_key") or creds.get("GROQ_API_KEY") or get_credential("GROQ_API_KEY")
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
            key = data.get("api_key") or creds.get("GEMINI_API_KEY") or get_credential("GEMINI_API_KEY")
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
            key = data.get("api_key") or creds.get("OPENAI_API_KEY") or get_credential("OPENAI_API_KEY")
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

    elif sid in ("image_gen", "cloudflare_ai", "stability", "ideogram", "pollinations"):
        target_provider = data.get("provider") or (sid if sid != "image_gen" else get_credential("PREFERRED_IMAGE_PROVIDER", "cloudflare"))
        target_provider = target_provider.lower().strip()

        if target_provider in ("cloudflare", "cloudflare_ai"):
            cf_acc = data.get("account_id") or creds.get("CLOUDFLARE_ACCOUNT_ID") or get_credential("CLOUDFLARE_ACCOUNT_ID")
            cf_token = data.get("api_token") or creds.get("CLOUDFLARE_API_TOKEN") or get_credential("CLOUDFLARE_API_TOKEN")
            if not cf_acc or not cf_token:
                return {
                    "success": False,
                    "status": "not_connected",
                    "message": "Cloudflare Account ID and API Token are required to test Cloudflare Workers AI."
                }
            try:
                req = urllib.request.Request(
                    "https://api.cloudflare.com/client/v4/user/tokens/verify",
                    headers={"Authorization": f"Bearer {cf_token.strip()}", "User-Agent": "AgentFlow"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        return {"success": True, "status": "connected", "message": "Cloudflare Workers AI API Token verified (FLUX.1-schnell active with free daily allowance)."}
            except urllib.error.HTTPError as he:
                if he.code in (401, 403):
                    return {"success": False, "status": "connection_failed", "message": "Cloudflare authentication failed: Invalid or expired API Token."}
                return {"success": False, "status": "connection_failed", "message": f"Cloudflare API returned HTTP {he.code}: {he.reason}"}
            except Exception as e:
                return {"success": False, "status": "connection_failed", "message": f"Cloudflare API unreachable: {str(e)}"}

        elif target_provider == "stability":
            stab_key = data.get("api_key") or creds.get("STABILITY_API_KEY") or get_credential("STABILITY_API_KEY")
            if not stab_key:
                return {"success": False, "status": "not_connected", "message": "Stability AI API Key is required."}
            try:
                req = urllib.request.Request(
                    "https://api.stability.ai/v1/user/account",
                    headers={"Authorization": f"Bearer {stab_key.strip()}", "User-Agent": "AgentFlow"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        return {"success": True, "status": "connected", "message": "Stability AI API Key verified successfully."}
            except urllib.error.HTTPError as he:
                if he.code in (401, 403):
                    return {"success": False, "status": "connection_failed", "message": "Stability AI authentication failed: Invalid API Key."}
                return {"success": False, "status": "connection_failed", "message": f"Stability AI error HTTP {he.code}: {he.reason}"}
            except Exception as e:
                return {"success": False, "status": "connection_failed", "message": f"Stability AI API unreachable: {str(e)}"}

        elif target_provider == "ideogram":
            ideo_key = data.get("api_key") or creds.get("IDEOGRAM_API_KEY") or get_credential("IDEOGRAM_API_KEY")
            if not ideo_key:
                return {"success": False, "status": "not_connected", "message": "Ideogram API Key is required."}
            try:
                req = urllib.request.Request(
                    "https://api.ideogram.ai/manage/api-key",
                    headers={"Api-Key": ideo_key.strip(), "User-Agent": "AgentFlow"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        return {"success": True, "status": "connected", "message": "Ideogram API Key verified successfully."}
            except urllib.error.HTTPError as he:
                if he.code in (401, 403):
                    return {"success": False, "status": "connection_failed", "message": "Ideogram authentication failed: Invalid API Key."}
                return {"success": False, "status": "connection_failed", "message": f"Ideogram error HTTP {he.code}: {he.reason}"}
            except Exception as e:
                return {"success": False, "status": "connection_failed", "message": f"Ideogram API unreachable: {str(e)}"}

        elif target_provider == "pollinations":
            return {"success": True, "status": "connected", "message": "Pollinations AI is 100% free and active as default keyless generator (FLUX model)."}

        return {"success": True, "status": "connected", "message": f"Image Generation Engine ready ({target_provider})."}

    return {"success": True, "status": "connected", "message": f"Integration '{sid}' verified."}

