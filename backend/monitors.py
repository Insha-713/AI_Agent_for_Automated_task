"""
AgentFlow - Website Monitoring Module (Stage 5)
Automated uptime, HTTP status code, and latency checks on schedule.
Detects repeated consecutive failures, latency degradation, and dispatches alerts.
Designed for Indian SMBs, colleges, and digital agencies with zero paid APIs.
"""

import os
import time
import requests
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

from backend.db import (
    get_monitor_by_id,
    list_all_monitors,
    update_monitor_status,
    record_monitor_log,
    get_monitor_logs,
)
from backend.news_module import deliver_news_to_telegram

IST = timezone(timedelta(hours=5, minutes=30))
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AgentFlow-Monitor/2.0"


def perform_health_check(
    url: str,
    expected_status: int = 200,
    timeout: int = 10
) -> Dict[str, Any]:
    """
    Performs an accurate network health check measuring latency in milliseconds.
    Gracefully handles SSL, DNS, timeouts, and server errors.
    """
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    start_time = time.perf_counter()
    status = "down"
    status_code = 0
    latency_ms = 0.0
    error_msg = ""

    try:
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "*/*"
        }
        connect_to = min(float(timeout), 3.0)
        read_to = min(float(timeout), 5.0)
        resp = requests.get(clean_url, headers=headers, timeout=(connect_to, read_to), allow_redirects=True)

        elapsed = time.perf_counter() - start_time
        latency_ms = round(elapsed * 1000, 1)
        status_code = resp.status_code
        resp.close()

        # Status determination
        if status_code == expected_status or (200 <= status_code < 400):
            if latency_ms > 3500:
                status = "degraded"
            else:
                status = "up"
        elif 400 <= status_code < 500:
            status = "degraded"
            error_msg = f"HTTP Client Error: {status_code}"
        else:
            status = "down"
            error_msg = f"HTTP Server Error: {status_code}"

    except requests.exceptions.Timeout:
        elapsed = time.perf_counter() - start_time
        latency_ms = round(elapsed * 1000, 1)
        status = "down"
        status_code = 408
        error_msg = f"Connection timed out after {timeout}s"
    except requests.exceptions.SSLError as ssl_err:
        elapsed = time.perf_counter() - start_time
        latency_ms = round(elapsed * 1000, 1)
        status = "down"
        status_code = 525
        error_msg = f"SSL Handshake Failed: {str(ssl_err)[:60]}"
    except requests.exceptions.ConnectionError as conn_err:
        elapsed = time.perf_counter() - start_time
        latency_ms = round(elapsed * 1000, 1)
        status = "down"
        status_code = 503
        error_msg = "Connection Refused or Host Unreachable"
    except Exception as e:
        elapsed = time.perf_counter() - start_time
        latency_ms = round(elapsed * 1000, 1)
        status = "down"
        status_code = 500
        error_msg = str(e)[:80]

    return {
        "url": clean_url,
        "status": status,
        "status_code": status_code,
        "latency_ms": latency_ms,
        "error_message": error_msg,
        "checked_at": datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")
    }


async def execute_monitor_check(monitor: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes a health check for a given monitor, records the result log,
    updates consecutive failure counts, and triggers alerts if threshold breached.
    """
    monitor_id = monitor["id"]
    url = monitor["url"]
    expected_status = monitor.get("expected_status", 200)
    timeout = monitor.get("timeout_seconds", 10)
    threshold = monitor.get("failure_threshold", 3)
    prev_failures = monitor.get("consecutive_failures", 0)

    # Perform network probe
    result = perform_health_check(url, expected_status=expected_status, timeout=timeout)
    status = result["status"]
    status_code = result["status_code"]
    latency_ms = result["latency_ms"]
    error_msg = result["error_message"]

    # Calculate consecutive failures
    new_failures = prev_failures + 1 if status == "down" else 0

    # Persist log & update monitor record
    await record_monitor_log(
        monitor_id=monitor_id,
        status=status,
        status_code=status_code,
        latency_ms=latency_ms,
        error_message=error_msg
    )

    await update_monitor_status(
        monitor_id=monitor_id,
        status=status,
        status_code=status_code,
        latency_ms=latency_ms,
        error_message=error_msg,
        consecutive_failures=new_failures
    )

    # Check for incident alerting
    alert_dispatched = False
    if status == "down" and new_failures >= threshold:
        alert_msg = (
            f"🚨 *AGENTFLOW MONITOR INCIDENT ALERT*\n\n"
            f"• *Service:* {monitor['name']}\n"
            f"• *URL:* {url}\n"
            f"• *Status Code:* `{status_code}`\n"
            f"• *Consecutive Failures:* {new_failures} (Threshold: {threshold})\n"
            f"• *Error:* {error_msg}\n"
            f"• *Time:* {result['checked_at']}\n\n"
            f"_Automated check triggered by AgentFlow Uptime Sentinel._"
        )
        deliver_news_to_telegram(alert_msg)
        alert_dispatched = True

    # Recovery alert
    elif prev_failures >= threshold and status == "up":
        recovery_msg = (
            f"✅ *AGENTFLOW SERVICE RECOVERY NOTICE*\n\n"
            f"• *Service:* {monitor['name']}\n"
            f"• *URL:* {url}\n"
            f"• *Status:* Operational (HTTP {status_code})\n"
            f"• *Response Time:* {latency_ms} ms\n"
            f"• *Time:* {result['checked_at']}\n\n"
            f"_Service has recovered and is healthy._"
        )
        deliver_news_to_telegram(recovery_msg)
        alert_dispatched = True

    return {
        "monitor_id": monitor_id,
        "name": monitor["name"],
        "url": url,
        "status": status,
        "status_code": status_code,
        "latency_ms": latency_ms,
        "error_message": error_msg,
        "consecutive_failures": new_failures,
        "alert_dispatched": alert_dispatched,
        "checked_at": result["checked_at"]
    }


async def check_all_monitors_now() -> List[Dict[str, Any]]:
    """Runs health check for all active monitors."""
    monitors = await list_all_monitors()
    active_monitors = [m for m in monitors if m.get("is_active", 1)]
    results = []
    for m in active_monitors:
        res = await execute_monitor_check(m)
        results.append(res)
    return results


def compute_monitoring_kpis(monitors: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Computes high-level health metrics across all monitored endpoints."""
    total = len(monitors)
    if total == 0:
        return {
            "total_monitors": 0,
            "up_count": 0,
            "degraded_count": 0,
            "down_count": 0,
            "uptime_percentage": 100.0,
            "avg_latency_ms": 0.0,
            "active_incidents": 0
        }

    up_count = sum(1 for m in monitors if m.get("last_status") == "up")
    degraded_count = sum(1 for m in monitors if m.get("last_status") == "degraded")
    down_count = sum(1 for m in monitors if m.get("last_status") == "down")

    latencies = [
        m.get("last_latency_ms", 0.0)
        for m in monitors
        if m.get("last_status") in ("up", "degraded") and m.get("last_latency_ms", 0.0) > 0
    ]
    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0.0
    uptime_pct = round(((up_count + (degraded_count * 0.5)) / total) * 100, 1)
    active_incidents = sum(1 for m in monitors if m.get("consecutive_failures", 0) >= m.get("failure_threshold", 3))

    return {
        "total_monitors": total,
        "up_count": up_count,
        "degraded_count": degraded_count,
        "down_count": down_count,
        "uptime_percentage": uptime_pct,
        "avg_latency_ms": avg_latency,
        "active_incidents": active_incidents
    }
