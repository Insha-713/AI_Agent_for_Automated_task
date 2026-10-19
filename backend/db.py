"""
AgentFlow - Database Layer (SQLite with aiosqlite)
Stores task history, execution steps, tool usage, and user preferences.
"""

import os
import json
import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import aiosqlite
from dotenv import load_dotenv
from backend.templates_data import BUILTIN_TEMPLATES

load_dotenv()

# Resolve database file path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = os.getenv("DB_PATH", str(PROJECT_ROOT / "backend" / "agentflow.db"))


from contextlib import asynccontextmanager

@asynccontextmanager
async def get_db():
    """Async context manager that yields a connected aiosqlite DB and ensures it is closed."""
    db = await aiosqlite.connect(DB_FILE)
    await db.execute("PRAGMA foreign_keys = ON;")
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def init_db():
    """Initializes SQLite database schemas for tasks, steps, and settings."""
    async with get_db() as db:
        # Tasks table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
                final_answer TEXT DEFAULT '',
                sources TEXT DEFAULT '[]', -- JSON string of URLs
                duration_seconds REAL DEFAULT 0.0,
                deep_research INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );
        """)
        try:
            await db.execute("ALTER TABLE tasks ADD COLUMN deep_research INTEGER DEFAULT 0;")
        except Exception:
            pass

        # Task steps table (streaming timeline)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS task_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                step_index INTEGER NOT NULL,
                step_type TEXT NOT NULL, -- start, thought, tool_call, tool_result, final_answer, error, research_progress
                tool_name TEXT DEFAULT '',
                content TEXT DEFAULT '', -- JSON or plain text
                created_at TEXT NOT NULL,
                FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
            );
        """)

        # User memory & settings table (for Stage 5 & preferences)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Seed default preferences if not present
        default_settings = [
            ("user_name", "User"),
            ("default_email", ""),
            ("writing_style", "professional and concise"),
            ("language_preference", "English")
        ]
        now_str = datetime.now().isoformat()
        for key, val in default_settings:
            await db.execute("""
                INSERT OR IGNORE INTO user_settings (key, value, updated_at)
                VALUES (?, ?, ?)
            """, (key, val, now_str))

        # Approvals table for Human-in-the-loop actions
        await db.execute("""
            CREATE TABLE IF NOT EXISTS approvals (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                action_type TEXT NOT NULL, -- send_email, overwrite_file
                tool_name TEXT NOT NULL,
                parameters TEXT NOT NULL,
                details TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
                created_at TEXT NOT NULL,
                resolved_at TEXT,
                FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
            );
        """)

        # Scheduled recurring tasks table (APScheduler)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                prompt TEXT NOT NULL,
                frequency TEXT NOT NULL, -- daily_8am, daily_9pm, interval_60m, interval_6h
                cron_or_interval TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active', -- active, paused
                last_run TEXT,
                next_run TEXT,
                timezone TEXT DEFAULT 'Asia/Kolkata',
                cron_expression TEXT DEFAULT '',
                last_status TEXT DEFAULT 'pending',
                consecutive_failures INTEGER DEFAULT 0,
                last_error TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );
        """)

        # Backward compatibility column migrations for existing databases
        for col_def in [
            "timezone TEXT DEFAULT 'Asia/Kolkata'",
            "cron_expression TEXT DEFAULT ''",
            "last_status TEXT DEFAULT 'pending'",
            "consecutive_failures INTEGER DEFAULT 0",
            "last_error TEXT DEFAULT ''"
        ]:
            try:
                await db.execute(f"ALTER TABLE schedules ADD COLUMN {col_def};")
            except Exception:
                pass

        # Workflows table (Prompt-to-Workflow Engine)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                prompt TEXT NOT NULL,
                plan_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft', -- draft, ready, running, completed, failed
                dry_run INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Workflow execution runs and step logs
        await db.execute("""
            CREATE TABLE IF NOT EXISTS workflow_runs (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
                step_results TEXT DEFAULT '{}',
                step_logs TEXT DEFAULT '[]',
                duration_seconds REAL DEFAULT 0.0,
                dry_run INTEGER DEFAULT 0,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
            );
        """)

        # Website monitors table (Stage 5 Website Monitoring)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS monitors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                expected_status INTEGER DEFAULT 200,
                timeout_seconds INTEGER DEFAULT 10,
                interval_minutes INTEGER DEFAULT 30,
                is_active INTEGER DEFAULT 1,
                last_status TEXT DEFAULT 'pending', -- up, down, degraded, pending
                last_status_code INTEGER DEFAULT 0,
                last_latency_ms REAL DEFAULT 0.0,
                last_checked_at TEXT,
                consecutive_failures INTEGER DEFAULT 0,
                failure_threshold INTEGER DEFAULT 3,
                last_error TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );
        """)

        # Monitor Logs table for latency history & sparkline charts
        await db.execute("""
            CREATE TABLE IF NOT EXISTS monitor_logs (
                id TEXT PRIMARY KEY,
                monitor_id TEXT NOT NULL,
                status TEXT NOT NULL, -- up, down, degraded
                status_code INTEGER,
                latency_ms REAL,
                error_message TEXT DEFAULT '',
                checked_at TEXT NOT NULL,
                FOREIGN KEY (monitor_id) REFERENCES monitors (id) ON DELETE CASCADE
            );
        """)

        # Seed default monitors if none exist
        cursor = await db.execute("SELECT COUNT(*) FROM monitors;")
        count_res = await cursor.fetchone()
        if count_res and count_res[0] == 0:
            now_iso = datetime.now().isoformat()
            default_monitors = [
                ("mon-npci-upi", "NPCI UPI Ecosystem", "https://www.npci.org.in", 200, 10, 15, 1, 3, now_iso),
                ("mon-google-in", "Google India", "https://www.google.co.in", 200, 10, 30, 1, 3, now_iso),
                ("mon-github-status", "GitHub Platform Status", "https://www.githubstatus.com", 200, 10, 30, 1, 3, now_iso),
                ("mon-pypi", "Python PyPI Package Index", "https://pypi.org", 200, 10, 60, 1, 3, now_iso)
            ]
            for m in default_monitors:
                await db.execute("""
                    INSERT INTO monitors (id, name, url, expected_status, timeout_seconds, interval_minutes, is_active, failure_threshold, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, m)

        # Workflow Templates table (Stage 6)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                prompt TEXT NOT NULL,
                tools_used TEXT NOT NULL,
                required_credentials TEXT NOT NULL,
                default_inputs TEXT DEFAULT '{}',
                requires_approval INTEGER DEFAULT 1,
                is_builtin INTEGER DEFAULT 1,
                plan_json TEXT DEFAULT '{}',
                icon TEXT DEFAULT 'Layers',
                badge TEXT DEFAULT 'Curated',
                created_at TEXT NOT NULL
            );
        """)

        # Migration columns if needed
        for col_def in [
            "plan_json TEXT DEFAULT '{}'",
            "icon TEXT DEFAULT 'Layers'",
            "badge TEXT DEFAULT 'Curated'",
            "is_builtin INTEGER DEFAULT 1"
        ]:
            try:
                await db.execute(f"ALTER TABLE templates ADD COLUMN {col_def};")
            except Exception:
                pass

        # Seed built-in templates (INSERT OR IGNORE preserves existing & never duplicates)
        now_iso = datetime.now().isoformat()
        for tpl in BUILTIN_TEMPLATES:
            await db.execute("""
                INSERT INTO templates (
                    id, title, description, category, prompt, tools_used,
                    required_credentials, default_inputs, requires_approval,
                    is_builtin, plan_json, icon, badge, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    category = excluded.category,
                    prompt = excluded.prompt,
                    tools_used = excluded.tools_used,
                    required_credentials = excluded.required_credentials,
                    default_inputs = excluded.default_inputs,
                    requires_approval = excluded.requires_approval,
                    is_builtin = 1,
                    plan_json = excluded.plan_json,
                    icon = excluded.icon,
                    badge = excluded.badge;
            """, (
                tpl["id"],
                tpl["title"],
                tpl["description"],
                tpl["category"],
                tpl["prompt"],
                json.dumps(tpl["tools_used"]),
                json.dumps(tpl["required_credentials"]),
                json.dumps(tpl.get("default_inputs", {})),
                1 if tpl.get("requires_approval", True) else 0,
                json.dumps(tpl.get("plan", {})),
                tpl.get("icon", "Layers"),
                tpl.get("badge", "Curated"),
                now_iso
            ))

        await db.commit()

        # Startup count check
        cursor = await db.execute("SELECT COUNT(*) FROM templates;")
        count_res = await cursor.fetchone()
        tpl_count = count_res[0] if count_res else 0
        print(f"Templates available: {tpl_count}", flush=True)


async def create_task(task_id: str, prompt: str, deep_research: bool = False) -> Dict[str, Any]:
    """Records a new task in pending state."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO tasks (id, prompt, status, deep_research, created_at)
            VALUES (?, ?, 'pending', ?, ?)
        """, (task_id, prompt, 1 if deep_research else 0, now_str))
        await db.commit()
    return {
        "id": task_id,
        "prompt": prompt,
        "status": "pending",
        "deep_research": deep_research,
        "created_at": now_str
    }


async def update_task_status(task_id: str, status: str):
    """Updates the status of a task."""
    async with get_db() as db:
        await db.execute("""
            UPDATE tasks SET status = ? WHERE id = ?
        """, (status, task_id))
        await db.commit()


async def record_task_step(
    task_id: str,
    step_index: int,
    step_type: str,
    tool_name: str = "",
    content: str = ""
):
    """Records a single step (thought, tool call, tool result) in the timeline."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO task_steps (task_id, step_index, step_type, tool_name, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (task_id, step_index, step_type, tool_name, content, now_str))
        await db.commit()


async def complete_task(
    task_id: str,
    status: str,
    final_answer: str,
    sources: List[str],
    duration_seconds: float
):
    """Marks task as completed or failed and saves final results."""
    now_str = datetime.now().isoformat()
    sources_json = json.dumps(sources)
    async with get_db() as db:
        await db.execute("""
            UPDATE tasks
            SET status = ?,
                final_answer = ?,
                sources = ?,
                duration_seconds = ?,
                completed_at = ?
            WHERE id = ?
        """, (status, final_answer, sources_json, duration_seconds, now_str, task_id))
        await db.commit()


async def get_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a single task along with all its recorded execution steps."""
    async with get_db() as db:
        task_cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        task_row = await task_cursor.fetchone()
        if not task_row:
            return None

        task_dict = dict(task_row)
        try:
            task_dict["sources"] = json.loads(task_dict.get("sources") or "[]")
        except Exception:
            task_dict["sources"] = []

        steps_cursor = await db.execute(
            "SELECT * FROM task_steps WHERE task_id = ? ORDER BY step_index ASC, id ASC",
            (task_id,)
        )
        step_rows = await steps_cursor.fetchall()
        task_dict["steps"] = [dict(s) for s in step_rows]

        return task_dict


async def list_recent_tasks(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    """Lists recent tasks with summary metrics for the history page."""
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT id, prompt, status, final_answer, sources, duration_seconds, created_at, completed_at
            FROM tasks
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """, (limit, offset))
        rows = await cursor.fetchall()
        tasks = []
        for r in rows:
            td = dict(r)
            try:
                td["sources"] = json.loads(td.get("sources") or "[]")
            except Exception:
                td["sources"] = []
            tasks.append(td)
        return tasks


async def delete_task_by_id(task_id: str) -> bool:
    """Deletes a task and all associated steps from SQLite."""
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        await db.commit()
        return cursor.rowcount > 0


async def get_all_settings() -> Dict[str, str]:
    """Retrieves all user settings/preferences from SQLite."""
    async with get_db() as db:
        cursor = await db.execute("SELECT key, value FROM user_settings")
        rows = await cursor.fetchall()
        return {r["key"]: r["value"] for r in rows}


async def create_approval_record(
    approval_id: str,
    task_id: str,
    action_type: str,
    tool_name: str,
    parameters: Dict[str, Any],
    details: str
):
    """Creates a pending human-in-the-loop approval record in SQLite."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO approvals (id, task_id, action_type, tool_name, parameters, details, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        """, (approval_id, task_id, action_type, tool_name, json.dumps(parameters), details, now_str))
        await db.commit()


async def resolve_approval_record(approval_id: str, decision: str) -> bool:
    """Updates the status of an approval record to approved or rejected."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE approvals
            SET status = ?, resolved_at = ?
            WHERE id = ?
        """, (decision, now_str, approval_id))
        await db.commit()
        return cursor.rowcount > 0


async def get_approval_by_id(approval_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves an approval record by its ID."""
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        ad = dict(row)
        try:
            ad["parameters"] = json.loads(ad.get("parameters") or "{}")
        except Exception:
            ad["parameters"] = {}
        return ad


async def update_setting(key: str, value: str):
    """Updates or inserts a user setting in SQLite."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO user_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """, (key, value, now_str))
        await db.commit()


async def get_dashboard_metrics() -> Dict[str, Any]:
    """
    Computes dashboard analytics:
    - Total tasks run
    - Success rate (%)
    - Most used tools breakdown
    - Estimated time saved (minutes)
    """
    async with get_db() as db:
        # Total tasks
        cursor = await db.execute("SELECT COUNT(*) as total FROM tasks")
        row = await cursor.fetchone()
        total_tasks = row["total"] if row else 0

        # Completed tasks
        cursor = await db.execute("SELECT COUNT(*) as completed FROM tasks WHERE status = 'completed'")
        row = await cursor.fetchone()
        completed_tasks = row["completed"] if row else 0

        success_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 100.0

        # Tool usage frequency
        cursor = await db.execute("""
            SELECT tool_name, COUNT(*) as count
            FROM task_steps
            WHERE step_type = 'tool_call' AND tool_name != ''
            GROUP BY tool_name
            ORDER BY count DESC
        """)
        tool_rows = await cursor.fetchall()
        tool_counts = [{"tool": r["tool_name"], "count": r["count"]} for r in tool_rows]

        # Estimated time saved: assume average digital task manual execution takes 8 minutes
        # Agent execution saves (8 minutes - duration)
        cursor = await db.execute("SELECT SUM(duration_seconds) as total_dur FROM tasks WHERE status = 'completed'")
        row = await cursor.fetchone()
        total_agent_seconds = row["total_dur"] if row and row["total_dur"] else 0.0
        
        # 8 minutes per task manual equivalent
        manual_estimated_minutes = completed_tasks * 8.0
        agent_minutes = total_agent_seconds / 60.0
        saved_minutes = max(0.0, round(manual_estimated_minutes - agent_minutes, 1))

        # Daily tasks timeline (last 7 entries)
        cursor = await db.execute("""
            SELECT substr(created_at, 1, 10) as date,
                   COUNT(*) as total,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM tasks
            GROUP BY substr(created_at, 1, 10)
            ORDER BY date ASC
            LIMIT 7
        """)
        timeline_rows = await cursor.fetchall()
        tasks_timeline = [
            {"date": r["date"] or "Today", "total": r["total"], "completed": r["completed"] or 0}
            for r in timeline_rows
        ]
        if not tasks_timeline:
            tasks_timeline = [{"date": "Today", "total": total_tasks, "completed": completed_tasks}]

        # Financial savings in INR (estimated ₹500/hr value for digital work in India)
        financial_savings_inr = int((saved_minutes / 60.0) * 500)

        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "success_rate": success_rate,
            "tool_usage": tool_counts,
            "estimated_minutes_saved": saved_minutes,
            "hours_saved": round(saved_minutes / 60.0, 1),
            "financial_savings_inr": financial_savings_inr,
            "tasks_timeline": tasks_timeline
        }


async def create_schedule_record(
    schedule_id: str,
    name: str,
    prompt: str,
    frequency: str,
    cron_or_interval: str,
    next_run: Optional[str] = None,
    timezone_str: str = "Asia/Kolkata",
    cron_expression: str = ""
) -> Dict[str, Any]:
    """Saves a new recurring schedule into SQLite."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO schedules (
                id, name, prompt, frequency, cron_or_interval, status, next_run, 
                timezone, cron_expression, last_status, consecutive_failures, created_at
            )
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, 'pending', 0, ?)
        """, (schedule_id, name, prompt, frequency, cron_or_interval, next_run, timezone_str, cron_expression, now_str))
        await db.commit()
    return {
        "id": schedule_id,
        "name": name,
        "prompt": prompt,
        "frequency": frequency,
        "cron_or_interval": cron_or_interval,
        "status": "active",
        "next_run": next_run,
        "timezone": timezone_str,
        "cron_expression": cron_expression,
        "last_status": "pending",
        "consecutive_failures": 0,
        "created_at": now_str
    }


async def update_schedule_record(
    schedule_id: str,
    name: str,
    prompt: str,
    frequency: str,
    cron_or_interval: str,
    next_run: Optional[str] = None,
    timezone_str: str = "Asia/Kolkata",
    cron_expression: str = ""
) -> bool:
    """Updates an existing schedule record."""
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE schedules
            SET name = ?, prompt = ?, frequency = ?, cron_or_interval = ?, 
                next_run = ?, timezone = ?, cron_expression = ?
            WHERE id = ?
        """, (name, prompt, frequency, cron_or_interval, next_run, timezone_str, cron_expression, schedule_id))
        await db.commit()
        return cursor.rowcount > 0


async def record_schedule_execution_result(
    schedule_id: str,
    status: str, # 'success' or 'failed'
    last_run: str,
    next_run: Optional[str] = None,
    error_msg: str = ""
):
    """Records the execution outcome, failure counts, and next run timestamp."""
    async with get_db() as db:
        if status == "success":
            await db.execute("""
                UPDATE schedules
                SET last_run = ?, next_run = COALESCE(?, next_run),
                    last_status = 'success', consecutive_failures = 0, last_error = ''
                WHERE id = ?
            """, (last_run, next_run, schedule_id))
        else:
            await db.execute("""
                UPDATE schedules
                SET last_run = ?, next_run = COALESCE(?, next_run),
                    last_status = 'failed', consecutive_failures = consecutive_failures + 1, last_error = ?
                WHERE id = ?
            """, (last_run, next_run, error_msg, schedule_id))
        await db.commit()


async def list_schedules_from_db() -> List[Dict[str, Any]]:
    """Retrieves all scheduled tasks from SQLite."""
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM schedules ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_schedule_from_db(schedule_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a single scheduled task by its ID."""
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_schedule_status_in_db(schedule_id: str, status: str) -> bool:
    """Updates the status of a schedule ('active' or 'paused')."""
    async with get_db() as db:
        cursor = await db.execute("UPDATE schedules SET status = ? WHERE id = ?", (status, schedule_id))
        await db.commit()
        return cursor.rowcount > 0


async def update_schedule_run_times(schedule_id: str, last_run: str, next_run: Optional[str] = None):
    """Updates last_run and next_run timestamps for a schedule."""
    async with get_db() as db:
        await db.execute("""
            UPDATE schedules
            SET last_run = ?, next_run = COALESCE(?, next_run)
            WHERE id = ?
        """, (last_run, next_run, schedule_id))
        await db.commit()


async def delete_schedule_from_db(schedule_id: str) -> bool:
    """Deletes a schedule from SQLite."""
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
        await db.commit()
        return cursor.rowcount > 0


# ==========================================
# Workflow & Workflow Run CRUD Functions
# ==========================================

async def save_workflow(
    workflow_id: str,
    title: str,
    prompt: str,
    plan_json: str,
    status: str = "draft",
    dry_run: bool = False
) -> Dict[str, Any]:
    """Creates or updates a prompt-generated workflow in SQLite. Deduplicates by prompt."""
    now_str = datetime.now().isoformat()
    clean_p = prompt.strip().lower()
    async with get_db() as db:
        # Check for existing workflow with identical prompt to prevent duplicate workflow bloat
        if clean_p:
            cur = await db.execute("SELECT id FROM workflows WHERE LOWER(TRIM(prompt)) = ? LIMIT 1", (clean_p,))
            existing = await cur.fetchone()
            if existing:
                workflow_id = existing["id"]

        await db.execute("""
            INSERT INTO workflows (id, title, prompt, plan_json, status, dry_run, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                prompt = excluded.prompt,
                plan_json = excluded.plan_json,
                status = excluded.status,
                dry_run = excluded.dry_run,
                updated_at = excluded.updated_at;
        """, (workflow_id, title, prompt, plan_json, status, 1 if dry_run else 0, now_str, now_str))
        await db.commit()
    return {
        "id": workflow_id,
        "title": title,
        "prompt": prompt,
        "plan_json": plan_json,
        "status": status,
        "dry_run": dry_run,
        "updated_at": now_str
    }


async def cleanup_stale_workflow_runs() -> Dict[str, int]:
    """
    On server startup, marks any 'running' or 'waiting_for_approval' runs left from a crashed
    or restarted server as 'interrupted'.
    """
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        c1 = await db.execute("""
            UPDATE workflow_runs
            SET status = 'interrupted', completed_at = ?
            WHERE status IN ('running', 'waiting_for_approval')
        """, (now_str,))
        stale_runs = c1.rowcount

        c2 = await db.execute("""
            UPDATE workflows
            SET status = 'interrupted', updated_at = ?
            WHERE status IN ('running', 'waiting_for_approval')
        """, (now_str,))
        stale_wfs = c2.rowcount

        c3 = await db.execute("""
            UPDATE tasks
            SET status = 'interrupted', completed_at = ?
            WHERE status IN ('running', 'in_progress')
        """, (now_str,))
        stale_tasks = c3.rowcount

        await db.commit()
        return {
            "interrupted_runs": stale_runs,
            "interrupted_workflows": stale_wfs,
            "interrupted_tasks": stale_tasks
        }


async def deduplicate_saved_workflows() -> Dict[str, int]:
    """
    Finds workflows with identical prompts, merges runs to the most recent workflow,
    and removes redundant duplicate workflow entries.
    """
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT prompt, COUNT(*) as cnt
            FROM workflows
            WHERE prompt IS NOT NULL AND TRIM(prompt) != ''
            GROUP BY LOWER(TRIM(prompt))
            HAVING cnt > 1
        """)
        dup_prompts = await cursor.fetchall()
        merged_count = 0

        for row in dup_prompts:
            prompt_text = row["prompt"]
            cur2 = await db.execute("""
                SELECT id, updated_at
                FROM workflows
                WHERE LOWER(TRIM(prompt)) = LOWER(TRIM(?))
                ORDER BY updated_at DESC
            """, (prompt_text,))
            records = await cur2.fetchall()
            if len(records) > 1:
                keep_id = records[0]["id"]
                remove_ids = [r["id"] for r in records[1:]]

                for old_id in remove_ids:
                    await db.execute("""
                        UPDATE workflow_runs
                        SET workflow_id = ?
                        WHERE workflow_id = ?
                    """, (keep_id, old_id))
                    await db.execute("DELETE FROM workflows WHERE id = ?", (old_id,))
                    merged_count += 1

        await db.commit()
        return {"merged_workflows": merged_count}


async def update_workflow_status(workflow_id: str, status: str) -> bool:
    """Updates workflow status (e.g., 'running', 'completed', 'failed', 'interrupted')."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE workflows
            SET status = ?, updated_at = ?
            WHERE id = ?
        """, (status, now_str, workflow_id))
        await db.commit()
        return cursor.rowcount > 0


async def get_workflow_by_id(workflow_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a workflow by ID."""
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def list_all_workflows(limit: int = 100, status: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists saved workflows ordered by most recently updated with optional status and search filters."""
    query = "SELECT * FROM workflows WHERE 1=1"
    params = []
    if status and status.lower() != "all":
        query += " AND LOWER(status) = ?"
        params.append(status.lower().strip())
    if search and search.strip():
        query += " AND (title LIKE ? OR prompt LIKE ?)"
        s_term = f"%{search.strip()}%"
        params.extend([s_term, s_term])
    query += " ORDER BY updated_at DESC LIMIT ?"
    params.append(limit)

    async with get_db() as db:
        cursor = await db.execute(query, tuple(params))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def delete_workflow_by_id(workflow_id: str) -> bool:
    """Deletes a workflow and all associated runs."""
    async with get_db() as db:
        await db.execute("DELETE FROM workflow_runs WHERE workflow_id = ?", (workflow_id,))
        cursor = await db.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))
        await db.commit()
        return cursor.rowcount > 0


async def delete_all_workflows(status: Optional[str] = None) -> int:
    """Deletes all workflows or workflows matching a specific status."""
    async with get_db() as db:
        if status and status.lower() != "all":
            await db.execute("""
                DELETE FROM workflow_runs
                WHERE workflow_id IN (SELECT id FROM workflows WHERE LOWER(status) = ?)
            """, (status.lower(),))
            c = await db.execute("DELETE FROM workflows WHERE LOWER(status) = ?", (status.lower(),))
        else:
            await db.execute("DELETE FROM workflow_runs")
            c = await db.execute("DELETE FROM workflows")
        await db.commit()
        return c.rowcount


async def create_workflow_run_record(run_id: str, workflow_id: str, dry_run: bool = False) -> Dict[str, Any]:
    """Initializes a new workflow execution run record."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO workflow_runs (id, workflow_id, status, dry_run, started_at)
            VALUES (?, ?, 'running', ?, ?)
        """, (run_id, workflow_id, 1 if dry_run else 0, now_str))
        await db.commit()
    return {
        "id": run_id,
        "workflow_id": workflow_id,
        "status": "running",
        "dry_run": dry_run,
        "started_at": now_str
    }


async def update_workflow_run_record(
    run_id: str,
    status: str,
    step_results: Dict[str, Any],
    step_logs: List[Dict[str, Any]],
    duration_seconds: float = 0.0
) -> bool:
    """Updates workflow run record with final results, step logs, and duration."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE workflow_runs
            SET status = ?, step_results = ?, step_logs = ?, duration_seconds = ?, completed_at = ?
            WHERE id = ?
        """, (
            status,
            json.dumps(step_results),
            json.dumps(step_logs),
            duration_seconds,
            now_str,
            run_id
        ))
        await db.commit()
        return cursor.rowcount > 0


async def get_workflow_run_by_id(run_id: str) -> Optional[Dict[str, Any]]:
    """Fetches details of a specific workflow execution run."""
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM workflow_runs WHERE id = ?", (run_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def list_workflow_runs_by_workflow_id(workflow_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Lists past execution runs for a specific workflow."""
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT * FROM workflow_runs
            WHERE workflow_id = ?
            ORDER BY started_at DESC
            LIMIT ?
        """, (workflow_id, limit))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


# ==========================================
# Website Monitoring DB Functions (Stage 5)
# ==========================================

async def create_monitor(
    monitor_id: str,
    name: str,
    url: str,
    expected_status: int = 200,
    timeout_seconds: int = 10,
    interval_minutes: int = 30,
    failure_threshold: int = 3
) -> Dict[str, Any]:
    """Inserts a new website monitor record into SQLite."""
    now_iso = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO monitors (
                id, name, url, expected_status, timeout_seconds,
                interval_minutes, is_active, last_status, failure_threshold, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?)
        """, (
            monitor_id, name, url, expected_status, timeout_seconds,
            interval_minutes, failure_threshold, now_iso
        ))
        await db.commit()
    return {
        "id": monitor_id,
        "name": name,
        "url": url,
        "expected_status": expected_status,
        "timeout_seconds": timeout_seconds,
        "interval_minutes": interval_minutes,
        "is_active": 1,
        "last_status": "pending",
        "failure_threshold": failure_threshold,
        "created_at": now_iso
    }


async def list_all_monitors() -> List[Dict[str, Any]]:
    """Retrieves all website monitors ordered by creation date."""
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM monitors ORDER BY created_at ASC;")
        rows = await cursor.fetchall()
        monitors = []
        for r in rows:
            m = dict(r)
            # Fetch last 10 logs for sparkline preview
            log_cur = await db.execute("""
                SELECT status, status_code, latency_ms, checked_at
                FROM monitor_logs
                WHERE monitor_id = ?
                ORDER BY checked_at DESC
                LIMIT 10
            """, (m["id"],))
            logs = await log_cur.fetchall()
            m["recent_logs"] = [dict(lg) for lg in reversed(logs)]
            monitors.append(m)
        return monitors


async def get_monitor_by_id(monitor_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a single website monitor record."""
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM monitors WHERE id = ?;", (monitor_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_monitor_status(
    monitor_id: str,
    status: str,
    status_code: int,
    latency_ms: float,
    error_message: str,
    consecutive_failures: int
) -> bool:
    """Updates live health check findings for a monitor."""
    now_iso = datetime.now().isoformat()
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE monitors
            SET last_status = ?,
                last_status_code = ?,
                last_latency_ms = ?,
                last_error = ?,
                consecutive_failures = ?,
                last_checked_at = ?
            WHERE id = ?;
        """, (
            status, status_code, latency_ms, error_message,
            consecutive_failures, now_iso, monitor_id
        ))
        await db.commit()
        return cursor.rowcount > 0


async def toggle_monitor_active(monitor_id: str, is_active: bool) -> bool:
    """Pauses or resumes automatic monitoring for a target."""
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE monitors SET is_active = ? WHERE id = ?;
        """, (1 if is_active else 0, monitor_id))
        await db.commit()
        return cursor.rowcount > 0


async def delete_monitor_by_id(monitor_id: str) -> bool:
    """Deletes a monitor and cascades all its historical check logs."""
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM monitors WHERE id = ?;", (monitor_id,))
        await db.commit()
        return cursor.rowcount > 0


async def record_monitor_log(
    monitor_id: str,
    status: str,
    status_code: int,
    latency_ms: float,
    error_message: str = ""
) -> Dict[str, Any]:
    """Records an immutable historical latency & status log for a monitor check."""
    import uuid
    log_id = str(uuid.uuid4())
    now_iso = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO monitor_logs (id, monitor_id, status, status_code, latency_ms, error_message, checked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (log_id, monitor_id, status, status_code, latency_ms, error_message, now_iso))
        await db.commit()
    return {
        "id": log_id,
        "monitor_id": monitor_id,
        "status": status,
        "status_code": status_code,
        "latency_ms": latency_ms,
        "error_message": error_message,
        "checked_at": now_iso
    }


async def get_monitor_logs(monitor_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    """Returns chronological check logs for latency charting and analytics."""
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT * FROM monitor_logs
            WHERE monitor_id = ?
            ORDER BY checked_at DESC
            LIMIT ?;
        """, (monitor_id, limit))
        rows = await cursor.fetchall()
        return [dict(r) for r in reversed(rows)]


# ==========================================
# Workflow Templates Helpers (Stage 6)
# ==========================================

async def get_all_templates_from_db() -> List[Dict[str, Any]]:
    """
    Returns all workflow templates from SQLite (both built-in and user created).
    Falls back to BUILTIN_TEMPLATES in memory if database query encounters any error.
    """
    try:
        async with get_db() as db:
            cursor = await db.execute("""
                SELECT * FROM templates
                ORDER BY is_builtin DESC, created_at ASC;
            """)
            rows = await cursor.fetchall()
            if not rows:
                return BUILTIN_TEMPLATES
            
            result = []
            for r in rows:
                item = dict(r)
                # Parse JSON fields safely
                for fld, default in [
                    ("tools_used", []),
                    ("required_credentials", []),
                    ("default_inputs", {}),
                    ("plan_json", {})
                ]:
                    raw = item.get(fld)
                    if isinstance(raw, str):
                        try:
                            item[fld] = json.loads(raw)
                        except Exception:
                            item[fld] = default
                    elif raw is None:
                        item[fld] = default
                
                # Expose plan key for compatibility
                if "plan_json" in item and "plan" not in item:
                    item["plan"] = item["plan_json"]
                
                item["requires_approval"] = bool(item.get("requires_approval", 1))
                item["is_builtin"] = bool(item.get("is_builtin", 1))
                result.append(item)
            return result
    except Exception as e:
        print(f"[Templates DB Warning] Falling back to built-in templates list: {e}")
        return BUILTIN_TEMPLATES


async def get_template_by_id_from_db(tpl_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a single template by ID from SQLite or BUILTIN_TEMPLATES fallback."""
    try:
        async with get_db() as db:
            cursor = await db.execute("SELECT * FROM templates WHERE id = ?;", (tpl_id,))
            row = await cursor.fetchone()
            if row:
                item = dict(row)
                for fld, default in [
                    ("tools_used", []),
                    ("required_credentials", []),
                    ("default_inputs", {}),
                    ("plan_json", {})
                ]:
                    raw = item.get(fld)
                    if isinstance(raw, str):
                        try:
                            item[fld] = json.loads(raw)
                        except Exception:
                            item[fld] = default
                    elif raw is None:
                        item[fld] = default
                if "plan_json" in item and "plan" not in item:
                    item["plan"] = item["plan_json"]
                item["requires_approval"] = bool(item.get("requires_approval", 1))
                item["is_builtin"] = bool(item.get("is_builtin", 1))
                return item
    except Exception:
        pass
    
    # Fallback to in-memory built-ins
    return next((t for t in BUILTIN_TEMPLATES if t["id"] == tpl_id), None)


async def save_custom_template_to_db(tpl_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Saves a user-created workflow as a custom reusable template in SQLite.
    is_builtin is explicitly set to 0 to prevent accidental overwrite.
    """
    import uuid
    tpl_id = tpl_data.get("id") or f"tpl-user-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now().isoformat()
    
    tools = tpl_data.get("tools_used", [])
    creds = tpl_data.get("required_credentials", [])
    inputs = tpl_data.get("default_inputs", {})
    plan = tpl_data.get("plan", tpl_data.get("plan_json", {}))
    
    async with get_db() as db:
        await db.execute("""
            INSERT OR REPLACE INTO templates (
                id, title, description, category, prompt, tools_used,
                required_credentials, default_inputs, requires_approval,
                is_builtin, plan_json, icon, badge, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        """, (
            tpl_id,
            tpl_data.get("title", "Custom Workflow Template"),
            tpl_data.get("description", tpl_data.get("prompt", "")[:120]),
            tpl_data.get("category", "Custom"),
            tpl_data.get("prompt", ""),
            json.dumps(tools) if not isinstance(tools, str) else tools,
            json.dumps(creds) if not isinstance(creds, str) else creds,
            json.dumps(inputs) if not isinstance(inputs, str) else inputs,
            1 if tpl_data.get("requires_approval", True) else 0,
            json.dumps(plan) if not isinstance(plan, str) else plan,
            tpl_data.get("icon", "Sparkles"),
            tpl_data.get("badge", "My Template"),
            now_iso
        ))
        await db.commit()
    
    return await get_template_by_id_from_db(tpl_id)




