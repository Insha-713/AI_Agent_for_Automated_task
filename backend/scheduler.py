"""
AgentFlow - Background Scheduler Layer (APScheduler Upgrade - Stage 2)
Coordinates recurring autonomous tasks:
- Hourly, Daily, Weekly, and Custom Cron schedules
- Timezone support (Asia/Kolkata by default, UTC, etc.)
- Pause, Resume, Edit, Cancel, Run-Now
- Next-run time & Last-run status tracking
- Consecutive failure tracking & automated failure alerts
- SQLite persistence surviving restarts
"""

import os
import sys
import re
import json
import uuid
import smtplib
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

# Local imports
from backend.db import (
    create_task,
    record_task_step,
    complete_task,
    create_schedule_record,
    update_schedule_record,
    list_schedules_from_db,
    get_schedule_from_db,
    update_schedule_status_in_db,
    update_schedule_run_times,
    record_schedule_execution_result,
    delete_schedule_from_db,
    get_all_settings,
)
from backend.agent import stream_agent_steps

# Global AsyncIOScheduler instance
scheduler = AsyncIOScheduler()


def get_safe_timezone(tz_name: Optional[str] = None):
    """Resolves a valid ZoneInfo timezone or defaults to Asia/Kolkata."""
    if not tz_name or tz_name.strip() == "":
        tz_name = "Asia/Kolkata"
    try:
        return ZoneInfo(tz_name.strip())
    except Exception:
        return ZoneInfo("Asia/Kolkata")


async def send_failure_notification(schedule_id: str, name: str, prompt: str, error_msg: str, failures_count: int):
    """
    Sends automated failure alert via terminal and email (if credentials are set).
    """
    alert_banner = (
        f"\n=======================================================\n"
        f"🚨 [SCHEDULER FAILURE ALERT] Task '{name}' failed!\n"
        f"Schedule ID: {schedule_id}\n"
        f"Consecutive Failures: {failures_count}\n"
        f"Task Prompt: {prompt}\n"
        f"Error Details: {error_msg}\n"
        f"=======================================================\n"
    )
    print(alert_banner, file=sys.stderr)

    # Attempt email alert if SMTP is configured
    email_user = os.getenv("EMAIL_USER", "").strip()
    email_pass = os.getenv("EMAIL_PASS", "").strip()
    if email_user and email_pass:
        try:
            msg = MIMEMultipart()
            msg["From"] = email_user
            msg["To"] = email_user
            msg["Subject"] = f"🚨 [AgentFlow Alert] Scheduled Task '{name}' Failed (Attempt {failures_count})"
            body = (
                f"Hello,\n\n"
                f"Your recurring scheduled task '{name}' has encountered an execution failure.\n\n"
                f"Task Prompt: {prompt}\n"
                f"Consecutive Failures: {failures_count}\n"
                f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}\n"
                f"Error Message:\n{error_msg}\n\n"
                f"---\nAgentFlow Automated Monitoring"
            )
            msg.attach(MIMEText(body, "plain", "utf-8"))
            loop = asyncio.get_running_loop()

            def _send():
                server = smtplib.SMTP("smtp.gmail.com", 587, timeout=10)
                server.starttls()
                server.login(email_user, email_pass)
                server.send_message(msg)
                server.quit()

            await loop.run_in_executor(None, _send)
            print(f"[Scheduler Alert] Failure notification email sent to {email_user}.")
        except Exception as mail_err:
            print(f"[Scheduler Alert] Failed to send email alert: {mail_err}")


async def execute_scheduled_agent_task(schedule_id: str, prompt: str, name: str):
    """
    Callback invoked by APScheduler when a recurring schedule fires.
    Executes the agent task, logs steps, records outcomes, and triggers alerts on failure.
    """
    task_id = str(uuid.uuid4())
    print(f"\n[Scheduler] Executing scheduled task '{name}' (ID: {schedule_id}, Task: {task_id})...")

    now_str = datetime.now().isoformat()
    await create_task(task_id, f"[Scheduled: {name}] {prompt}")

    # Fetch user memory preferences
    user_prefs = await get_all_settings()

    p_lower = prompt.lower()
    n_lower = name.lower()
    is_news_digest_task = (
        ("news" in n_lower or "news" in p_lower or "briefing" in n_lower) and
        ("telegram" in n_lower or "telegram" in p_lower or "digest" in n_lower or "workspace" in p_lower or "ai_daily_news" in p_lower)
    )

    loop = asyncio.get_running_loop()

    if is_news_digest_task:
        from backend.news_module import generate_daily_ai_news_digest, deliver_news_to_telegram

        def run_news_pipeline():
            steps = []
            sources = []
            start_time = datetime.now()
            status = "completed"

            # Step 1: Start
            steps.append({
                "type": "start",
                "tool": "news_module",
                "content": f"Initializing scheduled news pipeline for '{name}'..."
            })

            # Extract topic from prompt if quotes exist
            topic_match = re.search(r"['\"]([^'\"]+)['\"]", prompt)
            topic = topic_match.group(1) if topic_match else "AI artificial intelligence India"

            # Step 2: Digest generation
            steps.append({
                "type": "tool_call",
                "tool": "generate_daily_ai_news_digest",
                "content": f"Fetching live verified feeds for topic '{topic}'..."
            })
            try:
                digest_data = generate_daily_ai_news_digest(topic=topic, include_arxiv=True)
                formatted_digest = digest_data.get("markdown_digest", "")
                stories = digest_data.get("stories", [])
                sources = [{"title": s.get("title", ""), "domain": s.get("domain", ""), "url": s.get("link", "")} for s in stories]

                steps.append({
                    "type": "tool_result",
                    "tool": "generate_daily_ai_news_digest",
                    "content": f"Compiled {len(stories)} verified stories ({digest_data.get('duplicates_removed', 0)} duplicates removed)."
                })

                # Check workspace save intent
                if "workspace" in p_lower or "ai_daily_news" in p_lower or "save to" in p_lower:
                    steps.append({
                        "type": "tool_call",
                        "tool": "save_file",
                        "content": "Saving digest to workspace/ai_daily_news.txt"
                    })
                    workspace_dir = Path("workspace")
                    workspace_dir.mkdir(parents=True, exist_ok=True)
                    (workspace_dir / "ai_daily_news.txt").write_text(formatted_digest, encoding="utf-8")
                    steps.append({
                        "type": "tool_result",
                        "tool": "save_file",
                        "content": "Successfully saved to workspace/ai_daily_news.txt"
                    })

                # Check Telegram delivery
                telegram_res = None
                if "telegram" in p_lower or "telegram" in n_lower:
                    steps.append({
                        "type": "tool_call",
                        "tool": "send_telegram_message",
                        "content": "Delivering news digest to Telegram..."
                    })
                    telegram_res = deliver_news_to_telegram(formatted_digest)
                    steps.append({
                        "type": "tool_result",
                        "tool": "send_telegram_message",
                        "content": telegram_res.get("result", "")
                    })

                final_answer = formatted_digest
                if telegram_res and not telegram_res.get("success") and not telegram_res.get("mock"):
                    status = "failed"
                    final_answer = f"Telegram delivery failed: {telegram_res.get('result')}"

                steps.append({
                    "type": "final_answer",
                    "tool": "news_module",
                    "content": final_answer
                })

            except Exception as exc:
                status = "failed"
                final_answer = f"Error in scheduled news pipeline: {str(exc)}"
                steps.append({
                    "type": "error",
                    "tool": "news_module",
                    "content": str(exc)
                })

            duration = (datetime.now() - start_time).total_seconds()
            return steps, final_answer, sources, duration, status

        steps, final_answer, sources, duration, status = await loop.run_in_executor(None, run_news_pipeline)
    else:
        # Run agent in executor thread
        def run_agent():
            steps = []
            final_answer = ""
            sources = []
            status = "completed"
            start_time = datetime.now()

            try:
                date_ctx = datetime.now().strftime("%A, %d %B %Y")
                scheduled_prompt = f"[Scheduled Execution on {date_ctx}] {prompt}"
                for step in stream_agent_steps(scheduled_prompt, preferences=user_prefs):
                    steps.append(step)
                    if step.get("type") == "final_answer":
                        final_answer = step.get("content", "")
                        sources = step.get("sources", [])
                    elif step.get("type") == "error":
                        status = "failed"
                        final_answer = step.get("error", "Error during scheduled run")
            except Exception as e:
                status = "failed"
                final_answer = str(e)

            duration = (datetime.now() - start_time).total_seconds()
            return steps, final_answer, sources, duration, status

        steps, final_answer, sources, duration, status = await loop.run_in_executor(None, run_agent)

    # Persist steps into SQLite task_steps
    for idx, s in enumerate(steps, start=1):
        stype = s.get("type", "unknown")
        content = s.get("content") or s.get("result") or s.get("message") or ""
        await record_task_step(task_id, idx, stype, s.get("tool", ""), str(content))

    await complete_task(task_id, status, final_answer, sources, round(duration, 2))

    # Calculate next run time
    job = scheduler.get_job(schedule_id)
    next_run = job.next_run_time.isoformat() if job and getattr(job, "next_run_time", None) else None

    # Record outcome in schedules table
    if status == "completed":
        await record_schedule_execution_result(
            schedule_id=schedule_id,
            status="success",
            error_message="",
            next_run=next_run
        )
        print(f"[Scheduler] Task '{name}' completed successfully in {duration:.1f}s.")
    else:
        sched_rec = await get_schedule_from_db(schedule_id)
        current_fails = (sched_rec.get("consecutive_failures") or 0) + 1 if sched_rec else 1
        await record_schedule_execution_result(
            schedule_id=schedule_id,
            status="failed",
            error_message=final_answer,
            next_run=next_run
        )
        # Trigger failure notification
        await send_failure_notification(schedule_id, name, prompt, final_answer, current_fails)


def parse_schedule_time_params(cron_or_interval: Optional[str], cron_expression: Optional[str] = "") -> Dict[str, Any]:
    """
    Parses hour, minute, and day_of_week from saved cron_or_interval or cron_expression string.
    Example cron_or_interval: "cron[hour='17', minute='0']", "cron[day_of_week='tue', hour='9', minute='30']".
    Example cron_expression: "30 9 * * 2".
    """
    params = {"hour": 8, "minute": 0, "day_of_week": "mon"}
    coi = (cron_or_interval or "").strip()
    ce = (cron_expression or "").strip()

    if coi:
        h_match = re.search(r"hour=['\"]?(\d+)['\"]?", coi)
        if h_match:
            params["hour"] = int(h_match.group(1))

        m_match = re.search(r"minute=['\"]?(\d+)['\"]?", coi)
        if m_match:
            params["minute"] = int(m_match.group(1))

        dow_match = re.search(r"day_of_week=['\"]?([^,'\"]+)['\"]?", coi)
        if dow_match:
            params["day_of_week"] = dow_match.group(1)

    if ce:
        parts = ce.split()
        if len(parts) == 5:
            if parts[0].isdigit():
                params["minute"] = int(parts[0])
            if parts[1].isdigit():
                params["hour"] = int(parts[1])
            if parts[4] != "*":
                params["day_of_week"] = parts[4]

    return params


def _create_trigger(
    frequency: str,
    timezone_str: str = "Asia/Kolkata",
    cron_expression: str = "",
    hour: int = 8,
    minute: int = 0,
    day_of_week: str = "mon"
):
    """
    Generates an APScheduler trigger supporting hourly, daily, weekly, and custom cron expressions.
    """
    tz = get_safe_timezone(timezone_str)
    freq = frequency.lower().strip()

    if freq == "cron" or freq == "custom":
        clean_cron = cron_expression.strip()
        if not clean_cron:
            clean_cron = "0 8 * * *" # Default 8am daily
        return CronTrigger.from_crontab(clean_cron, timezone=tz)

    elif freq == "hourly":
        return IntervalTrigger(hours=1, timezone=tz)

    elif freq == "daily":
        return CronTrigger(hour=hour, minute=minute, timezone=tz)

    elif freq == "weekly":
        return CronTrigger(day_of_week=day_of_week, hour=hour, minute=minute, timezone=tz)

    # Legacy string compatibility
    elif freq == "daily_8am":
        return CronTrigger(hour=8, minute=0, timezone=tz)
    elif freq == "daily_9pm":
        return CronTrigger(hour=21, minute=0, timezone=tz)
    elif freq == "interval_60m":
        return IntervalTrigger(minutes=60, timezone=tz)
    elif freq == "interval_6h":
        return IntervalTrigger(hours=6, timezone=tz)
    elif freq == "interval_1m":
        return IntervalTrigger(minutes=1, timezone=tz)
    elif freq.startswith("every_") and "min" in freq:
        try:
            mins = int(''.join(filter(str.isdigit, freq)))
            return IntervalTrigger(minutes=mins, timezone=tz)
        except Exception:
            return IntervalTrigger(hours=1, timezone=tz)
    else:
        return IntervalTrigger(hours=1, timezone=tz)


async def add_scheduled_task(
    name: str,
    prompt: str,
    frequency: str,
    timezone_str: str = "Asia/Kolkata",
    cron_expression: str = "",
    hour: int = 8,
    minute: int = 0,
    day_of_week: str = "mon"
) -> Dict[str, Any]:
    """Adds a recurring task to APScheduler and persists it in SQLite."""
    schedule_id = str(uuid.uuid4())
    trigger = _create_trigger(
        frequency=frequency,
        timezone_str=timezone_str,
        cron_expression=cron_expression,
        hour=hour,
        minute=minute,
        day_of_week=day_of_week
    )

    job = scheduler.add_job(
        execute_scheduled_agent_task,
        trigger=trigger,
        args=[schedule_id, prompt, name],
        id=schedule_id,
        name=name,
        replace_existing=True
    )

    next_run = job.next_run_time.isoformat() if getattr(job, "next_run_time", None) else None

    record = await create_schedule_record(
        schedule_id=schedule_id,
        name=name,
        prompt=prompt,
        frequency=frequency,
        cron_or_interval=str(trigger),
        next_run=next_run,
        timezone_str=timezone_str,
        cron_expression=cron_expression
    )
    return record


async def edit_scheduled_task(
    schedule_id: str,
    name: str,
    prompt: str,
    frequency: str,
    timezone_str: str = "Asia/Kolkata",
    cron_expression: str = "",
    hour: int = 8,
    minute: int = 0,
    day_of_week: str = "mon"
) -> bool:
    """Updates an existing schedule in APScheduler and SQLite."""
    trigger = _create_trigger(
        frequency=frequency,
        timezone_str=timezone_str,
        cron_expression=cron_expression,
        hour=hour,
        minute=minute,
        day_of_week=day_of_week
    )

    # Reschedule in APScheduler
    try:
        job = scheduler.add_job(
            execute_scheduled_agent_task,
            trigger=trigger,
            args=[schedule_id, prompt, name],
            id=schedule_id,
            name=name,
            replace_existing=True
        )
        next_run = job.next_run_time.isoformat() if getattr(job, "next_run_time", None) else None
    except Exception as e:
        print(f"[Scheduler] Notice updating job in APScheduler: {e}")
        next_run = None

    return await update_schedule_record(
        schedule_id=schedule_id,
        name=name,
        prompt=prompt,
        frequency=frequency,
        cron_or_interval=str(trigger),
        next_run=next_run,
        timezone_str=timezone_str,
        cron_expression=cron_expression
    )


async def pause_scheduled_task(schedule_id: str) -> bool:
    """Pauses a running schedule in APScheduler and updates SQLite."""
    try:
        scheduler.pause_job(schedule_id)
    except Exception as e:
        print(f"[Scheduler] Notice pausing job: {e}")
    return await update_schedule_status_in_db(schedule_id, "paused")


async def resume_scheduled_task(schedule_id: str) -> bool:
    """Resumes a paused schedule in APScheduler and updates SQLite."""
    try:
        scheduler.resume_job(schedule_id)
        job = scheduler.get_job(schedule_id)
        if job and getattr(job, "next_run_time", None):
            await update_schedule_run_times(schedule_id, last_run=datetime.now().isoformat(), next_run=job.next_run_time.isoformat())
    except Exception as e:
        print(f"[Scheduler] Notice resuming job: {e}")
    return await update_schedule_status_in_db(schedule_id, "active")


async def delete_scheduled_task(schedule_id: str) -> bool:
    """Deletes a schedule from APScheduler and SQLite."""
    try:
        scheduler.remove_job(schedule_id)
    except Exception as e:
        print(f"[Scheduler] Notice removing job: {e}")
    return await delete_schedule_from_db(schedule_id)


async def run_scheduled_task_now(schedule_id: str) -> bool:
    """Triggers immediate on-demand execution of a scheduled task."""
    record = await get_schedule_from_db(schedule_id)
    if not record:
        return False

    asyncio.create_task(
        execute_scheduled_agent_task(
            schedule_id=schedule_id,
            prompt=record["prompt"],
            name=record["name"]
        )
    )
    return True


async def start_scheduler():
    """Starts the APScheduler and restores active jobs from SQLite."""
    if not scheduler.running:
        scheduler.start()
        print("[Scheduler] APScheduler started.")

    saved_schedules = await list_schedules_from_db()
    for s in saved_schedules:
        if s.get("status") == "active":
            sid = s["id"]
            if not scheduler.get_job(sid):
                time_params = parse_schedule_time_params(
                    cron_or_interval=s.get("cron_or_interval", ""),
                    cron_expression=s.get("cron_expression", "")
                )
                trigger = _create_trigger(
                    frequency=s.get("frequency", "interval_60m"),
                    timezone_str=s.get("timezone", "Asia/Kolkata"),
                    cron_expression=s.get("cron_expression", ""),
                    hour=time_params["hour"],
                    minute=time_params["minute"],
                    day_of_week=time_params["day_of_week"]
                )
                scheduler.add_job(
                    execute_scheduled_agent_task,
                    trigger=trigger,
                    args=[sid, s["prompt"], s["name"]],
                    id=sid,
                    name=s["name"],
                    replace_existing=True
                )
                print(f"[Scheduler] Re-hydrated schedule '{s['name']}' ({sid}) with frequency '{s.get('frequency')}' (hour={time_params['hour']}, min={time_params['minute']}) in {s.get('timezone', 'Asia/Kolkata')}.")

    # Periodic Website Monitoring Sentinel (every 15 minutes)
    if not scheduler.get_job("system_website_monitor"):
        from backend.monitors import check_all_monitors_now

        async def _run_monitoring():
            try:
                await check_all_monitors_now()
            except Exception as e:
                print(f"[Scheduler] Website monitor check notice: {e}")

        scheduler.add_job(
            _run_monitoring,
            trigger="interval",
            minutes=15,
            id="system_website_monitor",
            name="System Website Monitoring Sentinel",
            replace_existing=True
        )
        print("[Scheduler] Website Monitoring Sentinel registered (15m interval).")

    # Daily Career Job Alert Sentinel (runs daily at 08:00 AM Asia/Kolkata)
    if not scheduler.get_job("system_career_job_alerts"):
        from backend.career import run_daily_job_alerts

        async def _run_career_alerts():
            try:
                print("[Scheduler] Executing scheduled Daily Career Job Alerts...")
                res = await run_daily_job_alerts()
                print(f"[Scheduler] Daily Career Job Alerts completed: {res.get('status')}")
            except Exception as e:
                print(f"[Scheduler] Daily Career Job Alerts notice: {e}")

        scheduler.add_job(
            _run_career_alerts,
            trigger=CronTrigger(hour=8, minute=0, timezone=get_safe_timezone("Asia/Kolkata")),
            id="system_career_job_alerts",
            name="Daily Career Job Alerts Sentinel",
            replace_existing=True
        )
        print("[Scheduler] Daily Career Job Alerts Sentinel registered (08:00 IST).")

    # Autonomous Social Media Auto-Publisher Sentinel (checks every 5 minutes in Asia/Kolkata)
    if not scheduler.get_job("system_social_media_publisher"):
        from backend.db import (
            list_social_posts, 
            update_social_post_status, 
            update_social_post_schedule, 
            claim_scheduled_social_post
        )
        from backend.platform_engine import (
            LinkedInAdapter, 
            compute_next_occurrence
        )

        async def _run_social_publishing():
            try:
                now_utc = datetime.now(timezone.utc)
                now_iso = now_utc.isoformat()
                scheduled_posts = await list_social_posts(status="scheduled", limit=50)

                for post in scheduled_posts:
                    post_id = post["id"]

                    # 1. Approval Gate: Never publish if approval is required and post is unapproved
                    if post.get("approval_required") and not post.get("approved_at"):
                        await update_social_post_status(post_id, "pending_approval")
                        continue

                    # 2. Auto-publish toggle: must be explicitly enabled
                    if not post.get("auto_publish"):
                        continue

                    # 3. Check scheduled execution time
                    sched_time_str = post.get("next_run_at") or post.get("scheduled_for")
                    if not sched_time_str:
                        continue

                    try:
                        sched_dt = datetime.fromisoformat(sched_time_str.replace("Z", "+00:00"))
                        if sched_dt.tzinfo is None:
                            sched_dt = sched_dt.replace(tzinfo=timezone.utc)
                    except Exception:
                        continue

                    if sched_dt > now_utc:
                        # Execution time has not arrived yet
                        continue

                    # 4. Atomic claim to prevent duplicate / concurrent publishing
                    claimed = await claim_scheduled_social_post(post_id)
                    if not claimed:
                        continue

                    # 5. Dispatch post
                    plat = (post.get("platform") or "linkedin").lower().strip()
                    content = post.get("content", "")
                    if post.get("hashtags"):
                        if isinstance(post["hashtags"], list):
                            ht_str = " ".join(post["hashtags"])
                        else:
                            ht_str = str(post["hashtags"])
                        if ht_str and ht_str not in content:
                            content = f"{content}\n\n{ht_str}"

                    if plat == "linkedin":
                        media_urls = post.get("media_urls") or []
                        media_url = media_urls[0] if media_urls else None
                        res = await asyncio.to_thread(LinkedInAdapter.publish_ugc_post, content=content, media_url=media_url)
                    else:
                        res = {"success": False, "status": "unsupported", "error": f"Direct publishing not supported for '{plat}'"}

                    # 6. Result handling & recurrence
                    if res.get("success"):
                        frequency = post.get("frequency") or "one_time"
                        next_occurrence = compute_next_occurrence(
                            current_utc_iso=sched_time_str,
                            frequency=frequency,
                            tz_name=post.get("timezone", "Asia/Kolkata"),
                            end_date_str=post.get("end_date")
                        )

                        if next_occurrence:
                            next_status = "pending_approval" if post.get("approval_required") else "scheduled"
                            await update_social_post_schedule(
                                post_id=post_id,
                                status=next_status,
                                scheduled_for=next_occurrence,
                                next_run_at=next_occurrence,
                                approved_at="" if post.get("approval_required") else post.get("approved_at", ""),
                                external_post_id=res.get("post_id", "")
                            )
                            print(f"[Scheduler] Recurring post {post_id} published to {plat}. Next run: {next_occurrence} ({next_status})")
                        else:
                            await update_social_post_status(post_id, "published", external_post_id=res.get("post_id", ""))
                            print(f"[Scheduler] Successfully published post {post_id} to {plat}: {res.get('post_url')}")
                    else:
                        err_msg = res.get("error", "Autonomous scheduled publish failed")
                        await update_social_post_status(post_id, "failed", error_message=err_msg)
                        print(f"[Scheduler] Notice: Failed to auto-publish post {post_id} to {plat}: {err_msg}")

                # 7. LinkedIn Auto-Generation Check (Autonomous daily researched content creation)
                try:
                    from backend.db import get_linkedin_preferences, list_social_posts
                    from backend.platform_engine import LinkedInContentEngine
                    prefs = await get_linkedin_preferences()
                    if prefs.get("auto_generate_daily"):
                        recent_posts = await list_social_posts(platform="linkedin", limit=5)
                        should_generate = True
                        if recent_posts:
                            latest_post = recent_posts[0]
                            created_str = latest_post.get("created_at")
                            if created_str:
                                try:
                                    created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                                    if created_dt.tzinfo is None:
                                        created_dt = created_dt.replace(tzinfo=timezone.utc)
                                    hours_diff = (now_utc - created_dt).total_seconds() / 3600.0
                                    if hours_diff < 20.0:
                                        should_generate = False
                                except Exception:
                                    pass
                        if should_generate:
                            print("[Scheduler] Auto-generating daily researched LinkedIn post based on user content direction...")
                            auto_res = await LinkedInContentEngine.research_and_generate_complete_post(
                                generate_image=True,
                                auto_save_draft=True
                            )
                            print(f"[Scheduler] Daily post generated: {auto_res.get('post_id')}")
                except Exception as auto_err:
                    print(f"[Scheduler] Daily auto-generation notice: {auto_err}")
            except Exception as e:
                print(f"[Scheduler] Social Media Publisher notice: {e}")

        scheduler.add_job(
            _run_social_publishing,
            trigger="interval",
            minutes=5,
            id="system_social_media_publisher",
            name="Autonomous Social Media Auto-Publisher Sentinel",
            replace_existing=True
        )
        print("[Scheduler] Autonomous Social Media Auto-Publisher Sentinel registered (5m interval).")


async def run_social_publishing_cycle():
    """Manual trigger for the social media auto-publisher sentinel."""
    job = scheduler.get_job("system_social_media_publisher")
    if job and job.func:
        return await job.func()



def shutdown_scheduler():
    """Gracefully shuts down APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[Scheduler] APScheduler shut down.")
