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
}


def _read_db_setting_sync(key: str) -> Optional[str]:
    """Synchronously queries a key from SQLite user_settings table."""
    try:
        if not Path(DB_FILE).exists():
            return None
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM user_settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else None
    except Exception:
        return None


def _write_db_setting_sync(key: str, value: str) -> bool:
    """Synchronously updates or inserts a key in SQLite user_settings table."""
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
        cursor.execute("""
            INSERT INTO user_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """, (key, value, now_str))
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
        "EMAIL_USER", "EMAIL_PASS", "GMAIL_EMAIL", "GMAIL_APP_PASSWORD",
        "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
        "GROQ_API_KEY", "GEMINI_API_KEY", "LLM_PROVIDER", "LLM_MODEL"
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
                for k, v in rows:
                    if k in keys_to_sync and v and v.strip():
                        _CREDENTIALS_CACHE[k] = v.strip()
                        # If not already provided by system env, load it
                        if not os.getenv(k):
                            os.environ[k] = v.strip()
                            synced_count += 1
                        else:
                            _CREDENTIALS_CACHE[k] = os.getenv(k).strip()
    except Exception as e:
        print(f"[Credentials] Startup sync notice: {e}")

    _INITIALIZED = True
    print(f"[Credentials] Synchronized {synced_count} credentials from SQLite into runtime environment.")

    email_user = get_credential("EMAIL_USER") or get_credential("GMAIL_EMAIL")
    email_pass = get_credential("EMAIL_PASS") or get_credential("GMAIL_APP_PASSWORD")
    telegram_token = get_credential("TELEGRAM_BOT_TOKEN")

    return {
        "email_configured": bool(email_user and email_pass),
        "telegram_configured": bool(telegram_token),
    }


def get_masked_credentials_summary() -> Dict[str, Any]:
    """
    Returns a safe, masked dictionary of integration statuses for the frontend.
    Never exposes raw passwords or tokens!
    """
    email_user = get_credential("EMAIL_USER") or get_credential("GMAIL_EMAIL")
    email_pass = get_credential("EMAIL_PASS") or get_credential("GMAIL_APP_PASSWORD")
    telegram_token = get_credential("TELEGRAM_BOT_TOKEN")
    telegram_chat = get_credential("TELEGRAM_CHAT_ID")

    email_conf = bool(email_user and email_pass)
    telegram_conf = bool(telegram_token)

    masked_pass = "••••••••••••••••" if email_pass else ""
    masked_token = (telegram_token[:6] + "••••••••" + telegram_token[-4:]) if len(telegram_token) > 10 else ("••••••••" if telegram_token else "")

    return {
        "email": {
            "configured": email_conf,
            "email_user": email_user or "",
            "has_password": bool(email_pass),
            "masked_password": masked_pass,
            "status": "connected" if email_conf else "not_configured"
        },
        "telegram": {
            "configured": telegram_conf,
            "has_token": bool(telegram_token),
            "masked_token": masked_token,
            "chat_id": telegram_chat or "",
            "status": "connected" if telegram_conf else "not_configured"
        }
    }
