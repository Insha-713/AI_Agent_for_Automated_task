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
import uuid
import smtplib
import asyncio
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

    # Run agent in executor thread
    loop = asyncio.get_running_loop()

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
    next_run = job.next_run_time.isoformat() if job and job.next_run_time else None

    # Record outcome in schedules table
    if status == "completed":
        await record_schedule_execution_result(
            schedule_id=schedule_id,
            status="success",
            last_run=now_str,
            next_run=next_run
        )
        print(f"[Scheduler] Task '{name}' completed successfully in {duration:.1f}s.")
    else:
        sched_rec = await get_schedule_from_db(schedule_id)
        current_fails = (sched_rec.get("consecutive_failures") or 0) + 1 if sched_rec else 1
        await record_schedule_execution_result(
            schedule_id=schedule_id,
            status="failed",
            last_run=now_str,
            next_run=next_run,
            error_msg=final_answer
        )
        # Trigger failure notification
        await send_failure_notification(schedule_id, name, prompt, final_answer, current_fails)


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
        return IntervalTrigger(hours=max(1, hour), timezone=tz)

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

    next_run = job.next_run_time.isoformat() if job.next_run_time else None

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
        next_run = job.next_run_time.isoformat() if job.next_run_time else None
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
        if job and job.next_run_time:
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
                trigger = _create_trigger(
                    frequency=s.get("frequency", "interval_60m"),
                    timezone_str=s.get("timezone", "Asia/Kolkata"),
                    cron_expression=s.get("cron_expression", "")
                )
                scheduler.add_job(
                    execute_scheduled_agent_task,
                    trigger=trigger,
                    args=[sid, s["prompt"], s["name"]],
                    id=sid,
                    name=s["name"],
                    replace_existing=True
                )
                print(f"[Scheduler] Re-hydrated schedule '{s['name']}' ({sid}) with timezone {s.get('timezone', 'Asia/Kolkata')}.")

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



def shutdown_scheduler():
    """Gracefully shuts down APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[Scheduler] APScheduler shut down.")
