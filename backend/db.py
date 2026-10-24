"""
AgentFlow - Universal Database Layer (SQLite & PostgreSQL)
Supports local SQLite (default) and external PostgreSQL (via DATABASE_URL on Render/Neon/Supabase).
Persists task history, workflow execution runs, step logs, generated files, schedules, and approvals across redeploys.
"""

import os
import re
import json
import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from backend.templates_data import BUILTIN_TEMPLATES

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_FILE = os.getenv("DB_PATH", str(PROJECT_ROOT / "backend" / "agentflow.db"))
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Detect database engine
def is_postgres() -> bool:
    url = os.getenv("DATABASE_URL", "").strip().lower()
    return url.startswith("postgres://") or url.startswith("postgresql://")

def get_db_type() -> str:
    return "postgres" if is_postgres() else "sqlite"

def get_clean_database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

# Global PostgreSQL connection pool
_PG_POOL = None
_PG_POOL_LOCK = threading_lock = asyncio.Lock() if hasattr(asyncio, "Lock") else None

def _init_pg_pool():
    global _PG_POOL
    if _PG_POOL is None and is_postgres():
        import psycopg2.pool
        url = get_clean_database_url()
        # Ensure sslmode=require for cloud providers like Neon/Supabase/Render if not specified
        if "sslmode=" not in url:
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}sslmode=require"
        try:
            _PG_POOL = psycopg2.pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=url)
            print(f"[DB] Initialized PostgreSQL connection pool successfully.")
        except Exception as e:
            print(f"[DB] Error initializing PostgreSQL pool: {e}")
            raise e
    return _PG_POOL

# Query translation for PostgreSQL
def translate_query_for_pg(query: str) -> str:
    """Translates SQLite-compatible SQL into PostgreSQL-compatible SQL."""
    q = query
    # Replace ? with %s
    q = q.replace("?", "%s")
    # Replace SQLite AUTOINCREMENT with Postgres SERIAL
    q = re.sub(r'INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT', 'SERIAL PRIMARY KEY', q, flags=re.IGNORECASE)
    # Replace INSERT OR IGNORE INTO with INSERT INTO ... ON CONFLICT DO NOTHING
    if "INSERT OR IGNORE INTO" in q.upper():
        q = re.sub(r'INSERT\s+OR\s+IGNORE\s+INTO', 'INSERT INTO', q, flags=re.IGNORECASE)
        if "ON CONFLICT" not in q.upper():
            q = q.rstrip().rstrip(';') + " ON CONFLICT DO NOTHING;"
    return q


# PostgreSQL Cursor & Connection Wrapper
class PgAsyncCursor:
    def __init__(self, cur):
        self._cur = cur

    async def fetchone(self):
        return await asyncio.to_thread(self._cur.fetchone)

    async def fetchall(self):
        return await asyncio.to_thread(self._cur.fetchall)

    @property
    def rowcount(self):
        return self._cur.rowcount


class PgAsyncConnection:
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
        self._closed = False

    async def execute(self, query: str, params: tuple = ()):
        # Pragma statements are SQLite specific
        if query.strip().upper().startswith("PRAGMA"):
            return PgAsyncCursor(self._conn.cursor())

        pg_query = translate_query_for_pg(query)

        def _exec():
            import psycopg2.extras
            cur = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            cur.execute(pg_query, params if params else None)
            return cur

        cur = await asyncio.to_thread(_exec)
        return PgAsyncCursor(cur)

    async def commit(self):
        await asyncio.to_thread(self._conn.commit)

    async def rollback(self):
        await asyncio.to_thread(self._conn.rollback)

    def close(self):
        if not self._closed and self._pool:
            try:
                self._pool.putconn(self._conn)
            except Exception:
                pass
            self._closed = True


@asynccontextmanager
async def get_db():
    """
    Unified async context manager that yields an active database connection.
    Connects to PostgreSQL if DATABASE_URL is set; otherwise falls back to local SQLite.
    """
    if is_postgres():
        pool = _init_pg_pool()
        conn = await asyncio.to_thread(pool.getconn)
        wrapped_conn = PgAsyncConnection(conn, pool)
        try:
            yield wrapped_conn
        except Exception:
            await wrapped_conn.rollback()
            raise
        finally:
            wrapped_conn.close()
    else:
        import aiosqlite
        Path(DB_FILE).parent.mkdir(parents=True, exist_ok=True)
        db = await aiosqlite.connect(DB_FILE)
        await db.execute("PRAGMA foreign_keys = ON;")
        db.row_factory = aiosqlite.Row
        try:
            yield db
        finally:
            await db.close()


async def check_db_writable() -> bool:
    """Verifies that the database is active and writable."""
    try:
        now_str = datetime.now().isoformat()
        async with get_db() as db:
            await db.execute("""
                INSERT INTO user_settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at
            """, ("_health_write_probe", now_str, now_str))
            await db.commit()
            return True
    except Exception as e:
        print(f"[DB] Writability check failed: {e}")
        return False


async def init_db():
    """
    Initializes all database schemas automatically.
    Performs safe migrations that never delete or overwrite existing data.
    """
    async with get_db() as db:
        # 1. Tasks table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                final_answer TEXT DEFAULT '',
                sources TEXT DEFAULT '[]',
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

        # 2. Task steps table (streaming timeline)
        if is_postgres():
            await db.execute("""
                CREATE TABLE IF NOT EXISTS task_steps (
                    id SERIAL PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    step_index INTEGER NOT NULL,
                    step_type TEXT NOT NULL,
                    tool_name TEXT DEFAULT '',
                    content TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                );
            """)
        else:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS task_steps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    step_index INTEGER NOT NULL,
                    step_type TEXT NOT NULL,
                    tool_name TEXT DEFAULT '',
                    content TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                );
            """)

        # 3. User settings & persistent credentials
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # 4. Approvals table (Human-in-the-Loop, robust schema)
        # Check if legacy foreign key to tasks exists and safely migrate
        try:
            cursor = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='approvals'")
            row = await cursor.fetchone()
            if row and row[0] and "REFERENCES tasks" in row[0]:
                print("[DB Migration] Migrating approvals table to universal task/workflow schema...")
                await db.execute("PRAGMA foreign_keys = OFF;")
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS approvals_migrated (
                        id TEXT PRIMARY KEY,
                        run_id TEXT DEFAULT '',
                        step_id TEXT DEFAULT '',
                        task_id TEXT DEFAULT '',
                        workflow_id TEXT DEFAULT '',
                        action_type TEXT DEFAULT '',
                        tool_name TEXT DEFAULT '',
                        parameters TEXT DEFAULT '{}',
                        details TEXT DEFAULT '',
                        status TEXT NOT NULL DEFAULT 'pending',
                        decision TEXT DEFAULT '',
                        created_at TEXT NOT NULL,
                        decision_time TEXT,
                        resolved_at TEXT
                    );
                """)
                await db.execute("""
                    INSERT OR IGNORE INTO approvals_migrated (id, task_id, action_type, tool_name, parameters, details, status, created_at, resolved_at)
                    SELECT id, task_id, action_type, tool_name, parameters, details, status, created_at, resolved_at
                    FROM approvals;
                """)
                await db.execute("DROP TABLE approvals;")
                await db.execute("ALTER TABLE approvals_migrated RENAME TO approvals;")
                await db.execute("PRAGMA foreign_keys = ON;")
                print("[DB Migration] Approvals table migrated successfully.")
        except Exception as mig_err:
            print(f"[DB Migration] Notice during approvals check: {mig_err}")

        await db.execute("""
            CREATE TABLE IF NOT EXISTS approvals (
                id TEXT PRIMARY KEY,
                run_id TEXT DEFAULT '',
                step_id TEXT DEFAULT '',
                task_id TEXT DEFAULT '',
                workflow_id TEXT DEFAULT '',
                action_type TEXT DEFAULT '',
                tool_name TEXT DEFAULT '',
                parameters TEXT DEFAULT '{}',
                details TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                decision TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                decision_time TEXT,
                resolved_at TEXT
            );
        """)
        # Safe column migrations for approvals
        for col_def in [
            "run_id TEXT DEFAULT ''",
            "step_id TEXT DEFAULT ''",
            "workflow_id TEXT DEFAULT ''",
            "decision TEXT DEFAULT ''",
            "decision_time TEXT"
        ]:
            try:
                await db.execute(f"ALTER TABLE approvals ADD COLUMN {col_def};")
            except Exception:
                pass

        # 5. Schedules table (APScheduler recurring tasks)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                prompt TEXT NOT NULL,
                frequency TEXT NOT NULL,
                cron_or_interval TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
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

        # 6. Workflows table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                prompt TEXT NOT NULL,
                plan_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ready',
                dry_run INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # 7. Workflow runs table (Permanent execution run records)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS workflow_runs (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                prompt TEXT DEFAULT '',
                plan_json TEXT DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'pending',
                step_results TEXT DEFAULT '{}',
                step_logs TEXT DEFAULT '[]',
                duration_seconds REAL DEFAULT 0.0,
                dry_run INTEGER DEFAULT 0,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                interrupted_reason TEXT DEFAULT '',
                generated_files TEXT DEFAULT '[]'
            );
        """)
        for col_def in [
            "prompt TEXT DEFAULT ''",
            "plan_json TEXT DEFAULT '{}'",
            "interrupted_reason TEXT DEFAULT ''",
            "generated_files TEXT DEFAULT '[]'"
        ]:
            try:
                await db.execute(f"ALTER TABLE workflow_runs ADD COLUMN {col_def};")
            except Exception:
                pass

        # 8. Workflow run steps table (Detailed step logs)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS workflow_run_steps (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                step_id TEXT NOT NULL,
                tool_name TEXT DEFAULT '',
                name TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                parameters TEXT DEFAULT '{}',
                output_summary TEXT DEFAULT '',
                duration_seconds REAL DEFAULT 0.0,
                error_message TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                completed_at TEXT
            );
        """)

        # 9. Generated files table (Stores file content permanently in DB for ephemeral disks)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS generated_files (
                id TEXT PRIMARY KEY,
                run_id TEXT DEFAULT '',
                workflow_id TEXT DEFAULT '',
                filename TEXT NOT NULL,
                content_text TEXT DEFAULT '',
                size_bytes INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );
        """)

        # 10. Monitors table (Website Monitoring)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS monitors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                expected_status INTEGER DEFAULT 200,
                timeout_seconds INTEGER DEFAULT 10,
                interval_minutes INTEGER DEFAULT 30,
                is_active INTEGER DEFAULT 1,
                last_status TEXT DEFAULT 'pending',
                last_status_code INTEGER DEFAULT 0,
                last_latency_ms REAL DEFAULT 0.0,
                last_checked_at TEXT,
                consecutive_failures INTEGER DEFAULT 0,
                failure_threshold INTEGER DEFAULT 3,
                last_error TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );
        """)

        # 11. Monitor logs table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS monitor_logs (
                id TEXT PRIMARY KEY,
                monitor_id TEXT NOT NULL,
                status TEXT NOT NULL,
                status_code INTEGER,
                latency_ms REAL,
                error_message TEXT DEFAULT '',
                checked_at TEXT NOT NULL
            );
        """)

        # 12. Templates table
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

        # Seed built-in templates
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

        # 13. Uploaded Resumes table (Permanent DB storage for ephemeral disks)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS uploaded_resumes (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type TEXT DEFAULT '',
                raw_content BLOB,
                extracted_text TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );
        """)

        await db.commit()

        # Seed default monitors if none exist
        cursor = await db.execute("SELECT COUNT(*) FROM monitors;")
        count_res = await cursor.fetchone()
        if count_res and count_res[0] == 0:
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
            await db.commit()

        cursor = await db.execute("SELECT COUNT(*) FROM templates;")
        count_res = await cursor.fetchone()
        tpl_count = count_res[0] if count_res else 0
        print(f"[DB] Initialized ({get_db_type().upper()}). Templates available: {tpl_count}", flush=True)


# ==========================================
# Task & Conversational Agent Functions
# ==========================================

async def create_task(task_id: str, prompt: str, deep_research: bool = False) -> Dict[str, Any]:
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
    async with get_db() as db:
        await db.execute("UPDATE tasks SET status = ? WHERE id = ?", (status, task_id))
        await db.commit()

async def record_task_step(task_id: str, step_index: int, step_type: str, tool_name: str = "", content: str = ""):
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO task_steps (task_id, step_index, step_type, tool_name, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (task_id, step_index, step_type, tool_name, content, now_str))
        await db.commit()

async def complete_task(task_id: str, status: str, final_answer: str, sources: List[str], duration_seconds: float):
    now_str = datetime.now().isoformat()
    sources_json = json.dumps(sources)
    async with get_db() as db:
        await db.execute("""
            UPDATE tasks
            SET status = ?, final_answer = ?, sources = ?, duration_seconds = ?, completed_at = ?
            WHERE id = ?
        """, (status, final_answer, sources_json, duration_seconds, now_str, task_id))
        await db.commit()

async def get_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
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
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        await db.commit()
        return cursor.rowcount > 0


# ==========================================
# User Settings & Persistent Preferences
# ==========================================

async def get_all_settings() -> Dict[str, str]:
    async with get_db() as db:
        cursor = await db.execute("SELECT key, value FROM user_settings")
        rows = await cursor.fetchall()
        return {r["key"]: r["value"] for r in rows}

async def update_setting(key: str, value: str):
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO user_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """, (key, value, now_str))
        await db.commit()


# ==========================================
# Approvals (Human-in-the-Loop)
# ==========================================

async def create_approval_record(
    approval_id: str,
    task_id: str,
    action_type: str,
    tool_name: str,
    parameters: Dict[str, Any],
    details: str,
    run_id: str = "",
    step_id: str = "",
    workflow_id: str = ""
):
    """Creates a pending human-in-the-loop approval record in database."""
    now_str = datetime.now().isoformat()
    wf_id = workflow_id or task_id
    async with get_db() as db:
        await db.execute("""
            INSERT INTO approvals (
                id, run_id, step_id, task_id, workflow_id,
                action_type, tool_name, parameters, details,
                status, decision, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?)
            ON CONFLICT(id) DO UPDATE SET
                status = 'pending',
                decision = '',
                parameters = excluded.parameters,
                details = excluded.details;
        """, (
            approval_id, run_id, step_id, task_id, wf_id,
            action_type, tool_name, json.dumps(parameters), details,
            now_str
        ))
        await db.commit()

async def resolve_approval_record(approval_id: str, decision: str) -> bool:
    """Updates the status of an approval record to approved or rejected."""
    now_str = datetime.now().isoformat()
    decision_clean = decision.lower().strip()
    status_clean = "approved" if decision_clean == "approve" else "rejected"
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE approvals
            SET status = ?, decision = ?, decision_time = ?, resolved_at = ?
            WHERE id = ?
        """, (status_clean, decision_clean, now_str, now_str, approval_id))
        await db.commit()
        return cursor.rowcount > 0

async def cancel_pending_approvals_for_run(run_id: str) -> int:
    """Marks any pending approvals for a run as rejected/cancelled."""
    if not run_id:
        return 0
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE approvals
            SET status = 'rejected', decision = 'reject', decision_time = ?, resolved_at = ?
            WHERE run_id = ? AND status = 'pending'
        """, (now_str, now_str, run_id))
        await db.commit()
        return cursor.rowcount

async def cancel_pending_approvals_for_workflow(workflow_id: str) -> int:
    """Marks any pending approvals for a workflow as rejected/cancelled."""
    if not workflow_id:
        return 0
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE approvals
            SET status = 'rejected', decision = 'reject', decision_time = ?, resolved_at = ?
            WHERE (workflow_id = ? OR task_id = ?) AND status = 'pending'
        """, (now_str, now_str, workflow_id, workflow_id))
        await db.commit()
        return cursor.rowcount

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

async def get_approval_by_run_and_step(run_id: str, step_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves approval record for a specific step in an execution run."""
    if not run_id or not step_id:
        return None
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT * FROM approvals
            WHERE run_id = ? AND step_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        """, (run_id, step_id))
        row = await cursor.fetchone()
        if not row:
            return None
        ad = dict(row)
        try:
            ad["parameters"] = json.loads(ad.get("parameters") or "{}")
        except Exception:
            ad["parameters"] = {}
        return ad

async def get_pending_approvals() -> List[Dict[str, Any]]:
    """Retrieves all active pending approvals."""
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT * FROM approvals
            WHERE status = 'pending'
            ORDER BY created_at DESC
        """)
        rows = await cursor.fetchall()
        results = []
        for r in rows:
            ad = dict(r)
            try:
                ad["parameters"] = json.loads(ad.get("parameters") or "{}")
            except Exception:
                ad["parameters"] = {}
            results.append(ad)
        return results


# ==========================================
# Schedules (APScheduler Recurring Tasks)
# ==========================================

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
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO schedules (
                id, name, prompt, frequency, cron_or_interval, status, next_run,
                timezone, cron_expression, last_status, consecutive_failures, created_at
            )
            VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, 'pending', 0, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                prompt = excluded.prompt,
                frequency = excluded.frequency,
                cron_or_interval = excluded.cron_or_interval,
                next_run = excluded.next_run,
                timezone = excluded.timezone,
                cron_expression = excluded.cron_expression;
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
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE schedules
            SET name = ?, prompt = ?, frequency = ?, cron_or_interval = ?, next_run = ?, timezone = ?, cron_expression = ?
            WHERE id = ?
        """, (name, prompt, frequency, cron_or_interval, next_run, timezone_str, cron_expression, schedule_id))
        await db.commit()
        return cursor.rowcount > 0

async def record_schedule_execution_result(
    schedule_id: str,
    status: str,
    error_message: str = "",
    next_run: Optional[str] = None
):
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        if status == "success":
            await db.execute("""
                UPDATE schedules
                SET last_run = ?, next_run = ?, last_status = 'success', consecutive_failures = 0, last_error = ''
                WHERE id = ?
            """, (now_str, next_run, schedule_id))
        else:
            await db.execute("""
                UPDATE schedules
                SET last_run = ?, next_run = ?, last_status = 'failed', consecutive_failures = consecutive_failures + 1, last_error = ?
                WHERE id = ?
            """, (now_str, next_run, error_message, schedule_id))
        await db.commit()

async def list_schedules_from_db() -> List[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM schedules ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def get_schedule_from_db(schedule_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def update_schedule_status_in_db(schedule_id: str, status: str) -> bool:
    async with get_db() as db:
        cursor = await db.execute("UPDATE schedules SET status = ? WHERE id = ?", (status, schedule_id))
        await db.commit()
        return cursor.rowcount > 0

async def update_schedule_run_times(schedule_id: str, last_run: str, next_run: Optional[str] = None):
    async with get_db() as db:
        if next_run:
            await db.execute("UPDATE schedules SET last_run = ?, next_run = ? WHERE id = ?", (last_run, next_run, schedule_id))
        else:
            await db.execute("UPDATE schedules SET last_run = ? WHERE id = ?", (last_run, schedule_id))
        await db.commit()

async def delete_schedule_from_db(schedule_id: str) -> bool:
    async with get_db() as db:
        cursor = await db.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
        await db.commit()
        return cursor.rowcount > 0


# ==========================================
# Workflows & Plans
# ==========================================

async def save_workflow(
    workflow_id: str,
    title: str,
    prompt: str,
    plan_json: str,
    status: str = "ready",
    dry_run: bool = False
) -> Dict[str, Any]:
    now_str = datetime.now().isoformat()
    clean_prompt = prompt.strip()

    async with get_db() as db:
        # Check for existing workflow with identical prompt to reuse
        cursor = await db.execute("SELECT id FROM workflows WHERE LOWER(TRIM(prompt)) = LOWER(?) LIMIT 1", (clean_prompt,))
        existing = await cursor.fetchone()
        target_id = existing[0] if existing else workflow_id

        await db.execute("""
            INSERT INTO workflows (id, title, prompt, plan_json, status, dry_run, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                plan_json = excluded.plan_json,
                status = excluded.status,
                dry_run = excluded.dry_run,
                updated_at = excluded.updated_at;
        """, (target_id, title, clean_prompt, plan_json, status, 1 if dry_run else 0, now_str, now_str))
        await db.commit()

    return {
        "id": target_id,
        "title": title,
        "prompt": clean_prompt,
        "status": status,
        "dry_run": dry_run,
        "created_at": now_str
    }

async def update_workflow_status(workflow_id: str, status: str) -> bool:
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        cursor = await db.execute("""
            UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?
        """, (status, now_str, workflow_id))
        await db.commit()
        return cursor.rowcount > 0

async def get_workflow_by_id(workflow_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def list_all_workflows(limit: int = 100, status: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
    query = "SELECT * FROM workflows"
    params = []
    clauses = []
    if status and status.lower() != "all":
        clauses.append("LOWER(status) = ?")
        params.append(status.lower())
    if search and search.strip():
        clauses.append("(LOWER(title) LIKE ? OR LOWER(prompt) LIKE ?)")
        term = f"%{search.strip().lower()}%"
        params.extend([term, term])

    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY updated_at DESC LIMIT ?"
    params.append(limit)

    async with get_db() as db:
        cursor = await db.execute(query, tuple(params))
        rows = await cursor.fetchall()
        workflows = []
        for r in rows:
            w = dict(r)
            try:
                w["plan"] = json.loads(w.get("plan_json") or "{}")
            except Exception:
                w["plan"] = {}
            workflows.append(w)
        return workflows

async def delete_workflow_by_id(workflow_id: str) -> bool:
    async with get_db() as db:
        await db.execute("DELETE FROM workflow_runs WHERE workflow_id = ?", (workflow_id,))
        cursor = await db.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))
        await db.commit()
        return cursor.rowcount > 0

async def delete_all_workflows(status: Optional[str] = None) -> int:
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

async def deduplicate_saved_workflows() -> Dict[str, int]:
    """Finds workflows with duplicate prompts and merges their runs."""
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT LOWER(TRIM(prompt)) as p, COUNT(*) as cnt
            FROM workflows
            GROUP BY LOWER(TRIM(prompt))
            HAVING COUNT(*) > 1
        """)
        dups = await cursor.fetchall()
        merged_count = 0
        for d in dups:
            p_val = d["p"]
            w_cursor = await db.execute("""
                SELECT id FROM workflows
                WHERE LOWER(TRIM(prompt)) = ?
                ORDER BY updated_at DESC
            """, (p_val,))
            w_rows = await w_cursor.fetchall()
            if len(w_rows) > 1:
                keep_id = w_rows[0]["id"]
                for other in w_rows[1:]:
                    old_id = other["id"]
                    await db.execute("UPDATE workflow_runs SET workflow_id = ? WHERE workflow_id = ?", (keep_id, old_id))
                    await db.execute("DELETE FROM workflows WHERE id = ?", (old_id,))
                    merged_count += 1
        await db.commit()
        return {"merged_workflows": merged_count}


# ==========================================
# Permanent Workflow Execution Runs & Steps
# ==========================================

async def create_workflow_run_record(
    run_id: str,
    workflow_id: str,
    prompt: str = "",
    plan_json: str = "{}",
    dry_run: bool = False
) -> Dict[str, Any]:
    """Initializes a new workflow execution run record."""
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO workflow_runs (
                id, workflow_id, prompt, plan_json, status, dry_run, started_at
            )
            VALUES (?, ?, ?, ?, 'running', ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status = 'running',
                dry_run = excluded.dry_run,
                started_at = excluded.started_at;
        """, (run_id, workflow_id, prompt, plan_json, 1 if dry_run else 0, now_str))
        await db.commit()
    return {
        "id": run_id,
        "workflow_id": workflow_id,
        "prompt": prompt,
        "status": "running",
        "dry_run": dry_run,
        "started_at": now_str
    }

async def update_workflow_run_record(
    run_id: str,
    status: str,
    step_results: Optional[Dict[str, Any]] = None,
    step_logs: Optional[List[Dict[str, Any]]] = None,
    duration_seconds: float = 0.0,
    generated_files: Optional[List[str]] = None,
    interrupted_reason: str = ""
) -> bool:
    """Updates workflow run record with final results, step logs, generated files, and duration."""
    now_str = datetime.now().isoformat()
    files_json = json.dumps(generated_files or [])
    results_json = json.dumps(step_results if step_results is not None else {})
    logs_json = json.dumps(step_logs if step_logs is not None else [])
    async with get_db() as db:
        if step_results is None and step_logs is None:
            cursor = await db.execute("""
                UPDATE workflow_runs
                SET status = ?,
                    completed_at = ?,
                    interrupted_reason = ?
                WHERE id = ?
            """, (status, now_str, interrupted_reason, run_id))
        else:
            cursor = await db.execute("""
                UPDATE workflow_runs
                SET status = ?,
                    step_results = ?,
                    step_logs = ?,
                    duration_seconds = ?,
                    completed_at = ?,
                    generated_files = ?,
                    interrupted_reason = ?
                WHERE id = ?
            """, (
                status,
                results_json,
                logs_json,
                duration_seconds,
                now_str,
                files_json,
                interrupted_reason,
                run_id
            ))
        await db.commit()
        return cursor.rowcount > 0

async def record_workflow_run_step(
    run_id: str,
    step_id: str,
    tool_name: str,
    name: str,
    status: str,
    parameters: Dict[str, Any] = None,
    output_summary: str = "",
    duration_seconds: float = 0.0,
    error_message: str = ""
):
    """Records or updates a single step execution within a run."""
    step_record_id = f"{run_id}_{step_id}"
    now_str = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO workflow_run_steps (
                id, run_id, step_id, tool_name, name, status,
                parameters, output_summary, duration_seconds, error_message, created_at, completed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                output_summary = excluded.output_summary,
                duration_seconds = excluded.duration_seconds,
                error_message = excluded.error_message,
                completed_at = excluded.completed_at;
        """, (
            step_record_id, run_id, step_id, tool_name, name, status,
            json.dumps(parameters or {}), output_summary, duration_seconds,
            error_message, now_str, now_str
        ))
        await db.commit()

async def get_workflow_run_by_id(run_id: str) -> Optional[Dict[str, Any]]:
    """Fetches details of a specific workflow execution run including its steps and generated files."""
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM workflow_runs WHERE id = ?", (run_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        run_dict = dict(row)
        try:
            run_dict["step_results"] = json.loads(run_dict.get("step_results") or "{}")
        except Exception:
            run_dict["step_results"] = {}
        try:
            run_dict["step_logs"] = json.loads(run_dict.get("step_logs") or "[]")
        except Exception:
            run_dict["step_logs"] = []
        try:
            run_dict["plan"] = json.loads(run_dict.get("plan_json") or "{}")
        except Exception:
            run_dict["plan"] = {}
        try:
            run_dict["generated_files"] = json.loads(run_dict.get("generated_files") or "[]")
        except Exception:
            run_dict["generated_files"] = []

        # Fetch recorded steps from workflow_run_steps
        s_cursor = await db.execute(
            "SELECT * FROM workflow_run_steps WHERE run_id = ? ORDER BY created_at ASC",
            (run_id,)
        )
        s_rows = await s_cursor.fetchall()
        steps = []
        for sr in s_rows:
            sd = dict(sr)
            try:
                sd["parameters"] = json.loads(sd.get("parameters") or "{}")
            except Exception:
                sd["parameters"] = {}
            steps.append(sd)
        run_dict["steps"] = steps

        # Fetch files from generated_files table
        f_cursor = await db.execute(
            "SELECT id, filename, size_bytes, created_at, content_text FROM generated_files WHERE run_id = ? ORDER BY created_at ASC",
            (run_id,)
        )
        f_rows = await f_cursor.fetchall()
        files = []
        for fr in f_rows:
            fd = dict(fr)
            fd["size_kb"] = round(fd.get("size_bytes", 0) / 1024, 2)
            fd["download_url"] = f"/api/workspace/files/{fd.get('filename')}/download"
            files.append(fd)
        run_dict["db_files"] = files

        return run_dict

async def get_active_run_for_workflow(workflow_id: str) -> Optional[Dict[str, Any]]:
    """Returns active running or paused run for a workflow, if any."""
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT * FROM workflow_runs
            WHERE workflow_id = ? AND status IN ('running', 'waiting_for_approval')
            ORDER BY started_at DESC
            LIMIT 1
        """, (workflow_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def count_workflow_runs(search: Optional[str] = None, status: Optional[str] = None, date_filter: Optional[str] = None) -> int:
    """Counts total stored workflow runs matching filters."""
    query = "SELECT COUNT(*) FROM workflow_runs"
    clauses = []
    params = []

    if status and status.lower() != "all":
        clauses.append("LOWER(status) = ?")
        params.append(status.lower())

    if search and search.strip():
        clauses.append("(LOWER(prompt) LIKE ? OR LOWER(workflow_id) LIKE ? OR LOWER(id) LIKE ?)")
        s = f"%{search.strip().lower()}%"
        params.extend([s, s, s])

    if date_filter and date_filter.lower() != "all":
        now = datetime.now()
        if date_filter.lower() == "today":
            today_str = now.strftime("%Y-%m-%d")
            clauses.append("started_at >= ?")
            params.append(today_str)
        elif date_filter.lower() in ("week", "last_7_days"):
            from datetime import timedelta
            week_ago = (now - timedelta(days=7)).isoformat()
            clauses.append("started_at >= ?")
            params.append(week_ago)
        elif date_filter.lower() in ("month", "last_30_days"):
            from datetime import timedelta
            month_ago = (now - timedelta(days=30)).isoformat()
            clauses.append("started_at >= ?")
            params.append(month_ago)

    if clauses:
        query += " WHERE " + " AND ".join(clauses)

    async with get_db() as db:
        cursor = await db.execute(query, tuple(params))
        row = await cursor.fetchone()
        return row[0] if row else 0

async def list_workflow_runs(
    limit: int = 10,
    offset: int = 0,
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Lists workflow execution runs permanently (newest first)."""
    query = "SELECT * FROM workflow_runs"
    clauses = []
    params = []

    if status and status.lower() != "all":
        clauses.append("LOWER(status) = ?")
        params.append(status.lower())

    if search and search.strip():
        clauses.append("(LOWER(prompt) LIKE ? OR LOWER(workflow_id) LIKE ? OR LOWER(id) LIKE ?)")
        s = f"%{search.strip().lower()}%"
        params.extend([s, s, s])

    if date_filter and date_filter.lower() != "all":
        now = datetime.now()
        if date_filter.lower() == "today":
            today_str = now.strftime("%Y-%m-%d")
            clauses.append("started_at >= ?")
            params.append(today_str)
        elif date_filter.lower() in ("week", "last_7_days"):
            from datetime import timedelta
            week_ago = (now - timedelta(days=7)).isoformat()
            clauses.append("started_at >= ?")
            params.append(week_ago)
        elif date_filter.lower() in ("month", "last_30_days"):
            from datetime import timedelta
            month_ago = (now - timedelta(days=30)).isoformat()
            clauses.append("started_at >= ?")
            params.append(month_ago)

    if clauses:
        query += " WHERE " + " AND ".join(clauses)

    query += " ORDER BY started_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    async with get_db() as db:
        cursor = await db.execute(query, tuple(params))
        rows = await cursor.fetchall()
        runs = []
        for r in rows:
            rd = dict(r)
            try:
                rd["step_results"] = json.loads(rd.get("step_results") or "{}")
            except Exception:
                rd["step_results"] = {}
            try:
                rd["step_logs"] = json.loads(rd.get("step_logs") or "[]")
            except Exception:
                rd["step_logs"] = []
            try:
                rd["plan"] = json.loads(rd.get("plan_json") or "{}")
            except Exception:
                rd["plan"] = {}
            try:
                rd["generated_files"] = json.loads(rd.get("generated_files") or "[]")
            except Exception:
                rd["generated_files"] = []
            runs.append(rd)
        return runs

async def list_workflow_runs_by_workflow_id(workflow_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Lists execution runs for a specific workflow (newest first)."""
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT * FROM workflow_runs
            WHERE workflow_id = ?
            ORDER BY started_at DESC
            LIMIT ?
        """, (workflow_id, limit))
        rows = await cursor.fetchall()
        runs = []
        for r in rows:
            rd = dict(r)
            try:
                rd["step_results"] = json.loads(rd.get("step_results") or "{}")
            except Exception:
                rd["step_results"] = {}
            try:
                rd["step_logs"] = json.loads(rd.get("step_logs") or "[]")
            except Exception:
                rd["step_logs"] = []
            try:
                rd["plan"] = json.loads(rd.get("plan_json") or "{}")
            except Exception:
                rd["plan"] = {}
            try:
                rd["generated_files"] = json.loads(rd.get("generated_files") or "[]")
            except Exception:
                rd["generated_files"] = []
            runs.append(rd)
        return runs

async def delete_workflow_run(run_id: str) -> bool:
    """Deletes a run and associated step records from database."""
    async with get_db() as db:
        await db.execute("DELETE FROM workflow_run_steps WHERE run_id = ?", (run_id,))
        await db.execute("DELETE FROM generated_files WHERE run_id = ?", (run_id,))
        cursor = await db.execute("DELETE FROM workflow_runs WHERE id = ?", (run_id,))
        await db.commit()
        return cursor.rowcount > 0

async def cleanup_stale_workflow_runs() -> Dict[str, int]:
    """
    On server startup, marks any 'running' or 'waiting_for_approval' runs left
    from a crashed or restarted server as 'interrupted'.
    """
    now_str = datetime.now().isoformat()
    reason = "Server was restarted during execution. Run marked as interrupted."
    async with get_db() as db:
        c1 = await db.execute("""
            UPDATE workflow_runs
            SET status = 'interrupted', completed_at = ?, interrupted_reason = ?
            WHERE status IN ('running', 'waiting_for_approval')
        """, (now_str, reason))

        # Also update workflow statuses
        c2 = await db.execute("""
            UPDATE workflows
            SET status = 'interrupted', updated_at = ?
            WHERE status IN ('running', 'waiting_for_approval')
        """, (now_str,))

        # Update pending approvals as interrupted
        await db.execute("""
            UPDATE approvals
            SET status = 'interrupted', resolved_at = ?
            WHERE status = 'pending'
        """, (now_str,))

        await db.commit()
        stale_runs = c1.rowcount
        stale_wfs = c2.rowcount
        print(f"[Startup Recovery] Interrupted runs marked: {stale_runs}, Workflows marked: {stale_wfs}")
        return {
            "interrupted_runs": stale_runs,
            "interrupted_workflows": stale_wfs,
            "stale_runs_interrupted": stale_runs,
            "stale_workflows_interrupted": stale_wfs
        }


# ==========================================
# Generated Files Storage (Solves Ephemeral Disk)
# ==========================================

async def save_generated_file(filename: str, content_text: str, run_id: str = "", workflow_id: str = "") -> str:
    """Saves file text content into the database so it survives container restarts."""
    now_str = datetime.now().isoformat()
    file_id = f"file_{run_id}_{filename}" if run_id else f"file_{filename}"
    size_bytes = len(content_text.encode("utf-8"))
    async with get_db() as db:
        await db.execute("""
            INSERT INTO generated_files (
                id, run_id, workflow_id, filename, content_text, size_bytes, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                content_text = excluded.content_text,
                size_bytes = excluded.size_bytes,
                created_at = excluded.created_at;
        """, (file_id, run_id, workflow_id, filename, content_text, size_bytes, now_str))
        await db.commit()
    return file_id

def save_generated_file_sync(filename: str, content_text: str, run_id: str = "", workflow_id: str = "") -> str:
    """Synchronous helper for file saving."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(save_generated_file(filename, content_text, run_id, workflow_id))
            return f"file_{filename}"
        else:
            return loop.run_until_complete(save_generated_file(filename, content_text, run_id, workflow_id))
    except Exception:
        return f"file_{filename}"

async def get_generated_file(filename: str, run_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieves generated file content from database."""
    async with get_db() as db:
        if run_id:
            cursor = await db.execute("""
                SELECT * FROM generated_files WHERE filename = ? AND run_id = ? LIMIT 1
            """, (filename, run_id))
        else:
            cursor = await db.execute("""
                SELECT * FROM generated_files WHERE filename = ? ORDER BY created_at DESC LIMIT 1
            """, (filename,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def list_generated_files_by_run(run_id: str) -> List[Dict[str, Any]]:
    """Lists all files generated during a specific run."""
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT id, run_id, workflow_id, filename, size_bytes, created_at
            FROM generated_files
            WHERE run_id = ?
            ORDER BY created_at ASC
        """, (run_id,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


# ==========================================
# Dashboard Metrics
# ==========================================

async def get_dashboard_metrics() -> Dict[str, Any]:
    async with get_db() as db:
        cursor = await db.execute("SELECT COUNT(*) as total FROM tasks")
        row = await cursor.fetchone()
        total_tasks = row["total"] if row else 0

        cursor = await db.execute("SELECT COUNT(*) as completed FROM tasks WHERE status = 'completed'")
        row = await cursor.fetchone()
        completed_tasks = row["completed"] if row else 0

        success_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 100.0

        cursor = await db.execute("""
            SELECT tool_name, COUNT(*) as count
            FROM task_steps
            WHERE step_type = 'tool_call' AND tool_name != ''
            GROUP BY tool_name
            ORDER BY count DESC
        """)
        tool_rows = await cursor.fetchall()
        tool_counts = [{"tool": r["tool_name"], "count": r["count"]} for r in tool_rows]

        cursor = await db.execute("SELECT SUM(duration_seconds) as total_dur FROM tasks WHERE status = 'completed'")
        row = await cursor.fetchone()
        total_agent_seconds = row["total_dur"] if row and row["total_dur"] else 0.0

        manual_estimated_minutes = completed_tasks * 8.0
        agent_minutes = total_agent_seconds / 60.0
        saved_minutes = max(0.0, round(manual_estimated_minutes - agent_minutes, 1))

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

        financial_savings_inr = int((saved_minutes / 60.0) * 500)

        # Stored workflow runs count
        cursor = await db.execute("SELECT COUNT(*) FROM workflow_runs;")
        w_row = await cursor.fetchone()
        runs_count = w_row[0] if w_row else 0

        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "total_workflow_runs": runs_count,
            "success_rate": success_rate,
            "tool_usage": tool_counts,
            "estimated_minutes_saved": saved_minutes,
            "hours_saved": round(saved_minutes / 60.0, 1),
            "financial_savings_inr": financial_savings_inr,
            "tasks_timeline": tasks_timeline
        }


# ==========================================
# Website Monitors (Stage 5)
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
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM monitors ORDER BY created_at ASC;")
        rows = await cursor.fetchall()
        monitors = []
        for r in rows:
            m = dict(r)
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
    async with get_db() as db:
        cursor = await db.execute("UPDATE monitors SET is_active = ? WHERE id = ?;", (1 if is_active else 0, monitor_id))
        await db.commit()
        return cursor.rowcount > 0

async def delete_monitor_by_id(monitor_id: str) -> bool:
    async with get_db() as db:
        await db.execute("DELETE FROM monitor_logs WHERE monitor_id = ?;", (monitor_id,))
        cursor = await db.execute("DELETE FROM monitors WHERE id = ?;", (monitor_id,))
        await db.commit()
        return cursor.rowcount > 0

async def record_monitor_log(
    log_id: str,
    monitor_id: str,
    status: str,
    status_code: int,
    latency_ms: float,
    error_message: str = ""
):
    now_iso = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO monitor_logs (id, monitor_id, status, status_code, latency_ms, error_message, checked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (log_id, monitor_id, status, status_code, latency_ms, error_message, now_iso))
        await db.commit()

async def get_monitor_logs(monitor_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT * FROM monitor_logs
            WHERE monitor_id = ?
            ORDER BY checked_at DESC
            LIMIT ?;
        """, (monitor_id, limit))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


# ==========================================
# Workflow Templates Gallery (Stage 6)
# ==========================================

async def get_all_templates_from_db() -> List[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM templates ORDER BY is_builtin DESC, created_at ASC;")
        rows = await cursor.fetchall()
        templates = []
        for r in rows:
            td = dict(r)
            try:
                td["tools_used"] = json.loads(td.get("tools_used") or "[]")
            except Exception:
                td["tools_used"] = []
            try:
                td["required_credentials"] = json.loads(td.get("required_credentials") or "[]")
            except Exception:
                td["required_credentials"] = []
            try:
                td["default_inputs"] = json.loads(td.get("default_inputs") or "{}")
            except Exception:
                td["default_inputs"] = {}
            try:
                td["plan"] = json.loads(td.get("plan_json") or "{}")
            except Exception:
                td["plan"] = {}
            td["requires_approval"] = bool(td.get("requires_approval", 1))
            td["is_builtin"] = bool(td.get("is_builtin", 1))
            templates.append(td)
        return templates

async def get_template_by_id_from_db(tpl_id: str) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM templates WHERE id = ? LIMIT 1;", (tpl_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        td = dict(row)
        try:
            td["tools_used"] = json.loads(td.get("tools_used") or "[]")
        except Exception:
            td["tools_used"] = []
        try:
            td["required_credentials"] = json.loads(td.get("required_credentials") or "[]")
        except Exception:
            td["required_credentials"] = []
        try:
            td["default_inputs"] = json.loads(td.get("default_inputs") or "{}")
        except Exception:
            td["default_inputs"] = {}
        try:
            td["plan"] = json.loads(td.get("plan_json") or "{}")
        except Exception:
            td["plan"] = {}
        td["requires_approval"] = bool(td.get("requires_approval", 1))
        td["is_builtin"] = bool(td.get("is_builtin", 1))
        return td

async def save_custom_template_to_db(tpl_data: Dict[str, Any]) -> Dict[str, Any]:
    import uuid
    tpl_id = tpl_data.get("id") or f"custom-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
            INSERT INTO templates (
                id, title, description, category, prompt, tools_used,
                required_credentials, default_inputs, requires_approval,
                is_builtin, plan_json, icon, badge, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                category = excluded.category,
                prompt = excluded.prompt,
                tools_used = excluded.tools_used,
                required_credentials = excluded.required_credentials,
                default_inputs = excluded.default_inputs,
                requires_approval = excluded.requires_approval,
                plan_json = excluded.plan_json,
                icon = excluded.icon,
                badge = excluded.badge;
        """, (
            tpl_id,
            tpl_data.get("title", "Untitled Template"),
            tpl_data.get("description", ""),
            tpl_data.get("category", "Custom"),
            tpl_data.get("prompt", ""),
            json.dumps(tpl_data.get("tools_used", [])),
            json.dumps(tpl_data.get("required_credentials", [])),
            json.dumps(tpl_data.get("default_inputs", {})),
            1 if tpl_data.get("requires_approval", True) else 0,
            json.dumps(tpl_data.get("plan", {})),
            tpl_data.get("icon", "Sparkles"),
            tpl_data.get("badge", "My Template"),
            now_iso
        ))
        await db.commit()
    return await get_template_by_id_from_db(tpl_id)


# ==========================================
# Uploaded Resumes & Documents (DB Persistence)
# ==========================================

async def save_uploaded_resume(
    file_id: str,
    filename: str,
    file_size: int,
    mime_type: str = "",
    raw_content: bytes = b"",
    extracted_text: str = ""
) -> Dict[str, Any]:
    """Persists uploaded resume file into database to survive container restarts."""
    now_str = datetime.now().isoformat()
    clean_fn = os.path.basename(filename.replace("\\", "/").strip())
    async with get_db() as db:
        await db.execute("""
            INSERT INTO uploaded_resumes (
                id, filename, file_size, mime_type, raw_content, extracted_text, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                filename = excluded.filename,
                file_size = excluded.file_size,
                mime_type = excluded.mime_type,
                raw_content = excluded.raw_content,
                extracted_text = excluded.extracted_text,
                created_at = excluded.created_at;
        """, (file_id, clean_fn, file_size, mime_type, raw_content, extracted_text, now_str))
        await db.commit()
    return {
        "id": file_id,
        "filename": clean_fn,
        "file_size": file_size,
        "mime_type": mime_type,
        "extracted_text": extracted_text,
        "created_at": now_str
    }

async def get_uploaded_resume(file_id_or_filename: str) -> Optional[Dict[str, Any]]:
    """Retrieves an uploaded resume by ID or exact filename."""
    clean_target = file_id_or_filename.strip()
    clean_base = os.path.basename(clean_target.replace("\\", "/"))
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT id, filename, file_size, mime_type, raw_content, extracted_text, created_at
            FROM uploaded_resumes
            WHERE id = ? OR filename = ? OR filename = ?
            ORDER BY created_at DESC LIMIT 1
        """, (clean_target, clean_target, clean_base))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def list_uploaded_resumes() -> List[Dict[str, Any]]:
    """Lists all uploaded resumes metadata (without raw bytes) ordered by most recent."""
    async with get_db() as db:
        cursor = await db.execute("""
            SELECT id, filename, file_size, mime_type, created_at,
                   LENGTH(extracted_text) as extracted_text_len
            FROM uploaded_resumes
            ORDER BY created_at DESC
        """)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def delete_uploaded_resume(file_id_or_filename: str) -> bool:
    """Deletes an uploaded resume record from database."""
    clean_target = file_id_or_filename.strip()
    clean_base = os.path.basename(clean_target.replace("\\", "/"))
    async with get_db() as db:
        cursor = await db.execute("""
            DELETE FROM uploaded_resumes
            WHERE id = ? OR filename = ? OR filename = ?
        """, (clean_target, clean_target, clean_base))
        await db.commit()
        return cursor.rowcount > 0
