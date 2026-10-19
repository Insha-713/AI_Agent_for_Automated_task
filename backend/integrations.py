"""
AgentFlow - Integrations Hub & Workflow Templates Engine (Stage 6)
Real-time connection verification, credential diagnostics, and pre-built workflow templates
designed for Indian students, job seekers, and SMB owners with zero paid APIs.
"""

import os
import sys
import time
import json
import smtplib
import shutil
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional

import requests
from dotenv import load_dotenv

from backend.agent import detect_ollama_model
from backend.tools import WORKSPACE_PATH, USER_AGENT
from backend.reports import get_available_sample_datasets

# Preferred ddgs import
try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

load_dotenv()

IST = timezone(timedelta(hours=5, minutes=30))


# ==========================================
# Real-Time Integration Connection Testers
# ==========================================

def test_ollama_integration() -> Dict[str, Any]:
    """Tests connection to local Ollama inference server."""
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    preferred_model = os.getenv("OLLAMA_MODEL", "llama3.1")
    t0 = time.perf_counter()

    try:
        resp = requests.get(f"{base_url}/api/tags", timeout=3)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        if resp.status_code == 200:
            data = resp.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            active = preferred_model if preferred_model in models else (models[0] if models else "None")
            return {
                "service": "ollama",
                "display_name": "Ollama Local LLM",
                "status": "connected",
                "latency_ms": latency_ms,
                "endpoint": base_url,
                "active_model": active,
                "installed_models": models,
                "message": f"Connected to Ollama! Found {len(models)} local models. Active: {active}",
                "guidance": ""
            }
        else:
            return {
                "service": "ollama",
                "display_name": "Ollama Local LLM",
                "status": "error",
                "latency_ms": latency_ms,
                "endpoint": base_url,
                "message": f"Ollama returned HTTP status {resp.status_code}",
                "guidance": "Ensure Ollama is running and accessible at " + base_url
            }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "service": "ollama",
            "display_name": "Ollama Local LLM",
            "status": "offline",
            "latency_ms": latency_ms,
            "endpoint": base_url,
            "message": "Cannot reach Ollama on " + base_url,
            "guidance": "Install and run Ollama with: 'ollama run llama3.1' or start it with 'ollama serve'."
        }


def test_telegram_integration() -> Dict[str, Any]:
    """Tests Telegram Bot API credentials via getMe probe."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()

    if not bot_token:
        return {
            "service": "telegram",
            "display_name": "Telegram Bot Sentinel",
            "status": "not_configured",
            "latency_ms": 0.0,
            "configured": False,
            "message": "TELEGRAM_BOT_TOKEN not configured in .env",
            "guidance": "Message @BotFather on Telegram, type /newbot, and set TELEGRAM_BOT_TOKEN in .env"
        }

    t0 = time.perf_counter()
    try:
        url = f"https://api.telegram.org/bot{bot_token}/getMe"
        resp = requests.get(url, timeout=5)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        data = resp.json()

        if data.get("ok"):
            bot_info = data.get("result", {})
            username = bot_info.get("username", "UnknownBot")
            first_name = bot_info.get("first_name", "")
            return {
                "service": "telegram",
                "display_name": "Telegram Bot Sentinel",
                "status": "connected",
                "configured": True,
                "latency_ms": latency_ms,
                "bot_username": f"@{username}",
                "bot_name": first_name,
                "target_chat": chat_id or "Not Set",
                "message": f"Connected to Telegram bot @{username} ({first_name})",
                "guidance": "Target Chat ID configured: " + (chat_id if chat_id else "Missing (set TELEGRAM_CHAT_ID in .env)")
            }
        else:
            return {
                "service": "telegram",
                "display_name": "Telegram Bot Sentinel",
                "status": "invalid_token",
                "configured": True,
                "latency_ms": latency_ms,
                "message": f"Telegram API error: {data.get('description', 'Unauthorized')}",
                "guidance": "Double-check your bot token from @BotFather in .env"
            }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "service": "telegram",
            "display_name": "Telegram Bot Sentinel",
            "status": "error",
            "configured": True,
            "latency_ms": latency_ms,
            "message": f"Connection error: {str(e)[:60]}",
            "guidance": "Ensure internet connectivity and that api.telegram.org is reachable."
        }


def test_email_integration() -> Dict[str, Any]:
    """Tests Gmail SMTP connection and credentials without sending real emails."""
    email_user = (os.getenv("EMAIL_USER") or os.getenv("GMAIL_EMAIL") or "").strip().strip("'\"")
    email_pass = (os.getenv("EMAIL_PASS") or os.getenv("GMAIL_APP_PASSWORD") or "").strip().strip("'\"").replace(" ", "")

    if not email_user or not email_pass:
        return {
            "service": "email",
            "display_name": "Gmail SMTP (Outbound)",
            "status": "not_configured",
            "configured": False,
            "latency_ms": 0.0,
            "message": "EMAIL_USER or EMAIL_PASS not configured in server environment.",
            "guidance": "Generate a 16-character Google App Password (myaccount.google.com/apppasswords) and set EMAIL_USER and EMAIL_PASS."
        }

    t0 = time.perf_counter()
    try:
        from backend.tools import connect_gmail_smtp
        server, port_used = connect_gmail_smtp(email_user, email_pass, timeout=20)
        try:
            server.quit()
        except Exception:
            pass
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        return {
            "service": "email",
            "display_name": "Gmail SMTP (Outbound)",
            "status": "connected",
            "configured": True,
            "port_used": port_used,
            "latency_ms": latency_ms,
            "email_user": email_user,
            "message": f"Authenticated successfully with Gmail SMTP as '{email_user}' via port {port_used} ({latency_ms} ms).",
            "guidance": "Ready to send scheduled summaries, reports, and alerts upon human approval."
        }
    except smtplib.SMTPAuthenticationError as auth_err:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "service": "email",
            "display_name": "Gmail SMTP (Outbound)",
            "status": "auth_failed",
            "configured": True,
            "latency_ms": latency_ms,
            "email_user": email_user,
            "message": f"Authentication failed for '{email_user}': Invalid Google App Password.",
            "guidance": "Use a 16-character Google App Password from https://myaccount.google.com/apppasswords, not your personal Gmail password."
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "service": "email",
            "display_name": "Gmail SMTP (Outbound)",
            "status": "connection_blocked",
            "configured": True,
            "latency_ms": latency_ms,
            "email_user": email_user,
            "message": f"Connection blocked or timed out on ports 587 and 465: {str(e)[:120]}",
            "guidance": "Check your internet connection, firewall, VPN, or antivirus settings."
        }


def test_search_integration() -> Dict[str, Any]:
    """Tests zero-API DuckDuckGo search connection."""
    t0 = time.perf_counter()
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text("AI India technology news", max_results=2))
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        return {
            "service": "search",
            "display_name": "DuckDuckGo Web Search",
            "status": "connected",
            "configured": True,
            "latency_ms": latency_ms,
            "message": f"Zero-API live search operational ({len(results)} results returned).",
            "guidance": "100% free web search enabled with timelimit and deduplication."
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "service": "search",
            "display_name": "DuckDuckGo Web Search",
            "status": "degraded",
            "configured": True,
            "latency_ms": latency_ms,
            "message": f"Search probe failed: {str(e)[:60]}",
            "guidance": "Fallback to RSS and arXiv will be utilized if DuckDuckGo is blocked."
        }


def test_news_integration() -> Dict[str, Any]:
    """Tests Google News RSS feed connection."""
    import feedparser
    t0 = time.perf_counter()
    try:
        url = "https://news.google.com/rss/search?q=technology+India+when:2d&hl=en-IN&gl=IN&ceid=IN:en"
        headers = {"User-Agent": USER_AGENT}
        resp = requests.get(url, headers=headers, timeout=6)
        feed = feedparser.parse(resp.text)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        entries_count = len(feed.entries)
        return {
            "service": "news",
            "display_name": "Google News RSS Stream",
            "status": "connected",
            "configured": True,
            "latency_ms": latency_ms,
            "stories_found": entries_count,
            "message": f"Live Indian news feed accessible ({entries_count} stories found).",
            "guidance": "Provides verified publish dates, source domains, and current news."
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "service": "news",
            "display_name": "Google News RSS Stream",
            "status": "error",
            "configured": True,
            "latency_ms": latency_ms,
            "message": f"News feed error: {str(e)[:60]}",
            "guidance": "Check network connection or try again."
        }


def test_workspace_integration() -> Dict[str, Any]:
    """Tests local sandboxed workspace storage and permissions."""
    t0 = time.perf_counter()
    try:
        WORKSPACE_PATH.mkdir(parents=True, exist_ok=True)
        # Test write and read
        probe_file = WORKSPACE_PATH / ".probe.tmp"
        with open(probe_file, "w", encoding="utf-8") as f:
            f.write("AgentFlow workspace write permission probe")
        with open(probe_file, "r", encoding="utf-8") as f:
            content = f.read()
        probe_file.unlink() # Delete probe

        # Check disk space
        total, used, free = shutil.disk_usage(WORKSPACE_PATH)
        free_gb = round(free / (1024 ** 3), 1)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        return {
            "service": "workspace",
            "display_name": "Sandboxed Workspace Storage",
            "status": "connected",
            "configured": True,
            "latency_ms": latency_ms,
            "path": str(WORKSPACE_PATH),
            "free_space_gb": free_gb,
            "message": f"Workspace sandboxed safely to '{WORKSPACE_PATH.name}/' ({free_gb} GB free).",
            "guidance": "All agent file operations are strictly restricted inside this directory."
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "service": "workspace",
            "display_name": "Sandboxed Workspace Storage",
            "status": "error",
            "configured": True,
            "latency_ms": latency_ms,
            "path": str(WORKSPACE_PATH),
            "message": f"Workspace access error: {str(e)}",
            "guidance": "Ensure application has write permissions to project root."
        }


def test_integration_by_name(service: str) -> Dict[str, Any]:
    """Dispatches test for a specific integration service."""
    testers = {
        "ollama": test_ollama_integration,
        "telegram": test_telegram_integration,
        "email": test_email_integration,
        "search": test_search_integration,
        "news": test_news_integration,
        "workspace": test_workspace_integration,
    }
    tester = testers.get(service.lower())
    if not tester:
        return {"service": service, "status": "unknown", "message": f"No test available for '{service}'."}
    return tester()


def get_all_integrations_summary() -> Dict[str, Any]:
    """Returns quick status of all integrations."""
    services = ["ollama", "telegram", "email", "search", "news", "workspace"]
    results = [test_integration_by_name(s) for s in services]
    connected_count = sum(1 for r in results if r.get("status") == "connected")

    return {
        "total_integrations": len(services),
        "connected_count": connected_count,
        "services": results
    }


# ==========================================
# Workflow Templates Gallery
# ==========================================

from backend.templates_data import BUILTIN_TEMPLATES


def get_curated_workflow_templates() -> List[Dict[str, Any]]:
    """
    Returns curated, ready-to-run workflow templates specifically tailored
    for Indian students, job seekers, and SMB owners.
    """
    return BUILTIN_TEMPLATES

